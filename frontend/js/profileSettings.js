// Profile Settings — identity, security, privacy, data (appearance lives in Interface Settings).

import { buildChatTranscript, copyText, downloadTextFile, makeSafeFilename } from './chatActions.js';
import {
    buildStorageReport,
    clearChatHistory,
    clearLocalCache,
    computeInternalUserId,
    computeKeyFingerprint,
    formatBytes,
    getAvatarHue,
    getDisplayLabel,
    getInitials,
    getStorageBreakdown,
    loadProfile,
    PROFILE_LIMITS,
    PROFILE_STATUS,
    readAvatarAsDataUrl,
    saveProfile,
    sanitizeProfileStatus,
    sanitizeProfileText,
    validateAvatarFile,
} from './profile.js';
import { getPrivacyFlags } from './privacy.js';
import { loadHistory } from './storage.js';
import { setProfileEyesActive } from './eyeTracking.js';
import { startPreviewTilt, stopPreviewTilt } from './cardTilt.js';
import { getDevices, registerDevice } from './api.js';
import { detectDeviceInfo, devicePayload, getDeviceId } from './device.js';

const PRIVACY_HINTS = {
    showOnlineStatus: {
        on: 'Contacts see when you are online.',
        off: 'Your online status stays hidden.',
    },
    readReceipts: {
        on: 'Partners see read checkmarks.',
        off: 'Read receipts are not sent.',
    },
    typingIndicators: {
        on: 'Others see when you type.',
        off: 'Typing is not shared.',
    },
};

let ctx = null;
let draftProfile = null;
let avatarPreviewUrl = null;
let dataAnimToken = 0;
let pendingProfileSection = 'identity';

function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Resolve elements inside the profile panel (works when portaled to overlay). */
function $p(id) {
    const panel = document.getElementById('uiProfilePanel');
    if (panel) {
        const inside = panel.querySelector(`#${CSS.escape(id)}`);
        if (inside) return inside;
    }
    return document.getElementById(id);
}

function resolveUsername() {
    const fromCtx = ctx?.getUsername?.();
    if (fromCtx) return fromCtx;
    try {
        return localStorage.getItem('auth_username') || '';
    } catch {
        return '';
    }
}

export function initProfileSettings(context) {
    ctx = context;
    bindShell();
}

export function queueProfilePanelRefresh(section = 'identity') {
    pendingProfileSection = section;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => onProfilePanelOpen());
    });
}

