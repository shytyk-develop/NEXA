import * as React from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './product.css';

gsap.registerPlugin(ScrollTrigger);

// "The product": the app's screens on a wheel you turn (ported from the
// WorksWheel draft — same geometry and motion, plain CSS instead of Tailwind,
// which the landing doesn't load).
//
// At rest the screens sit in a ring around the title, each card tangent to the
// circle. The first notch of scroll blows the ring open into a vertical drum:
// the card at the front lies flat and full size, the ones above and below
// rotate away into hard perspective and run off the top and bottom of the
// frame. Keep turning and the drum carries the next screen round to the front.
// Theme chips swap every screenshot to the same screen in another theme.
//
// The whole thing is one number - `turn` - read by a single rAF pass that writes
// transforms straight to the DOM. 0 is the ring, 1 is the drum with item 0 at
// the front, and every whole number after that is one more item turned past.
//
// Scroll drives it: a GSAP ScrollTrigger pins the section at the top of the
// screen and maps the pinned stretch of scroll onto `turn` - the first HOLD of
// it the ring just hangs there, then each step turns one screen to the front,
// snapping so it never rests between two, and the last screen holds for
// HOLD_END before the section scrolls on. Drag, arrow keys and the index all
// move the page scroll, so everything stays in step.

type Screen = { title: string; file: number };
type Theme = { id: string; name: string; folder: string; prefix: string; swatch: [string, string] };

/** The six screens, in the order the screenshots are numbered (1–6). */
const SCREENS: Screen[] = [
    { title: 'Chats', file: 1 },
    { title: 'Profile', file: 2 },
    { title: 'Appearance', file: 3 },
    { title: 'Security', file: 4 },
    { title: 'Privacy', file: 5 },
    { title: 'Data', file: 6 },
];

/** public/screenshots/themes/<folder>/<prefix><n>.png */
const THEMES: Theme[] = [
    { id: 'neon', name: 'Dark Neon', folder: 'Dark Neon', prefix: 'neon', swatch: ['#070707', '#C7FF00'] },
    { id: 'emerald', name: 'Light Emerald', folder: 'Light Emerald', prefix: 'emerald', swatch: ['#F6F7F3', '#005218'] },
    { id: 'lime', name: 'Light Lime', folder: 'Light Lime', prefix: 'lime', swatch: ['#F7F8F2', '#8DC400'] },
];

const shotSrc = (theme: Theme, screen: Screen) =>
    encodeURI(`/screenshots/themes/${theme.folder}/${theme.prefix}${screen.file}.png`);

const LABEL = 'One view. Total privacy.';

/* Geometry. The card is measured against the stage; everything else is measured
   against the card, so a narrow stage - where the card is capped by width, not
   height - scales the whole wheel down with it instead of leaving a small card
   swinging on a huge drum. The three that matter are tuned together: STEP
   against DRUM sets how hard the neighbours rotate away, and DRUM against LENS
   decides whether they land inside the frame or run off it. */
/** Vertical breathing room (px) above and below the wheel inside the section:
    the whole wheel is sized to the height left between them, so no card of
    the ring or the drum reaches the section's edges (or sits under the nav). */
const PAD_Y = 80;
/** Overall scale of the wheel within that room. */
const FIT = 0.8;
const CARD_H = 0.38; // front card height, of the stage
const CARD_MAX_W = 0.34; // ... but never wider than this much of the stage
const CARD_RATIO = 1710 / 950; // card width / height: the screenshots' own
const STEP = 40; // degrees between cards on the drum
const DRUM = 2.22; // drum radius, in card heights - and everything below likewise
const LENS = 2.7; // perspective distance
const RING_R = 1.14; // ring radius
/* The drum alone hangs the work on a plumb line. It isn't one: the strip curves
   away round an arc whose centre sits off to the LEFT, so the piece at the front
   is at the arc's near point - dead centre - and its neighbours have already
   swung back left as well as up and down. BOW is that arc's radius. */
