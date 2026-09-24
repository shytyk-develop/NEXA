// The external-link warning row inside a message bubble: [Hold to open] … [Pause ⇄].
// "Pause" is adapted from the "TwentyThreeFour" option picker: its pill grows into
// a full-row option bar — ✕ · 1 day · 1 week · 1 month · Off · ✓ — while the hold
// button fades back behind it. ✕ backs out without changing anything; ✓ applies.
//
// Motion: one backdrop, pinned to the row's right edge, springs its *real* width
// from the trigger to the full row (no layoutId scale morph, so its rounded ends
// never stretch). The trigger label fades as it starts to grow, then the options
// stagger in left to right; closing reverses it with a quick fade first.
//
// Width: compact while closed. The row's own width springs between its closed
// size and the open bar's (measured from a hidden copy) in step with the
// backdrop, and the bubble — sized to its content for this panel — follows it
// frame by frame, widening only as much as the options need.

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { LayoutGroup, motion, MotionConfig, useReducedMotion, type Variants } from 'motion/react';
import { Check, ChevronsUpDown, ExternalLink, X } from 'lucide-react';
import { HoldToConfirmButton } from '@/components/ui/hold-to-confirm';

/** Backdrop grow / shrink — soft, no overshoot. */
const growSpring = { type: 'spring', bounce: 0, duration: 0.45 } as const;
/** Selected-option highlight slide (from the original component). */
const springTransition = { type: 'spring', damping: 30, stiffness: 400, mass: 1 } as const;
/** Options wait for the backdrop to get going, then cascade in. */
const ITEM_ENTER_DELAY = 0.08;
const ITEM_STAGGER = 0.035;

/** How long "Hold to open" must be held. */
const HOLD_TO_OPEN_MS = 1000;
/** Space between "Hold to open" and "Pause" — keep in sync with .lw-row__closed gap. */
const CLOSED_GAP = 6;

export interface LinkWarningOption {
    id: string;
    label: string;
}

export interface LinkWarningRowProps {
    /** Shown in the hold button's accessible name ("Hold to open example.com"). */
    host: string;
    options: LinkWarningOption[];
    /** Opens the link — on completion (mouse / keyboard) or on release (touch). */
    onOpen: () => void;
    /** Applies a pause option (✓ in the option bar). */
    onPause: (optionId: string) => void;
}

/**
 * Enter: slide in from the right, staggered by position. Leave: quick fade, all
 * at once. Opacity + transform only — compositor work, no per-frame repaint. (A
 * blur here made the *first* open stutter while the browser built a filter layer
 * for every item.)
 */
const itemVariants: Variants = {
    hidden: { opacity: 0, x: 8, transition: { duration: 0.12 } },
    shown: (index: number) => ({
        opacity: 1,
        x: 0,
        transition: { type: 'spring', bounce: 0, duration: 0.35, delay: ITEM_ENTER_DELAY + index * ITEM_STAGGER },
    }),
};

function useWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(0);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const update = () => setWidth(el.offsetWidth);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return [ref, width] as const;
}