function bindShell() {
    const panel = document.getElementById('uiProfilePanel');
    if (!panel) return;

    if (panel.dataset.profileBound) return;
    panel.dataset.profileBound = '1';

    panel.querySelectorAll('[data-profile-nav]').forEach((btn) => {
        btn.addEventListener('click', () => setSection(btn.dataset.profileNav, { fromUser: true }));
    });

    $p('uiProfileDisplayName')?.addEventListener('input', onIdentityInput);
    $p('uiProfileBio')?.addEventListener('input', onIdentityInput);
    $p('uiProfileStatus')?.addEventListener('change', onStatusChange);

    const avatarZone = $p('uiProfileAvatarZone');
    const fileInput = $p('uiProfileAvatarInput');
    $p('uiProfileAvatarUploadBtn')?.addEventListener('click', () => fileInput?.click());
    $p('uiProfileAvatarRemoveBtn')?.addEventListener('click', removeAvatar);
    fileInput?.addEventListener('change', onAvatarFileSelected);

    if (avatarZone && fileInput) {
        avatarZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            avatarZone.classList.add('is-dragover');
        });
        avatarZone.addEventListener('dragleave', () => avatarZone.classList.remove('is-dragover'));
        avatarZone.addEventListener('drop', (e) => {
            e.preventDefault();
            avatarZone.classList.remove('is-dragover');
            const file = e.dataTransfer?.files?.[0];
            if (file) processAvatarFile(file);
        });
        avatarZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInput?.click();
            }
        });
    }

    $p('uiProfileDisplayName')?.addEventListener('blur', () => saveIdentity(true));
    $p('uiProfileBio')?.addEventListener('blur', () => saveIdentity(true));

    $p('uiProfileSaveBtn')?.addEventListener('click', () => saveIdentity(false));
    $p('uiProfileUsernameEdit')?.addEventListener('click', onUsernameEdit);
    $p('uiProfileCopyLink')?.addEventListener('click', copyProfileLink);
    $p('uiProfileCopyUserId')?.addEventListener('click', copyUserId);
    $p('uiProfileCopyFingerprint')?.addEventListener('click', copyFingerprint);
    $p('uiProfileViewSecurity')?.addEventListener('click', () => setSection('security', { fromUser: true }));
    $p('uiProfileKeysToggle')?.addEventListener('click', toggleFingerprintPanel);
    $p('uiProfileManageDevices')?.addEventListener('click', () => {
        setSection('devices', { fromUser: true });
    });

    panel.querySelectorAll('[data-pref-key]').forEach((input) => {
        input.addEventListener('change', () => {
            const key = input.dataset.prefKey;
            const value = input.type === 'checkbox' ? input.checked : input.value;
            ctx?.onPreferenceChange?.(key, value);
            updatePrivacyHints(ctx?.getPreferences?.());
        });
    });

    $p('uiProfileClearCacheBtn')?.addEventListener('click', clearDrafts);
    $p('uiProfileClearHistoryBtn')?.addEventListener('click', clearHistory);
    $p('uiProfileExportDataBtn')?.addEventListener('click', exportStorageReport);
    $p('uiProfileDeleteAccountBtn')?.addEventListener('click', onDeleteAccount);
}

function syncPreviewTilt(active) {
    if (active) {
        startPreviewTilt($p('uiProfilePreviewStage'), $p('uiProfilePreviewMini'));
        return;
    }
    stopPreviewTilt();
}

export function onProfilePanelClose() {
    setProfileEyesActive(false);
    syncPreviewTilt(false);
    dataAnimToken += 1;
    document.querySelectorAll('#uiProfilePanel [data-profile-section]').forEach((section) => {
        section.classList.remove('is-ready');
    });
}

export function onProfilePanelOpen() {
    const username = resolveUsername();
    draftProfile = loadProfile(username);
    avatarPreviewUrl = draftProfile.avatarDataUrl;
    setSection(pendingProfileSection || 'identity');
    pendingProfileSection = 'identity';
    hydrateIdentity(username);
    void hydrateSecurity();
    hydratePrivacy();
    hydrateData(username);
    if (pendingProfileSection === 'devices') {
        void hydrateDevices();
    }
}

const PROFILE_SECTION_META = {
    identity: ['Profile settings', 'Manage your identity. Visible only to you.'],
    security: ['Security', 'Built with privacy by design.'],
    privacy: ['Privacy', 'Control your visibility and interactions.'],
    data: ['Data & storage', 'Manage your local data and exports.'],
    devices: ['Devices', 'Sessions signed into this account.'],
};

function setSection(id, { fromUser = false } = {}) {
    const panel = document.getElementById('uiProfilePanel');
    if (!panel) return;

    panel.querySelectorAll('[data-profile-nav]').forEach((btn) => {
        const on = btn.dataset.profileNav === id;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-current', on ? 'page' : 'false');
    });

    panel.querySelectorAll('[data-profile-section]').forEach((section) => {
        section.classList.toggle('hidden', section.dataset.profileSection !== id);
    });

    const meta = PROFILE_SECTION_META[id] || PROFILE_SECTION_META.identity;
    const titleEl = $p('uiProfileTitle');
    const subEl = document.getElementById('uiProfileHeadSub');
    if (titleEl) titleEl.textContent = meta[0];
    if (subEl) subEl.textContent = meta[1];

    const foot = panel.querySelector('.profile-foot');
    if (foot) foot.classList.add('hidden');

    if (id === 'identity' && !avatarPreviewUrl) {
        setProfileEyesActive(true, $p('uiProfileEyes'));
    } else {
        setProfileEyesActive(false);
    }

    syncPreviewTilt(id === 'identity');

    panel.querySelectorAll('[data-profile-section]').forEach((section) => {
        if (section.dataset.profileSection !== id) section.classList.remove('is-ready');
    });

    if (id === 'data') {
        playDataIntro(resolveUsername());
    } else if (id === 'devices') {
        dataAnimToken += 1;
        playSectionIntro(panel.querySelector(`[data-profile-section="${CSS.escape(id)}"]`));
        void hydrateDevices();
    } else {
        dataAnimToken += 1;
        playSectionIntro(panel.querySelector(`[data-profile-section="${CSS.escape(id)}"]`));
    }

    if (fromUser) ctx?.onProfileSectionChange?.(id);
}

