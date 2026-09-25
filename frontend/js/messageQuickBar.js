// Message quick actions — an inline panel that unfolds inside the bubble itself
// (right-click / double-click), so it scrolls with the thread like any other content.

import { runOverlayAction } from '../ui/overlays/overlayManager.js';
import { copyText } from './chatActions.js';
import { buildLinkBar } from './messageLinkBar.js';
import { MORE_REACTIONS, QUICK_REACTIONS } from './messageReactions.js';

/** Keep in sync with `--quickbar-duration` in message-features.css. */
const ANIM_MS = 280;
/** Reactions visible in the open bubble before the strip needs scrolling. */
const PEEK_REACTIONS = 4.5;
/** Same spring as the sidebar folder tree's hover highlight (file-tree.tsx). */
const HOVER_SPRING = { type: 'spring', stiffness: 500, damping: 40 };

/** @type {{ key: string, row: HTMLElement, bubble: HTMLElement, panel: HTMLElement, closedWidth: number } | null} */
let open = null;
let listenersBound = false;
/** Unmount for each panel's React island (the menu, or the link row). */
const buttonRoots = new WeakMap();

/*
 * The Copy/Delete island pulls in React + motion. Loaded as its own chunk (shared
 * with the chat mount) so it stays out of the entry bundle; the request starts
 * right away, so it's normally ready well before the first right-click. The hover
 * highlight's `animate` comes from the same chunk (panels only build once it's in).
 */
let buttonsModule = null;
const buttonsModuleReady = import('../src/chat/quickbar/QuickBarButtons.tsx').then((mod) => {
    buttonsModule = mod;
    return mod;
});

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Copy stays in the bar (its "Copied!" swap is the feedback) instead of closing it. */
async function copyMessageText(payload) {
    try {
        await copyText(payload.text);
        return true;
    } catch {
        // Hand off to the app's copy action, which retries and reports the failure.
        runOverlayAction('message.copy', payload);
        return false;
    }
}

/** Collapse first so the bubble settles, then run the action (delete may remove the row). */
function pick(id, payload) {
    closeMessageQuickBar();
    runOverlayAction(id, payload);
}

/**
 * For actions that don't touch the row (Save): run once the collapse has
 * finished, so their side effects (a list re-render, a toast) never land on
 * the collapse's frames.
 */
function pickAfterClose(id, payload) {
    closeMessageQuickBar();
    window.setTimeout(() => runOverlayAction(id, payload), prefersReducedMotion() ? 0 : ANIM_MS);
}

/**
 * The in-bubble panel frame shared by every kind of panel. Outer grid animates
 * 0fr → 1fr so the bubble grows downward smoothly; the clip carries no spacing
 * of its own, so a collapsed panel takes exactly zero height.
 */
function createPanelShell({ role, label, modifier }) {
    const panel = document.createElement('div');
    panel.className = 'message-quickbar';

    const clip = document.createElement('div');
    clip.className = 'message-quickbar__clip';

    const body = document.createElement('div');
    body.className = modifier ? `message-quickbar__body ${modifier}` : 'message-quickbar__body';
    body.setAttribute('role', role);
    body.setAttribute('aria-label', label);

    clip.append(body);
    panel.append(clip);
    return { panel, body };
}

/**
 * Actions panel: the React menu (src/chat/quickbar/QuickBarMenu.tsx — the
 * TwentyThreeFour selector for Save and 🙂); this side owns the frame, the
 * bubble's open / close resize and the shared hover highlight.
 */
function buildActionsPanel(payload) {
    const { panel, body } = createPanelShell({ role: 'toolbar', label: 'Message actions' });
    const host = document.createElement('div');
    host.className = 'message-quickbar__menu-host';
    body.append(host);

    // Delete removes the message for both sides, so it stays limited to own messages.
    const canDelete = payload?.messageType === 'outgoing' && Boolean(payload?.messageId);
    const rest = [...QUICK_REACTIONS, ...MORE_REACTIONS];

    buttonRoots.set(panel, buttonsModule.mountQuickBarMenu(host, {
        canReply: Boolean(payload?.messageId),
        onReply: () => pick('message.reply', payload),
        canCopy: Boolean(payload?.text),
        onCopy: () => copyMessageText(payload),
        // The button's own Confirm step replaces the app's window.confirm here.
        onDelete: canDelete ? () => pick('message.delete', { ...payload, confirmed: true }) : undefined,
        canSave: Boolean(payload?.text),
        onSaveLocal: () => pickAfterClose('message.save', payload),
        // Reactions need a synced server id; until then there's no 🙂.
        reactions: payload.messageId
            ? {
                  current: payload.currentEmoji || null,
                  more: rest.filter((emoji, i) => rest.indexOf(emoji) === i && !['👍', '❤️', '😂', '😮', '🔥', '🚀'].includes(emoji)),
                  onPick: (emoji) => pick('reaction.pick', { messageId: payload.messageId, emoji }),
              }
            : undefined,
    }));

    attachHoverHighlight(body);
    return panel;
}

