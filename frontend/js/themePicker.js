// Appearance → Theme: one card per registered theme, each with a mini preview
// in the theme's own colours. Clicking applies it via the theme engine
// (public/js/themes.js); the active card follows engine changes. The Chat
// preview below is painted in the active theme, or in the theme under the
// pointer / keyboard focus while browsing.

import { getActiveTheme, getThemes, onThemeChange, setThemeAnimated } from './themeManager.js';

let host = null;
let preview = null;
let previewName = null;
/** Theme shown in the preview while a card is hovered / focused (else the active one). */
let browsing = null;
/** Pending revert to the active theme (see scheduleRevert). */
let revertTimer = 0;
/** Pending repaint frame: bursts of hover events collapse into one repaint. */
let repaintFrame = 0;
/**
 * Leaving the card grid waits this long before the preview heads back to the
 * active theme, so brushing past the grid's edge doesn't flash it.
 */
const REVERT_DELAY = 160;

/** Relative luminance of a #rrggbb colour (0–1). */
function luminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return 0;
    const n = parseInt(m[1], 16);
    const lin = (v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

/** Paint the Chat preview in a theme's colours (same mapping as the engine). */
function paintPreview(theme) {
    if (!preview || !theme) return;
    const c = theme.colors;
    const vars = {
        '--pv-bg': c['--bg-main'],
        '--pv-section': c['--bg-section'],
        '--pv-card': c['--card-bg'],
        '--pv-card-shadow': c['--card-shadow'],
        '--pv-border': c['--border-subtle'],
        '--pv-hover': c['--hover-bg'],
        '--pv-text': c['--text-primary'],
        '--pv-muted': c['--text-secondary'],
        '--pv-accent': c['--accent-primary'],
        '--pv-own': c['--accent-secondary'],
        '--pv-own-text': luminance(c['--accent-secondary']) > 0.4 ? c['--text-primary'] : '#ffffff',
        '--pv-pill': c['--active-pill-bg'],
        '--pv-pill-text': c['--active-pill-text'],
        '--pv-on-accent': c['--text-on-accent'],
    };
    // Only touch vars whose value changes: rewriting an unchanged one is a
    // no-op for the cascade, but skipping it keeps in-flight transitions intact.
    Object.entries(vars).forEach(([key, value]) => {
        const next = value || '';
        if (preview.style.getPropertyValue(key) !== next) preview.style.setProperty(key, next);
    });
    preview.dataset.themeType = theme.type;
    // The card's "Active theme" pill reads "Previewing" while another theme is shown.
    preview.closest('.appearance-card')?.classList.toggle('is-browsing', theme.id !== activeTheme()?.id);
    if (previewName) previewName.textContent = theme.name;
}

function activeTheme() {
    try {
        return getActiveTheme();
    } catch {
        return null;
    }
}

function repaint() {
    window.cancelAnimationFrame(repaintFrame);
    repaintFrame = 0;
    paintPreview(browsing || activeTheme());
}

/**
 * Repaint on the next frame. A fast sweep (Light Emerald → Light Lime → Dark
 * Neon) fires several enter events per frame; only the last target is painted,
 * and the CSS transitions retarget from the colours currently on screen.
 */
function queueRepaint() {
    if (repaintFrame) return;
    repaintFrame = window.requestAnimationFrame(repaint);
}

function browse(theme) {
    window.clearTimeout(revertTimer);
    if (browsing?.id === theme.id) return;
    browsing = theme;
    queueRepaint();
}

function scheduleRevert() {
    window.clearTimeout(revertTimer);
    revertTimer = window.setTimeout(() => {
        if (!browsing) return;
        browsing = null;
        queueRepaint();
    }, REVERT_DELAY);
}


function el(tag, className, style = {}) {
    const node = document.createElement(tag);
    node.className = className;
    Object.assign(node.style, style);
    return node;
}

function buildCard(theme) {
    const c = theme.colors;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'theme-card';
    card.dataset.themeId = theme.id;
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', 'false');
    card.setAttribute('aria-label', `${theme.name} theme`);

    // Mini window: page bg · a sidebar panel (accent pill + two lines) · an
    // incoming, an outgoing and another incoming bubble.
    const preview = el('span', 'theme-card__preview', { background: c['--bg-main'], borderColor: c['--border-subtle'] });
    preview.setAttribute('aria-hidden', 'true');
    const panel = el('span', 'theme-card__panel', { background: c['--bg-section'], borderColor: c['--border-subtle'] });
    panel.append(
        el('span', 'theme-card__accent', { background: c['--accent-primary'] }),
        el('span', 'theme-card__line', { background: c['--text-secondary'] }),
        el('span', 'theme-card__line theme-card__line--short', { background: c['--text-secondary'] }),
    );
    const bubble = (side) => el('span', `theme-card__bubble theme-card__bubble--${side}`, side === 'out'
        ? { background: c['--accent-secondary'] }
        : { background: c['--bg-section'], borderColor: c['--border-subtle'] });
    preview.append(panel, bubble('in'), bubble('out'), bubble('in2'));

    // Palette swatches: bg-main, bg-section, accent-primary, accent-secondary.
    const swatches = el('span', 'theme-card__swatches');
    swatches.setAttribute('aria-hidden', 'true');
    ['--bg-main', '--bg-section', '--accent-primary', '--accent-secondary'].forEach((key) => {
        const sw = el('span', 'theme-card__swatch', { background: c[key] });
        sw.title = `${key.slice(2)} ${c[key]}`;
        swatches.append(sw);
    });

    const meta = el('span', 'theme-card__meta');
    const name = el('span', 'theme-card__name');
    name.textContent = theme.name;
    const type = el('span', 'theme-card__type');
    type.textContent = theme.type === 'dark' ? 'Dark' : 'Light';
    meta.append(name, type);

    const body = el('span', 'theme-card__body');
    body.append(meta, swatches);

    // Radio: an empty ring, filled with the accent + a check when active.
    const radio = el('span', 'theme-card__radio');
    radio.setAttribute('aria-hidden', 'true');
    radio.innerHTML = '<svg viewBox="0 0 16 16"><path d="m4 8.2 2.6 2.6L12 5.4"/></svg>';

    card.append(preview, body, radio);
    card.addEventListener('click', () => {
        setThemeAnimated(theme.id).catch((error) => console.error('Theme switch failed:', error));
    });

    // Browsing: the preview follows the hovered / focused card (the CSS
    // cross-fades every --pv-* change). Leaving a card doesn't revert — only
    // leaving the whole grid does (see initThemePicker), so crossing the gap
    // between cards goes straight from one theme to the next.
    card.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'mouse') browse(theme);
    });
    card.addEventListener('focus', () => {
        if (card.matches(':focus-visible')) browse(theme);
    });
    card.addEventListener('blur', (event) => {
        if (!host?.contains(event.relatedTarget)) scheduleRevert();
    });
    return card;
}

