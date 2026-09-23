import {
    closeOverlay,
    closeOverlaysForChatChange,
    getOverlayState,
    openContextMenu,
    openDropdown,
    openMessageActionsDrawer,
    openModalOverlay,
    openPopoverOverlay,
} from '../ui/overlays/overlayManager.js';
import { DEFAULT_QUICK_REACTION, getMyReaction, getReactionCounts } from './messageReactions.js';
import {
    appendLinkedTextContent,
    handleExternalLinkClick,
} from './messageLinks.js';
import { hydrateAppearanceControls, hydrateProfilePrivacy, onProfilePanelClose, queueProfilePanelRefresh } from './profileSettings.js';
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

const DOM_IDS = {
    pageStart: 'page-start',
    pageLogin: 'page-login',
    pageChat: 'page-chat',
    pageAboutSecurity: 'page-about-security',

    usernameInput: 'usernameInput',
    passwordInput: 'passwordInput',
    btnLogin: 'btnLogin',
    btnRegister: 'btnRegister',
    btnForgotPassword: 'btnForgotPassword',
    btnAuthApple: 'btnAuthApple',
    btnAuthGoogle: 'btnAuthGoogle',
    authError: 'authError',

    statusSpan: 'status',
    messagesDiv: 'messages',
    messageInput: 'messageInput',
    sendBtn: 'sendBtn',
    usersListDiv: 'usersList',
    chatWithTitle: 'chatWithTitle',
    chatHeaderAvatar: 'chatHeaderAvatar',
    chatWelcome: 'chat-welcome',

    focusContactsBtn: 'uiFocusContactsBtn',
    focusComposerBtn: 'uiFocusComposerBtn',
    shortcutsBtn: 'uiShortcutsBtn',
    profileBtn: 'uiRailProfile',
    settingsBtn: 'uiSettingsBtn',
    copyUsernameBtn: 'uiCopyUsernameBtn',

    chatSearchBtn: 'uiChatSearchBtn',
    scrollBottomBtn: 'uiScrollBottomBtn',
    chatMenuBtn: 'uiChatMenuBtn',

    messageSearch: 'uiMessageSearch',
    messageSearchInput: 'uiMessageSearchInput',
    messageSearchCount: 'uiMessageSearchCount',

    attachBtn: 'uiAttachBtn',
    fileInput: 'uiFileInput',
    composerMenuBtn: 'uiComposerMenuBtn',
    emojiBtn: 'uiEmojiBtn',
    emojiPicker: 'uiEmojiPicker',
    pasteAttachments: 'uiPasteAttachments',
    pasteEditor: 'uiPasteEditor',
    pasteEditorTitle: 'uiPasteEditorTitle',
    pasteEditorCount: 'uiPasteEditorCount',
    pasteEditorText: 'uiPasteEditorText',
    pasteEditorSave: 'uiPasteEditorSave',
    pasteEditorRemove: 'uiPasteEditorRemove',
    pasteEditorClose: 'uiPasteEditorClose',
    replyBar: 'uiReplyBar',
    replyLabel: 'uiReplyLabel',
    replyPreview: 'uiReplyPreview',
    replyCloseBtn: 'uiReplyCloseBtn',
    draftStatus: 'uiDraftStatus',
    charCounter: 'uiCharCounter',

    settingsPanel: 'uiSettingsPanel',
    closeSettingsBtn: 'uiCloseSettingsBtn',
    prefEnterSend: 'uiPrefEnterSend',
    prefCompactMode: 'uiPrefCompactMode',
    prefShowTimestamps: 'uiPrefShowTimestamps',
    prefMessageNotifications: 'uiPrefMessageNotifications',
    prefMessagePreview: 'uiPrefMessagePreview',
    prefMessageSound: 'uiPrefMessageSound',
    glassSlider: 'uiGlassSlider',
    settingsGlassValue: 'uiSettingsGlassValue',

    profilePanel: 'uiProfilePanel',
    profileNav: 'uiProfileNav',
    profileNavToggle: 'uiProfileNavToggle',
    profileNavScrim: 'uiProfileNavScrim',
    profileNavBackBtn: 'uiProfileNavBackBtn',
    profileBackBtn: 'uiProfileBackBtn',
    closeProfileBtn: 'uiCloseProfileBtn',

    shortcutsPanel: 'uiShortcutsPanel',
    closeShortcutsBtn: 'uiCloseShortcutsBtn',
    toastRegion: 'uiToastRegion',

    chatWorkspace: 'uiChatWorkspace',
    chatBackBtn: 'uiChatBackBtn',
    sidebar: 'uiSidebar',
    sidebarToggle: 'uiSidebarToggle',
    railCollapsedTools: 'uiRailCollapsedTools',
    railMark: 'uiRailMark',
    railSidebarToggle: 'uiRailSidebarToggle',
    railChats: 'uiRailChats',
    railProfile: 'uiRailProfile',
    dockSettings: 'uiDockSettings',
    dockNewChat: 'uiDockNewChat',

    peerPanel: 'uiPeerPanel',
    peerPanelToggle: 'uiPeerPanelToggle',
    peerPanelScrim: 'uiPeerPanelScrim',
    peerEmpty: 'uiPeerEmpty',
    peerBody: 'uiPeerBody',
    peerAvatar: 'uiPeerAvatar',
    peerName: 'uiPeerName',
    peerHandle: 'uiPeerHandle',
    peerStatus: 'uiPeerStatus',
    peerBio: 'uiPeerBio',
    peerEncryptCopy: 'uiPeerEncryptCopy',
    peerSecurityBtn: 'uiPeerSecurityBtn',
    peerMuteBtn: 'uiPeerMuteBtn',
    peerClearBtn: 'uiPeerClearBtn',
    peerDeleteBtn: 'uiPeerDeleteBtn',
};

