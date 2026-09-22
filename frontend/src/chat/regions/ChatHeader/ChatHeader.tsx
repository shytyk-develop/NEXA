import { useMemo } from 'react';
import { getDisplayLabel } from '../../../../js/profile.js';
import { resolveContactProfile } from '../../../../js/profileDirectory.js';
import { getPrivacyFlags } from '../../../../js/privacy.js';
import { GooeyText, GOOEY_DOTS } from '../../../components/ui/gooey-text-morphing';
import { useChatSnapshot } from '../../hooks/useChatEngine';
import { Icon } from '../../components/Icon';

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
    const gooeyTexts = useMemo(() => [label, GOOEY_DOTS], [label]);

    return (
        <header className="chat-header">
            <div className="chat-header-stack">
                <div className="chat-header-inner">
                    <button id="uiChatBackBtn" className="mini-icon-btn chat-back-btn" type="button" title="Back to chats" aria-label="Back to chats" hidden aria-hidden="true">
                        <Icon href="#icon-arrow-left" />
                    </button>
                    <div className={`header-left${active ? '' : ' hidden'}`} aria-hidden={active ? 'false' : 'true'}>
                        <div className="chat-header-avatar-wrap">
                            <div id="chatHeaderAvatar" className="chat-header-avatar contact-avatar" aria-hidden="true" />
                            <span
                                className={`chat-header-presence ${online ? 'is-online' : 'is-offline'}`}
                                hidden={!showPresence}
                                aria-hidden="true"
                            />
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
                                        texts={gooeyTexts}
                                        activeIndex={isTyping ? 1 : 0}
                                        morphTime={1}
                                        cooldownTime={0.25}
                                        className="header-gooey"
                                        textClassName="header-gooey__text"
                                    />
                                ) : null}
                            </span>
                        </div>
                    </div>
                    <div className="chat-header-tools">
                        <div id="uiMessageSearch" className="expand-search">
                            <div className="expand-search__bar" aria-hidden="true">
                                <svg className="expand-search__lead ui-icon" aria-hidden="true"><use href="#icon-search" /></svg>
                                <input id="uiMessageSearchInput" type="search" placeholder="Search messages" autoComplete="off" spellCheck={false} tabIndex={-1} />
                                <span id="uiMessageSearchCount" className="expand-search__count" hidden />
                            </div>
                            <button id="uiChatSearchBtn" className="mini-icon-btn expand-search__btn" type="button" title="Search messages" aria-label="Search messages" aria-expanded="false">
                                <svg className="ui-icon expand-search__icon-search" aria-hidden="true"><use href="#icon-search" /></svg>
                                <svg className="ui-icon expand-search__icon-close" aria-hidden="true"><use href="#icon-x" /></svg>
                            </button>
                        </div>
                        <button id="uiChatMenuBtn" className="mini-icon-btn" type="button" title="Chat actions" aria-haspopup="menu" aria-label="Chat actions">
                            <Icon href="#icon-more" />
                        </button>
                    </div>
                </div>
                <div id="uiComposeSpotlight" className="compose-spotlight" hidden aria-hidden="true">
                    <div id="uiComposeReactRoot" />
                </div>
            </div>
        </header>
    );
}
