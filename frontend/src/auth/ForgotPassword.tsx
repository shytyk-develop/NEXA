import { useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import { mountPasswordFlow } from './mountPasswordFlow';
import { mailboxFor } from './VerifyEmail';
import './verify-email.css';
import './password-flow.css';

// Login page → "Forgot password?": the account's email address → the server
// mails a reset link (POST /api/auth/forgot-password) → "Check your email".
// The reply is the same whether or not the address is registered, so this
// screen says "if".

export type ForgotPasswordProps = {
    /** Pre-filled when the login form already holds an email address. */
    initialValue?: string;
    /** POST /api/auth/forgot-password; throws with a message on failure. */
    request: (email: string) => Promise<void>;
    onBack: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;
// Same rule as the backend (core/email_verification.py _EMAIL_RE).
const EMAIL_PATTERN = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;

function ForgotPassword({ initialValue = '', request, onBack }: ForgotPasswordProps) {
    const reduce = useReducedMotion();
    const [value, setValue] = useState(initialValue);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [sentTo, setSentTo] = useState('');

    const rise = (delay: number) =>
        reduce
            ? { initial: false as const }
            : {
                initial: { opacity: 0, y: 10 },
                animate: { opacity: 1, y: 0 },
                transition: { delay, duration: 0.35, ease: EASE },
            };

    const onSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const email = value.trim().toLowerCase();
        if (!EMAIL_PATTERN.test(email) || email.length > 254) {
            setError('Enter a valid email address.');
            return;
        }
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await request(email);
            setSentTo(email);
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : 'Could not send the link. Try again.');
        } finally {
            setBusy(false);
        }
    };

    if (sentTo) {
        const mailbox = mailboxFor(sentTo);
        return (
            <div className="verify-email password-flow" key="sent">
                <motion.span className="verify-email__icon" aria-hidden="true" {...rise(0)}>
                    <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
                </motion.span>
                <motion.h1 className="verify-email__title" {...rise(0.04)}>
                    Check your email
                </motion.h1>
                <motion.p className="verify-email__sub" {...rise(0.08)}>
                    If this email is registered, a password reset link has been sent to
                    <strong>{sentTo}</strong>
                    It works once, for 15 minutes.
                </motion.p>
                <motion.div className="verify-email__actions is-single" {...rise(0.12)}>
                    {mailbox ? (
                        <a className="verify-email__btn is-primary" href={mailbox.url} target="_blank" rel="noopener noreferrer">
                            Open {mailbox.name}
                        </a>
                    ) : null}
                </motion.div>
                <motion.div className="verify-email__foot" {...rise(0.16)}>
                    <p className="verify-email__spam">Nothing arrived? Check your spam folder.</p>
                    <button type="button" className="verify-email__back" onClick={onBack}>
                        ← Back to log in
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <form className="verify-email password-flow" onSubmit={onSubmit} noValidate key="form">
            <motion.span className="verify-email__icon" aria-hidden="true" {...rise(0)}>
                <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            </motion.span>
            <motion.h1 className="verify-email__title" {...rise(0.04)}>
                Forgot password?
            </motion.h1>
            <motion.p className="verify-email__sub" {...rise(0.08)}>
                Enter your account’s email address. We’ll send you a link to choose a new password.
            </motion.p>

            <motion.div className="password-flow__fields" {...rise(0.12)}>
                <label className="password-flow__label" htmlFor="uiForgotEmail">
                    Email address
                </label>
                <div className="login-field">
                    <input
                        id="uiForgotEmail"
                        type="email"
                        inputMode="email"
                        className="login-input"
                        placeholder="name@example.com"
                        autoComplete="email"
                        spellCheck={false}
                        autoCapitalize="off"
                        maxLength={254}
                        aria-invalid={error ? true : undefined}
                        autoFocus
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        disabled={busy}
                    />
                </div>
            </motion.div>

            <motion.div className="password-flow__submit" {...rise(0.16)}>
                <button type="submit" className="verify-email__btn is-primary" disabled={busy} aria-busy={busy}>
                    {busy ? <span className="password-flow__spinner" aria-hidden="true" /> : null}
                    {busy ? 'Sending…' : 'Send reset link'}
                </button>
            </motion.div>

            <motion.div className="verify-email__foot" {...rise(0.2)}>
                {error ? <p className="verify-email__error" role="alert">{error}</p> : null}
                <button type="button" className="verify-email__back" onClick={onBack} disabled={busy}>
                    ← Back to log in
                </button>
            </motion.div>
        </form>
    );
}

export function mountForgotPassword(host: HTMLElement, props: ForgotPasswordProps) {
    mountPasswordFlow(host, <ForgotPassword key={Date.now()} {...props} />);
}
