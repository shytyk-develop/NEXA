// Client-side link detection & safe rendering — runs only on decrypted plaintext locally.

const TRAILING_PUNCT = /[.,;:!?…]+$/;
const TRAILING_BRACE = /[)\]}>]+$/;

/** Common TLDs — reduces false positives vs bare "word.word" */
const TLD_PATTERN =
    'com|net|org|ru|nl|io|dev|app|co|uk|de|fr|info|biz|xyz|me|tv|cc|us|ca|au|jp|cn|br|in|pl|cz|sk|ua|by|kz|eu|online|site|tech|store|shop|cloud|ai|gg|ly|sh|fm|ws|pm|to|id|vn|th|ph|my|sg|hk|tw|kr|it|es|pt|be|ch|at|se|no|dk|fi|ie|nz|za|gov|edu|mil|int';

const LINK_PATTERNS = [
    /https?:\/\/[^\s<>"']+/gi,
    /www\.[^\s<>"']+/gi,
    new RegExp(
        `(?<![@\\w./-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?:${TLD_PATTERN})(?::\\d{1,5})?(?:\\/[^\\s<>"']*)?`,
        'gi'
    ),
];

function trimUrlTail(raw) {
    let url = raw;
    let trimmed = raw;

    while (TRAILING_PUNCT.test(trimmed)) {
        trimmed = trimmed.replace(TRAILING_PUNCT, '');
    }

    const openParen = (trimmed.match(/\(/g) || []).length;
    const closeParen = (trimmed.match(/\)/g) || []).length;
    if (closeParen > openParen) {
        while (TRAILING_BRACE.test(trimmed)) {
            trimmed = trimmed.replace(TRAILING_BRACE, '');
        }
    }

    return { display: trimmed, rawEndOffset: raw.length - trimmed.length };
}

/**
 * Normalize to a safe http(s) href or return null (blocks javascript:, data:, etc.).
 */
export function toSafeWebHref(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    let candidate = rawUrl.trim();
    if (!candidate) return null;

    if (/^www\./i.test(candidate)) {
        candidate = `https://${candidate}`;
    } else if (!/^https?:\/\//i.test(candidate)) {
        candidate = `https://${candidate}`;
    }

    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
        if (!parsed.hostname || !parsed.hostname.includes('.')) {
            return null;
        }
        return parsed.href;
    } catch {
        return null;
    }
}

export function isSafeWebHref(href) {
    return toSafeWebHref(href) === href;
}

/**
 * @returns {{ start: number, end: number, display: string, href: string }[]}
 */
export function findLinksInText(text) {
    if (!text || typeof text !== 'string') return [];

    const rawMatches = [];

    for (const pattern of LINK_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const start = match.index;
            const raw = match[0];
            const { display, rawEndOffset } = trimUrlTail(raw);
            if (!display || display.length < 4) continue;

            const href = toSafeWebHref(display);
            if (!href) continue;

            rawMatches.push({
                start,
                end: start + raw.length - rawEndOffset,
                display,
                href,
            });
        }
    }

    if (!rawMatches.length) return [];

    rawMatches.sort((a, b) => a.start - b.start || b.end - a.end);

    const merged = [];
    for (const m of rawMatches) {
        const last = merged[merged.length - 1];
        if (last && m.start < last.end) {
            if (m.end - m.start > last.end - last.start) {
                merged[merged.length - 1] = m;
            }
            continue;
        }
        merged.push(m);
    }

    return merged;
}

export function messageContainsLink(text) {
    return findLinksInText(text).length > 0;
}

function appendPlainWithHighlights(parent, text, needle) {
    if (!text) return;
    if (!needle) {
        parent.appendChild(document.createTextNode(text));
        return;
    }
    const hay = text.toLowerCase();
    const q = needle.toLowerCase();
    let from = 0;
    while (from < text.length) {
        const i = hay.indexOf(q, from);
        if (i < 0) {
            parent.appendChild(document.createTextNode(text.slice(from)));
            return;
        }
        if (i > from) {
            parent.appendChild(document.createTextNode(text.slice(from, i)));
        }
        const mark = document.createElement('mark');
        mark.className = 'search-hit';
        mark.textContent = text.slice(i, i + q.length);
        parent.appendChild(mark);
        from = i + q.length;
    }
}

/**
 * Build safe DOM for message body text (text nodes + <a>, no innerHTML).
 * Optional `highlight` wraps case-insensitive matches in <mark class="search-hit">.
 */
export function appendLinkedTextContent(container, text, options = {}) {
    const linkify = options.linkify !== false;
    const highlight = typeof options.highlight === 'string' ? options.highlight.trim() : '';
    const source = text || '';

    if (!linkify || !source) {
        appendPlainWithHighlights(container, source, highlight);
        return;
    }

    const links = findLinksInText(source);
    if (!links.length) {
        appendPlainWithHighlights(container, source, highlight);
        return;
    }

    let cursor = 0;
    for (const link of links) {
        if (link.start > cursor) {
            appendPlainWithHighlights(container, source.slice(cursor, link.start), highlight);
        }

        const anchor = document.createElement('a');
        anchor.className = 'message-link';
        anchor.href = link.href;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.title = link.href;
        appendPlainWithHighlights(anchor, link.display, highlight);
        container.appendChild(anchor);

        cursor = link.end;
    }

    if (cursor < source.length) {
        appendPlainWithHighlights(container, source.slice(cursor), highlight);
    }
}

export function createLinkSecurityNotice() {
    const notice = document.createElement('div');
    notice.className = 'message-link-warning';
    notice.setAttribute('role', 'note');

    const icon = document.createElement('span');
    icon.className = 'message-link-warning-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '⎋';

    const text = document.createElement('span');
    text.className = 'message-link-warning-text';
    text.textContent =
        'External links may be unsafe. Be careful before opening.';

    notice.append(icon, text);
    return notice;
}
