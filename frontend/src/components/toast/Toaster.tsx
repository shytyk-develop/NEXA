import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CircleCheck, CircleX, TriangleAlert, X } from 'lucide-react';

import './toast.css';

// The app's one notification surface: bottom-right stack of glass banners
// (success / warning / error) with a close button and a draining progress
// bar. Everything calls showToast() — js/ui.js keeps its old
// showToast(message, type) signature as a thin adapter over this.

export type ToastType = 'success' | 'warning' | 'error';

export type ToastOptions = {
    message: string;
    type?: ToastType;
    /** Auto-dismiss after this many ms (default 4000). */
    duration?: number;
};

type ToastItem = Required<ToastOptions> & { id: number; /** bumps when a duplicate re-arms it */ rev: number };

const DEFAULT_DURATION = 4000;
const MAX_VISIBLE = 5;
const EASE = [0.22, 1, 0.36, 1] as const;
// Soft spring for position (no overshoot), slower fades; neighbours glide on the same spring.
const SPRING = { type: 'spring', stiffness: 210, damping: 30, mass: 1 } as const;
const ENTER = {
    x: SPRING,
    scale: SPRING,
    opacity: { duration: 0.45, ease: EASE },
    filter: { duration: 0.45, ease: EASE },
    layout: { type: 'spring', stiffness: 260, damping: 34, mass: 1 },
} as const;
const EXIT = {
    x: { duration: 0.42, ease: [0.4, 0, 0.2, 1] },
    scale: { duration: 0.42, ease: [0.4, 0, 0.2, 1] },
    opacity: { duration: 0.34, ease: [0.4, 0, 1, 1] },
    filter: { duration: 0.34, ease: 'easeIn' },
} as const;

// ─── Store ───────────────────────────────────────────────────────────────
let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function dismissToast(id: number) {
    const next = toasts.filter((toast) => toast.id !== id);
    if (next.length === toasts.length) return;
    toasts = next;
    emit();
}

/** Show a toast; returns its id (for dismissToast). */
export function showToast({ message, type = 'success', duration = DEFAULT_DURATION }: ToastOptions): number {
    const text = String(message ?? '').trim();
    if (!text) return 0;
    ensureMounted();

    // The same message already on screen: re-arm it instead of stacking a copy.
    const same = toasts.find((toast) => toast.message === text && toast.type === type);
    if (same) {
        toasts = toasts.map((toast) => (toast === same ? { ...toast, duration, rev: toast.rev + 1 } : toast));
        emit();
        return same.id;
    }

    const toast: ToastItem = { id: nextId++, message: text, type, duration, rev: 0 };
    toasts = [...toasts, toast].slice(-MAX_VISIBLE);
    emit();
    return toast.id;
}

// ─── UI ──────────────────────────────────────────────────────────────────
const ICONS = { success: CircleCheck, warning: TriangleAlert, error: CircleX } as const;

function Toast({ toast }: { toast: ToastItem }) {
    const reduce = useReducedMotion();
    const Icon = ICONS[toast.type];
    const [paused, setPaused] = useState(false);
    // Time left survives hover pauses; the bar's CSS animation pauses with it.
    const remaining = useRef(toast.duration);
    const startedAt = useRef(0);

    useEffect(() => {
        remaining.current = toast.duration;
    }, [toast.rev, toast.duration]);

    useEffect(() => {
        if (paused) return undefined;
        startedAt.current = performance.now();
        const timer = window.setTimeout(() => dismissToast(toast.id), remaining.current);
        return () => {
            window.clearTimeout(timer);
            remaining.current -= performance.now() - startedAt.current;
        };
    }, [paused, toast.id, toast.rev]);

    return (
        <motion.li
            layout={!reduce}
            className={`nexa-toast is-${toast.type}`}
            role={toast.type === 'error' ? 'alert' : 'status'}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 44, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 52, scale: 0.95, filter: 'blur(6px)', transition: EXIT }}
            transition={reduce ? { duration: 0.2 } : ENTER}
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            <span className="nexa-toast__icon" aria-hidden="true">
                <Icon size={18} strokeWidth={2} />
            </span>
            <p className="nexa-toast__message">{toast.message}</p>
            <button type="button" className="nexa-toast__close" aria-label="Dismiss notification" onClick={() => dismissToast(toast.id)}>
                <X size={15} strokeWidth={2} />
            </button>
            <span
                key={toast.rev}
                className="nexa-toast__progress"
                aria-hidden="true"
                style={{ animationDuration: `${toast.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
            />
        </motion.li>
    );
}

function Toaster() {
    const items = useSyncExternalStore(subscribe, () => toasts, () => toasts);
    return (
        <ol className="nexa-toaster" aria-live="polite" aria-label="Notifications">
            <AnimatePresence mode="popLayout">
                {items.map((toast) => (
                    <Toast key={toast.id} toast={toast} />
                ))}
            </AnimatePresence>
        </ol>
    );
}

let mounted = false;

function ensureMounted() {
    if (mounted || typeof document === 'undefined') return;
    mounted = true;
    const host = document.createElement('div');
    host.id = 'uiToaster';
    document.body.append(host);
    createRoot(host).render(<Toaster />);
}
