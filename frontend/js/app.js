// frontend/js/app.js

import {
    DOM,
    updateStatus,
    renderUsersList,
    setSidebarChats,
    activateChatPanel,
    resetChatPanel,
    showPeerEmpty,
    showChatWelcome,
    appendMessage,
    renderMessagesList,
    clearMessageView,
    patchGroupingFromState,
    patchMessageReplyPreview,
    filterUsers,
    focusComposer,
    focusContactSearch,
    autoResizeComposer,
    updateComposerMeta,
    setDraftStatus,
    setComposerValue,
    getComposerValue,
    clearComposer,
    insertAtCursor,
    scrollMessagesToBottom,
    syncComposerClearance,
    openChatMenu,
    openComposerMenu,
    openSettingsMenu,
    closeAllPopovers,
    closeEmojiPicker,
    toggleEmojiPicker,
    openChatInfoPopover,
    initMessageContextMenu,
    initMessageActions,
    initJumpToBottom,
    highlightMessageRow,
    findMessageElement,
    openMessageSearch,
    closeMessageSearch,
    toggleMessageSearch,
    searchMessages,
    openSettings,
    openAppSettings,
    openProfile,
    showChatsView,
    handleProfileBack,
    handleChatBack,
    onProfileSectionOpened,
    openShortcuts,
    closeModals,
    closeTransientUi,
    showToast,
    setPreferenceControls,
    clearUsersList,
    showContactsLoading,
    updateMessageIdentity,
    updateMessageStatus,
    removeMessageElement,
    removeMessageFromDom,
    setMessageActionHandlers,
    setRealtimeContext,
    setUiPreferences,
    updateProfileRailButton,
    refreshContactList,
    showComposerReplyBar,
    hideComposerReplyBar,
    patchMessageReactionsDom,
    openReactionPicker,
    scrollToMessageById,
    reconcileMessageRowsWithHistory,
    MAX_MESSAGE_LENGTH,
    showComposerLimitError,
    clearComposerLimitError,
    bindChatChrome,
    resetChatChromeBind,
    setSidebarRenderer,
} from './ui.js';
import { createChatEngine } from '../src/chat/engine/chatEngine.ts';
import {
    attachReplyToMessage,
    buildPendingReplyFromMessage,
} from './messageReply.js';
import {
    applyReactionSync,
    applyLocalReaction,
    getMyReaction,
    normalizeReactionsList,
    sendReactionPacket,
} from './messageReactions.js';
import { createRealtimeController, isUserOnline } from './realtime.js';
import {
    initOverlayManager,
    registerOverlayActions,
    closeOverlaysForRouteChange,
} from '../ui/overlays/overlayManager.js';
import {
    MESSAGE_STATUS,
    createOutgoingMessage,
    deriveOutgoingStatusFromDb,
} from './messageState.js';
import {
    applyStatusEvent,
    onMessageAck,
    flushReadReceipt,
    cancelReadReceipt,
} from './messageSync.js';
import {
    applyMessageDeleted,
    applyConversationDeleted,
    logDelete,
    resolveDeletionChatPartner,
} from './messageDelete.js';
import { connectToServer, sendPacket } from './network.js';
import { 
    generateKeyPair, 
    exportPublicKey, 
    exportPrivateKey, 
    importPublicKey, 
    importPrivateKey, 
    encryptMessage, 
    decryptMessage,
    encryptPrivateKeyWithPassword,
    decryptPrivateKeyWithPassword
} from './crypto.js';
import { saveHistory, loadHistory, saveKeys, loadKeys, saveDraft, loadDraft, clearDraft } from './storage.js';
import { initRouter, navigateTo, replaceTo } from './router.js';
import { loadPreferences, applyPreferences, updatePreference } from './preferences.js';
import { initProfileSettings } from './profileSettings.js';
import {
    initComposeSearch,
    openComposeSearch,
    closeComposeSearch,
    isComposeSearchOpen,
} from './composeSearch.js';
import { initLoginPage, teardownLoginPage } from './loginPage.js';
import { initAboutSecurity, teardownAboutSecurity } from './aboutSecurity.js';
import {
    addPasteAttachment,
    clearPasteAttachments,
    composeMessageText,
    getPasteAttachments,
    MAX_PASTE_ATTACHMENTS,
    setPasteAttachmentsChangeHandler,
    shouldCapturePaste,
} from './smartPaste.js';
import { getPrivacyFlags, isChatMuted, toggleChatMuted, loadMutedChats } from './privacy.js';
import { registerShortcuts } from './shortcuts.js';
import {
    buildChatTranscript,
    downloadTextFile,
    copyText,
    createFileMarkers,
    makeSafeFilename
} from './chatActions.js';
import {
    normalizeUsername,
    isValidUsername,
    usernamePolicyText,
    loginRequest,
    registerRequest,
    getChats,
    getUser,
    getHistory,
    deleteMessage,
    deleteConversation,
    updateProfile,
    registerDevice,
    syncMuted,
} from './api.js';
import {
    detectDeviceInfo,
    devicePayload,
    enrichDeviceInfo,
} from './device.js';
import {
    ensureNotificationPermission,
    notificationPrefs,
    notifyIncomingMessage,
} from './notifications.js';
import {
    cacheRemoteProfileFromApi,
    clearProfileDirectory,
    ingestUserRecords,
} from './profileDirectory.js';

let socketConnection = null;
let routerReady = false;
let messageSearchTimer = null;
let saveChatHistoryTimer = null;
let realtime = null;
/** Quiet sidebar chat list sync — backup to realtime, avoids hammering /api/chats */
const SIDEBAR_CHATS_POLL_MS = 90_000;
let sidebarChatsPollTimer = null;
let sidebarChatsLoadPromise = null;
let sidebarChatsLastFetchedAt = 0;
let state = {
    myUsername: null,
    myKeys: null,
    myPublicKeyJwk: null,
    token: null,
    currentTargetUser: null,
    usersDirectory: {},
    sidebarChats: [],
    chatHistory: {},
    onlineUsers: new Set(),
    unreadCounts: {},
    typingUsers: new Set(),
    preferences: loadPreferences(),
    pendingReply: null,
};

function syncRealtimeUi() {
    setRealtimeContext({
        onlineUsers: state.onlineUsers,
        unreadCounts: state.unreadCounts,
        typingUsers: state.typingUsers,
    });
    engine.notifyUiSync();
}

function syncUiPreferences() {
    setUiPreferences(state.preferences);
}

function ensureRealtime() {
    if (realtime) return realtime;
    realtime = createRealtimeController({
        getSocket,
        sendPacket,
        getState: () => state,
        onUiSync: syncRealtimeUi,
    });
    return realtime;
}

function getSocket() {
    return socketConnection?.current || null;
}

const engine = createChatEngine(state, {
    getSocket,
    getRealtime: () => ensureRealtime(),
    maxMessageLength: MAX_MESSAGE_LENGTH,
    onToast: (message, type) => showToast(message, type),
    onNotifyIncoming: (from, text, isActive) => maybeNotifyIncomingMessage(from, text, isActive),
    onMessageDeleted: (data) => handleMessageDeletedEvent(data),
    onConversationDeleted: (data) => handleConversationDeletedEvent(data),
    onReactionSync: (data) => handleReactionSyncEvent(data),
    onProfileUpdated: (data) => handleProfileUpdated(data),
    onUsersList: () => refreshContactList(),
    onPresence: (data) => {
        if (data.type === 'presence_sync') {
            if (getPrivacyFlags(state.preferences).showOnlineStatus) {
                ensureRealtime().setOnlineUsers(data.online || []);
            } else {
                ensureRealtime().setOnlineUsers([]);
            }
            return;
        }
        if (!getPrivacyFlags(state.preferences).showOnlineStatus) return;
        ensureRealtime().setPresence(data.username, Boolean(data.online));
    },
    onTyping: (data) => {
        if (getPrivacyFlags(state.preferences).typingIndicators) {
            ensureRealtime().setTyping(data.from, Boolean(data.is_typing));
        }
    },
});

