// Message quick bar menu (js/messageQuickBar.js mounts it into the in-bubble
// panel): Reply · Copy · Delete · [Save ⇅] | [🙂 ⇅].
//
// Save and 🙂 open exactly like the link row's "Pause" picker
// (LinkWarningRow.tsx): the trigger's own backdrop springs its *real* size
// (left + width — the Save pill isn't at the row's end) from the pill to the
// whole row, the rest of the row fades and eases back, the trigger label fades
// out fast, and the options — always mounted, inert while folded — slide in
// from the right in a stagger. Closing reverses it with a quick fade first.
// ✕ backs out; an option applies on click. Nothing changes the row's size, so
// the bubble keeps its width. No blur: filter layers made first opens stutter.

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, LayoutGroup, motion, MotionConfig, useReducedMotion, type Variants } from 'motion/react';
import { Check, Copy, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Backdrop grow / shrink — soft, no overshoot (as in LinkWarningRow). */
const growSpring = { type: 'spring', bounce: 0, duration: 0.45 } as const;
/** How long after a selector toggles its backdrop may still be springing. */
const SELECTOR_MOVE_MS = 600;
/** Selected-option highlight slide. */
const springTransition = { type: 'spring', damping: 30, stiffness: 400, mass: 1 } as const;
/** Options wait for the backdrop to get going, then cascade in. */
const ITEM_ENTER_DELAY = 0.08;
const ITEM_STAGGER = 0.035;
/** Trigger label: out fast so the growing pill reads as empty; back once shrunk. */
const TRIGGER_FADE = 0.18;
/** The rest of the row eases back / forth under the backdrop. */
const REST_EASE = { duration: 0.3, ease: [0.22, 1, 0.36, 1] } as const;

/** Emoji offered first; "+" appends the rest (the strip scrolls). */
const FIELD_REACTIONS = ['👍', '❤️', '😂', '😮', '🔥', '🚀'];
/** Edge fade width of the emoji strip, shown only on sides with hidden content. */
const FADE_PX = 12;

type Selector = 'save' | 'react' | 'delete';

/** How long Copy shows its ✓ before going back to the copy icon. */
const COPIED_MS = 1400;
type Rect = { left: number; width: number };

export interface QuickBarMenuProps {
    canReply: boolean;
    onReply: () => void;
    canCopy: boolean;
    onCopy: () => Promise<boolean>;
    onDelete?: () => void;
    canSave: boolean;
    onSaveLocal: () => void;
    /** Set when the message is synced (reactions need a server id). */
    reactions?: { current: string | null; more: string[]; onPick: (emoji: string) => void };
}

/**
 * Enter: slide in from the right, staggered by position. Leave: quick fade, all
 * at once. Opacity + transform only (LinkWarningRow's itemVariants).
 */
const itemVariants: Variants = {
    hidden: { opacity: 0, x: 8, transition: { duration: 0.12 } },
    shown: (index: number) => ({
        opacity: 1,
        x: 0,
        transition: { type: 'spring', bounce: 0, duration: 0.35, delay: ITEM_ENTER_DELAY + index * ITEM_STAGGER },
    }),
};

function SpriteIcon({ id }: { id: string }) {
    return (
        <svg className="ui-icon" aria-hidden="true">
            <use href={`#${id}`} />
        </svg>
    );
}

/** The emoji strip inside the 🙂 bar: scrolls, fades its edges, wheel → horizontal. */
function EmojiStrip({
    reactions,
    selected,
    shown,
    layoutPrefix,
    onPick,
}: {
    reactions: NonNullable<QuickBarMenuProps['reactions']>;
    selected: string | null;
    shown: boolean;
    layoutPrefix: string;
    onPick: (emoji: string) => void;
}) {
    const stripRef = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false);
    const list = expanded ? [...FIELD_REACTIONS, ...reactions.more] : FIELD_REACTIONS;
    const state = shown ? 'shown' : 'hidden';

    const syncFades = () => {
        const strip = stripRef.current;
        if (!strip) return;
        const max = strip.scrollWidth - strip.clientWidth;
        strip.style.setProperty('--qb-fade-l', strip.scrollLeft > 1 ? `${FADE_PX}px` : '0px');
        strip.style.setProperty('--qb-fade-r', strip.scrollLeft < max - 1 ? `${FADE_PX}px` : '0px');
    };

    useLayoutEffect(() => {
        const strip = stripRef.current;
        if (!strip) return undefined;
        syncFades();
        const observer = new ResizeObserver(syncFades);
        observer.observe(strip);
        const onWheel = (event: WheelEvent) => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
            if (strip.scrollWidth <= strip.clientWidth) return;
            event.preventDefault();
            strip.scrollBy({ left: event.deltaY });
        };
        strip.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            observer.disconnect();
            strip.removeEventListener('wheel', onWheel);
        };
    }, []);

    return (
        <div ref={stripRef} className="qb-select__strip" role="group" aria-label="Reactions" onScroll={syncFades}>
            {list.map((emoji, index) => {
                const active = selected === emoji;
                return (
                    <motion.button
                        key={emoji}
                        type="button"
                        className={cn('qb-select__chip qb-select__chip--emoji', active && 'is-active')}
                        title={`React ${emoji}`}
                        aria-label={`React ${emoji}`}
                        aria-pressed={active}
                        data-option={emoji}
                        custom={index + 1}
                        variants={itemVariants}
                        initial={false}
                        animate={state}
                        onClick={() => onPick(emoji)}
                    >
                        {active && (
                            <motion.span
                                layoutId={`${layoutPrefix}-react-option`}
                                transition={springTransition}
                                className="qb-select__chip-bg"
                                style={{ borderRadius: 999 }}
                            />
                        )}
                        <span className="qb-select__chip-label">{emoji}</span>
                    </motion.button>
                );
            })}
            {!expanded && reactions.more.length ? (
                <motion.button
                    type="button"
                    className="qb-select__chip qb-select__chip--emoji qb-select__more"
                    title="More reactions"
                    aria-label="More reactions"
                    custom={list.length + 1}
                    variants={itemVariants}
                    initial={false}
                    animate={state}
                    onClick={() => {
                        setExpanded(true);
                        requestAnimationFrame(() => {
                            const strip = stripRef.current;
                            const first = strip?.children[FIELD_REACTIONS.length] as HTMLElement | undefined;
                            strip?.scrollTo({ left: first?.offsetLeft ?? strip.scrollWidth, behavior: 'smooth' });
                        });
                    }}
                >
                    <SpriteIcon id="icon-plus" />
                </motion.button>
            ) : null}
        </div>
    );
}

