/** 3D tilt for the profile preview card — tracks the whole stage, not just the card. */

const MAX_TILT = 10.5;
const SPRING_K = 0.16;
const SPRING_DAMP = 0.78;

/** @type {ReturnType<typeof createState> | null} */
let state = null;

function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function createState(stage, card) {
    return {
        stage,
        card,
        targetX: 0,
        targetY: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        raf: 0,
        hovering: false,
        onMove: null,
        onLeave: null,
    };
}

function applyTransform() {
    if (!state?.card) return;
    state.card.style.transform =
        `translateZ(28px) rotateX(${state.x.toFixed(3)}deg) rotateY(${state.y.toFixed(3)}deg)`;
}

function tick() {
    if (!state) return;
    state.vx = state.vx * SPRING_DAMP + (state.targetX - state.x) * SPRING_K;
    state.vy = state.vy * SPRING_DAMP + (state.targetY - state.y) * SPRING_K;
    state.x += state.vx;
    state.y += state.vy;

    applyTransform();

    const settled =
        !state.hovering &&
        Math.abs(state.x) < 0.02 &&
        Math.abs(state.y) < 0.02 &&
        Math.abs(state.vx) < 0.02 &&
        Math.abs(state.vy) < 0.02;

    if (settled) {
        state.x = 0;
        state.y = 0;
        state.vx = 0;
        state.vy = 0;
        applyTransform();
        state.raf = 0;
        return;
    }

    state.raf = requestAnimationFrame(tick);
}

function startLoop() {
    if (!state || state.raf) return;
    state.raf = requestAnimationFrame(tick);
}

function onMove(event) {
    if (!state) return;
    const rect = state.stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const xPct = (event.clientX - rect.left) / rect.width - 0.5;
    const yPct = (event.clientY - rect.top) / rect.height - 0.5;
    state.targetX = -yPct * (MAX_TILT * 2);
    state.targetY = xPct * (MAX_TILT * 2);
    state.hovering = true;
    startLoop();
}

function onLeave() {
    if (!state) return;
    state.hovering = false;
    state.targetX = 0;
    state.targetY = 0;
    startLoop();
}

export function startPreviewTilt(stage, card) {
    if (!stage || !card || reducedMotion()) return;
    if (state?.stage === stage && state?.card === card) return;
    stopPreviewTilt();
    state = createState(stage, card);
    state.onMove = onMove;
    state.onLeave = onLeave;
    stage.addEventListener('mousemove', state.onMove, { passive: true });
    stage.addEventListener('mouseleave', state.onLeave);
}

export function stopPreviewTilt() {
    if (!state) return;
    state.stage.removeEventListener('mousemove', state.onMove);
    state.stage.removeEventListener('mouseleave', state.onLeave);
    if (state.raf) cancelAnimationFrame(state.raf);
    if (state.card) state.card.style.transform = '';
    state = null;
}