function wireEngineUi() {
    engine.on('chatsChanged', () => {
        setSidebarChats(
            state.sidebarChats,
            state.myUsername,
            onContactSelected,
            state.currentTargetUser
        );
        syncRealtimeUi();
    });
    engine.on('activeChatChanged', ({ username }) => {
        if (username) {
            activateChatPanel(username);
            DOM.chatWelcome?.classList.add('hidden');
            clearMessageView();
        }
    });
    engine.on('historyReplaced', ({ messages }) => {
        if (messages?.length) renderMessagesList(messages);
    });
    engine.on('messageAppended', ({ message, previous }) => {
        appendMessage(message, null, null, null, previous);
    });
    engine.on('messagePatched', (payload) => {
        const existing = payload?.message;
        const sync = payload?.sync;
        if (existing && sync) {
            if (existing.replyTo && existing.id) {
                patchMessageReplyPreview(existing.id, existing.replyTo);
            }
            if (sync.client_message_id) {
                updateMessageIdentity(
                    sync.client_message_id,
                    sync.id,
                    sync.timestamp,
                    existing.status || 'sent'
                );
                reconcileMessageRowsWithHistory([existing]);
            }
            return;
        }
        if (!existing) return;
        if (existing.clientMessageId) {
            if (existing.id) {
                updateMessageIdentity(
                    existing.clientMessageId,
                    existing.id,
                    existing.timestamp,
                    existing.status || MESSAGE_STATUS.SENT
                );
                if (existing.replyTo) {
                    patchMessageReplyPreview(existing.id, existing.replyTo);
                }
            } else if (existing.status) {
                updateMessageStatus(existing.clientMessageId, null, existing.status);
            }
        }
        reconcileMessageRowsWithHistory([existing]);
    });
    engine.on('pendingReplyChanged', ({ pendingReply }) => {
        if (!pendingReply) hideComposerReplyBar();
    });
}

let pendingMessageJump = null;

function consumePendingMessageJump(username) {
    const pending = pendingMessageJump;
    if (!pending) return;
    if (
        username
        && normalizeUsername(pending.username) !== normalizeUsername(username)
    ) {
        return;
    }
    pendingMessageJump = null;
    const tryJump = () => {
        const row = findMessageElement({
            messageId: pending.messageId,
            clientMessageId: pending.clientMessageId,
        });
        if (!row) return false;
        DOM.messagesDiv
            ?.querySelectorAll('.message-row.is-highlighted')
            .forEach((el) => el.classList.remove('is-highlighted'));
        row.classList.add('is-highlighted');
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        window.setTimeout(() => row.classList.remove('is-highlighted'), 1600);
        return true;
    };
    window.requestAnimationFrame(() => {
        if (tryJump()) return;
        window.setTimeout(tryJump, 80);
    });
}

function onContactSelected(username) {
    closeComposeSearch();
    // Leave Profile/Settings so the chat workspace is visible again.
    showChatsView();
    navigateTo(`/chat/@${username}`, handleNavigation);
}

function openNewChatCompose() {
    showChatsView();
    closeMessageSearch();
    closeAllPopovers();

    if (isComposeSearchOpen()) {
        document.getElementById('uiComposeSearchInput')?.focus({ preventScroll: true });
        return;
    }

    const leavingChat =
        Boolean(state.currentTargetUser)
        || /^\/chat\/@/i.test(window.location.pathname);

    // Spotlight first so welcome CSS hide is active before any panel reset.
    openComposeSearch();

    if (leavingChat) {
        leaveActiveChatForCompose();
    }
}

function leaveActiveChatForCompose() {
    engine.switchChatEpoch += 1;
    pendingMessageJump = null;
    persistCurrentDraft();
    flushChatHistorySave();
    cancelReadReceipt();
    clearPendingReply();
    state.currentTargetUser = null;
    sendChatFocus(null);
    // Peer rail must flip with Spotlight — don't wait on message exit.
    showPeerEmpty();

    const messages = DOM.messagesDiv;
    const finish = () => {
        messages?.classList.remove('is-compose-exit');
        resetChatPanel();
        // Keep welcome mounted under Spotlight so it can fade with the composer on close.
        if (DOM.chatWelcome) DOM.chatWelcome.classList.remove('hidden');
        if (window.location.pathname !== '/chat') {
            window.history.pushState(null, null, '/chat');
        }
        renderSidebar();
        syncRealtimeUi();
    };

    if (messages?.children.length) {
        messages.classList.add('is-compose-exit');
        window.setTimeout(finish, 220);
        return;
    }

    finish();
}

function renderSidebar() {
    setSidebarChats(
        state.sidebarChats,
        state.myUsername,
        onContactSelected,
        state.currentTargetUser
    );
    engine.notifyChatsChanged();
    syncRealtimeUi();
}

function upsertSidebarChat(partner, extras = {}) {
    engine.upsertSidebarChat(partner, extras);
}

function handleNewChatEvent(data) {
    const partner = data?.partner;
    if (!partner?.username) return;

    upsertSidebarChat(partner.username, {
        public_key: partner.public_key,
        last_message_at: data.last_message_at || new Date().toISOString(),
    });
}

function saveChatHistory() {
    if (!state.myUsername) return;
    window.clearTimeout(saveChatHistoryTimer);
    saveChatHistoryTimer = window.setTimeout(() => {
        saveHistory(state.myUsername, engine.persistableHistory());
        saveChatHistoryTimer = null;
    }, 120);
}

function flushChatHistorySave() {
    if (saveChatHistoryTimer) {
        window.clearTimeout(saveChatHistoryTimer);
        saveChatHistoryTimer = null;
    }
    if (state.myUsername) {
        saveHistory(state.myUsername, engine.persistableHistory());
    }
}

function clearPendingReply() {
    state.pendingReply = null;
    hideComposerReplyBar();
}

function startReplyToMessage(payload) {
    const partner = state.currentTargetUser;
    if (!partner || !payload?.messageId) return;

    const message = (state.chatHistory[partner] || []).find(
        (m) => String(m.id) === String(payload.messageId)
    );
    if (!message) return;

    state.pendingReply = buildPendingReplyFromMessage(message, partner);
    showComposerReplyBar(state.pendingReply);
    focusComposer();
}

function sendReactionForMessage(messageId, emoji) {
    const partner = state.currentTargetUser;
    if (!partner || messageId == null) return;

    const message = (state.chatHistory[partner] || []).find(
        (m) => String(m.id) === String(messageId)
    );
    if (!message) return;

    const mine = getMyReaction(message.reactions, state.myUsername);
    const nextEmoji = mine === emoji ? null : emoji;
    const previous = normalizeReactionsList(message.reactions);

    const reactions = applyLocalReaction(message, state.myUsername, nextEmoji);
    saveChatHistory();
    patchMessageReactionsDom(messageId, reactions, state.myUsername);

    const sent = sendReactionPacket(getSocket(), sendPacket, messageId, nextEmoji);
    if (!sent) {
        message.reactions = previous;
        saveChatHistory();
        patchMessageReactionsDom(messageId, previous, state.myUsername);
        showToast('Could not send reaction. Check connection.', 'error');
    }
}

function handleToggleReaction(messageId, emoji, anchor) {
    if (emoji) {
        sendReactionForMessage(messageId, emoji);
        return;
    }

    const partner = state.currentTargetUser;
    const message = (state.chatHistory[partner] || []).find(
        (m) => String(m.id) === String(messageId)
    );
    const mine = message ? getMyReaction(message.reactions, state.myUsername) : null;

    if (anchor) {
        openReactionPicker(anchor, messageId, mine);
        return;
    }

    if (mine) {
        sendReactionForMessage(messageId, mine);
    }
}

