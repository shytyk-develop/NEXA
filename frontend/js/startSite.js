import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Listeners are bound once (the markup never rebuilds), but GSAP state and the
// vortex are created on every visit and torn down on every leave.
let bound = false;
let motionCtx = null;
let quotesTimer = 0;
let armProductAutoplay = null;
let clearProductProgress = null;
let orbitCtl = null;
let startGen = 0;
let destroyVortexFn = () => {};
let destroyFeatureCarouselFn = () => {};
let destroyCtaBandFn = () => {};
/** @type {IntersectionObserver[]} */
let lazyObservers = [];

function afterPaint(fn) {
    requestAnimationFrame(() => requestAnimationFrame(fn));
}

function whenVisible(el, fn, { root = null, rootMargin = '240px 0px' } = {}) {
    if (!el) return;
    if (typeof IntersectionObserver !== 'function') {
        fn();
        return;
    }
    const io = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        lazyObservers = lazyObservers.filter((o) => o !== io);
        fn();
    }, { root, rootMargin });
    lazyObservers.push(io);
    io.observe(el);
}

export function initStartSite(pageStart) {
    if (!pageStart) return;

    const gen = ++startGen;
    bindOnce(pageStart);
    pageStart.querySelector('.start-nav')?.classList.remove('is-visible');
    pageStart.querySelector('.start-nav')?.setAttribute('aria-hidden', 'true');
    startOrbit(pageStart);
    startMotion(pageStart);
    startQuotesRotation(pageStart);
    armProductAutoplay?.();

    // THREE vortex is the heaviest hero cost — wait for first paint, then load.
    afterPaint(() => {
        if (gen !== startGen) return;
        import('./vortex.js').then((mod) => {
            if (gen !== startGen) return;
            destroyVortexFn = mod.destroyVortex;
            mod.mountVortex(pageStart.querySelector('#startHeroVortex'));
        }).catch(() => {});
    });

    // Below-the-fold widgets: fetch only when they approach the viewport.
    whenVisible(pageStart.querySelector('[data-feature-carousel]'), () => {
        if (gen !== startGen) return;
        import('./featureCarousel.js').then((mod) => {
            if (gen !== startGen) return;
            destroyFeatureCarouselFn = mod.destroyFeatureCarousel;
            mod.mountFeatureCarousel(pageStart.querySelector('[data-feature-carousel]'));
        }).catch(() => {});
    }, { root: pageStart, rootMargin: '280px 0px' });

    whenVisible(pageStart.querySelector('[data-cta-band]'), () => {
        if (gen !== startGen) return;
        import('./ctaBand.js').then((mod) => {
            if (gen !== startGen) return;
            destroyCtaBandFn = mod.destroyCtaBand;
            mod.mountCtaBand(pageStart.querySelector('[data-cta-band]'));
        }).catch(() => {});
    }, { root: pageStart, rootMargin: '320px 0px' });
}

export function teardownStartSite() {
    startGen += 1;
    lazyObservers.forEach((o) => o.disconnect());
    lazyObservers = [];
    motionCtx?.revert();
    motionCtx = null;
    stopQuotesRotation();
    stopProductAutoplay();
    stopOrbit();
    destroyFeatureCarouselFn();
    destroyCtaBandFn();
    destroyVortexFn();
    destroyFeatureCarouselFn = () => {};
    destroyCtaBandFn = () => {};
    destroyVortexFn = () => {};
    // Re-arm the intro so the next visit plays it from the top.
    document.querySelector('.start-hero')?.classList.remove('is-ready');
}

/* ============================================================ bindings */

function bindOnce(pageStart) {
    if (bound) return;
    bound = true;

    bindNav(pageStart);
    bindProductShowcase(pageStart);
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
    const MENU_CLOSE_MS = 580;

    const openMenu = () => {
        if (!toggle || !menu) return;
        clearTimeout(menuCloseTimer);
        menu.hidden = false;
        // Two frames so the 0fr → 1fr grid transition always runs.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                header.classList.add('is-open');
                toggle.setAttribute('aria-expanded', 'true');
                toggle.setAttribute('aria-label', 'Close menu');
                menu.setAttribute('aria-hidden', 'false');
            });
        });
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