const CHAT_DOM_KEYS = new Set([
    'statusSpan', 'messagesDiv', 'messageInput', 'sendBtn', 'usersListDiv',
    'chatWithTitle', 'chatHeaderAvatar', 'chatWelcome',
    'focusContactsBtn', 'focusComposerBtn', 'shortcutsBtn', 'profileBtn',
    'settingsBtn', 'copyUsernameBtn',
    'chatSearchBtn', 'scrollBottomBtn',
    'messageSearch', 'messageSearchInput', 'messageSearchCount',
    'attachBtn', 'fileInput', 'composerMenuBtn', 'emojiBtn', 'emojiPicker',
    'pasteAttachments', 'replyBar', 'replyLabel', 'replyPreview', 'replyCloseBtn',
    'draftStatus', 'charCounter',
    'profileNav', 'profileNavBackBtn',
    'chatWorkspace', 'chatBackBtn', 'sidebar', 'sidebarToggle',
    'railCollapsedTools', 'railMark', 'railSidebarToggle', 'railChats',
    'railProfile', 'dockSettings', 'dockNewChat',
    'peerPanel', 'peerPanelToggle', 'peerPanelScrim', 'peerEmpty', 'peerBody',
    'peerAvatar', 'peerName', 'peerHandle', 'peerStatus', 'peerBio',
    'peerEncryptCopy', 'peerSecurityBtn', 'peerMuteBtn', 'peerClearBtn', 'peerDeleteBtn',
]);

export const DOM = {};

let sidebarRenderer = 'dom';
let chatChromeBound = false;
let asideChromeDelegated = false;

export function setSidebarRenderer(mode) {
    sidebarRenderer = mode === 'react' ? 'react' : 'dom';
}

export function bindChatDom(root = document, { requireChat = false } = {}) {
    const scope = root && typeof root.getElementById === 'function' ? root : document;
    const lookup = (id) => document.getElementById(id) || (scope !== document ? scope.querySelector?.(`#${id}`) : null);
    const missing = [];
    for (const [key, id] of Object.entries(DOM_IDS)) {
        const el = lookup(id);
        DOM[key] = el;
        const optional = key.startsWith('btn')
            || key.startsWith('pref')
            || key === 'glassSlider'
            || key === 'settingsGlassValue'
            || key === 'chatMenuBtn';
        if (!el && !optional && (requireChat || !CHAT_DOM_KEYS.has(key))) {
            missing.push(key);
        }
    }
    if (missing.length && (requireChat || missing.some((key) => !CHAT_DOM_KEYS.has(key)))) {
        const fatal = missing.filter((key) => requireChat || !CHAT_DOM_KEYS.has(key));
        if (fatal.length) throw new Error(`Missing required UI elements: ${fatal.join(', ')}`);
    }
    return DOM;
}

export function rebindChatDom(root = document) {
    return bindChatDom(root, { requireChat: true });
}

function initChatChromeOnce() {
    if (chatChromeBound) return;
    // Soft-bind: rebind may miss optional chrome after remounts; still wire toggles.
    try {
        rebindChatDom(DOM.pageChat || document);
    } catch (err) {
        console.warn('bindChatDom soft failure:', err);
    }
    if (!DOM.messagesDiv && !document.getElementById('messages')) return;
    if (!DOM.sidebar && !document.getElementById('uiSidebar')) return;
    chatChromeBound = true;
    ensureChromeFrost();
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
    initPeerPanelCollapse();
    initSidebarCollapse();
    initProfileNavCollapse();
    initViewportPanels();
    initContactSearchSheet();
}

export function bindChatChrome(root = document) {
    try {
        rebindChatDom(root);
    } catch (err) {
        console.warn('rebindChatDom failed:', err);
        bindChatDom(root, { requireChat: false });
    }
    initChatChromeOnce();
}

export function resetChatChromeBind() {
    chatChromeBound = false;
    asideChromeDelegated = false;
}

bindChatDom(document, { requireChat: false });

const PEER_PANEL_COLLAPSED_KEY = 'nexa_peer_panel_collapsed_v3';
const PEER_NARROW_MQ = '(max-width: 760px)';
const PEER_COLLAPSE_MQ = '(max-width: 1120px)';
const SIDEBAR_NARROW_MQ = '(max-width: 1320px)';
const PROFILE_STACK_MQ = '(max-width: 760px)';
const APP_STACK_MQ = PROFILE_STACK_MQ;

function isAppStackViewport() {
    return window.matchMedia(APP_STACK_MQ).matches;
}

function isProfileStackViewport() {
    return isAppStackViewport();
}

function isPeerCollapseViewport() {
    return window.matchMedia(PEER_COLLAPSE_MQ).matches;
}

function isSidebarNarrowViewport() {
    return window.matchMedia(SIDEBAR_NARROW_MQ).matches;
}

function readPeerPanelCollapsed() {
    try {
        return localStorage.getItem(PEER_PANEL_COLLAPSED_KEY) === '1';
    } catch {
        return false;
    }
}

function setPeerPanelCollapsed(collapsed, persist = true) {
    const panel = document.getElementById('uiPeerPanel') || DOM.peerPanel;
    const btn = document.getElementById('uiPeerPanelToggle') || DOM.peerPanelToggle;
    if (!panel) return;
    DOM.peerPanel = panel;
    DOM.peerPanelToggle = btn;
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
    peerNarrowUserExpand = isPeerCollapseViewport() || isAppStackViewport();
    setPeerPanelCollapsed(false);
}