function LinkWarningRow({ host, options, onOpen, onPause }: LinkWarningRowProps) {
    const layoutPrefix = `lw-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const reduceMotion = useReducedMotion();
    const [isOpen, setIsOpen] = useState(false);
    const [selected, setSelected] = useState(options[0]?.id ?? '');
    const [holdRef, holdWidth] = useWidth<HTMLDivElement>();
    const [triggerRef, triggerWidth] = useWidth<HTMLButtonElement>();
    const [openSizerRef, openWidth] = useWidth<HTMLDivElement>();
    const barRef = useRef<HTMLDivElement>(null);
    const wasOpen = useRef(false);

    // Keyboard: focus the selected option on open, the trigger on close.
    useEffect(() => {
        if (isOpen) {
            barRef.current?.querySelector<HTMLElement>(`[data-option="${selected}"]`)?.focus({ preventScroll: true });
        } else if (wasOpen.current) {
            triggerRef.current?.focus({ preventScroll: true });
        }
        wasOpen.current = isOpen;
        // Only on open/close — not while moving between options.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const cancel = () => setIsOpen(false);

    const onBarKeyDown = (event: KeyboardEvent) => {
        // Escape backs out of the option bar only, not the whole bubble panel.
        if (event.key === 'Escape') {
            event.stopPropagation();
            cancel();
            return;
        }
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        if (!(event.target as HTMLElement).closest('[data-option]')) return;
        event.preventDefault();
        const index = options.findIndex((o) => o.id === selected);
        const next = options[(index + (event.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length];
        setSelected(next.id);
        barRef.current?.querySelector<HTMLElement>(`[data-option="${next.id}"]`)?.focus({ preventScroll: true });
    };

    // First measurement lands instantly (no grow-from-zero when the panel opens);
    // only real open/close changes spring.
    const [measured, setMeasured] = useState(false);
    useEffect(() => {
        if (!triggerWidth || measured) return;
        const frame = window.requestAnimationFrame(() => setMeasured(true));
        return () => window.cancelAnimationFrame(frame);
    }, [triggerWidth, measured]);

    const fade = reduceMotion ? { duration: 0 } : { duration: 0.18 };
    const closedWidth = holdWidth + CLOSED_GAP + triggerWidth;
    const rowWidth = isOpen ? Math.max(openWidth, closedWidth) : closedWidth;
    const backdropWidth = isOpen ? rowWidth : triggerWidth;
    const widthTransition = reduceMotion || !measured ? { duration: 0 } : growSpring;
    const itemState = isOpen ? 'shown' : 'hidden';

    return (
        <MotionConfig reducedMotion="user">
            <LayoutGroup id={layoutPrefix}>
                <motion.div
                    className="lw-row"
                    data-open={isOpen || undefined}
                    initial={false}
                    animate={triggerWidth ? { width: rowWidth } : undefined}
                    transition={widthTransition}
                >
                    {/* Measures the open bar (out of flow — it doesn't reserve space). */}
                    <div ref={openSizerRef} className="lw-row__sizer" aria-hidden="true">
                        <span className="lw-select__icon-btn" />
                        <span className="lw-select__chips">
                            {options.map((option) => (
                                <span key={option.id} className="lw-select__chip">
                                    <span className="lw-select__chip-label">{option.label}</span>
                                </span>
                            ))}
                        </span>
                        <span className="lw-select__icon-btn" />
                    </div>

                    {/* One backdrop for both states: grows right → left by real width.
                        Mounted once the trigger is measured, starting at its width. */}
                    {triggerWidth > 0 && (
                        <motion.span
                            className="lw-select__bg"
                            initial={{ width: triggerWidth }}
                            animate={{ width: backdropWidth }}
                            transition={widthTransition}
                        />
                    )}

                    <div className="lw-row__layer lw-row__closed">
                        <motion.div
                            ref={holdRef}
                            className="lw-row__hold"
                            animate={{ opacity: isOpen ? 0 : 1, scale: isOpen ? 0.96 : 1 }}
                            transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            inert={isOpen || undefined}
                        >
                            <HoldToConfirmButton
                                className="message-quickbar__action message-linkbar__hold"
                                size="sm"
                                duration={HOLD_TO_OPEN_MS}
                                label="Hold to open"
                                armedLabel="Release to open"
                                confirmedLabel="Opened"
                                ariaLabel={`Hold to open ${host}. Press and hold for 1 second to confirm`}
                                icon={<ExternalLink size={12} strokeWidth={2} />}
                                resetDelay={0}
                                confirmOnTouchRelease
                                onConfirm={onOpen}
                            />
                        </motion.div>

                        <motion.button
                            ref={triggerRef}
                            type="button"
                            className="lw-select__trigger"
                            aria-haspopup="true"
                            aria-expanded={isOpen}
                            aria-label="Pause link warnings"
                            tabIndex={isOpen ? -1 : 0}
                            animate={{ opacity: isOpen ? 0 : 1 }}
                            // Out fast so the growing pill reads as empty; back in once it has shrunk.
                            transition={isOpen ? fade : { ...fade, delay: reduceMotion ? 0 : 0.18 }}
                            style={{ pointerEvents: isOpen ? 'none' : undefined }}
                            onClick={() => setIsOpen(true)}
                        >
                            <span className="lw-select__trigger-label">Pause</span>
                            <span className="lw-select__trigger-icon">
                                <ChevronsUpDown size={13} strokeWidth={2} />
                            </span>
                        </motion.button>
                    </div>

                    <div
                        ref={barRef}
                        className="lw-row__open"
                        // Out of flow, pinned right at the options' own width: the row (and
                        // bubble) size to the closed view alone, and as the row grows the
                        // bar is uncovered right → left without reflowing its items.
                        style={openWidth ? { width: openWidth } : undefined}
                        role="group"
                        aria-label="Pause link warnings"
                        onKeyDown={onBarKeyDown}
                        // Always mounted (so opening only flips animation state — nothing is
                        // created on the first open); unreachable while folded.
                        inert={!isOpen || undefined}
                        aria-hidden={!isOpen || undefined}
                    >
                        <motion.button
                            type="button"
                            className="lw-select__icon-btn lw-select__cancel"
                            aria-label="Cancel"
                            custom={0}
                            variants={itemVariants}
                            initial={false}
                            animate={itemState}
                            onClick={cancel}
                        >
                            <X size={13} strokeWidth={2.25} />
                        </motion.button>

                        <div className="lw-select__chips" role="radiogroup" aria-label="Pause warnings for">
                            {options.map((option, index) => {
                                const active = option.id === selected;
                                return (
                                    <motion.button
                                        key={option.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        tabIndex={active ? 0 : -1}
                                        data-option={option.id}
                                        data-active={active || undefined}
                                        className="lw-select__chip"
                                        custom={index + 1}
                                        variants={itemVariants}
                                        initial={false}
                                        animate={itemState}
                                        onClick={() => setSelected(option.id)}
                                    >
                                        {active && (
                                            <motion.span
                                                layoutId={`${layoutPrefix}-option`}
                                                transition={springTransition}
                                                className="lw-select__chip-bg"
                                                style={{ borderRadius: 999 }}
                                            />
                                        )}
                                        <span className="lw-select__chip-label">{option.label}</span>
                                    </motion.button>
                                );
                            })}
                        </div>

                        <motion.button
                            type="button"
                            className="lw-select__icon-btn lw-select__apply"
                            aria-label="Pause warnings"
                            custom={options.length + 1}
                            variants={itemVariants}
                            initial={false}
                            animate={itemState}
                            onClick={() => onPause(selected)}
                        >
                            <Check size={14} strokeWidth={2.5} />
                        </motion.button>
                    </div>
                </motion.div>
            </LayoutGroup>
        </MotionConfig>
    );
}

export default LinkWarningRow;
