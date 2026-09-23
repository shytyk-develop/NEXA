import { useEffect, useState } from 'react';
import { getChatEngine, peekChatEngine, type ChatEngine } from '../engine/chatEngine';
import type { ChatEngineEvent } from '../engine/events';

export function useChatEngine(): ChatEngine | null {
    return peekChatEngine();
}

export function useChatSnapshot() {
    const [snapshot, setSnapshot] = useState(() => peekChatEngine()?.getSidebarSnapshot() ?? emptySnapshot());

    useEffect(() => {
        let offs: Array<() => void> = [];
        let intervalId: number | null = null;

        const bind = (current: ChatEngine) => {
            offs.forEach((off) => off());
            offs = [];
            const sync = () => setSnapshot(current.getSidebarSnapshot());
            sync();
            const events: ChatEngineEvent[] = ['chatsChanged', 'activeChatChanged', 'uiSync', 'chatsLoading'];
            offs = events.map((event) => current.on(event, sync));
        };

        const current = peekChatEngine();
        if (current) {
            bind(current);
        } else {
            intervalId = window.setInterval(() => {
                const next = peekChatEngine();
                if (!next) return;
                if (intervalId != null) window.clearInterval(intervalId);
                intervalId = null;
                bind(next);
            }, 120);
        }

        return () => {
            if (intervalId != null) window.clearInterval(intervalId);
            offs.forEach((off) => off());
        };
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
