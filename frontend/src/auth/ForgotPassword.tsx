import { useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import { mountPasswordFlow } from './mountPasswordFlow';
import { mailboxFor } from './VerifyEmail';
import './verify-email.css';
import './password-flow.css';

// Login page → "Forgot password?": email or username → the server mails a
// reset link (POST /api/auth/forgot-password) → "Check your email". The reply
// is the same whether or not the account exists, so this screen says "if".

export type ForgotPasswordProps = {
    /** Pre-filled from the login form's "Username or Email". */
    initialValue?: string;
    /** POST /api/auth/forgot-password; throws with a message on failure. */
    request: (emailOrUsername: string) => Promise<void>;
    onBack: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

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
        const identifier = value.trim();
        if (!identifier) {
            setError('Enter your email or username.');
            return;
        }
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await request(identifier);
            setSentTo(identifier);
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : 'Could not send the link. Try again.');
        } finally {
            setBusy(false);
        }
    };

    if (sentTo) {
        const mailbox = sentTo.includes('@') ? mailboxFor(sentTo) : null;
        return (
            <div className="verify-email password-flow" key="sent">
                <motion.span className="verify-email__icon" aria-hidden="true" {...rise(0)}>
                    <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
                </motion.span>
                <motion.h1 className="verify-email__title" {...rise(0.04)}>
                    Check your email
                </motion.h1>
                <motion.p className="verify-email__sub" {...rise(0.08)}>
                    If an account matches
                    <strong>{sentTo}</strong>
                    a link to reset its password is on its way. It works once, for 15 minutes.
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
                Enter your email or username. We’ll email you a link to choose a new password.
            </motion.p>

            <motion.div className="password-flow__fields" {...rise(0.12)}>
                <div className="login-field">
                    <input
                        type="text"
                        className="login-input"
                        placeholder="Email or username"
                        aria-label="Email or username"
                        autoComplete="username"
                        spellCheck={false}
                        autoCapitalize="off"
                        maxLength={254}
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