export function closePeerProfileSheet() {
    if (!isAppStackViewport()) return;
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
    const panel = document.getElementById('uiPeerPanel') || DOM.peerPanel;
    if (!panel) return;
    DOM.peerPanel = panel;
    panel.classList.add('no-motion');
    setPeerPanelCollapsed(
        isAppStackViewport() || isPeerCollapseViewport() || readPeerPanelCollapsed(),
        false,
    );
    requestAnimationFrame(() => panel.classList.remove('no-motion'));

    const page = DOM.pageChat || document.getElementById('page-chat');
    if (page && !asideChromeDelegated) {
        asideChromeDelegated = true;
        page.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            if (target.closest('#uiSidebarToggle')) {
                const sidebar = document.getElementById('uiSidebar') || DOM.sidebar;
                if (!sidebar) return;
                const next = !sidebar.classList.contains('is-collapsed');
                sidebarViewportForced = false;
                sidebarNarrowUserExpand = isSidebarNarrowViewport() && !next;
                setSidebarCollapsed(next);
                return;
            }

            if (target.closest('#uiPeerPanelToggle')) {
                const peer = document.getElementById('uiPeerPanel') || DOM.peerPanel;
                if (!peer) return;
                const next = !peer.classList.contains('is-collapsed');
                peerViewportForced = false;
                peerNarrowUserExpand = isPeerCollapseViewport() && !next;
                setPeerPanelCollapsed(next);
                return;
            }

            if (target.closest('#uiRailChats')) {
                showChatsView();
                return;
            }
            if (target.closest('#uiRailProfile')) {
                openProfile('identity');
                return;
            }
            if (target.closest('#uiDockSettings')) {
                openAppSettings('appearance');
                return;
            }

            if (target.closest('#uiChatSearchBtn')) {
                event.stopPropagation();
                toggleMessageSearch();
            }
        });
    }

    DOM.peerPanelScrim?.addEventListener('click', () => {
        peerNarrowUserExpand = false;
        setPeerPanelCollapsed(true);
    });
    document.getElementById('uiPeerSheetBackBtn')?.addEventListener('click', () => {
        closePeerProfileSheet();
    });

    const headerLeft = document.getElementById('chatWithTitle')?.closest('.chat-header-peer__identity');
    if (headerLeft && !headerLeft.dataset.peerSheetBound) {
        headerLeft.dataset.peerSheetBound = '1';
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
    // Desktop uses the edge capsule toggle (peer-panel style); keep rail tools hidden.
    tools.hidden = true;
    tools.setAttribute('aria-hidden', 'true');
}

function setSidebarCollapsed(collapsed, persist = true) {
    const sidebar = document.getElementById('uiSidebar') || DOM.sidebar;
    const btn = document.getElementById('uiSidebarToggle') || DOM.sidebarToggle;
    if (!sidebar) return;
    DOM.sidebar = sidebar;
    DOM.sidebarToggle = btn;
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
        // Identity is a single page (no settings nav) — back returns to chats.
        if (DOM.pageChat.classList.contains('is-app-view-identity')) {
            showChatsView();
            return;
        }
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
    if (level !== 'chat' && isAppStackViewport()) closePeerProfileSheet();
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
    const peerCollapse = isPeerCollapseViewport();
    const sidebarNarrow = isSidebarNarrowViewport();
    const appStack = isAppStackViewport();
    DOM.pageChat?.classList.toggle('is-viewport-peer-narrow', peerNarrow);
    DOM.pageChat?.classList.toggle('is-viewport-sidebar-narrow', sidebarNarrow);
    DOM.pageChat?.classList.toggle('is-viewport-profile-stack', appStack);
    DOM.pageChat?.classList.toggle('is-viewport-app-stack', appStack);

    if (DOM.peerPanel) {
        if (appStack || peerCollapse) {
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
    const sidebar = document.getElementById('uiSidebar') || DOM.sidebar;
    const capsule = document.getElementById('uiLeftCapsule');
    if (!sidebar) return;
    DOM.sidebar = sidebar;
    const collapsed = readSidebarCollapsed();
    if (collapsed) {
        sidebar.classList.add('no-motion');
        capsule?.classList.add('no-motion');
        setSidebarCollapsed(true, false);
        requestAnimationFrame(() => {
            sidebar.classList.remove('no-motion');
            capsule?.classList.remove('no-motion');
        });
    } else {
        syncRailCollapsedTools();
    }
    const expand = () => {
        sidebarViewportForced = false;
        sidebarNarrowUserExpand = isSidebarNarrowViewport();
        setSidebarCollapsed(false);
    };
    DOM.railMark?.addEventListener('click', expand);
    DOM.railSidebarToggle?.addEventListener('click', expand);
}

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
    const peerCollapseMq = window.matchMedia(PEER_COLLAPSE_MQ);
    const sidebarMq = window.matchMedia(SIDEBAR_NARROW_MQ);
    const stackMq = window.matchMedia(APP_STACK_MQ);
    const run = () => syncViewportPanels();
    run();
    for (const mq of [peerMq, peerCollapseMq, sidebarMq, stackMq]) {
        if (mq.addEventListener) mq.addEventListener('change', run);
        else mq.addListener?.(run);
    }
}

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
        DOM.statusSpan.className = 'sidebar-dock__status rail-presence status-offline';
        return;
    }

    DOM.statusSpan.className = isOnline
        ? 'sidebar-dock__status rail-presence status-online'
        : 'sidebar-dock__status rail-presence status-offline';
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
    if (sidebarRenderer === 'react' || !DOM.usersListDiv) {
        syncWelcomeBanner(message !== 'No conversations yet');
        return;
    }
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
    if (sidebarRenderer === 'react' || !DOM.usersListDiv) return;
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

export function showChatWelcome({ animate = true } = {}) {
    if (!DOM.chatWelcome) return;

    // Spotlight owns the stage — keep welcome in the tree (for CSS fade) but dormant.
    if (document.getElementById('page-chat')?.classList.contains('is-compose-search')) {
        DOM.chatWelcome.classList.remove('hidden');
        return;
    }

    DOM.chatWelcome.classList.remove('hidden');
    if (animate) playEmptyStateIntros();
}

/** Park welcome under Spotlight without display:none so it can fade back with the composer. */
export function hideChatWelcome() {
    if (!DOM.chatWelcome) return;
    // Prefer CSS hide via is-compose-search; only hard-hide when a chat is active.
    if (document.getElementById('page-chat')?.classList.contains('is-compose-search')) {
        DOM.chatWelcome.classList.remove('hidden');
        return;
    }
    DOM.chatWelcome.classList.add('hidden');
}