/** Hold-to-open warning for an external link, in the same bubble frame. */
function buildLinkPanel(href) {
    const { panel, body } = createPanelShell({
        role: 'group',
        label: 'External link',
        modifier: 'message-linkbar',
    });
    buttonRoots.set(panel, buildLinkBar(body, {
        href,
        close: closeMessageQuickBar,
        mountRow: buttonsModule.mountLinkWarningRow,
    }));
    // No shared hover pill here: the row has its own morphing backdrop and
    // selected-option highlight, and a second sliding layer under them would clash.
    return panel;
}

/**
 * One shared highlight that springs between buttons on hover / focus, fading in
 * on entry and out on leave — the sidebar folder tree's hover behaviour, in
 * vanilla DOM. Delegated, so reactions added by "+" are covered too.
 */
function attachHoverHighlight(body) {
    const pill = document.createElement('span');
    pill.className = 'message-quickbar__hover';
    pill.setAttribute('aria-hidden', 'true');
    body.prepend(pill);

    let target = null;
    let shown = false;

    // Layout box (offsets), not getBoundingClientRect: the buttons' hover scale is a
    // transform, and measuring through it made the pill jitter as they grew.
    const boundsOf = (btn) => {
        let { left, top } = offsetWithin(btn, body);
        let width = btn.offsetWidth;
        // Reactions scroll inside their strip: don't let the pill spill past its visible edges.
        const strip = btn.closest('.message-quickbar__reactions');
        if (strip) {
            const clipLeft = offsetWithin(strip, body).left;
            const clipRight = clipLeft + strip.clientWidth;
            const right = Math.min(left + width, clipRight);
            left = Math.max(left, clipLeft);
            width = Math.max(0, right - left);
        }
        return { left, top, width, height: btn.offsetHeight };
    };

    const moveTo = (btn) => {
        // Save / 🙂 have their own backdrop (hover tint) and, when open, their
        // own sliding selection — like the link row's Pause: stay out of both.
        // (Delete has no visible pill at rest, so it keeps the shared hover.)
        if (btn?.closest('.qb-select__bar, .qb-select__trigger:not(.qb-select__trigger--danger)')) {
            hide();
            return;
        }
        if (!btn || btn.disabled || btn === target) return;
        target = btn;
        pill.classList.toggle('is-danger', btn.classList.contains('is-danger'));
        const bounds = boundsOf(btn);
        const reduce = prefersReducedMotion();
        if (!shown) {
            // Appear in place (like AnimatePresence's initial), then only fade in.
            shown = true;
            buttonsModule.animate(pill, { ...bounds, opacity: 0 }, { duration: 0 });
            buttonsModule.animate(pill, { opacity: 1 }, reduce ? { duration: 0 } : HOVER_SPRING);
            return;
        }
        buttonsModule.animate(pill, bounds, reduce ? { duration: 0 } : HOVER_SPRING);
    };

    const hide = () => {
        if (!shown) return;
        shown = false;
        target = null;
        buttonsModule.animate(pill, { opacity: 0 }, prefersReducedMotion() ? { duration: 0 } : HOVER_SPRING);
    };

    body.addEventListener('pointerover', (event) => moveTo(event.target.closest('button')));
    body.addEventListener('pointerleave', hide);
    body.addEventListener('focusin', (event) => moveTo(event.target.closest('button')));
    body.addEventListener('focusout', (event) => {
        if (!body.contains(event.relatedTarget)) hide();
    });

    // Copy → "Copied!" and Delete → "Confirm ✕" animate their real width, so this
    // fires every frame of the resize: follow the hovered button (or reaction, which
    // shifts as the strip gives way), or fade out if it's gone.
    const follow = () => {
        if (!target) return;
        if (!target.isConnected) {
            hide();
            return;
        }
        buttonsModule.animate(pill, boundsOf(target), prefersReducedMotion() ? { duration: 0 } : HOVER_SPRING);
    };
    const actionsEl = body.querySelector('.message-quickbar__actions');
    if (actionsEl) {
        new ResizeObserver(follow).observe(actionsEl);
    }

    // Keep the pill glued to a hovered reaction while the strip scrolls under it.
    body.addEventListener('scroll', () => {
        if (target?.isConnected && target.closest('.message-quickbar__reactions')) {
            buttonsModule.animate(pill, boundsOf(target), { duration: 0 });
        }
    }, { capture: true, passive: true });
}

