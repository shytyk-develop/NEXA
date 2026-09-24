/**
 * HoldToConfirmButton — adapted from Spectrum UI.
 *
 * Holding the button (pointer, Space or Enter) fills a circular progress ring
 * around the icon; releasing early springs the ring back and nothing fires.
 * Completing the hold fires onConfirm once, pops a drawn check in and rolls the
 * label, then resets to idle. Honors prefers-reduced-motion and announces
 * confirmation to screen readers.
 *
 * Adapted for this app:
 * - motion/react instead of framer-motion (shares the bundle's motion chunk);
 * - no baked-in colours: exposes `data-state` (idle | holding | armed |
 *   confirmed) for the host's CSS;
 * - `confirmOnTouchRelease`: on touch, a completed hold *arms* and fires on
 *   release — while a finger is still down the page has no fresh user
 *   activation, so e.g. window.open would be popup-blocked.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    AnimatePresence,
    animate,
    motion,
    useMotionValue,
    useReducedMotion,
    useTransform,
} from 'motion/react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HoldToConfirmButtonProps {
    /** Fires exactly once when the hold reaches completion */
    onConfirm: () => void;
    /** How long the button must be held, in milliseconds. Default 1200 */
    duration?: number;
    /** Idle label. Default "Hold to delete" */
    label?: string;
    /** Label shown after a completed hold. Default "Deleted" */
    confirmedLabel?: string;
    /** Label while armed (touch, hold complete, waiting for release). Default "Release to confirm" */
    armedLabel?: string;
    /** Accessible name; defaults to the label plus hold instructions */
    ariaLabel?: string;
    /** Replaces the default trash icon */
    icon?: React.ReactNode;
    /** Visual size of the ring / icon. Default "md" */
    size?: 'sm' | 'md' | 'lg';
    /** Milliseconds before resetting to idle after confirming; 0 stays confirmed. Default 1500 */
    resetDelay?: number;
    /** On touch, fire on release after the ring completes instead of at completion. Default false */
    confirmOnTouchRelease?: boolean;
    /** Disables pointer and keyboard interaction */
    disabled?: boolean;
    className?: string;
}

/** Input channels that can drive a hold; both may be active at once */
type HoldSource = 'pointer' | 'keyboard';

// ─── Constants ───────────────────────────────────────────────────────────────

const SIZES = {
    sm: { icon: 12, ring: 20, stroke: 2 },
    md: { icon: 14, ring: 24, stroke: 2 },
    lg: { icon: 17, ring: 30, stroke: 2.5 },
} as const;

/** Snappy micro spring — release spring-back, icon pops */
const SNAPPY_SPRING = { type: 'spring', stiffness: 500, damping: 30 } as const;
/** Spring for the label roll between states */
const SWAP_SPRING = { type: 'spring', stiffness: 400, damping: 30 } as const;
/** Check pop overshoots slightly — reserved for the positive confirmation */
const CHECK_POP_SPRING = { type: 'spring', stiffness: 500, damping: 22 } as const;
/** Entrance/reveal ease */
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Scale while the button is held down */
const HOLD_SCALE = 0.97;
/** Seconds the press scale-down takes — eases in mechanically, no bounce */
const HOLD_SCALE_DURATION = 0.2;
/** Seconds the check waits after confirmation before drawing in */
const CHECK_DRAW_DELAY = 0.05;
/** Seconds the check stroke takes to draw */
const CHECK_DRAW_DURATION = 0.25;
/** Seconds the label swap trails the check draw on confirmation */
const LABEL_STAGGER = 0.12;
/** Seconds the ring takes to unwind when resetting to idle */
const RING_RESET_DURATION = 0.3;

/** Lucide check, drawn manually so the stroke can animate its pathLength */
const CHECK_PATH = 'M20 6 9 17l-5-5';

