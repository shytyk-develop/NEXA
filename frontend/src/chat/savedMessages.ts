// Saved messages, per account and conversation, kept on this device only
// (localStorage, like the chat history). js/app.js sets the signed-in owner and
// saves from the message quick bar ("Save locally"); js/ui.js tells the store
// which chat is active; the peer panel lists that chat's items.

export type SavedMessage = {
    id: string;
    /** The chat message it copies (server id), when it had one. */
    chatMessageId?: string;
    /** …and its client id, which a deletion may carry instead. */
    clientMessageId?: string;
    /** Title or author shown in bold on the left. */
    author: string;
    text: string;
    /** Epoch ms. */
    savedAt: number;
    /** The chat message was deleted after saving: the saved copy stays. */
    isOriginalDeleted?: boolean;
    /** Who deleted it ("You" or the peer's display name). */
    deletedBy?: string;
};

type MessageRef = { messageId?: string | null; clientMessageId?: string | null };

function matches(item: SavedMessage, ref: MessageRef) {
    const ids = [ref.messageId, ref.clientMessageId].filter(Boolean).map(String);
    if (!ids.length) return false;
    return [item.chatMessageId, item.clientMessageId, item.id].some((id) => id != null && ids.includes(String(id)));
}

const STORAGE_PREFIX = 'nexa:saved-messages:v1:';
const EMPTY: SavedMessage[] = [];

/** Signed-in account: each one gets its own list (no sharing on a shared browser). */
let owner: string | null = null;
let activePeer: string | null = null;
let byPeer: Record<string, SavedMessage[]> = {};
const listeners = new Set<() => void>();

function load(): Record<string, SavedMessage[]> {
    if (!owner) return {};
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_PREFIX + owner) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function persist() {
    if (!owner) return;
    try {
        localStorage.setItem(STORAGE_PREFIX + owner, JSON.stringify(byPeer));
    } catch {
        // Storage full / blocked: the list still works for this session.
    }
}

/** Switch to an account's list (login / session restore), or clear it (logout). */
export function setSavedMessagesOwner(username: string | null) {
    if (owner === username) return;
    owner = username;
    byPeer = load();
    emit();
}

function emit() {
    listeners.forEach((listener) => listener());
}

export function subscribeSavedMessages(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Newest first, for the active chat (stable reference until it changes). */
export function getActiveSavedMessages(): SavedMessage[] {
    return (activePeer && byPeer[activePeer]) || EMPTY;
}

/** The chat the peer panel shows (js/ui.js keeps it in sync). */
export function getSavedMessagesPeer(): string | null {
    return activePeer;
}

export function setSavedMessagesPeer(username: string | null) {
    if (activePeer === username) return;
    activePeer = username;
    emit();
}

export function saveMessage(username: string, message: SavedMessage) {
    if (!owner) return;
    const list = (byPeer[username] || []).filter((item) => item.id !== message.id);
    byPeer = { ...byPeer, [username]: [message, ...list] };
    persist();
    emit();
}

/**
 * A chat message was deleted: flag its saved copies (any chat of this account)
 * instead of dropping them. `deletedBy: null` clears the flag again (a delete
 * that failed and was rolled back).
 */
export function setSavedMessageDeleted(ref: MessageRef, deletedBy: string | null) {
    if (!owner) return;
    let changed = false;
    const next: Record<string, SavedMessage[]> = {};
    Object.entries(byPeer).forEach(([peer, list]) => {
        next[peer] = list.map((item) => {
            if (!matches(item, ref)) return item;
            changed = true;
            if (deletedBy == null) {
                const { isOriginalDeleted: _flag, deletedBy: _by, ...rest } = item;
                return rest;
            }
            return { ...item, isOriginalDeleted: true, deletedBy };
        });
    });
    if (!changed) return;
    byPeer = next;
    persist();
    emit();
}

/** Remove several saved messages from the active chat's list (edit mode). */
export function removeActiveSavedMessages(ids: string[]) {
    if (!owner || !activePeer || !ids.length) return;
    const list = byPeer[activePeer];
    if (!list) return;
    const drop = new Set(ids);
    byPeer = { ...byPeer, [activePeer]: list.filter((item) => !drop.has(item.id)) };
    persist();
    emit();
}

export function removeSavedMessage(username: string, id: string) {
    const list = byPeer[username];
    if (!list) return;
    byPeer = { ...byPeer, [username]: list.filter((item) => item.id !== id) };
    persist();
    emit();
}