function mapDbMessageToLocal(msg, partner) {
    const isMe = msg.sender === state.myUsername;
    const record = {
        id: msg.id,
        clientMessageId: msg.client_message_id,
        sender: isMe ? 'You' : msg.sender,
        text: '',
        type: isMe ? 'outgoing' : 'incoming',
        timestamp: msg.timestamp || Date.now(),
        status: isMe ? deriveOutgoingStatusFromDb(msg, state.myUsername) : undefined,
        pending: false,
        reactions: normalizeReactionsList(msg.reactions),
    };
    attachReplyToMessage(
        record,
        state.chatHistory,
        partner,
        msg.reply_to_message_id,
        state.myUsername
    );
    return record;
}

function markRepliesUnavailable(partner, deletedMessageId) {
    const messages = state.chatHistory[partner] || [];
    const affectedIds = [];
    messages.forEach((m) => {
        if (m.replyTo && String(m.replyTo.messageId) === String(deletedMessageId)) {
            m.replyTo = {
                messageId: deletedMessageId,
                unavailable: true,
                deleted: true,
                author: m.replyTo.author || '',
                preview: 'Message deleted',
            };
            if (m.id != null) affectedIds.push(m.id);
        }
    });
    return affectedIds;
}

function patchReplyPreviewsForMessages(partner, messageIds) {
    const messages = state.chatHistory[partner] || [];
    messageIds.forEach((id) => {
        const msg = messages.find((m) => m.id != null && String(m.id) === String(id));
        if (msg?.replyTo) {
            patchMessageReplyPreview(msg.id, msg.replyTo);
        }
    });
}

function applyActiveChatMessageDeletion(deletion) {
    const activeChat = state.currentTargetUser;
    if (!activeChat) return;

    const removed = removeMessageFromDom(deletion);
    const messagesAfter = state.chatHistory[activeChat] || [];
    if (removed) {
        patchGroupingFromState(messagesAfter);
    }
}

function handleMessageDeletedEvent(data) {
    console.log('[WS RECEIVED]', data);

    const chatPartner = resolveDeletionChatPartner(data, state.myUsername);
    const activeChat = state.currentTargetUser;
    const deletion = {
        messageId: data.message_id,
        clientMessageId: data.client_message_id,
    };

    const partnerKey = chatPartner || activeChat;
    const affectedReplyIds =
        partnerKey && data.message_id
            ? markRepliesUnavailable(partnerKey, data.message_id)
            : [];

    const { changed, partner: affectedKey } = applyMessageDeleted(
        state.chatHistory,
        data,
        saveChatHistory,
        state.myUsername
    );

    const activePartner = activeChat && (
        activeChat === partnerKey ||
        activeChat === affectedKey ||
        normalizeUsername(activeChat) === normalizeUsername(partnerKey || '')
    );

    if (activePartner) {
        applyActiveChatMessageDeletion(deletion);
        if (affectedReplyIds.length) {
            patchReplyPreviewsForMessages(activeChat, affectedReplyIds);
        }
    } else if (changed) {
        removeMessageFromDom(deletion);
    }

    logDelete('[STATE UPDATED]', { changed, affectedKey, activePartner, affectedReplyIds });
}

function handleConversationDeletedEvent(data) {
    console.log('[WS RECEIVED]', data);

    const chatPartner = resolveDeletionChatPartner(
        {
            ...data,
            sender: data.deleted_by,
            receiver: data.partner || data.chat_id,
        },
        state.myUsername
    );
    if (!chatPartner) return;

    applyConversationDeleted(state.chatHistory, data, saveChatHistory, state.myUsername);
    state.sidebarChats = state.sidebarChats.filter(
        (chat) => normalizeUsername(chat.username) !== chatPartner
    );

    if (state.currentTargetUser && normalizeUsername(state.currentTargetUser) === chatPartner) {
        clearMessageView();
        clearDraft(state.myUsername, state.currentTargetUser);
        logDelete('[UI CLEARED conversation]', chatPartner);
    }

    renderSidebar();
}

function refreshContactsDisplay() {
    refreshContactList();
    syncRealtimeUi();
}

function handleProfileUpdated(data) {
    if (!data?.username) return;
    cacheRemoteProfileFromApi(data.username, data);
    refreshContactsDisplay();
    if (state.currentTargetUser === data.username) {
        activateChatPanel(data.username);
    }
}

async function syncProfileToServer(profile) {
    if (!state.token || !profile) return;
    await updateProfile(state.token, profile);
}

function sendChatFocus(partner) {
    const socket = getSocket();
    if (!socket) return;
    sendPacket(socket, 'chat_focus', { partner: partner || null });
}

function syncPresencePrivacy() {
    const share = getPrivacyFlags(state.preferences).showOnlineStatus;
    const socket = getSocket();
    if (socket) {
        sendPacket(socket, 'presence_setting', { share_presence: share });
    }
    if (!share) {
        ensureRealtime().setOnlineUsers([]);
    }
    syncRealtimeUi();
}

function markActiveChatRead() {
    const partner = state.currentTargetUser;
    if (!partner) return;

    ensureRealtime().clearUnread(partner);
    sendChatFocus(partner);

    if (!getPrivacyFlags(state.preferences).readReceipts) return;

    flushReadReceipt(
        partner,
        (p, upToId) => ensureRealtime().sendReadReceipt(p, upToId),
        (p) => state.chatHistory[p]
    );
}

applyPreferences(state.preferences);
setPreferenceControls(state.preferences);
syncUiPreferences();
resetChatPanel();
clearUsersList();

initOverlayManager();

initProfileSettings({
    getUsername: () => state.myUsername || localStorage.getItem('auth_username') || '',
    getPublicKeyJwk: () => state.myPublicKeyJwk,
    ensurePublicKeyJwk: async () => {
        if (state.myPublicKeyJwk) return state.myPublicKeyJwk;
        const user = state.myUsername || localStorage.getItem('auth_username');
        const saved = loadKeys(user);
        if (saved?.publicKey) {
            state.myPublicKeyJwk = saved.publicKey;
            return saved.publicKey;
        }
        return null;
    },
    getPreferences: () => state.preferences,
    getToken: () => state.token || localStorage.getItem('auth_token') || '',
    onPreferenceChange: (key, value, opts = {}) => {
        state.preferences = updatePreference(state.preferences, key, value);
        setPreferenceControls(state.preferences);
        syncUiPreferences();
        if (key === 'showOnlineStatus') {
            syncPresencePrivacy();
        }
        if (key === 'typingIndicators' && !value) {
            ensureRealtime().stopTyping();
            state.typingUsers = new Set();
            syncRealtimeUi();
        }
        const appearanceKeys = new Set(['glassIntensity', 'wallpaper', 'wallpaperDim', 'compactMode']);
        if (appearanceKeys.has(key)) {
            if (!opts.silent) showToast('Appearance updated.', 'success');
            return;
        }
        if (!opts.silent) showToast('Privacy setting applied.', 'success');
    },
    openSettingsSection: (section) => openAppSettings(section),
    onProfileSectionChange: () => onProfileSectionOpened(),
    onProfileSaved: async (profile) => {
        updateProfileRailButton(state.myUsername);
        try {
            await syncProfileToServer(profile);
            refreshContactsDisplay();
        } catch (err) {
            console.error('Profile sync failed:', err);
            showToast('Saved locally; server sync failed.', 'error');
        }
    },
    onClearAllHistory: async () => {
        const partners = new Set([
            ...Object.keys(state.chatHistory || {}),
            ...(state.sidebarChats || []).map((chat) => chat.username),
        ]);
        const errors = [];
        for (const partner of partners) {
            if (!partner) continue;
            if (normalizeUsername(partner) === normalizeUsername(state.myUsername)) continue;
            try {
                await deleteConversation(state.token, partner);
            } catch (err) {
                console.error('Delete conversation failed:', partner, err);
                errors.push(partner);
            }
        }
        state.chatHistory = {};
        flushChatHistorySave();
        state.sidebarChats = [];
        clearMessageView();
        resetChatPanel();
        renderSidebar();
        if (errors.length) {
            throw new Error(`Could not delete: ${errors.join(', ')}`);
        }
    },
    showToast,
});

