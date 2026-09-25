// Sliding hover highlight for vanilla lists — the same interaction as the left
// aside (chat rows, folder tree, Inbox: a motion spring, stiffness 500 /
// damping 40). One highlight element per container glides to the hovered /
// keyboard-focused item, fades in where the pointer enters and fades out
// when it leaves. The spring is baked into a CSS linear() easing
// (--hover-hl-spring, public/css/themes.css), so no animation library loads.
//
// Modes: 'under' sits beneath transparent rows (a fill); 'ring' floats above
// opaque cards / chips (an outline), since a fill under them wouldn't show.

const SHOW_CLASS = 'is-visible';

/**
 * @param {HTMLElement | null} container  positioned ancestor of the items (null → no-op)
 * @param {string} itemSelector    items the highlight follows
 * @param {{ mode?: 'under' | 'ring', className?: string }} [options]
 * @returns {() => void} detach
 */
export function attachHoverHighlight(container, itemSelector, { mode = 'under', className = '' } = {}) {
    if (!container || container.dataset.hoverHighlight) return () => {};
    container.dataset.hoverHighlight = mode;

    const hl = document.createElement('span');
    hl.className = `hover-hl hover-hl--${mode}${className ? ` ${className}` : ''}`;
    hl.setAttribute('aria-hidden', 'true');
    container.append(hl);

    let current = null;

    const place = (item, instant) => {
        const box = container.getBoundingClientRect();
        const r = item.getBoundingClientRect();
        const x = r.left - box.left - container.clientLeft + container.scrollLeft;
        const y = r.top - box.top - container.clientTop + container.scrollTop;
        hl.style.setProperty('--hl-radius', getComputedStyle(item).borderRadius);
        if (instant) hl.classList.add('is-instant');
        hl.style.transform = `translate(${x}px, ${y}px)`;
        hl.style.width = `${r.width}px`;
        hl.style.height = `${r.height}px`;
        if (instant) {
            void hl.offsetWidth; // commit the jump before re-enabling the glide
            hl.classList.remove('is-instant');
        }
    };

    const show = (item) => {
        if (!item || item === current) return;
        // Entering from outside: appear in place; between items: glide.
        place(item, !hl.classList.contains(SHOW_CLASS));
        current = item;
        hl.classList.add(SHOW_CLASS);
    };

    const hide = () => {
        current = null;
        hl.classList.remove(SHOW_CLASS);
    };

    const itemFrom = (target) => {
        const item = target instanceof Element ? target.closest(itemSelector) : null;
        return item && container.contains(item) && !item.disabled ? item : null;
    };

    const onOver = (event) => {
        if (event.pointerType && event.pointerType !== 'mouse') return;
        const item = itemFrom(event.target);
        if (item) show(item);
    };
    const onLeave = () => hide();
    const onFocusIn = (event) => {
        const item = itemFrom(event.target);
        if (item && item.matches(':focus-visible')) show(item);
    };
    const onFocusOut = (event) => {
        if (!container.contains(event.relatedTarget)) hide();
    };

    container.addEventListener('pointerover', onOver);
    container.addEventListener('pointerleave', onLeave);
    container.addEventListener('focusin', onFocusIn);
    container.addEventListener('focusout', onFocusOut);

    return () => {
        container.removeEventListener('pointerover', onOver);
        container.removeEventListener('pointerleave', onLeave);
        container.removeEventListener('focusin', onFocusIn);
        container.removeEventListener('focusout', onFocusOut);
        hl.remove();
        delete container.dataset.hoverHighlight;
    };
}
