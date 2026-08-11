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
    pageStart.querySelector('.start-nav')?.classList.remove('is-visible');
    pageStart.querySelector('.start-nav')?.setAttribute('aria-hidden', 'true');
    mountVortex(pageStart.querySelector('#startHeroVortex'));
    startMotion(pageStart);
    startQuotesRotation(pageStart);
}

export function teardownStartSite() {
    motionCtx?.revert();
    motionCtx = null;
    stopQuotesRotation();
    destroyVortex();
    // Re-arm the intro so the next visit plays it from the top.
    document.querySelector('.start-hero')?.classList.remove('is-ready');
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
    const wordmark = pageStart.querySelector('.start-hero__wordmark');

    if (!header) return;

    const closeMenu = () => {
        if (!toggle || !menu) return;
        header.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        menu.hidden = true;
    };

    if (toggle && menu) {
        toggle.addEventListener('click', () => {
            const open = header.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            menu.hidden = !open;
        });

        // Tapping an anchor in the mobile menu should close it before scrolling.
        menu.addEventListener('click', (e) => {
            if (e.target.closest('a')) closeMenu();
        });
    }

    // Hidden on load. Appears only after NEXA leaves the viewport while
    // scrolling down; scrolling up tucks it back under the top edge.
    let lastScroll = pageStart.scrollTop;
    let ticking = false;

    const syncNav = () => {
        ticking = false;
        const scrollTop = pageStart.scrollTop;
        const goingDown = scrollTop > lastScroll + 2;
        const goingUp = scrollTop < lastScroll - 2;
        lastScroll = scrollTop;

        const wordmarkGone = wordmark
            ? wordmark.getBoundingClientRect().bottom < 140
            : scrollTop > window.innerHeight * 0.4;

        if (goingDown && wordmarkGone) {
            header.classList.add('is-visible');
            header.setAttribute('aria-hidden', 'false');
        } else if (goingUp || !wordmarkGone) {
            header.classList.remove('is-visible');
            header.setAttribute('aria-hidden', 'true');
            closeMenu();
        }
    };

    header.setAttribute('aria-hidden', 'true');

    pageStart.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(syncNav);
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

/* ============================================================ hero intro */

/** Wrap every character in its own inline-block so the tagline can be
 *  animated letter by letter. Runs once — the spans are reused on revisits. */
function splitLetters(el) {
    if (el.dataset.split === 'true') {
        return [...el.querySelectorAll('.start-char')];
    }

    const chars = [];
    const frag = document.createDocumentFragment();

    for (const ch of el.textContent) {
        const span = document.createElement('span');
        span.className = 'start-char';
        if (ch === ' ') {
            span.innerHTML = '&nbsp;';
        } else {
            span.textContent = ch;
        }
        frag.appendChild(span);
        chars.push(span);
    }

    el.textContent = '';
    el.appendChild(frag);
    el.dataset.split = 'true';
    return chars;
}

/**
 * The load sequence. The wordmark arrives blurred and slightly overlapping the
 * centre, then the two halves part around the vortex axis — the line appears to
 * push them open. Everything else follows outwards from there.
 */
function playHeroIntro(pageStart) {
    const hero = pageStart.querySelector('.start-hero');
    if (!hero) return;

    // Until this class lands, CSS keeps the hero pieces at opacity 0 so nothing
    // flashes before the timeline takes over.
    hero.classList.add('is-ready');

    const glow = hero.querySelector('.start-hero__glow');
    const wordmark = hero.querySelector('.start-hero__wordmark');
    const halfNe = hero.querySelector('.start-hero__wordmark-half--ne');
    const halfXa = hero.querySelector('.start-hero__wordmark-half--xa');
    const tagline = hero.querySelector('.start-hero__tagline');
    const features = [...hero.querySelectorAll('.start-hero__feature')];
    const icons = [...hero.querySelectorAll('.start-hero__feature-icon')];
    const ctaItems = [...hero.querySelectorAll('.start-hero__cta > *')];
    const btnCircle = hero.querySelector('.start-motion-btn__circle');
    const btnLabel = hero.querySelector('.start-motion-btn__label');
    const btnIcon = hero.querySelector('.start-motion-btn__icon');

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    if (glow) {
        tl.from(glow, { opacity: 0, duration: 1.8, ease: 'power2.out' }, 0);
    }

    if (wordmark) {
        tl.fromTo(wordmark, {
            opacity: 0,
            scale: 1.07,
            filter: 'blur(14px)',
        }, {
            opacity: 1,
            scale: 1,
            filter: 'blur(0px)',
            duration: 1.5,
        }, 0.1);
    }

    if (halfNe && halfXa) {
        tl.from(halfNe, { x: 54, duration: 1.6, ease: 'expo.out' }, 0.1)
          .from(halfXa, { x: -54, duration: 1.6, ease: 'expo.out' }, 0.1);
    }

    if (tagline) {
        tl.fromTo(splitLetters(tagline), {
            opacity: 0,
            y: 18,
            filter: 'blur(6px)',
        }, {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.9,
            stagger: 0.028,
        }, 0.7);
    }

    if (features.length) {
        tl.fromTo(features, {
            opacity: 0,
            x: -26,
            filter: 'blur(5px)',
        }, {
            opacity: 1,
            x: 0,
            filter: 'blur(0px)',
            duration: 0.9,
            stagger: 0.13,
        }, 0.85);

        tl.from(icons, {
            scale: 0.5,
            duration: 0.7,
            ease: 'back.out(2.2)',
            stagger: 0.13,
        }, 0.9);
    }

    if (ctaItems.length) {
        tl.from(ctaItems, {
            opacity: 0,
            y: 22,
            duration: 0.9,
            stagger: 0.12,
        }, 1);
    }

    // The button assembles itself: pill first, then its contents.
    if (btnCircle) {
        tl.from(btnCircle, { scale: 0.4, duration: 0.7, ease: 'back.out(2.4)' }, 1.12);
    }
    if (btnIcon && btnLabel) {
        tl.from([btnIcon, btnLabel], { opacity: 0, duration: 0.5 }, 1.32);
    }

    // Hold the sequence until the wordmark art is decoded, otherwise the first
    // beat plays against an empty box. Capped so a stalled request can't block.
    const logos = [...hero.querySelectorAll('.start-hero__wordmark-half img')];
    const pending = logos.filter((img) => !img.complete);

    if (pending.length) {
        tl.pause();
        const start = () => tl.play();
        pending.forEach((img) => {
            img.addEventListener('load', () => {
                if (logos.every((i) => i.complete)) start();
            }, { once: true });
            img.addEventListener('error', start, { once: true });
        });
        gsap.delayedCall(0.8, start);
    }

    return tl;
}

/* ============================================================ scroll motion */

function startMotion(pageStart) {
    motionCtx?.revert();
    motionCtx = null;

    if (reducedMotion()) {
        // No animation, but the hero must still be visible.
        pageStart.querySelector('.start-hero')?.classList.add('is-ready');
        return;
    }

    motionCtx = gsap.context(() => {
        playHeroIntro(pageStart);

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