function initComposeSearchRuntime() {
initComposeSearch({
    getToken: () => state.token || localStorage.getItem('auth_token') || '',
    getMyUsername: () => state.myUsername || '',
    getConversations: () => state.sidebarChats || [],
    getChatHistory: () => state.chatHistory || {},
    onSelect: (result) => {
        const username = typeof result === 'string' ? result : result?.username;
        if (!username) return;

        if (result && typeof result === 'object' && result.kind === 'message') {
            pendingMessageJump = {
                username,
                messageId: result.messageId,
                clientMessageId: result.clientMessageId,
            };
            const alreadyOpen = window.location.pathname.toLowerCase()
                === `/chat/@${normalizeUsername(username)}`;
            if (alreadyOpen) {
                closeComposeSearch();
                consumePendingMessageJump(username);
                return;
            }
        } else {
            pendingMessageJump = null;
        }

        onContactSelected(username);
    },
    onRestoreWelcome: () => {
        if (!state.currentTargetUser) showChatWelcome({ animate: false });
    },
    onError: (err) => {
        showToast(err?.message || 'User search failed.', 'error');
    },
});
}

registerOverlayActions({
    'chat.search': () => openMessageSearch(),
    'chat.copyLink': () => copyCurrentChatLink(),
    'chat.export': () => exportCurrentChat(),
    'chat.clearHistory': () => clearCurrentChatHistory(),
    'chat.delete': () => deleteCurrentChat(),
    'chat.info': () => openCurrentChatInfo(),
    'chat.mute': () => toggleCurrentChatMute(),
    'settings.modal': () => openSettings(),
    'settings.shortcuts': () => openShortcuts(),
    'composer.timestamp': () => {
        insertAtCursor(new Date().toLocaleString());
        persistCurrentDraft();
    },
    'composer.securityNote': () => {
        insertAtCursor('Encrypted locally before transport.');
        persistCurrentDraft();
    },
    'composer.clearDraft': () => {
        clearDraft(state.myUsername, state.currentTargetUser);
        clearComposer();
        setDraftStatus('Draft cleared.');
    },
    'message.copy': (payload) => {
        const text = payload?.text || '';
        if (!text) return;
        copyText(text)
            .then(() => showToast('Message copied.', 'success'))
            .catch(() => showToast('Copy failed.', 'error'));
    },
    'message.delete': (payload) => {
        // The quick bar's delete button has its own Confirm step.
        if (payload?.messageId) deleteSingleMessage(payload.messageId, { confirmed: payload.confirmed === true });
    },
    'message.highlight': (payload) => {
        highlightMessageRow(payload?.messageId || payload?.clientMessageId);
    },
    'message.reply': (payload) => {
        startReplyToMessage(payload);
    },
    'message.react': (payload) => {
        if (!payload?.messageId) return;
        const row = DOM.messagesDiv.querySelector(
            `[data-message-id="${CSS.escape(String(payload.messageId))}"]`
        );
        const anchor =
            row?.querySelector('.message-content-wrap') ||
            row?.querySelector('.message-bubble') ||
            row;
        handleToggleReaction(payload.messageId, null, anchor);
    },
    'reaction.pick': (payload) => {
        if (payload?.messageId && payload?.emoji) {
            sendReactionForMessage(payload.messageId, payload.emoji);
        }
    },
});

function resolveMessageForRow(row) {
    const partner = state.currentTargetUser;
    if (!partner || !row) return null;

    const messageId = row.dataset.messageId;
    const clientMessageId = row.dataset.clientMessageId;
    const history = state.chatHistory[partner] || [];

    return history.find((item) =>
        (messageId != null && messageId !== '' && item.id != null && String(item.id) === String(messageId)) ||
        (clientMessageId && item.clientMessageId === clientMessageId)
    ) || null;
}

setMessageActionHandlers({
    onDeleteMessage: deleteSingleMessage,
    onReply: (message) => startReplyToMessage({ messageId: message.id }),
    onReact: (messageId, emoji, anchor) => handleToggleReaction(messageId, emoji, anchor),
    getMyUsername: () => state.myUsername,
    resolveMessage: resolveMessageForRow,
    onActionUnavailable: () => {
        showToast('Message is still syncing. Try again in a moment.', 'info');
    },
});

function initMessageRuntime() {
initMessageContextMenu((row) => {
    const message = resolveMessageForRow(row);
    const text = row.querySelector('.message-text')?.textContent || '';
    return {
        messageId: message?.id != null ? String(message.id) : (row.dataset.messageId || null),
        clientMessageId: row.dataset.clientMessageId || null,
        messageType: row.dataset.messageType,
        author: row.dataset.messageType === 'outgoing' ? 'You' : (row.dataset.messageSender || 'Message'),
        text,
        currentEmoji: message ? getMyReaction(message.reactions, state.myUsername) : null,
    };
});
initMessageActions();
initJumpToBottom();
syncComposerClearance({ followBottom: false });
}

let loginUiMounted = false;
let startUiMounted = false;
let aboutSecurityMounted = false;
let startMountMod = null;
let chatMountMod = null;
let chatUiMounted = false;
let chatRuntimeAttached = false;

async function getStartMount() {
    if (!startMountMod) {
        startMountMod = await import('../src/start/mountStartSite.tsx');
    }
    return startMountMod;
}

async function mountStartPage() {
    const mod = await getStartMount();
    await mod.mountStartSite(DOM.pageStart);
    startUiMounted = true;
}

async function unmountStartPage() {
    if (!startUiMounted) return;
    const mod = await getStartMount();
    mod.unmountStartSite();
    startUiMounted = false;
}

async function getChatMount() {
    if (!chatMountMod) {
        chatMountMod = await import('../src/chat/mountChat.tsx');
    }
    return chatMountMod;
}

async function mountChatPage() {
    const mod = await getChatMount();
    await mod.mountChat(DOM.pageChat, {
        onSelectChat: onContactSelected,
        onSend: () => { void handleSendMessage(); },
        onOpenSpotlight: openNewChatCompose,
    });
    bindChatChrome(DOM.pageChat);
    setSidebarRenderer('react');
    attachChatRuntime();
    chatUiMounted = true;
}

async function unmountChatPage() {
    if (!chatUiMounted) return;
    const mod = await getChatMount();
    mod.unmountChat();
    resetChatChromeBind();
    chatRuntimeAttached = false;
    chatUiMounted = false;
}

function setAuthPending(isPending) {
    DOM.pageLogin?.classList.toggle('is-loading', isPending);
    DOM.btnLogin.disabled = isPending;
    DOM.btnRegister.disabled = isPending;
    if (DOM.btnForgotPassword) DOM.btnForgotPassword.disabled = isPending;
    if (DOM.btnAuthApple) DOM.btnAuthApple.disabled = isPending;
    if (DOM.btnAuthGoogle) DOM.btnAuthGoogle.disabled = isPending;
}

