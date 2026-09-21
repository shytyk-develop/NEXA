import { sendPacket } from '../../../js/network.js';
import { getHistory, getUser, normalizeUsername, isValidUsername, usernamePolicyText } from '../../../js/api.js';
import { saveHistory, loadDraft, clearDraft } from '../../../js/storage.js';
import { attachReplyToMessage } from '../../../js/messageReply.js';
import { MESSAGE_STATUS, createOutgoingMessage, deriveOutgoingStatusFromDb } from '../../../js/messageState.js';
import { applyStatusEvent, onMessageAck, cancelReadReceipt } from '../../../js/messageSync.js';
import { normalizeReactionsList } from '../../../js/messageReactions.js';
import { applyMessageDeleted, applyConversationDeleted, resolveDeletionChatPartner } from '../../../js/messageDelete.js';
import { composeMessageText } from '../../../js/smartPaste.js';
import { isChatMuted } from '../../../js/privacy.js';
import { ingestUserRecords } from '../../../js/profileDirectory.js';
import {
    decryptMessage,
    encryptMessage,
    importPublicKey,
} from './cryptoService';
import { createEmitter, type ChatEngineEvent, type ChatEngineListener } from './events';

export type ChatState = {
    myUsername: string | null;
    myKeys: { publicKey: CryptoKey; privateKey: CryptoKey } | null;
    token: string | null;
    currentTargetUser: string | null;
    usersDirectory: Record<string, any>;
    sidebarChats: any[];
    chatHistory: Record<string, any[]>;
    onlineUsers: Set<string>;
    unreadCounts: Record<string, number>;
    typingUsers: Set<string>;
    preferences: any;
    pendingReply: any;
    [key: string]: any;
};

export type ChatEngineDeps = {
    getSocket: () => any;
    getRealtime: () => any;
    maxMessageLength: number;
    onToast?: (message: string, type?: string) => void;
    onNotifyIncoming?: (from: string, text: string, isActive: boolean) => void;
    onMessageDeleted?: (data: any) => void;
    onConversationDeleted?: (data: any) => void;
    onReactionSync?: (data: any) => void;
    onProfileUpdated?: (data: any) => void;
    onUsersList?: (data: any) => void;
    onPresence?: (data: any) => void;
    onTyping?: (data: any) => void;
};

export class ChatEngine {
    readonly state: ChatState;
    sidebarLoading = false;
    switchChatEpoch = 0;

    private readonly deps: ChatEngineDeps;
    private readonly emitter = createEmitter();
    private readonly mockPartners = new Set<string>();

    constructor(state: ChatState, deps: ChatEngineDeps) {
        this.state = state;
        this.deps = deps;
    }

    on(event: ChatEngineEvent, fn: ChatEngineListener) {
        return this.emitter.on(event, fn);
    }

    emit(event: ChatEngineEvent, payload?: any) {
        this.emitter.emit(event, payload);
    }

    getChats() {
        return this.state.sidebarChats || [];
    }

    getActiveChat() {
        return this.state.currentTargetUser;
    }

    getHistoryFor(username: string) {
        return this.state.chatHistory[username] || [];
    }

    getSidebarSnapshot() {
        return {
            chats: this.getChats(),
            activeUsername: this.state.currentTargetUser,
            myUsername: this.state.myUsername,
            onlineUsers: this.state.onlineUsers,
            unreadCounts: this.state.unreadCounts,
            typingUsers: this.state.typingUsers,
            preferences: this.state.preferences,
            loading: this.sidebarLoading,
        };
    }

    notifyChatsChanged() {
        this.emit('chatsChanged', { chats: this.getChats() });
    }

    notifyUiSync() {
        this.emit('uiSync');
    }

    setSidebarLoading(loading: boolean) {
        this.sidebarLoading = loading;
        this.emit('chatsLoading', { loading });
        this.notifyChatsChanged();
    }

