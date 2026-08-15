import {
    closeOverlay,
    closeOverlaysForChatChange,
    openContextMenu,
    openDropdown,
    openModalOverlay,
    openPopoverOverlay,
} from '../ui/overlays/overlayManager.js';
import { getMyReaction, getReactionCounts, QUICK_REACTIONS } from './messageReactions.js';
import {
    appendLinkedTextContent,
    createLinkSecurityNotice,
    messageContainsLink,
    isSafeWebHref,
} from './messageLinks.js';
import { hydrateProfilePrivacy, onProfilePanelClose, queueProfilePanelRefresh } from './profileSettings.js';
import { getPrivacyFlags, isChatMuted } from './privacy.js';
import {
    applyContactAvatar,
    getDisplayLabel,
    loadProfile,
} from './profile.js';
import { resolveContactProfile } from './profileDirectory.js';
import {
    clearPasteAttachments,
    getPasteAttachmentsLength,
    initSmartPasteUi,
} from './smartPaste.js';

export const DOM = {
    pageStart: document.getElementById('page-start'),
    pageLogin: document.getElementById('page-login'),
    pageChat: document.getElementById('page-chat'),
    pageAboutSecurity: document.getElementById('page-about-security'),

    usernameInput: document.getElementById('usernameInput'),
    passwordInput: document.getElementById('passwordInput'),
    btnLogin: document.getElementById('btnLogin'),
    btnRegister: document.getElementById('btnRegister'),
    btnForgotPassword: document.getElementById('btnForgotPassword'),
    btnAuthApple: document.getElementById('btnAuthApple'),
    btnAuthGoogle: document.getElementById('btnAuthGoogle'),
    authError: document.getElementById('authError'),

    statusSpan: document.getElementById('status'),
    messagesDiv: document.getElementById('messages'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    usersListDiv: document.getElementById('usersList'),
    chatWithTitle: document.getElementById('chatWithTitle'),
    chatSubtitle: document.getElementById('chatSubtitle'),
    chatHeaderAvatar: document.getElementById('chatHeaderAvatar'),
    chatWelcome: document.getElementById('chat-welcome'),

    focusContactsBtn: document.getElementById('uiFocusContactsBtn'),
    focusComposerBtn: document.getElementById('uiFocusComposerBtn'),
    shortcutsBtn: document.getElementById('uiShortcutsBtn'),
    profileBtn: document.getElementById('uiProfileBtn'),
    settingsBtn: document.getElementById('uiSettingsBtn'),
    refreshUsersBtn: document.getElementById('uiRefreshUsersBtn'),
    contactSearchInput: document.getElementById('uiContactSearch'),
    contactSearchOpenBtn: document.getElementById('uiContactSearchOpenBtn'),
    contactSearchTrigger: document.getElementById('uiContactSearchTrigger'),
    contactSearchBackBtn: document.getElementById('uiContactSearchBackBtn'),
    sidebarLabel: document.getElementById('uiSidebarLabel'),
    copyUsernameBtn: document.getElementById('uiCopyUsernameBtn'),
    logoutBtn: document.getElementById('uiLogoutBtn'),

    chatSearchBtn: document.getElementById('uiChatSearchBtn'),
    scrollBottomBtn: document.getElementById('uiScrollBottomBtn'),
    chatMenuBtn: document.getElementById('uiChatMenuBtn'),

    messageSearch: document.getElementById('uiMessageSearch'),
    messageSearchInput: document.getElementById('uiMessageSearchInput'),
    messageSearchCount: document.getElementById('uiMessageSearchCount'),

    attachBtn: document.getElementById('uiAttachBtn'),
    fileInput: document.getElementById('uiFileInput'),
    composerMenuBtn: document.getElementById('uiComposerMenuBtn'),
    emojiBtn: document.getElementById('uiEmojiBtn'),
    emojiPicker: document.getElementById('uiEmojiPicker'),
    clearComposerBtn: document.getElementById('uiClearComposerBtn'),
    pasteAttachments: document.getElementById('uiPasteAttachments'),
    pasteEditor: document.getElementById('uiPasteEditor'),
    pasteEditorTitle: document.getElementById('uiPasteEditorTitle'),
    pasteEditorCount: document.getElementById('uiPasteEditorCount'),
    pasteEditorText: document.getElementById('uiPasteEditorText'),
    pasteEditorSave: document.getElementById('uiPasteEditorSave'),
    pasteEditorRemove: document.getElementById('uiPasteEditorRemove'),
    pasteEditorClose: document.getElementById('uiPasteEditorClose'),
    replyBar: document.getElementById('uiReplyBar'),
    replyLabel: document.getElementById('uiReplyLabel'),
    replyPreview: document.getElementById('uiReplyPreview'),
    replyCloseBtn: document.getElementById('uiReplyCloseBtn'),
    draftStatus: document.getElementById('uiDraftStatus'),
    charCounter: document.getElementById('uiCharCounter'),

    settingsPanel: document.getElementById('uiSettingsPanel'),
    closeSettingsBtn: document.getElementById('uiCloseSettingsBtn'),
    prefEnterSend: document.getElementById('uiPrefEnterSend'),
    prefCompactMode: document.getElementById('uiPrefCompactMode'),
    prefShowTimestamps: document.getElementById('uiPrefShowTimestamps'),
    glassPicker: document.getElementById('uiGlassPicker'),

    profilePanel: document.getElementById('uiProfilePanel'),
    profileNav: document.getElementById('uiProfileNav'),
    profileNavToggle: document.getElementById('uiProfileNavToggle'),
    profileNavScrim: document.getElementById('uiProfileNavScrim'),
    profileNavBackBtn: document.getElementById('uiProfileNavBackBtn'),
    profileBackBtn: document.getElementById('uiProfileBackBtn'),
    closeProfileBtn: document.getElementById('uiCloseProfileBtn'),

    shortcutsPanel: document.getElementById('uiShortcutsPanel'),
    closeShortcutsBtn: document.getElementById('uiCloseShortcutsBtn'),
    toastRegion: document.getElementById('uiToastRegion'),

    chatWorkspace: document.getElementById('uiChatWorkspace'),
    chatBackBtn: document.getElementById('uiChatBackBtn'),
    sidebar: document.getElementById('uiSidebar'),
    sidebarToggle: document.getElementById('uiSidebarToggle'),
    railCollapsedTools: document.getElementById('uiRailCollapsedTools'),
    railMark: document.getElementById('uiRailMark'),
    railSidebarToggle: document.getElementById('uiRailSidebarToggle'),
    railChats: document.getElementById('uiRailChats'),
    railProfile: document.getElementById('uiRailProfile'),

    peerPanel: document.getElementById('uiPeerPanel'),
    peerPanelToggle: document.getElementById('uiPeerPanelToggle'),
    peerPanelScrim: document.getElementById('uiPeerPanelScrim'),
    peerEmpty: document.getElementById('uiPeerEmpty'),
    peerBody: document.getElementById('uiPeerBody'),
    peerAvatar: document.getElementById('uiPeerAvatar'),
    peerName: document.getElementById('uiPeerName'),
    peerHandle: document.getElementById('uiPeerHandle'),
    peerStatus: document.getElementById('uiPeerStatus'),
    peerBio: document.getElementById('uiPeerBio'),
    peerEncryptCopy: document.getElementById('uiPeerEncryptCopy'),
    peerSecurityBtn: document.getElementById('uiPeerSecurityBtn'),
    peerMuteBtn: document.getElementById('uiPeerMuteBtn'),
    peerClearBtn: document.getElementById('uiPeerClearBtn'),
    peerDeleteBtn: document.getElementById('uiPeerDeleteBtn'),
};

const missingDomKeys = Object.entries(DOM)
    .filter(([, element]) => !element)
    .map(([key]) => key);

if (missingDomKeys.length) {
    throw new Error(`Missing required UI elements: ${missingDomKeys.join(', ')}`);
}

initSmartPasteUi({
    listEl: DOM.pasteAttachments,
    dialogEl: DOM.pasteEditor,
    textareaEl: DOM.pasteEditorText,
    countEl: DOM.pasteEditorCount,
    titleEl: DOM.pasteEditorTitle,
    saveBtn: DOM.pasteEditorSave,
    removeBtn: DOM.pasteEditorRemove,
    closeBtn: DOM.pasteEditorClose,
    isDisabled: () => Boolean(DOM.messageInput?.disabled),
});

const PEER_PANEL_COLLAPSED_KEY = 'nexa_peer_panel_collapsed';
const PEER_NARROW_MQ = '(max-width: 1280px)';
const SIDEBAR_NARROW_MQ = '(max-width: 1100px)';
const PROFILE_STACK_MQ = '(max-width: 760px)';
const APP_STACK_MQ = PROFILE_STACK_MQ;

function isAppStackViewport() {
    return window.matchMedia(APP_STACK_MQ).matches;
}

function isProfileStackViewport() {
    return isAppStackViewport();
}

function readPeerPanelCollapsed() {
    try {
        return localStorage.getItem(PEER_PANEL_COLLAPSED_KEY) === '1';
    } catch {
        return false;
    }
}

function setPeerPanelCollapsed(collapsed, persist = true) {
    const panel = DOM.peerPanel;
    const btn = DOM.peerPanelToggle;
    if (!panel) return;
    panel.classList.toggle('is-collapsed', collapsed);
    DOM.pageChat?.classList.toggle('is-peer-collapsed', collapsed);
    if (btn) {
        const label = collapsed ? 'Show conversation panel' : 'Hide conversation panel';
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', collapsed ? 'Show panel' : 'Hide panel');
    }
    syncPeerPanelScrim();
    if (!persist) return;
    try {
        localStorage.setItem(PEER_PANEL_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
        /* ignore quota / private mode */
    }
}

function syncPeerPanelScrim() {
    const scrim = DOM.peerPanelScrim;
    const panel = DOM.peerPanel;
    if (!scrim || !panel) return;
    const overlayMode = window.matchMedia(PEER_NARROW_MQ).matches || isAppStackViewport();
    const open = !panel.classList.contains('is-collapsed');
    const show = overlayMode && open;
    scrim.hidden = !show;
    scrim.setAttribute('aria-hidden', show ? 'false' : 'true');
    DOM.pageChat?.classList.toggle('is-peer-overlay-open', show);
}

export function openPeerProfileSheet() {
    if (!DOM.peerPanel) return;
    peerViewportForced = false;
    peerNarrowUserExpand = window.matchMedia(PEER_NARROW_MQ).matches || isAppStackViewport();
    setPeerPanelCollapsed(false);
}

export function closePeerProfileSheet() {
    peerNarrowUserExpand = false;
    setPeerPanelCollapsed(true);
}

/** @type {boolean} */
let peerViewportForced = false;
/** @type {boolean} */
let peerNarrowUserExpand = false;
/** @type {boolean} */
let sidebarViewportForced = false;
/** @type {boolean} */
let sidebarNarrowUserExpand = false;

function initPeerPanelCollapse() {
    const panel = DOM.peerPanel;
    const btn = DOM.peerPanelToggle;
    if (!panel) return;
    const collapsed = readPeerPanelCollapsed();
    if (collapsed) {
        panel.classList.add('no-motion');
        setPeerPanelCollapsed(true, false);
        requestAnimationFrame(() => panel.classList.remove('no-motion'));
    } else if (isAppStackViewport()) {
        setPeerPanelCollapsed(true, false);
    } else {
        DOM.pageChat?.classList.toggle('is-peer-collapsed', false);
        syncPeerPanelScrim();
    }
    btn?.addEventListener('click', () => {
        const next = !panel.classList.contains('is-collapsed');
        peerViewportForced = false;
        peerNarrowUserExpand = window.matchMedia(PEER_NARROW_MQ).matches && !next;
        setPeerPanelCollapsed(next);
    });
    DOM.peerPanelScrim?.addEventListener('click', () => {
        peerNarrowUserExpand = false;
        setPeerPanelCollapsed(true);
    });
    document.getElementById('uiPeerSheetBackBtn')?.addEventListener('click', () => {
        closePeerProfileSheet();
    });

    const headerLeft = DOM.chatWithTitle?.closest('.header-left');
    if (headerLeft) {
        headerLeft.setAttribute('role', 'button');
        headerLeft.setAttribute('tabindex', '0');
        headerLeft.setAttribute('aria-label', 'Open contact profile');
        const openFromHeader = () => {
            if (!isAppStackViewport()) return;
            if (headerLeft.classList.contains('hidden')) return;
            if (!contactsState.activeUsername) return;
            openPeerProfileSheet();
        };
        headerLeft.addEventListener('click', openFromHeader);
        headerLeft.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openFromHeader();
        });
    }
}