// Main routing handler
async function handleNavigation(view, param) {
    closeOverlaysForRouteChange();
    document.querySelectorAll('.route-page').forEach(page => page.classList.add('hidden'));

    if (view !== 'about-security' && aboutSecurityMounted) {
        teardownAboutSecurity();
        aboutSecurityMounted = false;
    }

    if (view === 'start') {
        if (state.myUsername) {
            navigateTo('/chat', handleNavigation);
            return;
        }
        if (loginUiMounted) {
            teardownLoginPage();
            loginUiMounted = false;
        }
        DOM.pageStart?.classList.remove('hidden');
        if (!startUiMounted) {
            await mountStartPage();
        }
    }
    else if (view === 'login') {
        if (state.myUsername) {
            navigateTo('/chat', handleNavigation);
            return;
        }
        if (startUiMounted) {
            await unmountStartPage();
        }
        DOM.pageLogin.classList.remove('hidden');
        setAuthPending(false);
        if (!loginUiMounted) {
            initLoginPage(DOM.pageLogin);
            loginUiMounted = true;
        } else {
            import('./loginCanvas.js').then((mod) => mod.resetLoginBackground(DOM.pageLogin)).catch(() => {});
        }
    }
    else if (view === 'about-security') {
        if (startUiMounted) {
            await unmountStartPage();
        }
        if (loginUiMounted) {
            teardownLoginPage();
            loginUiMounted = false;
        }
        DOM.pageAboutSecurity?.classList.remove('hidden');
        initAboutSecurity(DOM.pageAboutSecurity);
        aboutSecurityMounted = true;
    }
    else {
        if (startUiMounted) {
            await unmountStartPage();
        }

        if (loginUiMounted) {
            teardownLoginPage();
            loginUiMounted = false;
        }

        if (view === 'chat' || view === 'chat-user') {
            if (!state.myUsername) {
                navigateTo('/login', handleNavigation);
                return;
            }

            DOM.pageChat.classList.remove('hidden');
            await mountChatPage();

            if (view === 'chat-user' && param) {
                const targetUser = param;
                closeComposeSearch();
                switchChat(targetUser);
            } else {
                closeComposeSearch();
                pendingMessageJump = null;
                engine.clearActiveChat();
                resetChatPanel();
                showChatWelcome();
            }
        }
    }
}

// 2. AUTHORIZATION AND REGISTRATION (HTTP POST)
async function handleAuth(isLogin) {
    const username = normalizeUsername(DOM.usernameInput.value.trim());
    const password = DOM.passwordInput.value.trim();
    DOM.usernameInput.value = username;

    if (!username || !password) {
        showAuthMessage("Please enter both username and password.", true);
        return;
    }

    if (!isValidUsername(username)) {
        showAuthMessage(usernamePolicyText(), true);
        return;
    }

    try {
        if (isLogin) {
            const resData = await loginRequest(username, password);
            state.token = resData.access_token;

            localStorage.setItem('auth_token', state.token);
            localStorage.setItem('auth_username', username);

            let savedKeysJWK = loadKeys(username);
            
            if (!savedKeysJWK) {
                console.log("📱 New device detected! Synchronizing encrypted keys from the secure cloud...");
                const decryptedPrivJWK = await decryptPrivateKeyWithPassword(resData.encrypted_private_key, password);
                
                savedKeysJWK = {
                    publicKey: resData.public_key,
                    privateKey: decryptedPrivJWK
                };
                saveKeys(username, savedKeysJWK);
            }

            state.myKeys = {
                publicKey: await importPublicKey(savedKeysJWK.publicKey),
                privateKey: await importPrivateKey(savedKeysJWK.privateKey)
            };

            setAuthPending(true);
            const { playLoginSuccessReveal } = await import('./loginCanvas.js');
            await playLoginSuccessReveal(DOM.pageLogin);
            finishLoginSetup(username, savedKeysJWK.publicKey);

        } else {
            state.myKeys = await generateKeyPair();
            const pubJWK = await exportPublicKey(state.myKeys.publicKey);
            const privJWK = await exportPrivateKey(state.myKeys.privateKey);

            const encPrivString = await encryptPrivateKeyWithPassword(privJWK, password);

            await registerRequest({
                username,
                password,
                publicKey: pubJWK,
                encryptedPrivateKey: encPrivString
            });

            saveKeys(username, { publicKey: pubJWK, privateKey: privJWK });
            showAuthMessage("Registration successful! You can now log in.", false);
        }
    } catch (err) {
        setAuthPending(false);
        showAuthMessage(err.message, true);
    }
}

function showAuthMessage(text, isError) {
    DOM.authError.textContent = text;
    DOM.authError.classList.remove('hidden');
    DOM.authError.classList.toggle('text-red-400', isError);
    DOM.authError.classList.toggle('text-green-400', !isError);
}

async function loadSidebarChats() {
    if (!state.token || !state.myUsername) return;
    if (sidebarChatsLoadPromise) return sidebarChatsLoadPromise;

    sidebarChatsLoadPromise = (async () => {
        try {
            const chats = await getChats(state.token, 50);
            state.sidebarChats = chats.map((chat) => {
                const history = state.chatHistory?.[chat.username] || [];
                const last = [...history].reverse().find((m) => m?.text && !m.deleted);
                return {
                    ...chat,
                    last_message_preview: last?.text || chat.last_message_preview || '',
                };
            });
            ingestUserRecords(chats);
            chats.forEach(chat => {
                state.usersDirectory[chat.username] = chat.public_key;
                if (chat.unread_count != null) {
                    state.unreadCounts[chat.username] = chat.unread_count;
                }
            });
            engine.setSidebarLoading(false);
            await maybeSeedMockChats();
            renderSidebar();
            sidebarChatsLastFetchedAt = Date.now();
        } catch (err) {
            console.error("Sidebar sync failed:", err);
            engine.setSidebarLoading(false);
            await maybeSeedMockChats();
            renderSidebar();
        } finally {
            sidebarChatsLoadPromise = null;
        }
    })();

    return sidebarChatsLoadPromise;
}

function onSidebarChatsVisibility() {
    if (document.visibilityState !== 'visible') return;
    if (!state.token || !state.myUsername) return;
    if (Date.now() - sidebarChatsLastFetchedAt < SIDEBAR_CHATS_POLL_MS / 2) return;
    void loadSidebarChats();
}

function startSidebarChatsPoll() {
    stopSidebarChatsPoll();
    sidebarChatsPollTimer = window.setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        if (!state.token || !state.myUsername) return;
        void loadSidebarChats();
    }, SIDEBAR_CHATS_POLL_MS);
    document.addEventListener('visibilitychange', onSidebarChatsVisibility);
}

function stopSidebarChatsPoll() {
    if (sidebarChatsPollTimer != null) {
        window.clearInterval(sidebarChatsPollTimer);
        sidebarChatsPollTimer = null;
    }
    document.removeEventListener('visibilitychange', onSidebarChatsVisibility);
}

async function maybeSeedMockChats() {
    if (!import.meta.env.DEV) return;
    try {
        if (localStorage.getItem('nexa_mock_chats') === '0') return;
    } catch {
        /* ignore quota / private mode */
    }
    if (state.sidebarChats.length) return;
    const { seedMockChats } = await import('../src/chat/engine/mockChats.ts');
    seedMockChats(engine);
}

async function registerCurrentDevice(info = detectDeviceInfo()) {
    if (!state.token) return;
    try {
        await registerDevice(state.token, devicePayload(info));
    } catch (err) {
        console.warn('Device registration failed:', err);
    }
}

async function enrichAndRegisterDevice() {
    const info = await enrichDeviceInfo(detectDeviceInfo());
    await registerCurrentDevice(info);
}

async function ensureDesktopNotifications() {
    if (!notificationPrefs(state.preferences).enabled) return;
    await ensureNotificationPermission();
}

async function syncMutedToServer() {
    if (!state.token || !state.myUsername) return;
    try {
        await syncMuted(state.token, [...loadMutedChats(state.myUsername)]);
    } catch (err) {
        console.warn('Mute sync failed:', err);
    }
}

