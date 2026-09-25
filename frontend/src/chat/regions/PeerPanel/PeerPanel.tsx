import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type MouseEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BellOff, Check, ChevronRight, Eraser, Lock, Trash2 } from 'lucide-react';
import { instantHoverTransition, listHoverTransition } from '@/lib/hoverMotion';
import { AsideToggle } from '../../components/AsideToggle';
import { Icon } from '../../components/Icon';
import { runOverlayAction } from '../../../../ui/overlays/overlayManager.js';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { OtpInput, type OtpInputHandle, type OtpStatus } from '@/components/ui/otp-input';
import { ScrollBlur } from '@/components/ui/scroll-blur';
import {
    getActiveSavedMessages,
    getSavedMessagesPeer,
    subscribeSavedMessages,
    type SavedMessage,
} from '../../savedMessages';

type HighlightBounds = {
    top: number;
    left: number;
    width: number;
    height: number;
};

type ActionHighlight = HighlightBounds & { tone: 'primary' | 'danger' };

type ConfirmAction = 'delete' | 'clear';

/** Pill ⇄ confirmation morph (shared layoutId). */
const CONFIRM_SPRING = { type: 'spring' as const, stiffness: 280, damping: 28 };

type ConfirmStep = 'confirm' | 'otp' | 'success';

/** Success view stays up this long before the drawer folds and the action runs. */
const SUCCESS_HOLD_MS = 1200;

/** A fresh 4-digit code per confirmation, so the step can't become muscle memory. */
function makeConfirmCode() {
    const [n] = crypto.getRandomValues(new Uint32Array(1));
    return String(n % 10000).padStart(4, '0');
}

const CONFIRM_COPY: Record<ConfirmAction, { title: string; description: string; confirm: string; pending: string }> = {
    // The endpoint removes the stored history for both participants; the
    // wording says what actually happens (no "just for you").
    delete: {
        title: 'Delete this chat?',
        description: 'This removes the chat from your list and deletes its message history. It can’t be undone.',
        confirm: 'Delete',
        pending: 'Deleting this chat…',
    },
    clear: {
        title: 'Clear chat history?',
        description: 'This deletes every message in this chat. The chat stays in your list. It can’t be undone.',
        confirm: 'Clear',
        pending: 'Clearing chat history…',
    },
};

/** The pill's fill — the element that morphs into the confirmation panel. */
function PillSurface({ action, reduceMotion }: { action: ConfirmAction; reduceMotion: boolean }) {
    return (
        <motion.span
            layoutId={`peer-confirm-${action}`}
            className="peer-action-pill__surface"
            style={{ borderRadius: 24 }}
            transition={reduceMotion ? { duration: 0 } : CONFIRM_SPRING}
            aria-hidden="true"
        />
    );
}

/**
 * Delete / Clear confirmation: the pill's fill grows (layoutId) to cover the
 * profile card, then walks confirm → code → success. The action runs only after
 * the success view; Cancel, Escape, a click outside or switching chats fold it
 * back (and cancel it) until then.
 */
