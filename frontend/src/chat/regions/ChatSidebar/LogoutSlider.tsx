import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';

import './logout-slider.css';

// Settings nav → Log out as slide-to-confirm: drag the red handle to the end
// of the track, then a 3 · 2 · 1 countdown (cancellable) and the sign-out.
// Releasing short of the end springs the handle back. Keyboard: Enter / Space
// on the handle starts the same countdown. js/app.js listens for `nexa:logout`.

const PAD = 4; // track padding (px) around the handle
const HANDLE = 40; // handle size (px)
const COUNT_FROM = 3;
const SPRING = { type: 'spring', stiffness: 520, damping: 38 } as const;

export function LogoutSlider() {
    const reduce = useReducedMotion();
    const trackRef = useRef<HTMLDivElement>(null);
    const [maxDrag, setMaxDrag] = useState(0);
    const maxDragRef = useRef(0);
    maxDragRef.current = maxDrag;
    const [isSwiped, setIsSwiped] = useState(false);
    const [count, setCount] = useState(COUNT_FROM);
    const x = useMotionValue(0);
    // The red wash follows the handle: from the left edge to its right side.
    const fillWidth = useTransform(x, (value) => value + HANDLE);
    // The hint fades out as the handle travels over it.
    const hintOpacity = useTransform(x, (value) => 1 - Math.min(1, value / Math.max(maxDragRef.current * 0.6, 1)));

    useLayoutEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        const measure = () => setMaxDrag(Math.max(0, track.clientWidth - PAD * 2 - HANDLE));
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(track);
        return () => observer.disconnect();
    }, []);

    const commit = useCallback(() => {
        if (isSwiped) return;
        setIsSwiped(true);
        setCount(COUNT_FROM);
        animate(x, maxDrag, reduce ? { duration: 0 } : SPRING);
    }, [isSwiped, maxDrag, reduce, x]);

    const cancel = useCallback(() => {
        setIsSwiped(false);
        setCount(COUNT_FROM);
        animate(x, 0, reduce ? { duration: 0 } : SPRING);
    }, [reduce, x]);

    // 3 → 2 → 1 → sign out. Unmounting (leaving Settings) or Cancel stops it.
    useEffect(() => {
        if (!isSwiped) return undefined;
        if (count <= 0) {
            window.dispatchEvent(new CustomEvent('nexa:logout'));
            return undefined;
        }
        const timer = window.setTimeout(() => setCount((value) => value - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [isSwiped, count]);

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        commit();
    };

    return (
        <div ref={trackRef} className="logout-slider" data-state={isSwiped ? 'countdown' : 'idle'}>
            <motion.div className="logout-slider__fill" style={{ width: fillWidth }} aria-hidden="true" />
            <motion.span className="logout-slider__hint" style={{ opacity: hintOpacity }} aria-hidden="true">
                Slide to log out
            </motion.span>

            <motion.div
                className="logout-slider__handle"
                role="button"
                tabIndex={isSwiped ? -1 : 0}
                aria-label="Log out: slide to the end, or press Enter"
                style={{ x }}
                drag={isSwiped ? false : 'x'}
                dragConstraints={{ left: 0, right: maxDrag }}
                dragElastic={0.05}
                dragMomentum={false}
                dragSnapToOrigin={!isSwiped}
                dragTransition={{ bounceStiffness: 520, bounceDamping: 36 }}
                onDrag={() => {
                    if (x.get() >= maxDrag - 5) commit();
                }}
                onKeyDown={onKeyDown}
                animate={{ opacity: isSwiped ? 0 : 1, scale: isSwiped ? 0.8 : 1 }}
                transition={{ duration: 0.2 }}
                whileTap={isSwiped ? undefined : { scale: 0.96 }}
            >
                <svg className="ui-icon" aria-hidden="true"><use href="#icon-logout" /></svg>
            </motion.div>

            {/* Countdown: the track turns into a notice with a Cancel. */}
            <AnimatePresence>
                {isSwiped && (
                    <motion.div
                        className="logout-slider__countdown"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, delay: 0.08 }}
                    >
                        <span className="logout-slider__count" aria-live="assertive">
                            <span className="sr-only">Logging out in</span>
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.span
                                    key={count}
                                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.4 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.25 }}
                                >
                                    {Math.max(count, 1)}
                                </motion.span>
                            </AnimatePresence>
                        </span>
                        {count > 0 && (
                            <button type="button" className="logout-slider__cancel" onClick={cancel} autoFocus>
                                Cancel
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
