// Copy + Delete buttons for the inline message quick bar (js/messageQuickBar.js).
// Ported from the motion "Copy button" and "Native delete" components; mounted as a
// small React island because the rest of the quick bar is vanilla DOM.
//
// Size changes (Copy → "Copied!", Delete → "Confirm ✕") animate the *real* width
// (AutoWidth) instead of motion's transform-based `layout`: with `layout` the box
// snaps to its new size and only its paint is tweened, so the reactions strip next
// to it (plain flex) would jump. Real width lets the strip reflow frame by frame.
// Hover / press scale lives in CSS so every button in the bar shares it.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react';
import { Check, Trash2, X } from 'lucide-react';
import LinkWarningRow, { type LinkWarningRowProps } from './LinkWarningRow';

/** Re-exported for the quick bar's vanilla hover highlight (keeps motion out of the entry chunk). */
export { animate } from 'motion/react';

/** Shared by every size change so neighbours move in step. */
const widthSpring = { type: 'spring' as const, bounce: 0, duration: 0.35 };

/**
 * Animates its width to its content's natural width. Clips only while resizing,
 * so hover scale / focus rings aren't cut off at rest.
 */
function AutoWidth({ className, children }: { className?: string; children: ReactNode }) {
    const innerRef = useRef<HTMLSpanElement>(null);
    const [width, setWidth] = useState<number | null>(null);
    const [resizing, setResizing] = useState(false);
    const reduceMotion = useReducedMotion();

    useLayoutEffect(() => {
        const inner = innerRef.current;
        if (!inner) return;
        const observer = new ResizeObserver(() => setWidth(inner.offsetWidth));
        observer.observe(inner);
        return () => observer.disconnect();
    }, []);

    return (
        <motion.span
            className={className}
            style={{ display: 'inline-flex', flex: 'none', overflow: resizing ? 'hidden' : 'visible' }}
            initial={false}
            animate={width == null ? undefined : { width }}
            transition={reduceMotion ? { duration: 0 } : widthSpring}
            onAnimationStart={() => setResizing(true)}
            onAnimationComplete={() => setResizing(false)}
        >
            <span ref={innerRef} className="message-quickbar__autowidth">
                {children}
            </span>
        </motion.span>
    );
}

// ── Copy ───────────────────────────────────────────────────────────────────────

const swapSpring = { stiffness: 260, damping: 18 };
const checkSpring = { stiffness: 300, damping: 25 };
const copyResetDelay = 2000;

const labelVariants = {
    initial: { opacity: 0, filter: 'blur(4px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, filter: 'blur(4px)' },
};

function CopyIcon() {
    return (
        <svg
            className="ui-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg
            className="ui-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <motion.path
                d="M4 12l5 5L20 6"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ type: 'spring', ...checkSpring, delay: 0.1 }}
            />
        </svg>
    );
}

function CopyButton({ disabled, onCopy }: { disabled: boolean; onCopy: () => Promise<boolean> }) {
    const [copied, setCopied] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }, []);

    const onClick = async () => {
        if (copied || disabled) return;
        // Only celebrate once the clipboard write actually went through.
        if (!(await onCopy())) return;
        setCopied(true);
        timeoutRef.current = setTimeout(() => setCopied(false), copyResetDelay);
    };

    return (
        <button
            type="button"
            className="message-quickbar__action"
            disabled={disabled}
            aria-label={copied ? 'Copied' : 'Copy'}
            data-copied={copied || undefined}
            onClick={onClick}
        >
            <AutoWidth>
                {/* popLayout: the outgoing label leaves the flow at once, so the width
                    tweens straight to the incoming one. */}
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                        key={copied ? 'copied' : 'copy'}
                        className="message-quickbar__swap"
                        variants={labelVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{ type: 'spring', ...swapSpring, staggerChildren: copied ? 0.2 : 0 }}
                    >
                        <motion.span className="message-quickbar__icon" variants={labelVariants}>
                            {copied ? <CheckIcon /> : <CopyIcon />}
                        </motion.span>
                        <motion.span className="message-quickbar__label" variants={labelVariants}>
                            {copied ? 'Copied!' : 'Copy'}
                        </motion.span>
                    </motion.span>
                </AnimatePresence>
            </AutoWidth>
        </button>
    );
}