export function activateChatPanel(username) {
    closeOverlaysForChatChange();
    try {
        rebindChatDom(DOM.pageChat || document);
    } catch (err) {
        console.warn('activateChatPanel rebind failed:', err);
        bindChatDom(DOM.pageChat || document, { requireChat: false });
    }
    refreshChatHeaderIdentity(username);
    const headerLeft = document.getElementById('chatWithTitle')?.closest('.chat-header-peer__identity');
    if (headerLeft) {
        headerLeft.classList.remove('hidden');
        headerLeft.setAttribute('aria-hidden', 'false');
    }
    const input = document.getElementById('messageInput') || DOM.messageInput;
    const send = document.getElementById('sendBtn') || DOM.sendBtn;
    if (input) {
        DOM.messageInput = input;
        input.disabled = false;
    }
    if (send) {
        DOM.sendBtn = send;
        send.disabled = false;
    }
    setChatToolsEnabled(true);
    setActiveContact(username);
    refreshChatHeaderSubtitle();
    refreshPeerPanel(username);
    autoResizeComposer();
    // Keep the capsule collapsed on chat enter — open only on explicit compose.
    if (isAppStackViewport()) setChatDrillLevel('chat');
    closeContactSearch();
}

export function resetChatPanel() {
    closeOverlaysForChatChange();
    if (!DOM.chatWithTitle || !DOM.messageInput) return;
    if (DOM.chatHeaderAvatar) {
        DOM.chatHeaderAvatar.replaceChildren();
        DOM.chatHeaderAvatar.classList.remove('has-photo');
    }
    const headerLeft = DOM.chatWithTitle?.closest('.chat-header-peer__identity');
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
    showPeerEmpty();
    if (isAppStackViewport() && chatsViewActive()) setChatDrillLevel('list');
}

/** Swap the right rail to empty immediately (e.g. under Spotlight) without waiting on chat teardown. */
export function showPeerEmpty() {
    setActiveContact(null);
    refreshPeerPanel(null);
}

export function renderMessagesList(messages) {
    /** Full hydrate — use only on chat switch / initial load. */
    if (!DOM.messagesDiv) return;
    clearMessageView();
    if (!Array.isArray(messages) || !messages.length) return;

    messages.forEach((message, index) => {
        const prev = index > 0 ? messages[index - 1] : null;
        const next = index < messages.length - 1 ? messages[index + 1] : null;
        DOM.messagesDiv.appendChild(buildMessageElement(message, prev, next));
    });
    ensureChromeFrost();
    reconcileMessageRowsWithHistory(messages);
    scrollMessagesToBottom({ force: true });
}

export function clearMessageView() {
    if (!DOM.messagesDiv) return;
    DOM.messagesDiv.innerHTML = '';
    ensureChromeFrost();
}

function ensureChromeFrost() {
    const root = DOM.messagesDiv;
    if (!root) return;

    // Edge fade is owned by React ScrollBlur — only keep scroll pads here.
    const makePad = (side) => {
        const el = document.createElement('div');
        el.className = `chat-chrome-pad chat-chrome-pad--${side}`;
        el.setAttribute('aria-hidden', 'true');
        return el;
    };

    root.querySelectorAll(':scope > .chat-chrome-frost').forEach((el) => el.remove());

    let padTop = root.querySelector(':scope > .chat-chrome-pad--top');
    let padBottom = root.querySelector(':scope > .chat-chrome-pad--bottom');
    if (!padTop) padTop = makePad('top');
    if (!padBottom) padBottom = makePad('bottom');

    if (root.firstElementChild !== padTop) root.insertBefore(padTop, root.firstChild);
    if (root.lastElementChild !== padBottom) root.appendChild(padBottom);
}

const SCROLL_NEAR_BOTTOM_PX = 96;
const JUMP_SHOW_PX = 56;
const JUMP_SCROLL_MS = 90;
/** Extra air between the last message and the floating composer top edge */
const COMPOSER_CLEARANCE_GAP = 10;

let jumpToBottomInit = false;
let jumpScrollFrame = 0;

/**
 * Keep message list padding clear of the floating composer shell.
 * Measure the dock/shell only — paste-folder peek must not inflate clearance.
 */
export function syncComposerClearance(options = {}) {
    const { followBottom = true } = options;
    const page = document.getElementById('page-chat');
    const bar = page?.querySelector('.chat-main > .input-bar');
    const stage = page?.querySelector('.chat-main > .chat-stage') || page?.querySelector('.chat-main');
    if (!page || !bar) return 0;

    const nearBottom = followBottom && isMessagesNearBottom();
    const shell =
        bar.querySelector('.composer-scale-wrap') ||
        bar.querySelector('.composer-input-dock') ||
        bar;
    const shellRect = shell.getBoundingClientRect();
    const stageBottom = stage
        ? stage.getBoundingClientRect().bottom
        : window.innerHeight;
    // Distance from composer top edge down to the stage floor (+ small gap)
    const offset = Math.max(
        88,
        Math.ceil(stageBottom - shellRect.top + COMPOSER_CLEARANCE_GAP),
    );
    page.style.setProperty('--composer-float-offset', `${offset}px`);

    const blurH = Math.max(64, Math.round(shellRect.height * 0.85 + 20));
    page.style.setProperty('--messages-composer-blur-h', `${blurH}px`);

    if (nearBottom) {
        requestAnimationFrame(() => scrollMessagesToBottom({ force: true }));
    }
    return offset;
}

/** Scroll port for #messages — ScrollBlur viewport when present. */
export function getMessagesScrollEl(root = DOM.messagesDiv) {
    if (!root) return null;
    return root.closest('[data-slot="scroll-blur-viewport"]') || root;
}

