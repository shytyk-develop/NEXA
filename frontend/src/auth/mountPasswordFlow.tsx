import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// One React root for the login panel's password screens (ForgotPassword /
// ResetPassword); js/app.js swaps them in for the form and back out.

let root: Root | null = null;

export function mountPasswordFlow(host: HTMLElement, screen: ReactElement) {
    if (!root) root = createRoot(host);
    root.render(screen);
}

export function unmountPasswordFlow() {
    root?.unmount();
    root = null;
}
