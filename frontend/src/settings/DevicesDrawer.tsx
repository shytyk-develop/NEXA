import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import {
    Drawer,
    DrawerBody,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import './devices-drawer.css';

// Settings → Security → "Open devices": a bottom drawer with this account's
// sessions as a horizontal carousel. js/profileSettings.js opens it and
// supplies the data + the terminate call (the vanilla side owns the API).

export type DeviceSession = {
    id: string;
    name: string;
    os: string;
    /** 'ios' | 'android' | 'ipados' → phone icon; anything else → laptop. */
    platform: string;
    online: boolean;
    /** "Online", "Just now", "8d ago"… */
    status: string;
    current: boolean;
};

export type DevicesDrawerSource = {
    load: () => Promise<DeviceSession[]>;
    /** Resolves once the server has ended the session; throws with a message otherwise. */
    terminate: (id: string) => Promise<void>;
};

const PHONE_PLATFORMS = new Set(['ios', 'android', 'ipados']);
/** A destructive tap arms the button; it disarms if not confirmed in time. */
const CONFIRM_WINDOW_MS = 3000;

function DeviceIcon({ platform }: { platform: string }) {
    return PHONE_PLATFORMS.has(platform) ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
            <path d="M10.5 18.5h3" />
        </svg>
    ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="4.5" width="16" height="11" rx="1.8" />
            <path d="M2 19h20" />
        </svg>
    );
}

function DeviceCard({
    device,
    onTerminate,
}: {
    device: DeviceSession;
    onTerminate: (id: string) => Promise<void>;
}) {
    const [isConfirmingKill, setIsConfirmingKill] = useState(false);
    const [busy, setBusy] = useState(false);
    const reduceMotion = useReducedMotion();

    // Not confirmed in time: back to "Terminate session".
    useEffect(() => {
        if (!isConfirmingKill || busy) return;
        const timer = window.setTimeout(() => setIsConfirmingKill(false), CONFIRM_WINDOW_MS);
        return () => window.clearTimeout(timer);
    }, [isConfirmingKill, busy]);

    const onClick = async () => {
        if (!isConfirmingKill) {
            setIsConfirmingKill(true);
            return;
        }
        setBusy(true);
        try {
            await onTerminate(device.id);
        } finally {
            setBusy(false);
            setIsConfirmingKill(false);
        }
    };

    const stage = busy ? 'busy' : isConfirmingKill ? 'confirm' : 'idle';
    const label = { idle: 'Terminate session', confirm: 'Tap again to confirm', busy: 'Terminating…' }[stage];

    return (
        <article className={cn('devices-card', device.current && 'is-current')} data-device-id={device.id}>
            <div className="devices-card__top">
                <span className="devices-card__icon">
                    <DeviceIcon platform={device.platform} />
                </span>
                <span className={cn('devices-card__badge', device.online && 'is-online')}>
                    {device.online && <span className="devices-card__dot" aria-hidden="true" />}
                    {device.status}
                </span>
            </div>
            <div className="devices-card__copy">
                <p className="devices-card__name">{device.name}</p>
                <p className="devices-card__os">{device.os}</p>
            </div>
            <div className="devices-card__foot">
                {device.current ? (
                    <span className="devices-card__this">This device</span>
                ) : (
                    <button
                        type="button"
                        className={cn('devices-card__terminate', stage !== 'idle' && 'is-confirming')}
                        onClick={onClick}
                        disabled={busy}
                        aria-label={isConfirmingKill ? `Confirm: terminate ${device.name}` : `Terminate ${device.name} session`}
                    >
                        {/* The label swaps with a short fade + drop (y −2 → 0). */}
                        <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span
                                key={stage}
                                className="devices-card__terminate-label"
                                initial={reduceMotion ? false : { opacity: 0, y: -2 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 2 }}
                                transition={{ duration: 0.18, ease: 'easeOut' }}
                            >
                                {label}
                            </motion.span>
                        </AnimatePresence>
                    </button>
                )}
            </div>
        </article>
    );
}