    upsertSidebarChat(partner: string, extras: Record<string, any> = {}) {
        if (!partner || partner === this.state.myUsername) return;
        const username = normalizeUsername(partner);
        const existingIndex = this.state.sidebarChats.findIndex((chat) => chat.username === username);
        const merged = {
            ...(existingIndex >= 0 ? this.state.sidebarChats[existingIndex] : { username }),
            ...extras,
            username,
        };
        if (existingIndex >= 0) this.state.sidebarChats.splice(existingIndex, 1);
        this.state.sidebarChats.unshift(merged);
        if (merged.public_key) this.state.usersDirectory[username] = merged.public_key;
        this.notifyChatsChanged();
    }

    isMockPartner(username: string | null | undefined) {
        return Boolean(username && this.mockPartners.has(normalizeUsername(username)));
    }

    seedMockChats(fixtures: Array<{
        username: string;
        display_name?: string;
        last_message_at?: string;
        last_message_preview?: string;
        unread_count?: number;
        messages?: any[];
    }>) {
        if (!Array.isArray(fixtures) || !fixtures.length) return;
        for (const fixture of [...fixtures].reverse()) {
            const username = normalizeUsername(fixture.username);
            if (!username || username === this.state.myUsername) continue;
            this.mockPartners.add(username);
            this.state.usersDirectory[username] = this.state.usersDirectory[username] || 'mock';
            this.state.chatHistory[username] = Array.isArray(fixture.messages) ? fixture.messages.slice() : [];
            if (fixture.unread_count != null) {
                this.state.unreadCounts[username] = fixture.unread_count;
            }
            this.upsertSidebarChat(username, {
                display_name: fixture.display_name,
                public_key: 'mock',
                last_message_at: fixture.last_message_at,
                last_message_preview: fixture.last_message_preview,
                unread_count: fixture.unread_count,
            });
        }
        this.notifyChatsChanged();
    }

    persistableHistory() {
        return Object.fromEntries(
            Object.entries(this.state.chatHistory || {}).filter(([username]) => !this.mockPartners.has(username))
        );
    }

    saveChatHistorySoon(flush = false) {
        if (!this.state.myUsername) return;
        saveHistory(this.state.myUsername, this.persistableHistory());
        void flush;
    }

    sendChatFocus(partner: string | null) {
        const socket = this.deps.getSocket();
        if (!socket) return;
        sendPacket(socket, 'chat_focus', { partner: partner || null });
    }

    clearActiveChat() {
        this.switchChatEpoch += 1;
        this.state.currentTargetUser = null;
        this.state.pendingReply = null;
        this.sendChatFocus(null);
        cancelReadReceipt();
        this.emit('pendingReplyChanged', { pendingReply: null });
        this.emit('activeChatChanged', { username: null });
        this.notifyChatsChanged();
    }

    processMessage(chatPartner: string, messageInput: any) {
        if (!this.state.chatHistory[chatPartner]) {
            this.state.chatHistory[chatPartner] = [];
        }

        const message = {
            id: messageInput.id || null,
            clientMessageId: messageInput.clientMessageId || null,
            sender: messageInput.sender,
            text: messageInput.text,
            type: messageInput.type,
            timestamp: messageInput.timestamp || Date.now(),
            status: messageInput.status || (messageInput.type === 'outgoing' ? MESSAGE_STATUS.SENT : undefined),
            pending: messageInput.status === MESSAGE_STATUS.PENDING || messageInput.status === MESSAGE_STATUS.SENDING,
            replyTo: messageInput.replyTo || null,
            reactions: normalizeReactionsList(messageInput.reactions),
        };

        if (!message.replyTo && messageInput.replyToMessageId) {
            attachReplyToMessage(
                message,
                this.state.chatHistory,
                chatPartner,
                messageInput.replyToMessageId,
                this.state.myUsername
            );
        }

        const history = this.state.chatHistory[chatPartner];
        const existing = findHistoryMessage(history, message);
        if (existing) {
            if (message.status) existing.status = message.status;
            if (message.text) existing.text = message.text;
            if (message.timestamp) existing.timestamp = message.timestamp;
            if (message.id) existing.id = message.id;
            if (message.replyTo) existing.replyTo = message.replyTo;
            if (message.reactions?.length) existing.reactions = message.reactions;
            this.saveChatHistorySoon();
            if (this.state.currentTargetUser === chatPartner) {
                this.emit('messagePatched', { partner: chatPartner, message: existing });
            }
            return existing;
        }

        history.push(message);
        this.saveChatHistorySoon();
        if (this.state.currentTargetUser === chatPartner) {
            const previous = history.length > 1 ? history[history.length - 2] : null;
            this.emit('messageAppended', { partner: chatPartner, message, previous });
        }
        return message;
    }

