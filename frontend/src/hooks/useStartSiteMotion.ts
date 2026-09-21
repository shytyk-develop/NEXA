import { useLayoutEffect } from 'react';
import { initStartSite, teardownStartSite } from '../../js/startSite.js';

export function useStartSiteMotion() {
    useLayoutEffect(() => {
        const page = document.getElementById('page-start');
        if (!page) return;
        initStartSite(page);
        return () => {
            teardownStartSite();
        };
    }, []);
}
