import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import "./scroll-blur.css";

type ScrollBlurAxis = "vertical" | "horizontal" | "both";
type ScrollSnap = "none" | "x" | "y" | "both";
type ScrollSnapAlign = "start" | "center" | "end";
type ScrollBlurSide = "top" | "bottom" | "left" | "right";
type ScrollBlurEdgeVariant = "fade" | "mask" | "custom";
type Edges = { top: boolean; bottom: boolean; left: boolean; right: boolean };

export interface ScrollBlurProps extends React.HTMLAttributes<HTMLDivElement> {
  axis?: ScrollBlurAxis;
  edgeSize?: number;
  snap?: ScrollSnap;
  /** When false, keep the native/OS scrollbar visible. Default true. */
  hideScrollbar?: boolean;
  /** Keep edge fades visible even at scroll extents (e.g. under floating chrome). */
  forceEdges?: boolean;
  /**
   * "fade": tinted gradient + light blur (default).
   * "mask": progressive — the content itself fades out (mask-image on the
   *   viewport, so every descendant goes with it whatever its z-index, and the
   *   real background shows through: no colour to match), with a light blur
   *   that strengthens toward the edge on top. Vertical or horizontal (not both).
   * "custom": a bare, unstyled edge (no layers, no inline size) — style it entirely
   * through `edgeClassNames`.
   */
  edgeVariant?: ScrollBlurEdgeVariant;
  /**
   * Hide the edge fades while the content is resizing (e.g. an animated tree
   * expand / collapse) and re-evaluate once it settles. Otherwise the fades get
   * toggled frame by frame as the height crosses the overflow line and smear
   * over the rows passing beneath them.
   */
  hideEdgesWhileResizing?: boolean;
  /** Extra classes per edge; with edgeVariant="custom" they carry all the styling. */
  edgeClassNames?: Partial<Record<ScrollBlurSide, string>>;
  viewportClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

/** Quiet period after the last resize before edges are re-evaluated. */
const RESIZE_SETTLE_MS = 180;

export function ScrollBlur({
  axis = "vertical",
  edgeSize = 40,
  snap = "none",
  hideScrollbar = true,
  forceEdges = false,
  hideEdgesWhileResizing = false,
  edgeVariant = "fade",
  edgeClassNames,
  className,
  viewportClassName,
  contentClassName,
  children,
  ...props
}: ScrollBlurProps) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const [edges, setEdges] = React.useState<Edges>({
    top: false,
    bottom: false,
    left: false,
    right: false,
  });
  // True while content is resizing (only with hideEdgesWhileResizing).
  const [resizing, setResizing] = React.useState(false);
  const isVertical = axis === "vertical" || axis === "both";
  const isHorizontal = axis === "horizontal" || axis === "both";

  const isMask = edgeVariant === "mask";
  const maskAxis = axis === "horizontal" ? "horizontal" : "vertical";
  const showStart = (maskAxis === "vertical" ? edges.top : edges.left) && !resizing;
  const showEnd = (maskAxis === "vertical" ? edges.bottom : edges.right) && !resizing;
  // Fade lengths per edge (0 = crisp). Registered custom properties in
  // scroll-blur.css, so they transition; keyboard focus scrolls clear of them.
  const maskVars: Record<string, string> = {
    "--sb-fade-start": showStart ? `${edgeSize}px` : "0px",
    "--sb-fade-end": showEnd ? `${edgeSize}px` : "0px",
  };
  const maskStyle = {
    ...maskVars,
    ...(maskAxis === "vertical"
      ? { scrollPaddingBlock: edgeSize }
      : { scrollPaddingInline: edgeSize }),
  } as React.CSSProperties;

  const updateEdges = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    // Ignore subpixel / tiny overflow — otherwise the edge fade darkens the last row
    // when content barely fits (common after folder collapse animations).
    const overflowSlop = Math.max(8, Math.round(edgeSize * 0.35));
    const canScrollY =
      maxTop > overflowSlop && viewport.clientHeight > edgeSize * 1.5;
    const canScrollX =
      maxLeft > overflowSlop && viewport.clientWidth > edgeSize * 1.5;

    if (viewport.scrollTop > maxTop) {
      viewport.scrollTop = maxTop;
    }
    if (viewport.scrollLeft > maxLeft) {
      viewport.scrollLeft = maxLeft;
    }