function ensureIselectLightbox(pageStart) {
    let lightbox = pageStart.querySelector('[data-iselect-lightbox]');
    if (lightbox) return lightbox;

    lightbox = document.createElement('div');
    lightbox.className = 'start-iselect-lightbox';
    lightbox.dataset.iselectLightbox = '';
    lightbox.hidden = true;
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Screenshot preview');
    lightbox.innerHTML = `
        <button type="button" class="start-iselect-lightbox__backdrop" data-iselect-lightbox-close aria-label="Close preview"></button>
        <div class="start-iselect-lightbox__panel">
            <button type="button" class="start-iselect-lightbox__close" data-iselect-lightbox-close aria-label="Close">
                <svg class="ui-icon" aria-hidden="true"><use href="#icon-x"></use></svg>
            </button>
            <img class="start-iselect-lightbox__img" alt="" width="1024" height="629" decoding="async">
            <p class="start-iselect-lightbox__cap">
                <span class="start-iselect-lightbox__title"></span>
                <span class="start-iselect-lightbox__desc"></span>
            </p>
        </div>
    `;
    pageStart.appendChild(lightbox);
    return lightbox;
}

function stopProductAutoplay() {
    clearProductProgress?.();
}

function bindProductShowcase(pageStart) {
    const root = pageStart.querySelector('[data-product-showcase]');
    if (!root) return;

    const dots = [...root.querySelectorAll('.start-product__dot')];
    if (!dots.length) return;

    const shot = root.querySelector('[data-product-shot]');
    const titleEl = root.querySelector('[data-product-title]');
    const descEl = root.querySelector('[data-product-desc]');
    const frame = root.querySelector('[data-product-frame]');
    const explore = pageStart.querySelector('[data-product-explore]');
    const pills = pageStart.querySelector('.start-product__pills');
    const lightbox = pageStart.querySelector('[data-iselect-lightbox]') || ensureIselectLightbox(pageStart);
    const lightboxImg = lightbox?.querySelector('.start-iselect-lightbox__img');
    const lightboxTitle = lightbox?.querySelector('.start-iselect-lightbox__title');
    const lightboxDesc = lightbox?.querySelector('.start-iselect-lightbox__desc');

    let switchTimer = 0;
    let resumeTimer = 0;
    let lightboxOpen = false;
    let inView = false;
    let pausedByUser = false;
    let hovering = false;
    let activeIndex = dots.findIndex((d) => d.classList.contains('is-active'));
    if (activeIndex < 0) activeIndex = 0;

    const AUTOPLAY_MS = 2800;
    const RESUME_MS = 800;
    const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    root.style.setProperty('--product-autoplay-ms', `${AUTOPLAY_MS}ms`);

    const slideOf = (dot) => ({
        src: dot?.dataset.src || '',
        title: dot?.dataset.title || '',
        desc: dot?.dataset.desc || '',
        alt: dot?.dataset.alt || dot?.dataset.title || '',
    });

    dots.forEach((dot) => {
        const src = dot.dataset.src;
        if (!src) return;
        const warm = new Image();
        warm.src = src;
    });

    const applySlide = (dot) => {
        const slide = slideOf(dot);
        if (!shot || !slide.src) return;

        if (shot.getAttribute('src') !== slide.src) {
            shot.src = slide.src;
        }
        shot.alt = slide.alt;
        if (titleEl) titleEl.textContent = slide.title;
        if (descEl) descEl.textContent = slide.desc;
    };

    const syncSlide = (dot, { animate = true } = {}) => {
        window.clearTimeout(switchTimer);

        if (!animate || prefersReduced()) {
            root.classList.remove('is-switching', 'is-settling');
            applySlide(dot);
            return;
        }

        root.classList.remove('is-settling');
        root.classList.add('is-switching');
        void root.offsetWidth;

        switchTimer = window.setTimeout(() => {
            applySlide(dot);
            requestAnimationFrame(() => {
                root.classList.remove('is-switching');
                root.classList.add('is-settling');
                switchTimer = window.setTimeout(() => {
                    root.classList.remove('is-settling');
                }, 520);
            });
        }, 220);
    };

    const clearFill = () => {
        root.classList.remove('is-autoplay-paused');
        dots.forEach((dot) => dot.classList.remove('is-filling'));
    };

    const restartFill = () => {
        if (prefersReduced() || lightboxOpen || pausedByUser || hovering || !inView || dots.length < 2) {
            clearFill();
            return;
        }

        const active = dots[activeIndex];
        dots.forEach((dot) => dot.classList.remove('is-filling'));
        root.classList.remove('is-autoplay-paused');
        // Retrigger CSS fill animation from 0.
        void active.offsetWidth;
        active.classList.add('is-filling');
    };

    const pauseFill = () => {
        if (dots[activeIndex]?.classList.contains('is-filling')) {
            root.classList.add('is-autoplay-paused');
        }
    };

    const startAutoplay = () => {
        if (prefersReduced() || lightboxOpen || pausedByUser || hovering || !inView || dots.length < 2) {
            if (!hovering) clearFill();
            else pauseFill();
            return;
        }

        const active = dots[activeIndex];
        if (active?.classList.contains('is-filling') && root.classList.contains('is-autoplay-paused')) {
            root.classList.remove('is-autoplay-paused');
            return;
        }

        restartFill();
    };

    const bumpAutoplay = () => {
        pausedByUser = true;
        clearFill();
        window.clearTimeout(resumeTimer);
        // After a manual pick, briefly settle then keep autoplay going on the new slide.
        resumeTimer = window.setTimeout(() => {
            pausedByUser = false;
            startAutoplay();
        }, RESUME_MS);
    };

    clearProductProgress = () => {
        window.clearTimeout(resumeTimer);
        pausedByUser = false;
        clearFill();
    };

    const closeLightbox = () => {
        if (!lightbox || !lightboxOpen) return;
        lightboxOpen = false;
        lightbox.classList.remove('is-visible', 'is-preparing');
        pageStart.classList.remove('is-iselect-lightbox-open');
        document.body.classList.remove('is-iselect-lightbox-open');

        window.setTimeout(() => {
            if (!lightboxOpen) lightbox.hidden = true;
        }, prefersReduced() ? 0 : 300);

        startAutoplay();
    };

    const openLightbox = async (dot = dots[activeIndex]) => {
        if (!lightbox || !lightboxImg || !dot) return;
        const slide = slideOf(dot);
        if (!slide.src) return;

        clearFill();

        if (lightboxImg.getAttribute('src') !== slide.src) {
            lightboxImg.src = slide.src;
        }
        lightboxImg.alt = slide.alt;
        if (lightboxTitle) lightboxTitle.textContent = slide.title;
        if (lightboxDesc) lightboxDesc.textContent = slide.desc;

        try {
            if (typeof lightboxImg.decode === 'function') {
                await lightboxImg.decode();
            }
        } catch {
            /* cached / decode failures are fine */
        }

        lightbox.hidden = false;
        lightboxOpen = true;
        lightbox.classList.remove('is-visible');
        lightbox.classList.add('is-preparing');
        pageStart.classList.add('is-iselect-lightbox-open');
        document.body.classList.add('is-iselect-lightbox-open');

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!lightboxOpen) return;
                lightbox.classList.add('is-visible');
                lightbox.querySelector('.start-iselect-lightbox__close')?.focus();
            });
        });
    };

    const setActive = (next, { animate = true, fromAutoplay = false } = {}) => {
        if (next === activeIndex && dots[next]?.classList.contains('is-active')) {
            return;
        }
        activeIndex = next;

        dots.forEach((dot, i) => {
            const on = i === next;
            dot.classList.toggle('is-active', on);
            dot.setAttribute('aria-selected', on ? 'true' : 'false');
            if (!on) dot.classList.remove('is-filling');
        });

        syncSlide(dots[next], { animate });
        if (fromAutoplay) restartFill();
        else bumpAutoplay();
    };

    dots.forEach((dot) => {
        dot.addEventListener('animationend', (event) => {
            if (event.animationName !== 'start-product-dot-fill') return;
            if (!dot.classList.contains('is-active') || !dot.classList.contains('is-filling')) return;
            if (root.classList.contains('is-autoplay-paused')) return;
            setActive((activeIndex + 1) % dots.length, { fromAutoplay: true });
        });
    });

    lightbox?.addEventListener('click', (event) => {
        if (event.target.closest('[data-iselect-lightbox-close]')) {
            event.preventDefault();
            closeLightbox();
        }
    });

    frame?.addEventListener('click', (event) => {
        event.preventDefault();
        openLightbox(dots[activeIndex]);
    });

    root.querySelector('[data-product-dots]')?.addEventListener('click', (event) => {
        const dot = event.target.closest('.start-product__dot');
        if (!dot || !root.contains(dot)) return;
        const index = dots.indexOf(dot);
        if (index < 0) return;
        setActive(index);
    });

    root.addEventListener('keydown', (event) => {
        if (lightboxOpen && event.key === 'Escape') {
            event.preventDefault();
            closeLightbox();
            return;
        }

        const inDots = event.target.closest('.start-product__dot');
        const inFrame = event.target.closest('[data-product-frame]');
        if (!inDots && !inFrame) return;

        let next = activeIndex;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            next = (activeIndex + 1) % dots.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            next = (activeIndex - 1 + dots.length) % dots.length;
        } else if (event.key === 'Home') {
            next = 0;
        } else if (event.key === 'End') {
            next = dots.length - 1;
        } else {
            return;
        }

        event.preventDefault();
        setActive(next);
        dots[next].focus();
    });

    // Swipe between slides on the frame (mobile-friendly).
    let touchX = null;
    let touchY = null;
    frame?.addEventListener('touchstart', (event) => {
        const t = event.changedTouches?.[0];
        if (!t) return;
        touchX = t.clientX;
        touchY = t.clientY;
    }, { passive: true });

    frame?.addEventListener('touchend', (event) => {
        const t = event.changedTouches?.[0];
        if (!t || touchX == null || touchY == null) return;
        const dx = t.clientX - touchX;
        const dy = t.clientY - touchY;
        touchX = null;
        touchY = null;
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        if (dx < 0) setActive((activeIndex + 1) % dots.length);
        else setActive((activeIndex - 1 + dots.length) % dots.length);
    }, { passive: true });

    // Pause progress only while the mouse rests on the preview frame.
    // Dots stay outside this so tapping a bubble doesn't kill autoplay.
    frame?.addEventListener('pointerenter', (event) => {
        if (event.pointerType && event.pointerType !== 'mouse') return;
        hovering = true;
        pauseFill();
        window.clearTimeout(resumeTimer);
    });
    frame?.addEventListener('pointerleave', (event) => {
        if (event.pointerType && event.pointerType !== 'mouse') return;
        hovering = false;
        if (!pausedByUser) startAutoplay();
    });

    explore?.addEventListener('click', (event) => {
        event.preventDefault();
        bumpAutoplay();
        root.scrollIntoView({
            behavior: prefersReduced() ? 'auto' : 'smooth',
            block: 'center',
        });
        window.setTimeout(() => {
            frame?.focus({ preventScroll: true });
        }, prefersReduced() ? 0 : 420);
    });

    document.addEventListener('keydown', (event) => {
        if (!lightboxOpen || event.key !== 'Escape') return;
        closeLightbox();
    });

    // Autoplay only while the product stage is on screen.
    if (typeof IntersectionObserver !== 'undefined') {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                inView = entry.isIntersecting && entry.intersectionRatio > 0.35;
                if (inView) startAutoplay();
                else clearFill();
            });
        }, { threshold: [0, 0.35, 0.6] });
        io.observe(root);
    } else {
        inView = true;
        startAutoplay();
    }

    armProductAutoplay = () => {
        const rect = root.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        inView = rect.bottom > vh * 0.12 && rect.top < vh * 0.88;
        pausedByUser = false;
        window.clearTimeout(resumeTimer);
        startAutoplay();
    };

    // Staggered pill entrance when the product block enters the viewport.
    if (pills) {
        const revealPills = () => {
            if (pills.classList.contains('is-in')) return;
            pills.classList.add('is-in');
            window.setTimeout(() => {
                pills.classList.add('is-settled');
            }, prefersReduced() ? 0 : 900);
        };

        if (prefersReduced()) {
            revealPills();
        } else if (typeof IntersectionObserver !== 'undefined') {
            const pillsIo = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    revealPills();
                    pillsIo.disconnect();
                });
            }, { threshold: 0.25 });
            pillsIo.observe(pills);
        } else {
            revealPills();
        }
    }

    applySlide(dots[activeIndex]);
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
const TEXT_GROUP_SEL = '.start-head, .start-split__copy, .start-cta-band, .start-mobile__copy';
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
    '.start-mobile__store',
    '.start-mobile__note',
    '.start-mobile__feats li',
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
            at += part.matches('.start-checks li, .start-mobile__feats li') ? 0.08 : 0.12;
        }
    });
}

