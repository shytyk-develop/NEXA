import { gsap } from 'gsap';

// Long enough for a panel's looping mockup animation to play through once
// (Talk needs ask → reply → like → follow-up).
const INTERVAL_MS = 5600;

const STEPS = [
    {
        name: 'Open',
        description: 'No app store. No download. Just visit the site and you’re already in the right place.',
    },
    {
        name: 'Username',
        description: 'Choose a name you like. That’s your identity — no phone number, no email required.',
    },
    {
        name: 'Find',
        description: 'Search for a friend or share your username. When they accept, you’re connected.',
    },
    {
        name: 'Talk',
        description: 'Type what you mean. Your message is locked on your device before it ever leaves this tab.',
    },
];

function cubicBezier(p1x, p1y, p2x, p2y) {
    const cx = 3 * p1x;
    const bx = 3 * (p2x - p1x) - cx;
    const ax = 1 - cx - bx;
    const cy = 3 * p1y;
    const by = 3 * (p2y - p1y) - cy;
    const ay = 1 - cy - by;

    const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
    const sampleY = (t) => ((ay * t + by) * t + cy) * t;
    const slopeX = (t) => (3 * ax * t + 2 * bx) * t + cx;

    return (x) => {
        let t = x;
        for (let i = 0; i < 8; i += 1) {
            const error = sampleX(t) - x;
            if (Math.abs(error) < 1e-5) break;
            const slope = slopeX(t);
            if (Math.abs(slope) < 1e-6) break;
            t -= error / slope;
        }
        return sampleY(t);
    };
}

// Analytic solution of the framer-motion spring used by the reference component.
function springEase(stiffness, damping, mass, duration) {
    const w0 = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    const decay = zeta * w0;

    let value;
    if (zeta > 1) {
        const wd = w0 * Math.sqrt(zeta * zeta - 1);
        value = (t) => 1 - Math.exp(-decay * t) * (Math.cosh(wd * t) + (decay / wd) * Math.sinh(wd * t));
    } else if (zeta === 1) {
        value = (t) => 1 - Math.exp(-decay * t) * (1 + decay * t);
    } else {
        const wd = w0 * Math.sqrt(1 - zeta * zeta);
        value = (t) => 1 - Math.exp(-decay * t) * (Math.cos(wd * t) + (decay / wd) * Math.sin(wd * t));
    }

    const end = value(duration);
    return (p) => value(p * duration) / end;
}

const SPRING_DURATION = 0.45;
const COPY_DURATION = 0.3;

const EASE_SPRING = springEase(300, 25, 0.5, SPRING_DURATION);
const EASE_COPY = cubicBezier(0.23, 1, 0.32, 1);

const SPRING = { duration: SPRING_DURATION, ease: EASE_SPRING };
const COPY = { duration: COPY_DURATION, ease: EASE_COPY };

let carouselCtl = null;