    async ensureUserKey(username: string) {
        if (this.state.usersDirectory[username]) return true;
        if (!this.state.token) return false;
        try {
            const user = await getUser(this.state.token, username);
            this.state.usersDirectory[user.username] = user.public_key;
            return true;
        } catch (err) {
            console.error('User lookup failed:', err);
            this.deps.onToast?.('User was not found.', 'error');
            return false;
        }
    }

    mapDbMessageToLocal(msg: any, partner: string) {
        const isMe = msg.sender === this.state.myUsername;
        const record: any = {
            id: msg.id,
            clientMessageId: msg.client_message_id,
            sender: isMe ? 'You' : msg.sender,
            text: '',
            type: isMe ? 'outgoing' : 'incoming',
            timestamp: msg.timestamp || Date.now(),
            status: isMe ? deriveOutgoingStatusFromDb(msg, this.state.myUsername) : undefined,
            pending: false,
            reactions: normalizeReactionsList(msg.reactions),
        };
        attachReplyToMessage(
            record,
            this.state.chatHistory,
            partner,
            msg.reply_to_message_id,
            this.state.myUsername
        );
        return record;
    }

    async selectChat(username: string) {
        const epoch = ++this.switchChatEpoch;
        username = normalizeUsername(username);
        if (!isValidUsername(username)) {
            this.deps.onToast?.(usernamePolicyText(), 'error');
            return { ok: false, reason: 'invalid', username, epoch };
        }

        const userReady = await this.ensureUserKey(username);
        if (epoch !== this.switchChatEpoch) return { ok: false, reason: 'stale', username, epoch };
        if (!userReady) return { ok: false, reason: 'missing-key', username, epoch };

        const isMock = this.isMockPartner(username);
        if (!isMock) this.saveChatHistorySoon(true);
        cancelReadReceipt();
        this.state.pendingReply = null;
        this.emit('pendingReplyChanged', { pendingReply: null });
        this.state.currentTargetUser = username;
        this.sendChatFocus(username);
        this.emit('activeChatChanged', { username });
        this.notifyChatsChanged();

        if (isMock) {
            const messages = this.state.chatHistory[username] || [];
            this.emit('historyReplaced', { partner: username, messages });
            return { ok: true, username, epoch, messages, draft: loadDraft(this.state.myUsername, username) };
        }

        try {
            const cloudHistory = await getHistory(this.state.token, this.state.myUsername, username, 50, 0);
            if (epoch !== this.switchChatEpoch) return { ok: false, reason: 'stale', username, epoch };
            this.state.chatHistory[username] = [];

            for (const msg of cloudHistory) {
                const isMe = msg.sender === this.state.myUsername;
                const rawBytes = isMe ? msg.content_sender : msg.content_recipient;
                const encryptedBytes = new Uint8Array(rawBytes);
                try {
                    const decryptedText = await decryptMessage(this.state.myKeys!.privateKey, encryptedBytes);
                    const record = this.mapDbMessageToLocal(msg, username);
                    record.text = decryptedText;
                    this.state.chatHistory[username].push(record);
                } catch (cryptoErr) {
                    console.error('Crypto payload corruption block dropped:', cryptoErr);
                }
            }
        } catch (err) {
            console.warn('Database sync unreachable, using browser cache storage fallback:', err);
        }

        if (epoch !== this.switchChatEpoch) return { ok: false, reason: 'stale', username, epoch };

        const messages = this.state.chatHistory[username] || [];
        this.emit('historyReplaced', { partner: username, messages });
        this.saveChatHistorySoon(true);
        return { ok: true, username, epoch, messages, draft: loadDraft(this.state.myUsername, username) };
    }

