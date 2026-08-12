import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { destroyVortex, mountVortex } from './vortex.js';
import { destroyFeatureCarousel, mountFeatureCarousel } from './featureCarousel.js';
import { destroyCtaBand, mountCtaBand } from './ctaBand.js';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Listeners are bound once (the markup never rebuilds), but GSAP state and the
// vortex are created on every visit and torn down on every leave.
let bound = false;
let motionCtx = null;
let quotesTimer = 0;
let orbitCtl = null;

export function initStartSite(pageStart) {
    if (!pageStart) return;

    bindOnce(pageStart);
    pageStart.querySelector('.start-nav')?.classList.remove('is-visible');
    pageStart.querySelector('.start-nav')?.setAttribute('aria-hidden', 'true');
    mountVortex(pageStart.querySelector('#startHeroVortex'));
    mountFeatureCarousel(pageStart.querySelector('[data-feature-carousel]'));
    mountCtaBand(pageStart.querySelector('[data-cta-band]'));
    startOrbit(pageStart);
    startMotion(pageStart);
    startQuotesRotation(pageStart);
}

export function teardownStartSite() {
    motionCtx?.revert();
    motionCtx = null;
    stopQuotesRotation();
    stopOrbit();
    destroyFeatureCarousel();
    destroyCtaBand();
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
    bindFooterMagnetic(pageStart);
    bindOrbit(pageStart);
}