function chatLabel(username) {
    const chat = (state.sidebarChats || []).find((row) => row.username === username);
    const name = chat?.display_name || chat?.displayName;
    return (name && String(name).trim()) || username;
}

function maybeNotifyIncomingMessage(from, text, isActiveChat) {
    const prefs = notificationPrefs(state.preferences);
    if (!prefs.enabled) return;
    if (isChatMuted(state.myUsername, from)) return;
    if (isActiveChat && document.visibilityState === 'visible') return;

    const preview = String(text || '').trim();
    notifyIncomingMessage({
        title: chatLabel(from),
        body: prefs.preview ? (preview || 'New message') : 'New message',
        tag: `nexa-message-${from}`,
        sound: prefs.sound,
        onClick: () => {
            void switchChat(from);
        },
    });
}

// Runs after SUCCESSFUL login
function finishLoginSetup(username, exportedPublicKeyJSON, targetPath = '/chat') {
    state.myUsername = username;
    state.myPublicKeyJwk = exportedPublicKeyJSON;
    state.chatHistory = loadHistory(state.myUsername);
    updateProfileRailButton(username);

    ensureRouter();
    navigateTo(targetPath, handleNavigation);
    engine.setSidebarLoading(true);
    showContactsLoading();
    loadSidebarChats();
    startSidebarChatsPoll();
    ensureRealtime();
    void registerCurrentDevice();
    void ensureDesktopNotifications();
    void syncMutedToServer();

    if (socketConnection) {
        socketConnection.close();
    }

    socketConnection = connectToServer(
        state.token,
        (activeSocket) => {
            updateStatus("Online", "text-green-500");
            const device = devicePayload(detectDeviceInfo());
            sendPacket(activeSocket, "join", {
                username: state.myUsername,
                public_key: exportedPublicKeyJSON,
                share_presence: getPrivacyFlags(state.preferences).showOnlineStatus,
                ...device,
            });
            if (state.currentTargetUser) {
                sendPacket(activeSocket, "chat_focus", { partner: state.currentTargetUser });
            }
            void enrichAndRegisterDevice();
        },
        async (event) => {
            const data = JSON.parse(event.data);
            const result = await engine.ingestPacket(data);
            if (
                (data.type === 'message' || data.type === 'message_sync')
                && data.id
                && state.currentTargetUser
                && (state.currentTargetUser === data.from || result?.isActiveChat)
            ) {
                if (data.type === 'message_sync') {
                    ensureRealtime().sendDeliveryAck(data.from, data.id, data.client_message_id);
                }
                markActiveChatRead();
            }
        },
        (event, closedByUser) => {
            if (!closedByUser) {
                updateStatus("Reconnecting...", "text-yellow-500");
                return;
            }
            updateStatus("Disconnected", "text-red-500");
        }
    );
}

function ensureRouter() {
    if (routerReady) return;
    initRouter(handleNavigation);
    routerReady = true;
}

function handleReactionSyncEvent(data) {
    const result = applyReactionSync(state.chatHistory, data, state.myUsername);
    if (!result) return;
    saveChatHistory();

    const row = DOM.messagesDiv.querySelector(
        `[data-message-id="${CSS.escape(String(data.message_id))}"]`
    );
    if (row) {
        patchMessageReactionsDom(data.message_id, result.reactions, state.myUsername);
    } else if (state.currentTargetUser) {
        reconcileMessageRowsWithHistory(state.chatHistory[state.currentTargetUser] || []);
    }
}

function findHistoryMessage(history, message) {
    if (!Array.isArray(history) || !message) return null;
    return history.find((item) =>
        (message.id != null && item.id != null && String(item.id) === String(message.id)) ||
        (message.clientMessageId && item.clientMessageId === message.clientMessageId)
    ) || null;
}

function processMessage(chatPartner, messageInput) {
    return engine.processMessage(chatPartner, messageInput);
}

async function ensureUserKey(username) {
    if (state.usersDirectory[username]) return true;

    try {
        const user = await getUser(state.token, username);
        state.usersDirectory[user.username] = user.public_key;
        return true;
    } catch (err) {
        console.error("User lookup failed:", err);
        showToast("User was not found.", "error");
        return false;
    }
}

// Switches active chat with cloud-history parsing layer integration
async function switchChat(username) {
    closeComposeSearch();
    persistCurrentDraft();
    const result = await engine.selectChat(username);
    if (!result.ok) {
        pendingMessageJump = null;
        if (result.reason !== 'stale') {
            navigateTo('/chat', handleNavigation);
        }
        return;
    }
    consumePendingMessageJump(result.username);
    clearPasteAttachments();
    setComposerValue(result.draft || '');
    setDraftStatus(getComposerValue() ? 'Draft restored locally' : 'End-to-end encrypted');
    markActiveChatRead();
    syncRealtimeUi();
}

async function handleSendMessage() {
    const result = await engine.sendText(getComposerValue());
    if (result?.reason === 'empty') {
        focusComposer();
        return;
    }
    if (result?.reason === 'limit') {
        showComposerLimitError(result.message || `Message exceeds ${MAX_MESSAGE_LENGTH} characters and was not sent.`);
        focusComposer();
        return;
    }
    if (result?.ok) {
        clearComposerLimitError();
        clearComposer();
        setDraftStatus('Message queued. Waiting for database sync.');
    }
}

window.handleSendMessage = handleSendMessage;

// Event Listeners
DOM.btnLogin.addEventListener('click', () => handleAuth(true));
DOM.btnRegister.addEventListener('click', () => handleAuth(false));
DOM.btnForgotPassword?.addEventListener('click', () => {
    showAuthMessage(
        'Password recovery is not available yet. Your encryption keys are stored only on this device.',
        false
    );
});
DOM.btnAuthApple?.addEventListener('click', () => {
    showAuthMessage('Sign in with Apple is coming soon.', false);
});
DOM.btnAuthGoogle?.addEventListener('click', () => {
    showAuthMessage('Sign in with Google is coming soon.', false);
});
document.getElementById('loginForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    handleAuth(true);
});
DOM.usernameInput.addEventListener('input', () => {
    DOM.usernameInput.value = normalizeUsername(DOM.usernameInput.value);
});
DOM.usernameInput.addEventListener('keydown', handleAuthKeyboard);
DOM.passwordInput.addEventListener('keydown', handleAuthKeyboard);