    async sendText(rawText?: string) {
        const text = composeMessageText(rawText ?? '');
        const partner = this.state.currentTargetUser;

        if (!partner) {
            this.deps.onToast?.('Select a chat first.', 'error');
            return { ok: false, reason: 'no-chat' };
        }
        if (!text) return { ok: false, reason: 'empty' };
        if (text.length > this.deps.maxMessageLength) {
            return { ok: false, reason: 'limit', message: `Message exceeds ${this.deps.maxMessageLength} characters and was not sent.` };
        }

        const targetPublicKeyJWK = this.state.usersDirectory[partner];
        if (!targetPublicKeyJWK) {
            this.deps.onToast?.('Recipient key is not available yet. Refresh contacts.', 'error');
            return { ok: false, reason: 'no-key' };
        }

        try {
            const targetCryptoKey = await importPublicKey(targetPublicKeyJWK);
            const encryptedBufferRecipient = await encryptMessage(targetCryptoKey, text);
            const encryptedArrayRecipient = Array.from(new Uint8Array(encryptedBufferRecipient));
            const encryptedBufferSelf = await encryptMessage(this.state.myKeys!.publicKey, text);
            const encryptedArraySender = Array.from(new Uint8Array(encryptedBufferSelf));
            const clientMessageId = crypto.randomUUID();
            const replyToId = this.state.pendingReply?.messageId ?? null;
            const replyMeta = this.state.pendingReply
                ? {
                    messageId: this.state.pendingReply.messageId,
                    unavailable: false,
                    author: this.state.pendingReply.author,
                    preview: this.state.pendingReply.preview,
                }
                : null;

            const sent = sendPacket(this.deps.getSocket(), 'message', {
                to: partner,
                content_recipient: encryptedArrayRecipient,
                content_sender: encryptedArraySender,
                client_message_id: clientMessageId,
                reply_to_message_id: replyToId,
            });

            if (!sent) {
                const failed = createOutgoingMessage({
                    clientMessageId,
                    text,
                    status: MESSAGE_STATUS.FAILED,
                });
                this.processMessage(partner, failed);
                throw new Error('WebSocket is not connected');
            }

            this.upsertSidebarChat(partner, {
                public_key: targetPublicKeyJWK,
                last_message_at: new Date().toISOString(),
                last_message_preview: text,
            });

            this.processMessage(partner, createOutgoingMessage({
                clientMessageId,
                text,
                status: MESSAGE_STATUS.SENDING,
                replyTo: replyMeta,
            }));
            this.state.pendingReply = null;
            this.emit('pendingReplyChanged', { pendingReply: null });
            clearDraft(this.state.myUsername, partner);
            return { ok: true, clientMessageId };
        } catch (err: any) {
            console.error('Message send failed:', err);
            if (err instanceof RangeError) {
                return { ok: false, reason: 'limit', message: err.message };
            }
            this.deps.onToast?.('Message send failed. Check connection and keys.', 'error');
            return { ok: false, reason: 'send-failed', error: err };
        }
    }

