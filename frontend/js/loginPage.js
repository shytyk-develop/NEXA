let destroyLoginBackgroundFn = () => {};

export function initLoginPage(pageLogin) {
    if (!pageLogin) return;

    bindLoginNav(pageLogin);

    // THREE login canvas is heavy — keep it out of the start-route chunk.
    import('./loginCanvas.js').then((mod) => {
        destroyLoginBackgroundFn = mod.destroyLoginBackground;
        mod.mountLoginBackground(pageLogin);
    }).catch(() => {});
}

export function teardownLoginPage() {
    destroyLoginBackgroundFn();
    destroyLoginBackgroundFn = () => {};
}

function bindLoginNav(pageLogin) {
    const toggle = pageLogin.querySelector('#loginNavToggle');
    const menu = pageLogin.querySelector('#loginNavMenu');
    const header = pageLogin.querySelector('.login-nav');

    if (!toggle || !menu || !header) return;

    toggle.addEventListener('click', () => {
        const open = header.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        menu.hidden = !open;
    });
}
