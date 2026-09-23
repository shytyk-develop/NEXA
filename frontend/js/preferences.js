const STORAGE_KEY = 'originhub_ui_preferences';

export const WALLPAPERS = {
    mist: { label: 'Mist' },
    ember: { label: 'Ember' },
    aurora: { label: 'Aurora' },
    tide: { label: 'Tide' },
    sage: { label: 'Sage' },
    cobalt: { label: 'Cobalt' },
    rose: { label: 'Rose' },
    dusk: { label: 'Dusk' },
    graphite: { label: 'Graphite' },
    void: { label: 'Void' },
};

/** Discrete 0–100 intensity, snapped every 10% (levels use 0/20/40/60/80/100). */
export const INTENSITY_STEP = 10;
export const INTENSITY_MIN = 0;
export const INTENSITY_MAX = 100;

const LEGACY_GLASS = { low: 30, medium: 50, high: 80 };
const LEGACY_DIM = { low: 40, medium: 60, high: 80 };
const WALLPAPER_VALUES = new Set(Object.keys(WALLPAPERS));

export const DEFAULT_PREFERENCES = {
    enterToSend: true,
    compactMode: false,
    showTimestamps: true,
    theme: 'dark', // locked — messenger matches start-site dark monochrome
    glassIntensity: 0, // Clearer (min) — first visit / new user default
    wallpaper: 'mist', // first wallpaper pack
    wallpaperDim: 0, // Softer (min) — first visit / new user default
    showOnlineStatus: true,
    readReceipts: true,
    typingIndicators: true,
    profileVisible: true,
    linkPreviews: true,
    messageNotifications: true,
    messageNotificationPreview: true,
    messageNotificationSound: true,
};

export function applyTheme() {
    document.documentElement.setAttribute('data-theme', 'dark');
}

export function snapIntensity(value, fallback = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const clamped = Math.min(INTENSITY_MAX, Math.max(INTENSITY_MIN, n));
    return Math.round(clamped / INTENSITY_STEP) * INTENSITY_STEP;
}

function migrateIntensity(value, legacyMap, fallback) {
    if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(legacyMap, value)) {
        return legacyMap[value];
    }
    return snapIntensity(value, fallback);
}

function sanitizePreferences(raw = {}) {
    const merged = { ...DEFAULT_PREFERENCES, ...raw, theme: 'dark' };

    merged.glassIntensity = migrateIntensity(
        merged.glassIntensity,
        LEGACY_GLASS,
        DEFAULT_PREFERENCES.glassIntensity
    );
    merged.wallpaperDim = migrateIntensity(
        merged.wallpaperDim,
        LEGACY_DIM,
        DEFAULT_PREFERENCES.wallpaperDim
    );
    if (!WALLPAPER_VALUES.has(merged.wallpaper) || merged.wallpaper === 'fresco') {
        merged.wallpaper = DEFAULT_PREFERENCES.wallpaper;
    }
    merged.compactMode = Boolean(merged.compactMode);

    return merged;
}

export function loadPreferences() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return sanitizePreferences(saved || {});
    } catch (err) {
        console.warn('Failed to load UI preferences:', err);
        return { ...DEFAULT_PREFERENCES };
    }
}

export function savePreferences(preferences) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizePreferences(preferences)));
}

function setIntensityVars(glass, dim) {
    const root = document.documentElement;
    root.style.setProperty('--glass-intensity', String(glass));
    root.style.setProperty('--dim-intensity', String(dim));
    // Keep a coarse bucket for any leftover [data-glass] rules
    root.dataset.glass = glass <= 30 ? 'low' : glass >= 70 ? 'high' : 'medium';

    const pageChat = document.getElementById('page-chat');
    if (!pageChat) return;
    pageChat.style.setProperty('--glass-intensity', String(glass));
    pageChat.style.setProperty('--dim-intensity', String(dim));
    pageChat.dataset.glass = root.dataset.glass;
}

export function applyPreferences(preferences) {
    const prefs = sanitizePreferences(preferences);

    document.body.classList.toggle('ui-compact', prefs.compactMode);
    document.body.classList.toggle('ui-hide-times', !prefs.showTimestamps);
    applyTheme();

    setIntensityVars(prefs.glassIntensity, prefs.wallpaperDim);

    const pageChat = document.getElementById('page-chat');
    if (pageChat) {
        pageChat.dataset.wallpaper = prefs.wallpaper;
        pageChat.dataset.wallpaperDim = String(prefs.wallpaperDim);
    }
    // Overlays (paste editor, etc.) live outside #page-chat — mirror theme tokens on <html>
    document.documentElement.dataset.wallpaper = prefs.wallpaper;
    document.documentElement.dataset.wallpaperDim = String(prefs.wallpaperDim);
}

export function updatePreference(preferences, key, value) {
    const next = sanitizePreferences({ ...preferences, [key]: value });
    savePreferences(next);
    applyPreferences(next);
    return next;
}
