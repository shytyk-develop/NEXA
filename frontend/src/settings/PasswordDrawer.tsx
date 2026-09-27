import { useEffect, useState, type FormEvent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { motion, useReducedMotion } from 'motion/react';

import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import './password-drawer.css';

// Settings → Security → Password: current + new (+ repeat). On success the
// server has signed out every other session; js/profileSettings.js shows the
// toast. A wrong current password shakes that field.

export type PasswordDrawerSource = {
    /** Resolves when changed; throws (.status 400 = wrong current password) otherwise. */
    submit: (oldPassword: string, newPassword: string) => Promise<void>;
    onChanged: () => void;
};

const MIN_LENGTH = 8;
const SHAKE = { x: [0, -10, 9, -7, 5, -2, 0] };

type Field = 'current' | 'next' | 'repeat';

function PasswordDrawer({ source, open, onOpenChange }: {
    source: PasswordDrawerSource | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const reduce = useReducedMotion();
    const [values, setValues] = useState<Record<Field, string>>({ current: '', next: '', repeat: '' });
    const [error, setError] = useState<{ field: Field | null; message: string }>({ field: null, message: '' });
    const [shake, setShake] = useState(0);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        setValues({ current: '', next: '', repeat: '' });
        setError({ field: null, message: '' });
        setBusy(false);
    }, [open, source]);

    const fail = (field: Field | null, message: string) => {
        setError({ field, message });
        setShake((n) => n + 1);
    };

    const onSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!source || busy) return;
        const { current, next, repeat } = values;
        if (!current) return fail('current', 'Enter your current password.');
        if (next.length < MIN_LENGTH) return fail('next', `Use at least ${MIN_LENGTH} characters.`);
        if (next === current) return fail('next', 'The new password must be different.');
        if (repeat !== next) return fail('repeat', 'The passwords don’t match.');
        setBusy(true);
        try {
            await source.submit(current, next);
            onOpenChange(false);
            source.onChanged();
        } catch (err) {
            const status = (err as { status?: number })?.status;
            const message = err instanceof Error && err.message ? err.message : 'Couldn’t change the password.';
            fail(status === 400 && /current/i.test(message) ? 'current' : null, message === 'Invalid current password' ? 'That’s not your current password.' : message);
        } finally {
            setBusy(false);
        }
    };

    const input = (field: Field, placeholder: string, autoComplete: string) => (
        <motion.input
            key={error.field === field ? `${field}-${shake}` : field}
            type="password"
            className={cn('password-drawer__input', error.field === field && 'is-error')}
            placeholder={placeholder}
            autoComplete={autoComplete}
            autoFocus={field === 'current'}
            value={values[field]}
            disabled={busy}
            aria-invalid={error.field === field || undefined}
            onChange={(event) => {
                setValues((prev) => ({ ...prev, [field]: event.target.value }));
                if (error.message) setError({ field: null, message: '' });
            }}
            animate={error.field === field && shake && !reduce ? SHAKE : undefined}
            transition={{ duration: 0.42, ease: 'easeOut' }}
        />
    );

    return (
        <Drawer open={open} onOpenChange={(next) => !busy && onOpenChange(next)} dismissible={!busy}>
            <DrawerContent className="password-drawer">
                <form className="password-drawer__form" onSubmit={onSubmit} noValidate>
                    <DrawerHeader className="password-drawer__header">
                        <span className="password-drawer__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                        </span>
                        <DrawerTitle>Change password</DrawerTitle>
                        <DrawerDescription>Every other device will be signed out.</DrawerDescription>
                    </DrawerHeader>
                    <div className="password-drawer__fields">
                        {input('current', 'Current password', 'current-password')}
                        {input('next', `New password (${MIN_LENGTH}+ characters)`, 'new-password')}
                        {input('repeat', 'Repeat new password', 'new-password')}
                        <p className={cn('password-drawer__msg', error.message && 'is-error')} aria-live="polite">
                            {error.message || 'Your encryption key is re-locked with the new password on this device.'}
                        </p>
                    </div>
                    <DrawerFooter className="password-drawer__footer">
                        <button type="button" className="password-drawer__btn" onClick={() => onOpenChange(false)} disabled={busy}>
                            Cancel
                        </button>
                        <button type="submit" className="password-drawer__btn is-primary" disabled={busy}>
                            {busy ? (
                                <span className="password-drawer__status"><span className="password-drawer__spinner" aria-hidden="true" />Updating…</span>
                            ) : (
                                'Update password'
                            )}
                        </button>
                    </DrawerFooter>
                </form>
            </DrawerContent>
        </Drawer>
    );
}

let root: Root | null = null;
let current: PasswordDrawerSource | null = null;

function render(open: boolean) {
    if (!root) {
        const host = document.createElement('div');
        host.id = 'uiPasswordDrawerRoot';
        document.body.append(host);
        root = createRoot(host);
    }
    root.render(<PasswordDrawer source={current} open={open} onOpenChange={(next) => render(next)} />);
}

export function openPasswordDrawer(source: PasswordDrawerSource) {
    current = source;
    render(true);
}