/** `el`'s layout position inside `ancestor` (a positioned ancestor), net of scrolling. */
function offsetWithin(el, ancestor) {
    let left = 0;
    let top = 0;
    let node = el;
    while (node && node !== ancestor) {
        left += node.offsetLeft;
        top += node.offsetTop;
        const parent = node.offsetParent;
        if (!parent) break;
        if (parent !== ancestor) {
            left += parent.clientLeft - parent.scrollLeft;
            top += parent.clientTop - parent.scrollTop;
        }
        node = parent;
    }
    return { left, top };
}

function removePanel(panel) {
    buttonRoots.get(panel)?.();
    buttonRoots.delete(panel);
    panel.remove();
}

/** Latest width animation per bubble — a stale timer must not undo a newer run. */
const widthRuns = new WeakMap();

/**
 * `width: max-content` can't be transitioned, so the bubble's width is pinned to
 * px on both ends and handed to CSS. With `keep` it stays pinned afterwards (open
 * state); otherwise it's released back to auto.
 */
function animateWidth(bubble, from, to, { keep = false } = {}) {
    const run = (widthRuns.get(bubble) || 0) + 1;
    widthRuns.set(bubble, run);

    const settle = () => {
        if (widthRuns.get(bubble) !== run) return;
        bubble.removeEventListener('transitionend', onEnd);
        bubble.classList.remove('is-quickbar-resizing');
        bubble.style.width = keep ? `${to}px` : '';
    };
    const onEnd = (event) => {
        if (event.target === bubble && event.propertyName === 'width') settle();
    };

    if (prefersReducedMotion() || Math.abs(from - to) < 1) {
        settle();
        return;
    }

    bubble.classList.remove('is-quickbar-resizing');
    bubble.style.width = `${from}px`;
    void bubble.offsetWidth;
    bubble.classList.add('is-quickbar-resizing');
    bubble.style.width = `${to}px`;

    bubble.addEventListener('transitionend', onEnd);
    // transitionend is skipped if the bubble is detached or the transition is interrupted.
    window.setTimeout(settle, ANIM_MS + 80);
}

/** Cancel any in-flight width animation and return the bubble to its natural width. */
function resetBubbleWidth(bubble) {
    widthRuns.set(bubble, (widthRuns.get(bubble) || 0) + 1);
    bubble.classList.remove('is-quickbar-resizing');
    bubble.style.width = '';
}

/**
 * Open width: room for the action buttons plus a peek of ~4.5 reactions (the cut
 * one hints the strip scrolls) — not the whole strip, which would stretch a short
 * message like "hi" across the thread. Never narrower than the message itself.
 */
function computeOpenWidth(bubble, panel, closedWidth) {
    const fullWidth = bubble.offsetWidth; // max-content with the panel, capped by max-width
    const strip = panel.querySelector('.message-quickbar__reactions');
    const reaction = strip?.querySelector('.message-quickbar__reaction');
    if (!strip || !reaction) return Math.max(closedWidth, fullWidth);

    const chrome = fullWidth - strip.clientWidth;
    const peek = Math.min(strip.scrollWidth, reaction.offsetWidth * PEEK_REACTIONS);
    return Math.max(closedWidth, Math.min(fullWidth, Math.ceil(chrome + peek)));
}

