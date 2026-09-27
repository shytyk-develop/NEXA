import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { OtpInput, type OtpInputHandle, type OtpStatus } from '@/components/ui/otp-input';
// The login page doesn't load the chat bundle: bring the Tailwind utilities
// OtpInput is built with (layout, sr-only) along.
import '../styles/tailwind.css';
import './verify-email.css';

// Login page → after Register (or signing in before verifying): the 6-digit
// code emailed to the user. The 6th digit submits on its own; a countdown
// gates "Resend code". js/app.js mounts it and supplies the requests.

export type VerifyEmailProps = {
    email: string;
    /** POST /api/auth/verify-email; resolves when signed in, throws with a message otherwise. */
    verify: (code: string) => Promise<void>;
    /** POST /api/auth/resend-otp; resolves with the cooldown (seconds) to show next. */
    resend: () => Promise<number>;
    onBack: () => void;
    /** Seconds before the first resend is allowed (the code was just sent). */
    initialCooldown?: number;
};

const EASE = [0.22, 1, 0.36, 1] as const;

function formatCountdown(seconds: number) {
    const s = Math.max(0, seconds);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Webmail for the address's domain, for the "Open Gmail" shortcut (null: no button). */
export function mailboxFor(email: string): { name: string; url: string } | null {
    const domain = email.split('@')[1]?.toLowerCase() || '';
    const inbox: Array<[RegExp, string, string]> = [
        [/^(gmail|googlemail)\.com$/, 'Gmail', 'https://mail.google.com/mail/u/0/#search/in%3Aanywhere+newer_than%3A1h'],
        [/^(outlook|hotmail|live|msn)\.[a-z.]+$/, 'Outlook', 'https://outlook.live.com/mail/0/'],
        [/^(yahoo|ymail)\.[a-z.]+$/, 'Yahoo Mail', 'https://mail.yahoo.com/'],
        [/^(icloud|me|mac)\.com$/, 'iCloud Mail', 'https://www.icloud.com/mail/'],
        [/^(proton\.me|protonmail\.com|pm\.me)$/, 'Proton Mail', 'https://mail.proton.me/'],
    ];
    const hit = inbox.find(([pattern]) => pattern.test(domain));
    return hit ? { name: hit[1], url: hit[2] } : null;
}

function VerifyEmail({ email, verify, resend, onBack, initialCooldown = 60 }: VerifyEmailProps) {
    const reduce = useReducedMotion();
    const otpRef = useRef<OtpInputHandle>(null);
    const [status, setStatus] = useState<OtpStatus>('idle');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [cooldown, setCooldown] = useState(initialCooldown);
    const [notice, setNotice] = useState('');
    const mailbox = mailboxFor(email);

    // Resend countdown, one tick a second.
    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [cooldown]);

    // A wrong code shakes (OtpInput), then the cells clear for another try.
    useEffect(() => {
        if (status !== 'error') return undefined;
        const timer = window.setTimeout(() => {
            otpRef.current?.clear();
            setStatus('idle');
        }, 1100);
        return () => window.clearTimeout(timer);
    }, [status]);

    const submit = useCallback(
        async (code: string) => {
            if (busy) return;
            setBusy(true);
            setError('');
            setNotice('');
            try {
                await verify(code);
                setStatus('success');
            } catch (err) {
                setError(err instanceof Error && err.message ? err.message : 'That code isn’t right.');
                setStatus('error');
            } finally {
                setBusy(false);
            }
        },
        [busy, verify],
    );

    const onResend = async () => {
        if (cooldown > 0 || busy) return;
        setError('');
        try {
            const next = await resend();
            setCooldown(next);
            setNotice('A new code is on its way.');
            otpRef.current?.clear();
            setStatus('idle');
        } catch (err) {
            const retry = (err as { retryAfter?: number })?.retryAfter;
            if (typeof retry === 'number' && retry > 0) setCooldown(retry);
            setError(err instanceof Error && err.message ? err.message : 'Could not send a new code.');
        }
    };

    const rise = (delay: number) =>
        reduce
            ? { initial: false as const }
            : {
                initial: { opacity: 0, y: 10 },
                animate: { opacity: 1, y: 0 },
                transition: { delay, duration: 0.35, ease: EASE },
            };

    const waiting = cooldown > 0;

    return (
        <div className="verify-email">
            <motion.span className="verify-email__icon" aria-hidden="true" {...rise(0)}>
                <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
            </motion.span>
            <motion.h1 className="verify-email__title" {...rise(0.04)}>
                Check your email
            </motion.h1>
            <motion.p className="verify-email__sub" {...rise(0.08)}>
                We sent a 6-digit code to
                <strong>{email}</strong>
            </motion.p>

            <motion.div className="verify-email__otp" {...rise(0.12)}>
                <OtpInput
                    ref={otpRef}
                    length={6}
                    groupSeparator
                    status={status}
                    onComplete={(code) => void submit(code)}
                    autoFocus
                    disabled={busy || status === 'success'}
                    label="Verification code"
                    hint={busy ? 'Checking…' : 'Paste or type the code from the email.'}
                    errorMessage={error || 'That code isn’t right.'}
                    successMessage="Email verified — signing you in…"
                />
            </motion.div>

            <motion.div className={`verify-email__actions${mailbox ? '' : ' is-single'}`} {...rise(0.16)}>
                {mailbox && (
                    <a className="verify-email__btn" href={mailbox.url} target="_blank" rel="noopener noreferrer">
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M11.5 9v3.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1H7" /></svg>
                        Open {mailbox.name}
                    </a>
                )}
                <button
                    type="button"
                    className={`verify-email__btn is-primary${waiting ? ' is-waiting' : ''}`}
                    onClick={onResend}
                    disabled={waiting || busy}
                    aria-live="polite"
                >
                    <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                            key={waiting ? 'wait' : 'ready'}
                            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: 'blur(4px)' }}
                            transition={{ duration: 0.26, ease: EASE }}
                        >
                            {waiting ? <>Resend in <span className="verify-email__time">{formatCountdown(cooldown)}</span></> : 'Resend code'}
                        </motion.span>
                    </AnimatePresence>
                </button>
            </motion.div>

            <motion.div className="verify-email__foot" {...rise(0.2)}>
                <AnimatePresence initial={false}>
                    {(notice || (error && status !== 'error')) && (
                        <motion.p
                            key={notice ? 'notice' : 'error'}
                            className={notice ? 'verify-email__notice' : 'verify-email__error'}
                            role={notice ? undefined : 'alert'}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            {notice || error}
                        </motion.p>
                    )}
                </AnimatePresence>
                <p className="verify-email__spam">Nothing arrived? Check your spam folder.</p>
                <button type="button" className="verify-email__back" onClick={onBack} disabled={busy}>
                    ← Use a different account
                </button>
            </motion.div>
        </div>
    );
}

let root: Root | null = null;

/** Show the code step in `host` (replacing any previous one). */
export function mountVerifyEmail(host: HTMLElement, props: VerifyEmailProps) {
    if (!root) root = createRoot(host);
    root.render(<VerifyEmail key={props.email + Date.now()} {...props} />);
}

export function unmountVerifyEmail() {
    root?.unmount();
    root = null;
}