export function isMessagesNearBottom(threshold = SCROLL_NEAR_BOTTOM_PX) {
    const el = getMessagesScrollEl();
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

export function syncJumpToBottomButton() {
    const btn = DOM.scrollBottomBtn;
    if (!btn) return;

    const chatOn = !btn.disabled;
    const show = chatOn && Boolean(DOM.messagesDiv) && !isMessagesNearBottom(JUMP_SHOW_PX);
    btn.classList.toggle('is-visible', show);
    btn.setAttribute('aria-hidden', show ? 'false' : 'true');
    btn.tabIndex = show ? 0 : -1;
}

function setMessagesScrollBehavior(value) {
    const el = getMessagesScrollEl();
    if (el) el.style.scrollBehavior = value;
}

function animateMessagesToBottom(duration = JUMP_SCROLL_MS) {
    const el = getMessagesScrollEl();
    if (!el) return;

    const from = el.scrollTop;
    const maxTop = () => Math.max(0, el.scrollHeight - el.clientHeight);
    if (maxTop() - from <= 1) {
        el.scrollTop = maxTop();
        syncJumpToBottomButton();
        return;
    }

    setMessagesScrollBehavior('auto');
    const started = performance.now();
    const token = ++jumpScrollFrame;
    const tick = (now) => {
        if (token !== jumpScrollFrame) return;
        const t = Math.min(1, (now - started) / duration);
        el.scrollTop = from + (maxTop() - from) * t;
        if (t < 1) {
            window.requestAnimationFrame(tick);
            return;
        }
        el.scrollTop = maxTop();
        setMessagesScrollBehavior('');
        syncJumpToBottomButton();
    };
    tick(started);
}

export function scrollMessagesToBottom(options = {}) {
    const { force = false, smooth = false } = typeof options === 'boolean'
        ? { force: options }
        : options;
    if (!force && !isMessagesNearBottom()) return;

    jumpScrollFrame += 1;
    DOM.scrollBottomBtn?.classList.remove('is-visible');
    DOM.scrollBottomBtn?.setAttribute('aria-hidden', 'true');
    if (DOM.scrollBottomBtn) DOM.scrollBottomBtn.tabIndex = -1;

    if (smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animateMessagesToBottom();
        return;
    }

    const el = getMessagesScrollEl();
    if (!el) return;
    setMessagesScrollBehavior('auto');
    el.scrollTop = el.scrollHeight;
    setMessagesScrollBehavior('');
    syncJumpToBottomButton();
}

export function initJumpToBottom() {
    if (jumpToBottomInit || !DOM.messagesDiv) return;
    jumpToBottomInit = true;
    const scrollEl = getMessagesScrollEl();
    scrollEl?.addEventListener('scroll', syncJumpToBottomButton, { passive: true });
    syncJumpToBottomButton();
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
        const next = index < messages.length - 1 ? messages[index + 1] : null;
        const showSenderName = shouldShowSenderName(message, prev);
        applyMessageCluster(row, clusterPosition(message, prev, next));

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

    const row = buildMessageElement(message, previousMessage, null);
    DOM.messagesDiv.appendChild(row);
    ensureChromeFrost();
    refreshVisibleMessageClusters();
    reconcileMessageRowsWithHistory([message]);
    scrollMessagesToBottom({ force: true, smooth: true });
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

function buildMessageElement(message, previousMessage = null, nextMessage = null) {
    const isOutgoing = message.type === 'outgoing';
    const showSenderName = shouldShowSenderName(message, previousMessage);
    const cluster = clusterPosition(message, previousMessage, nextMessage);

    const row = document.createElement('div');
    row.className = [
        'message-row group',
        isOutgoing ? 'message-row--own' : 'message-row--other',
    ].join(' ');
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

    bubble.append(inner);

    const hoverActions = document.createElement('div');
    hoverActions.className = 'message-hover-actions';
    hoverActions.setAttribute('role', 'group');
    hoverActions.setAttribute('aria-label', 'Quick reply');

    const replyBtn = document.createElement('button');
    replyBtn.type = 'button';
    replyBtn.className = 'message-quick-btn';
    replyBtn.dataset.action = 'reply';
    replyBtn.title = 'Reply';
    replyBtn.textContent = '↩';
    hoverActions.append(replyBtn);

    const reactBtn = document.createElement('button');
    reactBtn.type = 'button';
    reactBtn.className = 'message-react-fab';
    reactBtn.dataset.action = 'react';
    reactBtn.dataset.emoji = DEFAULT_QUICK_REACTION;
    reactBtn.textContent = DEFAULT_QUICK_REACTION;
    syncMessageReactFab(reactBtn, message.reactions);

    shell.append(bubble, hoverActions, reactBtn);
    contentWrap.append(shell);

    const reactionsEl = buildReactionsEl(message);
    if (reactionsEl) contentWrap.append(reactionsEl);

    row.append(contentWrap);
    applyMessageCluster(row, cluster);
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
            btn.title = hasId
                ? (btn.classList.contains('is-active') ? 'Remove reaction' : 'React')
                : 'Waiting for sync';
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
            handleExternalLinkClick(event, link);
            return;
        }
    }

    const row = event.target.closest('.message-row');
    if (!row) return;

    if (event.type === 'dblclick') {
        const bubble = event.target.closest('.message-bubble');
        if (!bubble) return;

        event.preventDefault();
        event.stopPropagation();

        if (isAppStackViewport()) {
            openMobileMessageActions(row, bubble);
            return;
        }

        const { messageId } = resolveRowActionContext(row);
        if (!messageId) {
            notifyActionUnavailable('react');
            return;
        }

        const payload = messageContextPayloadGetter?.(row);
        if (!payload) return;

        const rect = bubble.getBoundingClientRect();
        const own = row.classList.contains('message-row--own');
        openContextMenu({
            x: own ? rect.left : rect.right,
            y: rect.bottom,
            payload: { ...payload, messageId },
            targetId: messageId,
        });
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
        const emoji = btn?.dataset.emoji || DEFAULT_QUICK_REACTION;
        if (btn && emoji === DEFAULT_QUICK_REACTION) {
            btn.classList.add('is-active');
            row.classList.add('has-quick-reaction');
        }
        btn?.blur();
        messageActionHandlers.onReact?.(messageId, emoji);
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
let messageContextPayloadGetter = null;
let lastMessageTap = { time: 0, row: null };

function openMobileMessageActions(row, bubble) {
    const payload = messageContextPayloadGetter?.(row);
    if (!payload) return;

    resolveRowActionContext(row);
    const messageId = payload.messageId || row.dataset.messageId || null;
    if (!messageId) {
        notifyActionUnavailable('react');
        return;
    }

    const targetId = messageId || payload.clientMessageId || 'message-actions';
    const current = getOverlayState();
    if (current?.type === 'drawer' && current.targetId === targetId) return;

    openMessageActionsDrawer({
        payload: {
            ...payload,
            messageId,
        },
        bubble: bubble || row.querySelector('.message-bubble'),
        row,
    });
}

/** One capture-phase listener on #messages — survives DOM updates, no per-row binding. */
export function initMessageActions() {
    if (messageActionsInitialized || !DOM.messagesDiv) return;
    messageActionsInitialized = true;

    DOM.messagesDiv.addEventListener('click', handleMessageActionsEvent, true);
    DOM.messagesDiv.addEventListener('dblclick', handleMessageActionsEvent, true);

    DOM.messagesDiv.addEventListener('touchend', (event) => {
        if (!isAppStackViewport()) return;
        if (event.target.closest('a, button, .message-reaction-chip, .message-link')) return;

        const bubble = event.target.closest('.message-bubble');
        const row = event.target.closest('.message-row');
        if (!bubble || !row) return;

        const now = Date.now();
        if (lastMessageTap.row === row && now - lastMessageTap.time < 320) {
            event.preventDefault();
            lastMessageTap = { time: 0, row: null };
            openMobileMessageActions(row, bubble);
            return;
        }
        lastMessageTap = { time: now, row };
    }, { passive: false });
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
    const wrap = host.querySelector('.message-reactions');
    syncMessageReactFab(row, reactions, myUsername);
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
        DOM.replyBar.dataset.active = 'false';
        DOM.replyBar.dispatchEvent(
            new CustomEvent('nexa:composer-reply', { bubbles: true, detail: { active: false } }),
        );
        return;
    }
    DOM.replyBar.classList.remove('hidden');
    DOM.replyBar.dataset.active = 'true';
    if (DOM.replyLabel) {
        DOM.replyLabel.textContent = `Reply to ${pendingReply.author}`;
    }
    if (DOM.replyPreview) {
        DOM.replyPreview.textContent = pendingReply.preview;
    }
    DOM.replyBar.dispatchEvent(
        new CustomEvent('nexa:composer-reply', { bubbles: true, detail: { active: true } }),
    );
    // Open the composer capsule if it was collapsed.
    DOM.messageInput?.dispatchEvent(new CustomEvent('nexa:composer-open', { bubbles: true }));
}

export function hideComposerReplyBar() {
    if (!DOM.replyBar) return;
    DOM.replyBar.classList.add('hidden');
    DOM.replyBar.dataset.active = 'false';
    DOM.replyBar.dispatchEvent(
        new CustomEvent('nexa:composer-reply', { bubbles: true, detail: { active: false } }),
    );
}

function syncMessageReactFab(fabOrRow, reactions, myUsername = '') {
    const fab = fabOrRow?.classList?.contains('message-react-fab')
        ? fabOrRow
        : fabOrRow?.querySelector?.('.message-react-fab');
    if (!fab) return;

    const mine = getMyReaction(reactions, myUsername || messageActionHandlers.getMyUsername?.() || '');
    const active = mine === DEFAULT_QUICK_REACTION;
    fab.classList.toggle('is-active', active);
    fab.closest('.message-row')?.classList.toggle('has-quick-reaction', active);
    fab.title = active ? 'Remove reaction' : 'React';
    fab.setAttribute('aria-label', active ? 'Remove reaction' : 'Add reaction');
}

export function openReactionPicker(anchor, messageId, currentEmoji = null) {
    const targetId = `reactions-${messageId}`;
    const current = getOverlayState();
    if (current?.type === 'popover' && current.targetId === targetId) {
        closeOverlay({ reason: 'toggle' });
        return;
    }

    openPopoverOverlay({
        popoverId: 'reactions',
        anchor,
        targetId,
        payload: { messageId, currentEmoji },
    });
}

function shouldShowSenderName(message, previousMessage) {
    if (message.type === 'outgoing') return false;
    if (!previousMessage) return true;
    if (previousMessage.type === 'outgoing') return true;
    return previousMessage.sender !== message.sender;
}

function isSameSenderCluster(message, neighbor) {
    if (!message || !neighbor) return false;
    if (message.type !== neighbor.type) return false;
    if (message.type === 'outgoing') return true;
    return (neighbor.sender || '') === (message.sender || '');
}

function clusterPosition(message, previousMessage, nextMessage = null) {
    const withPrev = isSameSenderCluster(message, previousMessage);
    const withNext = isSameSenderCluster(message, nextMessage);
    if (!withPrev && !withNext) return 'single';
    if (!withPrev && withNext) return 'first';
    if (withPrev && withNext) return 'middle';
    return 'last';
}

const MESSAGE_CLUSTER_POSITIONS = ['single', 'first', 'middle', 'last'];

function applyMessageCluster(row, position) {
    if (!row) return;
    const cluster = MESSAGE_CLUSTER_POSITIONS.includes(position) ? position : 'single';
    const grouped = cluster === 'middle' || cluster === 'last';

    row.classList.toggle('message-row--grouped', grouped);
    row.classList.toggle('message-row--new-group', !grouped);
    row.dataset.cluster = cluster;
    MESSAGE_CLUSTER_POSITIONS.forEach((name) => {
        row.classList.toggle(`message-row--cluster-${name}`, name === cluster);
    });

    const bubble = row.querySelector('.message-bubble');
    if (!bubble) return;
    MESSAGE_CLUSTER_POSITIONS.forEach((name) => {
        bubble.classList.toggle(`message-bubble--cluster-${name}`, name === cluster);
    });
}

function rowAsClusterMessage(row) {
    return {
        type: row.dataset.messageType,
        sender: row.dataset.messageSender || '',
    };
}

function refreshVisibleMessageClusters() {
    const rows = [...(DOM.messagesDiv?.querySelectorAll('.message-row') || [])];
    rows.forEach((row, index) => {
        const prev = index > 0 ? rowAsClusterMessage(rows[index - 1]) : null;
        const next = index < rows.length - 1 ? rowAsClusterMessage(rows[index + 1]) : null;
        applyMessageCluster(row, clusterPosition(rowAsClusterMessage(row), prev, next));
    });
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
    if (!DOM.messageInput) return;
    DOM.messageInput.value = text;
    updateComposerMeta(text);
    autoResizeComposer();
}

export function getComposerValue() {
    return DOM.messageInput?.value || '';
}

export function clearComposer() {
    setComposerValue('');
    clearPasteAttachments();
    autoResizeComposer();
}

export function focusComposer(options = {}) {
    const open = options?.open !== false;
    const input = DOM.messageInput;
    if (!input || input.disabled) return;

    if (open) {
        // Ask React composer to expand, then focus the field.
        input.dispatchEvent(new CustomEvent('nexa:composer-open', { bubbles: true }));
        requestAnimationFrame(() => {
            if (!input.disabled) input.focus({ preventScroll: true });
        });
        return;
    }

    // Soft focus: only if the capsule is already open.
    if (input.closest('.composer-shell')?.classList.contains('is-expanded')) {
        input.focus({ preventScroll: true });
    }
}

export function isContactSearchOpen() {
    return false;
}

export function openContactSearch() {
    /* Contact search UI removed. */
}

export function closeContactSearch() {
    DOM.pageChat?.classList.remove('is-contact-search-open');
}

export function focusContactSearch() {
    /* Contact search UI removed — keep shortcut as a no-op. */
}

function initContactSearchSheet() {
    /* Contact search UI removed. */
}

export function autoResizeComposer() {
    const input = DOM.messageInput;
    if (!input) return;
    /* Height is owned by ChatInput (PromptInput physics). Only notify React. */
    input.dispatchEvent(new CustomEvent('nexa:composer-resize', { bubbles: true }));
}

export function updateComposerMeta(text) {
    if (!DOM.charCounter) return;
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
    try {
        rebindChatDom(DOM.pageChat || document);
    } catch {
        bindChatDom(DOM.pageChat || document, { requireChat: false });
    }
    const root = document.getElementById('uiMessageSearch') || DOM.messageSearch;
    const input = document.getElementById('uiMessageSearchInput') || DOM.messageSearchInput;
    const btn = document.getElementById('uiChatSearchBtn') || DOM.chatSearchBtn;
    DOM.messageSearch = root;
    DOM.messageSearchInput = input;
    DOM.chatSearchBtn = btn;
    if (!root || !input || btn?.disabled) return;
    root.classList.add('is-open');
    const field = root.querySelector('.chat-header-peer__search');
    if (field) field.setAttribute('aria-hidden', 'false');
    if (btn) {
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-label', 'Close search');
        btn.setAttribute('title', 'Close search');
        btn.classList.add('is-open');
    }
    input.tabIndex = 0;
    window.setTimeout(() => {
        if (!root.classList.contains('is-open')) return;
        input.focus({ preventScroll: true });
    }, 260);
}

export function closeMessageSearch() {
    try {
        rebindChatDom(DOM.pageChat || document);
    } catch {
        bindChatDom(DOM.pageChat || document, { requireChat: false });
    }
    const root = document.getElementById('uiMessageSearch') || DOM.messageSearch;
    const input = document.getElementById('uiMessageSearchInput') || DOM.messageSearchInput;
    const btn = document.getElementById('uiChatSearchBtn') || DOM.chatSearchBtn;
    DOM.messageSearch = root;
    DOM.messageSearchInput = input;
    DOM.chatSearchBtn = btn;
    if (input) {
        input.value = '';
        input.tabIndex = -1;
        input.blur();
    }
    searchMessages('');
    if (!root) return;
    root.classList.remove('is-open');
    const field = root.querySelector('.chat-header-peer__search');
    if (field) field.setAttribute('aria-hidden', 'true');
    if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', 'Search messages');
        btn.setAttribute('title', 'Search messages');
        btn.classList.remove('is-open');
    }
}

