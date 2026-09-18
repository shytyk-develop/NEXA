import { closeOverlay, repositionActiveOverlay } from './overlayManager.js';
import { MORE_REACTIONS, QUICK_REACTIONS } from '../../js/messageReactions.js';

export function appendReactionPicker(container, payload, runAction, { variant } = {}) {
    const picker = document.createElement('div');
    picker.className = variant === 'menu' ? 'reaction-picker reaction-picker--menu' : 'reaction-picker';
    picker.setAttribute('role', 'listbox');
    picker.setAttribute('aria-label', 'Reactions');

    let expanded = false;

    const paint = () => {
        picker.replaceChildren();
        picker.classList.toggle('is-expanded', expanded);

        const emojis = expanded ? [...QUICK_REACTIONS, ...MORE_REACTIONS] : QUICK_REACTIONS;
        emojis.forEach((emoji) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'reaction-picker-btn';
            btn.textContent = emoji;
            btn.setAttribute('role', 'option');
            const active = payload?.currentEmoji === emoji;
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
            if (active) btn.classList.add('is-active');
            btn.addEventListener('click', () => {
                closeOverlay({ reason: 'reaction-pick' });
                runAction('reaction.pick', { messageId: payload?.messageId, emoji });
            });
            picker.append(btn);
        });

        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'reaction-picker-more';
        more.setAttribute('aria-label', expanded ? 'Fewer reactions' : 'More reactions');
        more.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        more.textContent = expanded ? '–' : '+';
        more.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            expanded = !expanded;
            paint();
            window.requestAnimationFrame(() => repositionActiveOverlay());
        });
        picker.append(more);
    };

    paint();
    container.append(picker);
}