initPeerPanelCollapse();

const SIDEBAR_COLLAPSED_KEY = 'nexa_sidebar_collapsed';

function readSidebarCollapsed() {
    try {
        return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
        return false;
    }
}

function chatsViewActive() {
    return Boolean(DOM.chatWorkspace && !DOM.chatWorkspace.hidden);
}

function syncRailCollapsedTools() {
    const tools = DOM.railCollapsedTools;
    if (!tools) return;
    const show = chatsViewActive()
        && Boolean(DOM.sidebar?.classList.contains('is-collapsed'))
        && !isAppStackViewport();
    tools.hidden = !show;
    tools.setAttribute('aria-hidden', show ? 'false' : 'true');
}

function setSidebarCollapsed(collapsed, persist = true) {
    const sidebar = DOM.sidebar;
    const btn = DOM.sidebarToggle;
    if (!sidebar) return;
    sidebar.classList.toggle('is-collapsed', collapsed);
    DOM.pageChat?.classList.toggle('is-sidebar-collapsed', collapsed);
    if (btn) {
        const label = collapsed ? 'Show contacts' : 'Hide contacts';
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
    }
    syncRailCollapsedTools();
    if (!persist) return;
    try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
        /* ignore quota / private mode */
    }
}

/** @type {boolean} */
let profileNavUserExpand = false;

function syncProfileNavScrim() {
    const scrim = DOM.profileNavScrim;
    if (!scrim) return;
    const narrow = window.matchMedia(SIDEBAR_NARROW_MQ).matches;
    const stack = isProfileStackViewport();
    const open = Boolean(DOM.pageChat?.classList.contains('is-profile-nav-open'));
    const show = narrow && !stack && open && Boolean(DOM.profilePanel && !DOM.profilePanel.classList.contains('hidden'));
    scrim.hidden = !show;
    scrim.setAttribute('aria-hidden', show ? 'false' : 'true');
}

function setProfileNavOpen(open) {
    DOM.pageChat?.classList.toggle('is-profile-nav-open', open);
    const btn = DOM.profileNavToggle;
    if (btn) {
        const label = open ? 'Hide settings menu' : 'Open settings menu';
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.setAttribute('aria-label', label);
        btn.setAttribute('title', label);
    }
    syncProfileNavScrim();
}

/**
 * @param {'nav' | 'section' | null} level
 */
function setProfileDrillLevel(level) {
    const page = DOM.pageChat;
    if (!page) return;
    page.classList.toggle('is-profile-level-nav', level === 'nav');
    page.classList.toggle('is-profile-level-section', level === 'section');

    const backToNav = level === 'section';
    const sectionBackLabel = backToNav ? 'Back to settings' : 'Back to chats';
    if (DOM.profileBackBtn) {
        DOM.profileBackBtn.setAttribute('aria-label', sectionBackLabel);
        DOM.profileBackBtn.setAttribute('title', sectionBackLabel);
    }
    if (DOM.profileNavBackBtn) {
        DOM.profileNavBackBtn.setAttribute('aria-label', 'Back to chats');
        DOM.profileNavBackBtn.setAttribute('title', 'Back to chats');
    }
}

export function onProfileSectionOpened() {
    if (!isProfileStackViewport()) return;
    if (DOM.profilePanel?.classList.contains('hidden')) return;
    setProfileDrillLevel('section');
}

export function handleProfileBack() {
    if (
        isProfileStackViewport()
        && DOM.pageChat?.classList.contains('is-profile-level-section')
        && DOM.profilePanel
        && !DOM.profilePanel.classList.contains('hidden')
    ) {
        setProfileDrillLevel('nav');
        return;
    }
    showChatsView();
}

/**
 * @param {'list' | 'chat' | null} level
 */
function setChatDrillLevel(level) {
    const page = DOM.pageChat;
    if (!page) return;
    page.classList.toggle('is-chat-level-list', level === 'list');
    page.classList.toggle('is-chat-level-chat', level === 'chat');
    const back = DOM.chatBackBtn;
    if (back) {
        back.hidden = level !== 'chat';
        back.setAttribute('aria-hidden', level === 'chat' ? 'false' : 'true');
    }
    if (level !== 'chat') closePeerProfileSheet();
}

export function handleChatBack() {
    if (
        isAppStackViewport()
        && chatsViewActive()
        && DOM.pageChat?.classList.contains('is-chat-level-chat')
    ) {
        setChatDrillLevel('list');
        setActiveContact(null);
        return;
    }
}

function syncChatStackLevel() {
    if (!isAppStackViewport() || !chatsViewActive()) {
        setChatDrillLevel(null);
        return;
    }
    const hasLevel = DOM.pageChat?.classList.contains('is-chat-level-list')
        || DOM.pageChat?.classList.contains('is-chat-level-chat');
    if (hasLevel) return;
    setChatDrillLevel(contactsState.activeUsername ? 'chat' : 'list');
}

function syncViewportPanels() {
    const peerNarrow = window.matchMedia(PEER_NARROW_MQ).matches;
    const sidebarNarrow = window.matchMedia(SIDEBAR_NARROW_MQ).matches;
    const appStack = isAppStackViewport();
    DOM.pageChat?.classList.toggle('is-viewport-peer-narrow', peerNarrow);
    DOM.pageChat?.classList.toggle('is-viewport-sidebar-narrow', sidebarNarrow);
    DOM.pageChat?.classList.toggle('is-viewport-profile-stack', appStack);
    DOM.pageChat?.classList.toggle('is-viewport-app-stack', appStack);

    if (DOM.peerPanel) {
        if (peerNarrow) {
            if (!peerNarrowUserExpand && !DOM.peerPanel.classList.contains('is-collapsed')) {
                peerViewportForced = true;
                DOM.peerPanel.classList.add('no-motion');
                setPeerPanelCollapsed(true, false);
                requestAnimationFrame(() => DOM.peerPanel?.classList.remove('no-motion'));
            } else {
                syncPeerPanelScrim();
            }
        } else {
            peerNarrowUserExpand = false;
            if (peerViewportForced) {
                peerViewportForced = false;
                setPeerPanelCollapsed(readPeerPanelCollapsed(), false);
            } else {
                syncPeerPanelScrim();
            }
        }
    }

    if (DOM.sidebar) {
        if (sidebarNarrow && !appStack) {
            if (!sidebarNarrowUserExpand && !DOM.sidebar.classList.contains('is-collapsed')) {
                sidebarViewportForced = true;
                DOM.sidebar.classList.add('no-motion');
                setSidebarCollapsed(true, false);
                requestAnimationFrame(() => DOM.sidebar?.classList.remove('no-motion'));
            } else {
                syncRailCollapsedTools();
            }
        } else if (!sidebarNarrow && !appStack) {
            sidebarNarrowUserExpand = false;
            if (sidebarViewportForced) {
                sidebarViewportForced = false;
                setSidebarCollapsed(readSidebarCollapsed(), false);
            } else {
                syncRailCollapsedTools();
            }
        } else {
            syncRailCollapsedTools();
        }
    } else {
        syncRailCollapsedTools();
    }

    if (appStack) {
        profileNavUserExpand = false;
        setProfileNavOpen(false);
        const profileOpen = Boolean(DOM.profilePanel && !DOM.profilePanel.classList.contains('hidden'));
        if (profileOpen) {
            const hasLevel = DOM.pageChat?.classList.contains('is-profile-level-nav')
                || DOM.pageChat?.classList.contains('is-profile-level-section');
            if (!hasLevel) setProfileDrillLevel('nav');
        } else {
            setProfileDrillLevel(null);
        }
        syncChatStackLevel();
    } else {
        setProfileDrillLevel(null);
        setChatDrillLevel(null);
        if (sidebarNarrow) {
            if (!profileNavUserExpand) setProfileNavOpen(false);
            else syncProfileNavScrim();
        } else {
            profileNavUserExpand = false;
            setProfileNavOpen(false);
        }
    }
}

