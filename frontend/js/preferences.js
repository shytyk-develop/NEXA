const STORAGE_KEY = 'originhub_ui_preferences';

export const DEFAULT_PREFERENCES = {
    enterToSend: true,
    compactMode: false,
    showTimestamps: true,
    theme: 'dark', // locked — messenger matches start-site dark monochrome
    glassIntensity: 'medium', // 'low' | 'medium' | 'high'
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

export function loadPreferences() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        const merged = { ...DEFAULT_PREFERENCES, ...(saved || {}) };
        // Theme switching removed — always dark
        merged.theme = 'dark';
        return merged;
    } catch (err) {
        console.warn('Failed to load UI preferences:', err);
        return { ...DEFAULT_PREFERENCES };
    }
}

export function savePreferences(preferences) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...preferences, theme: 'dark' }));
}

export function applyPreferences(preferences) {
    document.body.classList.toggle('ui-compact', preferences.compactMode);
    document.body.classList.toggle('ui-hide-times', !preferences.showTimestamps);
    applyTheme();

    const glass = preferences.glassIntensity || 'medium';
    document.documentElement.dataset.glass = glass;
}

export function updatePreference(preferences, key, value) {
    const next = { ...preferences, [key]: value, theme: 'dark' };
    savePreferences(next);
    applyPreferences(next);
    return next;
}
