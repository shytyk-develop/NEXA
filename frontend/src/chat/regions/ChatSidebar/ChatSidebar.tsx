import { getAvatarHue, getDisplayLabel, getInitials } from '../../../../js/profile.js';
import { resolveContactProfile } from '../../../../js/profileDirectory.js';
import { getPrivacyFlags, isChatMuted } from '../../../../js/privacy.js';
import { useChatSnapshot } from '../../hooks/useChatEngine';
import { Icon } from '../../components/Icon';

type ChatSidebarProps = {
    onSelectChat?: (username: string) => void;
    onOpenSpotlight?: () => void;
};

export function ChatSidebar({ onSelectChat, onOpenSpotlight }: ChatSidebarProps) {
    const snap = useChatSnapshot();
    const chats = (snap.chats || []).filter((chat: any) => chat.username !== snap.myUsername);
    const showWelcome = !snap.loading && chats.length === 0;
    const privacy = getPrivacyFlags(snap.preferences || {});

    return (
        <div className="left-capsule" id="uiLeftCapsule">
            <button
                id="uiSidebarToggle"
                className="sidebar-capsule-toggle"
                type="button"
                title="Hide contacts"
                aria-expanded="true"
                aria-controls="uiSidebar"
                aria-label="Hide contacts"
            >
                <Icon href="#icon-chevron-right" />
            </button>
            <div className="left-capsule-shelf">
                <div id="uiRailCollapsedTools" className="rail-collapsed-tools" hidden>
                    <button id="uiRailMark" className="rail-mark" type="button" title="Show contacts" aria-label="Show contacts">
                        <img src="/brand/nexa-mark.png" alt="" width={40} height={40} decoding="async" />
                    </button>
                    <button id="uiRailSidebarToggle" className="rail-sidebar-toggle" type="button" title="Show contacts" aria-label="Show contacts">
                        <Icon href="#icon-panel-left" />
                    </button>
                </div>

                <aside id="uiSidebar" className="sidebar" aria-label="Navigation and contacts">
                    <header className="sidebar-brand">
                        <img src="/brand/nexa-logo.svg" alt="NEXA" className="sidebar-brand__mark" width={1007} height={176} decoding="async" />
                        <button id="uiRefreshUsersBtn" className="mini-icon-btn sidebar-brand__reload" type="button" title="Refresh contacts" aria-label="Refresh contacts">
                            <Icon href="#icon-refresh" />
                        </button>
                    </header>

                    <section className="sidebar-chats" aria-label="Chats">
                        <div id="usersList">
                            {snap.loading ? (
                                Array.from({ length: 6 }, (_, i) => (
                                    <div key={i} className="contact-skeleton" aria-hidden="true">
                                        <span className="skeleton skeleton-avatar" />
                                        <span className="skeleton-lines">
                                            <span className="skeleton skeleton-line skeleton-line--name" />
                                            <span className="skeleton skeleton-line skeleton-line--sub" />
                                        </span>
                                    </div>
                                ))
                            ) : chats.length === 0 ? (
                                <div className="empty-state">No conversations yet</div>
                            ) : (
                                chats.map((user: any) => (
                                    <ContactRow
                                        key={user.username}
                                        user={user}
                                        myUsername={snap.myUsername}
                                        active={snap.activeUsername === user.username}
                                        online={privacy.showOnlineStatus ? snap.onlineUsers.has(user.username) : null}
                                        unread={snap.unreadCounts[user.username] ?? user.unread_count ?? 0}
                                        typing={Boolean(privacy.typingIndicators && snap.typingUsers.has(user.username))}
                                        muted={Boolean(snap.myUsername && isChatMuted(snap.myUsername, user.username))}
                                        onSelect={() => onSelectChat?.(user.username)}
                                    />
                                ))
                            )}
                        </div>
                        <div id="uiWelcomeBanner" className={`nexa-welcome-banner${showWelcome ? '' : ' hidden'}`}>
                            <div className="nexa-welcome-banner__row">
                                <div className="nexa-welcome-banner__copy">
                                    <p className="nexa-welcome-banner__title">Welcome to NEXA!</p>
                                    <p className="nexa-welcome-banner__tagline">
                                        Private.<br />Encrypted.<br />Yours.
                                    </p>
                                </div>
                                <div className="nexa-welcome-banner__art" aria-hidden="true">
                                    <img src="/brand/nexa-lock-glass.png" alt="" width={112} height={112} decoding="async" />
                                </div>
                            </div>
                            <a id="uiWelcomeLearnMore" className="nexa-welcome-banner__btn" href="/about-security" data-link>
                                Learn more
                                <Icon href="#icon-arrow-right" />
                            </a>
                        </div>
                    </section>

                    <div className="sidebar-hidden-controls hidden" aria-hidden="true">
                        <span id="status" className="sidebar-dock__status rail-presence status-offline" title="Disconnected" aria-label="Disconnected" />
                        <button id="uiSettingsBtn" type="button" tabIndex={-1} title="Interface settings" aria-label="Interface settings">
                            <Icon href="#icon-settings" />
                        </button>
                        <button id="uiFocusContactsBtn" type="button" tabIndex={-1} title="Focus contacts" aria-label="Focus contacts">
                            <Icon href="#icon-users" />
                        </button>
                        <button id="uiFocusComposerBtn" type="button" tabIndex={-1} title="Focus composer" aria-label="Focus composer">
                            <Icon href="#icon-message" />
                        </button>
                        <button id="uiCopyUsernameBtn" type="button" tabIndex={-1} title="Copy ID" aria-label="Copy ID">
                            <Icon href="#icon-copy" />
                        </button>
                        <button id="uiShortcutsBtn" type="button" tabIndex={-1} title="Keyboard shortcuts" aria-label="Keyboard shortcuts">
                            <Icon href="#icon-keyboard" />
                        </button>
                    </div>
                </aside>

                <div className="sidebar-dock-bar">
                    <nav id="uiSidebarDock" className="sidebar-dock" aria-label="App sections">
                        <a href="#chats" id="uiRailChats" className="sidebar-dock__item is-active" title="Chats" aria-label="Chats" aria-current="page" data-rail="chats">
                            <Icon href="#icon-message" />
                        </a>
                        <a href="#profile" id="uiRailProfile" className="sidebar-dock__item" title="Profile" aria-label="Profile" data-rail="identity">
                            <Icon href="#icon-user" />
                        </a>
                        <button type="button" id="uiDockSettings" className="sidebar-dock__item" title="Settings" aria-label="Settings" data-rail="settings">
                            <Icon href="#icon-settings" />
                        </button>
                    </nav>
                    <button type="button" id="uiDockNewChat" className="sidebar-dock-compose" title="New chat" aria-label="New chat" onClick={onOpenSpotlight}>
                        <Icon href="#icon-search" />
                    </button>
                </div>

                <ProfileNav />
            </div>
        </div>
    );
}