function initSidebarCollapse() {
    const sidebar = DOM.sidebar;
    const btn = DOM.sidebarToggle;
    if (!sidebar || !btn) return;
    const collapsed = readSidebarCollapsed();
    if (collapsed) {
        sidebar.classList.add('no-motion');
        setSidebarCollapsed(true, false);
        requestAnimationFrame(() => sidebar.classList.remove('no-motion'));
    } else {
        syncRailCollapsedTools();
    }
    btn.addEventListener('click', () => {
        const next = !sidebar.classList.contains('is-collapsed');
        sidebarViewportForced = false;
        sidebarNarrowUserExpand = window.matchMedia(SIDEBAR_NARROW_MQ).matches && !next;
        setSidebarCollapsed(next);
    });
    const expand = () => {
        sidebarViewportForced = false;
        sidebarNarrowUserExpand = window.matchMedia(SIDEBAR_NARROW_MQ).matches;
        setSidebarCollapsed(false);
    };
    DOM.railMark?.addEventListener('click', expand);
    DOM.railSidebarToggle?.addEventListener('click', expand);
}

initSidebarCollapse();

function initProfileNavCollapse() {
    const btn = DOM.profileNavToggle;
    const scrim = DOM.profileNavScrim;
    const nav = DOM.profileNav;
    if (!btn && !scrim && !nav) return;

    btn?.addEventListener('click', () => {
        if (isProfileStackViewport()) return;
        const next = !DOM.pageChat?.classList.contains('is-profile-nav-open');
        profileNavUserExpand = window.matchMedia(SIDEBAR_NARROW_MQ).matches && next;
        setProfileNavOpen(next);
    });
    scrim?.addEventListener('click', () => {
        profileNavUserExpand = false;
        setProfileNavOpen(false);
    });
    nav?.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (!target.closest('[data-profile-nav]')) return;
        if (isProfileStackViewport()) {
            setProfileDrillLevel('section');
            return;
        }
        if (!window.matchMedia(SIDEBAR_NARROW_MQ).matches) return;
        profileNavUserExpand = false;
        setProfileNavOpen(false);
    });
}

initProfileNavCollapse();

const contactsState = {
    users: [],
    sidebarChats: [],
    myUsername: '',
    activeUsername: null,
    query: '',
    searchMode: false,
    onUserSelect: null
};

function initViewportPanels() {
    const peerMq = window.matchMedia(PEER_NARROW_MQ);
    const sidebarMq = window.matchMedia(SIDEBAR_NARROW_MQ);
    const stackMq = window.matchMedia(APP_STACK_MQ);
    const run = () => syncViewportPanels();
    run();
    if (peerMq.addEventListener) peerMq.addEventListener('change', run);
    else peerMq.addListener?.(run);
    if (sidebarMq.addEventListener) sidebarMq.addEventListener('change', run);
    else sidebarMq.addListener?.(run);
    if (stackMq.addEventListener) stackMq.addEventListener('change', run);
    else stackMq.addListener?.(run);
}

initViewportPanels();

const realtimeContext = {
    onlineUsers: new Set(),
    unreadCounts: {},
    typingUsers: new Set(),
};

let uiPreferences = { linkPreviews: true, showOnlineStatus: true, typingIndicators: true };

export function setUiPreferences(preferences) {
    uiPreferences = getPrivacyFlags(preferences);
    hydrateProfilePrivacy(preferences);
    refreshContactIndicators();
    refreshChatHeaderSubtitle();
    refreshPeerPanel();
}

const PRESENCE_ONLINE = 'is-online';
const PRESENCE_OFFLINE = 'is-offline';
const UNREAD_BADGE = 'contact-unread';

const COMPOSER_DEFAULT_META = 'End-to-end encrypted';
export const MAX_MESSAGE_LENGTH = 2000;
const messageActionHandlers = {
    onDeleteMessage: null,
    onReply: null,
    onReact: null,
    getMyUsername: () => '',
    /** Resolve canonical message record from a row (state is source of truth). */
    resolveMessage: null,
    onActionUnavailable: null,
};

export function setRealtimeContext(ctx = {}) {
    if (ctx.onlineUsers) {
        realtimeContext.onlineUsers = ctx.onlineUsers instanceof Set
            ? ctx.onlineUsers
            : new Set(ctx.onlineUsers);
    }
    if (ctx.unreadCounts) {
        realtimeContext.unreadCounts = { ...ctx.unreadCounts };
    }
    if (ctx.typingUsers) {
        realtimeContext.typingUsers = ctx.typingUsers instanceof Set
            ? ctx.typingUsers
            : new Set(ctx.typingUsers);
    }
    refreshContactIndicators();
    refreshChatHeaderSubtitle();
    refreshPeerPanel();
}

export function updateStatus(status, colorClass) {
    if (!DOM.statusSpan) return;

    const statusIntent = `${status} ${colorClass}`.toLowerCase();
    const isOnline = statusIntent.includes('online') ||
        statusIntent.includes('green') ||
        statusIntent.includes('emerald');
    const isReconnecting = statusIntent.includes('reconnect') ||
        statusIntent.includes('yellow');

    DOM.statusSpan.textContent = '';
    DOM.statusSpan.title = status;
    DOM.statusSpan.setAttribute('aria-label', status);
    DOM.statusSpan.style.color = '';

    if (isReconnecting) {
        DOM.statusSpan.className = 'rail-presence status-offline';
        return;
    }

    DOM.statusSpan.className = isOnline
        ? 'rail-presence status-online'
        : 'rail-presence status-offline';
}

export function setSidebarChats(chats, myUsername, onUserSelect, activeUsername = contactsState.activeUsername) {
    contactsState.sidebarChats = Array.isArray(chats) ? chats : [];
    contactsState.myUsername = myUsername;
    contactsState.onUserSelect = onUserSelect;
    contactsState.activeUsername = activeUsername;
    contactsState.searchMode = false;
    renderFilteredUsers();
}

export function renderUsersList(users, myUsername, onUserSelect, activeUsername = contactsState.activeUsername) {
    contactsState.users = Array.isArray(users) ? users : [];
    contactsState.myUsername = myUsername;
    contactsState.onUserSelect = onUserSelect;
    contactsState.activeUsername = activeUsername;
    contactsState.searchMode = true;
    renderFilteredUsers();
}

export function filterUsers(query) {
    contactsState.query = query.trim().toLowerCase();
    renderFilteredUsers();
}

export function clearUsersList(message = 'No conversations yet') {
    contactsState.users = [];
    contactsState.searchMode = false;
    if (!contactsState.sidebarChats.length) {
        DOM.usersListDiv.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = message;
        DOM.usersListDiv.appendChild(empty);
        syncWelcomeBanner(message !== 'No conversations yet');
        return;
    }
    renderFilteredUsers();
}

export function showContactsLoading(count = 6) {
    if (!DOM.usersListDiv) return;
    DOM.usersListDiv.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
        const row = document.createElement('div');
        row.className = 'contact-skeleton';
        row.setAttribute('aria-hidden', 'true');
        row.innerHTML =
            '<span class="skeleton skeleton-avatar"></span>' +
            '<span class="skeleton-lines">' +
            '<span class="skeleton skeleton-line skeleton-line--name"></span>' +
            '<span class="skeleton skeleton-line skeleton-line--sub"></span>' +
            '</span>';
        fragment.appendChild(row);
    }
    DOM.usersListDiv.appendChild(fragment);
    syncWelcomeBanner(true);
}

export function showChatWelcome() {
    if (!DOM.chatWelcome) return;
    DOM.chatWelcome.classList.remove('hidden');
    DOM.chatWelcome.classList.remove('is-entering');
    void DOM.chatWelcome.offsetWidth;
    DOM.chatWelcome.classList.add('is-entering');
    playEmptyStateIntros();
}

export function activateChatPanel(username) {
    closeOverlaysForChatChange();
    refreshChatHeaderIdentity(username);
    const headerLeft = DOM.chatWithTitle?.closest('.header-left');
    if (headerLeft) {
        headerLeft.classList.remove('hidden');
        headerLeft.setAttribute('aria-hidden', 'false');
    }
    DOM.messageInput.disabled = false;
    DOM.sendBtn.disabled = false;
    setChatToolsEnabled(true);
    setActiveContact(username);
    refreshChatHeaderSubtitle();
    refreshPeerPanel(username);
    autoResizeComposer();
    focusComposer();
    if (isAppStackViewport()) setChatDrillLevel('chat');
    closeContactSearch();
}

