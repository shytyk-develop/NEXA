import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type MouseEvent } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { BellOff, Check, ChevronRight, ChevronUp, Eraser, Eye, Lock, Paintbrush, Trash2 } from 'lucide-react';
import { instantHoverTransition, listHoverTransition } from '@/lib/hoverMotion';
import { cn } from '@/lib/utils';
import { AsideToggle } from '../../components/AsideToggle';
import { Icon } from '../../components/Icon';
import { runOverlayAction } from '../../../../ui/overlays/overlayManager.js';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { OtpInput, type OtpInputHandle, type OtpStatus } from '@/components/ui/otp-input';
import { ScrollBlur } from '@/components/ui/scroll-blur';
import {
    getActiveSavedMessages,
    getSavedMessagesPeer,
    removeActiveSavedMessages,
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
/** Two lines of the 12px / 1.45 preview — the collapsed height. */
const PREVIEW_CLAMP_LINES = 2;
/** Expanded preview cap; longer texts scroll inside the card. */
const PREVIEW_MAX_PX = 220;
/** How long a collapse eases the text's and the list's scroll into place. */
const COLLAPSE_SCROLL_MS = 380;

/** Eased scrollTop tween (ease-out cubic); a newer one on the element wins. */
const scrollTweens = new WeakMap<HTMLElement, number>();
function easeScrollTop(element: HTMLElement, to: number, duration: number) {
    const from = element.scrollTop;
    const run = (scrollTweens.get(element) ?? 0) + 1;
    scrollTweens.set(element, run);
    if (duration <= 0 || Math.abs(from - to) < 1) {
        element.scrollTop = to;
        return;
    }
    const start = performance.now();
    const step = (now: number) => {
        if (scrollTweens.get(element) !== run) return;
        const t = Math.min(1, (now - start) / duration);
        element.scrollTop = from + (to - from) * (1 - (1 - t) ** 3);
        if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}
/** Card expand / collapse (the list reflows with the real height each frame). */
const previewSpring = { type: 'spring' as const, damping: 28, stiffness: 300, mass: 0.8 };
/** Edit mode's quick moves (checkbox slot, bottom bar morphs): brisk, no overshoot. */
const editSpring = { type: 'spring' as const, bounce: 0, duration: 0.22 };
/** Bottom bar morphs (Edit ⇄ Done ⇄ Cancel): a lively spring, a touch of give. */
const barMorphSpring = { type: 'spring' as const, damping: 25, stiffness: 320, mass: 0.7 };
/** Delete selected ⇄ Cancel + Confirm Delete: opacity + scale only, no blur. */
const confirmSpring = { type: 'spring' as const, damping: 25, stiffness: 320, mass: 0.6 };

/**
 * One saved message. The card area jumps to the message in the chat; the
 * hover button (only when the text runs past two lines) expands the full text
 * inline — its real height eases between the 2-line clamp and the full text
 * (capped, then it scrolls). The "deleted by" note stays under it either way.
 */
function SavedMessageCard({
    item,
    reduceMotion,
    editMode,
    selected,
    onToggleSelect,
}: {
    item: SavedMessage;
    reduceMotion: boolean;
    /** Edit mode: a checkbox slides in and a click (anywhere) selects. */
    editMode: boolean;
    selected: boolean;
    onToggleSelect: () => void;
}) {
    const liRef = useRef<HTMLLIElement>(null);
    const textRef = useRef<HTMLParagraphElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    /** The list's scroll viewport while a collapse is running (per-frame clamp). */
    const collapseViewport = useRef<HTMLElement | null>(null);
    const [expanded, setExpanded] = useState(false);
    // The clamp comes off before growing and back on only after shrinking,
    // so the ellipsis never snaps mid-motion.
    const [clamped, setClamped] = useState(true);
    // Scrollable only once fully open (no scrollbar flashing while it grows).
    const [scrollable, setScrollable] = useState(false);
    const [heights, setHeights] = useState<{ collapsed: number; full: number } | null>(null);
    const date = new Date(item.savedAt);

    // Measure the 2-line height and the full text height (card width changes → re-measure).
    useLayoutEffect(() => {
        const text = textRef.current;
        if (!text) return undefined;
        const measure = () => {
            const lineHeight = parseFloat(getComputedStyle(text).lineHeight) || 17;
            // A deleted original's card also carries the "deleted by" line: one
            // preview line keeps it at the same collapsed card height (76px).
            const collapsed = Math.round(lineHeight * (item.isOriginalDeleted ? 1 : PREVIEW_CLAMP_LINES));
            const clampClass = ['is-clamped', 'is-clamped-1'].find((name) => text.classList.contains(name));
            if (clampClass) text.classList.remove(clampClass);
            const full = text.scrollHeight;
            if (clampClass) text.classList.add(clampClass);
            setHeights((prev) => (prev && prev.collapsed === collapsed && prev.full === full ? prev : { collapsed, full }));
        };
        measure();
        // Re-measure once the width has settled, not on every frame of a resize
        // (edit mode's checkbox slot animates every card's width: measuring per
        // frame re-rendered each card and re-aimed its height spring each frame).
        let timer = 0;
        const observer = new ResizeObserver(() => {
            window.clearTimeout(timer);
            timer = window.setTimeout(measure, 60);
        });
        observer.observe(text.parentElement ?? text);
        return () => {
            window.clearTimeout(timer);
            observer.disconnect();
        };
    }, [item.text, item.isOriginalDeleted]);

    const canExpand = Boolean(heights && heights.full > heights.collapsed + 2);
    const target = heights
        ? expanded
            ? Math.min(heights.full, PREVIEW_MAX_PX)
            : Math.min(heights.full, heights.collapsed)
        : undefined;

    const toggle = (event: MouseEvent) => {
        event.stopPropagation();
        // A mouse click mustn't leave focus (and so the eye) behind; a keyboard
        // press (detail 0) keeps it, so the next key still works.
        if (event.detail > 0) (event.currentTarget as HTMLElement).blur();
        if (expanded) prepareCollapse();
        setScrollable(false);
        if (!expanded) setClamped(false);
        setExpanded((value) => !value);
    };

    /**
     * Collapsing: freeze the text's own scroll right away (before React
     * re-renders), ease it back to the top, and move the list to where its
     * scroll will end up once the card has shrunk — over the collapse itself,
     * so the cards above arrive with it instead of dropping in at the end.
     */
    const prepareCollapse = () => {
        const preview = previewRef.current;
        if (!preview || !heights) return;
        preview.style.overflowY = 'hidden';
        const duration = reduceMotion ? 0 : COLLAPSE_SCROLL_MS;
        easeScrollTop(preview, 0, duration);

        const viewport = liRef.current?.closest<HTMLElement>('[data-slot="scroll-blur-viewport"]');
        if (!viewport) return;
        const shrink = preview.offsetHeight - Math.min(heights.full, heights.collapsed);
        const endMax = Math.max(0, viewport.scrollHeight - shrink - viewport.clientHeight);
        if (viewport.scrollTop > endMax) easeScrollTop(viewport, endMax, duration);
        collapseViewport.current = viewport;
    };

    // Jumping needs the chat message; a deleted one has none — there the card
    // area expands / collapses the text instead (so it never feels dead).
    const onCardClick = (event: MouseEvent) => {
        if (editMode) {
            onToggleSelect();
        } else if (!item.isOriginalDeleted) {
            runOverlayAction('message.jump', {
                messageId: item.chatMessageId || item.id,
                clientMessageId: item.clientMessageId ?? null,
            });
        } else if (canExpand) {
            toggle(event);
        }
    };

    return (
        <li
            ref={liRef}
            className="saved-message-item"
        >
            <div
                className={cn(
                    'saved-message-card',
                    item.isOriginalDeleted && 'is-deleted',
                    expanded && 'is-expanded',
                    editMode && 'is-editing',
                    selected && 'is-selected',
                )}
            >
                {/* The whole card: jump to the message in the chat (deleted: expand) */}
                <button
                    type="button"
                    className="saved-message-card__open"
                    aria-label={`${item.author}: ${item.text.slice(0, 80)}`}
                    role={editMode ? 'checkbox' : undefined}
                    aria-checked={editMode ? selected : undefined}
                    aria-disabled={(!editMode && item.isOriginalDeleted && !canExpand) || undefined}
                    aria-expanded={!editMode && item.isOriginalDeleted && canExpand ? expanded : undefined}
                    title={
                        editMode
                            ? selected
                                ? 'Deselect'
                                : 'Select'
                            : item.isOriginalDeleted
                            ? canExpand
                                ? `Deleted in chat — ${expanded ? 'collapse' : 'view the saved text'}`
                                : `Saved ${formatSavedDate(item.savedAt)} — deleted in chat`
                            : `Saved ${formatSavedDate(item.savedAt)} — show in chat`
                    }
                    onClick={onCardClick}
                />
                {/* Edit mode: the checkbox slot opens its real width, so the rest eases over */}
                <AnimatePresence initial={false}>
                    {editMode ? (
                        <motion.span
                            key="check"
                            className="saved-message-check-slot"
                            aria-hidden="true"
                            initial={{ opacity: 0, x: -12, width: 0, marginRight: -12 }}
                            animate={{ opacity: 1, x: 0, width: 18, marginRight: 0 }}
                            exit={{ opacity: 0, x: -12, width: 0, marginRight: -12 }}
                            transition={reduceMotion ? { duration: 0 } : editSpring}
                        >
                            <span className={cn('saved-message-check', selected && 'is-checked')}>
                                <AnimatePresence initial={false}>
                                    {selected ? (
                                        <motion.span
                                            key="tick"
                                            className="saved-message-check__tick"
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0.5, opacity: 0 }}
                                            transition={reduceMotion ? { duration: 0 } : { type: 'spring', bounce: 0.3, duration: 0.3 }}
                                        >
                                            <Check size={12} strokeWidth={3} />
                                        </motion.span>
                                    ) : null}
                                </AnimatePresence>
                            </span>
                        </motion.span>
                    ) : null}
                </AnimatePresence>
                <time className="saved-message-date" dateTime={date.toISOString()}>
                    <span className="saved-message-date__day">{date.getDate()}</span>
                    <span className="saved-message-date__month">{MONTH_SHORT.format(date)}</span>
                </time>
                <span className="saved-message-body">
                    <span className="saved-message-author">{item.author}</span>
                    <motion.div
                        ref={previewRef}
                        className={cn('saved-message-expanded-content', expanded && (scrollable || reduceMotion) && 'is-open')}
                        initial={false}
                        animate={target != null ? { height: target } : undefined}
                        transition={reduceMotion ? { duration: 0 } : previewSpring}
                        onUpdate={() => {
                            // While collapsing, never let the list hang past its end.
                            const viewport = collapseViewport.current;
                            if (!viewport) return;
                            const max = viewport.scrollHeight - viewport.clientHeight;
                            if (viewport.scrollTop > max) viewport.scrollTop = max;
                        }}
                        onAnimationComplete={() => {
                            if (previewRef.current) previewRef.current.style.overflowY = '';
                            collapseViewport.current = null;
                            if (expanded) setScrollable(true);
                            else setClamped(true);
                        }}
                    >
                        <p
                            ref={textRef}
                            className={cn(
                                'saved-message-preview',
                                clamped && (item.isOriginalDeleted ? 'is-clamped-1' : 'is-clamped'),
                            )}
                        >
                            {item.text}
                        </p>
                    </motion.div>
                    {/* The chat message is gone; this saved copy stays */}
                    {item.isOriginalDeleted ? (
                        <span className="saved-message-deleted" title={`Deleted in chat by ${item.deletedBy || 'author'}`}>
                            <Trash2 size={12} strokeWidth={2.2} aria-hidden="true" />
                            <span className="saved-message-deleted__text">Deleted by {item.deletedBy || 'author'}</span>
                        </span>
                    ) : null}
                </span>
                <span className="saved-message-actions">
                    {canExpand && !editMode ? (
                        <button
                            type="button"
                            className="saved-message-expand"
                            aria-expanded={expanded}
                            aria-label={expanded ? 'Collapse' : 'View inline'}
                            title={expanded ? 'Collapse' : 'View inline'}
                            onClick={toggle}
                        >
                            {expanded ? <ChevronUp size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
                        </button>
                    ) : null}
                    <ChevronRight className="saved-message-chevron" size={16} strokeWidth={2} aria-hidden="true" />
                </span>
            </div>
        </li>
    );
}

function SavedMessages() {
    const items = useSyncExternalStore(subscribeSavedMessages, getActiveSavedMessages);
    const peer = useSyncExternalStore(subscribeSavedMessages, getSavedMessagesPeer);
    const listRef = useRef<HTMLUListElement>(null);
    const reduceMotion = useReducedMotion() === true;

    // Edit mode: select cards, then delete them in two steps (bar → confirm).
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
    const [confirming, setConfirming] = useState(false);

    const exitEditMode = useCallback(() => {
        setIsEditMode(false);
        setSelectedIds(new Set());
        setConfirming(false);
    }, []);

    // Another chat, or nothing left to edit: leave edit mode.
    useEffect(() => {
        exitEditMode();
    }, [peer, exitEditMode]);
    useEffect(() => {
        if (!items.length) exitEditMode();
        // Drop selections of items that are gone.
        setSelectedIds((prev) => {
            const next = new Set([...prev].filter((id) => items.some((item) => item.id === id)));
            return next.size === prev.size ? prev : next;
        });
    }, [items, exitEditMode]);

    // Escape backs out one step: the confirmation, then edit mode.
    useEffect(() => {
        if (!isEditMode) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (confirming) setConfirming(false);
            else exitEditMode();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isEditMode, confirming, exitEditMode]);

    const toggleEditMode = () => {
        if (isEditMode) exitEditMode();
        else {
            setSelectedIds(new Set());
            setConfirming(false);
            setIsEditMode(true);
        }
    };

    const toggleSelect = (id: string) => {
        setConfirming(false);
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const deleteSelected = () => {
        removeActiveSavedMessages([...selectedIds]);
        exitEditMode();
    };

    const count = selectedIds.size;
    // Always there when there's something to manage (it's the Edit entry too).
    const showBar = items.length > 0;
    const barGroupId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const barSpring = reduceMotion ? { duration: 0 } : barMorphSpring;
    const confirmTransition = reduceMotion ? { duration: 0 } : confirmSpring;
    // Label swap: the old one dissolves fast (before the pill reshapes), the
    // new one blurs in just behind it.
    const labelFade = reduceMotion
        ? { initial: false as const }
        : {
              initial: { opacity: 0, filter: 'blur(3px)' },
              animate: { opacity: 1, filter: 'blur(0px)' },
              exit: { opacity: 0, filter: 'blur(3px)' },
              transition: { duration: 0.12 },
          };

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
                        className={cn('saved-messages-list', showBar && 'has-bar')}
                    >
                        {items.map((item: SavedMessage) => (
                            <SavedMessageCard
                                key={item.id}
                                item={item}
                                reduceMotion={reduceMotion}
                                editMode={isEditMode}
                                selected={selectedIds.has(item.id)}
                                onToggleSelect={() => toggleSelect(item.id)}
                            />
                        ))}
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

            {/* Bottom control:
                  idle     a compact [✎ Edit] pill, centred
                  editing  the pill keeps its size and slides to the left edge as
                           [Done]; the bar's ground fades in behind it and the
                           count + [Delete selected] slide in from the right
                  confirm  [ Cancel | Confirm Delete ]
                Pill and red button are shared layout elements; labels crossfade. */}
            <AnimatePresence>
                {showBar ? (
                    <motion.div
                        key="dock"
                        className={cn('saved-edit-dock', isEditMode && 'is-editing', confirming && 'is-confirming')}
                        role="group"
                        aria-label="Manage saved messages"
                        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 12 }}
                        transition={barSpring}
                    >
                        <LayoutGroup id={`${barGroupId}-bar`}>
                            {/* The bar's ground: only while editing */}
                            <AnimatePresence initial={false}>
                                {isEditMode ? (
                                    <motion.span
                                        key="ground"
                                        className="saved-edit-dock__ground"
                                        aria-hidden="true"
                                        initial={reduceMotion ? false : { opacity: 0, scaleX: 0.55 }}
                                        animate={{ opacity: 1, scaleX: 1 }}
                                        exit={{ opacity: 0, scaleX: 0.55 }}
                                        transition={barSpring}
                                    />
                                ) : null}
                            </AnimatePresence>

                            <AnimatePresence mode="popLayout" initial={false}>
                                {confirming ? (
                                    // Confirm: two equal capsules spring in on the same spot
                                    <motion.div
                                        key="confirm"
                                        layout
                                        className="saved-edit-confirm"
                                        transition={confirmTransition}
                                    >
                                        <motion.button
                                            type="button"
                                            className="saved-edit-bar__btn saved-edit-confirm__btn"
                                            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            transition={confirmTransition}
                                            onClick={() => setConfirming(false)}
                                        >
                                            Cancel
                                        </motion.button>
                                        <motion.button
                                            type="button"
                                            className="saved-edit-bar__btn saved-edit-bar__btn--danger saved-edit-confirm__btn"
                                            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            transition={confirmTransition}
                                            aria-label={`Confirm: delete ${count} saved ${count === 1 ? 'message' : 'messages'}`}
                                            onClick={deleteSelected}
                                        >
                                            Confirm Delete
                                        </motion.button>
                                    </motion.div>
                                ) : (
                                    // Main row: [✎ Edit] centred, or [Done · N · Delete selected]
                                    <motion.div
                                        key="main"
                                        className="saved-edit-main"
                                        initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
                                        transition={confirmTransition}
                                    >
                                        <motion.button
                                            type="button"
                                            // Position only: the pill slides but is never scaled, so the
                                            // label inside can't stretch (its size stays fixed by CSS).
                                            layout="position"
                                            layoutId={`${barGroupId}-edit-pill`}
                                            className="saved-edit-pill"
                                            style={{ borderRadius: 999 }}
                                            transition={barSpring}
                                            aria-pressed={isEditMode}
                                            onClick={toggleEditMode}
                                        >
                                            <AnimatePresence mode="popLayout" initial={false}>
                                                <motion.span
                                                    key={isEditMode ? 'done' : 'edit'}
                                                    className="saved-edit-bar__btn-label"
                                                    {...labelFade}
                                                >
                                                    {!isEditMode ? <Paintbrush size={14} strokeWidth={2} aria-hidden="true" /> : null}
                                                    {isEditMode ? 'Done' : 'Edit'}
                                                </motion.span>
                                            </AnimatePresence>
                                        </motion.button>

                                        <AnimatePresence mode="popLayout" initial={false}>
                                            {isEditMode ? (
                                                <motion.span
                                                    key="count"
                                                    layout="position"
                                                    className="saved-edit-bar__count"
                                                    aria-live="polite"
                                                    aria-label={`${count} selected`}
                                                    initial={reduceMotion ? false : { opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20, transition: { duration: 0.1 } }}
                                                    transition={barSpring}
                                                >
                                                    {count}
                                                </motion.span>
                                            ) : null}
                                        </AnimatePresence>

                                        <AnimatePresence mode="popLayout" initial={false}>
                                            {isEditMode ? (
                                                <motion.button
                                                    key="danger"
                                                    type="button"
                                                    layout="position"
                                                    className="saved-edit-bar__btn saved-edit-bar__btn--danger"
                                                    style={{ borderRadius: 999 }}
                                                    initial={reduceMotion ? false : { opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20, transition: { duration: 0.1 } }}
                                                    transition={barSpring}
                                                    disabled={count === 0}
                                                    onClick={() => setConfirming(true)}
                                                >
                                                    <span className="saved-edit-bar__btn-label">
                                                        <Trash2 size={14} strokeWidth={2.25} aria-hidden="true" />
                                                        Delete selected
                                                    </span>
                                                </motion.button>
                                            ) : null}
                                        </AnimatePresence>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </LayoutGroup>
                    </motion.div>
                ) : null}
            </AnimatePresence>
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
