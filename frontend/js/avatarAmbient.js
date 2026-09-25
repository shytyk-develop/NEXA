// Ambient glow colour for the profile header, from the avatar's dominant colour:
// same hue, saturation capped (muted), lightness fixed mid-range so the banner's
// soft glow reads on a near-black card without shouting. (A 10–18% lightness
// colour at partial alpha simply disappears there.)

/** Muting: saturation ceiling. */
const MAX_SATURATION = 0.45;
/** Lightness of the glow colour. */
const GLOW_LIGHTNESS = 0.45;
/** Downscale size for sampling — plenty for a dominant hue, cheap to scan. */
const SAMPLE_SIZE = 24;

/**
 * dataUrl → css colour; avatars are re-rendered often, analysis is not. Keys are
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

/** Muted glow colour for a hue / saturation (css). */
function glowColor(h, s) {
    return hsl(h, Math.min(s, MAX_SATURATION), GLOW_LIGHTNESS);
}

/** Fallback when there's no photo: the user's avatar hue, muted the same way. */
export function ambientFromHue(hue) {
    return glowColor(Number(hue) || 220, 0.35);
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
 * Dominant colour of an image (data URL / same-origin src) as a muted glow colour.
 * Colours are bucketed (4 bits per channel); near-black, near-white and
 * transparent pixels are skipped and saturated pixels weigh more, so a
 * colourful subject beats a plain backdrop. Resolves null if nothing usable.
 */
export async function extractAmbientColor(src) {
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

    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        if (a < 128) continue;
        const [, s, l] = rgbToHsl(r, g, b);
        if (l < 0.08 || l > 0.92) continue;
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        const bucket = buckets.get(key) || { weight: 0, r: 0, g: 0, b: 0, n: 0 };
        bucket.weight += 1 + s * 3;
        bucket.r += r;
        bucket.g += g;
        bucket.b += b;
        bucket.n += 1;
        buckets.set(key, bucket);
    }

    let best = null;
    buckets.forEach((bucket) => {
        if (!best || bucket.weight > best.weight) best = bucket;
    });

    let result = null;
    if (best) {
        const [h, s] = rgbToHsl(best.r / best.n, best.g / best.n, best.b / best.n);
        result = glowColor(h, s);
    }
    remember(src, result);
    return result;
}
