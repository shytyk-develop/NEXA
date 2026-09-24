// Swipe-to-reply: drag a message bubble left past a threshold and let go to reply.
// One delegated pointer listener on the thread; text selection keeps priority.

/** Pull (after rubber-banding) that arms the reply. */
const THRESHOLD_PX = 36;
/** Asymptote of the rubber band — the bubble never travels further than this. */
const MAX_PULL_PX = 56;
/** Movement before the gesture commits to a direction. */
const DECIDE_PX = 6;
/** Keep in sync with `--swipe-reply-return` in message-features.css. */
const RETURN_MS = 350;

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * iOS-style rubber band: tracks the finger 1:1 at first, then stiffens toward
 * MAX_PULL_PX. Arms after ~101px of finger travel (pull 36 of 56).
 */
function rubberBand(distance) {
    return MAX_PULL_PX * (1 - 1 / (distance / MAX_PULL_PX + 1));
}

function hasTextSelection() {
    return (window.getSelection?.()?.toString().length ?? 0) > 0;
}

function createReplyIcon() {
    const wrap = document.createElement('span');
    wrap.className = 'message-swipe-reply';
    wrap.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ui-icon');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#icon-reply');
    svg.append(use);
    wrap.append(svg);
    return wrap;
}

/**
 * @param {HTMLElement} messagesEl  the thread container (#messages)
 * @param {{ onReply: (row: HTMLElement) => void }} handlers
 */
export function initSwipeToReply(messagesEl, { onReply }) {
    /** @type {null | { row: HTMLElement, bubble: HTMLElement, shell: HTMLElement, pointerId: number, startX: number, startY: number, swiping: boolean, armed: boolean, icon: HTMLElement | null }} */
    let gesture = null;
    let suppressClick = false;

    const reset = () => {
        gesture = null;
        document.documentElement.classList.remove('is-swiping-message');
    };

    const render = (g, pull) => {
        g.bubble.style.transform = `translateX(${-pull}px)`;
        const progress = Math.min(pull / THRESHOLD_PX, 1);
        // Icon eases in from behind the bubble's right edge: fades, grows, un-rotates.
        g.icon.style.opacity = String(progress);
        g.icon.style.transform = `translateY(-50%) scale(${0.6 + 0.4 * progress}) rotate(${(1 - progress) * -45}deg)`;

        const armed = pull >= THRESHOLD_PX;
        if (armed !== g.armed) {
            g.armed = armed;
            g.icon.classList.toggle('is-armed', armed);
            // Soft tick where supported (Android); a no-op elsewhere.
            if (armed) navigator.vibrate?.(8);
        }
    };

    /** Spring the bubble home and fade the icon, then drop the inline styles. */
    const release = (g) => {
        const { bubble, icon } = g;
        const reduce = prefersReducedMotion();
        bubble.classList.add('is-swipe-returning');
        icon.classList.add('is-swipe-returning');
        bubble.style.transform = 'translateX(0)';
        icon.style.opacity = '0';
        icon.style.transform = 'translateY(-50%) scale(0.6) rotate(-45deg)';
        window.setTimeout(() => {
            icon.remove();
            // Grabbed again mid-return: the new swipe owns the transform now.
            if (g.row.classList.contains('is-swiping')) return;
            bubble.classList.remove('is-swipe-returning');
            bubble.style.transform = '';
        }, reduce ? 0 : RETURN_MS);
    };

    const start = (g) => {
        g.swiping = true;
        // Follow the pointer 1:1 even if the bubble is still springing back.
        g.bubble.classList.remove('is-swipe-returning');
        g.icon = createReplyIcon();
        g.shell.append(g.icon);
        g.row.classList.add('is-swiping');
        // A mouse drag from the padding can start a selection on its way over text.
        document.documentElement.classList.add('is-swiping-message');
        window.getSelection?.()?.removeAllRanges();
        try {
            g.bubble.setPointerCapture(g.pointerId);
        } catch {
            /* pointer already gone */
        }
    };

    messagesEl.addEventListener('pointerdown', (event) => {
        if (gesture || !event.isPrimary) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;

        const bubble = event.target.closest('.message-bubble');
        const row = bubble?.closest('.message-row');
        const shell = bubble?.closest('.message-shell');
        if (!bubble || !row || !shell) return;
        // Controls inside the bubble keep their own clicks; the open quick bar owns the bubble.
        if (event.target.closest('a, button, input, textarea, .message-quickbar')) return;
        if (bubble.classList.contains('has-quickbar')) return;
        // Replies need a synced id.
        if (row.classList.contains('is-actions-pending')) return;
        // Mouse on the text itself means selecting; swipe from the bubble's padding / time.
        if (event.pointerType === 'mouse' && event.target.closest('.message-text')) return;

        gesture = {
            row,
            bubble,
            shell,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            swiping: false,
            armed: false,
            icon: null,
        };
    });

    messagesEl.addEventListener('pointermove', (event) => {
        const g = gesture;
        if (!g || event.pointerId !== g.pointerId) return;

        const dx = event.clientX - g.startX;
        const dy = event.clientY - g.startY;

        if (!g.swiping) {
            if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) return;
            // Selecting text, scrolling, or pulling right: not a swipe.
            if (hasTextSelection() || Math.abs(dy) >= Math.abs(dx) || dx > 0) {
                reset();
                return;
            }
            start(g);
        }

        event.preventDefault();
        render(g, rubberBand(Math.max(0, -dx)));
    });

    const end = (event, cancelled) => {
        const g = gesture;
        if (!g || event.pointerId !== g.pointerId) return;
        reset();
        if (!g.swiping) return;

        g.row.classList.remove('is-swiping');
        // The mouseup that ends a drag would otherwise land as a click on the bubble.
        // That click (if any) is dispatched right after pointerup, so clear the flag
        // on the next task either way — it must never swallow a later, real click.
        if (event.pointerType === 'mouse') {
            suppressClick = true;
            window.setTimeout(() => {
                suppressClick = false;
            }, 0);
        }
        const fire = g.armed && !cancelled;
        release(g);
        if (fire) onReply(g.row);
    };

    messagesEl.addEventListener('pointerup', (event) => end(event, false));
    // Browser took over (e.g. started a vertical scroll): spring back, no reply.
    messagesEl.addEventListener('pointercancel', (event) => end(event, true));

    messagesEl.addEventListener('click', (event) => {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
    }, true);
}
