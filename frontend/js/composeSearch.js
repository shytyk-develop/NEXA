let context = {};
let composeModule = null;
let modulePromise = null;
let open = false;

function loadComposeSearch() {
    if (composeModule) return Promise.resolve(composeModule);
    if (!modulePromise) {
        modulePromise = import('./composeSearch.jsx').then((module) => {
            composeModule = module;
            module.setComposeStateObserver((nextOpen) => {
                open = nextOpen;
            });
            module.initComposeSearch(context);
            return module;
        });
    }
    return modulePromise;
}

export function initComposeSearch(nextContext = {}) {
    context = nextContext;
    if (composeModule) composeModule.initComposeSearch(context);
}

export function isComposeSearchOpen() {
    return open;
}

export function openComposeSearch() {
    open = true;
    // Apply shell state immediately so composer/welcome hide before the React island mounts.
    document.getElementById('page-chat')?.classList.add('is-compose-search');
    // Avoid replaying the peer empty intro when Spotlight swaps the right-rail copy.
    document.getElementById('uiPeerEmpty')?.classList.remove('is-entering');
    // Keep welcome mounted (not display:none) so it can fade back with the composer.
    document.getElementById('chat-welcome')?.classList.remove('hidden');
    void loadComposeSearch().then((module) => {
        if (open) module.openComposeSearch();
    });
}

export function closeComposeSearch(options = {}) {
    const wasOpen = open;
    open = false;

    if (composeModule) {
        composeModule.closeComposeSearch(options);
        return;
    }

    if (options.restoreWelcome) {
        const welcome = document.getElementById('chat-welcome');
        welcome?.classList.remove('hidden');
        void welcome?.offsetWidth;
    } else {
        document.getElementById('chat-welcome')?.classList.add('hidden');
    }
    document.getElementById('page-chat')?.classList.remove('is-compose-search');
    document.getElementById('uiPeerEmpty')?.classList.remove('is-entering');
    if (wasOpen && options.restoreWelcome) {
        context?.onRestoreWelcome?.();
    }
}
