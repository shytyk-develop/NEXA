// Ambient palette for the profile header banner, taken from the avatar photo:
// up to three of its main colours (distinct hues, by area), each lifted to a
// vivid band with a clamped lightness so the glow reads on both the dark and
// the white card. Near-grey photos stay grey instead of inventing a colour.

/** Saturation band: at least this vivid (unless the colour is near-grey)… */
const MIN_SATURATION = 0.55;
/** …and at most this. */
const MAX_SATURATION = 0.85;
/** Below this a colour is effectively grey — don't invent a hue for it. */
const GREY_SATURATION = 0.12;
/** Glow lightness range — keeps each colour's own light/dark character. */
const MIN_LIGHTNESS = 0.45;
const MAX_LIGHTNESS = 0.65;
/** Hue families: 12 × 30°. Pixels are grouped per family before ranking. */
const HUE_BINS = 12;
/** Palette colours must differ by at least this much hue (degrees)… */
const MIN_HUE_GAP = 40;
/** …and carry at least this share of the main colour's weight. */
const MIN_SHARE = 0.08;
/** Palette size. */
const PALETTE_SIZE = 3;
/** Downscale size for sampling — plenty for main colours, cheap to scan. */
const SAMPLE_SIZE = 32;

/**
 * dataUrl → palette; avatars are re-rendered often, analysis is not. Keys are
 * whole data URLs (up to ~0.7 MB each), so only the last few are kept.
 */
const cache = new Map();
const CACHE_LIMIT = 8;

function remember(src, value) {
    cache.set(src, value);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
}

function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return [h * 60, s, l];
}

function hsl(h, s, l) {
    return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Glow colour (css) for an HSL triple: vivid, lightness clamped, grey stays grey. */
function glowColor(h, s, l = 0.55) {
    const sat = s < GREY_SATURATION ? s : clamp(s, MIN_SATURATION, MAX_SATURATION);
    return hsl(h, sat, clamp(l, MIN_LIGHTNESS, MAX_LIGHTNESS));
}

/**
 * Fallback without a photo: the user's avatar hue plus two neighbours, so the
 * banner still has depth (same layout as a photo palette).
 */
export function ambientPaletteFromHue(hue) {
    const h = Number(hue) || 220;
    return [glowColor(h, 0.65, 0.55), glowColor((h + 32) % 360, 0.6, 0.5), glowColor((h + 328) % 360, 0.6, 0.6)];
}

/** Single-colour fallback (first colour of the hue palette). */
export function ambientFromHue(hue) {
    return ambientPaletteFromHue(hue)[0];
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image failed to load'));
        img.src = src;
    });
}

/**
 * Main colours of an image (data URL / same-origin src) as glow colours, most
 * prominent first. Pixels are grouped into hue families (plus one for greys);
 * each family's colour is its weighted average, and colourful pixels weigh
 * more so a vivid subject beats a plain backdrop. Near-black, near-white and
 * transparent pixels are skipped. Families under MIN_SHARE of the leader are
 * dropped; if fewer than PALETTE_SIZE remain, darker / lighter shades of the
 * leading colour fill in. Resolves null if nothing usable.
 */
export async function extractAmbientPalette(src) {
    if (!src) return null;
    if (cache.has(src)) return cache.get(src);

    const img = await loadImage(src);
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    // Family index: 0…HUE_BINS-1 by hue, HUE_BINS = greys.
    const families = Array.from({ length: HUE_BINS + 1 }, () => ({ weight: 0, r: 0, g: 0, b: 0 }));
    for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        if (a < 128) continue;
        const [h, s, l] = rgbToHsl(r, g, b);
        if (l < 0.08 || l > 0.94) continue;
        const grey = s < GREY_SATURATION;
        const family = families[grey ? HUE_BINS : Math.floor(h / (360 / HUE_BINS)) % HUE_BINS];
        const w = grey ? 0.6 : 1 + s * 3;
        family.weight += w;
        family.r += r * w;
        family.g += g * w;
        family.b += b * w;
    }

    const ranked = families.filter((f) => f.weight > 0).sort((a, b) => b.weight - a.weight);
    if (!ranked.length) {
        remember(src, null);
        return null;
    }

    // Most prominent first, skipping near-duplicates: one colour can straddle
    // two neighbouring families (an orange split at 30°), which would spend
    // two slots on the same colour. Greys never clash with hued colours.
    const top = ranked[0].weight;
    const colours = [];
    for (const f of ranked) {
        if (colours.length === PALETTE_SIZE || f.weight < top * MIN_SHARE) break;
        const c = rgbToHsl(f.r / f.weight, f.g / f.weight, f.b / f.weight);
        const clash = colours.some(([h, s]) => {
            if ((s < GREY_SATURATION) !== (c[1] < GREY_SATURATION)) return false;
            const gap = Math.abs(h - c[0]) % 360;
            return Math.min(gap, 360 - gap) < MIN_HUE_GAP;
        });
        if (!clash) colours.push(c);
    }

    // Fewer families than slots: shades of the leading colour fill the rest.
    const [h0, s0, l0] = colours[0];
    const shades = [
        [h0, s0, l0 - 0.12],
        [h0, s0, l0 + 0.12],
    ];
    for (let i = 0; colours.length < PALETTE_SIZE; i += 1) colours.push(shades[i]);

    const palette = colours.map(([h, s, l]) => glowColor(h, s, l));
    remember(src, palette);
    return palette;
}

/** Main colour only (first of the palette). */
export async function extractAmbientColor(src) {
    const palette = await extractAmbientPalette(src);
    return palette ? palette[0] : null;
}
