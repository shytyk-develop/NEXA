import { useEffect, useRef, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';

// Profile → Status (images/Group 44.png): a 2 × 2 grid of status cards. The
// active card takes its status colour and a check that glides between cards
// (shared layoutId). Mounted by js/profileSettings.js over the hidden native
// <select>, which stays the source of truth (same contract as StatusSwitcher).

export type StatusValue = 'available' | 'away' | 'busy' | 'invisible';

const STATUSES: { value: StatusValue; label: string; hint: string }[] = [
    { value: 'available', label: 'Online', hint: 'Visible to contacts' },
    { value: 'away', label: 'Away', hint: 'Replies may be slow' },
    { value: 'busy', label: 'Focus', hint: 'Mute notifications' },
    { value: 'invisible', label: 'Invisible', hint: 'Appear offline' },
];

const CHECK_SPRING = { type: 'spring', stiffness: 520, damping: 34 } as const;

function StatusGrid({ value, onChange }: { value: StatusValue; onChange: (value: StatusValue) => void }) {
    const reduce = useReducedMotion();
    const groupRef = useRef<HTMLDivElement>(null);
    const moveFocus = useRef(false);

    useEffect(() => {
        if (!moveFocus.current) return;
        moveFocus.current = false;
        groupRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    }, [value]);

    // Radio-group keys: arrows move through the grid (and wrap).
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const index = STATUSES.findIndex((s) => s.value === value);
        const step = { ArrowRight: 1, ArrowDown: 2, ArrowLeft: -1, ArrowUp: -2 }[event.key];
        if (step === undefined) return;
        event.preventDefault();
        moveFocus.current = true;
        onChange(STATUSES[(index + step + STATUSES.length) % STATUSES.length].value);
    };

    return (
        <LayoutGroup id="profile-status">
            <div ref={groupRef} className="pf-status-grid" role="radiogroup" aria-label="Status" onKeyDown={onKeyDown}>
                {STATUSES.map((status) => {
                    const active = status.value === value;
                    return (
                        <button
                            key={status.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            tabIndex={active ? 0 : -1}
                            className={`pf-status-card is-${status.value}${active ? ' is-active' : ''}`}
                            onClick={() => onChange(status.value)}
                        >
                            <span className="pf-status-card__dot" aria-hidden="true" />
                            <span className="pf-status-card__label">{status.label}</span>
                            <span className="pf-status-card__hint">{status.hint}</span>
                            {active && (
                                <motion.span
                                    layoutId="profile-status-check"
                                    className="pf-status-card__check"
                                    transition={reduce ? { duration: 0 } : CHECK_SPRING}
                                    aria-hidden="true"
                                >
                                    <Check strokeWidth={2.4} />
                                </motion.span>
                            )}
                        </button>
                    );
                })}
            </div>
        </LayoutGroup>
    );
}

/** Same contract as StatusSwitcher: mount(host, { value, onChange }) → { update, destroy }. */
export function mountStatusSwitcher(
    host: HTMLElement,
    { value, onChange }: { value: StatusValue; onChange: (value: StatusValue) => void },
) {
    const root = createRoot(host);
    let current = value;
    const render = () => root.render(<StatusGrid value={current} onChange={(next) => {
        current = next;
        render();
        onChange(next);
    }} />);
    flushSync(render);
    return {
        update(next: StatusValue) {
            if (next === current) return;
            current = next;
            render();
        },
        destroy() {
            root.unmount();
        },
    };
}

export const PROFILE_STATUS_UI = Object.fromEntries(STATUSES.map((s) => [s.value, s.label])) as Record<StatusValue, string>;