function bindNav(pageStart) {
    const toggle = pageStart.querySelector('#startNavToggle');
    const menu = pageStart.querySelector('#startNavMenu');
    const header = pageStart.querySelector('.start-nav');
    const wordmark = pageStart.querySelector('.start-hero__wordmark');

    if (!header) return;

    let menuCloseTimer = 0;
    const MENU_CLOSE_MS = 520;

    const openMenu = () => {
        if (!toggle || !menu) return;
        clearTimeout(menuCloseTimer);
        menu.hidden = false;
        // Allow the browser to apply the open grid before transitioning.
        void menu.offsetHeight;
        header.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        toggle.setAttribute('aria-label', 'Close menu');
        menu.setAttribute('aria-hidden', 'false');
    };

    const closeMenu = () => {
        if (!toggle || !menu) return;
        if (!header.classList.contains('is-open') && menu.hidden) return;

        header.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open menu');
        menu.setAttribute('aria-hidden', 'true');

        clearTimeout(menuCloseTimer);
        menuCloseTimer = window.setTimeout(() => {
            menu.hidden = true;
        }, MENU_CLOSE_MS);
    };

    if (toggle && menu) {
        toggle.addEventListener('click', () => {
            if (header.classList.contains('is-open')) closeMenu();
            else openMenu();
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

/* ============================================================ security orbit */

/**
 * Vanilla port of RadialOrbitalTimeline.
 * Nodes sit on a circle, auto-rotate every 50ms by 0.3°, and CSS
 * `transition: transform/opacity 700ms` eases both the idle spin and the
 * snap-to-active re-centre so they feel like the React original.
 */
function bindOrbit(pageStart) {
    const stage = pageStart.querySelector('[data-orbit]');
    if (!stage || stage.dataset.orbitBound === 'true') return;
    stage.dataset.orbitBound = 'true';

    const nodes = [...stage.querySelectorAll('.start-orbit__node')];

    const applyState = (activeId) => {
        nodes.forEach((node) => {
            const open = activeId !== null && node.dataset.orbitId === String(activeId);
            node.classList.toggle('is-expanded', open);
            node.classList.remove('is-related', 'is-pulsing');
            node.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    };

    const centerOnNode = (id) => {
        if (!orbitCtl) return;
        const index = nodes.findIndex((n) => n.dataset.orbitId === String(id));
        if (index < 0) return;
        // Same formula as the React demo: park the node at 270° (top), so the
        // card opens downward into the stage instead of off-screen.
        const targetAngle = (index / nodes.length) * 360;
        orbitCtl.angle = 270 - targetAngle;
        paintOrbit({ animate: true });
    };

    const toggleItem = (id) => {
        if (!orbitCtl) return;

        const alreadyOpen = String(orbitCtl.activeId) === String(id);

        if (alreadyOpen) {
            orbitCtl.activeId = null;
            orbitCtl.autoRotate = !reducedMotion();
            applyState(null);
            syncOrbitTimer();
            return;
        }

        orbitCtl.activeId = String(id);
        orbitCtl.autoRotate = false;
        applyState(id);
        centerOnNode(id);
        syncOrbitTimer();
    };

    stage.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-orbit-goto]');
        if (chip) {
            e.preventDefault();
            e.stopPropagation();
            toggleItem(chip.dataset.orbitGoto);
            return;
        }

        const node = e.target.closest('.start-orbit__node');
        if (node) {
            e.stopPropagation();
            toggleItem(node.dataset.orbitId);
            return;
        }

        // Empty stage / ring / glow click — collapse like handleContainerClick.
        if (orbitCtl?.activeId != null) {
            orbitCtl.activeId = null;
            orbitCtl.autoRotate = !reducedMotion();
            applyState(null);
            syncOrbitTimer();
        }
    });

    stage.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const node = e.target.closest('.start-orbit__node');
        if (!node || e.target.closest('[data-orbit-goto]')) return;
        e.preventDefault();
        toggleItem(node.dataset.orbitId);
    });

    window.addEventListener('resize', () => {
        if (orbitCtl?.stage === stage) paintOrbit();
    });
}

function paintOrbit({ animate = false } = {}) {
    if (!orbitCtl) return;
    const { stage, nodes, angle } = orbitCtl;
    const total = nodes.length;
    if (!total) return;

    const radius = parseFloat(getComputedStyle(stage).getPropertyValue('--orbit-r')) || 200;

    nodes.forEach((node, index) => {
        const a = ((index / total) * 360 + angle) % 360;
        const rad = (a * Math.PI) / 180;
        const x = radius * Math.cos(rad);
        const y = radius * Math.sin(rad);
        const depth = Math.round(100 + 50 * Math.cos(rad));
        const open = node.classList.contains('is-expanded');
        // Exact opacity curve from the React calculateNodePosition().
        const opacity = open
            ? 1
            : Math.max(0.4, Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(rad)) / 2)));

        // Centre the tile on the orbit point (not its top-left), otherwise
        // nodes drift inside/outside the ring depending on angle.
        node.style.transition = animate
            ? 'transform 0.7s ease, opacity 0.7s ease'
            : 'opacity 0.35s ease';
        node.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        node.style.zIndex = String(open ? 200 : depth);
        node.style.opacity = String(opacity);
    });
}

function syncOrbitTimer() {
    if (!orbitCtl) return;

    if (orbitCtl.timer) {
        clearInterval(orbitCtl.timer);
        orbitCtl.timer = 0;
    }

    if (!orbitCtl.autoRotate || reducedMotion()) return;

    orbitCtl.timer = window.setInterval(() => {
        if (!orbitCtl?.autoRotate) return;
        orbitCtl.angle = Number(((orbitCtl.angle + 0.3) % 360).toFixed(3));
        paintOrbit();
    }, 50);
}

function startOrbit(pageStart) {
    stopOrbit();

    const stage = pageStart.querySelector('[data-orbit]');
    if (!stage) return;

    const nodes = [...stage.querySelectorAll('.start-orbit__node')];
    orbitCtl = {
        stage,
        nodes,
        angle: 0,
        autoRotate: !reducedMotion(),
        activeId: null,
        timer: 0,
    };

    paintOrbit();
    syncOrbitTimer();
}

function stopOrbit() {
    if (orbitCtl?.timer) clearInterval(orbitCtl.timer);
    if (orbitCtl?.nodes) {
        orbitCtl.nodes.forEach((node) => {
            node.classList.remove('is-expanded', 'is-related', 'is-pulsing');
            node.setAttribute('aria-expanded', 'false');
            node.style.transform = '';
            node.style.transition = '';
            node.style.zIndex = '';
            node.style.opacity = '';
        });
    }
    orbitCtl = null;
}

