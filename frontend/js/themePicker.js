// Appearance → Theme: one card per registered theme, each with a mini preview
// in the theme's own colours. Clicking applies it via the theme engine
// (public/js/themes.js); the active card follows engine changes. The Chat
// preview below is painted in the active theme, or in the theme under the
// pointer / keyboard focus while browsing.

import { getActiveTheme, getThemes, onThemeChange, setThemeAnimated } from './themeManager.js';
import { createIcon } from './uiIcon.js';

let host = null;
let preview = null;
let previewName = null;
/** Theme shown in the preview while a card is hovered / focused (else the active one). */
let browsing = null;
/** Pending revert to the active theme (see leave in buildCard). */
let revertTimer = 0;
/**
 * Leaving a card waits this long before the preview heads back to the active
 * theme: moving across the gap to the next card then goes straight from one
 * hovered theme to the other instead of dipping through the active one.
 */
const REVERT_DELAY = 120;

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
    Object.entries(vars).forEach(([key, value]) => preview.style.setProperty(key, value || ''));
    preview.dataset.themeType = theme.type;
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
    paintPreview(browsing || activeTheme());
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

    // Mini preview: page bg · a section panel · an incoming + an outgoing bubble.
    const preview = document.createElement('span');
    preview.className = 'theme-card__preview';
    preview.setAttribute('aria-hidden', 'true');
    preview.style.background = c['--bg-main'];
    preview.style.borderColor = c['--border-subtle'];

    const panel = document.createElement('span');
    panel.className = 'theme-card__panel';
    panel.style.background = c['--bg-section'];
    panel.style.borderColor = c['--border-subtle'];
    const bubbleIn = document.createElement('span');
    bubbleIn.className = 'theme-card__bubble theme-card__bubble--in';
    bubbleIn.style.background = c['--bg-section'];
    bubbleIn.style.borderColor = c['--border-subtle'];
    const bubbleOut = document.createElement('span');
    bubbleOut.className = 'theme-card__bubble theme-card__bubble--out';
    bubbleOut.style.background = c['--accent-secondary'];
    const dot = document.createElement('span');
    dot.className = 'theme-card__accent';
    dot.style.background = c['--accent-primary'];
    preview.append(panel, bubbleIn, bubbleOut, dot);

    // Palette swatches: bg-main, bg-section, accent-primary, accent-secondary.
    const swatches = document.createElement('span');
    swatches.className = 'theme-card__swatches';
    swatches.setAttribute('aria-hidden', 'true');
    ['--bg-main', '--bg-section', '--accent-primary', '--accent-secondary'].forEach((key) => {
        const sw = document.createElement('span');
        sw.className = 'theme-card__swatch';
        sw.style.background = c[key];
        sw.title = `${key.slice(2)} ${c[key]}`;
        swatches.append(sw);
    });

    const meta = document.createElement('span');
    meta.className = 'theme-card__meta';
    const name = document.createElement('span');
    name.className = 'theme-card__name';
    name.textContent = theme.name;
    const type = document.createElement('span');
    type.className = 'theme-card__type';
    type.textContent = theme.type === 'dark' ? 'Dark' : 'Light';
    meta.append(name, type);

    const check = document.createElement('span');
    check.className = 'theme-card__check';
    check.setAttribute('aria-hidden', 'true');
    check.append(createIcon('icon-check-circle'));

    card.append(preview, meta, swatches, check);
    card.addEventListener('click', () => {
        setThemeAnimated(theme.id).catch((error) => console.error('Theme switch failed:', error));
    });

    // Browsing: the preview follows the hovered / focused card, then eases
    // back to the active theme (the CSS cross-fades every --pv-* change).
    const browse = () => {
        window.clearTimeout(revertTimer);
        if (browsing?.id === theme.id) return;
        browsing = theme;
        repaint();
    };
    const leave = () => {
        if (browsing?.id !== theme.id) return;
        window.clearTimeout(revertTimer);
        revertTimer = window.setTimeout(() => {
            browsing = null;
            repaint();
        }, REVERT_DELAY);
    };
    card.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'mouse') browse();
    });
    card.addEventListener('pointerleave', leave);
    card.addEventListener('focus', () => {
        if (card.matches(':focus-visible')) browse();
    });
    card.addEventListener('blur', leave);
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