function ContactRow({
    user,
    myUsername,
    active,
    online,
    unread,
    typing,
    muted,
    onSelect,
}: {
    user: any;
    myUsername: string | null;
    active: boolean;
    online: boolean | null;
    unread: number;
    typing: boolean;
    muted: boolean;
    onSelect: () => void;
}) {
    const profile = resolveContactProfile(user.username, user, myUsername);
    const label = getDisplayLabel(user.username, profile);
    const hasDisplayName = Boolean(profile.displayName?.trim());
    const presenceClass = online == null ? 'presence-neutral' : online ? 'is-online' : 'is-offline';
    const time = formatSidebarTime(user.last_message_at);
    const preview = truncateSidebarPreview(user.last_message_preview);
    const showBadge = unread > 0 && !active;

    return (
        <button
            type="button"
            className={`contact-row${active ? ' is-active' : ''}`}
            data-username={user.username}
            aria-label={`Open chat with ${label}`}
            aria-current={active ? 'true' : 'false'}
            onClick={onSelect}
        >
            <div
                className={`contact-avatar${profile.avatarDataUrl ? ' has-photo' : ''}`}
                style={{ ['--avatar-hue' as string]: String(getAvatarHue(user.username)) }}
            >
                {profile.avatarDataUrl ? (
                    <img src={profile.avatarDataUrl} alt="" className="contact-avatar-img" loading="lazy" />
                ) : (
                    getInitials(label)
                )}
            </div>
            <div className="contact-meta">
                <div className="contact-name-row">
                    <div className={`contact-name${hasDisplayName ? ' has-display-name' : ''}`}>{label}</div>
                    {hasDisplayName ? <span className="contact-handle">@{user.username}</span> : null}
                    <span className="contact-time" data-contact-time="true" hidden={!time}>
                        {time}
                    </span>
                </div>
                <div className="contact-preview-row">
                    <div
                        className={`contact-subtitle${muted ? ' is-muted' : ''}${typing ? ' is-typing' : ''}`}
                        data-contact-subtitle="true"
                    >
                        {muted ? 'Muted' : typing ? (
                            <span className="typing-dots" aria-label="Typing"><span /><span /><span /></span>
                        ) : (preview || 'Secure channel')}
                    </div>
                    <div className={`contact-presence ${presenceClass}`} data-presence-dot="true" aria-hidden="true" />
                </div>
            </div>
            {showBadge ? (
                <span data-unread-badge="true" className="contact-unread">
                    {unread > 99 ? '99+' : String(unread)}
                </span>
            ) : null}
        </button>
    );
}

