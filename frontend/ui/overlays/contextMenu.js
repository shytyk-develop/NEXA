// Message context menu (right-click).

import { closeOverlay } from './overlayManager.js';
import { appendReactionPicker } from './reactionPicker.js';

export function getMessageContextItems(payload) {
    const items = [
        { id: 'message.reply', label: 'Reply', disabled: !payload?.messageId },
        { id: 'message.copy', label: 'Copy' },
    ];

    if (payload?.messageType === 'outgoing' && payload?.messageId) {
        items.push({ type: 'separator' });
        items.push({ id: 'message.edit', label: 'Edit', disabled: true });
        items.push({ id: 'message.delete', label: 'Delete for everyone', danger: true });
    } else if (payload?.messageId) {
        items.push({ type: 'separator' });
        items.push({ id: 'message.highlight', label: 'Select / Highlight' });
    }

    return items;
}

function appendMessagePreview(container, payload) {
    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    const author = payload?.author || (payload?.messageType === 'outgoing' ? 'You' : '');
    if (!text && !author) return;

    const preview = document.createElement('div');
    preview.className = 'message-actions-card__preview';

    if (author) {
        const name = document.createElement('div');
        name.className = 'message-actions-card__preview-author';
        name.textContent = author;
        preview.append(name);
    }

    if (text) {
        const body = document.createElement('p');
        body.className = 'message-actions-card__preview-text';
        body.textContent = text;
        preview.append(body);
    }

    container.append(preview);
}

export function renderContextMenu(container, state, runAction) {
    const payload = state.payload || {};

    if (payload.messageId) {
        appendMessagePreview(container, payload);
        appendReactionPicker(container, payload, runAction, { variant: 'menu' });
    }

    const groups = [];
    let current = [];
    getMessageContextItems(payload).forEach((item) => {
        if (item.type === 'separator') {
            if (current.length) {
                groups.push(current);
                current = [];
            }
            return;
        }
        current.push(item);
    });
    if (current.length) groups.push(current);

    groups.forEach((group) => {
        const list = document.createElement('ul');
        list.className = 'overlay-menu-list message-actions-card__group';

        group.forEach((item) => {
            const li = document.createElement('li');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'overlay-menu-item';
            btn.role = 'menuitem';
            btn.textContent = item.label;
            if (item.danger) btn.classList.add('is-danger');
            if (item.disabled) btn.disabled = true;

            btn.addEventListener('click', () => {
                if (item.disabled) return;
                closeOverlay({ reason: 'menu-action' });
                runAction(item.id, payload);
            });

            li.append(btn);
            list.appendChild(li);
        });

        container.appendChild(list);
    });
}
