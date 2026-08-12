import { gsap } from 'gsap';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let ctl = null;

/**
 * Connect-style CTA: mouse-follow glow, canvas particles, looping pointer tour.
 */
export function mountCtaBand(root) {
    destroyCtaBand();
    if (!root) return;

    const group = root.querySelector('[data-cta-group]');
    const item = root.querySelector('[data-cta-item]');
    const particlesHost = root.querySelector('[data-cta-particles]');
    const stage = root.querySelector('[data-cta-stage]');

    const cleanups = [];

    if (group && item && !reducedMotion()) {
        cleanups.push(mountHighlighter(group, item));
    }

    if (particlesHost && !reducedMotion()) {
        cleanups.push(mountParticles(particlesHost, {
            quantity: 160,
            color: '#8a8a8a',
            vy: -0.18,
            staticity: 50,
            ease: 50,
        }));
    }

    if (stage && !reducedMotion()) {
        cleanups.push(mountPointerTour(stage));
    }

    ctl = {
        destroy() {
            cleanups.forEach((fn) => fn());
        },
    };
}

export function destroyCtaBand() {
    ctl?.destroy();
    ctl = null;
}

/* ── Highlighter (mouse spotlight on the card shell) ─────────────── */

function mountHighlighter(group, item) {
    let boxW = 0;
    let boxH = 0;
    let raf = 0;
    let pending = null;

    const measure = () => {
        boxW = group.offsetWidth;
        boxH = group.offsetHeight;
    };

    const apply = (clientX, clientY) => {
        const rect = group.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        if (x < 0 || y < 0 || x > boxW || y > boxH) return;

        const itemRect = item.getBoundingClientRect();
        const localX = -(itemRect.left - rect.left) + x;
        const localY = -(itemRect.top - rect.top) + y;
        item.style.setProperty('--mouse-x', `${localX}px`);
        item.style.setProperty('--mouse-y', `${localY}px`);
    };

    const onMove = (e) => {
        pending = e;
        if (raf) return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            if (pending) apply(pending.clientX, pending.clientY);
            pending = null;
        });
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
        window.removeEventListener('resize', measure);
        window.removeEventListener('pointermove', onMove);
        if (raf) cancelAnimationFrame(raf);
        item.style.removeProperty('--mouse-x');
        item.style.removeProperty('--mouse-y');
    };
}

