import { Icon } from '../../components/Icon';

export function PeerPanel() {
    return (
        <>
            <div id="uiPeerPanelScrim" className="peer-panel-scrim" hidden aria-hidden="true" />
            <div className="peer-panel-dock">
                <button
                    id="uiPeerPanelToggle"
                    className="peer-panel-toggle"
                    type="button"
                    title="Hide panel"
                    aria-expanded="true"
                    aria-controls="uiPeerPanel"
                    aria-label="Hide conversation panel"
                >
                    <Icon href="#icon-chevron-right" />
                </button>
                <aside id="uiPeerPanel" className="peer-panel is-empty" aria-label="Conversation profile">
                    <div className="peer-panel-shelf">
                        <div className="peer-sheet-bar">
                            <button id="uiPeerSheetBackBtn" className="mini-icon-btn" type="button" title="Back to chat" aria-label="Back to chat">
                                <Icon href="#icon-arrow-left" />
                            </button>
                            <p className="peer-sheet-bar__title">Profile</p>
                        </div>
                        <div id="uiPeerEmpty" className="peer-panel-empty is-entering">
                            <div className="peer-empty-hero peer-empty-hero--welcome">
                                <div className="peer-empty-core">
                                    <div className="peer-empty-art" aria-hidden="true">
                                        <svg className="peer-empty-icon" aria-hidden="true">
                                            <use href="#icon-shield" />
                                        </svg>
                                    </div>
                                    <h3 className="peer-empty-title">Your privacy, our priority</h3>
                                    <p className="peer-empty-copy">All messages are end-to-end encrypted. No one else can read what you send.</p>
                                    <div className="peer-empty-cta">
                                        <a id="uiPeerEmptyLearnMore" className="peer-empty-btn" href="/about-security" data-link>
                                            Learn more about security
                                            <Icon href="#icon-arrow-right" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                            <div className="peer-empty-hero peer-empty-hero--compose" aria-hidden="true">
                                <div className="peer-empty-core">
                                    <div className="peer-empty-art" aria-hidden="true">
                                        <svg className="peer-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <circle cx="11" cy="11" r="7" />
                                            <path d="m20 20-3.5-3.5" />
                                        </svg>
                                    </div>
                                    <h3 className="peer-empty-title">Choose a search mode</h3>
                                    <p className="peer-empty-copy">Pick a widget on the right, then type to find people, chats, or messages.</p>
                                    <div className="peer-empty-cta" aria-hidden="true" />
                                </div>
                            </div>
                        </div>
                        <div id="uiPeerBody" className="peer-panel-body" hidden>
                            <div className="peer-hero">
                                <div id="uiPeerAvatar" className="peer-avatar contact-avatar" aria-hidden="true" />
                                <h2 id="uiPeerName" className="peer-name" />
                                <p id="uiPeerHandle" className="peer-handle" />
                                <p id="uiPeerStatus" className="peer-status" />
                            </div>
                            <section className="peer-section" aria-labelledby="uiPeerAboutTitle">
                                <h3 id="uiPeerAboutTitle" className="peer-section-title">About</h3>
                                <p id="uiPeerBio" className="peer-bio" />
                            </section>
                            <section className="peer-section peer-section--encrypt" aria-labelledby="uiPeerEncryptTitle">
                                <div className="peer-encrypt-head">
                                    <h3 id="uiPeerEncryptTitle" className="peer-section-title">Encryption</h3>
                                    <span className="peer-verified">
                                        <Icon href="#icon-check-circle" />
                                        Verified
                                    </span>
                                </div>
                                <p id="uiPeerEncryptCopy" className="peer-encrypt-copy">Messages are end-to-end encrypted.</p>
                                <button id="uiPeerSecurityBtn" className="peer-security-btn" type="button">View Security Details</button>
                            </section>
                            <section className="peer-section peer-section--options" aria-labelledby="uiPeerOptionsTitle">
                                <h3 id="uiPeerOptionsTitle" className="peer-section-title">Options</h3>
                                <div className="peer-options">
                                    <button id="uiPeerMuteBtn" className="peer-option" type="button">
                                        <Icon href="#icon-bell-off" />
                                        Mute
                                    </button>
                                    <button id="uiPeerClearBtn" className="peer-option peer-option--danger" type="button">
                                        <Icon href="#icon-trash" />
                                        Clear chat history
                                    </button>
                                    <button id="uiPeerDeleteBtn" className="peer-option peer-option--danger" type="button">
                                        <Icon href="#icon-ban" />
                                        Delete chat
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>
                </aside>
            </div>
        </>
    );
}
