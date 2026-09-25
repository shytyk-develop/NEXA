// Profile status picker — adapted from the "CarouselNavigator" component:
// ‹ [dots] › where each dot is a status and the whole control takes that
// status's colour. Mounted into the vanilla profile settings page
// (js/profileSettings.js), which keeps a hidden <select> as the source of truth.
//
// Adaptations: no autoplay / progress fill (a status doesn't advance on its
// own); both arrows wrap; the active dot's width animates for real (no
// transform-based `layout`, so it never stretches); a label names the status;
// colours come from the status palette instead of Tailwind light themes.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type StatusValue = 'available' | 'away' | 'busy' | 'invisible';

type StatusTheme = {
    label: string;
    /** Muted status colour: active dot, arrow icons, label. */
    color: string;
    /** Arrow button fill (a soft tint, not the solid colour). */
    arrow: string;
    /** Control background tint. */
    bg: string;
    /** Inactive dots. */
    dot: string;
};

const STATUSES: StatusValue[] = ['available', 'away', 'busy', 'invisible'];

/*
 * Quiet palette: desaturated status hues, low-alpha tints. Arrows are tinted
 * pills with a coloured glyph rather than solid colour blocks.
 */
const THEMES: Record<StatusValue, StatusTheme> = {
    available: { label: 'Available', color: '#6fb89a', arrow: 'rgba(111, 184, 154, 0.14)', bg: 'rgba(111, 184, 154, 0.05)', dot: 'rgba(111, 184, 154, 0.24)' },
    away: { label: 'Away', color: '#c9a860', arrow: 'rgba(201, 168, 96, 0.14)', bg: 'rgba(201, 168, 96, 0.05)', dot: 'rgba(201, 168, 96, 0.24)' },
    busy: { label: 'Busy', color: '#c77676', arrow: 'rgba(199, 118, 118, 0.14)', bg: 'rgba(199, 118, 118, 0.05)', dot: 'rgba(199, 118, 118, 0.24)' },
    invisible: { label: 'Invisible', color: '#8e8e96', arrow: 'rgba(142, 142, 150, 0.12)', bg: 'rgba(142, 142, 150, 0.04)', dot: 'rgba(142, 142, 150, 0.22)' },
};

const colorSpring = { duration: 0.3, ease: 'easeOut' } as const;
const dotSpring = { type: 'spring', stiffness: 300, damping: 30 } as const;

function StatusSwitcher({ value, onChange }: { value: StatusValue; onChange: (value: StatusValue) => void }) {
    const reduceMotion = useReducedMotion() === true;
    const index = Math.max(0, STATUSES.indexOf(value));
    const theme = THEMES[value] ?? THEMES.available;
    const go = (next: number) => onChange(STATUSES[(next + STATUSES.length) % STATUSES.length]);
    const colors = reduceMotion ? { duration: 0 } : colorSpring;
    const groupRef = useRef<HTMLDivElement>(null);
    const moveFocus = useRef(false);

    // Arrow-key changes carry focus to the newly active dot (roving tabindex).
    useEffect(() => {
        if (!moveFocus.current) return;
        moveFocus.current = false;
        groupRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    }, [index]);

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            moveFocus.current = true;
            go(index + (event.key === 'ArrowRight' ? 1 : -1));
        }
    };

    return (
        <motion.div
            ref={groupRef}
            className="status-switcher"
            role="radiogroup"
            aria-label="Status"
            onKeyDown={onKeyDown}
            initial={false}
            animate={{ backgroundColor: theme.bg }}
            transition={colors}
        >
            <ArrowButton label="Previous status" fill={theme.arrow} ink={theme.color} onClick={() => go(index - 1)}>
                <ChevronLeft size={16} strokeWidth={3} />
            </ArrowButton>

            <div className="status-switcher__dots">
                {STATUSES.map((status, i) => {
                    const active = i === index;
                    return (
                        <motion.button
                            key={status}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            aria-label={THEMES[status].label}
                            title={THEMES[status].label}
                            tabIndex={active ? 0 : -1}
                            className="status-switcher__dot"
                            initial={false}
                            animate={{ width: active ? 28 : 8, backgroundColor: active ? theme.color : theme.dot }}
                            transition={reduceMotion ? { duration: 0 } : { width: dotSpring, backgroundColor: colorSpring }}
                            onClick={() => onChange(status)}
                        />
                    );
                })}
            </div>

            <ArrowButton label="Next status" fill={theme.arrow} ink={theme.color} onClick={() => go(index + 1)}>
                <ChevronRight size={16} strokeWidth={3} />
            </ArrowButton>

            <motion.span
                className="status-switcher__label"
                aria-hidden="true"
                initial={false}
                animate={{ color: theme.color }}
                transition={colors}
            >
                {theme.label}
            </motion.span>
        </motion.div>
    );
}

function ArrowButton({
    label,
    fill,
    ink,
    onClick,
    children,
}: {
    label: string;
    fill: string;
    ink: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    const reduceMotion = useReducedMotion() === true;
    return (
        <motion.button
            type="button"
            className="status-switcher__arrow"
            aria-label={label}
            tabIndex={-1}
            initial={false}
            animate={{ backgroundColor: fill, color: ink }}
            transition={reduceMotion ? { duration: 0 } : colorSpring}
            whileTap={reduceMotion ? undefined : { scale: 0.9 }}
            onClick={onClick}
        >
            {children}
        </motion.button>
    );
}

/** Keeps the picker in sync when the status changes from outside (Cancel, load). */
function StatusSwitcherRoot({
    initial,
    onChange,
    register,
}: {
    initial: StatusValue;
    onChange: (value: StatusValue) => void;
    register: (set: (value: StatusValue) => void) => void;
}) {
    const [value, setValue] = useState<StatusValue>(initial);
    register(setValue);
    return (
        <StatusSwitcher
            value={value}
            onChange={(next) => {
                setValue(next);
                onChange(next);
            }}
        />
    );
}

export interface StatusSwitcherHandle {
    /** Reflect a status set elsewhere (no onChange). */
    update: (value: StatusValue) => void;
    unmount: () => void;
}

export function mountStatusSwitcher(
    host: HTMLElement,
    { value, onChange }: { value: StatusValue; onChange: (value: StatusValue) => void },
): StatusSwitcherHandle {
    const root = createRoot(host);
    let setValue: ((value: StatusValue) => void) | null = null;
    flushSync(() =>
        root.render(
            <StatusSwitcherRoot
                initial={value}
                onChange={onChange}
                register={(set) => {
                    setValue = set;
                }}
            />,
        ),
    );
    return {
        update: (next) => setValue?.(next),
        unmount: () => root.unmount(),
    };
}