function cards() {
    return host ? [...host.querySelectorAll('.theme-card')] : [];
}

/** Mark the active card (roving tabindex follows it) and repaint the preview. */
export function syncThemePicker() {
    if (!host) return;
    const activeId = activeTheme()?.id || '';
    cards().forEach((card) => {
        const on = card.dataset.themeId === activeId;
        card.setAttribute('aria-checked', String(on));
        card.classList.toggle('is-active', on);
        card.tabIndex = on ? 0 : -1;
    });
    repaint();
}

/**
 * Render the cards into `el` (once) and keep them in sync with the engine.
 * `previewEl` (optional) is the Chat preview to paint; `nameEl` shows its theme name.
 */
export function initThemePicker(el, previewEl = null, nameEl = null) {
    if (!el || host) return;
    host = el;
    preview = previewEl;
    previewName = nameEl;
    let themes = [];
    try {
        themes = getThemes();
    } catch (error) {
        console.error('Theme engine unavailable:', error);
        return;
    }
    host.replaceChildren(...themes.map(buildCard));
    host.addEventListener('pointerleave', (event) => {
        if (event.pointerType === 'mouse') scheduleRevert();
    });

    // Arrow keys move between cards and apply, like a native radio group.
    host.addEventListener('keydown', (event) => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (!(event.key in keys)) return;
        event.preventDefault();
        const list = cards();
        const index = list.indexOf(document.activeElement);
        const next = list[(index + keys[event.key] + list.length) % list.length];
        next?.click();
        next?.focus();
    });

    onThemeChange(syncThemePicker);
    syncThemePicker();
}