export function resetChatPanel() {
    closeOverlaysForChatChange();
    DOM.chatWithTitle.textContent = '';
    if (DOM.chatSubtitle) {
        DOM.chatSubtitle.textContent = '';
        DOM.chatSubtitle.className = 'header-sub';
    }
    if (DOM.chatHeaderAvatar) {
        DOM.chatHeaderAvatar.replaceChildren();
        DOM.chatHeaderAvatar.classList.remove('has-photo');
    }
    const headerLeft = DOM.chatWithTitle?.closest('.header-left');
    if (headerLeft) {
        headerLeft.classList.add('hidden');
        headerLeft.setAttribute('aria-hidden', 'true');
    }
    clearMessageView();
    DOM.messageInput.value = '';
    DOM.messageInput.disabled = true;
    DOM.sendBtn.disabled = true;
    clearPasteAttachments();
    setChatToolsEnabled(false);
    updateComposerMeta('');
    setDraftStatus(COMPOSER_DEFAULT_META);
    closeMessageSearch();
    setActiveContact(null);
    refreshPeerPanel(null);
    if (isAppStackViewport() && chatsViewActive()) setChatDrillLevel('list');
}

export function renderMessagesList(messages) {
    /** Full hydrate — use only on chat switch / initial load. */
    clearMessageView();
    if (!Array.isArray(messages) || !messages.length) return;

    messages.forEach((message, index) => {
        const prev = index > 0 ? messages[index - 1] : null;
        DOM.messagesDiv.appendChild(buildMessageElement(message, prev));
    });
    reconcileMessageRowsWithHistory(messages);
    scrollMessagesToBottom({ force: true });
}

export function clearMessageView() {
    DOM.messagesDiv.innerHTML = '';
}

const SCROLL_NEAR_BOTTOM_PX = 96;

export function isMessagesNearBottom(threshold = SCROLL_NEAR_BOTTOM_PX) {
    const el = DOM.messagesDiv;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

export function scrollMessagesToBottom(options = {}) {
    const { force = false, smooth = false } = typeof options === 'boolean'
        ? { force: options }
        : options;
    if (!force && !isMessagesNearBottom()) return;

    if (smooth) {
        DOM.messagesDiv.scrollTo({
            top: DOM.messagesDiv.scrollHeight,
            behavior: 'smooth',
        });
    } else {
        DOM.messagesDiv.scrollTop = DOM.messagesDiv.scrollHeight;
    }
}

export function findMessageElement({ messageId, clientMessageId } = {}) {
    if (clientMessageId) {
        const byClient = DOM.messagesDiv.querySelector(
            `[data-client-message-id="${CSS.escape(clientMessageId)}"]`
        );
        if (byClient) return byClient;
    }
    if (messageId != null) {
        return DOM.messagesDiv.querySelector(
            `[data-message-id="${CSS.escape(String(messageId))}"]`
        );
    }
    return null;
}

export function messageExistsInView(message) {
    if (!message) return false;
    return Boolean(
        findMessageElement({
            messageId: message.id,
            clientMessageId: message.clientMessageId,
        })
    );
}

export function patchMessageReplyPreview(messageId, replyTo) {
    const row = findMessageElement({ messageId });
    if (!row) return;

    const inner = row.querySelector('.message-bubble-inner');
    if (!inner) return;

    const existing = inner.querySelector('.message-reply-preview');
    if (!replyTo) {
        existing?.remove();
        return;
    }

    const next = buildReplyPreviewEl(replyTo);
    if (!next) return;

    if (existing) {
        existing.replaceWith(next);
    } else {
        inner.prepend(next);
    }
}

/** Reconcile sender labels / grouping classes without rebuilding message bubbles. */
export function patchGroupingFromState(messages) {
    if (!Array.isArray(messages)) return;

    messages.forEach((message, index) => {
        const row = findMessageElement({
            messageId: message.id,
            clientMessageId: message.clientMessageId,
        });
        if (!row) return;

        const prev = index > 0 ? messages[index - 1] : null;
        const isGrouped = isGroupedWithPrevious(message, prev);
        const showSenderName = shouldShowSenderName(message, prev);

        row.classList.toggle('message-row--grouped', isGrouped);

        let nameEl = row.querySelector('.message-sender-label');
        if (showSenderName && message.type !== 'outgoing') {
            if (!nameEl) {
                nameEl = document.createElement('div');
                nameEl.className = 'message-sender-label';
                row.prepend(nameEl);
            }
            nameEl.textContent = message.sender || '';
        } else {
            nameEl?.remove();
        }
    });
}

export function syncAllMessageRowActions() {
    DOM.messagesDiv.querySelectorAll('.message-row').forEach(syncMessageRowActions);
}

/** Align row data-* ids and action affordances with in-memory message records. */
export function reconcileMessageRowsWithHistory(messages) {
    if (!Array.isArray(messages)) return;

    messages.forEach((message) => {
        const row = findMessageElement({
            messageId: message.id,
            clientMessageId: message.clientMessageId,
        });
        if (!row) return;

        if (message.id != null) {
            row.dataset.messageId = String(message.id);
        }
        if (message.clientMessageId) {
            row.dataset.clientMessageId = message.clientMessageId;
        }
        syncMessageRowActions(row);
    });
}

export function appendMessage(messageOrSender, text, type, timestamp = Date.now(), previousMessage = null) {
    const message = typeof messageOrSender === 'object'
        ? messageOrSender
        : { sender: messageOrSender, text, type, timestamp };

    if (messageExistsInView(message)) return;

    if (!previousMessage) {
        const rows = DOM.messagesDiv.querySelectorAll('.message-row');
        const lastRow = rows[rows.length - 1];
        if (lastRow) {
            previousMessage = {
                type: lastRow.dataset.messageType,
                sender: lastRow.dataset.messageSender || '',
            };
        }
    }

    const row = buildMessageElement(message, previousMessage);
    DOM.messagesDiv.appendChild(row);
    reconcileMessageRowsWithHistory([message]);
    scrollMessagesToBottom();
}

function buildReplyPreviewEl(replyTo) {
    if (!replyTo) return null;

    const block = document.createElement('button');
    block.type = 'button';
    block.className = 'message-reply-preview';
    if (replyTo.unavailable) block.classList.add('is-unavailable');

    const author = document.createElement('span');
    author.className = 'message-reply-author';
    author.textContent = replyTo.author || 'Message';

    const preview = document.createElement('span');
    preview.className = 'message-reply-text';
    preview.dataset.rawText = replyTo.preview || '';
    preview.textContent = replyTo.preview || '';

    block.append(author, preview);

    if (!replyTo.unavailable && replyTo.messageId) {
        block.addEventListener('click', (event) => {
            event.stopPropagation();
            scrollToMessageById(replyTo.messageId);
        });
    }

    return block;
}

function buildReactionsEl(message) {
    const reactions = message.reactions || [];
    if (!reactions.length) return null;

    const myUsername = messageActionHandlers.getMyUsername?.() || '';
    const counts = getReactionCounts(reactions);
    const wrap = document.createElement('div');
    wrap.className = 'message-reactions';

    counts.forEach((count, emoji) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'message-reaction-chip';
        if (reactions.some((r) => r.username === myUsername && r.emoji === emoji)) {
            chip.classList.add('is-mine');
        }
        chip.title = 'Toggle reaction';
        chip.dataset.emoji = emoji;

        const emojiSpan = document.createElement('span');
        emojiSpan.textContent = emoji;
        chip.append(emojiSpan);

        if (count > 1) {
            const countEl = document.createElement('span');
            countEl.className = 'message-reaction-count';
            countEl.textContent = String(count);
            chip.append(countEl);
        }

        wrap.append(chip);
    });

    return wrap;
}

