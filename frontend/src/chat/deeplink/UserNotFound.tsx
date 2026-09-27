import { createRoot, type Root } from 'react-dom/client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, UserX } from 'lucide-react';

import './user-not-found.css';

// /chat/@handle for a handle nobody has: a card over the empty chat stage
// with the way back. js/app.js shows it when the resolver answers 404.

type Props = { username: string | null; onBack: () => void };

const EASE = [0.22, 1, 0.36, 1] as const;

function UserNotFound({ username, onBack }: Props) {
    const reduce = useReducedMotion();
    return (
        <AnimatePresence>
            {username && (
                <motion.div
                    key={username}
                    className="user-not-found"
                    role="alert"
                    data-testid="user-not-found"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.38, ease: EASE }}
                >
                    <motion.span
                        className="user-not-found__icon"
                        aria-hidden="true"
                        initial={reduce ? false : { rotate: -8, scale: 0.8 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ delay: 0.08, type: 'spring', stiffness: 320, damping: 18 }}
                    >
                        <UserX size={22} strokeWidth={1.8} />
                    </motion.span>
                    <h2 className="user-not-found__title">
                        User <span className="user-not-found__handle">@{username}</span> not found
                    </h2>
                    <p className="user-not-found__sub">The link may be mistyped, or this account no longer exists.</p>
                    <button type="button" className="user-not-found__back" onClick={onBack}>
                        <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
                        Back to Chats
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

let root: Root | null = null;
let host: HTMLElement | null = null;
let onBackHandler: () => void = () => {};

function render(username: string | null) {
    const stage = document.querySelector<HTMLElement>('#page-chat .chat-stage');
    if (!stage) return;
    if (!host || !stage.contains(host)) {
        root?.unmount();
        host = document.createElement('div');
        host.className = 'user-not-found-host';
        stage.append(host);
        root = createRoot(host);
    }
    host.classList.toggle('is-active', Boolean(username));
    root!.render(<UserNotFound username={username} onBack={() => onBackHandler()} />);
}

export function showUserNotFound(username: string, onBack: () => void) {
    onBackHandler = onBack;
    render(username);
}

export function hideUserNotFound() {
    if (host?.classList.contains('is-active')) render(null);
}