/** Horizontal track: snap, vertical wheel → sideways, edge fades + dots for position. */
function DevicesCarousel({ devices, onTerminate }: { devices: DeviceSession[]; onTerminate: (id: string) => Promise<void> }) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [edges, setEdges] = useState({ start: false, end: false });
    const [active, setActive] = useState(0);

    const measure = useCallback(() => {
        const track = trackRef.current;
        if (!track) return;
        const max = track.scrollWidth - track.clientWidth;
        setEdges({ start: track.scrollLeft > 2, end: track.scrollLeft < max - 2 });
        const count = track.children.length;
        if (!count) return;
        // The dot follows scroll progress: first card at the start, last at the end.
        setActive(max <= 2 ? -1 : Math.round((track.scrollLeft / max) * (count - 1)));
    }, []);

    useLayoutEffect(() => {
        measure();
        const track = trackRef.current;
        if (!track) return;
        const observer = new ResizeObserver(measure);
        observer.observe(track);
        return () => observer.disconnect();
    }, [devices, measure]);

    // A mouse wheel only scrolls vertically: turn it sideways while the track can move.
    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        const onWheel = (event: WheelEvent) => {
            if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
            const max = track.scrollWidth - track.clientWidth;
            if (max <= 0) return;
            const next = Math.max(0, Math.min(max, track.scrollLeft + event.deltaY));
            if (next === track.scrollLeft) return;
            event.preventDefault();
            track.scrollLeft = next;
        };
        track.addEventListener('wheel', onWheel, { passive: false });
        return () => track.removeEventListener('wheel', onWheel);
    }, []);

    const scrollToCard = (index: number) => {
        const track = trackRef.current;
        const card = track?.children[index] as HTMLElement | undefined;
        if (!track || !card) return;
        track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' });
    };

    const scrollable = active !== -1;

    return (
        <div className={cn('devices-carousel', edges.start && 'has-start', edges.end && 'has-end')}>
            <div ref={trackRef} className="devices-carousel__track" onScroll={measure} role="list" aria-label="Signed-in devices">
                {devices.map((device) => (
                    <div key={device.id} className="devices-carousel__item" role="listitem">
                        <DeviceCard device={device} onTerminate={onTerminate} />
                    </div>
                ))}
            </div>
            {scrollable && (
                <div className="devices-carousel__dots" role="tablist" aria-label="Devices">
                    {devices.map((device, index) => (
                        <button
                            key={device.id}
                            type="button"
                            role="tab"
                            aria-selected={index === active}
                            aria-label={`Show ${device.name}`}
                            className={cn('devices-carousel__dot', index === active && 'is-active')}
                            onClick={() => scrollToCard(index)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function DevicesDrawer({ source, open, onOpenChange }: { source: DevicesDrawerSource | null; open: boolean; onOpenChange: (open: boolean) => void }) {
    const [devices, setDevices] = useState<DeviceSession[] | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open || !source) return;
        let cancelled = false;
        setError('');
        source
            .load()
            .then((list) => {
                if (!cancelled) setDevices(list);
            })
            .catch(() => {
                if (!cancelled) setError('Could not load your devices. Check your connection and try again.');
            });
        return () => {
            cancelled = true;
        };
    }, [open, source]);

    const terminate = useCallback(
        async (id: string) => {
            if (!source) return;
            try {
                await source.terminate(id);
                setError('');
                setDevices((list) => list?.filter((device) => device.id !== id) ?? list);
            } catch (err) {
                setError(err instanceof Error && err.message ? err.message : 'Could not terminate that session.');
            }
        },
        [source],
    );

    const others = devices?.filter((device) => !device.current).length ?? 0;

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="devices-drawer">
                <DrawerHeader className="devices-drawer__header">
                    <DrawerTitle>Connected Devices</DrawerTitle>
                    <DrawerDescription>View and manage active E2EE sessions for this account</DrawerDescription>
                    {/* Server errors ("Not Found", offline…) as a pill in the header's top right. */}
                    <AnimatePresence>
                        {error && (
                            <motion.p
                                key={error}
                                className="devices-drawer__error"
                                role="alert"
                                title={error}
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.18, ease: 'easeOut' }}
                            >
                                {error}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </DrawerHeader>
                <DrawerBody>
                    {devices === null && !error && (
                        <div className="devices-carousel" aria-busy="true">
                            <div className="devices-carousel__track">
                                {[0, 1, 2].map((key) => (
                                    <div key={key} className="devices-carousel__item">
                                        <div className="devices-card is-skeleton" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {devices && <DevicesCarousel devices={devices} onTerminate={terminate} />}
                </DrawerBody>
                <DrawerFooter>
                    {devices && (
                        <p className="devices-drawer__summary">
                            {devices.length} {devices.length === 1 ? 'session' : 'sessions'}
                            {others ? ` · ${others} on other ${others === 1 ? 'device' : 'devices'}` : ''}
                        </p>
                    )}
                    <DrawerClose asChild>
                        <button type="button" className="devices-drawer__close">
                            Close
                        </button>
                    </DrawerClose>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}

// ── Mount (js/profileSettings.js) ───────────────────────────────────────────

let root: Root | null = null;
let current: DevicesDrawerSource | null = null;

function render(open: boolean) {
    if (!root) {
        const host = document.createElement('div');
        host.id = 'uiDevicesDrawerRoot';
        document.body.append(host);
        root = createRoot(host);
    }
    root.render(<DevicesDrawer source={current} open={open} onOpenChange={(next) => render(next)} />);
}

export function openDevicesDrawer(source: DevicesDrawerSource) {
    current = source;
    render(true);
}
