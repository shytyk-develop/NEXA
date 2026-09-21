import { Icon } from '../../components/Icon';

export function ChatHeader() {
    return (
        <header className="chat-header">
            <div className="chat-header-stack">
                <div className="chat-header-inner">
                    <button id="uiChatBackBtn" className="mini-icon-btn chat-back-btn" type="button" title="Back to chats" aria-label="Back to chats" hidden aria-hidden="true">
                        <Icon href="#icon-arrow-left" />
                    </button>
                    <div className="header-left hidden" aria-hidden="true">
                        <div id="chatHeaderAvatar" className="chat-header-avatar contact-avatar" aria-hidden="true" />
                        <div className="header-left__meta">
                            <span id="chatWithTitle" />
                            <span id="chatSubtitle" className="header-sub" />
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
