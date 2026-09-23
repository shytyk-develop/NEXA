import * as React from "react";
import { cn } from "@/lib/utils";

/** Pass as `text` to render three bouncing gooey dots instead of a string. */
export const GOOEY_DOTS = "\u0000dots";

interface GooeyTextProps {
  /** Text to show (or GOOEY_DOTS). Changing it plays one gooey morph from the previous value. */
  text: string;
  /** Morph duration in seconds. */
  morphTime?: number;
  /** SVG alpha-threshold that makes the crossfade read as liquid. */
  threshold?: boolean;
  className?: string;
  textClassName?: string;
}

/*
 * Blur is expressed in `em` so the effect scales with the inherited font size.
 * Mid-morph both layers sit at ~BLUR_EM, wide enough for the threshold to fuse
 * them into one blob instead of crossfading; the cap keeps the tail inside the
 * enlarged filter region.
 */
const BLUR_EM = 0.2;
const MAX_BLUR_EM = 0.6;

/*
 * A layer much wider than its counterpart (a long name vs. the dots) squeezes
 * toward the other's width as it fades, so it visibly drains into it instead of
 * dissolving in place. Up to SQUEEZE_SLACK× wider is left alone — short names
 * morph exactly as before.
 */
const SQUEEZE_SLACK = 1.5;
/** Vertical share of the squeeze: mostly horizontal so glyphs stay legible. */
const SQUEEZE_Y = 0.3;
/** Extra morph time per px of width difference, capped at +MAX_EXTRA_TIME. */
const EXTRA_TIME_PER_PX = 1 / 400;
const MAX_EXTRA_TIME = 0.8;

/** Horizontal scale a layer collapses to at zero visibility (1 = no squeeze). */
function squeezeTarget(width: number, otherWidth: number) {
  if (width <= 0) return 1;
  return Math.min(1, (SQUEEZE_SLACK * otherWidth) / width);
}

function applyLayer(el: HTMLSpanElement, fraction: number, squeeze = 1) {
  if (fraction <= 0 || fraction >= 1) {
    el.style.filter = "";
    el.style.scale = "";
    el.style.opacity = fraction <= 0 ? "0%" : "100%";
    return;
  }
  el.style.filter = `blur(${Math.min(BLUR_EM / fraction - BLUR_EM, MAX_BLUR_EM)}em)`;
  el.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
  if (squeeze < 1) {
    const sx = squeeze + (1 - squeeze) * fraction;
    el.style.scale = `${sx} ${1 - (1 - sx) * SQUEEZE_Y}`;
  } else {
    el.style.scale = "";
  }
}

