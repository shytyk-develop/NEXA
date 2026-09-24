// External-link warning, shown inline in the message bubble (see messageQuickBar.js):
// hold "Hold to open" to follow the link; "Pause" snoozes these warnings on this device.

import { LINK_WARNING_SNOOZES, pauseLinkWarnings } from './linkWarnings.js';
import { showToast } from './ui.js';

/** Let the check draw in before the panel folds away. */
const CONFIRM_LINGER_MS = 550;

function hostLabel(href) {
    try {
        return new URL(href).hostname.replace(/^www\./i, '');
    } catch {
        return href;
    }
}

function openExternal(href) {
    window.open(href, '_blank', 'noopener,noreferrer');
}

function snoozeToast(option) {
    return option.durationMs === Infinity
        ? 'Link warnings are turned off. You can turn them back on in profile settings.'
        : `Link warnings are paused for ${option.label}. You can turn them back on in profile settings.`;
}

/**
 * Fill `body` (a quick-bar panel body) with the link warning row:
 * [Hold to open] … [Pause ⇄] — rendered by `mountRow` (React island, see
 * src/chat/quickbar/LinkWarningRow.tsx).
 * @param {HTMLElement} body
 * @param {{ href: string, close: () => void, mountRow: (el: HTMLElement, props: object) => () => void }} options
 * @returns {() => void} unmount for the island
 */
export function buildLinkBar(body, { href, close, mountRow }) {
    const slot = document.createElement('div');
    slot.className = 'message-linkbar__slot';
    body.append(slot);

    return mountRow(slot, {
        host: hostLabel(href),
        options: LINK_WARNING_SNOOZES.map(({ id, label }) => ({ id, label })),
        onOpen: () => {
            openExternal(href);
            window.setTimeout(close, CONFIRM_LINGER_MS);
        },
        onPause: (optionId) => {
            const option = LINK_WARNING_SNOOZES.find((o) => o.id === optionId);
            if (!option) return;
            pauseLinkWarnings(option.durationMs);
            showToast(snoozeToast(option), 'info');
            close();
        },
    });
}