/** A visual block (card, frame, orbit): rises as one piece out of a blur. */
function revealBlock(tl, el) {
    const from = { opacity: 0, scale: 0.965, filter: 'blur(10px)' };
    const to = { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.2, ease: 'power3.out' };

    // Showcase stage already owns its entrance; don't also slide it on reveal.
    if (!el.matches('.start-showcase__frame, .start-iselect, .start-product__stage')) {
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
            // Phone art is desktop-only; skip its entrance on tablet/phone.
            if (el.matches('.start-mobile__visual') && window.matchMedia('(max-width: 1023px)').matches) {
                return;
            }

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

        // Soft parallax on the product stage shell.
        const productStage = pageStart.querySelector('.start-product__stage');
        if (productStage) {
            gsap.fromTo(productStage, { y: 36 }, {
                y: -16,
                ease: 'none',
                scrollTrigger: {
                    trigger: productStage,
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

        // Phone drifts against the copy so the mobile panel feels alive in scroll.
        const mobilePhone = pageStart.querySelector('.start-mobile__phone');
        if (mobilePhone && window.matchMedia('(min-width: 1024px)').matches) {
            gsap.fromTo(mobilePhone, { y: 40 }, {
                y: -28,
                ease: 'none',
                scrollTrigger: {
                    trigger: mobilePhone.closest('.start-mobile__panel') || mobilePhone,
                    scroller: pageStart,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: 0.7,
                },
            });
        }
    }, pageStart);

    // Measure after the page is visible and laid out.
    requestAnimationFrame(() => ScrollTrigger.refresh());
}