function buildMessageElement(message, previousMessage = null) {
    const isOutgoing = message.type === 'outgoing';
    const showSenderName = shouldShowSenderName(message, previousMessage);
    const isGrouped = isGroupedWithPrevious(message, previousMessage);

    const row = document.createElement('div');
    row.className = [
        'message-row group',
        isOutgoing ? 'message-row--own' : 'message-row--other',
        isGrouped ? 'message-row--grouped' : '',
    ].join(' ').trim();
    row.dataset.messageType = message.type;
    row.dataset.messageSender = message.sender || '';

    if (message.id) row.dataset.messageId = String(message.id);
    if (message.clientMessageId) row.dataset.clientMessageId = message.clientMessageId;

    const status = message.status || (message.pending ? 'sending' : (isOutgoing ? 'sent' : undefined));
    if (status) row.dataset.messageStatus = status;
    applyPendingVisual(row, status);

    if (showSenderName) {
        const nameEl = document.createElement('div');
        nameEl.className = 'message-sender-label';
        nameEl.textContent = message.sender;
        row.append(nameEl);
    }

    const contentWrap = document.createElement('div');
    contentWrap.className = 'message-content-wrap';

    const shell = document.createElement('div');
    shell.className = 'message-shell';

    const bubble = document.createElement('div');
    bubble.className = [
        'message-bubble',
        isOutgoing ? 'message-bubble--own' : 'message-bubble--other',
    ].join(' ');

    const inner = document.createElement('div');
    inner.className = 'message-bubble-inner';

    const replyEl = buildReplyPreviewEl(message.replyTo);
    if (replyEl) inner.append(replyEl);

    const bodyRow = document.createElement('div');
    bodyRow.className = 'message-body-row';

    const textEl = document.createElement('span');
    textEl.className = 'message-text';
    textEl.dataset.rawText = message.text || '';
    appendLinkedTextContent(textEl, message.text || '', {
        linkify: true,
        highlight: activeMessageSearchQuery(),
    });

    const meta = document.createElement('span');
    meta.className = 'message-meta';

    const timeEl = document.createElement('span');
    timeEl.className = 'message-time';
    timeEl.textContent = formatMessageTime(new Date(message.timestamp || Date.now()));
    meta.append(timeEl);

    if (isOutgoing) {
        const statusEl = document.createElement('span');
        statusEl.className = 'message-status';
        statusEl.dataset.status = status || 'sent';
        statusEl.textContent = formatMessageStatusIcon(status, false);
        statusEl.title = formatMessageStatusTitle(status, false);
        meta.append(statusEl);
    }

    bodyRow.append(textEl, meta);
    inner.append(bodyRow);

    if (messageContainsLink(message.text)) {
        inner.append(createLinkSecurityNotice());
    }

    bubble.append(inner);

    const hoverActions = document.createElement('div');
    hoverActions.className = 'message-hover-actions';
    hoverActions.setAttribute('role', 'group');
    hoverActions.setAttribute('aria-label', 'Message actions');

    const replyBtn = document.createElement('button');
    replyBtn.type = 'button';
    replyBtn.className = 'message-quick-btn';
    replyBtn.dataset.action = 'reply';
    replyBtn.title = 'Reply';
    replyBtn.textContent = '↩';

    const reactBtn = document.createElement('button');
    reactBtn.type = 'button';
    reactBtn.className = 'message-quick-btn';
    reactBtn.dataset.action = 'react';
    reactBtn.title = 'React';
    reactBtn.textContent = '☺';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'message-action-btn message-action-btn--delete';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.textContent = '×';
    deleteBtn.title = message.id ? 'Delete message' : 'Waiting for sync';

    if (isOutgoing) {
        hoverActions.append(deleteBtn, reactBtn, replyBtn);
    } else {
        hoverActions.append(replyBtn, reactBtn, deleteBtn);
    }

    shell.append(bubble, hoverActions);
    contentWrap.append(shell);

    const reactionsEl = buildReactionsEl(message);
    if (reactionsEl) contentWrap.append(reactionsEl);

    row.append(contentWrap);
    syncMessageRowActions(row);

    return row;
}

function getRowMessageId(row) {
    const id = row?.dataset?.messageId;
    return id != null && id !== '' ? id : null;
}

/** Sync hover-action affordances from row dataset (after ack / sync). */
export function syncMessageRowActions(row) {
    if (!row) return;
    const hasId = getRowMessageId(row) != null;
    row.classList.toggle('is-actions-pending', !hasId);

    row.querySelectorAll('[data-action="reply"], [data-action="react"], [data-action="delete"]').forEach((btn) => {
        btn.removeAttribute('disabled');
        if (hasId) {
            btn.removeAttribute('aria-disabled');
        } else {
            btn.setAttribute('aria-disabled', 'true');
        }

        const action = btn.dataset.action;
        if (action === 'reply') {
            btn.title = hasId ? 'Reply' : 'Waiting for sync';
        } else if (action === 'react') {
            btn.title = hasId ? 'React' : 'Waiting for sync';
        } else if (action === 'delete') {
            btn.title = hasId ? 'Delete message' : 'Waiting for sync';
        }
    });
}

function resolveRowActionContext(row) {
    const message = messageActionHandlers.resolveMessage?.(row) || null;

    if (message?.id != null) {
        const idStr = String(message.id);
        if (row.dataset.messageId !== idStr) {
            row.dataset.messageId = idStr;
            syncMessageRowActions(row);
        }
    }

    return {
        messageId: getRowMessageId(row),
        message,
    };
}

function notifyActionUnavailable(action) {
    messageActionHandlers.onActionUnavailable?.(action);
}

