export function notificationPrefs(preferences = {}) {
    return {
        enabled: preferences.messageNotifications !== false,
        preview: preferences.messageNotificationPreview !== false,
        sound: preferences.messageNotificationSound !== false,
    };
}

export function notificationPermission() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
}

export async function ensureNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
}

export function notifyIncomingMessage({
    title,
    body,
    tag,
    sound = true,
    onClick,
}) {
    if (!('Notification' in window)) return null;
    if (Notification.permission !== 'granted') return null;
    try {
        const note = new Notification(title || 'NEXA', {
            body: body || 'New message',
            tag: tag || 'nexa-message',
            silent: !sound,
        });
        note.onclick = () => {
            window.focus();
            onClick?.();
            note.close();
        };
        return note;
    } catch {
        return null;
    }
}