    const next: Edges = {
      top: isVertical && (forceEdges || (canScrollY && viewport.scrollTop > 2)),
      bottom:
        isVertical &&
        (forceEdges || (canScrollY && viewport.scrollTop < maxTop - 2)),
      left: isHorizontal && (forceEdges || (canScrollX && viewport.scrollLeft > 2)),
      right:
        isHorizontal &&
        (forceEdges || (canScrollX && viewport.scrollLeft < maxLeft - 2)),
    };
    // Runs on every scroll event: only re-render when an edge actually flips.
    setEdges((prev) =>
      prev.top === next.top &&
      prev.bottom === next.bottom &&
      prev.left === next.left &&
      prev.right === next.right
        ? prev
        : next
    );
  }, [edgeSize, forceEdges, isHorizontal, isVertical]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    updateEdges();

    let settleTimer = 0;
    // The observer's initial callback isn't a resize — don't suppress on it.
    let primed = false;
    const primeFrame = window.requestAnimationFrame(() => {
      primed = true;
    });
    const onResize = () => {
      if (!hideEdgesWhileResizing || !primed) {
        updateEdges();
        return;
      }
      setResizing(true);
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        updateEdges();
        setResizing(false);
      }, RESIZE_SETTLE_MS);
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(viewport);
    const content = viewport.firstElementChild;
    if (content) {
      resizeObserver.observe(content);
    }

    viewport.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);

    return () => {
      window.cancelAnimationFrame(primeFrame);
      window.clearTimeout(settleTimer);
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [updateEdges, hideEdgesWhileResizing]);

  return (
    <div
      data-slot="scroll-blur"
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <div
        ref={viewportRef}
        data-slot="scroll-blur-viewport"
        data-edge-mask={isMask ? maskAxis : undefined}
        data-resizing={isMask && resizing ? "" : undefined}
        className={cn(
          "h-full w-full",
          hideScrollbar && "scrollbar-none",
          isVertical && "overflow-y-auto",
          isHorizontal && "overflow-x-auto",
          snap === "x" && "snap-x snap-mandatory",
          snap === "y" && "snap-y snap-mandatory",
          snap === "both" && "snap-both snap-mandatory",
          viewportClassName
        )}
        style={isMask ? maskStyle : undefined}
      >
        <div data-slot="scroll-blur-content" className={contentClassName}>
          {children}
        </div>
      </div>

      {isVertical ? (
        <>
          <ScrollBlurEdge
            visible={edges.top && !resizing}
            instant={resizing}
            side="top"
            size={edgeSize}
            reduceMotion={reduceMotion}
            variant={edgeVariant}
            className={edgeClassNames?.top}
          />
          <ScrollBlurEdge
            visible={edges.bottom && !resizing}
            instant={resizing}
            side="bottom"
            size={edgeSize}
            reduceMotion={reduceMotion}
            variant={edgeVariant}
            className={edgeClassNames?.bottom}
          />
        </>
      ) : null}
      {isHorizontal ? (
        <>
          <ScrollBlurEdge
            visible={edges.left && !resizing}
            instant={resizing}
            side="left"
            size={edgeSize}
            reduceMotion={reduceMotion}
            variant={edgeVariant}
            className={edgeClassNames?.left}
          />
          <ScrollBlurEdge
            visible={edges.right && !resizing}
            instant={resizing}
            side="right"
            size={edgeSize}
            reduceMotion={reduceMotion}
            variant={edgeVariant}
            className={edgeClassNames?.right}
          />
        </>
      ) : null}
    </div>
  );
}

export function ScrollSnapItem({
  align = "start",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  align?: ScrollSnapAlign;
}) {
  return (
    <div
      data-slot="scroll-snap-item"
      className={cn(
        align === "start" && "snap-start",
        align === "center" && "snap-center",
        align === "end" && "snap-end",
        className
      )}
      {...props}
    />
  );
}

function ScrollBlurEdge({
  visible,
  side,
  size,
  reduceMotion,
  variant,
  className,
  instant = false,
}: {
  visible: boolean;
  /** Hide without the fade (content is moving under it). */
  instant?: boolean;
  side: ScrollBlurSide;
  size: number;
  reduceMotion: boolean | null;
  variant: ScrollBlurEdgeVariant;
  className?: string;
}) {
  const isVertical = side === "top" || side === "bottom";
  const gradient =
    side === "top"
      ? "bg-linear-to-b"
      : side === "bottom"
        ? "bg-linear-to-t"
        : side === "left"
          ? "bg-linear-to-r"
          : "bg-linear-to-l";
  const mask =
    side === "top"
      ? "[mask-image:linear-gradient(to_bottom,black_0%,black_45%,transparent_100%)]"
      : side === "bottom"
        ? "[mask-image:linear-gradient(to_top,black_0%,black_45%,transparent_100%)]"
        : side === "left"
          ? "[mask-image:linear-gradient(to_right,black_0%,black_45%,transparent_100%)]"
          : "[mask-image:linear-gradient(to_left,black_0%,black_45%,transparent_100%)]";

  return (
    <motion.div
      data-slot="scroll-blur-edge"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-10",
        side === "top" && "inset-x-0 top-0",
        side === "bottom" && "inset-x-0 bottom-0",
        side === "left" && "inset-y-0 left-0",
        side === "right" && "inset-y-0 right-0",
        isVertical ? "w-full" : "h-full",
        variant === "mask" && "scroll-blur-edge--mask",
        className
      )}
      data-edge-side={variant === "mask" ? side : undefined}
      style={
        variant === "custom" ? undefined : isVertical ? { height: size } : { width: size }
      }
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: reduceMotion || instant ? 0 : 0.16 }}
    >
      {variant === "fade" ? (
        <>
          <div
            className={cn(
              "absolute inset-0 from-background via-background/75 to-transparent",
              gradient
            )}
          />
          <div className={cn("absolute inset-0 backdrop-blur-[4px]", mask)} />
        </>
      ) : null}
    </motion.div>
  );
}

export default ScrollBlur;