function handleMessageActionsEvent(event) {
    if (event.type === 'click') {
        const link = event.target.closest('.message-link');
        if (link) {
            const href = link.getAttribute('href');
            if (!href || !isSafeWebHref(href)) {
                event.preventDefault();
            }
            return;
        }
    }

    const row = event.target.closest('.message-row');
    if (!row) return;

    if (event.type === 'dblclick') {
        const bubble = event.target.closest('.message-bubble');
        if (!bubble) return;

        const { messageId } = resolveRowActionContext(row);
        if (!messageId) {
            notifyActionUnavailable('react');
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        messageActionHandlers.onReact?.(messageId, null, bubble);
        return;
    }

    if (event.target.closest('[data-action="reply"]')) {
        event.preventDefault();
        event.stopPropagation();

        const { messageId } = resolveRowActionContext(row);
        if (!messageId) {
            notifyActionUnavailable('reply');
            return;
        }
        messageActionHandlers.onReply?.({ id: messageId });
        return;
    }

    if (event.target.closest('[data-action="react"]')) {
        event.preventDefault();
        event.stopPropagation();

        const { messageId } = resolveRowActionContext(row);
        if (!messageId) {
            notifyActionUnavailable('react');
            return;
        }
        const btn = event.target.closest('[data-action="react"]');
        messageActionHandlers.onReact?.(messageId, null, btn);
        return;
    }

    if (event.target.closest('[data-action="delete"]')) {
        event.preventDefault();
        event.stopPropagation();

        const { messageId } = resolveRowActionContext(row);
        if (!messageId) {
            notifyActionUnavailable('delete');
            return;
        }
        messageActionHandlers.onDeleteMessage?.(messageId);
        return;
    }

    const chip = event.target.closest('.message-reaction-chip');
    if (chip?.dataset.emoji) {
        event.preventDefault();
        event.stopPropagation();

        const { messageId } = resolveRowActionContext(row);
        if (!messageId) {
            notifyActionUnavailable('react');
            return;
        }
        messageActionHandlers.onReact?.(messageId, chip.dataset.emoji);
    }
}

let messageActionsInitialized = false;

/** One capture-phase listener on #messages — survives DOM updates, no per-row binding. */
export function initMessageActions() {
    if (messageActionsInitialized || !DOM.messagesDiv) return;
    messageActionsInitialized = true;

    DOM.messagesDiv.addEventListener('click', handleMessageActionsEvent, true);
    DOM.messagesDiv.addEventListener('dblclick', handleMessageActionsEvent, true);
}

export function scrollToMessageById(messageId) {
    if (messageId == null) return;
    const row = DOM.messagesDiv.querySelector(
        `[data-message-id="${CSS.escape(String(messageId))}"]`
    );
    if (!row) return;
    row.classList.add('is-highlighted');
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.setTimeout(() => row.classList.remove('is-highlighted'), 1600);
}

export function patchMessageReactionsDom(messageId, reactions, myUsername) {
    const row = DOM.messagesDiv.querySelector(
        `[data-message-id="${CSS.escape(String(messageId))}"]`
    );
    if (!row) return;

    const host = row.querySelector('.message-content-wrap') || row;
    let wrap = host.querySelector('.message-reactions');
    if (!reactions?.length) {
        wrap?.remove();
        return;
    }

    const fakeMessage = { id: messageId, reactions };
    const next = buildReactionsEl(fakeMessage);
    if (!next) return;

    if (wrap) {
        wrap.replaceWith(next);
    } else {
        host.append(next);
    }
}

export function showComposerReplyBar(pendingReply) {
    if (!DOM.replyBar) return;
    if (!pendingReply) {
        DOM.replyBar.classList.add('hidden');
        return;
    }
    DOM.replyBar.classList.remove('hidden');
    if (DOM.replyLabel) {
        DOM.replyLabel.textContent = `Reply to ${pendingReply.author}`;
    }
    if (DOM.replyPreview) {
        DOM.replyPreview.textContent = pendingReply.preview;
    }
}

export function hideComposerReplyBar() {
    DOM.replyBar?.classList.add('hidden');
}

export function openReactionPicker(anchor, messageId) {
    openPopoverOverlay({
        popoverId: 'reactions',
        anchor,
        targetId: `reactions-${messageId}`,
        payload: { messageId },
    });
}

function shouldShowSenderName(message, previousMessage) {
    if (message.type === 'outgoing') return false;
    if (!previousMessage) return true;
    if (previousMessage.type === 'outgoing') return true;
    return previousMessage.sender !== message.sender;
}

function isGroupedWithPrevious(message, previousMessage) {
    if (!previousMessage) return false;
    if (message.type !== previousMessage.type) return false;
    if (message.type === 'outgoing') return true;
    return previousMessage.sender === message.sender;
}

export function updateMessageIdentity(clientMessageId, id, timestamp, status = 'sent') {
    let msgElement = clientMessageId
        ? DOM.messagesDiv.querySelector(`[data-client-message-id="${CSS.escape(clientMessageId)}"]`)
        : null;
    if (!msgElement && id != null) {
        msgElement = DOM.messagesDiv.querySelector(
            `[data-message-id="${CSS.escape(String(id))}"]`
        );
    }
    if (!msgElement) return;

    msgElement.dataset.messageId = String(id);
    msgElement.dataset.messageStatus = status;
    applyPendingVisual(msgElement, status);
    syncMessageRowActions(msgElement);

    const timeElement = msgElement.querySelector('.message-time');
    if (timeElement && timestamp) {
        timeElement.textContent = formatMessageTime(new Date(timestamp));
    }

    updateMessageStatus(clientMessageId, id, status);
}

export function updateMessageStatus(clientMessageId, messageId, status) {
    const selector = clientMessageId
        ? `[data-client-message-id="${CSS.escape(clientMessageId)}"]`
        : messageId
            ? `[data-message-id="${CSS.escape(String(messageId))}"]`
            : null;
    if (!selector) return;

    const msgElement = DOM.messagesDiv.querySelector(selector);
    if (!msgElement) return;

    msgElement.dataset.messageStatus = status;
    applyPendingVisual(msgElement, status);

    const statusElement = msgElement.querySelector('.message-status');
    if (!statusElement) return;

    statusElement.dataset.status = status;
    statusElement.textContent = formatMessageStatusIcon(status, false);
    statusElement.title = formatMessageStatusTitle(status, false);
}

function applyPendingVisual(row, status) {
    const isPending = status === 'pending' || status === 'sending';
    row.classList.toggle('is-pending', isPending);
}

export function removeMessageElement(messageId) {
    removeMessageFromDom({ messageId });
}

export function removeMessageFromDom({ messageId, clientMessageId } = {}) {
    const el = findMessageElement({ messageId, clientMessageId });
    if (!el) return false;
    el.remove();
    return true;
}

export function setMessageActionHandlers(handlers) {
    messageActionHandlers.onDeleteMessage = handlers.onDeleteMessage || null;
    messageActionHandlers.onReply = handlers.onReply || null;
    messageActionHandlers.onReact = handlers.onReact || null;
    messageActionHandlers.getMyUsername = handlers.getMyUsername || (() => '');
    messageActionHandlers.resolveMessage = handlers.resolveMessage || null;
    messageActionHandlers.onActionUnavailable = handlers.onActionUnavailable || null;
}

export function setComposerValue(text) {
    DOM.messageInput.value = text;
    updateComposerMeta(text);
    autoResizeComposer();
}

export function getComposerValue() {
    return DOM.messageInput.value;
}

export function clearComposer() {
    setComposerValue('');
    clearPasteAttachments();
    autoResizeComposer();
    focusComposer();
}

export function focusComposer() {
    if (!DOM.messageInput.disabled) {
        DOM.messageInput.focus();
    }
}

export function isContactSearchOpen() {
    return Boolean(DOM.pageChat?.classList.contains('is-contact-search-open'));
}

export function openContactSearch() {
    if (!DOM.pageChat || !DOM.contactSearchInput) return;
    DOM.pageChat.classList.add('is-contact-search-open');
    if (DOM.sidebarLabel) DOM.sidebarLabel.textContent = 'Find contacts';
    DOM.contactSearchInput.value = '';
    contactsState.query = '';
    contactsState.searchMode = true;
    contactsState.users = [];
    renderFilteredUsers();
    requestAnimationFrame(() => {
        DOM.contactSearchInput?.focus();
    });
}

export function closeContactSearch() {
    if (!DOM.pageChat) return;
    const wasOpen = isContactSearchOpen();
    DOM.pageChat.classList.remove('is-contact-search-open');
    if (DOM.sidebarLabel) DOM.sidebarLabel.textContent = 'Contacts';
    if (!wasOpen) return;
    if (DOM.contactSearchInput) DOM.contactSearchInput.value = '';
    contactsState.query = '';
    contactsState.searchMode = false;
    contactsState.users = [];
    renderFilteredUsers();
}

export function focusContactSearch() {
    if (isAppStackViewport()) {
        openContactSearch();
        return;
    }
    DOM.contactSearchInput?.focus();
    DOM.contactSearchInput?.select();
}

function initContactSearchSheet() {
    DOM.contactSearchOpenBtn?.addEventListener('click', () => openContactSearch());
    DOM.contactSearchTrigger?.addEventListener('click', () => openContactSearch());
    DOM.contactSearchBackBtn?.addEventListener('click', () => closeContactSearch());
}

initContactSearchSheet();

export function autoResizeComposer() {
    const minHeight = 44;
    const maxHeight = 200;
    const input = DOM.messageInput;
    input.style.height = 'auto';
    const scrollH = input.scrollHeight;
    const nextHeight = Math.min(Math.max(scrollH, minHeight), maxHeight);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = scrollH > maxHeight ? 'auto' : 'hidden';
}

export function updateComposerMeta(text) {
    const length = (text?.length ?? 0) + getPasteAttachmentsLength();
    const over = length > MAX_MESSAGE_LENGTH;
    DOM.charCounter.textContent = over
        ? `${length} / ${MAX_MESSAGE_LENGTH} — limit exceeded`
        : `${length} / ${MAX_MESSAGE_LENGTH}`;
    DOM.charCounter.classList.toggle('danger', over);
    if (DOM.draftStatus?.dataset.limitError === '1' && !over) {
        DOM.draftStatus.dataset.limitError = '0';
        setDraftStatus(
            text.trim() || getPasteAttachmentsLength() > 0
                ? 'Draft saved locally'
                : COMPOSER_DEFAULT_META
        );
    }
}

export function showComposerLimitError(message) {
    DOM.charCounter.classList.add('danger');
    DOM.charCounter.textContent = message;
    if (DOM.draftStatus) {
        DOM.draftStatus.dataset.limitError = '1';
        DOM.draftStatus.textContent = message;
        DOM.draftStatus.classList.add('danger');
        DOM.draftStatus.classList.remove('hidden');
    }
}

export function clearComposerLimitError() {
    if (DOM.draftStatus?.dataset.limitError === '1') {
        DOM.draftStatus.dataset.limitError = '0';
        DOM.draftStatus.classList.remove('danger');
        DOM.draftStatus.classList.add('hidden');
        DOM.draftStatus.textContent = '';
    }
}

export function setDraftStatus(text = COMPOSER_DEFAULT_META) {
    if (!DOM.draftStatus) return;
    const isError = DOM.draftStatus.classList.contains('danger') || DOM.draftStatus.dataset.limitError === '1';
    DOM.draftStatus.textContent = text;
    // Hide routine draft/status copy — only keep error states visible
    const keepVisible = isError && text && text !== COMPOSER_DEFAULT_META;
    DOM.draftStatus.classList.toggle('hidden', !keepVisible);
}

export function insertAtCursor(text) {
    if (DOM.messageInput.disabled) return;

    const input = DOM.messageInput;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;

    input.value = `${input.value.slice(0, start)}${text}${input.value.slice(end)}`;
    const cursor = start + text.length;
    input.setSelectionRange(cursor, cursor);
    autoResizeComposer();
    updateComposerMeta(input.value);
    focusComposer();
}

function openMenuDropdown(menuId, anchor, targetId) {
    if (!anchor) return;
    openDropdown({
        menuId,
        anchor,
        targetId,
    });
}

export function openChatMenu(event) {
    event?.stopPropagation();
    openMenuDropdown('chat-header', DOM.chatMenuBtn, 'chat-header');
}

export function openComposerMenu(event) {
    event?.stopPropagation();
    openMenuDropdown('composer', DOM.composerMenuBtn, 'composer');
}

export function openSettingsMenu(event) {
    event?.stopPropagation();
    openMenuDropdown('settings', DOM.settingsBtn, 'settings');
}

export function closeAllPopovers() {
    closeOverlay();
    closeEmojiPicker();
}

export function openMessageSearch() {
    const root = DOM.messageSearch;
    const input = DOM.messageSearchInput;
    const btn = DOM.chatSearchBtn;
    if (!root || !input || btn?.disabled) return;
    root.classList.add('is-open');
    const bar = root.querySelector('.expand-search__bar');
    if (bar) bar.setAttribute('aria-hidden', 'false');
    if (btn) {
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-label', 'Close search');
        btn.setAttribute('title', 'Close search');
    }
    input.tabIndex = 0;
    window.setTimeout(() => input.focus(), 120);
    searchMessages(input.value);
}

export function closeMessageSearch() {
    const root = DOM.messageSearch;
    const input = DOM.messageSearchInput;
    const btn = DOM.chatSearchBtn;
    if (input) {
        input.value = '';
        input.tabIndex = -1;
        input.blur();
    }
    searchMessages('');
    if (!root) return;
    root.classList.remove('is-open');
    const bar = root.querySelector('.expand-search__bar');
    if (bar) bar.setAttribute('aria-hidden', 'true');
    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', 'Search messages');
        btn.setAttribute('title', 'Search messages');
    }
}

export function toggleMessageSearch() {
    if (DOM.messageSearch?.classList.contains('is-open')) closeMessageSearch();
    else openMessageSearch();
}

function activeMessageSearchQuery() {
    if (!DOM.messageSearch?.classList.contains('is-open')) return '';
    return (DOM.messageSearchInput?.value || '').trim();
}

function paintSearchHighlights(root, query) {
    if (!root) return;
    const needle = (query || '').trim();
    root.querySelectorAll('.message-text, .message-reply-text').forEach((el) => {
        const raw = el.dataset.rawText ?? el.textContent ?? '';
        el.replaceChildren();
        appendLinkedTextContent(el, raw, {
            linkify: !el.classList.contains('message-reply-text'),
            highlight: needle,
        });
    });
}

export function searchMessages(query) {
    const needle = (query || '').trim();
    const normalized = needle.toLowerCase();
    const bubbles = [...(DOM.messagesDiv?.querySelectorAll('.message-row') || [])];
    let matches = 0;

    bubbles.forEach((row) => {
        const textEl = row.querySelector('.message-text');
        const replyEl = row.querySelector('.message-reply-text');
        const raw = `${textEl?.dataset.rawText || ''} ${replyEl?.dataset.rawText || ''}`;
        const isMatch = !normalized || raw.toLowerCase().includes(normalized);
        row.classList.toggle('is-search-hidden', Boolean(normalized && !isMatch));
        row.classList.toggle('is-search-match', Boolean(normalized && isMatch));
        if (normalized && isMatch) matches += 1;
    });

    paintSearchHighlights(DOM.messagesDiv, needle);

    if (DOM.messageSearchCount) {
        DOM.messageSearchCount.textContent = normalized ? `${matches}` : '';
        DOM.messageSearchCount.hidden = !normalized;
    }
}

