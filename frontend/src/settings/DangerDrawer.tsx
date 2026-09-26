import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { OtpInput, type OtpInputHandle, type OtpStatus } from '@/components/ui/otp-input';
import { cn } from '@/lib/utils';
import './danger-drawer.css';

// Settings → Data: "Clear history" / "Delete account" confirm in a bottom
// drawer — warning → type the 6-digit code shown → result. js/profileSettings.js
// opens it and supplies `run` (the action itself); nothing runs before the
// code matches. The code is a deliberate-intent check (like the peer panel's),
// not a server verification.

export type DangerKind = 'history' | 'account';

export type DangerDrawerSource = {
    kind: DangerKind;
    /** Performs the action; throws with a user-facing message on failure. */
    run: () => Promise<void>;
};

type Step = 'warn' | 'code' | 'busy' | 'done' | 'failed';

const COPY: Record<DangerKind, {
    title: string;
    description: string;
    points: string[];
    action: string;
    busy: string;
    done: string;
    doneHint: string;
}> = {
    history: {
        title: 'Clear chat history?',
        description: 'Every conversation is deleted — on this device and on the server.',
        points: [
            'Removes the history for you and your chat partners.',
            'Saved messages and your account stay.',
            'This can’t be undone.',
        ],
        action: 'Clear history',
        busy: 'Clearing history…',
        done: 'Chat history cleared',
        doneHint: 'All conversations were deleted.',
    },
    account: {
        title: 'Delete your account?',
        description: 'Your account and everything in it are removed for good.',
        points: [
            'Your profile and all your conversations are removed.',
            'You’re signed out on every device.',
            'This can’t be undone.',
        ],
        action: 'Delete account',
        busy: 'Deleting account…',
        done: 'Account deleted',
        doneHint: 'You’ll be signed out.',
    },
};

const EASE = [0.22, 1, 0.36, 1] as const;

/** A fresh 6-digit code per confirmation, so the step can't become muscle memory. */
function makeCode() {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return String(buf[0] % 1_000_000).padStart(6, '0');
}

function TrashIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
        </svg>
    );
}

