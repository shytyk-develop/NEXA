import { useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import { mountPasswordFlow } from './mountPasswordFlow';
import './verify-email.css';
import './password-flow.css';

// /reset-password?token=… (the emailed link): a new password, twice. js/app.js
// makes a fresh key pair for it (the old private key was locked with the
// forgotten password), calls POST /api/auth/reset-password and signs in.

export type ResetPasswordProps = {
    /** The link's token (null: the URL had none). */
    token: string | null;
    /** Resets and signs in; throws with the server's message otherwise. */
    submit: (password: string) => Promise<void>;
    /** "Request a new link" → the Forgot password screen. */
    onRequestNew: () => void;
};

const MIN_PASSWORD_LENGTH = 8;
const EASE = [0.22, 1, 0.36, 1] as const;

function ResetPassword({ token, submit, onRequestNew }: ResetPasswordProps) {
    const reduce = useReducedMotion();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    // The link itself is bad (used, expired, unknown): only a new one helps.
    const [linkDead, setLinkDead] = useState(!token);

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
        if (busy) return;
        if (password.length < MIN_PASSWORD_LENGTH) {
            setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
            return;
        }
        if (password !== confirm) {
            setError('The passwords don’t match.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            await submit(password);
        } catch (err) {
            const status = (err as { status?: number })?.status;
            if (status === 400) setLinkDead(true);
            setError(err instanceof Error && err.message ? err.message : 'Could not reset the password. Try again.');
            setBusy(false);
        }
    };

    if (linkDead) {
        return (
            <div className="verify-email password-flow" key="dead">
                <motion.span className="verify-email__icon" aria-hidden="true" {...rise(0)}>
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5" /><path d="M12 16.2v.3" /></svg>
                </motion.span>
                <motion.h1 className="verify-email__title" {...rise(0.04)}>
                    Link not valid
                </motion.h1>
                <motion.p className="verify-email__sub" {...rise(0.08)}>
                    {error || 'This reset link isn’t valid anymore. Links work once, for 15 minutes.'}
                </motion.p>
                <motion.div className="verify-email__actions is-single" {...rise(0.12)}>
                    <button type="button" className="verify-email__btn is-primary" onClick={onRequestNew}>
                        Request a new link
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
                New password
            </motion.h1>
            <motion.p className="verify-email__sub" {...rise(0.08)}>
                Choose a new password for your account.
            </motion.p>

            <motion.div className="password-flow__fields" {...rise(0.12)}>
                <div className="login-field">
                    <input
                        type="password"
                        className="login-input"
                        placeholder="New Password"
                        aria-label="New Password"
                        autoComplete="new-password"
                        minLength={MIN_PASSWORD_LENGTH}
                        autoFocus
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        disabled={busy}
                    />
                </div>
                <div className="login-field">
                    <input
                        type="password"
                        className="login-input"
                        placeholder="Confirm New Password"
                        aria-label="Confirm New Password"
                        autoComplete="new-password"
                        minLength={MIN_PASSWORD_LENGTH}
                        value={confirm}
                        onChange={(event) => setConfirm(event.target.value)}
                        disabled={busy}
                    />
                </div>
            </motion.div>

            <motion.p className="password-flow__note" {...rise(0.14)}>
                A reset creates new encryption keys: messages from before it can’t be read on your devices anymore.
            </motion.p>

            <motion.div className="password-flow__submit" {...rise(0.16)}>
                <button type="submit" className="verify-email__btn is-primary" disabled={busy} aria-busy={busy}>
                    {busy ? <span className="password-flow__spinner" aria-hidden="true" /> : null}
                    {busy ? 'Resetting…' : 'Reset password'}
                </button>
            </motion.div>

            <motion.div className="verify-email__foot" {...rise(0.2)}>
                {error ? <p className="verify-email__error" role="alert">{error}</p> : null}
            </motion.div>
        </form>
    );
}

export function mountResetPassword(host: HTMLElement, props: ResetPasswordProps) {
    mountPasswordFlow(host, <ResetPassword key={Date.now()} {...props} />);
}
