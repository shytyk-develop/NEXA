// Viewport-safe fixed positioning (visualViewport-aware).

const DEFAULT_PAD = 8;
const DEFAULT_GAP = 6;

/**
 * @param {DOMRectReadOnly|{top:number,left:number,right:number,bottom:number,width:number,height:number}} [anchorRect]
 * @param {{x:number,y:number}} [pointer]
 * @param {{ width: number, height: number }} menuSize
 * @param {{ pad?: number, gap?: number, prefer?: 'above'|'below', align?: 'start'|'center'|'end', minY?: number, maxY?: number }} [opts]
 */
export function computeOverlayPosition(anchorRect, pointer, menuSize, opts = {}) {
    const pad = opts.pad ?? DEFAULT_PAD;
    const gap = opts.gap ?? DEFAULT_GAP;
    const align = opts.align || 'start';
    const menuW = Math.max(menuSize.width, 1);
    const menuH = Math.max(menuSize.height, 1);

    const vv = window.visualViewport;
    const offsetLeft = vv?.offsetLeft ?? 0;
    const offsetTop = vv?.offsetTop ?? 0;
    const vw = vv?.width ?? window.innerWidth;
    const vh = vv?.height ?? window.innerHeight;
    const maxX = offsetLeft + vw - pad;
    const minX = offsetLeft + pad;
    let minY = offsetTop + pad;
    let maxY = offsetTop + vh - pad;
    if (Number.isFinite(opts.minY)) minY = Math.max(minY, opts.minY);
    if (Number.isFinite(opts.maxY)) maxY = Math.min(maxY, opts.maxY);
    if (minY > maxY - 1) {
        minY = offsetTop + pad;
        maxY = offsetTop + vh - pad;
    }

    let x = minX;
    let y = minY;
    let flipX = false;
    let flipY = false;
    let placement = 'default';

    if (anchorRect) {
        const prefer = opts.prefer === 'above' ? 'above' : 'below';
        const belowY = anchorRect.bottom + gap;
        const aboveY = anchorRect.top - menuH - gap;
        const fitsBelow = belowY + menuH <= maxY;
        const fitsAbove = aboveY >= minY;

        if (prefer === 'above') {
            if (fitsAbove) {
                y = aboveY;
                flipY = true;
                placement = 'above';
            } else if (fitsBelow) {
                y = belowY;
                placement = 'below';
            } else {
                y = clamp(aboveY, minY, maxY - menuH);
                flipY = true;
                placement = 'above-clamped';
            }
        } else if (fitsBelow) {
            y = belowY;
            placement = 'below';
        } else if (fitsAbove) {
            y = aboveY;
            flipY = true;
            placement = 'above';
        } else {
            y = clamp(belowY, minY, maxY - menuH);
            placement = 'below-clamped';
        }

        if (align === 'center') {
            x = anchorRect.left + (anchorRect.width - menuW) / 2;
        } else if (align === 'end') {
            x = anchorRect.right - menuW;
        } else {
            x = anchorRect.left;
        }
        if (x + menuW > maxX) {
            x = anchorRect.right - menuW;
            flipX = true;
        }
    } else if (pointer) {
        x = pointer.x;
        y = pointer.y;
        placement = 'pointer';

        if (y + menuH > maxY && pointer.y - menuH - gap >= minY) {
            y = pointer.y - menuH - gap;
            flipY = true;
        }
        if (x + menuW > maxX && pointer.x - menuW >= minX) {
            x = pointer.x - menuW;
            flipX = true;
        }
    }

    x = clamp(x, minX, maxX - menuW);
    y = clamp(y, minY, maxY - menuH);

    return Object.freeze({
        x: Math.round(x),
        y: Math.round(y),
        flipX,
        flipY,
        align,
        placement,
        viewport: Object.freeze({
            offsetLeft,
            offsetTop,
            width: vw,
            height: vh,
            scale: vv?.scale ?? 1,
        }),
    });
}

export function applyOverlayPosition(el, result, { isModal = false } = {}) {
    if (isModal) {
        el.style.left = '50%';
        el.style.top = '50%';
        el.style.transformOrigin = 'center center';
        return;
    }

    el.style.left = `${result.x}px`;
    el.style.top = `${result.y}px`;

    const xOrigin = result.align === 'center' ? 'center' : result.flipX ? 'right' : 'left';
    const yOrigin = result.flipY ? 'bottom' : 'top';
    el.style.transformOrigin = `${xOrigin} ${yOrigin}`;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}
