import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ChatApp, type ChatAppHandlers } from './ChatApp';

let root: Root | null = null;
let lastHandlers: ChatAppHandlers = {};

export function mountChat(pageChat: HTMLElement, handlers: ChatAppHandlers = {}): Promise<void> {
    const host = pageChat.querySelector('#chat-root');
    if (!(host instanceof HTMLElement)) {
        return Promise.reject(new Error('Missing #chat-root'));
    }
    lastHandlers = handlers;
    if (!root) {
        root = createRoot(host);
    }
    flushSync(() => {
        root!.render(createElement(ChatApp, { handlers: lastHandlers }));
    });
    return Promise.resolve();
}

export function updateChatHandlers(handlers: ChatAppHandlers) {
    lastHandlers = handlers;
    if (!root) return;
    flushSync(() => {
        root!.render(createElement(ChatApp, { handlers: lastHandlers }));
    });
}

export function unmountChat() {
    if (!root) return;
    flushSync(() => {
        root!.unmount();
    });
    root = null;
}