/* ── Particles ───────────────────────────────────────────────────── */

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mountParticles(host, opts) {
    const {
        quantity = 100,
        staticity = 50,
        ease = 50,
        color = '#ffffff',
        vx = 0,
        vy = 0,
    } = opts;

    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => canvas.remove();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rgb = hexToRgb(color);
    const circles = [];
    const mouse = { x: 0, y: 0 };
    let size = { w: 0, h: 0 };
    let raf = 0;
    let running = true;

    const circleParams = () => ({
        x: Math.floor(Math.random() * size.w),
        y: Math.floor(Math.random() * size.h),
        translateX: 0,
        translateY: 0,
        size: Math.floor(Math.random() * 2) + 1,
        alpha: 0,
        targetAlpha: Number((Math.random() * 0.3 + 0.1).toFixed(1)),
        dx: (Math.random() - 0.5) * 0.2,
        dy: (Math.random() - 0.5) * 0.2,
        magnetism: 0.1 + Math.random() * 4,
    });

    const drawCircle = (circle, update = false) => {
        ctx.translate(circle.translateX, circle.translateY);
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${circle.alpha})`;
        ctx.fill();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (!update) circles.push(circle);
    };

    const clear = () => ctx.clearRect(0, 0, size.w, size.h);

    const resize = () => {
        circles.length = 0;
        size.w = host.offsetWidth;
        size.h = host.offsetHeight;
        canvas.width = size.w * dpr;
        canvas.height = size.h * dpr;
        canvas.style.width = `${size.w}px`;
        canvas.style.height = `${size.h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        for (let i = 0; i < quantity; i += 1) drawCircle(circleParams());
    };

    const remap = (value, start1, end1, start2, end2) => {
        const remapped = ((value - start1) * (end2 - start2)) / (end1 - start1) + start2;
        return remapped > 0 ? remapped : 0;
    };

    const onMove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - size.w / 2;
        const y = e.clientY - rect.top - size.h / 2;
        if (x < size.w / 2 && x > -size.w / 2 && y < size.h / 2 && y > -size.h / 2) {
            mouse.x = x;
            mouse.y = y;
        }
    };

    const animate = () => {
        if (!running) return;
        clear();
        for (let i = circles.length - 1; i >= 0; i -= 1) {
            const circle = circles[i];
            const edge = [
                circle.x + circle.translateX - circle.size,
                size.w - circle.x - circle.translateX - circle.size,
                circle.y + circle.translateY - circle.size,
                size.h - circle.y - circle.translateY - circle.size,
            ];
            const closest = Math.min(...edge);
            const fade = Number(remap(closest, 0, 20, 0, 1).toFixed(2));
            if (fade > 1) {
                circle.alpha = Math.min(circle.alpha + 0.02, circle.targetAlpha);
            } else {
                circle.alpha = circle.targetAlpha * fade;
            }

            circle.x += circle.dx + vx;
            circle.y += circle.dy + vy;
            circle.translateX +=
                (mouse.x / (staticity / circle.magnetism) - circle.translateX) / ease;
            circle.translateY +=
                (mouse.y / (staticity / circle.magnetism) - circle.translateY) / ease;

            const out =
                circle.x < -circle.size ||
                circle.x > size.w + circle.size ||
                circle.y < -circle.size ||
                circle.y > size.h + circle.size;

            if (out) {
                circles.splice(i, 1);
                drawCircle(circleParams());
            } else {
                drawCircle(circle, true);
            }
        }
        raf = requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
        running = false;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onMove);
        canvas.remove();
    };
}

/* ── Pointer tour across feature chips ───────────────────────────── */

function mountPointerTour(stage) {
    const pointer = stage.querySelector('[data-cta-pointer]');
    const chips = [...stage.querySelectorAll('[data-cta-chip]')];
    if (!pointer || chips.length < 2) return () => {};

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    const centerOf = (el) => {
        const sr = stage.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return {
            left: r.left - sr.left + r.width * 0.55,
            top: r.top - sr.top + r.height * 0.35,
        };
    };

    const setActive = (index) => {
        chips.forEach((chip, i) => {
            chip.classList.toggle('is-active', i === index);
        });
    };

    gsap.set(pointer, {
        left: () => centerOf(chips[0]).left,
        top: () => centerOf(chips[0]).top,
    });
    setActive(0);

    const tl = gsap.timeline({ repeat: -1, defaults: { ease: 'power1.inOut' } });

    chips.forEach((_, i) => {
        const nextIndex = (i + 1) % chips.length;
        const next = chips[nextIndex];
        const at = i === 0 ? 0.55 : '+=0.55';

        tl.to(
            pointer,
            {
                duration: 0.55,
                left: () => centerOf(next).left,
                top: () => centerOf(next).top,
            },
            at,
        );
        tl.add(() => setActive(nextIndex), '<0.2');
    });

    const onResize = () => {
        const active = chips.findIndex((c) => c.classList.contains('is-active'));
        const idx = active >= 0 ? active : 0;
        const pos = centerOf(chips[idx]);
        gsap.set(pointer, { left: pos.left, top: pos.top });
    };

    window.addEventListener('resize', onResize);

    const onReduce = () => {
        if (reduce.matches) tl.pause(0);
        else tl.play();
    };
    reduce.addEventListener?.('change', onReduce);

    return () => {
        tl.kill();
        window.removeEventListener('resize', onResize);
        reduce.removeEventListener?.('change', onReduce);
        chips.forEach((chip) => chip.classList.remove('is-active'));
        gsap.set(pointer, { clearProps: 'left,top' });
    };
}
