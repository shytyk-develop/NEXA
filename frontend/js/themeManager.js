// ES-module access to the theme engine (public/js/themes.js), which is loaded
// as a classic script in <head> so the saved theme applies before first paint.

function engine() {
    const api = window.NexaThemes;
    if (!api) throw new Error('Theme engine not loaded (public/js/themes.js).');
    return api;
}

/** Apply a registered theme by id (persists as nexa_theme_id); null = default theme. */
export const setTheme = (id) => engine().setTheme(id);

/** All registered themes: [{ id, name, type, colors }]. */
export const getThemes = () => engine().getThemes();

/** The applied theme. */
export const getActiveTheme = () => engine().getActiveTheme();

/** Register a theme, or replace one with the same id. */
export const addTheme = (theme) => engine().addTheme(theme);

/** Unregister a theme (if active, falls back to the default theme). */
export const removeTheme = (id) => engine().removeTheme(id);

/** Subscribe to theme changes; returns an unsubscribe function. */
export function onThemeChange(listener) {
    const handler = (event) => listener(event.detail?.id ?? null);
    window.addEventListener(engine().CHANGE_EVENT, handler);
    return () => window.removeEventListener(engine().CHANGE_EVENT, handler);
}

/** Wipe length for the View Transitions reveal; the CSS fallback fades for 350ms. */
const WIPE_MS = 700;
const FADE_MS = 350;
let fadeTimer = 0;

/**
 * Switch theme with a smooth transition. Where the View Transitions API exists,
 * the new theme wipes in from the top over a snapshot of the old one (the
 * "VerticalThemeWipeToggle" draft); elsewhere every colour eases for 350ms via
 * html.nexa-theme-fading (public/css/themes.css). Reduced motion → instant.
 */
export async function setThemeAnimated(id) {
    const root = document.documentElement;
    if (id === (getActiveTheme()?.id ?? null)) return getActiveTheme();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setTheme(id);

    if (typeof document.startViewTransition === 'function') {
        let applied = null;
        const transition = document.startViewTransition(() => {
            applied = setTheme(id);
        });
        try {
            await transition.ready;
            root.animate(
                { clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0 0)'] },
                { duration: WIPE_MS, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' },
            );
        } catch {
            /* transition skipped (e.g. tab hidden) — theme is applied anyway */
        }
        await transition.updateCallbackDone.catch(() => {});
        return applied;
    }

    window.clearTimeout(fadeTimer);
    root.classList.add('nexa-theme-fading');
    const applied = setTheme(id);
    fadeTimer = window.setTimeout(() => root.classList.remove('nexa-theme-fading'), FADE_MS + 50);
    return applied;
}