function DangerDrawer({ source, open, onOpenChange }: {
    source: DangerDrawerSource | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const reduce = useReducedMotion();
    const [step, setStep] = useState<Step>('warn');
    const [code, setCode] = useState(makeCode);
    const [otpStatus, setOtpStatus] = useState<OtpStatus>('idle');
    const [failure, setFailure] = useState('');
    const otpRef = useRef<OtpInputHandle>(null);
    const [bodyHeight, setBodyHeight] = useState<number | 'auto'>('auto');
    // The sheet eases to each step's height instead of jumping. A callback ref:
    // vaul remounts the content on every open, and the observer must follow the
    // new node (a stale one reports 0 and would collapse the sheet).
    const observerRef = useRef<ResizeObserver | null>(null);
    const bodyRef = useCallback((el: HTMLDivElement | null) => {
        observerRef.current?.disconnect();
        observerRef.current = null;
        if (!el) return;
        const observer = new ResizeObserver(() => {
            if (el.offsetHeight > 0) setBodyHeight(el.offsetHeight);
        });
        observer.observe(el);
        observerRef.current = observer;
    }, []);
    const kind = source?.kind ?? 'history';
    const copy = COPY[kind];

    // Every open starts over with a new code.
    useEffect(() => {
        if (!open) return;
        setStep('warn');
        setBodyHeight('auto');
        setCode(makeCode());
        setOtpStatus('idle');
        setFailure('');
    }, [open, source]);

    // Wrong code: OtpInput shakes, then the cells clear for another try.
    useEffect(() => {
        if (otpStatus !== 'error') return undefined;
        const timer = window.setTimeout(() => {
            otpRef.current?.clear();
            setOtpStatus('idle');
        }, 900);
        return () => window.clearTimeout(timer);
    }, [otpStatus]);

    const runAction = useCallback(async () => {
        if (!source) return;
        setStep('busy');
        try {
            await source.run();
            setStep('done');
        } catch (error) {
            setFailure(error instanceof Error && error.message ? error.message : 'Something went wrong. Nothing was changed.');
            setStep('failed');
        }
    }, [source]);

    const onComplete = (value: string) => {
        if (value !== code) {
            setOtpStatus('error');
            return;
        }
        setOtpStatus('success');
        // A beat on the green cells, then the action.
        window.setTimeout(() => void runAction(), reduce ? 0 : 420);
    };

    const locked = step === 'busy';
    const slide = reduce
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
        : {
            initial: { opacity: 0, x: 24, filter: 'blur(4px)' },
            animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
            exit: { opacity: 0, x: -24, filter: 'blur(4px)' },
        };

    return (
        <Drawer open={open} onOpenChange={(next) => !locked && onOpenChange(next)} dismissible={!locked}>
            <DrawerContent className={cn('danger-drawer', `is-${kind}`)}>
                <motion.div
                    className="danger-drawer__viewport"
                    animate={{ height: bodyHeight }}
                    transition={reduce ? { duration: 0 } : { duration: 0.32, ease: EASE }}
                >
                    <div ref={bodyRef}>
                        <AnimatePresence mode="wait" initial={false}>
                            {step === 'warn' && (
                                <motion.div key="warn" {...slide} transition={{ duration: 0.24, ease: EASE }}>
                                    <DrawerHeader className="danger-drawer__header">
                                        <span className="danger-drawer__icon"><TrashIcon /></span>
                                        <DrawerTitle>{copy.title}</DrawerTitle>
                                        <DrawerDescription>{copy.description}</DrawerDescription>
                                    </DrawerHeader>
                                    <ul className="danger-drawer__points">
                                        {copy.points.map((point, index) => (
                                            <motion.li
                                                key={point}
                                                initial={reduce ? false : { opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.08 + index * 0.05, duration: 0.3, ease: EASE }}
                                            >
                                                {point}
                                            </motion.li>
                                        ))}
                                    </ul>
                                    <DrawerFooter className="danger-drawer__footer">
                                        <button type="button" className="danger-drawer__btn" onClick={() => onOpenChange(false)}>
                                            Cancel
                                        </button>
                                        <button type="button" className="danger-drawer__btn is-danger" onClick={() => setStep('code')}>
                                            Continue
                                        </button>
                                    </DrawerFooter>
                                </motion.div>
                            )}

                            {(step === 'code' || step === 'busy') && (
                                <motion.div key="code" {...slide} transition={{ duration: 0.24, ease: EASE }}>
                                    <DrawerHeader className="danger-drawer__header">
                                        <DrawerTitle>Enter the code to confirm</DrawerTitle>
                                        <DrawerDescription>
                                            Type the six digits below — {copy.action.toLowerCase()} runs only once they match.
                                        </DrawerDescription>
                                    </DrawerHeader>
                                    <div className="danger-drawer__code-wrap">
                                        <p className="danger-drawer__code" aria-label={`Code ${code.split('').join(' ')}`}>
                                            {code.split('').map((digit, index) => (
                                                <motion.span
                                                    key={`${code}-${index}`}
                                                    className={cn(index === 3 && 'is-gap')}
                                                    initial={reduce ? false : { opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.06 + index * 0.04, duration: 0.28, ease: EASE }}
                                                >
                                                    {digit}
                                                </motion.span>
                                            ))}
                                        </p>
                                        <OtpInput
                                            ref={otpRef}
                                            length={6}
                                            status={otpStatus}
                                            onComplete={onComplete}
                                            autoFocus
                                            disabled={locked}
                                            label="Confirmation code"
                                            hint="Paste or type the code above."
                                            errorMessage="That code doesn’t match. Try again."
                                            successMessage="Code accepted."
                                            className="danger-drawer__otp"
                                        />
                                    </div>
                                    <DrawerFooter className="danger-drawer__footer is-single">
                                        {/* Back, or — once the code matched — the action in progress. */}
                                        <button type="button" className="danger-drawer__btn" onClick={() => setStep('warn')} disabled={locked} aria-live="polite">
                                            {locked ? (
                                                <span className="danger-drawer__status">
                                                    <span className="danger-drawer__spinner" aria-hidden="true" />
                                                    {copy.busy}
                                                </span>
                                            ) : (
                                                'Back'
                                            )}
                                        </button>
                                    </DrawerFooter>
                                </motion.div>
                            )}

                            {(step === 'done' || step === 'failed') && (
                                <motion.div key={step} {...slide} transition={{ duration: 0.24, ease: EASE }}>
                                    <DrawerHeader className="danger-drawer__header is-result">
                                        <motion.span
                                            className={cn('danger-drawer__result', step === 'done' ? 'is-done' : 'is-failed')}
                                            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                                        >
                                            {step === 'done' ? (
                                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                                    <motion.path
                                                        d="m6 12.5 4 4 8-9"
                                                        initial={reduce ? false : { pathLength: 0 }}
                                                        animate={{ pathLength: 1 }}
                                                        transition={{ delay: 0.12, duration: 0.3, ease: EASE }}
                                                    />
                                                </svg>
                                            ) : (
                                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5M12 16.5h.01" /></svg>
                                            )}
                                        </motion.span>
                                        <DrawerTitle>{step === 'done' ? copy.done : 'Nothing was changed'}</DrawerTitle>
                                        <DrawerDescription>{step === 'done' ? copy.doneHint : failure}</DrawerDescription>
                                    </DrawerHeader>
                                    <DrawerFooter className="danger-drawer__footer is-single">
                                        <button type="button" className="danger-drawer__btn" onClick={() => onOpenChange(false)}>
                                            Close
                                        </button>
                                    </DrawerFooter>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            </DrawerContent>
        </Drawer>
    );
}

// ── Mount (js/profileSettings.js) ───────────────────────────────────────────

let root: Root | null = null;
let current: DangerDrawerSource | null = null;

function render(open: boolean) {
    if (!root) {
        const host = document.createElement('div');
        host.id = 'uiDangerDrawerRoot';
        document.body.append(host);
        root = createRoot(host);
    }
    root.render(<DangerDrawer source={current} open={open} onOpenChange={(next) => render(next)} />);
}

export function openDangerDrawer(source: DangerDrawerSource) {
    current = source;
    render(true);
}