export function toggleMessageSearch() {
    const root = document.getElementById('uiMessageSearch') || DOM.messageSearch;
    if (root?.classList.contains('is-open')) closeMessageSearch();
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
    const root = document.getElementById('uiMessageSearch') || DOM.messageSearch;
    if (!root?.classList.contains('is-open')) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    // Search toggle lives outside #uiMessageSearch — let its click handler own open/close.
    if (target instanceof Element && target.closest('#uiChatSearchBtn')) return;
    if (root.contains(target)) return;
    const input = document.getElementById('uiMessageSearchInput') || DOM.messageSearchInput;
    if (input?.value.trim()) return;
    closeMessageSearch();
});

export function openSettings() {
    openModalOverlay('settings', 'settings');
}

/** Open the in-app settings surface (Appearance / Security / …), not the interface modal. */
export function openAppSettings(section = 'appearance') {
    closeOverlay();
    setAppView('settings');
    queueProfilePanelRefresh(section);
    if (isProfileStackViewport()) {
        setProfileDrillLevel('nav');
    }
}

export function showChatsView() {
    setAppView('chats');
    if (isAppStackViewport()) setChatDrillLevel('list');
}

export function openProfile(section = 'identity') {
    closeOverlay();
    // Non-identity sections live under Settings, not the Profile page.
    if (section && section !== 'identity') {
        openAppSettings(section);
        return;
    }
    setAppView('identity');
    queueProfilePanelRefresh('identity');
    if (isProfileStackViewport()) {
        // Profile is a single page — jump straight into the section.
        setProfileDrillLevel('section');
    }
}