function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Slots carry a responsive base scale in CSS, so tweens must carry it too —
// GSAP writes a full transform and would otherwise drop it.
function baseScale(el) {
    const raw = parseFloat(getComputedStyle(el).getPropertyValue('--fc-scale'));
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function slideIn(tl, el, from, at) {
    const s = baseScale(el);
    tl.fromTo(el, { opacity: 0, x: from, scale: s }, { opacity: 1, x: 0, scale: s, ...SPRING }, at);
}

function fadeInScale(tl, el, at) {
    const s = baseScale(el);
    tl.fromTo(el, { opacity: 0, scale: s * 0.95 }, { opacity: 1, scale: s, ...SPRING }, at);
}

function animateShots(panel, stepIndex, tl, at) {
    const shots = [...panel.querySelectorAll('[data-fc-shot]')].filter(
        (shot) => getComputedStyle(shot).display !== 'none',
    );
    const delayed = at + 0.1;
    const narrow = window.matchMedia('(max-width: 767px)').matches;

    // Mobile shows a single centered phone — always fade/scale, never slide.
    if (narrow || stepIndex !== 0) {
        if (shots[0]) fadeInScale(tl, shots[0], at);
        if (shots[1]) fadeInScale(tl, shots[1], delayed);
        return;
    }

    if (shots[0]) slideIn(tl, shots[0], -20, at);
    if (shots[1]) slideIn(tl, shots[1], 20, delayed);
}

function clearShotMotion(panel) {
    if (!panel) return;
    panel.querySelectorAll('[data-fc-shot]').forEach((shot) => {
        gsap.set(shot, { clearProps: 'opacity,transform,x,y,scale' });
    });
}

export function mountFeatureCarousel(root) {
    destroyFeatureCarousel();
    if (!root) return;

    const animated = root.querySelector('[data-fc-animated]');
    const card = root.querySelector('[data-fc-card]');
    const copy = root.querySelector('[data-fc-copy]');
    const titleEl = root.querySelector('[data-fc-title]');
    const descWrap = root.querySelector('[data-fc-desc-wrap]');
    const descEl = root.querySelector('[data-fc-desc]');
    const pills = [...root.querySelectorAll('[data-fc-step-pill]')];
    const panels = [...root.querySelectorAll('[data-fc-panel]')];
    const hit = root.querySelector('[data-fc-hit]');

    if (!copy || !titleEl || !descEl || !descWrap || !panels.length) return;

    let step = 0;
    let timer = 0;
    let animating = false;
    let activeTl = null;

    const paintSteps = (activeStep = step) => {
        pills.forEach((pill, i) => {
            pill.classList.toggle('is-done', i < activeStep);
            pill.classList.toggle('is-active', i === activeStep);
            if (i === activeStep) pill.setAttribute('aria-current', 'step');
            else pill.removeAttribute('aria-current');
        });
    };

    const setPanel = (index) => {
        panels.forEach((panel, i) => panel.classList.toggle('is-active', i === index));
    };

    const writeCopy = (index) => {
        titleEl.textContent = `${index + 1}. ${STEPS[index].name}`;
        descEl.textContent = STEPS[index].description;
    };

    const primeCopyEnter = () => {
        gsap.set(copy, { opacity: 0, y: 20 });
        gsap.set(titleEl, { x: -20 });
        gsap.set(descWrap, { x: -20 });
    };

    const enterCopy = (tl, at) => {
        tl.to(copy, { opacity: 1, y: 0, force3D: true, ...COPY }, at);
        tl.to(titleEl, { x: 0, force3D: true, ...COPY }, at + 0.1);
        tl.to(descWrap, { x: 0, force3D: true, ...COPY }, at + 0.2);
    };

    const settle = (panel) => {
        clearShotMotion(panel);
        gsap.set([copy, titleEl, descWrap], { clearProps: 'opacity,transform,x,y' });
    };

    const stopAutoplay = () => {
        clearTimeout(timer);
        timer = 0;
    };

    const schedule = () => {
        stopAutoplay();
        if (reducedMotion() || animating) return;
        timer = window.setTimeout(() => {
            goTo((step + 1) % STEPS.length);
        }, INTERVAL_MS);
    };

    const resetMotion = () => {
        activeTl?.kill();
        activeTl = null;
        const shots = [...root.querySelectorAll('[data-fc-shot]')];
        gsap.killTweensOf([copy, titleEl, descWrap, ...panels, ...shots]);
    };

    const snapToStep = (index) => {
        resetMotion();
        step = index;
        writeCopy(index);
        setPanel(index);
        paintSteps(index);
        panels.forEach((panel, i) => {
            if (i !== index) {
                gsap.set(panel, { clearProps: 'opacity,transform,scale' });
                clearShotMotion(panel);
            }
        });
        settle(panels[index]);
        animating = false;
    };

    const goTo = (targetStep) => {
        if (targetStep === step && !animating) {
            schedule();
            return;
        }

        if (animating) {
            snapToStep(step);
        }

        if (targetStep === step) {
            schedule();
            return;
        }

        const fromStep = step;
        const outPanel = panels[fromStep];
        const inPanel = panels[targetStep];

        animating = true;
        stopAutoplay();
        resetMotion();

        const tl = gsap.timeline({
            onComplete: () => {
                step = targetStep;
                settle(inPanel);
                animating = false;
                activeTl = null;
                schedule();
            },
        });
        activeTl = tl;

        // Copy block: exit fully, swap text, then enter (AnimatePresence mode="wait").
        tl.to(copy, { opacity: 0, y: -20, force3D: true, ...COPY }, 0);
        if (outPanel) {
            tl.to(outPanel, { opacity: 0, scale: 0.95, ...SPRING }, 0);
        }

        tl.add(() => {
            writeCopy(targetStep);
            paintSteps(targetStep);
            primeCopyEnter();
        }, COPY_DURATION);

        enterCopy(tl, COPY_DURATION);

        tl.add(() => {
            clearShotMotion(outPanel);
            gsap.set(outPanel, { clearProps: 'opacity,transform,scale' });
            setPanel(targetStep);
        }, SPRING_DURATION);

        if (inPanel) {
            tl.fromTo(inPanel, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, ...SPRING }, SPRING_DURATION);
            animateShots(inPanel, targetStep, tl, SPRING_DURATION);
        }
    };

    const increment = () => goTo((step + 1) % STEPS.length);

    const onPillClick = (e) => {
        const pill = e.currentTarget;
        const index = Number(pill.dataset.fcStepPill);
        if (!Number.isFinite(index)) return;
        e.preventDefault();
        e.stopPropagation();
        goTo(index);
    };

    const onPillKeydown = (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onPillClick(e);
    };

    const onPointerMove = (e) => {
        if (!card) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    };

    writeCopy(0);
    setPanel(0);
    paintSteps();

    if (!reducedMotion()) {
        primeCopyEnter();

        const intro = gsap.timeline({
            delay: 0.2,
            onComplete: () => {
                settle(panels[0]);
                schedule();
            },
        });
        enterCopy(intro, 0);
        intro.fromTo(panels[0], { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, ...SPRING }, 0);
        animateShots(panels[0], 0, intro, 0);
    } else {
        schedule();
    }

    hit?.addEventListener('click', increment);
    pills.forEach((pill) => {
        pill.addEventListener('click', onPillClick);
        pill.addEventListener('keydown', onPillKeydown);
    });
    animated?.addEventListener('pointermove', onPointerMove, { passive: true });

    carouselCtl = {
        destroy() {
            stopAutoplay();
            resetMotion();
            hit?.removeEventListener('click', increment);
            pills.forEach((pill) => {
                pill.removeEventListener('click', onPillClick);
                pill.removeEventListener('keydown', onPillKeydown);
            });
            animated?.removeEventListener('pointermove', onPointerMove);

            panels.forEach((panel, i) => {
                panel.classList.toggle('is-active', i === 0);
                gsap.set(panel, { clearProps: 'opacity,transform,scale' });
                clearShotMotion(panel);
            });

            gsap.set([copy, titleEl, descWrap], { clearProps: 'opacity,transform,x,y' });
            writeCopy(0);
            step = 0;
            animating = false;
            paintSteps();
        },
    };
}

export function destroyFeatureCarousel() {
    carouselCtl?.destroy();
    carouselCtl = null;
}
