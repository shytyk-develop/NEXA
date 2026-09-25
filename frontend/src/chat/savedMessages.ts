// Saved messages, per conversation, kept on this device only (localStorage).
// The peer panel lists the active chat's items; js/ui.js tells the store which
// chat is active. saveMessage / removeSavedMessage are the write API for a
// future "Save" message action.

export type SavedMessage = {
    id: string;
    /** Title or author shown in bold on the left. */
    author: string;
    text: string;
    /** Epoch ms. */
    savedAt: number;
};

const STORAGE_KEY = 'nexa:saved-messages:v1';
const EMPTY: SavedMessage[] = [];

let activePeer: string | null = null;
let byPeer: Record<string, SavedMessage[]> = load();
const listeners = new Set<() => void>();

function load(): Record<string, SavedMessage[]> {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(byPeer));
    } catch {
        // Storage full / blocked: the list still works for this session.
    }
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