function ProfileNav() {
    return (
        <nav id="uiProfileNav" className="profile-nav" hidden aria-hidden="true" aria-label="Settings">
            <header className="profile-nav-toolbar">
                <button id="uiProfileNavBackBtn" className="mini-icon-btn profile-nav-back-btn" type="button" title="Back to chats" aria-label="Back to chats">
                    <Icon href="#icon-arrow-left" />
                </button>
                <div className="profile-nav-toolbar-copy">
                    <p className="profile-nav-toolbar-title">Settings</p>
                </div>
            </header>
            <p className="profile-nav-kicker">Settings</p>
            <button type="button" className="profile-nav-btn is-active" data-profile-nav="appearance" aria-current="page">
                <svg className="profile-nav-icon ui-icon" aria-hidden="true"><use href="#icon-palette" /></svg>
                <span className="profile-nav-copy"><span className="profile-nav-label">Appearance</span></span>
            </button>
            <button type="button" className="profile-nav-btn" data-profile-nav="security">
                <svg className="profile-nav-icon ui-icon" aria-hidden="true"><use href="#icon-shield" /></svg>
                <span className="profile-nav-copy"><span className="profile-nav-label">Security</span></span>
            </button>
            <button type="button" className="profile-nav-btn" data-profile-nav="privacy">
                <svg className="profile-nav-icon ui-icon" aria-hidden="true"><use href="#icon-eye" /></svg>
                <span className="profile-nav-copy"><span className="profile-nav-label">Privacy</span></span>
            </button>
            <button type="button" className="profile-nav-btn" data-profile-nav="data">
                <svg className="profile-nav-icon ui-icon" aria-hidden="true"><use href="#icon-database" /></svg>
                <span className="profile-nav-copy"><span className="profile-nav-label">Data</span></span>
            </button>
            <button id="uiProfileLogoutBtn" className="profile-nav-btn profile-nav-btn--logout" type="button">
                <svg className="profile-nav-icon ui-icon" aria-hidden="true"><use href="#icon-logout" /></svg>
                <span className="profile-nav-copy"><span className="profile-nav-label">Log out</span></span>
            </button>
            <div className="profile-nav-foot">
                <div className="profile-e2ee-card">
                    <div className="profile-e2ee-head">
                        <span className="profile-e2ee-kicker">E2EE status</span>
                        <span className="profile-e2ee-verified">Verified</span>
                    </div>
                    <p className="profile-e2ee-copy">All your data is end-to-end encrypted and stored locally.</p>
                    <button id="uiProfileViewSecurity" className="profile-e2ee-link" type="button">View security details</button>
                </div>
            </div>
        </nav>
    );
}

function formatSidebarTime(isoValue?: string) {
    if (!isoValue) return '';
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function truncateSidebarPreview(text: string, maxLen = 42) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    if (clean.length <= maxLen) return clean;
    return `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}
