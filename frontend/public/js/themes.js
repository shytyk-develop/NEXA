/*
 * NEXA theme engine — registry + CSS-variable injection + persistence.
 *
 * Loaded as a classic, render-blocking script at the top of <head> (index.html),
 * so the saved theme is applied before first paint — no flash of the default
 * look. App code (ES modules) uses it through js/themeManager.js, or directly
 * via window.NexaThemes.
 *
 * A theme = { id, name, type: 'light' | 'dark', colors: { '--bg-main': …, … } }.
 * Its colors become CSS variables under html[data-theme="<id>"], and are also
 * mapped onto the app's existing design tokens (--bg, --text, --nexa-aside-fill,
 * bubble fills, …) so the current UI follows the theme. A theme is always
 * active: with nothing saved, DEFAULT_THEME_ID applies.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'nexa_theme_id';
    var STYLE_ID = 'nexa-theme-vars';
    var CHANGE_EVENT = 'nexa:themechange';
    /** Applied when nothing (or an unknown id) is saved, and by setTheme(null). */
    var DEFAULT_THEME_ID = 'dark-neon';

    /** Every theme must define these. */
    var REQUIRED_COLORS = [
        '--bg-main',
        '--bg-section',
        '--border-subtle',
        '--accent-primary',
        '--accent-secondary',
        '--text-primary',
        '--text-secondary',
        '--text-on-accent',
        '--card-bg',
        '--card-shadow',
        '--hover-bg',
        '--active-pill-bg',
        '--active-pill-text',
    ];

    var BUILT_IN_THEMES = [
        {
            // Tasko style.
            id: 'light-emerald',
            name: 'Light Emerald',
            type: 'light',
            colors: {
                '--bg-main': '#F6F7F3',
                '--bg-section': '#FFFFFF',
                '--card-bg': '#FFFFFF',
                '--border-subtle': '#E6E8E1',
                '--card-shadow': '0 2px 12px rgba(0, 0, 0, 0.03)',
                '--hover-bg': '#EFF1EB',
                '--accent-primary': '#005218',
                '--accent-secondary': '#2BAE6C',
                '--active-pill-bg': '#005218',
                '--active-pill-text': '#FFFFFF',
                '--text-primary': '#191B13',
                '--text-secondary': '#5D6153',
                '--text-on-accent': '#FFFFFF',
                '--color-danger': '#D34B37',
                '--text-danger': '#D34B37',
            },
        },
        {
            // Aether Light style.
            id: 'light-lime',
            name: 'Light Lime',
            type: 'light',
            colors: {
                '--bg-main': '#F9F9F9',
                '--bg-section': '#FFFFFF',
                '--card-bg': '#FFFFFF',
                '--border-subtle': '#EDEDED',
                '--card-shadow': '0 2px 10px rgba(0, 0, 0, 0.025)',
                '--hover-bg': '#F0F0F0',
                '--accent-primary': '#8DC400',
                '--accent-secondary': '#E9F4CF',
                '--active-pill-bg': '#8DC400',
                '--active-pill-text': '#191B13',
                '--text-primary': '#191B13',
                '--text-secondary': '#5D6153',
                '--text-on-accent': '#191B13',
                '--color-danger': '#D34B37',
                '--text-danger': '#D34B37',
            },
        },
        {
            // Aether Dark style.
            id: 'dark-neon',
            name: 'Dark Neon',
            type: 'dark',
            colors: {
                '--bg-main': '#070707',
                '--bg-section': '#0A0A0A',
                '--card-bg': '#121212',
                '--border-subtle': '#1C1C1C',
                '--card-shadow': 'none',
                '--hover-bg': '#161616',
                '--accent-primary': '#C7FF00',
                '--accent-secondary': '#303C08',
                '--active-pill-bg': '#C7FF00',
                '--active-pill-text': '#191B13',
                '--text-primary': '#FFFFFF',
                '--text-secondary': '#737373',
                '--text-on-accent': '#070707',
                '--color-danger': '#F62834',
                '--text-danger': '#F62834',
            },
        },
    ];

    /** id → theme (insertion order = display order). */
    var registry = new Map();
    var activeId = null;

    // ── helpers ────────────────────────────────────────────────────────────────

    function clone(theme) {
        var colors = {};
        Object.keys(theme.colors).forEach(function (key) {
            colors[key] = theme.colors[key];
        });
        return { id: theme.id, name: theme.name, type: theme.type, colors: colors };
    }

    function readStorage() {
        try {
            return window.localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            return null;
        }
    }

    function writeStorage(id) {
        try {
            if (id) window.localStorage.setItem(STORAGE_KEY, id);
            else window.localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            /* storage unavailable — the theme just won't persist */
        }
    }

    /** Relative luminance of a #rgb / #rrggbb colour (0 = black, 1 = white). */
    function luminance(hex) {
        var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
        if (!m) return 0;
        var h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
        var channels = [0, 2, 4].map(function (i) {
            var c = parseInt(h.slice(i, i + 2), 16) / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }

    /** Text on own (accent-secondary) bubbles: whichever of white / text-primary reads. */
    function ownBubbleText(colors) {
        return luminance(colors['--accent-secondary']) > 0.4 ? colors['--text-primary'] : '#FFFFFF';
    }

    function validate(theme) {
        if (!theme || typeof theme !== 'object') throw new TypeError('Theme must be an object.');
        if (!theme.id || typeof theme.id !== 'string' || !/^[a-z0-9-]+$/i.test(theme.id)) {
            throw new TypeError('Theme id must be a non-empty string of letters, digits and dashes.');
        }
        if (!theme.name || typeof theme.name !== 'string') throw new TypeError('Theme "' + theme.id + '" needs a name.');
        if (theme.type !== 'light' && theme.type !== 'dark') {
            throw new TypeError('Theme "' + theme.id + '" type must be "light" or "dark".');
        }
        var colors = theme.colors || {};
        REQUIRED_COLORS.forEach(function (key) {
            if (typeof colors[key] !== 'string' || !colors[key].trim()) {
                throw new TypeError('Theme "' + theme.id + '" is missing colour ' + key + '.');
            }
        });
    }

    /**
     * CSS for one theme: its own variables plus the mapping onto existing app
     * tokens. Scoped to html[data-theme] and html[data-theme] #page-chat so it
     * outranks tokens the app sets on #page-chat (incl. wallpaper packs).
     */
    function cssFor(theme) {
        var c = theme.colors;
        var dark = theme.type === 'dark';
        var tertiary = 'color-mix(in srgb, ' + c['--text-secondary'] + ' 72%, ' + c['--bg-main'] + ')';
        var vars = {};

        Object.keys(c).forEach(function (key) {
            vars[key] = c[key];
        });

        // Roles the stylesheets were tokenised to (var(--theme-*, <original>)):
        // unset by default, so without a theme every literal falls back unchanged.
        vars['--theme-bg'] = c['--bg-main'];
        vars['--theme-section'] = c['--bg-section'];
        vars['--theme-text'] = c['--text-primary'];
        vars['--theme-text-muted'] = c['--text-secondary'];
        vars['--theme-border'] = c['--border-subtle'];
        // Hover tints / hairlines / highlights: dark on light themes, light on dark.
        vars['--theme-tint'] = c['--text-primary'];
        // Component roles (public/css/themes.css).
        vars['--theme-card'] = c['--card-bg'];
        vars['--theme-card-shadow'] = c['--card-shadow'];
        // Floating chat chrome (header capsules, composer): barely-there lift on
        // light themes; dark keeps a deep drop that reads as depth on black.
        vars['--chrome-shadow'] = c['--chrome-shadow'] || (dark ? '0 10px 28px rgba(0, 0, 0, 0.42)' : '0 4px 16px rgba(0, 0, 0, 0.035)');
        // Glass surfaces (paste folder …): a faint white veil on dark; on light a
        // milky white pane with a hairline and soft shadow — never a dark tint,
        // which reads as dirty grey on a light page. --glass-flap / --glass-edge
        // feed the SVG flap's gradient stops (drawn at partial opacity).
        // Each glass colour carries a light wash of the theme accent, so the
        // folder reads green on Emerald, lime on Lime and neon-tinted on Neon.
        var acc = c['--accent-primary'];
        var tint = function (pct, base) { return 'color-mix(in srgb, ' + acc + ' ' + pct + '%, ' + base + ')'; };
        vars['--glass-fill'] = dark ? tint(6, 'rgba(255, 255, 255, 0.05)') : tint(7, 'rgba(255, 255, 255, 0.7)');
        vars['--glass-stroke'] = dark ? tint(18, 'rgba(255, 255, 255, 0.12)') : tint(22, c['--border-subtle']);
        vars['--glass-shadow'] = dark ? 'none' : '0 4px 16px ' + tint(10, 'rgba(0, 0, 0, 0.04)');
        vars['--glass-blur'] = dark ? '12px' : '8px';
        vars['--glass-flap-start'] = dark ? tint(12, '#2A2A2A') : tint(10, '#FFFFFF');
        vars['--glass-flap-end'] = dark ? tint(6, c['--card-bg']) : tint(16, c['--hover-bg']);
        vars['--glass-edge'] = dark ? tint(35, '#FFFFFF') : tint(40, c['--text-primary']);
        // Sheets inside the folder are paper-white on every theme (dark text).
        vars['--glass-sheet'] = '#FFFFFF';
        vars['--glass-sheet-text'] = dark ? '#191B13' : c['--text-primary'];
        vars['--glass-sheet-muted'] = dark ? '#5D6153' : c['--text-secondary'];
        vars['--glass-sheet-border'] = dark ? 'rgba(255, 255, 255, 0.2)' : c['--border-subtle'];
        vars['--glass-line'] = tint(16, dark ? '#EFF1EB' : c['--hover-bg']);
        vars['--theme-hover'] = c['--hover-bg'];
        vars['--theme-pill'] = c['--active-pill-bg'];
        vars['--theme-pill-text'] = c['--active-pill-text'];

        // Canvas / stage.
        vars['--bg'] = c['--bg-main'];
        vars['--nexa-void'] = c['--bg-main'];
        vars['--nexa-surface'] = c['--bg-section'];
        vars['--chat-stage-fill'] = c['--bg-main'];
        vars['--chat-wallpaper'] = c['--bg-main'];
        vars['--wallpaper-dim'] = '0%';
        // Sections (sidebar, composer, cards): bg-section + border-subtle.
        vars['--nexa-aside-fill'] = c['--bg-section'];
        // Composer, settings cards + fields, overlays: card surface.
        vars['--composer-shell-bg'] = c['--card-bg'];
        vars['--overlay-bg'] = c['--card-bg'];
        vars['--overlay-border'] = c['--border-subtle'];
        vars['--surface'] = c['--bg-section'];
        vars['--card'] = c['--bg-section'];
        vars['--settings-capsule-bg'] = c['--card-bg'];
        vars['--settings-inner-fill'] = c['--card-bg'];
        // Profile page's own tokens (declared on .profile-identity-layout / .ps-header).
        vars['--ps-card-bg'] = c['--card-bg'];
        vars['--ps-field-bg'] = c['--card-bg'];
        vars['--ps-line'] = c['--border-subtle'];
        vars['--ps-banner-base'] = c['--card-bg'];
        vars['--composer-glass'] = c['--bg-section'];
        vars['--panel-glass'] = c['--bg-section'];
        vars['--control-glass'] = c['--bg-section'];
        vars['--spotlight-glass'] = c['--bg-section'];
        vars['--glass'] = c['--bg-section'];
        vars['--surface-elevated'] = c['--bg-section'];
        vars['--dock-surface'] = c['--bg-section'];
        vars['--hover'] = c['--hover-bg'];
        vars['--nexa-aside-stroke'] = c['--border-subtle'];
        vars['--composer-glass-stroke'] = c['--border-subtle'];
        vars['--panel-glass-stroke'] = c['--border-subtle'];
        vars['--control-glass-stroke'] = c['--border-subtle'];
        vars['--spotlight-glass-stroke'] = c['--border-subtle'];
        vars['--dock-stroke'] = c['--border-subtle'];
        vars['--glass-border'] = c['--border-subtle'];
        vars['--border-strong'] = c['--border-subtle'];
        vars['--b1'] = c['--border-subtle'];
        vars['--b2'] = c['--border-subtle'];
        vars['--capsule-stroke'] = c['--border-subtle'];
        vars['--capsule-stroke-strong'] = c['--border-subtle'];
        vars['--settings-capsule-stroke'] = c['--border-subtle'];
        vars['--settings-inner-stroke'] = c['--border-subtle'];
        vars['--border'] = c['--border-subtle'];
        // Text.
        vars['--text'] = c['--text-primary'];
        vars['--text-tertiary'] = tertiary;
        vars['--t1'] = c['--text-primary'];
        vars['--t2'] = c['--text-secondary'];
        vars['--t3'] = tertiary;
        vars['--spotlight-ink'] = c['--text-primary'];
        vars['--spotlight-muted'] = c['--text-secondary'];
        // Destructive / error red (optional per theme; defaults follow the type).
        var danger = c['--color-danger'] || (dark ? '#F62834' : '#D34B37');
        vars['--color-danger'] = danger;
        vars['--text-danger'] = c['--text-danger'] || danger;
        vars['--danger'] = danger;
        vars['--red'] = danger;
        // Hover step: lighter on dark surfaces, deeper on light ones.
        vars['--danger-hover'] = 'color-mix(in srgb, ' + danger + ' 70%, ' + (dark ? '#FFFFFF' : '#000000') + ')';
        vars['--danger-10'] = 'color-mix(in srgb, ' + danger + ' 12%, transparent)';
        vars['--danger-20'] = 'color-mix(in srgb, ' + danger + ' 22%, transparent)';
        // Accent.
        vars['--accent'] = c['--accent-primary'];
        vars['--dock-accent'] = c['--accent-primary'];
        vars['--color-brand'] = c['--accent-primary'];
        // Message bubbles: own = accent-secondary, others = section surface.
        vars['--bubble-own'] = c['--accent-secondary'];
        vars['--bubble-fill-own'] = c['--accent-secondary'];
        vars['--bubble-own-text'] = ownBubbleText(c);
        // Incoming bubbles: card surface + hairline.
        vars['--bubble-other'] = c['--card-bg'];
        vars['--bubble-fill-other'] = c['--card-bg'];
        vars['--bubble-other-text'] = c['--text-primary'];
        vars['--bubble-other-border'] = c['--border-subtle'];
        vars['--bubble-surface-border'] = c['--border-subtle'];
        // React islands (Tailwind theme tokens).
        vars['--color-background'] = c['--bg-section'];
        vars['--color-foreground'] = c['--text-primary'];
        vars['--color-border'] = c['--border-subtle'];
        // Hover highlights in the sidebar lists / file tree.
        vars['--color-accent'] = c['--hover-bg'];

        // Also the elements that re-declare these tokens deeper (settings panel,
        // spotlight, dock, composer), with selectors that outrank those rules.
        var root = 'html[data-theme="' + theme.id + '"]';
        var selector = [
            root,
            root + ' #page-chat',
            root + ' #page-chat .profile-workspace',
            root + ' #page-chat .compose-spotlight',
            root + ' #page-chat .sidebar-dock-bar',
            root + ' #page-chat .chat-main > .input-bar',
            root + ' #page-chat .profile-workspace .profile-identity-layout',
            root + ' #page-chat .profile-workspace .ps-header',
        ].join(',\n');
        var body = Object.keys(vars)
            .map(function (key) {
                return '    ' + key + ': ' + vars[key] + ';';
            })
            .join('\n');

        return (
            selector + ' {\n' + body + '\n}\n' +
            'html[data-theme="' + theme.id + '"] {\n' +
            '    background: ' + c['--bg-main'] + ';\n' +
            '    color-scheme: ' + (dark ? 'dark' : 'light') + ';\n' +
            '}\n'
        );
    }

    function styleElement() {
        var el = document.getElementById(STYLE_ID);
        if (!el) {
            el = document.createElement('style');
            el.id = STYLE_ID;
            (document.head || document.documentElement).appendChild(el);
        }
        return el;
    }

    function syncThemeColorMeta(color) {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) return;
        if (!meta.dataset.defaultColor) meta.dataset.defaultColor = meta.getAttribute('content') || '';
        meta.setAttribute('content', color || meta.dataset.defaultColor);
    }

    function render(theme) {
        var root = document.documentElement;
        if (theme) {
            styleElement().textContent = cssFor(theme);
            root.setAttribute('data-theme', theme.id);
            syncThemeColorMeta(theme.colors['--bg-main']);
        } else {
            var el = document.getElementById(STYLE_ID);
            if (el) el.remove();
            root.removeAttribute('data-theme');
            syncThemeColorMeta(null);
        }
    }

    function notify() {
        try {
            window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { id: activeId } }));
        } catch (e) {
            /* very old engines — no event, theme still applied */
        }
    }

    // ── public API ─────────────────────────────────────────────────────────────

    /** The default theme's id, or any registered one if the default was removed. */
    function fallbackId() {
        if (registry.has(DEFAULT_THEME_ID)) return DEFAULT_THEME_ID;
        var first = registry.keys().next();
        return first.done ? null : first.value;
    }

    /**
     * Apply a registered theme and remember it. `null` returns to the default
     * theme. Returns the applied theme (copy), or null if none is registered.
     */
    function setTheme(id) {
        if (id == null) {
            var fallback = fallbackId();
            activeId = fallback;
            render(fallback ? registry.get(fallback) : null);
            writeStorage(fallback);
            notify();
            return fallback ? clone(registry.get(fallback)) : null;
        }
        var theme = registry.get(id);
        if (!theme) throw new Error('Unknown theme "' + id + '". Registered: ' + Array.from(registry.keys()).join(', '));
        activeId = id;
        render(theme);
        writeStorage(id);
        notify();
        return clone(theme);
    }

    /** All registered themes (copies — edit through addTheme). */
    function getThemes() {
        return Array.from(registry.values()).map(clone);
    }

    function getActiveTheme() {
        return activeId ? clone(registry.get(activeId)) : null;
    }

    /**
     * Register a theme, or replace one with the same id (edit). If it's the
     * active theme, the change applies immediately.
     */
    function addTheme(theme) {
        validate(theme);
        var stored = clone(theme);
        registry.set(stored.id, stored);
        if (activeId === stored.id) {
            render(stored);
            notify();
        }
        return clone(stored);
    }

    /** Unregister a theme; if it was active, the app returns to the default theme. */
    function removeTheme(id) {
        if (!registry.has(id)) return false;
        registry.delete(id);
        if (activeId === id) setTheme(null);
        return true;
    }

    BUILT_IN_THEMES.forEach(addTheme);

    // Boot: apply the saved theme now, before first paint.
    // Synchronous, from <head>: html[data-theme] and <style id="nexa-theme-vars">
    // exist before the stylesheets load, let alone DOMContentLoaded. Nothing
    // saved (first visit) or a stale id → the default theme, persisted so the
    // key always names the theme on screen.
    var saved = readStorage();
    if (!saved || !registry.has(saved)) saved = fallbackId();
    activeId = saved;
    if (activeId) {
        render(registry.get(activeId));
        writeStorage(activeId);
    }

    // Guard: html[data-theme] is the engine's. If other code overwrites it
    // (legacy scripts used to force "dark"), put the active theme back.
    if (window.MutationObserver) {
        new MutationObserver(function () {
            if (activeId && document.documentElement.getAttribute('data-theme') !== activeId) {
                document.documentElement.setAttribute('data-theme', activeId);
            }
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    window.NexaThemes = {
        STORAGE_KEY: STORAGE_KEY,
        CHANGE_EVENT: CHANGE_EVENT,
        DEFAULT_THEME_ID: DEFAULT_THEME_ID,
        REQUIRED_COLORS: REQUIRED_COLORS.slice(),
        setTheme: setTheme,
        getThemes: getThemes,
        getActiveTheme: getActiveTheme,
        addTheme: addTheme,
        removeTheme: removeTheme,
    };
})();