// ── Delete (two-step: Delete → Confirm / ✕) ─────────────────────────────────────

/** Width the ✕ slot opens to: the 28px icon button plus a 2px gap. */
const CANCEL_SLOT_WIDTH = 30;

function DeleteButton({ onDelete }: { onDelete: () => void }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const reduceMotion = useReducedMotion();

    return (
        <MotionConfig transition={reduceMotion ? { duration: 0 } : widthSpring}>
            <span className="message-quickbar__delete">
                {/* AutoWidth sits *inside* the capsule: the button itself grows with its
                    rounded ends intact, and only its (background-less) label is clipped. */}
                <button
                    type="button"
                    className={`message-quickbar__action is-danger${isExpanded ? ' is-confirming' : ''}`}
                    aria-label={isExpanded ? 'Confirm delete' : 'Delete'}
                    onClick={isExpanded ? onDelete : () => setIsExpanded(true)}
                >
                    <AutoWidth>
                        <span className="message-quickbar__swap">
                            <AnimatePresence mode="popLayout" initial={false}>
                                <motion.span
                                    key={isExpanded ? 'check-icon' : 'trash-icon'}
                                    className="message-quickbar__icon"
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    {isExpanded ? <Check className="ui-icon" /> : <Trash2 className="ui-icon" />}
                                </motion.span>
                            </AnimatePresence>
                            <AnimatePresence mode="popLayout" initial={false}>
                                <motion.span
                                    key={isExpanded ? 'confirm' : 'delete'}
                                    className="message-quickbar__label"
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    {isExpanded ? 'Confirm' : 'Delete'}
                                </motion.span>
                            </AnimatePresence>
                        </span>
                    </AutoWidth>
                </button>

                {/* The ✕ gets its own slot that opens/closes in width (never clipped),
                    so the strip beside it gives way in step. */}
                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.span
                            key="cancel-slot"
                            className="message-quickbar__cancel-slot"
                            initial={{ width: 0 }}
                            animate={{ width: CANCEL_SLOT_WIDTH }}
                            exit={{ width: 0 }}
                        >
                            <motion.span
                                className="message-quickbar__icon"
                                initial={{ opacity: 0, scale: 0.8, x: -8 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.8, x: -8 }}
                            >
                                <button
                                    type="button"
                                    className="message-quickbar__action message-quickbar__action--icon"
                                    aria-label="Cancel delete"
                                    onClick={() => setIsExpanded(false)}
                                >
                                    <X className="ui-icon" />
                                </button>
                            </motion.span>
                        </motion.span>
                    )}
                </AnimatePresence>
            </span>
        </MotionConfig>
    );
}

// ── Mount ──────────────────────────────────────────────────────────────────────

export interface QuickBarButtonsProps {
    canCopy: boolean;
    /** Resolves true when the text reached the clipboard. */
    onCopy: () => Promise<boolean>;
    /** Delete is offered only when set (own, synced messages). Called after Confirm. */
    onDelete?: () => void;
}

function QuickBarButtons({ canCopy, onCopy, onDelete }: QuickBarButtonsProps) {
    return (
        <>
            <CopyButton disabled={!canCopy} onCopy={onCopy} />
            {onDelete ? <DeleteButton onDelete={onDelete} /> : null}
        </>
    );
}

/**
 * Render synchronously into `host` (the quick bar measures its open width right
 * after building), returning an unmount function.
 */
export function mountQuickBarButtons(host: HTMLElement, props: QuickBarButtonsProps): () => void {
    const root = createRoot(host);
    flushSync(() => root.render(<QuickBarButtons {...props} />));
    return () => root.unmount();
}

// ── External link warning row (js/messageLinkBar.js) ──────────────────────────

export function mountLinkWarningRow(hostEl: HTMLElement, props: LinkWarningRowProps): () => void {
    const root = createRoot(hostEl);
    flushSync(() => root.render(<LinkWarningRow {...props} />));
    return () => root.unmount();
}
