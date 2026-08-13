/** Smart paste — long pastes become editable attachment cards in the composer. */

export const PASTE_CHAR_THRESHOLD = 450;
export const PASTE_LINE_THRESHOLD = 8;
export const MAX_PASTE_ATTACHMENTS = 4;

/** @typedef {{ id: string, content: string, title?: string, label?: string }} PasteAttachment */

/** @type {PasteAttachment[]} */
let attachments = [];
let attachmentSeq = 0;
/** @type {string | null} */
let openId = null;
/** @type {(() => void) | null} */
let onChange = null;
/** @type {(() => void) | null} */
let onUiRefresh = null;

/**
 * @param {string} content
 * @param {string} [fallback]
 */
export function derivePasteTitle(content, fallback = 'Pasted text') {
    const first = content
        .split('\n')
        .map((line) => line.trim())
        .find(Boolean);
    if (!first) return fallback;
    const clean = first
        .replace(/^#{1,6}\s+/, '')
        .replace(/^[-*+]\s+/, '')
        .trim();
    if (!clean) return fallback;
    return clean.length > 64 ? `${clean.slice(0, 63).trimEnd()}…` : clean;
}

/**
 * @param {string} content
 */
function derivePastePreview(content) {
    const lines = content.split('\n');
    let i = 0;
    while (i < lines.length && !lines[i].trim()) i += 1;
    i += 1;
    while (i < lines.length && !lines[i].trim()) i += 1;
    const rest = lines.slice(i).join('\n').trim();
    return rest || content.trim();
}

/**
 * @param {number} count
 */
function formatCount(count) {
    return `${count} ${count === 1 ? 'character' : 'characters'}`;
}

/**
 * @param {string} pasted
 * @param {{ pasteThreshold?: number, pasteLineThreshold?: number }} [opts]
 */
export function shouldCapturePaste(pasted, opts = {}) {
    const pasteThreshold = opts.pasteThreshold ?? PASTE_CHAR_THRESHOLD;
    const pasteLineThreshold = opts.pasteLineThreshold ?? PASTE_LINE_THRESHOLD;
    if (!pasted) return false;
    return (
        pasted.length >= pasteThreshold ||
        pasted.split('\n').length >= pasteLineThreshold
    );
}

export function getPasteAttachments() {
    return attachments.slice();
}

export function getPasteAttachmentsLength() {
    return attachments.reduce((sum, item) => sum + item.content.length, 0);
}

/**
 * Merge inline composer text with paste attachments for send.
 * @param {string} text
 */
export function composeMessageText(text) {
    const inline = (text || '').trim();
    const blobs = attachments.map((item) => item.content.trim()).filter(Boolean);
    if (!blobs.length) return inline;
    if (!inline) return blobs.join('\n\n');
    return [inline, ...blobs].join('\n\n');
}

/**
 * @param {(() => void) | null} handler
 */
export function setPasteAttachmentsChangeHandler(handler) {
    onChange = handler;
}

function notifyChange() {
    onUiRefresh?.();
    onChange?.();
}

/**
 * @param {string} content
 */
export function addPasteAttachment(content) {
    if (attachments.length >= MAX_PASTE_ATTACHMENTS) return null;
    attachmentSeq += 1;
    const item = { id: `paste-${attachmentSeq}`, content };
    attachments = [...attachments, item];
    notifyChange();
    return item;
}

/**
 * @param {string} id
 * @param {string} content
 */
export function updatePasteAttachment(id, content) {
    attachments = attachments.map((item) =>
        item.id === id ? { ...item, content } : item
    );
    notifyChange();
}

/**
 * @param {string} id
 */
export function removePasteAttachment(id) {
    attachments = attachments.filter((item) => item.id !== id);
    if (openId === id) openId = null;
    notifyChange();
}

export function clearPasteAttachments() {
    attachments = [];
    openId = null;
    notifyChange();
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {HTMLElement | null} listEl
 * @param {{ disabled?: boolean }} [opts]
 */
export function renderPasteAttachmentCards(listEl, opts = {}) {
    if (!listEl) return;
    const disabled = Boolean(opts.disabled);
    if (!attachments.length) {
        listEl.innerHTML = '';
        listEl.classList.add('hidden');
        listEl.setAttribute('aria-hidden', 'true');
        return;
    }

    listEl.classList.remove('hidden');
    listEl.setAttribute('aria-hidden', 'false');
    listEl.innerHTML = attachments
        .map((item) => {
            const title = item.title ?? derivePasteTitle(item.content);
            const preview = derivePastePreview(item.content);
            return `
        <div class="paste-card-wrap" data-paste-id="${escapeHtml(item.id)}">
          <button type="button" class="paste-card" data-paste-open ${disabled ? 'disabled' : ''} aria-label="Open attachment: ${escapeHtml(title)}">
            <span class="paste-card-title">${escapeHtml(title)}</span>
            <span class="paste-card-preview">${escapeHtml(preview)}</span>
          </button>
          <button type="button" class="paste-card-remove" data-paste-remove ${disabled ? 'disabled' : ''} aria-label="Remove attachment: ${escapeHtml(title)}">
            <svg class="ui-icon" aria-hidden="true"><use href="#icon-x"/></svg>
          </button>
        </div>`;
        })
        .join('');
}

/**
 * Wire list clicks + paste editor dialog. Call once after DOM is ready.
 * @param {{
 *   listEl: HTMLElement | null,
 *   dialogEl: HTMLElement | null,
 *   textareaEl: HTMLTextAreaElement | null,
 *   countEl: HTMLElement | null,
 *   titleEl: HTMLElement | null,
 *   saveBtn: HTMLButtonElement | null,
 *   removeBtn: HTMLButtonElement | null,
 *   closeBtn?: HTMLButtonElement | null,
 *   isDisabled?: () => boolean,
 * }} els
 */
export function initSmartPasteUi(els) {
    const {
        listEl,
        dialogEl,
        textareaEl,
        countEl,
        titleEl,
        saveBtn,
        removeBtn,
        closeBtn,
        isDisabled = () => false,
    } = els;

    const syncOverflow = () => {
        if (!textareaEl || !dialogEl) return;
        const top = textareaEl.scrollTop > 2;
        const bottom =
            textareaEl.scrollTop + textareaEl.clientHeight <
            textareaEl.scrollHeight - 2;
        dialogEl.classList.toggle('has-overflow-top', top);
        dialogEl.classList.toggle('has-overflow-bottom', bottom);
    };

    const closeEditor = () => {
        openId = null;
        if (dialogEl) {
            dialogEl.classList.add('hidden');
            dialogEl.setAttribute('aria-hidden', 'true');
        }
    };

    const openEditor = (id) => {
        const item = attachments.find((a) => a.id === id);
        if (!item || !dialogEl || !textareaEl) return;
        openId = id;
        if (titleEl) titleEl.textContent = item.label ?? 'Pasted text';
        textareaEl.value = item.content;
        textareaEl.readOnly = false;
        if (countEl) countEl.textContent = formatCount(item.content.length);
        if (saveBtn) saveBtn.disabled = !item.content.trim();
        dialogEl.classList.remove('hidden');
        dialogEl.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => {
            textareaEl.focus();
            textareaEl.setSelectionRange(0, 0);
            textareaEl.scrollTop = 0;
            syncOverflow();
        });
    };

    const refresh = () => {
        renderPasteAttachmentCards(listEl, { disabled: isDisabled() });
        if (openId && !attachments.some((a) => a.id === openId)) {
            closeEditor();
        }
    };

    onUiRefresh = refresh;

    listEl?.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const wrap = target.closest('[data-paste-id]');
        if (!wrap) return;
        const id = wrap.getAttribute('data-paste-id');
        if (!id) return;
        if (target.closest('[data-paste-remove]')) {
            removePasteAttachment(id);
            return;
        }
        if (target.closest('[data-paste-open]')) {
            openEditor(id);
        }
    });

    textareaEl?.addEventListener('input', () => {
        if (countEl) countEl.textContent = formatCount(textareaEl.value.length);
        if (saveBtn) saveBtn.disabled = !textareaEl.value.trim();
        syncOverflow();
    });
    textareaEl?.addEventListener('scroll', syncOverflow);

    saveBtn?.addEventListener('click', () => {
        if (!openId || !textareaEl) return;
        const next = textareaEl.value;
        if (!next.trim()) return;
        updatePasteAttachment(openId, next);
        closeEditor();
    });

    removeBtn?.addEventListener('click', () => {
        if (!openId) return;
        removePasteAttachment(openId);
        closeEditor();
    });

    closeBtn?.addEventListener('click', closeEditor);

    dialogEl?.addEventListener('click', (event) => {
        if (event.target === dialogEl) closeEditor();
    });

    dialogEl?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeEditor();
            return;
        }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            saveBtn?.click();
        }
    });

    // Expose refresh for host (disabled state / force re-render)
    return {
        refresh,
        closeEditor,
        openEditor,
    };
}
