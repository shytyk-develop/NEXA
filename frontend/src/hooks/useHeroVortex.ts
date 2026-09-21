import { useLayoutEffect } from 'react';

export function useHeroVortex(hostId = 'startHeroVortex') {
    useLayoutEffect(() => {
        const host = document.getElementById(hostId);
        if (!host) return undefined;

        let cancelled = false;
        let destroy = () => {};
        const frame = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                import('../../js/vortex.js')
                    .then((mod) => {
                        if (cancelled) return;
                        destroy = mod.destroyVortex;
                        mod.mountVortex(host);
                    })
                    .catch(() => {});
            });
        });

        return () => {
            cancelled = true;
            cancelAnimationFrame(frame);
            destroy();
        };
    }, [hostId]);
}