const labelVariants = {
    enter: (reduce: boolean) => (reduce ? { opacity: 0 } : { y: 6, opacity: 0 }),
    center: { y: 0, opacity: 1 },
    // Exit carries its own transition so the confirmed label's entrance delay
    // never leaks into the outgoing label when the button resets
    exit: (reduce: boolean) =>
        reduce ? { opacity: 0, transition: { duration: 0 } } : { y: -6, opacity: 0, transition: SWAP_SPRING },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function HoldToConfirmButton({
    onConfirm,
    duration = 1200,
    label = 'Hold to delete',
    confirmedLabel = 'Deleted',
    armedLabel = 'Release to confirm',
    ariaLabel,
    icon,
    size = 'md',
    resetDelay = 1500,
    confirmOnTouchRelease = false,
    disabled = false,
    className,
}: HoldToConfirmButtonProps) {
    const shouldReduceMotion = useReducedMotion();
    const [holding, setHolding] = useState(false);
    const [armed, setArmed] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    // 0 → 1 hold progress driving the ring's stroke-dashoffset
    const progress = useMotionValue(0);
    const animationRef = useRef<ReturnType<typeof animate> | null>(null);
    const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const confirmedRef = useRef(false);
    const armedRef = useRef(false);
    const pointerTypeRef = useRef<string | null>(null);
    // Active input channels — a combined pointer+key hold must neither restart
    // the fill nor cancel it while the other channel is still held
    const holdSourcesRef = useRef<Set<HoldSource>>(new Set());

    const { icon: iconSize, ring, stroke } = SIZES[size];
    const radius = (ring - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    const dashOffset = useTransform(progress, (p) => circumference * (1 - p));
    // Ring (and its faint track) fades in as soon as a hold begins
    const ringOpacity = useTransform(progress, [0, 0.04], [0, 1]);

    const holdSeconds = (duration / 1000).toFixed(1).replace(/\.0$/, '');

    const confirm = useCallback(() => {
        if (confirmedRef.current) return;
        confirmedRef.current = true;
        armedRef.current = false;
        // Physical holds outstanding at confirmation are consumed
        holdSourcesRef.current.clear();
        setHolding(false);
        setArmed(false);
        setConfirmed(true);
        onConfirm();

        if (resetDelay > 0) {
            resetTimerRef.current = setTimeout(() => {
                setConfirmed(false);
                confirmedRef.current = false;
                animationRef.current?.stop();
                animationRef.current = animate(progress, 0, {
                    duration: shouldReduceMotion ? 0.1 : RING_RESET_DURATION,
                    ease: 'easeOut',
                });
            }, resetDelay);
        }
    }, [onConfirm, progress, resetDelay, shouldReduceMotion]);

    const handleComplete = useCallback(() => {
        if (confirmedRef.current) return;
        const touchHold = pointerTypeRef.current === 'touch' && holdSourcesRef.current.has('pointer');
        if (confirmOnTouchRelease && touchHold) {
            armedRef.current = true;
            setArmed(true);
            return;
        }
        confirm();
    }, [confirm, confirmOnTouchRelease]);

    const startHold = useCallback(
        (source: HoldSource) => {
            if (disabled || confirmedRef.current) return;
            const sources = holdSourcesRef.current;
            const alreadyHolding = sources.size > 0;
            sources.add(source);
            // A second input joining an active hold must not restart the fill
            if (alreadyHolding) return;
            setHolding(true);
            animationRef.current?.stop();
            // Resume from wherever the ring is, keeping the fill rate constant —
            // linear on purpose: the ring is a functional progress readout
            animationRef.current = animate(progress, 1, {
                duration: (duration * (1 - progress.get())) / 1000,
                ease: 'linear',
                onComplete: handleComplete,
            });
        },
        [disabled, duration, handleComplete, progress],
    );

    const cancelHold = useCallback(
        (source?: HoldSource) => {
            const sources = holdSourcesRef.current;
            if (source) sources.delete(source);
            else sources.clear();
            // Another input channel is still holding — keep filling
            if (sources.size > 0) return;
            setHolding(false);
            armedRef.current = false;
            setArmed(false);
            if (confirmedRef.current) return;
            animationRef.current?.stop();
            animationRef.current = animate(
                progress,
                0,
                shouldReduceMotion ? { duration: 0.15, ease: 'linear' } : SNAPPY_SPRING,
            );
        },
        [progress, shouldReduceMotion],
    );

    const handlePointerDown = useCallback(
        (event: React.PointerEvent<HTMLButtonElement>) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            pointerTypeRef.current = event.pointerType;
            // Capture so slight finger drift doesn't cancel and pointerup is
            // received even when released outside the button
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // Pointer already inactive — nothing to capture
            }
            startHold('pointer');
        },
        [startHold],
    );

    const handlePointerUp = useCallback(() => {
        // Armed touch hold: the release itself confirms (carries user activation).
        if (armedRef.current) {
            confirm();
            return;
        }
        cancelHold('pointer');
    }, [cancelHold, confirm]);

    const cancelPointerHold = useCallback(() => cancelHold('pointer'), [cancelHold]);
    const cancelAllHolds = useCallback(() => cancelHold(), [cancelHold]);

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLButtonElement>) => {
            if (event.key !== ' ' && event.key !== 'Enter') return;
            // Keep the native button from firing click; ignore held-key repeats
            event.preventDefault();
            if (event.repeat) return;
            startHold('keyboard');
        },
        [startHold],
    );

    const handleKeyUp = useCallback(
        (event: React.KeyboardEvent<HTMLButtonElement>) => {
            if (event.key !== ' ' && event.key !== 'Enter') return;
            event.preventDefault();
            cancelHold('keyboard');
        },
        [cancelHold],
    );

    useEffect(() => {
        return () => {
            animationRef.current?.stop();
            if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        };
    }, []);

    const state = confirmed ? 'confirmed' : armed ? 'armed' : holding ? 'holding' : 'idle';
    const shownLabel = confirmed ? confirmedLabel : armed ? armedLabel : label;

    return (
        <motion.button
            type="button"
            disabled={disabled}
            data-state={state}
            aria-label={ariaLabel ?? `${label}. Press and hold for ${holdSeconds} seconds to confirm`}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={cancelPointerHold}
            onPointerCancel={cancelPointerHold}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onBlur={cancelAllHolds}
            onContextMenu={(event) => {
                // A touch long-press is the hold itself, not a context menu.
                event.preventDefault();
                event.stopPropagation();
            }}
            animate={{ scale: holding && !shouldReduceMotion ? HOLD_SCALE : 1 }}
            transition={
                shouldReduceMotion
                    ? { duration: 0 }
                    : holding
                        ? // Pressing in eases down mechanically…
                          { duration: HOLD_SCALE_DURATION, ease: EASE_OUT }
                        : // …releasing springs back snappily
                          SNAPPY_SPRING
            }
            className={cn('hold-confirm', className)}
        >
            {/* Icon + progress ring */}
            <span className="hold-confirm__ring" style={{ width: ring, height: ring }} aria-hidden="true">
                <motion.span
                    className="hold-confirm__glyph"
                    initial={false}
                    animate={{ scale: confirmed ? 0 : 1, opacity: confirmed ? 0 : 1 }}
                    transition={shouldReduceMotion ? { duration: 0 } : SNAPPY_SPRING}
                >
                    {icon ?? <Trash2 size={iconSize} strokeWidth={2} />}
                </motion.span>
                {/* Success check — pops with a slight overshoot while its stroke draws */}
                <motion.span
                    className="hold-confirm__glyph hold-confirm__check"
                    initial={false}
                    animate={{ scale: confirmed ? 1 : 0, opacity: confirmed ? 1 : 0 }}
                    transition={
                        shouldReduceMotion
                            ? { duration: 0 }
                            : { ...CHECK_POP_SPRING, delay: confirmed ? CHECK_DRAW_DELAY : 0 }
                    }
                >
                    <svg
                        viewBox="0 0 24 24"
                        width={iconSize}
                        height={iconSize}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <motion.path
                            d={CHECK_PATH}
                            initial={false}
                            animate={{ pathLength: confirmed ? 1 : 0 }}
                            transition={
                                shouldReduceMotion
                                    ? { duration: 0 }
                                    : confirmed
                                        ? { duration: CHECK_DRAW_DURATION, ease: EASE_OUT, delay: CHECK_DRAW_DELAY }
                                        : { duration: 0.1 }
                            }
                        />
                    </svg>
                </motion.span>

                <motion.svg
                    viewBox={`0 0 ${ring} ${ring}`}
                    width={ring}
                    height={ring}
                    className="hold-confirm__progress"
                    style={{ opacity: ringOpacity }}
                >
                    <circle
                        cx={ring / 2}
                        cy={ring / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeOpacity={0.2}
                        strokeWidth={stroke}
                    />
                    <motion.circle
                        cx={ring / 2}
                        cy={ring / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        style={{ strokeDashoffset: dashOffset }}
                    />
                </motion.svg>
            </span>

            {/* Label */}
            <span className="hold-confirm__label" data-holding={holding || undefined}>
                <AnimatePresence mode="popLayout" initial={false} custom={shouldReduceMotion ?? false}>
                    <motion.span
                        key={state === 'holding' ? 'idle' : state}
                        className="hold-confirm__label-text"
                        custom={shouldReduceMotion ?? false}
                        variants={labelVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={
                            shouldReduceMotion
                                ? { duration: 0 }
                                : {
                                    ...SWAP_SPRING,
                                    // Label swap trails the check draw on confirmation
                                    delay: confirmed ? CHECK_DRAW_DELAY + LABEL_STAGGER : 0,
                                }
                        }
                    >
                        {shownLabel}
                    </motion.span>
                </AnimatePresence>
            </span>

            {/* Screen reader confirmation announcement */}
            <span className="hold-confirm__sr" role="status" aria-live="polite">
                {confirmed ? confirmedLabel : ''}
            </span>
        </motion.button>
    );
}

export default HoldToConfirmButton;