function writeSlot(el: HTMLSpanElement, value: string, dotsFilterId: string | null) {
  if (value !== GOOEY_DOTS) {
    el.textContent = value;
    return;
  }
  // Dots keep their own blur+threshold filter so they fuse into droplets while bouncing.
  const wrap = document.createElement("span");
  wrap.className = "gooey-dots";
  if (dotsFilterId) wrap.style.filter = `url(#${dotsFilterId})`;
  for (let i = 0; i < 3; i += 1) wrap.append(document.createElement("span"));
  el.replaceChildren(wrap);
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Symmetric, so the outgoing layer at ease(p) mirrors the incoming one at ease(1 - p).
 * Sine rather than cubic: a gentler middle, so the blend never rushes.
 */
function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

/** Alpha row of the threshold matrix at strength k: identity at 0, full 25/-9 goo at 1. */
function gooAlphaRow(k: number) {
  return `0 0 0 ${1 + 24 * k} ${-9 * k}`;
}

const GOO_RGB_ROWS = "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  ";

/*
 * Two physical layers swap roles instead of being rewritten on every change:
 * the one on screen leaves exactly as it is (dots keep bouncing mid-phase, no
 * snap back to the baseline) and only the other layer receives the new text.
 */
interface MorphState {
  front: 0 | 1;
  values: [string | null, string | null];
  /** Linear 0..1 progress of the front layer's entry. */
  progress: number;
}

export function GooeyText({
  text,
  morphTime = 1,
  threshold = true,
  className,
  textClassName,
}: GooeyTextProps) {
  const layerARef = React.useRef<HTMLSpanElement>(null);
  const layerBRef = React.useRef<HTMLSpanElement>(null);
  const morphRef = React.useRef<HTMLDivElement>(null);
  const gooMatrixRef = React.useRef<SVGFEColorMatrixElement>(null);
  const stateRef = React.useRef<MorphState>({ front: 0, values: [null, null], progress: 1 });
  const filterId = `gooey-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const dotsFilterId = threshold ? `${filterId}-dots` : null;

  React.useLayoutEffect(() => {
    const layers = [layerARef.current, layerBRef.current] as const;
    const morphEl = morphRef.current;
    if (!layers[0] || !layers[1] || !morphEl) return;
    const els = layers as readonly [HTMLSpanElement, HTMLSpanElement];
    const st = stateRef.current;

    /*
     * The threshold hardens glyph edges, so instead of switching it on/off (a
     * visible snap at both ends of the morph) its strength k eases from 0 to
     * full at mid-morph and back; at k = 0 the matrix is the identity and the
     * filter is dropped entirely so static text stays anti-aliased.
     */
    const setGoo = (k: number) => {
      const on = threshold && k > 0.001;
      morphEl.style.filter = on ? `url(#${filterId})` : "";
      if (on) gooMatrixRef.current?.setAttribute("values", GOO_RGB_ROWS + gooAlphaRow(k));
    };

    const settle = (idx: 0 | 1) => {
      st.front = idx;
      st.progress = 1;
      applyLayer(els[idx], 1);
      applyLayer(els[1 - idx], 0);
      setGoo(0);
    };

    // First render: place the text without animating.
    if (st.values[st.front] === null) {
      writeSlot(els[st.front], text, dotsFilterId);
      st.values[st.front] = text;
      settle(st.front);
      return;
    }

    const back = (1 - st.front) as 0 | 1;
    let inIdx: 0 | 1;
    let from: number;
    if (st.values[st.front] === text) {
      // Same target (e.g. morphTime changed mid-morph): keep going.
      inIdx = st.front;
      from = st.progress;
    } else if (st.values[back] === text) {
      // Reverting (typing stopped mid-morph, or the usual name ⇄ dots toggle):
      // run backwards from wherever the blend currently is.
      inIdx = back;
      from = 1 - st.progress;
    } else {
      writeSlot(els[back], text, dotsFilterId);
      st.values[back] = text;
      inIdx = back;
      from = 1 - st.progress;
    }

    if (from >= 1 || prefersReducedMotion()) {
      settle(inIdx);
      return;
    }

    const inEl = els[inIdx];
    const outEl = els[1 - inIdx];
    st.front = inIdx;
    st.progress = from;

    // Measured unscaled (`scale` doesn't affect offsetWidth).
    const inWidth = inEl.offsetWidth;
    const outWidth = outEl.offsetWidth;
    const inSqueeze = squeezeTarget(inWidth, outWidth);
    const outSqueeze = squeezeTarget(outWidth, inWidth);
    // Long names get more time so the collapse reads instead of flashing by.
    const extra = Math.min(MAX_EXTRA_TIME, Math.abs(inWidth - outWidth) * EXTRA_TIME_PER_PX);
    const duration = morphTime * (1 + extra) * 1000;
    const t0 = performance.now() - from * duration;
    let raf = 0;

    const step = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      st.progress = p;
      const e = easeInOutSine(p);
      applyLayer(inEl, e, inSqueeze);
      applyLayer(outEl, 1 - e, outSqueeze);
      setGoo(Math.sin(Math.PI * p));
      if (p < 1) raf = requestAnimationFrame(step);
    };

    step(performance.now());

    // Interrupted: stop in place — the next run resumes from st.progress.
    return () => cancelAnimationFrame(raf);
  }, [text, morphTime, threshold, filterId, dotsFilterId]);

  return (
    <div className={cn("gooey-text relative", className)}>
      {threshold ? (
        <svg className="gooey-text__svg absolute h-0 w-0" aria-hidden="true" focusable="false">
          <defs>
            <filter
              id={filterId}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
              colorInterpolationFilters="sRGB"
            >
              <feColorMatrix
                ref={gooMatrixRef}
                in="SourceGraphic"
                type="matrix"
                values={GOO_RGB_ROWS + gooAlphaRow(1)}
              />
            </filter>
            <filter
              id={`${filterId}-dots`}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" />
              <feColorMatrix
                type="matrix"
                values="1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        0 0 0 25 -9"
              />
            </filter>
          </defs>
        </svg>
      ) : null}

      <span className="gooey-text__sizer" aria-hidden="true">
        {text && text !== GOOEY_DOTS ? text : " "}
      </span>

      <div
        ref={morphRef}
        className="gooey-text__morph flex items-center justify-center"
        aria-hidden="true"
      >
        <span ref={layerARef} className={cn("gooey-text__layer absolute inline-block select-none", textClassName)} />
        <span ref={layerBRef} className={cn("gooey-text__layer absolute inline-block select-none", textClassName)} />
      </div>
    </div>
  );
}
