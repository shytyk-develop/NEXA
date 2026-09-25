// Saved messages, per account and conversation, kept on this device only
// (localStorage, like the chat history). js/app.js sets the signed-in owner and
// saves from the message quick bar ("Save locally"); js/ui.js tells the store
// which chat is active; the peer panel lists that chat's items.

export type SavedMessage = {
    id: string;
    /** Title or author shown in bold on the left. */
    author: string;
    text: string;
    /** Epoch ms. */
    savedAt: number;
};

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

export function removeSavedMessage(username: string, id: string) {
    const list = byPeer[username];
    if (!list) return;
    byPeer = { ...byPeer, [username]: list.filter((item) => item.id !== id) };
    persist();
    emit();
}