/* ============================================================ hero intro */

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

// Headings are revealed word by word behind a mask; everything else drifts up
// out of a soft blur. Keeping the vocabulary this small is what makes the whole
// page feel like one piece rather than a pile of effects.
const HEADING_SEL = '.start-h2, .start-h3, .start-cta-band__title';
const TEXT_GROUP_SEL = '.start-head, .start-split__copy, .start-cta-band';
const PART_SEL = [
    '.start-eyebrow',
    '.start-h2',
    '.start-h3',
    '.start-lead',
    '.start-checks li',
    '.start-btn',
    '.start-cta-band__title',
    '.start-cta-band__text',
    '.start-cta-band__eyebrow',
    '.start-cta-band__actions',
].join(', ');

/** Wrap each word in a clipping box so it can slide up from behind its own
 *  line. Inline markup (<br>, the dimmed span) is preserved. */
function splitWords(el) {
    if (el.dataset.words === 'true') {
        return [...el.querySelectorAll('.start-word__i')];
    }

    const wrap = (node) => {
        [...node.childNodes].forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
                const frag = document.createDocumentFragment();

                child.textContent.split(/(\s+)/).forEach((part) => {
                    if (!part) return;
                    if (/^\s+$/.test(part)) {
                        frag.appendChild(document.createTextNode(' '));
                        return;
                    }
                    const outer = document.createElement('span');
                    outer.className = 'start-word';
                    const inner = document.createElement('span');
                    inner.className = 'start-word__i';
                    inner.textContent = part;
                    outer.appendChild(inner);
                    frag.appendChild(outer);
                });

                child.replaceWith(frag);
            } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
                wrap(child);
            }
        });
    };

    wrap(el);
    el.dataset.words = 'true';
    return [...el.querySelectorAll('.start-word__i')];
}

function revealWords(tl, el, at) {
    tl.fromTo(splitWords(el),
        { yPercent: 118, opacity: 0 },
        {
            yPercent: 0,
            opacity: 1,
            duration: 1.05,
            ease: 'power4.out',
            stagger: 0.045,
        }, at);
}

function fadeUp(tl, targets, at, extra = {}) {
    tl.fromTo(targets,
        { opacity: 0, y: 22, filter: 'blur(6px)' },
        {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.9,
            ease: 'power3.out',
            ...extra,
        }, at);
}

/** A copy block: eyebrow, heading, lead, list, button — in reading order. */
function revealTextGroup(tl, el) {
    let at = 0;

    el.querySelectorAll(PART_SEL).forEach((part) => {
        if (part.matches(HEADING_SEL)) {
            revealWords(tl, part, at);
            at += 0.3;
        } else {
            fadeUp(tl, part, at);
            at += part.matches('.start-checks li') ? 0.08 : 0.12;
        }
    });
}