function setAppView(view) {
    const isChats = view === 'chats';
    const isIdentity = view === 'identity';
    const isSettings = view === 'settings';
    const isProfileSurface = isIdentity || isSettings;

    DOM.chatWorkspace = document.getElementById('uiChatWorkspace') || DOM.chatWorkspace;
    DOM.sidebar = document.getElementById('uiSidebar') || DOM.sidebar;
    DOM.profileNav = document.getElementById('uiProfileNav') || DOM.profileNav;
    DOM.profilePanel = document.getElementById('uiProfilePanel') || DOM.profilePanel;
    DOM.railChats = document.getElementById('uiRailChats') || DOM.railChats;
    DOM.railProfile = document.getElementById('uiRailProfile') || DOM.railProfile;
    DOM.dockSettings = document.getElementById('uiDockSettings') || DOM.dockSettings;

    if (DOM.chatWorkspace) {
        DOM.chatWorkspace.hidden = !isChats;
        DOM.chatWorkspace.setAttribute('aria-hidden', isChats ? 'false' : 'true');
    }
    if (DOM.sidebar) {
        // Settings replaces the contacts list with the settings nav; Profile keeps contacts.
        DOM.sidebar.hidden = isSettings;
        DOM.sidebar.setAttribute('aria-hidden', isSettings ? 'true' : 'false');
    }
    if (DOM.profileNav) {
        DOM.profileNav.hidden = !isSettings;
        DOM.profileNav.setAttribute('aria-hidden', isSettings ? 'false' : 'true');
    }
    DOM.pageChat?.classList.toggle('is-app-view-identity', isIdentity);
    DOM.pageChat?.classList.toggle('is-app-view-settings', isSettings);
    if (DOM.profilePanel) {
        DOM.profilePanel.classList.toggle('hidden', !isProfileSurface);
        DOM.profilePanel.setAttribute('aria-hidden', isProfileSurface ? 'false' : 'true');
    }
    if (!isProfileSurface) onProfilePanelClose();

    const railMap = {
        chats: DOM.railChats,
        identity: DOM.railProfile,
        settings: DOM.dockSettings,
    };
    [DOM.railChats, DOM.railProfile, DOM.dockSettings].forEach((btn) => {
        if (!btn) return;
        const on = btn === railMap[view];
        btn.classList.toggle('is-active', on);
        if (on) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
    });

    syncRailCollapsedTools();

    if (!isProfileSurface) {
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
        if (isSettings) {
            if (
                !DOM.pageChat?.classList.contains('is-profile-level-nav')
                && !DOM.pageChat?.classList.contains('is-profile-level-section')
            ) {
                setProfileDrillLevel('nav');
            }
        } else {
            setProfileDrillLevel('section');
        }
    } else if (window.matchMedia(SIDEBAR_NARROW_MQ).matches) {
        profileNavUserExpand = false;
        setProfileNavOpen(isSettings);
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
        anchor: DOM.messageSearch || DOM.chatSearchBtn,
        targetId: 'chat-info',
        payload: { partner, online, publicKeyJwk, ...extra },
    });
}

