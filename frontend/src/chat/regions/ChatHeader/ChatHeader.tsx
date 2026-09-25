import { getDisplayLabel } from '../../../../js/profile.js';
import { resolveContactProfile } from '../../../../js/profileDirectory.js';
import { getPrivacyFlags } from '../../../../js/privacy.js';
import { GooeyText, GOOEY_DOTS } from '../../../components/ui/GooeyText';
import { useChatSnapshot } from '../../hooks/useChatEngine';
import { Icon } from '../../components/Icon';
import { StatusArc } from '../../components/StatusArc';

export function ChatHeader() {
    const snap = useChatSnapshot();
    const active = snap.activeUsername;
    const sidebarUser = (snap.chats || []).find((user: { username?: string }) => user.username === active);
    const profile = active ? resolveContactProfile(active, sidebarUser, snap.myUsername) : null;
    const label = active ? getDisplayLabel(active, profile) : '';
    const privacy = getPrivacyFlags(snap.preferences || {});
    const isTyping = Boolean(active && privacy.typingIndicators && snap.typingUsers.has(active));
    const showPresence = Boolean(active && privacy.showOnlineStatus);
    const online = Boolean(active && snap.onlineUsers.has(active));

    return (
        <header className="chat-header">
            <div className="chat-header-stack">
                <div className="chat-header-inner">
                    <button id="uiChatBackBtn" className="mini-icon-btn chat-back-btn" type="button" title="Back to chats" aria-label="Back to chats" hidden aria-hidden="true">
                        <Icon href="#icon-arrow-left" />
                    </button>

                    <div id="uiMessageSearch" className="chat-header-peer">
                        <div
                            className={`chat-header-peer__identity${active ? '' : ' hidden'}`}
                            aria-hidden={active ? 'false' : 'true'}
                        >
                            {/* Presence arc (contrast green / red here — see .avatar-status--header) */}
                            <div
                                className="chat-header-avatar-wrap avatar-status avatar-status--header"
                                data-status={showPresence ? (online ? 'online' : 'offline') : undefined}
                            >
                                <div id="chatHeaderAvatar" className="chat-header-avatar contact-avatar" aria-hidden="true" />
                                <StatusArc />
                            </div>
                            <div className="header-left__meta">
                                <span
                                    id="chatWithTitle"
                                    aria-live="polite"
                                    aria-label={isTyping ? `${label} is typing` : label}
                                >
                                    {label ? (
                                        <GooeyText
                                            key={active}
                                            text={isTyping ? GOOEY_DOTS : label}
                                            className="header-gooey"
                                            textClassName="header-gooey__text"
                                        />
                                    ) : null}
                                </span>
                            </div>
                        </div>

                        <div className="chat-header-peer__search" aria-hidden="true">
                            <svg className="chat-header-peer__search-lead ui-icon" aria-hidden="true">
                                <use href="#icon-search" />
                            </svg>
                            <input
                                id="uiMessageSearchInput"
                                type="search"
                                placeholder="Search messages"
                                autoComplete="off"
                                spellCheck={false}
                                tabIndex={-1}
                            />
                            <span id="uiMessageSearchCount" className="chat-header-peer__search-count" hidden />
                        </div>
                    </div>

                    <button
                        id="uiChatSearchBtn"
                        className="chat-header-search-btn"
                        type="button"
                        title="Search messages"
                        aria-label="Search messages"
                        aria-expanded="false"
                        aria-controls="uiMessageSearch"
                    >
                        <svg className="ui-icon chat-header-search-btn__icon-search" aria-hidden="true">
                            <use href="#icon-search" />
                        </svg>
                        <svg className="ui-icon chat-header-search-btn__icon-close" aria-hidden="true">
                            <use href="#icon-x" />
                        </svg>
                    </button>
                </div>
                <div id="uiComposeSpotlight" className="compose-spotlight" hidden aria-hidden="true">
                    <div id="uiComposeReactRoot" />
                </div>
            </div>
        </header>
    );
}
