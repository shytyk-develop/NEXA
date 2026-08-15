// Mobile message actions drawer — reactions + context actions (vaul-style sheet).

import { closeOverlay } from './overlayManager.js';
import { getMessageContextItems } from './contextMenu.js';
import { QUICK_REACTIONS } from '../../js/messageReactions.js';

export function renderMessageActionsDrawer(container, state, runAction) {
    const payload = state.payload || {};

    const handle = document.createElement('div');
    handle.className = 'message-actions-drawer__handle';
    handle.setAttribute('aria-hidden', 'true');

    const header = document.createElement('div');
    header.className = 'message-actions-drawer__header';
    const title = document.createElement('p');
    title.className = 'message-actions-drawer__title';
    title.textContent = 'Message';
    header.append(title);

    const body = document.createElement('div');
    body.className = 'message-actions-drawer__body';

    const reactions = document.createElement('div');
    reactions.className = 'message-actions-drawer__reactions';
    reactions.setAttribute('role', 'group');
    reactions.setAttribute('aria-label', 'Quick reactions');

    const canReact = Boolean(payload.messageId);
    QUICK_REACTIONS.forEach((emoji) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'message-actions-drawer__reaction';
        btn.textContent = emoji;
        btn.disabled = !canReact;
        btn.title = canReact ? `React ${emoji}` : 'Waiting for sync';
        btn.addEventListener('click', () => {
            if (!canReact) return;
            closeOverlay({ reason: 'drawer-reaction' });
            runAction('reaction.pick', { messageId: payload.messageId, emoji });
        });
        reactions.append(btn);
    });

    const list = document.createElement('ul');
    list.className = 'overlay-menu-list message-actions-drawer__menu';

    const items = getMessageContextItems(payload).filter(
        (item) => item.id !== 'message.react'
    );

    items.forEach((item) => {
        if (item.type === 'separator') {
            const sep = document.createElement('li');
            sep.className = 'overlay-menu-separator';
            list.appendChild(sep);
            return;
        }

        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'overlay-menu-item';
        btn.setAttribute('role', 'menuitem');
        btn.textContent = item.label;
        if (item.danger) btn.classList.add('is-danger');
        if (item.disabled) btn.disabled = true;

        btn.addEventListener('click', () => {
            if (item.disabled) return;
            closeOverlay({ reason: 'drawer-action' });
            runAction(item.id, payload);
        });

        li.append(btn);
        list.appendChild(li);
    });

    body.append(reactions, list);
    container.append(handle, header, body);
}
