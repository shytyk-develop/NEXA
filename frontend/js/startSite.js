import { destroyVortex, mountVortex } from './vortex.js';

export function initStartSite(pageStart) {
    if (!pageStart) return;

    bindStartNav(pageStart);
    mountVortex(pageStart.querySelector('#startHeroVortex'));
}

export function teardownStartSite() {
    destroyVortex();
}

// The page is re-initialised on every visit to `/`, but the markup is never
// rebuilt — binding again would stack a second handler on the same button.
let navBound = false;

function bindStartNav(pageStart) {
    if (navBound) return;

    const toggle = pageStart.querySelector('#startNavToggle');
    const menu = pageStart.querySelector('#startNavMenu');
    const header = pageStart.querySelector('.start-nav');

    if (!toggle || !menu || !header) return;

    navBound = true;

    toggle.addEventListener('click', () => {
        const open = header.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        menu.hidden = !open;
    });
}