function attachChatRuntime() {
    if (chatRuntimeAttached || !DOM.messageInput || !DOM.sendBtn) return;
    chatRuntimeAttached = true;
    initComposeSearchRuntime();
    initMessageRuntime();

    DOM.messageInput.addEventListener('input', () => {
    autoResizeComposer();
    clearComposerLimitError();
    updateComposerMeta(getComposerValue());
    persistCurrentDraft();
    if (
        state.currentTargetUser &&
        (getComposerValue().trim() || getPasteAttachments().length) &&
        getPrivacyFlags(state.preferences).typingIndicators
    ) {
        ensureRealtime().notifyTyping(state.currentTargetUser);
    }
    });

    DOM.messageInput.addEventListener('paste', (event) => {
    if (DOM.messageInput.disabled) return;
    const pasted = event.clipboardData?.getData('text/plain') ?? '';
    if (!shouldCapturePaste(pasted)) return;
    if (getPasteAttachments().length >= MAX_PASTE_ATTACHMENTS) return;

    event.preventDefault();
    addPasteAttachment(pasted);
    clearComposerLimitError();
    updateComposerMeta(getComposerValue());
    if (
        state.currentTargetUser &&
        getPrivacyFlags(state.preferences).typingIndicators
    ) {
        ensureRealtime().notifyTyping(state.currentTargetUser);
    }
    });

    setPasteAttachmentsChangeHandler(() => {
        clearComposerLimitError();
        updateComposerMeta(getComposerValue());
    });

    DOM.focusContactsBtn?.addEventListener('click', focusContactSearch);
    DOM.focusComposerBtn?.addEventListener('click', focusComposer);
    DOM.railChats?.addEventListener('click', (event) => {
    event.preventDefault();
    if (isComposeSearchOpen()) {
        closeComposeSearch({ restoreWelcome: !state.currentTargetUser });
        if (!state.currentTargetUser && window.location.pathname !== '/chat') {
            navigateTo('/chat', handleNavigation);
        }
        showChatsView();
        return;
    }
    showChatsView();
});
DOM.railProfile?.addEventListener('click', (event) => {
    event.preventDefault();
    closeComposeSearch({ immediate: true });
    openProfile();
});
DOM.dockSettings?.addEventListener('click', (event) => {
    event.preventDefault();
    closeComposeSearch({ immediate: true });
    openAppSettings('appearance');
});
    DOM.dockNewChat?.addEventListener('click', (event) => {
        event.preventDefault();
        openNewChatCompose();
    });

    document.getElementById('uiProfileNavBackBtn')?.addEventListener('click', (event) => {
        event.preventDefault();
        handleProfileBack();
    });
    document.getElementById('uiChatBackBtn')?.addEventListener('click', (event) => {
        event.preventDefault();
        if (/^\/chat\/@/.test(window.location.pathname)) {
            replaceTo('/chat', handleNavigation);
            return;
        }
        handleChatBack();
    });
    DOM.settingsBtn?.addEventListener('click', (event) => openSettingsMenu(event));
    DOM.shortcutsBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        openShortcuts();
    });
    DOM.copyUsernameBtn?.addEventListener('click', copyCurrentUsername);
    document.getElementById('uiProfileLogoutBtn')?.addEventListener('click', handleLogout);
    DOM.chatMenuBtn?.addEventListener('click', (event) => openChatMenu(event));
    DOM.composerMenuBtn?.addEventListener('click', (event) => openComposerMenu(event));
    DOM.emojiBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleEmojiPicker();
    });
    DOM.emojiPicker?.addEventListener('click', (event) => {
        const item = event.target.closest('[data-emoji]');
        if (!item) return;
        insertAtCursor(item.dataset.emoji);
        persistCurrentDraft();
        closeEmojiPicker();
    });
    DOM.chatSearchBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleMessageSearch();
    });
    DOM.messageSearchInput?.addEventListener('input', () => {
        const value = DOM.messageSearchInput.value;
        window.clearTimeout(messageSearchTimer);
        messageSearchTimer = window.setTimeout(() => {
            searchMessages(value);
        }, 80);
    });
    DOM.scrollBottomBtn?.addEventListener('click', () => scrollMessagesToBottom({ force: true, smooth: true }));
    DOM.attachBtn?.addEventListener('click', () => DOM.fileInput?.click());
    DOM.fileInput?.addEventListener('change', () => {
        if (!DOM.fileInput.files.length) return;
        insertAtCursor(createFileMarkers(DOM.fileInput.files));
        persistCurrentDraft();
        DOM.fileInput.value = '';
    });
    DOM.replyCloseBtn?.addEventListener('click', clearPendingReply);
    // The rest of the reply banner jumps to the quoted message; the ✕ above only cancels.
    const jumpToPendingReply = () => {
        const messageId = state.pendingReply?.messageId;
        if (!messageId) return;
        if (!scrollToMessageById(messageId)) {
            showToast('The original message is no longer in this chat.', 'info');
        }
    };
    DOM.replyBar?.addEventListener('click', (event) => {
        if (event.target.closest('#uiReplyCloseBtn')) return;
        jumpToPendingReply();
    });
    DOM.replyBar?.querySelector('.composer-reply-body')?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        jumpToPendingReply();
    });
    DOM.peerMuteBtn?.addEventListener('click', () => {
        if (!state.currentTargetUser) return;
        showToast('Mute is coming soon.', 'info');
    });
    DOM.peerClearBtn?.addEventListener('click', () => {
        clearCurrentChatHistory();
    });
    DOM.peerDeleteBtn?.addEventListener('click', () => {
        deleteCurrentChat();
    });
    DOM.peerSecurityBtn?.addEventListener('click', () => {
        openCurrentChatInfo();
    });
}

document.addEventListener('click', (event) => {
    if (!DOM.emojiPicker || DOM.emojiPicker.classList.contains('hidden')) return;
    if (event.target.closest('.composer-emoji-wrap')) return;
    closeEmojiPicker();
});

DOM.closeProfileBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    showChatsView();
});
document.getElementById('uiProfileBackBtn')?.addEventListener('click', (event) => {
    event.preventDefault();
    handleProfileBack();
});
DOM.closeSettingsBtn?.addEventListener('click', closeModals);
DOM.closeShortcutsBtn?.addEventListener('click', closeModals);

bindPreferenceToggle(DOM.prefEnterSend, 'enterToSend');
bindPreferenceToggle(DOM.prefCompactMode, 'compactMode');
bindPreferenceToggle(DOM.prefShowTimestamps, 'showTimestamps');
bindPreferenceToggle(DOM.prefMessagePreview, 'messageNotificationPreview');
bindPreferenceToggle(DOM.prefMessageSound, 'messageNotificationSound');

if (DOM.prefMessageNotifications) {
    DOM.prefMessageNotifications.addEventListener('change', async () => {
        const enabled = DOM.prefMessageNotifications.checked;
        if (enabled) {
            const granted = await ensureNotificationPermission();
            if (!granted) {
                DOM.prefMessageNotifications.checked = false;
                state.preferences = updatePreference(state.preferences, 'messageNotifications', false);
                setPreferenceControls(state.preferences);
                showToast(
                    notificationPermissionDeniedMessage(),
                    'error'
                );
                return;
            }
        }
        state.preferences = updatePreference(state.preferences, 'messageNotifications', enabled);
        setPreferenceControls(state.preferences);
        showToast('Notification setting saved.', 'success');
    });
}

if (DOM.glassSlider) {
    const commitGlass = (silent) => {
        const value = Number(DOM.glassSlider.value);
        state.preferences = updatePreference(state.preferences, 'glassIntensity', value);
        setPreferenceControls(state.preferences);
        if (!silent) showToast('Appearance updated.', 'success');
    };
    DOM.glassSlider.addEventListener('input', () => commitGlass(true));
    DOM.glassSlider.addEventListener('change', () => commitGlass(false));
}

registerShortcuts({
    closeTransientUi: () => {
        closeTransientUi();
        closeMessageSearch();
    },
    openShortcuts,
    openProfile,
    openSettings,
    openMessageSearch,
    focusContacts: focusContactSearch,
    focusComposer,
    exportChat: exportCurrentChat
});

function handleAuthKeyboard(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        handleAuth(true);
    }
}

function bindPreferenceToggle(control, key) {
    if (!control) return;
    control.addEventListener('change', () => {
        state.preferences = updatePreference(state.preferences, key, control.checked);
        setPreferenceControls(state.preferences);
        showToast("Interface setting saved.", "success");
    });
}

function notificationPermissionDeniedMessage() {
    if (!('Notification' in window)) return 'This browser does not support desktop notifications.';
    return 'Notifications are blocked. Allow them in the browser settings, then try again.';
}

function persistCurrentDraft() {
    if (!state.myUsername || !state.currentTargetUser) return;

    const text = getComposerValue();
    if (text.trim()) {
        saveDraft(state.myUsername, state.currentTargetUser, text);
        setDraftStatus("Draft saved locally.");
    } else {
        clearDraft(state.myUsername, state.currentTargetUser);
        setDraftStatus("End-to-end encrypted");
    }
}

