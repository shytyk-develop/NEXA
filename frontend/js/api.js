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

/** app.js hands in the current in-memory access token (for modules that don't hold it). */
let accessTokenGetter = () => '';

export function setAccessTokenGetter(getter) {
    accessTokenGetter = typeof getter === 'function' ? getter : () => '';
}

/*
 * Cold start: the free Render backend sleeps when idle and takes ~30s to wake.
 * An auth request still unanswered after SERVER_WAKE_DELAY_MS flips the app
 * into "server waking up" (window event SERVER_WAKE_EVENT, detail.waking)
 * until every slow request has settled — ok or error alike.
 */
export const SERVER_WAKE_EVENT = 'nexa:server-waking';
const SERVER_WAKE_DELAY_MS = 3500;
let slowRequests = 0;

function setSlowRequests(count) {
    const wasWaking = slowRequests > 0;
    slowRequests = count;
    if (wasWaking !== slowRequests > 0) {
        window.dispatchEvent(new CustomEvent(SERVER_WAKE_EVENT, { detail: { waking: slowRequests > 0 } }));
    }
}

export function isServerWakingUp() {
    return slowRequests > 0;
}

function trackServerWake(promise) {
    let slow = false;
    const timer = window.setTimeout(() => {
        slow = true;
        setSlowRequests(slowRequests + 1);
    }, SERVER_WAKE_DELAY_MS);
    const settle = () => {
        window.clearTimeout(timer);
        if (slow) setSlowRequests(slowRequests - 1);
    };
    promise.then(settle, settle);
    return promise;
}

let refreshInFlight = null;

/** POST /api/auth/refresh → a new access token (rejects with .status 401 when the session is over). */
export function refreshSession() {
    if (!refreshInFlight) {
        refreshInFlight = trackServerWake(fetch(`${API_URL}/api/auth/refresh`, { method: 'POST', credentials: 'include' }))
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
    return trackServerWake(postJson('/api/login', { username, password }));
}

/** Creates an unverified account; the server emails a 6-digit code. */
export async function registerRequest({ username, password, email, publicKey, encryptedPrivateKey }) {
    return trackServerWake(postJson('/api/register', {
        username,
        password,
        email,
        public_key: publicKey,
        encrypted_private_key: encryptedPrivateKey
    }));
}

/** The emailed code → session cookie + { access_token, username, public_key, encrypted_private_key }. */
export async function verifyEmailRequest(email, code) {
    return trackServerWake(postJson('/api/auth/verify-email', { email, code }));
}

/** Emails a reset link to the account (same reply whether or not it exists). */
export async function forgotPasswordRequest(emailOrUsername) {
    return trackServerWake(postJson('/api/auth/forgot-password', { email_or_username: emailOrUsername }));
}

/**
 * The emailed link's token + a new password and the key pair made for it →
 * session cookie + { access_token, username, public_key, encrypted_private_key }.
 * 400 (.status) when the link is unknown, used or expired.
 */
export async function resetPasswordRequest({ token, newPassword, publicKey, encryptedPrivateKey }) {
    return trackServerWake(postJson('/api/auth/reset-password', {
        token,
        new_password: newPassword,
        public_key: publicKey,
        encrypted_private_key: encryptedPrivateKey,
    }));
}

/** A new code (429 with .retryAfter inside the 60s cooldown). */
export async function resendOtpRequest(email) {
    return trackServerWake(postJson('/api/auth/resend-otp', { email }));
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

/** Deeplink lookup (`@` optional, any case); throws with `.status` 404 when nobody has the handle. */
export async function resolveUser(token, username) {
    return getJson(`/api/users/resolve/${encodeURIComponent(username)}`, token);
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

/**
 * New password; the server signs out every other session. `encryptedPrivateKey`
 * is this device's private key re-encrypted with the new password (E2EE).
 */
export async function changePasswordRequest(oldPassword, newPassword, encryptedPrivateKey) {
    return postJson('/api/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
        encrypted_private_key: encryptedPrivateKey,
    }, accessTokenGetter());
}

/** Erase the account (password-confirmed); the server also clears the session cookie. */
export async function deleteAccountRequest(password) {
    return apiRequest('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    }, accessTokenGetter());
}

/* Chat folders (sidebar → Folders), stored per account on the server. */
export async function getFolders() {
    return getJson('/api/folders', accessTokenGetter());
}

export async function createFolderRequest(folder) {
    return postJson('/api/folders', folder, accessTokenGetter());
}

export async function updateFolderRequest(folderId, patch) {
    return putJson(`/api/folders/${encodeURIComponent(folderId)}`, patch, accessTokenGetter());
}

export async function deleteFolderRequest(folderId) {
    return deleteJson(`/api/folders/${encodeURIComponent(folderId)}`, accessTokenGetter());
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
        headers: {
            ...(init.headers || {}),
            ...(CLIENT_TIMEZONE ? { 'X-Client-Timezone': CLIENT_TIMEZONE } : {}),
            ...authHeaders(bearer),
        },
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

/** The browser's IANA zone, so server-sent mail (the code email) shows local time. */
const CLIENT_TIMEZONE = (() => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch {
        return '';
    }
})();

async function parseJsonResponse(res) {
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
        const detail = typeof payload.detail === 'string' ? payload.detail : '';
        const error = new Error(detail || payload.message || 'Request failed');
        // Callers branch on these (e.g. login's 403 code: 'email_not_verified').
        error.status = res.status;
        error.code = payload.code;
        error.email = payload.email;
        error.retryAfter = payload.retry_after;
        throw error;
    }

    return payload;
}