function hydrateIdentity(username) {
    const displayInput = $p('uiProfileDisplayName');
    const bioInput = $p('uiProfileBio');
    const statusSelect = $p('uiProfileStatus');
    if (displayInput) displayInput.value = draftProfile.displayName;
    if (bioInput) bioInput.value = draftProfile.bio;
    if (statusSelect) {
        statusSelect.value = sanitizeProfileStatus(draftProfile.status);
        syncStatusDot(statusSelect.value);
    }

    const usernameEl = $p('uiProfileUsername');
    const linkEl = $p('uiProfileLink');
    const hintEl = $p('uiProfileUsernameHint');
    const editBtn = $p('uiProfileUsernameEdit');
    const copyLinkBtn = $p('uiProfileCopyLink');

    if (!username) {
        if (usernameEl) usernameEl.textContent = 'Not signed in';
        if (linkEl) linkEl.textContent = '—';
        if (hintEl) {
            hintEl.textContent = 'Sign in to claim a username.';
            hintEl.classList.remove('is-ok');
        }
        setCopyEnabled(editBtn, false);
        setCopyEnabled(copyLinkBtn, false);
    } else {
        if (usernameEl) usernameEl.textContent = `@${username}`;
        if (linkEl) linkEl.textContent = profileLinkFor(username);
        if (hintEl) {
            hintEl.textContent = `@${username} is available`;
            hintEl.classList.add('is-ok');
        }
        setCopyEnabled(editBtn, true);
        setCopyEnabled(copyLinkBtn, true);
    }

    updatePreview(username);
    updateCharCounts();
    hydrateUserId(username);
}

async function hydrateUserId(username) {
    const idEl = $p('uiProfileUserId');
    const copyBtn = $p('uiProfileCopyUserId');
    if (!idEl) return;

    if (!username) {
        idEl.textContent = 'Not available';
        setCopyEnabled(copyBtn, false);
        return;
    }

    const pub = await resolvePublicKeyJwk();
    if (!pub) {
        idEl.textContent = 'Keys not loaded';
        setCopyEnabled(copyBtn, false);
        return;
    }

    try {
        idEl.textContent = await computeInternalUserId(pub);
        idEl.dataset.raw = idEl.textContent;
        setCopyEnabled(copyBtn, true);
    } catch {
        idEl.textContent = 'Could not derive ID';
        setCopyEnabled(copyBtn, false);
    }
}

