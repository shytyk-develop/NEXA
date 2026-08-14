/** Cursor-following eyes — placeholder for an empty profile avatar. */

const EYE_COUNT = 2;
const PUPIL_RANGE = 0.24;
const SPRING_K = 0.14;
const SPRING_DAMP = 0.78;
const BLINK_MS = 140;
const BLINK_MIN = 3200;
const BLINK_SPAN = 2800;
const IDLE_AFTER_MS = 2600;
const IDLE_WANDER = 22;

/** @type {ReturnType<typeof createState> | null} */
let state = null;

function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function createState(host) {
    return {
        host,
        eyes: [],
        mouseX: window.innerWidth / 2,
        mouseY: window.innerHeight / 2,
        lookX: window.innerWidth / 2,
        lookY: window.innerHeight / 2,
        lastMoveAt: performance.now(),
        raf: 0,
        blinkTimer: 0,
        listeners: /** @type {Array<[EventTarget, string, EventListener, AddEventListenerOptions?]> } */ ([]),
        active: false,
    };
}

/**
 * @param {HTMLElement} host
 */
function buildEyes(host) {
    host.replaceChildren();
    host.classList.add('profile-eyes');
    host.setAttribute('aria-hidden', 'true');

    const pair = document.createElement('div');
    pair.className = 'profile-eyes__pair';

    const eyes = [];
    for (let i = 0; i < EYE_COUNT; i += 1) {
        const eye = document.createElement('div');
        eye.className = 'profile-eye';
        eye.innerHTML = `
            <div class="profile-eye__ball">
                <div class="profile-eye__iris">
                    <div class="profile-eye__fibers"></div>
                    <div class="profile-eye__pupil"></div>
                    <div class="profile-eye__glint"></div>
                    <div class="profile-eye__glint profile-eye__glint--sm"></div>
                </div>
            </div>
            <div class="profile-eye__lid profile-eye__lid--top"></div>
            <div class="profile-eye__lid profile-eye__lid--bot"></div>
        `;
        pair.appendChild(eye);
        eyes.push({
            el: eye,
            iris: eye.querySelector('.profile-eye__iris'),
            pupil: eye.querySelector('.profile-eye__pupil'),
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            pupilScale: 1,
        });
    }

    host.appendChild(pair);
    return eyes;
}

function onMouseMove(event) {
    if (!state) return;
    state.mouseX = event.clientX;
    state.mouseY = event.clientY;
    state.lastMoveAt = performance.now();
}

function onTouchMove(event) {
    if (!state || !event.touches[0]) return;
    state.mouseX = event.touches[0].clientX;
    state.mouseY = event.touches[0].clientY;
    state.lastMoveAt = performance.now();
}

function onVisibility() {
    if (!state?.active) return;
    if (document.hidden) pauseLoop();
    else startLoop();
}

function bindListeners() {
    if (!state) return;
    const opts = { passive: true };
    const add = (target, type, fn, extra) => {
        target.addEventListener(type, fn, extra);
        state.listeners.push([target, type, fn, extra]);
    };
    add(window, 'mousemove', onMouseMove, opts);
    add(window, 'touchmove', onTouchMove, opts);
    add(document, 'visibilitychange', onVisibility);
}

function unbindListeners() {
    if (!state) return;
    state.listeners.forEach(([target, type, fn, extra]) => {
        target.removeEventListener(type, fn, extra);
    });
    state.listeners = [];
}

function maxOffsetFor(eye) {
    const rect = eye.el.getBoundingClientRect();
    const irisSize = rect.width * 0.46;
    return Math.max(0, (rect.width / 2 - irisSize / 2) * PUPIL_RANGE);
}

