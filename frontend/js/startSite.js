import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { destroyVortex, mountVortex } from './vortex.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Listeners are bound once (the markup never rebuilds), but GSAP state and the
// vortex are created on every visit and torn down on every leave.
let bound = false;
let motionCtx = null;
let quotesTimer = 0;

export function initStartSite(pageStart) {
    if (!pageStart) return;

    bindOnce(pageStart);
    mountVortex(pageStart.querySelector('#startHeroVortex'));
    startMotion(pageStart);
    startQuotesRotation(pageStart);
}

export function teardownStartSite() {
    motionCtx?.revert();
    motionCtx = null;
    stopQuotesRotation();
    destroyVortex();
}

/* ============================================================ bindings */

function bindOnce(pageStart) {
    if (bound) return;
    bound = true;

    bindNav(pageStart);
    bindShowcaseTabs(pageStart);
    bindFaq(pageStart);
    bindQuotes(pageStart);
    bindCardSpotlight(pageStart);
}

function bindNav(pageStart) {
    const toggle = pageStart.querySelector('#startNavToggle');
    const menu = pageStart.querySelector('#startNavMenu');
    const header = pageStart.querySelector('.start-nav');

    if (!toggle || !menu || !header) return;

    const closeMenu = () => {
        header.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        menu.hidden = true;
    };

    toggle.addEventListener('click', () => {
        const open = header.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        menu.hidden = !open;
    });

    // Tapping an anchor in the mobile menu should close it before scrolling.
    menu.addEventListener('click', (e) => {
        if (e.target.closest('a')) closeMenu();
    });

    // The page itself is the scroll container, not the window.
    pageStart.addEventListener('scroll', () => {
        header.classList.toggle('is-scrolled', pageStart.scrollTop > 32);
    }, { passive: true });
}

function bindShowcaseTabs(pageStart) {
    const tabs = [...pageStart.querySelectorAll('[data-showcase-tab]')];
    const panels = [...pageStart.querySelectorAll('[data-showcase-panel]')];
    if (!tabs.length) return;

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const id = tab.dataset.showcaseTab;
            tabs.forEach((t) => {
                const on = t === tab;
                t.classList.toggle('is-active', on);
                t.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            panels.forEach((p) => {
                p.classList.toggle('is-active', p.dataset.showcasePanel === id);
            });
        });
    });
}

function bindFaq(pageStart) {
    const list = pageStart.querySelector('.start-faq__list');
    if (!list) return;

    list.addEventListener('click', (e) => {
        const q = e.target.closest('.start-faq__q');
        if (!q) return;
        const item = q.closest('.start-faq__item');
        const wasOpen = item.classList.contains('is-open');

        // One answer open at a time, accordion-style.
        list.querySelectorAll('.start-faq__item.is-open').forEach((open) => {
            open.classList.remove('is-open');
            open.querySelector('.start-faq__q')?.setAttribute('aria-expanded', 'false');
        });

        if (!wasOpen) {
            item.classList.add('is-open');
            q.setAttribute('aria-expanded', 'true');
        }
    });
}

/* ---------------------------------------- testimonials */

function setQuote(pageStart, index) {
    const quotes = [...pageStart.querySelectorAll('[data-quote]')];
    const dots = [...pageStart.querySelectorAll('[data-quote-dot]')];
    quotes.forEach((q, i) => q.classList.toggle('is-active', i === index));
    dots.forEach((d, i) => d.classList.toggle('is-active', i === index));
}

function bindQuotes(pageStart) {
    const dots = [...pageStart.querySelectorAll('[data-quote-dot]')];
    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => {
            setQuote(pageStart, i);
            startQuotesRotation(pageStart); // reset the autoplay clock
        });
    });
}

function startQuotesRotation(pageStart) {
    stopQuotesRotation();
    if (reducedMotion()) return;

    const quotes = [...pageStart.querySelectorAll('[data-quote]')];
    if (quotes.length < 2) return;

    quotesTimer = setInterval(() => {
        const current = quotes.findIndex((q) => q.classList.contains('is-active'));
        setQuote(pageStart, (current + 1) % quotes.length);
    }, 6000);
}

function stopQuotesRotation() {
    if (quotesTimer) {
        clearInterval(quotesTimer);
        quotesTimer = 0;
    }
}

/* ---------------------------------------- pointer spotlight on cards */

function bindCardSpotlight(pageStart) {
    pageStart.addEventListener('pointermove', (e) => {
        const card = e.target.closest('.start-card');
        if (!card) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    }, { passive: true });
}

/* ============================================================ scroll motion */

function startMotion(pageStart) {
    motionCtx?.revert();
    motionCtx = null;
    if (reducedMotion()) return;

    motionCtx = gsap.context(() => {
        const trigger = (el, extra = {}) => ({
            trigger: el,
            scroller: pageStart,
            start: 'top 86%',
            once: true,
            ...extra,
        });

        pageStart.querySelectorAll('[data-reveal]').forEach((el) => {
            gsap.from(el, {
                opacity: 0,
                y: 36,
                duration: 1,
                ease: 'power3.out',
                scrollTrigger: trigger(el),
            });
        });

        pageStart.querySelectorAll('[data-reveal-stagger]').forEach((group) => {
            gsap.from(group.children, {
                opacity: 0,
                y: 28,
                duration: 0.9,
                ease: 'power3.out',
                stagger: 0.12,
                scrollTrigger: trigger(group),
            });
        });

        pageStart.querySelectorAll('[data-count]').forEach((el) => {
            const target = parseFloat(el.dataset.count);
            const decimals = parseInt(el.dataset.countDecimals || '0', 10);
            const state = { v: 0 };
            gsap.to(state, {
                v: target,
                duration: 1.8,
                ease: 'power2.out',
                scrollTrigger: trigger(el, { start: 'top 90%' }),
                onUpdate: () => {
                    el.textContent = state.v.toFixed(decimals);
                },
            });
        });

        // The showcase frame drifts slightly against the scroll for depth.
        const frame = pageStart.querySelector('.start-showcase__frame');
        if (frame) {
            gsap.fromTo(frame, { y: 56 }, {
                y: -28,
                ease: 'none',
                scrollTrigger: {
                    trigger: frame,
                    scroller: pageStart,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: 0.6,
                },
            });
        }
    }, pageStart);

    // Measure after the page is visible and laid out.
    requestAnimationFrame(() => ScrollTrigger.refresh());
}
