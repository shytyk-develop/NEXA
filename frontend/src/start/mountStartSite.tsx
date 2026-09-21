import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { StartSiteApp } from './StartSiteApp';

let root: Root | null = null;

export function mountStartSite(pageStart: HTMLElement): Promise<void> {
    const host = pageStart.querySelector('#start-root');
    if (!(host instanceof HTMLElement)) {
        return Promise.reject(new Error('Missing #start-root'));
    }
    if (!root) {
        root = createRoot(host);
    }
    flushSync(() => {
        root!.render(createElement(StartSiteApp));
    });
    return Promise.resolve();
}

export function unmountStartSite() {
    if (!root) return;
    flushSync(() => {
        root!.unmount();
    });
    root = null;
}