function QuickBarMenu({ canReply, onReply, canCopy, onCopy, onDelete, canSave, onSaveLocal, reactions }: QuickBarMenuProps) {
    const layoutPrefix = `qb-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const reduceMotion = useReducedMotion() === true;
    const [open, setOpen] = useState<Selector | null>(null);
    const [saveOption, setSaveOption] = useState<'local' | 'everyone'>('local');
    const [emoji, setEmoji] = useState<string | null>(reactions?.current ?? null);

    const rowRef = useRef<HTMLDivElement>(null);
    const saveTriggerRef = useRef<HTMLButtonElement>(null);
    const reactTriggerRef = useRef<HTMLButtonElement>(null);
    const deleteTriggerRef = useRef<HTMLButtonElement>(null);
    const saveBarRef = useRef<HTMLDivElement>(null);
    const reactBarRef = useRef<HTMLDivElement>(null);
    const deleteBarRef = useRef<HTMLDivElement>(null);
    const triggerRefs: Record<Selector, RefObject<HTMLButtonElement | null>> = {
        save: saveTriggerRef,
        react: reactTriggerRef,
        delete: deleteTriggerRef,
    };
    const barRefs: Record<Selector, RefObject<HTMLDivElement | null>> = {
        save: saveBarRef,
        react: reactBarRef,
        delete: deleteBarRef,
    };
    // Copy: the icon turns into a ✓ for a moment; the label (and so the width) stays.
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied) return undefined;
        const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
        return () => window.clearTimeout(timer);
    }, [copied]);
    const [rowWidth, setRowWidth] = useState(0);
    const [rects, setRects] = useState<Partial<Record<Selector, Rect>>>({});
    const lastOpen = useRef<Selector | null>(null);
    /** When a selector last opened / closed (the only moves its backdrop springs). */
    const selectorToggledAt = useRef(0);

    // Trigger pills' spots in the row (their backdrops rest there). Layout
    // offsets, not getBoundingClientRect: the panel unfolds from scale(0.97),
    // and a transformed measure placed the backdrops short (onto the divider).
    // Measured while folded only — the fading row is scaled while open.
    useLayoutEffect(() => {
        const row = rowRef.current;
        if (!row) return undefined;
        const measure = () => {
            if (open) return;
            const rectOf = (el: HTMLElement | null): Rect | undefined => {
                if (!el) return undefined;
                // offsetParent is .qb-select__row, which sits at the row's start.
                const parent = el.offsetParent as HTMLElement | null;
                return { left: el.offsetLeft + (parent && parent !== row ? parent.offsetLeft : 0), width: el.offsetWidth };
            };
            setRowWidth(row.offsetWidth);
            setRects({
                save: rectOf(saveTriggerRef.current),
                react: rectOf(reactTriggerRef.current),
                delete: rectOf(deleteTriggerRef.current),
            });
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(row);
        [saveTriggerRef, reactTriggerRef, deleteTriggerRef].forEach((ref) => {
            if (ref.current) observer.observe(ref.current);
        });
        return () => observer.disconnect();
    }, [open]);

    // First measurement lands instantly (no grow-from-zero); only real opens spring.
    const [measured, setMeasured] = useState(false);
    useEffect(() => {
        if (!rowWidth || measured) return undefined;
        const frame = window.requestAnimationFrame(() => setMeasured(true));
        return () => window.cancelAnimationFrame(frame);
    }, [rowWidth, measured]);

    // Keyboard: focus the bar's selected / first option on open, the trigger on close.
    useEffect(() => {
        if (open) {
            const bar = barRefs[open].current;
            const target =
                bar?.querySelector<HTMLElement>('[aria-pressed="true"]:not(:disabled)') ||
                bar?.querySelector<HTMLElement>('[data-option]:not(:disabled)');
            target?.focus({ preventScroll: true });
        } else if (lastOpen.current) {
            triggerRefs[lastOpen.current].current?.focus({ preventScroll: true });
        }
        lastOpen.current = open;
    }, [open]);

    const openSelector = (id: Selector) => {
        selectorToggledAt.current = performance.now();
        if (id === 'react') setEmoji(reactions?.current ?? null);
        setOpen(id);
    };
    const cancel = () => {
        selectorToggledAt.current = performance.now();
        setOpen(null);
    };

    const onBarKeyDown = (event: KeyboardEvent) => {
        // Escape backs out of the selector only, not the whole bubble panel.
        if (event.key === 'Escape') {
            event.stopPropagation();
            cancel();
        }
    };

    const saveLocally = () => {
        setSaveOption('local');
        onSaveLocal();
    };
    const copy = async () => {
        if (await onCopy()) setCopied(true);
    };
    const react = (next: string) => {
        setEmoji(next);
        if (next !== reactions?.current) reactions?.onPick(next);
        else cancel();
    };

    const fade = reduceMotion ? { duration: 0 } : { duration: TRIGGER_FADE };
    // Backdrops spring only when a selector opens / closes. Any other re-measure
    // (the bubble resizing — e.g. shrinking as the panel closes) moves them at
    // once, glued to their pills: springing those made the solid pills trail
    // behind the narrowing bubble, as if it wanted to widen again.
    const selectorMoving = performance.now() - selectorToggledAt.current < SELECTOR_MOVE_MS;
    const widthTransition = reduceMotion || !measured || !selectorMoving ? { duration: 0 } : growSpring;
    const restTransition = reduceMotion ? { duration: 0 } : REST_EASE;

    /**
     * A trigger's backdrop: rests under its pill, grows over the whole row when
     * open. Delete has no pill at rest: its backdrop is invisible there and only
     * shows while it grows / shrinks.
     */
    const backdrop = (id: Selector) => {
        const rect = rects[id];
        if (!rect || !rowWidth) return null;
        const isOpen = open === id;
        const ghost = id === 'delete';
        const at = isOpen ? { left: 0, width: rowWidth } : { left: rect.left, width: rect.width };
        return (
            <motion.span
                key={`${id}-bg`}
                className="qb-select__bg"
                data-selector={id}
                data-open={isOpen || undefined}
                initial={false}
                animate={ghost ? { ...at, opacity: isOpen ? 1 : 0 } : at}
                transition={
                    ghost
                        ? {
                              ...widthTransition,
                              // In at once; out only once it has shrunk back.
                              opacity: reduceMotion ? { duration: 0 } : isOpen ? { duration: 0.12 } : { duration: 0.18, delay: 0.24 },
                          }
                        : widthTransition
                }
                // The growing one rides above the rest of the row as it covers it.
                style={{ zIndex: isOpen ? 2 : 0 }}
            />
        );
    };

    /** Pill content: fades out fast on open, back in once shrunk. */
    const trigger = (
        id: Selector,
        ref: RefObject<HTMLButtonElement | null>,
        label: string,
        value: ReactNode,
        disabled = false,
        className = '',
    ) => {
        const isOpen = open === id;
        return (
            <motion.button
                ref={ref}
                type="button"
                className={cn('qb-select__trigger', className)}
                data-selector={id}
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-label={label}
                disabled={disabled}
                tabIndex={open ? -1 : 0}
                animate={{ opacity: open ? 0 : 1, scale: open && !isOpen ? 0.96 : 1 }}
                transition={isOpen ? fade : open ? restTransition : { ...fade, delay: reduceMotion ? 0 : TRIGGER_FADE }}
                style={{ pointerEvents: open ? 'none' : undefined }}
                onClick={() => openSelector(id)}
            >
                {value}
            </motion.button>
        );
    };

    const barState = (id: Selector) => (open === id ? 'shown' : 'hidden');

    return (
        <MotionConfig reducedMotion="user">
            <LayoutGroup id={layoutPrefix}>
                <div ref={rowRef} className="qb-select" data-open={open || undefined}>
                    {onDelete ? backdrop('delete') : null}
                    {backdrop('save')}
                    {reactions ? backdrop('react') : null}

                    {/* Closed row: everything but the open trigger eases back under the backdrop. */}
                    <div className="qb-select__row message-quickbar__actions" inert={open ? true : undefined}>
                        <motion.div
                            className="qb-select__rest"
                            animate={{ opacity: open ? 0 : 1, scale: open ? 0.96 : 1 }}
                            transition={restTransition}
                        >
                            <button
                                type="button"
                                className="message-quickbar__action"
                                aria-label="Reply"
                                disabled={!canReply}
                                onClick={onReply}
                            >
                                <SpriteIcon id="icon-reply" />
                                <span className="message-quickbar__label">Reply</span>
                            </button>
                            <span className="message-quickbar__buttons-host">
                                {/* Fixed width: only the icon swaps (copy ⇄ ✓) */}
                                <button
                                    type="button"
                                    className="message-quickbar__action"
                                    aria-label={copied ? 'Copied' : 'Copy'}
                                    title={copied ? 'Copied' : 'Copy'}
                                    disabled={!canCopy}
                                    onClick={copy}
                                >
                                    <span className="qb-select__swap-icon" aria-hidden="true">
                                        <AnimatePresence initial={false} mode="popLayout">
                                            <motion.span
                                                key={copied ? 'check' : 'copy'}
                                                className="qb-select__swap-glyph"
                                                initial={{ opacity: 0, scale: 0.6 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.6 }}
                                                transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
                                            >
                                                {copied ? <Check size={15} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2} />}
                                            </motion.span>
                                        </AnimatePresence>
                                    </span>
                                    <span className="message-quickbar__label">Copy</span>
                                    <span className="sr-only" role="status">{copied ? 'Copied' : ''}</span>
                                </button>
                            </span>
                        </motion.div>
                        {onDelete
                            ? trigger(
                                  'delete',
                                  deleteTriggerRef,
                                  'Delete',
                                  <>
                                      <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                                      <span className="message-quickbar__label">Delete</span>
                                  </>,
                                  false,
                                  // is-danger: the shared hover pill tints red on it
                                  'qb-select__trigger--danger is-danger',
                              )
                            : null}
                        {trigger(
                            'save',
                            saveTriggerRef,
                            'Save',
                            <>
                                <SpriteIcon id="icon-bookmark" />
                                <span className="message-quickbar__label">Save</span>
                            </>,
                            !canSave,
                        )}
                        {reactions ? (
                            <>
                                <motion.span
                                    className="message-quickbar__divider"
                                    aria-hidden="true"
                                    animate={{ opacity: open ? 0 : 1 }}
                                    transition={restTransition}
                                />
                                {trigger(
                                    'react',
                                    reactTriggerRef,
                                    'React',
                                    reactions.current ? (
                                        <span className="qb-select__emoji">{reactions.current}</span>
                                    ) : (
                                        <SpriteIcon id="icon-smile" />
                                    ),
                                )}
                            </>
                        ) : null}
                    </div>

                    {/* Delete bar — ✕ · Delete message? · Confirm. Focus lands on ✕,
                        so a stray Enter backs out rather than deletes. */}
                    {onDelete ? (
                        <div
                            ref={deleteBarRef}
                            className="qb-select__bar"
                            role="group"
                            aria-label="Delete message"
                            onKeyDown={onBarKeyDown}
                            inert={open !== 'delete' || undefined}
                            aria-hidden={open !== 'delete' || undefined}
                        >
                            <motion.button
                                type="button"
                                className="qb-select__icon-btn qb-select__cancel"
                                aria-label="Cancel"
                                title="Cancel"
                                data-option="cancel"
                                custom={0}
                                variants={itemVariants}
                                initial={false}
                                animate={barState('delete')}
                                onClick={cancel}
                            >
                                <X size={13} strokeWidth={2.25} />
                            </motion.button>
                            <motion.span
                                className="qb-select__prompt"
                                custom={1}
                                variants={itemVariants}
                                initial={false}
                                animate={barState('delete')}
                            >
                                Delete message?
                            </motion.span>
                            <motion.button
                                type="button"
                                className="qb-select__confirm"
                                custom={2}
                                variants={itemVariants}
                                initial={false}
                                animate={barState('delete')}
                                onClick={() => {
                                    cancel();
                                    onDelete();
                                }}
                            >
                                <Trash2 size={13} strokeWidth={2.25} aria-hidden="true" />
                                Confirm
                            </motion.button>
                        </div>
                    ) : null}

                    {/* Save bar — always mounted, unreachable while folded. */}
                    <div
                        ref={saveBarRef}
                        className="qb-select__bar"
                        role="group"
                        aria-label="Save message"
                        onKeyDown={onBarKeyDown}
                        inert={open !== 'save' || undefined}
                        aria-hidden={open !== 'save' || undefined}
                    >
                        <motion.button
                            type="button"
                            className="qb-select__icon-btn qb-select__cancel"
                            aria-label="Cancel"
                            title="Cancel"
                            custom={0}
                            variants={itemVariants}
                            initial={false}
                            animate={barState('save')}
                            onClick={cancel}
                        >
                            <X size={13} strokeWidth={2.25} />
                        </motion.button>
                        <div className="qb-select__chips qb-select__chips--halves">
                            <motion.button
                                type="button"
                                className="qb-select__chip"
                                data-option="local"
                                aria-pressed={saveOption === 'local'}
                                title="Only you, on this device"
                                custom={1}
                                variants={itemVariants}
                                initial={false}
                                animate={barState('save')}
                                onClick={saveLocally}
                            >
                                {saveOption === 'local' && (
                                    <motion.span
                                        layoutId={`${layoutPrefix}-save-option`}
                                        transition={springTransition}
                                        className="qb-select__chip-bg"
                                        style={{ borderRadius: 999 }}
                                    />
                                )}
                                <span className="qb-select__chip-label">
                                    <SpriteIcon id="icon-user" />
                                    <span className="message-quickbar__label">Save locally</span>
                                </span>
                            </motion.button>
                            {/* Saving for both people needs server + peer sync that
                                doesn't exist yet: shown, not selectable. */}
                            <motion.button
                                type="button"
                                className="qb-select__chip"
                                data-option="everyone"
                                aria-pressed={false}
                                title="Not available yet: saving for both people needs server sync"
                                disabled
                                custom={2}
                                variants={itemVariants}
                                initial={false}
                                animate={barState('save')}
                            >
                                <span className="qb-select__chip-label">
                                    <SpriteIcon id="icon-users" />
                                    <span className="message-quickbar__label">For everyone</span>
                                </span>
                            </motion.button>
                        </div>
                    </div>

                    {/* 🙂 bar — always mounted, unreachable while folded. */}
                    {reactions ? (
                        <div
                            ref={reactBarRef}
                            className="qb-select__bar"
                            onKeyDown={onBarKeyDown}
                            inert={open !== 'react' || undefined}
                            aria-hidden={open !== 'react' || undefined}
                        >
                            <motion.button
                                type="button"
                                className="qb-select__icon-btn qb-select__cancel"
                                aria-label="Cancel"
                                title="Cancel"
                                custom={0}
                                variants={itemVariants}
                                initial={false}
                                animate={barState('react')}
                                onClick={cancel}
                            >
                                <X size={13} strokeWidth={2.25} />
                            </motion.button>
                            <EmojiStrip
                                reactions={reactions}
                                selected={emoji}
                                shown={open === 'react'}
                                layoutPrefix={layoutPrefix}
                                onPick={react}
                            />
                        </div>
                    ) : null}
                </div>
            </LayoutGroup>
        </MotionConfig>
    );
}

export default QuickBarMenu;