    async ingestPacket(data: any) {
        const type = data?.type;
        if (type === 'users_list') {
            ingestUserRecords(data.users);
            data.users.forEach((u: any) => {
                this.state.usersDirectory[u.username] = u.public_key;
            });
            this.deps.onUsersList?.(data);
            this.notifyChatsChanged();
            return;
        }
        if (type === 'profile_updated') {
            this.deps.onProfileUpdated?.(data);
            return;
        }
        if (type === 'presence_sync' || type === 'presence' || type === 'typing' || type === 'unread_sync') {
            if (type === 'presence_sync' || type === 'presence') this.deps.onPresence?.(data);
            if (type === 'typing') this.deps.onTyping?.(data);
            if (type === 'unread_sync') this.deps.getRealtime()?.setUnread(data.partner, data.unread_count);
            this.notifyUiSync();
            return;
        }
        if (type === 'new_chat') {
            const partner = data?.partner;
            if (!partner?.username) return;
            this.upsertSidebarChat(partner.username, {
                public_key: partner.public_key,
                last_message_at: data.last_message_at || new Date().toISOString(),
            });
            return;
        }
        if (type === 'message') {
            const encryptedBytes = new Uint8Array(data.content);
            const decryptedText = await decryptMessage(this.state.myKeys!.privateKey, encryptedBytes);
            this.upsertSidebarChat(data.from, {
                last_message_at: data.timestamp || new Date().toISOString(),
                last_message_preview: decryptedText,
            });
            const isActiveChat = this.state.currentTargetUser === data.from;
            if (!isActiveChat && !isChatMuted(this.state.myUsername, data.from)) {
                this.deps.getRealtime()?.incrementUnread(data.from);
            }
            this.deps.onNotifyIncoming?.(data.from, decryptedText, isActiveChat);
            const incoming: any = {
                id: data.id,
                clientMessageId: data.client_message_id,
                sender: data.from,
                text: decryptedText,
                type: 'incoming',
                timestamp: data.timestamp || Date.now(),
                reactions: [],
            };
            attachReplyToMessage(
                incoming,
                this.state.chatHistory,
                data.from,
                data.reply_to_message_id,
                this.state.myUsername
            );
            this.processMessage(data.from, incoming);
            if (data.id) {
                this.deps.getRealtime()?.sendDeliveryAck(data.from, data.id, data.client_message_id);
            }
            return { incoming, isActiveChat };
        }
        if (type === 'message_sync') {
            const partner = data.from;
            const messages = this.state.chatHistory[partner] || [];
            const target = messages.find((m: any) => m.clientMessageId === data.client_message_id);
            if (target && data.id) {
                target.id = data.id;
                if (data.timestamp) target.timestamp = data.timestamp;
                if (data.reply_to_message_id) {
                    attachReplyToMessage(
                        target,
                        this.state.chatHistory,
                        partner,
                        data.reply_to_message_id,
                        this.state.myUsername
                    );
                }
                this.saveChatHistorySoon();
                if (this.state.currentTargetUser === partner) {
                    this.emit('messagePatched', { partner, message: target, sync: data });
                }
            }
            return;
        }
        if (type === 'message_ack') {
            onMessageAck(this.state.chatHistory, data, () => this.saveChatHistorySoon());
            this.emit('messagePatched', { partner: this.state.currentTargetUser, ack: data });
            return;
        }
        if (type === 'message_status') {
            applyStatusEvent(this.state.chatHistory, data, () => this.saveChatHistorySoon());
            this.emit('messagePatched', { partner: this.state.currentTargetUser, status: data });
            return;
        }
        if (type === 'message_deleted') {
            this.deps.onMessageDeleted?.(data);
            return;
        }
        if (type === 'conversation_deleted') {
            this.deps.onConversationDeleted?.(data);
            this.notifyChatsChanged();
            return;
        }
        if (type === 'reaction_sync') {
            this.deps.onReactionSync?.(data);
            return;
        }
    }
}

function findHistoryMessage(history: any[], message: any) {
    if (!Array.isArray(history) || !message) return null;
    return history.find((item) =>
        (message.id != null && item.id != null && String(item.id) === String(message.id)) ||
        (message.clientMessageId && item.clientMessageId === message.clientMessageId)
    ) || null;
}

let engineSingleton: ChatEngine | null = null;

export function createChatEngine(state: ChatState, deps: ChatEngineDeps) {
    engineSingleton = new ChatEngine(state, deps);
    return engineSingleton;
}

export function getChatEngine() {
    if (!engineSingleton) throw new Error('ChatEngine is not created yet');
    return engineSingleton;
}

export function peekChatEngine() {
    return engineSingleton;
}
