// External-link warnings: on by default; can be paused (until a timestamp) or
// turned off on this device. Stored locally — a per-device safety preference.

const STORAGE_KEY = 'nexa.linkWarnings.pausedUntil';
/** Stored instead of a timestamp when turned off for good. */
const FOREVER = 'never';

const DAY_MS = 24 * 60 * 60 * 1000;

export const LINK_WARNING_SNOOZES = [
    { id: 'day', label: '1 day', durationMs: DAY_MS },
    { id: 'week', label: '1 week', durationMs: 7 * DAY_MS },
    { id: 'month', label: '1 month', durationMs: 30 * DAY_MS },
    { id: 'off', label: 'Off', durationMs: Infinity },
];

/** Fired on window whenever the setting changes (profile switch stays in sync). */
export const LINK_WARNINGS_CHANGED = 'nexa:link-warnings-changed';

function readPausedUntil() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw == null) return 0;
        if (raw === FOREVER) return Infinity;
        return Number(raw) || 0;
    } catch {
        // Storage blocked: fail safe — warnings stay on.
        return 0;
    }
}

function write(value) {
    try {
        if (value == null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, value);
    } catch {
        /* storage unavailable — nothing persisted */
    }
    window.dispatchEvent(new CustomEvent(LINK_WARNINGS_CHANGED));
}

export function areLinkWarningsEnabled(now = Date.now()) {
    return readPausedUntil() <= now;
}

/** Pause for `durationMs` from now (Infinity = off until turned back on). */
export function pauseLinkWarnings(durationMs) {
    write(durationMs === Infinity ? FOREVER : String(Date.now() + durationMs));
}

export function enableLinkWarnings() {
    write(null);
}

/** @returns {{ state: 'on' } | { state: 'off' } | { state: 'paused', until: Date }} */
export function describeLinkWarnings(now = Date.now()) {
    const until = readPausedUntil();
    if (until === Infinity) return { state: 'off' };
    if (until > now) return { state: 'paused', until: new Date(until) };
    return { state: 'on' };
}
