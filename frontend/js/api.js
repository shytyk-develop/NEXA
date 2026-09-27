// Same-origin: vercel.json rewrites /api/* to the Render backend (vite.config.js
// proxies it in dev), so the HttpOnly refresh-token cookie is first-party.
export const API_URL = "";

/*
 * Session auth. The access token lives in memory only (app.js state); the
 * refresh token is an HttpOnly cookie the browser sends to /api. A 401 on an
 * authed call triggers one silent refresh (shared by every call that hits it)
 * and a single retry; if the refresh fails the app is told the session is gone.
 */
let authHandlers = { onToken: null, onAuthLost: null };

/** app.js: onToken(newAccessToken) after a refresh; onAuthLost() when it can't refresh. */
export function setAuthHandlers(handlers) {
    authHandlers = { ...authHandlers, ...handlers };
}

let refreshInFlight = null;

/** POST /api/auth/refresh → a new access token (rejects with .status 401 when the session is over). */
export function refreshSession() {
    if (!refreshInFlight) {
        refreshInFlight = fetch(`${API_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include' })
            .then(async (res) => {
                const payload = await res.json().catch(() => ({}));
                if (!res.ok || !payload.access_token) {
                    const error = new Error(payload.detail || 'Session expired');
                    error.status = res.status;
                    throw error;
                }
                authHandlers.onToken?.(payload.access_token);
                return payload.access_token;
            })
            .finally(() => {
                refreshInFlight = null;
            });
    }
    return refreshInFlight;
}

/** End this browser's session on the server (drops the cookie). Never throws. */
export async function logoutRequest() {
    try {
        await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
        /* offline: the cookie expires on its own */
    }
}


export function normalizeUsername(value) {
    return value.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function isValidUsername(username) {
    return /^[a-z0-9_]{3,32}$/.test(username);
}

export function usernamePolicyText() {
    return "Username must be 3-32 chars: lowercase English letters, digits, and underscore only.";
}

export async function loginRequest(username, password) {
    return postJson('/api/login', { username, password });
}

export async function registerRequest({ username, password, publicKey, encryptedPrivateKey }) {
    return postJson('/api/register', {
        username,
        password,
        public_key: publicKey,
        encrypted_private_key: encryptedPrivateKey
    });
}

export async function getChats(token, limit = 50) {
    return getJson(`/api/chats?limit=${limit}`, token);
}

export async function searchUsers(token, query, limit = 20) {
    if (query.length < 2) return [];
    return getJson(`/api/users/search?q=${encodeURIComponent(query)}&limit=${limit}`, token);
}

export async function getUser(token, username) {
    return getJson(`/api/users/${encodeURIComponent(username)}`, token);
}

export async function getHistory(token, user, partner, limit = 50, offset = 0) {
    return getJson(
        `/api/history?user=${encodeURIComponent(user)}&partner=${encodeURIComponent(partner)}&limit=${limit}&offset=${offset}`,
        token
    );
}

export async function deleteMessage(token, messageId) {
    return deleteJson(`/api/history/message/${encodeURIComponent(messageId)}`, token);
}

export async function deleteConversation(token, partner) {
    return deleteJson(`/api/history/conversation/${encodeURIComponent(partner)}`, token);
}

export async function updateProfile(token, profile) {
    return putJson('/api/profile', {
        display_name: profile.displayName || '',
        bio: profile.bio || '',
        avatar_data: profile.avatarDataUrl || null,
    }, token);
}

export async function registerDevice(token, device) {
    return putJson('/api/me/device', {
        device_id: device.device_id || device.deviceId,
        device_name: device.device_name || device.name || '',
        platform: device.platform || 'unknown',
        os_version: device.os_version || device.osVersion || device.os || '',
    }, token);
}

/**
 * Save a message for both people in the chat. Only the message id travels —
 * the chat is end-to-end encrypted; each side reads the text from its own
 * history. The server pushes `shared_message_saved` to both.
 */
export async function saveMessageForEveryone(token, messageId) {
    return postJson('/api/saved-messages', { message_id: Number(messageId), save_for_everyone: true }, token);
}

/** Remove a message saved for everyone from MY Saved Messages only (persists). */
export async function removeSharedSavedMessage(token, messageId) {
    return deleteJson(`/api/saved-messages/shared/${encodeURIComponent(messageId)}`, token);
}

/** Messages saved for everyone in one chat (ids only), to catch up on open. */
export async function getSharedSavedMessages(token, partner) {
    return getJson(`/api/saved-messages/shared?partner=${encodeURIComponent(partner)}`, token);
}

export async function getDevices(token, deviceId) {
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    return getJson(`/api/me/devices${query}`, token);
}

/**
 * Terminate another device's session (Settings → Devices drawer). The server
 * signs that device out and refuses its current token; `currentDeviceId`
 * guards against ending this one (that's Log out).
 */
export async function terminateDevice(token, deviceId, currentDeviceId) {
    const query = currentDeviceId ? `?current_device_id=${encodeURIComponent(currentDeviceId)}` : '';
    return deleteJson(`/api/me/devices/${encodeURIComponent(deviceId)}${query}`, token);
}

export async function syncMuted(token, partners) {
    return putJson('/api/me/muted', { partners: partners || [] }, token);
}

/**
 * Every API call: same-origin, cookies included; an authed call that gets 401
 * refreshes the session once and retries with the new token.
 */
async function apiRequest(path, init = {}, token = null) {
    const send = (bearer) => fetch(`${API_URL}${path}`, {
        ...init,
        credentials: 'include',
        headers: { ...(init.headers || {}), ...authHeaders(bearer) },
    });
    let res = await send(token);
    if (res.status === 401 && token && !path.startsWith('/api/auth/')) {
        let fresh = null;
        try {
            fresh = await refreshSession();
        } catch (error) {
            // Only a refused refresh ends the session — not a network blip.
            if (error?.status === 401) authHandlers.onAuthLost?.();
        }
        if (fresh) res = await send(fresh);
    }
    return parseJsonResponse(res);
}

async function postJson(path, payload, token = null) {
    return apiRequest(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }, token);
}

async function getJson(path, token) {
    return apiRequest(path, {}, token);
}

async function deleteJson(path, token) {
    return apiRequest(path, { method: 'DELETE' }, token);
}

async function putJson(path, payload, token) {
    return apiRequest(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }, token);
}

function authHeaders(token) {
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseJsonResponse(res) {
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(payload.detail || payload.message || 'Request failed');
    }

    return payload;
}
