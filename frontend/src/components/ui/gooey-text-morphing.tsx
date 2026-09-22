"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Marker string — rendered as three bouncing dots, not literal text. */
export const GOOEY_DOTS = "\0dots";

interface GooeyTextProps {
  texts: string[];
  morphTime?: number;
  cooldownTime?: number;
  className?: string;
  textClassName?: string;
  /**
   * When set, hold on this index (same morph math as the auto-cycle demo).
   * Change it to morph to another text; omit for continuous cycling.
   */
  activeIndex?: number;
}

function writeSlot(el: HTMLSpanElement, value: string) {
  if (value === GOOEY_DOTS) {
    el.replaceChildren();
    const wrap = document.createElement("span");
    wrap.className = "gooey-typing-dots";
    wrap.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i += 1) wrap.append(document.createElement("span"));
    el.append(wrap);
    return;
  }
  el.textContent = value;
}

export function GooeyText({
  texts,
  morphTime = 1,
  cooldownTime = 0.25,
  className,
  textClassName,
  activeIndex,
}: GooeyTextProps) {
  const text1Ref = React.useRef<HTMLSpanElement>(null);
  const text2Ref = React.useRef<HTMLSpanElement>(null);
  const filterId = `threshold-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const activeIndexRef = React.useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const controlled = activeIndex != null;

  const sizerText = React.useMemo(() => {
    const preferred = texts.find((t) => t && t !== GOOEY_DOTS);
    return preferred || "\u00a0";
  }, [texts]);

  React.useEffect(() => {
    let textIndex =
      activeIndex != null
        ? ((activeIndex % texts.length) + texts.length) % texts.length
        : texts.length - 1;
    let displayedIndex = textIndex;
    let time = new Date();
    let morph = 0;
    let cooldown = controlled ? Number.POSITIVE_INFINITY : cooldownTime;
    let raf = 0;
    let forceSwap = false;

    if (text1Ref.current && text2Ref.current) {
      writeSlot(text1Ref.current, texts[textIndex % texts.length]);
      writeSlot(text2Ref.current, texts[textIndex % texts.length]);
      text2Ref.current.style.filter = "";
      text2Ref.current.style.opacity = "100%";
      text1Ref.current.style.filter = "";
      text1Ref.current.style.opacity = "0%";
    }

    const setMorph = (fraction: number) => {
      if (text1Ref.current && text2Ref.current) {
        text2Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
        text2Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;

        fraction = 1 - fraction;
        text1Ref.current.style.filter = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
        text1Ref.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
      }
    };

    const doCooldown = () => {
      morph = 0;
      if (text1Ref.current && text2Ref.current) {
        text2Ref.current.style.filter = "";
        text2Ref.current.style.opacity = "100%";
        text1Ref.current.style.filter = "";
        text1Ref.current.style.opacity = "0%";
      }
    };

    const doMorph = () => {
      morph -= cooldown;
      cooldown = 0;
      let fraction = morph / morphTime;

      if (fraction > 1) {
        cooldown = controlled ? Number.POSITIVE_INFINITY : cooldownTime;
        fraction = 1;
      }

      setMorph(fraction);
    };

    function animate() {
      raf = requestAnimationFrame(animate);
      const newTime = new Date();
      const shouldIncrementIndex = cooldown > 0;
      const dt = (newTime.getTime() - time.getTime()) / 1000;
      time = newTime;

      if (controlled && activeIndexRef.current != null) {
        const target =
          ((activeIndexRef.current % texts.length) + texts.length) % texts.length;
        if (target !== displayedIndex && cooldown > 0) {
          forceSwap = true;
          cooldown = 0;
        }
      }

      cooldown -= dt;

      if (cooldown <= 0) {
        if (shouldIncrementIndex || forceSwap) {
          forceSwap = false;
          if (controlled && activeIndexRef.current != null) {
            const target =
              ((activeIndexRef.current % texts.length) + texts.length) % texts.length;
            if (target === displayedIndex) {
              cooldown = Number.POSITIVE_INFINITY;
              doCooldown();
              return;
            }
            if (text1Ref.current && text2Ref.current) {
              writeSlot(text1Ref.current, texts[displayedIndex % texts.length]);
              writeSlot(text2Ref.current, texts[target % texts.length]);
            }
            displayedIndex = target;
            textIndex = target;
          } else {
            textIndex = (textIndex + 1) % texts.length;
            displayedIndex = textIndex;
            if (text1Ref.current && text2Ref.current) {
              writeSlot(text1Ref.current, texts[textIndex % texts.length]);
              writeSlot(text2Ref.current, texts[(textIndex + 1) % texts.length]);
            }
          }
        }
        doMorph();
      } else {
        doCooldown();
      }
    }

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [texts, morphTime, cooldownTime, controlled]);

  return (
    <div className={cn("gooey-text relative", className)}>
      <svg className="gooey-text__svg absolute h-0 w-0" aria-hidden="true" focusable="false">
        <defs>
          <filter id={filterId}>
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>

      <span className="gooey-text__sizer" aria-hidden="true">
        {sizerText}
      </span>

      <div
        className="gooey-text__morph flex items-center justify-center"
        style={{ filter: `url(#${filterId})` }}
      >
        <span
          ref={text1Ref}
          className={cn(
            "gooey-text__layer absolute inline-block select-none",
            textClassName,
          )}
        />
        <span
          ref={text2Ref}
          className={cn(
            "gooey-text__layer absolute inline-block select-none",
            textClassName,
          )}
        />
      </div>
    </div>
  );
}