function PeerConfirm({
    action,
    reduceMotion,
    onCancel,
}: {
    action: ConfirmAction;
    reduceMotion: boolean;
    onCancel: () => void;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const otpRef = useRef<OtpInputHandle>(null);
    const [step, setStep] = useState<ConfirmStep>('confirm');
    const [otpStatus, setOtpStatus] = useState<OtpStatus>('idle');
    const [expectedOtp] = useState(makeConfirmCode);
    const copy = CONFIRM_COPY[action];
    const ActionIcon = action === 'delete' ? Trash2 : Eraser;

    // Once verified the flow completes on its own: no cancelling mid-success.
    const cancel = useCallback(() => {
        if (step !== 'success') onCancel();
    }, [step, onCancel]);

    useEffect(() => {
        if (step === 'confirm') cancelRef.current?.focus({ preventScroll: true });
        const onPointerDown = (event: PointerEvent) => {
            if (!panelRef.current?.contains(event.target as Node)) cancel();
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') cancel();
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [step, cancel]);

    // Wrong code: shake (OtpInput), then clear the cells for another try.
    useEffect(() => {
        if (otpStatus !== 'error') return undefined;
        const timer = window.setTimeout(() => {
            otpRef.current?.clear();
            setOtpStatus('idle');
        }, 900);
        return () => window.clearTimeout(timer);
    }, [otpStatus]);

    // Verified: hold the success view, then run the action and fold back.
    // Unmounting first (chat switched) clears the timer, so nothing runs.
    useEffect(() => {
        if (step !== 'success') return undefined;
        const timer = window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('nexa:peer-action', { detail: { action } }));
            onCancel();
        }, SUCCESS_HOLD_MS);
        return () => window.clearTimeout(timer);
    }, [step, action, onCancel]);

    const handleOtpSubmit = (value: string) => {
        if (value === expectedOtp) {
            setOtpStatus('success');
            setStep('success');
        } else {
            setOtpStatus('error');
        }
    };

    const stepMotion = reduceMotion
        ? {}
        : {
              initial: { opacity: 0, y: 6 },
              animate: { opacity: 1, y: 0, transition: { delay: 0.12, duration: 0.2 } },
              exit: { opacity: 0, y: -4, transition: { duration: 0.1 } },
          };

    return (
        <motion.div
            ref={panelRef}
            layoutId={`peer-confirm-${action}`}
            className="peer-confirm"
            // The card's inner radius: --peer-card-radius (50px) minus its 1px
            // border. A plain number so Framer can scale-correct the corners
            // while the panel morphs (a calc() string would warp mid-flight).
            style={{ borderRadius: 49 }}
            transition={reduceMotion ? { duration: 0 } : CONFIRM_SPRING}
            role="alertdialog"
            aria-modal="false"
            aria-labelledby="uiPeerConfirmTitle"
            aria-describedby="uiPeerConfirmCopy"
        >
            <AnimatePresence mode="wait" initial={false}>
                {step === 'confirm' ? (
                    <motion.div key="confirm" className="peer-confirm__body" {...stepMotion}>
                        <div className="peer-confirm__center">
                            <span className="peer-confirm__icon" aria-hidden="true">
                                <ActionIcon />
                            </span>
                            <h3 id="uiPeerConfirmTitle" className="peer-confirm__title">{copy.title}</h3>
                            <p id="uiPeerConfirmCopy" className="peer-confirm__copy">{copy.description}</p>
                        </div>
                        <div className="peer-confirm__actions">
                            <button
                                type="button"
                                className="peer-confirm__btn peer-confirm__btn--danger"
                                onClick={() => setStep('otp')}
                            >
                                {copy.confirm}
                            </button>
                            <button ref={cancelRef} type="button" className="peer-confirm__btn" onClick={cancel}>
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                ) : step === 'otp' ? (
                    <motion.div key="otp" className="peer-confirm__body" {...stepMotion}>
                        <div className="peer-confirm__center">
                            <span className="peer-confirm__icon" aria-hidden="true">
                                <ActionIcon />
                            </span>
                            <h3 id="uiPeerConfirmTitle" className="peer-confirm__title">Security Verification</h3>
                            <p id="uiPeerConfirmCopy" className="peer-confirm__copy">
                                Enter the verification code: <strong className="peer-confirm__code">{expectedOtp}</strong>
                            </p>
                            <OtpInput
                                ref={otpRef}
                                className="peer-confirm__otp"
                                length={4}
                                groupEvery={0}
                                autoFocus
                                status={otpStatus}
                                onComplete={handleOtpSubmit}
                                errorMessage="Incorrect code. Try again."
                            />
                        </div>
                        <div className="peer-confirm__actions">
                            <button type="button" className="peer-confirm__btn" onClick={cancel}>
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="success" className="peer-confirm__body" {...stepMotion}>
                        <div className="peer-confirm__center">
                            <motion.span
                                className="peer-confirm__check"
                                aria-hidden="true"
                                initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 18, delay: 0.1 }}
                            >
                                <Check />
                            </motion.span>
                            <h3 id="uiPeerConfirmTitle" className="peer-confirm__title" role="status">Verified</h3>
                            <p id="uiPeerConfirmCopy" className="peer-confirm__copy">{copy.pending}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

/**
 * Mute (filled, contrast) · Delete · Clear (light, red text) — Mute is wired in
 * js/app.js; Delete / Clear open PeerConfirm, which dispatches the action.
 * Hover / focus uses the left sidebar's motion: one highlight slides between
 * the pills on the list spring and fades in / out at the row's edges.
 */
function PeerActions() {
    const rowRef = useRef<HTMLDivElement>(null);
    const [highlight, setHighlight] = useState<ActionHighlight | null>(null);
    const [confirming, setConfirming] = useState<ConfirmAction | null>(null);
    const reduceMotion = useReducedMotion() === true;
    const peer = useSyncExternalStore(subscribeSavedMessages, getSavedMessagesPeer);

    // A pending confirmation never carries over to another chat.
    useEffect(() => {
        setConfirming(null);
    }, [peer]);

    const closeConfirm = useCallback(() => setConfirming(null), []);

    const highlightFrom = useCallback((element: HTMLElement) => {
        const row = rowRef.current;
        if (!row) return;
        const rowRect = row.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        setHighlight({
            top: rect.top - rowRect.top,
            left: rect.left - rowRect.left,
            width: rect.width,
            height: rect.height,
            tone: element.classList.contains('peer-action-pill--primary') ? 'primary' : 'danger',
        });
    }, []);

    const pillEvents = {
        onMouseEnter: (event: MouseEvent<HTMLButtonElement>) => highlightFrom(event.currentTarget),
        onFocus: (event: FocusEvent<HTMLButtonElement>) => highlightFrom(event.currentTarget),
    };

    const openConfirm = (action: ConfirmAction) => {
        setHighlight(null);
        setConfirming(action);
    };

    return (
        <>
            <div ref={rowRef} className="peer-actions" onMouseLeave={() => setHighlight(null)}>
                <AnimatePresence>
                    {highlight && !confirming ? (
                        <motion.div
                            key="peer-actions-highlight"
                            className="peer-actions-highlight"
                            data-tone={highlight.tone}
                            aria-hidden="true"
                            initial={{ opacity: 0, top: highlight.top, left: highlight.left, width: highlight.width, height: highlight.height }}
                            animate={{ opacity: 1, top: highlight.top, left: highlight.left, width: highlight.width, height: highlight.height }}
                            exit={{ opacity: 0 }}
                            transition={reduceMotion ? instantHoverTransition : listHoverTransition}
                        />
                    ) : null}
                </AnimatePresence>
                <button id="uiPeerMuteBtn" className="peer-action-pill peer-action-pill--primary" type="button" {...pillEvents}>
                    <BellOff aria-hidden="true" />
                    <span>Mute</span>
                </button>
                <button
                    id="uiPeerDeleteBtn"
                    className="peer-action-pill peer-action-pill--danger"
                    type="button"
                    aria-label="Delete chat"
                    aria-haspopup="dialog"
                    onClick={() => openConfirm('delete')}
                    {...pillEvents}
                >
                    {confirming !== 'delete' ? <PillSurface action="delete" reduceMotion={reduceMotion} /> : null}
                    <span>Delete</span>
                </button>
                <button
                    id="uiPeerClearBtn"
                    className="peer-action-pill peer-action-pill--danger"
                    type="button"
                    aria-label="Clear chat history"
                    aria-haspopup="dialog"
                    onClick={() => openConfirm('clear')}
                    {...pillEvents}
                >
                    {confirming !== 'clear' ? <PillSurface action="clear" reduceMotion={reduceMotion} /> : null}
                    <span>Clear</span>
                </button>
            </div>
            <AnimatePresence>
                {confirming ? (
                    <PeerConfirm
                        key={confirming}
                        action={confirming}
                        reduceMotion={reduceMotion}
                        onCancel={closeConfirm}
                    />
                ) : null}
            </AnimatePresence>
        </>
    );
}

const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' });
const dayMonthYear = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/** "SEP" in the date tile. */
const MONTH_SHORT = new Intl.DateTimeFormat('en', { month: 'short' });

function formatSavedDate(savedAt: number) {
    const date = new Date(savedAt);
    return (date.getFullYear() === new Date().getFullYear() ? dayMonth : dayMonthYear).format(date);
}

/** Two tucked cards behind a message-row card, fading into the card surface. */
function StackedCardsIllustration() {
    return (
        <div aria-hidden="true" className="stacked-cards">
            <div className="stacked-cards__back" />
            <div className="stacked-cards__middle" />
            <div className="stacked-cards__front">
                <div className="stacked-cards__avatar" />
                <div className="stacked-cards__lines">
                    <div className="stacked-cards__line" />
                    <div className="stacked-cards__line stacked-cards__line--short" />
                </div>
            </div>
            <div className="stacked-cards__fade" />
        </div>
    );
}

/** Saved Messages card: rows share one sliding hover highlight (sidebar spring). */
function SavedMessages() {
    const items = useSyncExternalStore(subscribeSavedMessages, getActiveSavedMessages);
    const listRef = useRef<HTMLUListElement>(null);
    const [highlightBounds, setHighlightBounds] = useState<HighlightBounds | null>(null);
    const reduceMotion = useReducedMotion() === true;

    // Layout offsets, not getBoundingClientRect: the highlight lives inside the
    // scrolling list (so it must be in the list's scroll space), and the cards
    // enter with a small translate (a mid-animation rect put it off by pixels).
    const setHighlightFromElement = useCallback((element: HTMLElement | null) => {
        const list = listRef.current;
        if (!(element && list && list.contains(element))) return;
        setHighlightBounds({
            top: element.offsetTop,
            left: element.offsetLeft,
            width: element.offsetWidth,
            height: element.offsetHeight,
        });
    }, []);

    return (
        <section className="saved-messages-card" aria-labelledby="uiPeerSavedTitle">
            {/* Header banner: title, privacy note, dot pattern */}
            <div className="saved-banner">
                <span className="saved-banner__dots" aria-hidden="true" />
                <h3 id="uiPeerSavedTitle" className="saved-banner__title">Saved Messages</h3>
                <p className="saved-banner__note">
                    <Lock size={12} strokeWidth={2.25} aria-hidden="true" />
                    Private notes, only on your devices
                </p>
            </div>
            {items.length ? (
                // Progressive edges (content fades + blurs at top / bottom, only
                // where more is scrolled past) — the chat list's ScrollBlur mask.
                <ScrollBlur
                    edgeVariant="mask"
                    edgeSize={28}
                    className="saved-messages-scroll"
                    contentClassName="saved-messages-scroll__content"
                >
                    <ul
                        ref={listRef}
                        className="saved-messages-list"
                        onMouseLeave={() => setHighlightBounds(null)}
                    >
                        <AnimatePresence>
                            {highlightBounds ? (
                                <motion.li
                                    key="saved-highlight"
                                    className="saved-messages-highlight"
                                    aria-hidden="true"
                                    initial={{ opacity: 0, ...highlightBounds }}
                                    animate={{ opacity: 1, ...highlightBounds }}
                                    exit={{ opacity: 0 }}
                                    transition={reduceMotion ? instantHoverTransition : listHoverTransition}
                                />
                            ) : null}
                        </AnimatePresence>
                        {items.map((item: SavedMessage) => {
                            const date = new Date(item.savedAt);
                            return (
                                <li
                                    key={item.id}
                                    className="saved-message-item"
                                    onMouseEnter={(event) => setHighlightFromElement(event.currentTarget)}
                                >
                                    {/* Opens the saved message in the thread (scroll + highlight) */}
                                    <button
                                        type="button"
                                        className="saved-message-card"
                                        title={`Saved ${formatSavedDate(item.savedAt)} — show in chat`}
                                        onFocus={(event) => setHighlightFromElement(event.currentTarget.parentElement)}
                                        onClick={() => runOverlayAction('message.highlight', { messageId: item.id })}
                                    >
                                        <time className="saved-message-date" dateTime={date.toISOString()}>
                                            <span className="saved-message-date__day">{date.getDate()}</span>
                                            <span className="saved-message-date__month">{MONTH_SHORT.format(date)}</span>
                                        </time>
                                        <span className="saved-message-body">
                                            <span className="saved-message-author">{item.author}</span>
                                            <span className="saved-message-preview">{item.text}</span>
                                        </span>
                                        <ChevronRight className="saved-message-chevron" size={16} strokeWidth={2} aria-hidden="true" />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </ScrollBlur>
            ) : (
                <div className="saved-messages-empty flex flex-1 items-center justify-center p-2">
                    <Empty className="py-4">
                        <EmptyHeader>
                            <EmptyMedia className="mb-4">
                                <StackedCardsIllustration />
                            </EmptyMedia>
                            <EmptyTitle>No saved messages</EmptyTitle>
                            <EmptyDescription className="max-w-[220px]">
                                No saved messages added yet. Forward or save messages here for quick access.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                </div>
            )}
        </section>
    );
}

export function PeerPanel() {
    return (
        <>
            <div id="uiPeerPanelScrim" className="peer-panel-scrim" hidden aria-hidden="true" />
            <div className="peer-panel-dock">
                <AsideToggle
                    id="uiPeerPanelToggle"
                    side="end"
                    controls="uiPeerPanel"
                    label="Hide conversation panel"
                    title="Hide panel"
                />
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
                            <section className="profile-info-card" aria-labelledby="uiPeerName">
                                <div id="uiPeerAvatar" className="peer-avatar peer-avatar--cover contact-avatar" aria-hidden="true" />
                                {/* Card-coloured cutout in the photo's top-right corner; the
                                    collapse toggle (#uiPeerPanelToggle, in the dock) sits in it. */}
                                <span className="profile-cover-notch" aria-hidden="true">
                                    <span className="profile-cover-notch__joint profile-cover-notch__joint--top" />
                                    <span className="profile-cover-notch__joint profile-cover-notch__joint--side" />
                                </span>
                                {/* Hide-panel button: a real child of the card, so it moves with
                                    the panel's slide (js/ui.js handles the click). The dock's edge
                                    tab only appears once the panel is collapsed, to reopen it. */}
                                <button
                                    id="uiPeerCoverToggle"
                                    className="profile-cover-toggle"
                                    type="button"
                                    aria-controls="uiPeerPanel"
                                    aria-label="Hide conversation panel"
                                    title="Hide panel"
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                                        <line x1="15" y1="3" x2="15" y2="21" />
                                        <path d="M7 8h2M7 12h2M7 16h2" />
                                    </svg>
                                </button>
                                <div className="profile-title-row">
                                    <h2 id="uiPeerName" className="peer-name profile-name" />
                                    <p id="uiPeerStatus" className="peer-status" />
                                </div>
                                <p id="uiPeerBio" className="peer-bio profile-bio" />
                                <PeerActions />
                            </section>
                            <SavedMessages />
                        </div>
                    </div>
                </aside>
            </div>
        </>
    );
}