function tick() {
    if (!state?.active) return;
    const now = performance.now();
    const idle = now - state.lastMoveAt > IDLE_AFTER_MS;

    if (idle) {
        state.lookX += (state.mouseX + (Math.sin(now / 900) * IDLE_WANDER) - state.lookX) * 0.04;
        state.lookY += (state.mouseY + (Math.cos(now / 1100) * IDLE_WANDER * 0.6) - state.lookY) * 0.04;
    } else {
        state.lookX += (state.mouseX - state.lookX) * 0.22;
        state.lookY += (state.mouseY - state.lookY) * 0.22;
    }

    for (const eye of state.eyes) {
        const rect = eye.el.getBoundingClientRect();
        if (!rect.width) continue;

        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = state.lookX - cx;
        const dy = state.lookY - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const max = maxOffsetFor(eye);
        const t = Math.min(dist, max * 14) / (max * 14 || 1);
        const offset = t * max;
        const tx = (dx / dist) * offset;
        const ty = (dy / dist) * offset;

        eye.vx = eye.vx * SPRING_DAMP + (tx - eye.x) * SPRING_K;
        eye.vy = eye.vy * SPRING_DAMP + (ty - eye.y) * SPRING_K;
        eye.x += eye.vx;
        eye.y += eye.vy;

        const proximity =
            dist < 200 ? 1.28 - (dist / 200) * 0.28 : 0.86 + (Math.min(dist, 800) / 800) * 0.14;
        eye.pupilScale += (proximity - eye.pupilScale) * 0.12;

        if (eye.iris) {
            eye.iris.style.transform = `translate(${eye.x.toFixed(2)}px, ${eye.y.toFixed(2)}px)`;
        }
        if (eye.pupil) {
            eye.pupil.style.transform = `scale(${eye.pupilScale.toFixed(3)})`;
        }
    }

    state.raf = requestAnimationFrame(tick);
}

function startLoop() {
    if (!state || state.raf) return;
    state.raf = requestAnimationFrame(tick);
}

function pauseLoop() {
    if (!state?.raf) return;
    cancelAnimationFrame(state.raf);
    state.raf = 0;
}

function blinkOnce() {
    if (!state?.active || reducedMotion()) return;
    state.eyes.forEach((eye, i) => {
        window.setTimeout(() => {
            eye.el.classList.add('is-blinking');
            window.setTimeout(() => eye.el.classList.remove('is-blinking'), BLINK_MS);
        }, i * (40 + Math.random() * 80));
    });
}

function scheduleBlink() {
    if (!state) return;
    window.clearTimeout(state.blinkTimer);
    if (reducedMotion()) return;
    const wait = BLINK_MIN + Math.random() * BLINK_SPAN;
    state.blinkTimer = window.setTimeout(() => {
        blinkOnce();
        scheduleBlink();
    }, wait);
}

/**
 * Mount (or reuse) the eyes inside a host element.
 * @param {HTMLElement | null} host
 */
export function mountProfileEyes(host) {
    if (!host) return;
    if (state?.host === host && state.eyes.length) return;
    stopProfileEyes();
    state = createState(host);
    state.eyes = buildEyes(host);
}

export function startProfileEyes() {
    if (!state?.host || state.active) return;
    if (reducedMotion()) {
        state.host.classList.remove('hidden');
        return;
    }
    state.active = true;
    state.host.classList.remove('hidden');
    bindListeners();
    startLoop();
    scheduleBlink();
}

export function stopProfileEyes() {
    if (!state) return;
    state.active = false;
    pauseLoop();
    unbindListeners();
    window.clearTimeout(state.blinkTimer);
    state.eyes.forEach((eye) => eye.el.classList.remove('is-blinking'));
}

/**
 * Show and animate, or hide and pause.
 * @param {boolean} visible
 * @param {HTMLElement | null} [host]
 */
export function setProfileEyesActive(visible, host) {
    if (visible) {
        const target = host || state?.host || document.getElementById('uiProfileEyes');
        if (!target) return;
        mountProfileEyes(target);
        startProfileEyes();
        return;
    }
    state?.host?.classList.add('hidden');
    stopProfileEyes();
}
