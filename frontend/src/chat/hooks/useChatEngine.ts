import { useEffect, useState } from 'react';
import { getChatEngine, peekChatEngine, type ChatEngine } from '../engine/chatEngine';
import type { ChatEngineEvent } from '../engine/events';

export function useChatEngine(): ChatEngine | null {
    return peekChatEngine();
}

export function useChatSnapshot() {
    const engine = peekChatEngine();
    const [snapshot, setSnapshot] = useState(() => engine?.getSidebarSnapshot() ?? emptySnapshot());

    useEffect(() => {
        const current = peekChatEngine();
        if (!current) return;
        const sync = () => setSnapshot(current.getSidebarSnapshot());
        sync();
        const events: ChatEngineEvent[] = ['chatsChanged', 'activeChatChanged', 'uiSync', 'chatsLoading'];
        const offs = events.map((event) => current.on(event, sync));
        return () => offs.forEach((off) => off());
    }, []);

    return snapshot;
}

function emptySnapshot() {
    return {
        chats: [] as any[],
        activeUsername: null as string | null,
        myUsername: null as string | null,
        onlineUsers: new Set<string>(),
        unreadCounts: {} as Record<string, number>,
        typingUsers: new Set<string>(),
        preferences: {},
        loading: false,
    };
}

export { getChatEngine };