const BOW = 1.82;
const TITLE = 0.124; // ring label and front-card title
const INDEX = 0.04; // the index down the right-hand side
/** Items either side of the front still worth drawing. */
const CULL = 1.6;

/* Focus. In the drum the screen at the front grows to FOCUS_SCALE so its text
   and controls read clearly, its neighbours shrink to NEIGHBOR_SCALE and dim to
   NEIGHBOR_OPACITY; the ring keeps every card at its compact ring size. It all
   follows `turn`, so a card grows smoothly as it comes round to the front.
   Cards are laid out at the focused size and only ever scaled DOWN from it, so
   the focused screenshot is drawn at full resolution, not blown up. */
const FOCUS_SCALE = 1.55;
const NEIGHBOR_SCALE = 0.85;
const NEIGHBOR_OPACITY = 0.3;

/** How many dragged pixels count as one item. */
const DRAG_UNITS = 420;
/** Share of the pinned scroll where the ring holds still before it opens… */
const HOLD = 0.1;
/** …and where the last screen stays in front before the section scrolls on. */
const HOLD_END = 0.08;
/** Share of the pinned scroll that actually turns the wheel. */
const TURN_SPAN = 1 - HOLD - HOLD_END;
/** Pinned scroll per step (ring → drum, then each screen), in viewport heights. */
const STEP_VH = 0.45;
/** Fraction of the remaining distance closed each frame. 1 = no smoothing. */
const EASE = 0.12;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rad = (deg: number) => (deg * Math.PI) / 180;

type Stage = { w: number; h: number };

/** How far left the arc has carried something that has turned `drumDeg` off the front. */
const bowAt = (drumDeg: number, bow: number) => -bow * (1 - Math.cos(rad(drumDeg)));

/** Both states in one chain: the ring terms fall away as `m` reaches the drum,
    and the drum terms are still zero while the ring is up. */
function place(ringDeg: number, drumDeg: number, ringR: number, drumR: number, bow: number, m: number) {
    return (
        `translateX(${m * bowAt(drumDeg, bow)}px)`
        + ` rotateZ(${(1 - m) * ringDeg}deg) translateY(${-(1 - m) * ringR}px)`
        + ` rotateX(${m * drumDeg}deg) translateZ(${m * drumR}px)`
    );
}

/** Resolves once every screenshot of a theme is decoded (errors don't block). */
function preloadTheme(theme: Theme) {
    return Promise.all(SCREENS.map((screen) => {
        const img = new Image();
        img.src = shotSrc(theme, screen);
        return img.decode().catch(() => undefined);
    }));
}