document.addEventListener('mousedown', (event) => {
    const root = DOM.messageSearch;
    if (!root?.classList.contains('is-open')) return;
    if (root.contains(event.target)) return;
    if (DOM.messageSearchInput?.value.trim()) return;
    closeMessageSearch();
});

export function openSettings() {
    openModalOverlay('settings', 'settings');
}

export function showChatsView() {
    setAppView('chats');
    if (isAppStackViewport()) setChatDrillLevel('list');
}

export function openProfile(section = 'identity') {
    closeOverlay();
    setAppView('identity');
    queueProfilePanelRefresh(section);
    if (isProfileStackViewport()) {
        setProfileDrillLevel('nav');
    }
}

function setAppView(view) {
    const isChats = view === 'chats';
    const isIdentity = view === 'identity';

    if (DOM.chatWorkspace) {
        DOM.chatWorkspace.hidden = !isChats;
        DOM.chatWorkspace.setAttribute('aria-hidden', isChats ? 'false' : 'true');
    }
    if (DOM.profilePanel) {
        DOM.profilePanel.classList.toggle('hidden', !isIdentity);
        DOM.profilePanel.setAttribute('aria-hidden', isIdentity ? 'false' : 'true');
    }
    if (!isIdentity) onProfilePanelClose();

    const railMap = {
        chats: DOM.railChats,
        identity: DOM.railProfile,
    };
    [DOM.railChats, DOM.railProfile].forEach((btn) => {
        if (!btn) return;
        const on = btn === railMap[view];
        btn.classList.toggle('is-active', on);
        if (on) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
    });

    syncRailCollapsedTools();

    if (!isIdentity) {
        setProfileDrillLevel(null);
        syncProfileNavScrim();
        if (isChats && isAppStackViewport()) {
            syncChatStackLevel();
        } else if (!isChats) {
            setChatDrillLevel(null);
            closeContactSearch();
        }
        return;
    }

    closeContactSearch();
    if (isProfileStackViewport()) {
        profileNavUserExpand = false;
        setProfileNavOpen(false);
        setChatDrillLevel(null);
        if (
            !DOM.pageChat?.classList.contains('is-profile-level-nav')
            && !DOM.pageChat?.classList.contains('is-profile-level-section')
        ) {
            setProfileDrillLevel('nav');
        }
    } else if (window.matchMedia(SIDEBAR_NARROW_MQ).matches) {
        profileNavUserExpand = false;
        setProfileNavOpen(false);
        setProfileDrillLevel(null);
        setChatDrillLevel(null);
    } else {
        setProfileDrillLevel(null);
        setChatDrillLevel(null);
        syncProfileNavScrim();
    }
}

export function openShortcuts() {
    openModalOverlay('shortcuts', 'shortcuts');
}

export function closeModals() {
    closeOverlay();
}

export function closeTransientUi() {
    closeOverlay();
    closeEmojiPicker();
}

export function openChatInfoPopover(partner, online, publicKeyJwk = null, extra = {}) {
    openPopoverOverlay({
        popoverId: 'chat-info',
        anchor: DOM.chatMenuBtn,
        targetId: 'chat-info',
        payload: { partner, online, publicKeyJwk, ...extra },
    });
}

export function initMessageContextMenu(getContextPayload) {
    DOM.messagesDiv.addEventListener('contextmenu', (event) => {
        const row = event.target.closest('.message-row');
        if (!row) return;
        event.preventDefault();

        const payload = getContextPayload(row);
        if (!payload) return;

        openContextMenu({
            x: event.clientX,
            y: event.clientY,
            payload,
            targetId: payload.clientMessageId || payload.messageId || 'message',
        });
    });
}

export function highlightMessageRow(targetId) {
    DOM.messagesDiv.querySelectorAll('.message-row.is-highlighted').forEach((el) => {
        el.classList.remove('is-highlighted');
    });
    if (!targetId) return;
    const row =
        DOM.messagesDiv.querySelector(`[data-message-id="${CSS.escape(String(targetId))}"]`) ||
        DOM.messagesDiv.querySelector(`[data-client-message-id="${CSS.escape(String(targetId))}"]`);
    row?.classList.add('is-highlighted');
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast is-${type}`;
    toast.textContent = message;
    DOM.toastRegion.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3200);
}

export function setPreferenceControls(preferences) {
    DOM.prefEnterSend.checked = preferences.enterToSend;
    DOM.prefCompactMode.checked = preferences.compactMode;
    DOM.prefShowTimestamps.checked = preferences.showTimestamps;

    syncPickerActive(DOM.glassPicker, 'data-glass-value', preferences.glassIntensity || 'medium');
    setUiPreferences(preferences);
}

function syncPickerActive(container, attr, value) {
    if (!container) return;
    container.querySelectorAll(`[${attr}]`).forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute(attr) === value);
    });
}

/** Single entry point for profile: nav rail profile button. */
export function updateProfileRailButton(username) {
    if (!DOM.profileBtn) return;
    if (!username) {
        DOM.profileBtn.title = 'Profile settings';
        DOM.profileBtn.setAttribute('aria-label', 'Profile settings');
        return;
    }
    const profile = loadProfile(username);
    const label = getDisplayLabel(username, profile);
    DOM.profileBtn.title = `${label} (@${username})`;
    DOM.profileBtn.setAttribute('aria-label', `Profile: ${label}`);
}

export function setChatToolsEnabled(isEnabled) {
    [
        DOM.chatSearchBtn,
        DOM.scrollBottomBtn,
        DOM.chatMenuBtn,
        DOM.composerMenuBtn,
        DOM.attachBtn,
        DOM.emojiBtn,
        DOM.clearComposerBtn,
    ].forEach((control) => {
        if (control) control.disabled = !isEnabled;
    });
    if (!isEnabled) closeEmojiPicker();
    // Re-render paste cards so open/remove buttons match disabled state
    if (DOM.pasteAttachments && !DOM.pasteAttachments.classList.contains('hidden')) {
        DOM.pasteAttachments.querySelectorAll('button').forEach((btn) => {
            btn.disabled = !isEnabled;
        });
    }
}

export function closeEmojiPicker() {
    if (!DOM.emojiPicker) return;
    DOM.emojiPicker.classList.add('hidden');
    DOM.emojiBtn?.setAttribute('aria-expanded', 'false');
}

export function toggleEmojiPicker() {
    if (!DOM.emojiPicker || !DOM.emojiBtn || DOM.emojiBtn.disabled) return;
    const open = DOM.emojiPicker.classList.contains('hidden');
    DOM.emojiPicker.classList.toggle('hidden', !open);
    DOM.emojiBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

export function refreshContactList() {
    renderFilteredUsers();
}

function restartEntering(el) {
    if (!el) return;
    el.classList.remove('is-entering');
    void el.offsetWidth;
    el.classList.add('is-entering');
}

function playEmptyStateIntros() {
    const banner = document.getElementById('uiWelcomeBanner');
    if (banner && !banner.classList.contains('hidden')) restartEntering(banner);
    if (DOM.peerPanel?.classList.contains('is-empty')) restartEntering(DOM.peerEmpty);
}

function syncWelcomeBanner(forceHide = false) {
    const banner = document.getElementById('uiWelcomeBanner');
    if (!banner) return;
    const show = !forceHide
        && !contactsState.searchMode
        && !contactsState.query
        && contactsState.sidebarChats.length === 0;
    const wasHidden = banner.classList.contains('hidden');
    banner.classList.toggle('hidden', !show);
    if (show && wasHidden) restartEntering(banner);
    if (!show) banner.classList.remove('is-entering');
}

function renderFilteredUsers() {
    DOM.usersListDiv.innerHTML = '';

    const sourceUsers = contactsState.searchMode
        ? contactsState.users
        : contactsState.sidebarChats;

    const visibleUsers = sourceUsers.filter(user => {
        if (user.username === contactsState.myUsername) return false;
        if (!contactsState.query) return true;
        const q = contactsState.query;
        const profile = resolveContactProfile(user.username, user, contactsState.myUsername);
        const label = getDisplayLabel(user.username, profile).toLowerCase();
        return user.username.toLowerCase().includes(q) || label.includes(q);
    });

    if (!visibleUsers.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        if (contactsState.searchMode) {
            empty.textContent = contactsState.query ? 'No matching contacts' : 'Type at least 2 characters';
        } else if (contactsState.query) {
            empty.textContent = 'No matching conversations';
        } else {
            empty.textContent = 'No conversations yet';
        }
        DOM.usersListDiv.appendChild(empty);
        syncWelcomeBanner();
        return;
    }

    visibleUsers.forEach(user => {
        const profile = resolveContactProfile(user.username, user, contactsState.myUsername);
        const label = getDisplayLabel(user.username, profile);
        const hasDisplayName = Boolean(profile.displayName?.trim());

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'contact-row';
        btn.dataset.username = user.username;
        btn.setAttribute('aria-label', `Open chat with ${label}`);

        const avatar = document.createElement('div');
        avatar.className = 'contact-avatar';
        applyContactAvatar(avatar, user.username, profile);

        const meta = document.createElement('div');
        meta.className = 'contact-meta';

        const nameRow = document.createElement('div');
        nameRow.className = 'contact-name-row';

        const name = document.createElement('div');
        name.className = `contact-name${hasDisplayName ? ' has-display-name' : ''}`;
        name.textContent = label;

        nameRow.append(name);
        if (hasDisplayName) {
            const handle = document.createElement('span');
            handle.className = 'contact-handle';
            handle.textContent = `@${user.username}`;
            nameRow.appendChild(handle);
        }

        const time = document.createElement('span');
        time.className = 'contact-time';
        time.dataset.contactTime = 'true';
        applyContactTime(time, user);
        nameRow.appendChild(time);

        const previewRow = document.createElement('div');
        previewRow.className = 'contact-preview-row';

        const subtitle = document.createElement('div');
        subtitle.className = 'contact-subtitle';
        subtitle.dataset.contactSubtitle = 'true';
        applyContactSubtitle(subtitle, user.username, user);

        const presence = document.createElement('div');
        presence.className = `contact-presence ${getPresenceClasses(user.username)}`;
        presence.dataset.presenceDot = 'true';
        presence.setAttribute('aria-hidden', 'true');

        previewRow.append(subtitle, presence);
        meta.append(nameRow, previewRow);

        btn.append(avatar, meta);

        const unreadCount = realtimeContext.unreadCounts[user.username] ?? user.unread_count ?? 0;
        if (unreadCount > 0 && user.username !== contactsState.activeUsername) {
            const badge = document.createElement('span');
            badge.dataset.unreadBadge = 'true';
            badge.className = UNREAD_BADGE;
            badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            btn.append(badge);
        }
        btn.onclick = () => contactsState.onUserSelect?.(user.username);
        DOM.usersListDiv.appendChild(btn);
    });

    setActiveContact(contactsState.activeUsername);
    syncWelcomeBanner();
}

function formatSidebarTime(isoValue) {
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function truncateSidebarPreview(text, maxLen = 42) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    if (clean.length <= maxLen) return clean;
    return `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}