export function closeMessageQuickBar() {
    if (!open) return;
    const { row, bubble, panel, closedWidth } = open;
    open = null;

    if (!bubble.isConnected) return;

    const fromWidth = bubble.offsetWidth;
    row.classList.remove('has-quickbar');
    bubble.classList.remove('has-quickbar');
    panel.classList.remove('is-open');
    panel.setAttribute('inert', '');

    // Stay pinned at the natural width until the panel is gone: releasing to
    // max-content while the collapsed panel is still in the DOM would briefly
    // widen the bubble to the panel's full reactions strip.
    animateWidth(bubble, fromWidth, closedWidth, { keep: true });

    whenCollapsed(panel, () => {
        // Reopened on this bubble meanwhile: the open path already removed this panel.
        if (!panel.isConnected || open?.panel === panel) return;
        removePanel(panel);
        resetBubbleWidth(bubble);
        bubble.classList.remove('is-quickbar-layout');
        row.classList.remove('quick-bar-open');
    });
}

/** Run `done` once the panel's height collapse has finished. */
function whenCollapsed(panel, done) {
    if (prefersReducedMotion()) {
        done();
        return;
    }
    let called = false;
    const finish = () => {
        if (called) return;
        called = true;
        panel.removeEventListener('transitionend', onEnd);
        done();
    };
    const onEnd = (event) => {
        if (event.target === panel && event.propertyName === 'grid-template-rows') finish();
    };
    panel.addEventListener('transitionend', onEnd);
    // transitionend is skipped if the panel is detached or the transition is interrupted.
    window.setTimeout(finish, ANIM_MS + 80);
}

/**
 * @param {HTMLElement} row  `.message-row`
 * @param {Record<string, unknown>} payload  message context (see initMessageContextMenu)
 */
export function openMessageQuickBar(row, payload) {
    if (!payload) return;
    openBubblePanel(row, 'actions', () => buildActionsPanel(payload));
}

/** Inline external-link warning (replaces the old modal) under a message's text. */
export function openMessageLinkBar(row, href) {
    if (!href) return;
    // The link row resizes itself (its pause picker grows / shrinks), so the bubble
    // is left to follow its content instead of staying pinned at the open width.
    openBubblePanel(row, `link:${href}`, () => buildLinkPanel(href), { followContent: true });
}

/**
 * Unfold a panel inside the row's bubble. One panel per thread: opening another
 * (or a different kind on the same bubble) folds the current one first.
 */
function openBubblePanel(row, key, build, { followContent = false } = {}) {
    const bubble = row?.querySelector('.message-bubble');
    if (!bubble) return;
    if (open?.row === row && open.key === key && open.bubble.isConnected) return;

    // First open before the button chunk arrived: open once it has (if still relevant).
    // Every panel needs it — the hover highlight's `animate` lives there too.
    if (!buttonsModule) {
        buttonsModuleReady.then(() => {
            if (row.isConnected) openBubblePanel(row, key, build, { followContent });
        });
        return;
    }

    closeMessageQuickBar();
    bindGlobalListeners();

    // Reopened mid-collapse: drop the old panel and any half-finished resize first,
    // so the natural width below is measured cleanly.
    const stale = bubble.querySelector(':scope > .message-quickbar');
    if (stale) removePanel(stale);
    resetBubbleWidth(bubble);

    const closedWidth = bubble.offsetWidth;
    const panel = build();
    bubble.append(panel);
    // Text + time keep their natural width instead of spreading across the wider bubble.
    bubble.classList.add('is-quickbar-layout');
    const openWidth = computeOpenWidth(bubble, panel, closedWidth);

    open = { key, row, bubble, panel, closedWidth };

    // has-quickbar drives the animated open state (margin, radius) and is dropped as
    // the collapse starts; quick-bar-open lasts until the panel is fully gone.
    row.classList.add('has-quickbar', 'quick-bar-open');
    bubble.classList.add('has-quickbar');
    animateWidth(bubble, closedWidth, openWidth, { keep: !followContent });
    void panel.offsetWidth;
    panel.classList.add('is-open');

    // Once unfolded, make sure the panel isn't hidden under the composer.
    window.setTimeout(() => {
        if (open?.panel === panel) {
            panel.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        }
    }, prefersReducedMotion() ? 0 : ANIM_MS);
}

export function isMessageQuickBarTarget(target) {
    return Boolean(target?.closest?.('.message-quickbar'));
}

function bindGlobalListeners() {
    if (listenersBound) return;
    listenersBound = true;

    // Any press outside the open bubble folds it back — including the empty part
    // of its own row around a short bubble.
    document.addEventListener('pointerdown', (event) => {
        if (!open) return;
        if (open.bubble.contains(event.target)) return;
        closeMessageQuickBar();
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && open) closeMessageQuickBar();
    });
}