export function Product() {
    const trackRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<ScrollTrigger | null>(null);
    const stageRef = React.useRef<HTMLDivElement>(null);
    const wheelRef = React.useRef<HTMLDivElement>(null);
    const cardRefs = React.useRef<(HTMLElement | null)[]>([]);
    const labelRef = React.useRef<HTMLDivElement>(null);
    const titleRef = React.useRef<HTMLDivElement>(null);

    // The wheel's position, and where it is heading. Only `active` is state -
    // everything else is written to the DOM, so turning the wheel is not a render.
    const turn = React.useRef(0);
    const target = React.useRef(0);
    const [active, setActive] = React.useState(0);
    const [stage, setStage] = React.useState<Stage>({ w: 0, h: 0 });

    // Themes: every theme once shown stays mounted as a layer on each card, so
    // switching back is instant; the chosen one fades in over the others.
    const [themeId, setThemeId] = React.useState(THEMES[0].id);
    const [pendingTheme, setPendingTheme] = React.useState<string | null>(null);
    const [mountedThemes, setMountedThemes] = React.useState<string[]>([THEMES[0].id]);

    const count = SCREENS.length;
    const last = Math.max(count - 1, 0);

    const [reduced, setReduced] = React.useState(false);
    React.useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const read = () => setReduced(query.matches);
        read();
        query.addEventListener('change', read);
        return () => query.removeEventListener('change', read);
    }, []);

    React.useEffect(() => {
        const el = stageRef.current;
        if (!el) return;
        const read = () => setStage({ w: el.clientWidth, h: el.clientHeight });
        read();
        const ro = new ResizeObserver(read);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const metrics = React.useMemo(() => {
        const { w, h } = stage;
        const room = Math.max(0, h - 2 * PAD_Y);
        const cardW = Math.min(room * CARD_H * CARD_RATIO, w * CARD_MAX_W) * FIT;
        const cardH = cardW / CARD_RATIO;
        const drumR = cardH * DRUM;
        const ringR = cardH * RING_R;
        // Shrink the ring's cards until the circle reads as a closed loop.
        const ringScale = count
            ? clamp((((2 * Math.PI * ringR) / count) * 0.82) / (cardW || 1), 0.16, 1)
            : 1;
        return {
            cardW,
            cardH,
            ringR,
            ringScale,
            drumR,
            bow: cardH * BOW,
            depth: cardH * LENS,
            title: cardH * TITLE,
            index: cardH * INDEX,
        };
    }, [stage, count]);

    // One pass per frame: ease toward the target, then write every transform.
    React.useEffect(() => {
        if (!stage.h) return undefined;
        let frame = 0;
        const { ringR, ringScale, drumR, bow } = metrics;

        const draw = () => {
            frame = requestAnimationFrame(draw);
            const gap = target.current - turn.current;
            if (Math.abs(gap) < 0.0005) turn.current = target.current;
            else turn.current += gap * (reduced ? 1 : EASE);

            const t = turn.current;
            const m = clamp(t, 0, 1);
            const pos = Math.max(0, t - 1);

            // The drum is pulled back so its front face lands on the picture plane.
            if (wheelRef.current) {
                wheelRef.current.style.transform = `translateZ(${-m * drumR}px)`;
            }

            for (let i = 0; i < count; i++) {
                const d = i - pos;
                const drumDeg = d * STEP;
                const card = cardRefs.current[i];
                // 1 at the front of the drum, 0 a whole step (or more) away.
                const near = clamp(1 - Math.abs(d), 0, 1);
                if (card) {
                    card.style.transform = place(d * (360 / count), drumDeg, ringR, drumR, bow, m);
                    card.style.opacity = m > 0.5 && Math.abs(d) > CULL
                        ? '0'
                        : String(lerp(1, lerp(NEIGHBOR_OPACITY, 1, near), m));
                    card.style.zIndex = String(Math.round(100 - Math.abs(d) * 2));
                }
                const face = card?.firstElementChild as HTMLElement | null;
                if (face) {
                    const size = lerp(ringScale, lerp(NEIGHBOR_SCALE, FOCUS_SCALE, near), m);
                    face.style.transform = `scale(${size / FOCUS_SCALE})`;
                    // Shadow, glow and hairline border of the focused screen (product.css).
                    face.style.setProperty('--focus', (m * near).toFixed(3));
                }
            }

            if (labelRef.current) labelRef.current.style.opacity = String(1 - m);
            if (titleRef.current) titleRef.current.style.opacity = String(m);
            const near = clamp(Math.round(pos), 0, last);
            setActive((prev) => (prev === near ? prev : near));
        };

        frame = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(frame);
    }, [metrics, stage.h, count, last, reduced]);

    const to = React.useCallback(
        (next: number) => {
            target.current = clamp(next, 0, last + 1);
        },
        [last],
    );

    const drag = React.useRef<number | null>(null);

    /** Pinned-scroll progress (0–1) at which the wheel shows `turn`. */
    const progressFor = React.useCallback(
        (turnValue: number) => (turnValue <= 0 ? 0 : HOLD + (TURN_SPAN * turnValue) / (last + 1)),
        [last],
    );

    // Pin the section and let the scroll turn the wheel. The pin is CSS
    // (position: sticky inside a tall track): the browser holds it on its
    // compositor, so it never lags a fast or momentum scroll. A GSAP pin can't
    // do that here - the landing scrolls inside #page-start, where its pin is
    // a transform applied a frame late (the section ran off and snapped back),
    // and a fixed pin takes the wheel away from #page-start. ScrollTrigger
    // only reads the progress through the track: turn + snapping.
    React.useEffect(() => {
        const track = trackRef.current;
        const scroller = document.getElementById('page-start');
        if (!track || !scroller) return undefined;
        const snapPoints = [...Array.from({ length: last + 2 }, (_, k) => progressFor(k)), 1];
        const trigger = ScrollTrigger.create({
            trigger: track,
            scroller,
            start: 'top top',
            end: 'bottom bottom',
            invalidateOnRefresh: true,
            snap: { snapTo: snapPoints, duration: { min: 0.2, max: 0.6 }, delay: 0.08, ease: 'power1.inOut' },
            onUpdate: (self) => {
                target.current = clamp((self.progress - HOLD) / TURN_SPAN, 0, 1) * (last + 1);
            },
        });
        triggerRef.current = trigger;
        ScrollTrigger.refresh();
        return () => {
            trigger.kill();
            triggerRef.current = null;
        };
    }, [last, progressFor]);

    /** Scroll the page to where the wheel shows `turnValue` (the pin then turns it). */
    const scrollToTurn = React.useCallback(
        (turnValue: number) => {
            const trigger = triggerRef.current;
            const scroller = document.getElementById('page-start');
            const next = clamp(turnValue, 0, last + 1);
            if (!trigger || !scroller) {
                to(next);
                return;
            }
            const top = trigger.start + progressFor(next) * (trigger.end - trigger.start);
            scroller.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
        },
        [last, progressFor, reduced, to],
    );

    /** Scroll by a dragged distance, one item per DRAG_UNITS px. */
    const dragBy = React.useCallback(
        (pixels: number) => {
            const trigger = triggerRef.current;
            const scroller = document.getElementById('page-start');
            if (!trigger || !scroller) return;
            const perItem = ((trigger.end - trigger.start) * TURN_SPAN) / (last + 1);
            scroller.scrollTo({ top: scroller.scrollTop + (pixels / DRAG_UNITS) * perItem, behavior: 'instant' as ScrollBehavior });
        },
        [last],
    );

    const pickTheme = React.useCallback((id: string) => {
        const theme = THEMES.find((t) => t.id === id);
        if (!theme || id === themeId) return;
        setPendingTheme(id);
        // Swap once the new screenshots are decoded: the old ones stay up meanwhile.
        void preloadTheme(theme).then(() => {
            setMountedThemes((list) => (list.includes(id) ? list : [...list, id]));
            requestAnimationFrame(() => {
                setThemeId(id);
                setPendingTheme((current) => (current === id ? null : current));
            });
        });
    }, [themeId]);

    const activeTheme = THEMES.find((t) => t.id === themeId) || THEMES[0];

    return (
        // The track is as tall as the pinned scroll plus one screen; the section
        // sticks to the top of the screen while the track scrolls past.
        <div
            ref={trackRef}
            id="product"
            className="start-product-track"
            style={{ '--product-track': (STEP_VH * (last + 1)) / TURN_SPAN } as React.CSSProperties}
        >
            <section className="start-product-wheel" aria-label="The product">
                {/* The wheel's own frame: cards run off its top and bottom edges, never
                    over the controls below. */}
                <div className="start-product-wheel__frame">
                    <div
                        ref={stageRef}
                        tabIndex={0}
                        role="listbox"
                        aria-label="NEXA screens"
                        aria-activedescendant={`product-wheel-${active}`}
                        className="start-product-wheel__stage"
                        style={{ perspective: `${metrics.depth}px` }}
                        onPointerDown={(event) => {
                            if (event.pointerType === 'touch') return; // touch scrolls the page
                            drag.current = event.clientY;
                            event.currentTarget.setPointerCapture(event.pointerId);
                        }}
                        onPointerMove={(event) => {
                            if (drag.current === null) return;
                            dragBy(drag.current - event.clientY);
                            drag.current = event.clientY;
                        }}
                        onPointerUp={() => {
                            // Land on an item rather than between two.
                            drag.current = null;
                            scrollToTurn(Math.round(target.current));
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'ArrowDown') scrollToTurn(Math.round(target.current) + 1);
                            else if (event.key === 'ArrowUp') scrollToTurn(Math.round(target.current) - 1);
                            else return;
                            event.preventDefault();
                        }}
                    >
                        <div ref={wheelRef} className="start-product-wheel__wheel">
                            {SCREENS.map((screen, i) => (
                                <div
                                    key={screen.title}
                                    id={`product-wheel-${i}`}
                                    role="option"
                                    aria-selected={i === active}
                                    aria-label={screen.title}
                                    ref={(node) => {
                                        cardRefs.current[i] = node;
                                    }}
                                    className="start-product-wheel__card"
                                    style={{
                                        width: metrics.cardW * FOCUS_SCALE,
                                        height: metrics.cardH * FOCUS_SCALE,
                                        marginLeft: (-metrics.cardW * FOCUS_SCALE) / 2,
                                        marginTop: (-metrics.cardH * FOCUS_SCALE) / 2,
                                    }}
                                >
                                    <span className="start-product-wheel__face">
                                        {THEMES.filter((theme) => mountedThemes.includes(theme.id)).map((theme) => (
                                            <img
                                                key={theme.id}
                                                src={shotSrc(theme, screen)}
                                                alt={theme.id === themeId ? `NEXA ${screen.title} — ${theme.name}` : ''}
                                                aria-hidden={theme.id === themeId ? undefined : true}
                                                draggable={false}
                                                decoding="async"
                                                className={`start-product-wheel__img${theme.id === themeId ? ' is-active' : ''}`}
                                            />
                                        ))}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Ring title and front-card title trade places across the transition.
                        Type is sized off the measured stage, not vh. */}
                    <div ref={labelRef} className="start-product-wheel__label" style={{ fontSize: metrics.title }}>
                        {LABEL}
                    </div>
                    <div ref={titleRef} className="start-product-wheel__title" style={{ fontSize: metrics.title }}>
                        {SCREENS[active]?.title}
                    </div>

                    {/* Top right: the screen list, and under it the theme dock. */}
                    <div className="start-product-wheel__side">
                        <ol className="start-product-wheel__index" style={{ fontSize: metrics.index }}>
                            {SCREENS.map((screen, i) => (
                                <li key={screen.title}>
                                    <button
                                        type="button"
                                        onClick={() => scrollToTurn(i + 1)}
                                        className={i === active ? 'is-active' : undefined}
                                    >
                                        {screen.title}
                                    </button>
                                </li>
                            ))}
                        </ol>
                        <div className="start-product-wheel__dock" role="radiogroup" aria-label="Theme">
                            {THEMES.map((theme) => {
                                const on = theme.id === themeId;
                                const loading = pendingTheme === theme.id;
                                return (
                                    <button
                                        key={theme.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={on}
                                        className={`start-product-wheel__theme${on ? ' is-active' : ''}${loading ? ' is-loading' : ''}`}
                                        onClick={() => pickTheme(theme.id)}
                                    >
                                        {/* Split circle: the theme's background and its accent. */}
                                        <svg className="start-product-wheel__swatch" viewBox="0 0 12 12" aria-hidden="true">
                                            <circle cx="6" cy="6" r="5.5" fill={theme.swatch[0]} />
                                            <path d="M6 .5a5.5 5.5 0 0 1 0 11z" fill={theme.swatch[1]} />
                                            <circle cx="6" cy="6" r="5.5" fill="none" stroke="rgba(255,255,255,0.22)" />
                                        </svg>
                                        {theme.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