function applyContactTime(timeEl, userHint = null) {
    const user = userHint || null;
    const stamp = user?.last_message_at;
    timeEl.textContent = stamp ? formatSidebarTime(stamp) : '';
    timeEl.hidden = !timeEl.textContent;
}

function applyContactSubtitle(subtitleEl, username, userHint = null) {
    if (contactsState.myUsername && isChatMuted(contactsState.myUsername, username)) {
        subtitleEl.textContent = 'Muted';
        subtitleEl.className = 'contact-subtitle is-muted';
        return;
    }

    if (uiPreferences.typingIndicators && realtimeContext.typingUsers.has(username)) {
        subtitleEl.innerHTML = buildTypingDotsHtml();
        subtitleEl.className = 'contact-subtitle is-typing';
        return;
    }

    const user = userHint || findContactUser(username);
    const preview = truncateSidebarPreview(user?.last_message_preview);
    subtitleEl.textContent = preview || 'Secure channel';
    subtitleEl.className = 'contact-subtitle';
}

function setActiveContact(username) {
    contactsState.activeUsername = username;

    DOM.usersListDiv.querySelectorAll('.contact-row').forEach(button => {
        const isActive = button.dataset.username === username;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
}

function formatMessageTime(date) {
    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getPresenceClasses(username) {
    if (!uiPreferences.showOnlineStatus) return 'presence-neutral';
    return realtimeContext.onlineUsers.has(username) ? PRESENCE_ONLINE : PRESENCE_OFFLINE;
}

function findContactUser(username) {
    return contactsState.sidebarChats.find(chat => chat.username === username)
        || contactsState.users.find(chat => chat.username === username);
}

function buildTypingDotsHtml() {
    return `<span class="typing-dots" aria-label="Typing"><span></span><span></span><span></span></span>`;
}

function refreshContactIndicators() {
    DOM.usersListDiv.querySelectorAll('.contact-row').forEach(row => {
        const username = row.dataset.username;
        if (!username) return;

        const presence = row.querySelector('[data-presence-dot]');
        if (presence) {
            presence.className = `contact-presence ${getPresenceClasses(username)}`;
        }

        const time = row.querySelector('[data-contact-time]');
        if (time) {
            applyContactTime(time, findContactUser(username));
        }

        const subtitle = row.querySelector('[data-contact-subtitle]');
        if (subtitle) {
            applyContactSubtitle(subtitle, username);
        }

        let badge = row.querySelector('[data-unread-badge]');
        const unread = realtimeContext.unreadCounts[username] ?? 0;
        const showBadge = unread > 0 && username !== contactsState.activeUsername;

        if (showBadge) {
            if (!badge) {
                badge = document.createElement('span');
                badge.dataset.unreadBadge = 'true';
                row.append(badge);
            }
            badge.className = UNREAD_BADGE;
            badge.textContent = unread > 99 ? '99+' : String(unread);
        } else if (badge) {
            badge.remove();
        }
    });
}

function refreshChatHeaderIdentity(username) {
    if (!username) return;
    const sidebarUser = contactsState.sidebarChats.find((u) => u.username === username);
    const profile = resolveContactProfile(username, sidebarUser, contactsState.myUsername);
    const label = getDisplayLabel(username, profile);
    DOM.chatWithTitle.textContent = label;
    if (DOM.chatHeaderAvatar) {
        applyContactAvatar(DOM.chatHeaderAvatar, username, profile);
    }
}

function refreshPeerPanel(username = contactsState.activeUsername) {
    const panel = DOM.peerPanel;
    if (!panel) return;

    const active = username || null;
    const empty = !active;
    const becameEmpty = empty && !panel.classList.contains('is-empty');
    panel.classList.toggle('is-empty', empty);
    if (DOM.peerBody) DOM.peerBody.hidden = empty;
    if (DOM.peerEmpty) DOM.peerEmpty.hidden = !empty;
    if (becameEmpty) restartEntering(DOM.peerEmpty);

    [DOM.peerMuteBtn, DOM.peerClearBtn, DOM.peerDeleteBtn, DOM.peerSecurityBtn].forEach((btn) => {
        if (btn) btn.disabled = empty;
    });

    if (empty) {
        if (DOM.peerName) DOM.peerName.textContent = '';
        if (DOM.peerHandle) DOM.peerHandle.textContent = '';
        if (DOM.peerBio) DOM.peerBio.textContent = '';
        if (DOM.peerEncryptCopy) {
            DOM.peerEncryptCopy.textContent = 'Messages are end-to-end encrypted.';
        }
        if (DOM.peerStatus) {
            DOM.peerStatus.textContent = '';
            DOM.peerStatus.className = 'peer-status';
        }
        if (DOM.peerAvatar) {
            DOM.peerAvatar.replaceChildren();
            DOM.peerAvatar.classList.remove('has-photo');
        }
        return;
    }

    const sidebarUser = contactsState.sidebarChats.find((u) => u.username === active);
    const profile = resolveContactProfile(active, sidebarUser, contactsState.myUsername);
    const label = getDisplayLabel(active, profile);

    if (DOM.peerAvatar) applyContactAvatar(DOM.peerAvatar, active, profile);
    if (DOM.peerName) DOM.peerName.textContent = label;
    if (DOM.peerHandle) DOM.peerHandle.textContent = `@${active}`;

    if (DOM.peerBio) {
        const bioText = profile.bio?.trim();
        DOM.peerBio.textContent = bioText || 'No bio yet';
        DOM.peerBio.classList.toggle('is-placeholder', !bioText);
    }

    if (DOM.peerEncryptCopy) {
        DOM.peerEncryptCopy.textContent =
            `Messages are end-to-end encrypted. Only you and ${label} can read them.`;
    }

    if (!DOM.peerStatus) return;

    if (uiPreferences.typingIndicators && realtimeContext.typingUsers.has(active)) {
        DOM.peerStatus.textContent = 'typing…';
        DOM.peerStatus.className = 'peer-status is-typing';
        return;
    }

    if (!uiPreferences.showOnlineStatus) {
        DOM.peerStatus.textContent = '';
        DOM.peerStatus.className = 'peer-status is-hidden';
        return;
    }

    const online = realtimeContext.onlineUsers.has(active);
    DOM.peerStatus.textContent = online ? 'Online' : 'Offline';
    DOM.peerStatus.className = `peer-status ${online ? 'is-online' : 'is-offline'}`;
}

function refreshChatHeaderSubtitle() {
    if (!DOM.chatSubtitle) return;

    const partner = contactsState.activeUsername;
    if (!partner) {
        DOM.chatSubtitle.textContent = '';
        DOM.chatSubtitle.className = 'header-sub';
        return;
    }

    if (uiPreferences.typingIndicators && realtimeContext.typingUsers.has(partner)) {
        DOM.chatSubtitle.innerHTML = `<span class="presence-badge presence-badge--typing">
            <span>typing</span>${buildTypingDotsHtml()}
        </span>`;
        DOM.chatSubtitle.className = 'header-sub';
        return;
    }

    if (!uiPreferences.showOnlineStatus) {
        DOM.chatSubtitle.textContent = 'End-to-end encrypted';
        DOM.chatSubtitle.className = 'header-sub';
        return;
    }

    const online = realtimeContext.onlineUsers.has(partner);
    DOM.chatSubtitle.innerHTML = online
        ? '<span class="presence-badge presence-badge--online">Online</span>'
        : '<span class="presence-badge presence-badge--offline">Offline</span>';
    DOM.chatSubtitle.className = 'header-sub';
}

function formatMessageStatusIcon(status) {
    if (status === 'pending' || status === 'sending') return '◔';
    if (status === 'failed') return '!';
    if (status === 'read') return '✓✓';
    if (status === 'delivered') return '✓✓';
    if (status === 'sent') return '✓';
    return '';
}

function formatMessageStatusTitle(status) {
    if (status === 'pending' || status === 'sending') return 'Sending';
    if (status === 'failed') return 'Failed';
    if (status === 'read') return 'Read';
    if (status === 'delivered') return 'Delivered';
    if (status === 'sent') return 'Sent to server';
    return '';
}