async function hydrateSecurity() {
    const fpEl = $p('uiProfileFingerprint');
    const copyFpBtn = $p('uiProfileCopyFingerprint');
    const shortEl = $p('uiProfileKeyFpShort');
    const verifiedEl = $p('uiProfileSecVerified');
    const verifiedHint = $p('uiProfileSecVerifiedHint');
    hydrateDeviceIdentity();

    const pub = await resolvePublicKeyJwk();
    if (!pub) {
        if (fpEl) {
            fpEl.textContent = 'Sign in and unlock keys to view your fingerprint.';
            fpEl.dataset.raw = '';
        }
        if (shortEl) shortEl.textContent = 'Unavailable';
        if (verifiedEl) {
            verifiedEl.textContent = 'Unverified';
            verifiedEl.classList.remove('is-verified');
        }
        if (verifiedHint) verifiedHint.textContent = 'Keys are not loaded on this device yet.';
        setCopyEnabled(copyFpBtn, false);
        return;
    }

    try {
        const fp = await computeKeyFingerprint(pub);
        if (fpEl) {
            fpEl.textContent = fp;
            fpEl.dataset.raw = fp.replace(/\s/g, '');
        }
        if (shortEl) {
            const compact = fp.replace(/\s/g, '');
            shortEl.textContent = compact.length > 12
                ? `${compact.slice(0, 4)}…${compact.slice(-4)}`
                : compact;
        }
        if (verifiedEl) {
            verifiedEl.textContent = 'Verified';
            verifiedEl.classList.add('is-verified');
        }
        if (verifiedHint) verifiedHint.textContent = 'Your keys are active and trusted.';
        setCopyEnabled(copyFpBtn, true);
    } catch {
        if (fpEl) {
            fpEl.textContent = 'Could not compute fingerprint';
            fpEl.dataset.raw = '';
        }
        if (shortEl) shortEl.textContent = 'Error';
        if (verifiedEl) {
            verifiedEl.textContent = 'Unverified';
            verifiedEl.classList.remove('is-verified');
        }
        if (verifiedHint) verifiedHint.textContent = 'Could not verify keys on this device.';
        setCopyEnabled(copyFpBtn, false);
    }
}

function hydrateDeviceIdentity() {
    const nameEl = $p('uiProfileDeviceName');
    const osEl = $p('uiProfileDeviceOs');
    const activeEl = $p('uiProfileDeviceActive');
    const info = detectDeviceInfo({ includeBrowser: true });
    if (nameEl) nameEl.textContent = info.name;
    if (osEl) osEl.textContent = info.osVersion || info.os;
    if (activeEl) activeEl.textContent = 'Now';
}

function deviceIconHref(platform) {
    if (platform === 'ios' || platform === 'android' || platform === 'ipados') {
        return '#icon-smartphone';
    }
    return '#icon-laptop';
}