function toggleCurrentChatMute() {
    const partner = state.currentTargetUser;
    if (!partner || !state.myUsername) {
        showToast('Select a chat first.', 'error');
        return;
    }
    const muted = toggleChatMuted(state.myUsername, partner);
    closeAllPopovers();
    showToast(muted ? 'Chat muted locally.' : 'Chat unmuted.', 'success');
    syncRealtimeUi();
    void syncMutedToServer();
}

function openCurrentChatInfo() {
    if (!state.currentTargetUser) {
        showToast('Select a chat first.', 'error');
        return;
    }
    const partner = state.currentTargetUser;
    openChatInfoPopover(
        partner,
        isUserOnline(state, partner),
        state.usersDirectory[partner] || null,
        {
            preferences: state.preferences,
            muted: isChatMuted(state.myUsername, partner),
        }
    );
}

async function copyCurrentUsername() {
    if (!state.myUsername) {
        showToast("No active identity.", "error");
        return;
    }

    try {
        await copyText(state.myUsername);
        showToast("Identity copied.", "success");
    } catch (err) {
        console.error("Copy identity failed:", err);
        showToast("Copy failed.", "error");
    }
}

async function copyCurrentChatLink() {
    if (!state.currentTargetUser) {
        showToast("Select a chat first.", "error");
        return;
    }

    try {
        await copyText(`${window.location.origin}/chat/@${state.currentTargetUser}`);
        closeAllPopovers();
        showToast("Chat link copied.", "success");
    } catch (err) {
        console.error("Copy chat link failed:", err);
        showToast("Copy failed.", "error");
    }
}

function exportCurrentChat() {
    if (!state.currentTargetUser) {
        showToast("Select a chat first.", "error");
        return;
    }

    const messages = state.chatHistory[state.currentTargetUser] || [];
    const transcript = buildChatTranscript({
        owner: state.myUsername,
        partner: state.currentTargetUser,
        messages
    });
    const filename = `originhub-${makeSafeFilename(state.currentTargetUser)}-${new Date().toISOString().slice(0, 10)}.txt`;

    downloadTextFile(filename, transcript);
    closeAllPopovers();
    showToast("Local chat exported.", "success");
}

async function clearCurrentChatHistory() {
    if (!state.currentTargetUser) {
        showToast("Select a chat first.", "error");
        return;
    }

    const partner = state.currentTargetUser;
    const confirmed = window.confirm(`Clear all messages with ${partner}? This cannot be undone.`);
    if (!confirmed) {
        closeAllPopovers();
        focusComposer();
        return;
    }

    try {
        await deleteConversation(state.token, partner);
        state.chatHistory[partner] = [];
        clearMessageView();
        clearDraft(state.myUsername, partner);
        flushChatHistorySave();
        renderSidebar();
        closeAllPopovers();
        showToast("Chat history cleared.", "success");
    } catch (err) {
        console.error("Conversation clear failed:", err);
        showToast(err.message || "Could not clear chat history.", "error");
    } finally {
        focusComposer();
    }
}

async function deleteCurrentChat() {
    if (!state.currentTargetUser) {
        showToast("Select a chat first.", "error");
        return;
    }

    const partner = state.currentTargetUser;
    const confirmed = window.confirm(`Delete the chat with ${partner}? This cannot be undone.`);
    if (!confirmed) {
        closeAllPopovers();
        focusComposer();
        return;
    }

    try {
        await deleteConversation(state.token, partner);
        delete state.chatHistory[partner];
        state.sidebarChats = state.sidebarChats.filter(chat => chat.username !== partner);
        clearDraft(state.myUsername, partner);
        flushChatHistorySave();
        state.currentTargetUser = null;
        resetChatPanel();
        renderSidebar();
        closeAllPopovers();
        navigateTo('/chat', handleNavigation);
        showToast("Chat deleted.", "success");
    } catch (err) {
        console.error("Conversation delete failed:", err);
        showToast(err.message || "Could not delete chat.", "error");
        focusComposer();
    }
}

async function deleteSingleMessage(messageId, { confirmed = false } = {}) {
    if (!state.currentTargetUser || !messageId) return;

    if (!confirmed && !window.confirm("Delete this message from the database?")) {
        focusComposer();
        return;
    }

    const partner = state.currentTargetUser;
    const snapshot = [...(state.chatHistory[partner] || [])];
    const targetMsg = snapshot.find((m) => String(m.id) === String(messageId));
    const clientMessageId = targetMsg?.clientMessageId;

    const optimisticEvent = {
        message_id: messageId,
        client_message_id: clientMessageId,
        partner,
        deleted_by: state.myUsername,
        sender: state.myUsername,
        receiver: partner,
    };

    applyMessageDeleted(state.chatHistory, optimisticEvent, saveChatHistory, state.myUsername);
    const affectedReplyIds = markRepliesUnavailable(partner, messageId);
    if (state.currentTargetUser === partner) {
        removeMessageFromDom({ messageId, clientMessageId });
        patchReplyPreviewsForMessages(partner, affectedReplyIds);
        patchGroupingFromState(state.chatHistory[partner] || []);
    }

    try {
        await deleteMessage(state.token, messageId);
        showToast("Message deleted from database.", "success");
    } catch (err) {
        console.error("Message delete failed:", err);
        state.chatHistory[partner] = snapshot;
        flushChatHistorySave();
        if (state.currentTargetUser === partner) {
            renderMessagesList(snapshot);
        }
        showToast(err.message || "Could not delete message.", "error");
    } finally {
        focusComposer();
    }
}

function handleLogout() {
    persistCurrentDraft();
    flushChatHistorySave();
    closeOverlaysForRouteChange();
    showChatsView();
    void unmountChatPage();
    stopSidebarChatsPoll();
    sidebarChatsLastFetchedAt = 0;

    if (socketConnection) {
        socketConnection.close();
        socketConnection = null;
    }

    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');

    state.myUsername = null;
    state.myKeys = null;
    state.token = null;
    state.currentTargetUser = null;
    state.usersDirectory = {};
    state.sidebarChats = [];
    state.chatHistory = {};
    state.onlineUsers = new Set();
    state.unreadCounts = {};
    state.typingUsers = new Set();
    clearProfileDirectory();
    cancelReadReceipt();
    sendChatFocus(null);
    realtime?.reset();
    realtime = null;

    DOM.usernameInput.value = "";
    DOM.passwordInput.value = "";
    if (DOM.contactSearchInput) DOM.contactSearchInput.value = "";
    filterUsers("");
    clearUsersList();
    resetChatPanel();
    updateStatus("Disconnected", "text-red-500");
    navigateTo('/', handleNavigation);
    showToast("Logged out.", "success");
}

// Asynchronous application rehydration task to process auto-logins on page reloads
async function initializeApp() {
    const savedToken = localStorage.getItem('auth_token');
    const savedUsername = localStorage.getItem('auth_username');
    const initialPath = window.location.pathname;

    if (savedToken && savedUsername) {
        const savedKeysJWK = loadKeys(savedUsername);
        if (savedKeysJWK) {
            try {
                // Restore tokens to active RAM state boundaries
                state.token = savedToken;
                state.myUsername = savedUsername;
                state.myKeys = {
                    publicKey: await importPublicKey(savedKeysJWK.publicKey),
                    privateKey: await importPrivateKey(savedKeysJWK.privateKey)
                };
                
                // Fire up setup and bypass login form, preserving the current deep-linked path
                const routeFallback = (initialPath === '/' || initialPath === '/login') ? '/chat' : initialPath;
                finishLoginSetup(savedUsername, savedKeysJWK.publicKey, routeFallback);
                return;
            } catch (err) {
                console.error("Session rehydration failed:", err);
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_username');
            }
        }
    }

    // Default flow: Boot the client-side router normally if no session exists
    ensureRouter();
    if (initialPath.startsWith('/chat')) {
        navigateTo('/login', handleNavigation);
    }
}

// Trigger the application boot sequence
wireEngineUi();
initializeApp();