export function initMessageContextMenu(getContextPayload) {
    messageContextPayloadGetter = getContextPayload;

    DOM.messagesDiv.addEventListener('contextmenu', (event) => {
        const row = event.target.closest('.message-row');
        if (!row) return;
        event.preventDefault();

        const payload = getContextPayload(row);
        if (!payload) return;

        if (isAppStackViewport()) {
            openMobileMessageActions(row, row.querySelector('.message-bubble'));
            return;
        }

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
    if (DOM.prefMessageNotifications) {
        DOM.prefMessageNotifications.checked = preferences.messageNotifications !== false;
    }
    if (DOM.prefMessagePreview) {
        DOM.prefMessagePreview.checked = preferences.messageNotificationPreview !== false;
    }
    if (DOM.prefMessageSound) {
        DOM.prefMessageSound.checked = preferences.messageNotificationSound !== false;
    }

    const glass = Number(preferences.glassIntensity);
    const glassValue = Number.isFinite(glass) ? glass : 0;
    if (DOM.glassSlider) {
        DOM.glassSlider.value = String(glassValue);
        DOM.glassSlider.setAttribute('aria-valuenow', String(glassValue));
        DOM.glassSlider.setAttribute('aria-valuetext', `${glassValue} percent`);
    }
    if (DOM.settingsGlassValue) DOM.settingsGlassValue.textContent = `${glassValue}%`;
    setUiPreferences(preferences);
    hydrateAppearanceControls(preferences);
}

function syncPickerActive(container, attr, value) {
    if (!container) return;
    container.querySelectorAll(`[${attr}]`).forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute(attr) === value);
    });
}

/** Single entry point for profile: nav rail profile button. */
export function updateProfileRailButton(username) {
    if (!DOM.railProfile) return;
    if (!username) {
        DOM.railProfile.title = 'Profile settings';
        DOM.railProfile.setAttribute('aria-label', 'Profile settings');
        return;
    }
    const profile = loadProfile(username);
    const label = getDisplayLabel(username, profile);
    DOM.railProfile.title = `${label} (@${username})`;
    DOM.railProfile.setAttribute('aria-label', `Profile: ${label}`);
}

export function setChatToolsEnabled(isEnabled) {
    [
        DOM.chatSearchBtn,
        DOM.scrollBottomBtn,
        DOM.chatMenuBtn,
        DOM.composerMenuBtn,
        DOM.attachBtn,
        DOM.emojiBtn,
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
    syncJumpToBottomButton();
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
    // Peer empty intro is handled only when the panel newly becomes empty
    // (see refreshPeerPanel). Replaying it on every welcome restore feels like
    // the sidebar reloads — especially after closing Spotlight.
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
    if (sidebarRenderer === 'react' || !DOM.usersListDiv) {
        syncWelcomeBanner();
        return;
    }
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
    if (sidebarRenderer === 'react' || !DOM.usersListDiv) return;

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
    if (sidebarRenderer === 'react' || !DOM.usersListDiv) return;
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
    const composeOpen = document.getElementById('page-chat')?.classList.contains('is-compose-search');
    if (becameEmpty && !composeOpen) {
        restartEntering(DOM.peerEmpty);
    } else if (empty && composeOpen && DOM.peerEmpty) {
        // Keep the panel steady under Spotlight; compose copy swaps in via CSS.
        DOM.peerEmpty.classList.remove('is-entering');
    }

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
    // Header presence + typing are owned by ChatHeader (React).
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