function formatLastSeen(iso, online) {
    if (online) return 'Online';
    if (!iso) return 'Offline';
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return 'Offline';
    const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function renderDeviceRow(device, { current = false } = {}) {
    const online = Boolean(device.online) || current;
    const status = formatLastSeen(device.last_seen, online);
    const os = device.os_version || 'Unknown OS';
    const subtitle = current ? `${os} · This device` : os;
    const row = document.createElement('div');
    row.className = 'profile-sec-card profile-sec-device';
    row.innerHTML = `
        <span class="profile-sec-icon" aria-hidden="true">
            <svg class="ui-icon"><use href="${deviceIconHref(device.platform)}"/></svg>
        </span>
        <div class="profile-sec-copy">
            <p class="profile-sec-title">${escapeHtml(device.device_name || 'Unknown device')}</p>
            <p class="profile-sec-text">${escapeHtml(subtitle)}</p>
        </div>
        <div class="profile-sec-device-meta">
            <span class="profile-sec-meta-value${online ? ' is-online' : ''}">${escapeHtml(status)}</span>
        </div>
    `;
    return row;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function hydrateDevices() {
    const currentHost = $p('uiProfileDevicesCurrent');
    const othersHost = $p('uiProfileDevicesOthers');
    const othersWrap = $p('uiProfileDevicesOthersWrap');
    const emptyEl = $p('uiProfileDevicesEmpty');
    if (!currentHost) return;

    currentHost.replaceChildren();
    othersHost?.replaceChildren();
    if (othersWrap) othersWrap.hidden = true;
    if (emptyEl) emptyEl.hidden = true;

    const local = detectDeviceInfo();
    const token = ctx?.getToken?.() || localStorage.getItem('auth_token') || '';
    let devices = [];
    if (token) {
        try {
            await registerDevice(token, devicePayload(local));
        } catch {
            /* list can still succeed from a previous join */
        }
        try {
            const payload = await getDevices(token, getDeviceId());
            devices = Array.isArray(payload?.devices) ? payload.devices : [];
        } catch {
            devices = [];
        }
    }

    if (!devices.length) {
        devices = [{
            device_id: local.deviceId,
            device_name: local.name,
            platform: local.platform,
            os_version: local.osVersion,
            online: true,
            this_device: true,
        }];
    }

    const currentId = getDeviceId();
    const current = devices.filter((d) => d.this_device || d.device_id === currentId);
    const others = devices.filter((d) => !(d.this_device || d.device_id === currentId));
    const currentRows = current.length ? current : devices.slice(0, 1);

    currentRows.forEach((device) => currentHost.appendChild(renderDeviceRow(device, { current: true })));
    if (others.length && othersHost && othersWrap) {
        othersWrap.hidden = false;
        others.forEach((device) => othersHost.appendChild(renderDeviceRow(device)));
    }
}

function toggleFingerprintPanel() {
    const panel = $p('uiProfileFingerprintPanel');
    const toggle = $p('uiProfileKeysToggle');
    if (!panel || !toggle) return;
    const open = panel.classList.toggle('hidden') === false;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.classList.toggle('is-open', open);
}

async function resolvePublicKeyJwk() {
    let pub = ctx?.getPublicKeyJwk?.();
    if (pub) return pub;
    if (typeof ctx?.ensurePublicKeyJwk === 'function') {
        pub = await ctx.ensurePublicKeyJwk();
    }
    if (pub) return pub;

    const username = resolveUsername();
    if (!username) return null;
    try {
        const raw = localStorage.getItem(`e2e_keys_${username}`);
        if (raw) {
            const parsed = JSON.parse(raw);
            return parsed?.publicKey || null;
        }
    } catch {
        /* ignore */
    }
    return null;
}

function hydratePrivacy() {
    hydrateProfilePrivacy(ctx?.getPreferences?.());
    updatePrivacyHints(ctx?.getPreferences?.());
}

function updatePrivacyHints(preferences) {
    const flags = getPrivacyFlags(preferences);
    const panel = document.getElementById('uiProfilePanel');
    const scope = panel || document;
    scope.querySelectorAll('[data-privacy-hint]').forEach((el) => {
        const key = el.dataset.privacyHint;
        const hints = PRIVACY_HINTS[key];
        if (!hints) return;
        const on = flags[key];
        el.textContent = on ? hints.on : hints.off;
    });
}

function playSectionIntro(layout) {
    if (!layout) return;
    layout.classList.remove('is-ready');
    void layout.offsetWidth;
    if (reducedMotion()) {
        layout.classList.add('is-ready');
        return;
    }
    requestAnimationFrame(() => {
        layout.classList.add('is-ready');
    });
}

function hydrateData(username, { animate = false } = {}) {
    if (!username) {
        setText('uiProfileStorageUsed', '—');
        setText('uiProfileHistorySize', '—');
        setText('uiProfileKeysSize', '—');
        setText('uiProfileMetaSize', '—');
        setText('uiProfileCacheSize', '—');
        paintDonut({ messages: 0, keys: 0, cache: 0 }, false);
        return;
    }

    const b = getStorageBreakdown(username);
    const cache = b.profile + b.drafts + b.prefs + b.other;
    const values = {
        total: b.history + b.keys + cache,
        messages: b.history,
        keys: b.keys,
        cache,
        drafts: b.drafts,
    };

    if (animate) {
        playDataIntro(username, values);
        return;
    }

    setText('uiProfileStorageUsed', formatBytes(values.total));
    setText('uiProfileHistorySize', formatBytes(values.messages));
    setText('uiProfileKeysSize', formatBytes(values.keys));
    setText('uiProfileMetaSize', formatBytes(values.cache));
    setText('uiProfileCacheSize', formatBytes(values.drafts));
    paintDonut(values, true);
}

function playDataIntro(username, preset) {
    const layout = $p('uiProfileDataLayout');
    if (!layout) return;

    const values = preset || (username
        ? (() => {
            const b = getStorageBreakdown(username);
            const cache = b.profile + b.drafts + b.prefs + b.other;
            return {
                total: b.history + b.keys + cache,
                messages: b.history,
                keys: b.keys,
                cache,
                drafts: b.drafts,
            };
        })()
        : { total: 0, messages: 0, keys: 0, cache: 0, drafts: 0 });

    dataAnimToken += 1;
    const token = dataAnimToken;
    layout.classList.remove('is-ready');
    void layout.offsetWidth;
    paintDonut({ messages: 0, keys: 0, cache: 0 }, false);
    setText('uiProfileStorageUsed', formatBytes(0));
    setText('uiProfileHistorySize', formatBytes(0));
    setText('uiProfileKeysSize', formatBytes(0));
    setText('uiProfileMetaSize', formatBytes(0));
    setText('uiProfileCacheSize', formatBytes(values.drafts));

    requestAnimationFrame(() => {
        if (token !== dataAnimToken) return;
        layout.classList.add('is-ready');
        requestAnimationFrame(() => {
            if (token !== dataAnimToken) return;
            paintDonut(values, true);
            countUpBytes('uiProfileStorageUsed', values.total, token);
            countUpBytes('uiProfileHistorySize', values.messages, token);
            countUpBytes('uiProfileKeysSize', values.keys, token);
            countUpBytes('uiProfileMetaSize', values.cache, token);
        });
    });
}

function paintDonut(values, animate) {
    const total = Math.max(values.messages + values.keys + values.cache, 0);
    const gap = total > 0 ? 1.6 : 0;
    const usable = Math.max(100 - gap * 3, 0);
    const parts = [
        ['uiProfileDonutMessages', values.messages],
        ['uiProfileDonutKeys', values.keys],
        ['uiProfileDonutCache', values.cache],
    ];
    let offset = 0;
    parts.forEach(([id, value]) => {
        const el = $p(id);
        if (!el) return;
        const pct = total > 0 ? (value / total) * usable : 0;
        if (!animate) {
            el.style.transition = 'none';
        } else {
            el.style.transition = '';
        }
        el.style.strokeDasharray = `${pct} 100`;
        el.style.strokeDashoffset = String(-offset);
        offset += pct + (pct > 0 ? gap : 0);
    });
}

function countUpBytes(id, target, token) {
    const el = $p(id);
    if (!el) return;
    if (reducedMotion()) {
        el.textContent = formatBytes(target);
        return;
    }
    const duration = 700;
    const start = performance.now();
    const tick = (now) => {
        if (token !== dataAnimToken) return;
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        el.textContent = formatBytes(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

function setText(id, value) {
    const el = $p(id);
    if (el) el.textContent = value;
}

function setCopyEnabled(btn, enabled) {
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle('is-disabled', !enabled);
}

function onIdentityInput() {
    draftProfile.displayName = $p('uiProfileDisplayName')?.value || '';
    draftProfile.bio = $p('uiProfileBio')?.value || '';
    updatePreview(resolveUsername());
    updateCharCounts();
}

function onStatusChange() {
    const value = sanitizeProfileStatus($p('uiProfileStatus')?.value);
    draftProfile.status = value;
    syncStatusDot(value);
    updatePreview(resolveUsername());
    saveIdentity(true);
}

function syncStatusDot(status) {
    const dot = $p('uiProfileStatusDot');
    if (!dot) return;
    dot.className = `profile-status-dot is-${sanitizeProfileStatus(status)}`;
}

function profileLinkFor(username) {
    return username ? `nexa.to/@${username}` : '—';
}

function statusLabel(status) {
    return PROFILE_STATUS[sanitizeProfileStatus(status)] || PROFILE_STATUS.available;
}

function updateCharCounts() {
    const nameCount = $p('uiProfileNameCount');
    const bioCount = $p('uiProfileBioCount');
    const nameLen = [...(draftProfile.displayName || '')].length;
    const bioLen = [...(draftProfile.bio || '')].length;
    if (nameCount) nameCount.textContent = `${nameLen} / ${PROFILE_LIMITS.displayName}`;
    if (bioCount) bioCount.textContent = `${bioLen} / ${PROFILE_LIMITS.bio}`;
}

function updatePreview(username) {
    const label = getDisplayLabel(username, draftProfile);
    const previewName = $p('uiProfilePreviewName');
    const previewHandle = $p('uiProfilePreviewHandle');
    const previewBio = $p('uiProfilePreviewBio');
    const previewStatus = $p('uiProfilePreviewStatus');
    const previewStatusLabel = $p('uiProfilePreviewStatusLabel');
    const previewInitials = $p('uiProfilePreviewInitials');
    const previewImg = $p('uiProfilePreviewImg');
    const previewRing = $p('uiProfileAvatarPreview');

    if (previewName) previewName.textContent = label;
    if (previewHandle) previewHandle.textContent = username ? `@${username}` : '';

    const status = sanitizeProfileStatus(draftProfile.status);
    const bio = draftProfile.bio?.trim();
    if (previewBio) {
        previewBio.textContent = bio || 'No bio yet';
        previewBio.classList.toggle('is-placeholder', !bio);
    }
    if (previewStatus) {
        previewStatus.className = `profile-preview-status is-${status}`;
    }
    if (previewStatusLabel) previewStatusLabel.textContent = statusLabel(status);

    const avatarZone = $p('uiProfileAvatarZone');
    const hue = getAvatarHue(username);
    avatarZone?.style.setProperty('--avatar-hue', String(hue));
    previewRing?.style.setProperty('--avatar-hue', String(hue));

    renderAvatar(
        avatarZone,
        $p('uiProfileAvatarInitials'),
        $p('uiProfileAvatarImg'),
        username,
        avatarPreviewUrl
    );

    if (previewInitials) {
        previewInitials.textContent = [...label][0]?.toUpperCase() || '?';
    }
    if (previewImg) {
        if (avatarPreviewUrl) {
            previewImg.src = avatarPreviewUrl;
            previewImg.classList.remove('hidden');
            previewInitials?.classList.add('hidden');
        } else {
            previewImg.removeAttribute('src');
            previewImg.classList.add('hidden');
            previewInitials?.classList.remove('hidden');
        }
    }
    previewRing?.classList.remove('has-eyes');
}

function renderAvatar(ringEl, initialsEl, imgEl, username, dataUrl) {
    if (!ringEl) return;
    const label = getDisplayLabel(username, draftProfile);
    ringEl.style.setProperty('--avatar-hue', String(getAvatarHue(username)));

    if (initialsEl) initialsEl.textContent = getInitials(label);
    if (imgEl) {
        if (dataUrl) {
            imgEl.src = dataUrl;
            imgEl.classList.remove('hidden');
            initialsEl?.classList.add('hidden');
            ringEl.classList.remove('has-eyes');
            setProfileEyesActive(false);
        } else {
            imgEl.removeAttribute('src');
            imgEl.classList.add('hidden');
            initialsEl?.classList.add('hidden');
            ringEl.classList.add('has-eyes');
            setProfileEyesActive(true, $p('uiProfileEyes'));
        }
    }
}

async function onAvatarFileSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await processAvatarFile(file);
}

async function processAvatarFile(file) {
    const check = validateAvatarFile(file);
    if (!check.ok) {
        ctx?.showToast?.(check.error, 'error');
        return;
    }
    try {
        avatarPreviewUrl = await readAvatarAsDataUrl(file);
        draftProfile.avatarDataUrl = avatarPreviewUrl;
        updatePreview(resolveUsername());
        ctx?.showToast?.('Avatar updated.', 'success');
        saveIdentity(true);
    } catch {
        ctx?.showToast?.('Could not load image.', 'error');
    }
}

function removeAvatar() {
    avatarPreviewUrl = null;
    draftProfile.avatarDataUrl = null;
    updatePreview(resolveUsername());
    saveIdentity(true);
}

function saveIdentity(silent = false) {
    const username = resolveUsername();
    if (!username) return;

    draftProfile.displayName = sanitizeProfileText(
        $p('uiProfileDisplayName')?.value || '',
        PROFILE_LIMITS.displayName
    );
    draftProfile.bio = sanitizeProfileText(
        $p('uiProfileBio')?.value || '',
        PROFILE_LIMITS.bio
    );
    draftProfile.status = sanitizeProfileStatus($p('uiProfileStatus')?.value);
    draftProfile.avatarDataUrl = avatarPreviewUrl;

    saveProfile(username, draftProfile);
    ctx?.onProfileSaved?.(draftProfile);
    if (!silent) {
        ctx?.showToast?.('Profile saved.', 'success');
    }
}

function clearDrafts() {
    const username = resolveUsername();
    if (!username) return;
    const n = clearLocalCache(username);
    hydrateData(username);
    ctx?.showToast?.(n ? `Cleared ${n} draft(s).` : 'No drafts to clear.', 'success');
}

async function clearHistory() {
    const username = resolveUsername();
    if (!username) return;
    if (
        !window.confirm(
            'Delete all conversations on the server for every contact? This removes history for you and your partners and cannot be undone.'
        )
    ) {
        return;
    }
    try {
        if (typeof ctx?.onClearAllHistory === 'function') {
            await ctx.onClearAllHistory();
        } else {
            clearChatHistory(username);
        }
        hydrateData(username);
        ctx?.showToast?.('All chat history deleted.', 'success');
    } catch (err) {
        ctx?.showToast?.(err?.message || 'Could not clear chat history.', 'error');
    }
}

async function exportStorageReport() {
    const username = resolveUsername();
    if (!username) {
        ctx?.showToast?.('Sign in to export your data.', 'error');
        return;
    }
    try {
        const history = loadHistory(username);
        const parts = [buildStorageReport(username), ''];
        Object.entries(history).forEach(([partner, messages]) => {
            parts.push(buildChatTranscript({
                owner: username,
                partner,
                messages: messages || [],
            }));
            parts.push('');
        });
        const stamp = new Date().toISOString().slice(0, 10);
        downloadTextFile(
            `nexa-export-${makeSafeFilename(username)}-${stamp}.txt`,
            parts.join('\n')
        );
        ctx?.showToast?.('Chat history downloaded.', 'success');
    } catch {
        ctx?.showToast?.('Export failed.', 'error');
    }
}

function onDeleteAccount() {
    ctx?.showToast?.('Account deletion isn’t available yet.', 'info');
}

function onUsernameEdit() {
    ctx?.showToast?.('Username is your login and can’t be changed.', 'info');
}

async function copyProfileLink() {
    const username = resolveUsername();
    if (!username) {
        ctx?.showToast?.('Not signed in.', 'error');
        return;
    }
    await copyField(profileLinkFor(username));
}

async function copyUserId() {
    const el = $p('uiProfileUserId');
    const raw = el?.dataset.raw || el?.textContent;
    await copyField(raw);
}

async function copyFingerprint() {
    const raw = $p('uiProfileFingerprint')?.dataset.raw;
    await copyField(raw);
}

async function copyField(text) {
    const value = typeof text === 'string' ? text.trim() : '';
    if (
        !value ||
        value === '—' ||
        value === 'Loading…' ||
        value.startsWith('Not ') ||
        value.startsWith('Could ') ||
        value.startsWith('Keys ') ||
        value.startsWith('Sign ')
    ) {
        ctx?.showToast?.('Nothing to copy yet.', 'error');
        return;
    }
    try {
        await copyText(value);
        ctx?.showToast?.('Copied to clipboard.', 'success');
    } catch {
        ctx?.showToast?.('Copy failed.', 'error');
    }
}

export function hydrateProfilePrivacy(preferences) {
    const prefs = preferences || ctx?.getPreferences?.() || {};
    const map = {
        showOnlineStatus: 'uiPrefShowOnline',
        readReceipts: 'uiPrefReadReceipts',
        typingIndicators: 'uiPrefTypingIndicators',
    };
    Object.entries(map).forEach(([key, id]) => {
        const el = $p(id);
        if (el) el.checked = prefs[key] !== false;
    });
}