/** A visual block (card, frame, orbit): rises as one piece out of a blur. */
function revealBlock(tl, el) {
    const from = { opacity: 0, scale: 0.965, filter: 'blur(10px)' };
    const to = { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' };

    // The showcase frame already has a scrubbed parallax on `y`; a second tween
    // writing the same property would make the two fight each frame.
    if (!el.matches('.start-showcase__frame')) {
        from.y = 52;
        to.y = 0;
    }

    tl.fromTo(el, from, to, 0);
}

/** The strip under the hero: the line reads in, then the ticker slides open. */
function revealMarquee(pageStart, trigger) {
    const marquee = pageStart.querySelector('.start-marquee');
    if (!marquee) return;

    const viewport = marquee.querySelector('.start-marquee__viewport');
    const tl = gsap.timeline({ scrollTrigger: trigger(marquee, { start: 'top 92%' }) });

    if (viewport) {
        tl.fromTo(viewport,
            { opacity: 0, scaleX: 0.9 },
            { opacity: 1, scaleX: 1, duration: 1.2, ease: 'power3.out' }, 0);
    }
}

function revealFooter(pageStart) {
    const curtain = pageStart.querySelector('[data-footer-curtain]');
    const footer = pageStart.querySelector('.start-footer');
    if (!footer) return;

    const triggerEl = curtain || footer;
    const brand = footer.querySelector('.start-footer__brand');
    const cols = footer.querySelector('.start-footer__cols');
    const wordmark = footer.querySelector('.start-footer__wordmark');
    const bottom = footer.querySelector('.start-footer__bottom');
    const aurora = curtain?.querySelector('.start-footer-curtain__aurora');

    // Giant wordmark parallax — scrubbed like the cinematic footer.
    if (wordmark) {
        gsap.fromTo(
            wordmark,
            { y: '8vh', scale: 0.84, opacity: 0 },
            {
                y: '0vh',
                scale: 1,
                opacity: 1,
                ease: 'power1.out',
                scrollTrigger: {
                    trigger: triggerEl,
                    scroller: pageStart,
                    start: 'top 80%',
                    end: 'bottom bottom',
                    scrub: 1,
                },
            },
        );
    }

    // Staggered content reveal, tied to scroll progress.
    const content = [brand, cols, bottom].filter(Boolean);
    if (content.length) {
        gsap.fromTo(
            content,
            { y: 50, opacity: 0 },
            {
                y: 0,
                opacity: 1,
                stagger: 0.15,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: triggerEl,
                    scroller: pageStart,
                    start: 'top 45%',
                    end: 'bottom bottom',
                    scrub: 1,
                },
            },
        );
    }

    if (aurora) {
        gsap.fromTo(
            aurora,
            { opacity: 0.2, scale: 0.9 },
            {
                opacity: 0.85,
                scale: 1,
                ease: 'none',
                scrollTrigger: {
                    trigger: triggerEl,
                    scroller: pageStart,
                    start: 'top 70%',
                    end: 'bottom bottom',
                    scrub: 1,
                },
            },
        );
    }
}

function bindFooterMagnetic(pageStart) {
    if (reducedMotion()) return;

    const links = [...pageStart.querySelectorAll('.start-footer__social a')];
    if (!links.length) return;

    links.forEach((el) => {
        if (el.dataset.magneticBound === 'true') return;
        el.dataset.magneticBound = 'true';

        const onMove = (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            gsap.to(el, {
                x: x * 0.35,
                y: y * 0.35,
                scale: 1.08,
                duration: 0.35,
                ease: 'power2.out',
                overwrite: 'auto',
            });
        };

        const onLeave = () => {
            gsap.to(el, {
                x: 0,
                y: 0,
                scale: 1,
                duration: 1.1,
                ease: 'elastic.out(1, 0.35)',
                overwrite: 'auto',
            });
        };

        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
    });
}

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
            const tl = gsap.timeline({ scrollTrigger: trigger(el, { start: 'top 88%' }) });
            if (el.matches(TEXT_GROUP_SEL)) {
                revealTextGroup(tl, el);
            } else {
                revealBlock(tl, el);
            }
        });

        pageStart.querySelectorAll('[data-reveal-stagger]').forEach((group) => {
            gsap.fromTo(group.children,
                { opacity: 0, y: 34, scale: 0.97, filter: 'blur(7px)' },
                {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    filter: 'blur(0px)',
                    duration: 1,
                    ease: 'power3.out',
                    stagger: 0.1,
                    scrollTrigger: trigger(group),
                });
        });

        revealMarquee(pageStart, trigger);
        revealFooter(pageStart);

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

        // Parallax lives on the inner card so it never fights the reveal tween
        // that owns the wrapper's transform.
        pageStart.querySelectorAll('.start-split__visual > .start-card').forEach((card) => {
            gsap.fromTo(card, { y: 34 }, {
                y: -34,
                ease: 'none',
                scrollTrigger: {
                    trigger: card,
                    scroller: pageStart,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: 0.8,
                },
            });
        });
    }, pageStart);

    // Measure after the page is visible and laid out.
    requestAnimationFrame(() => ScrollTrigger.refresh());
}
