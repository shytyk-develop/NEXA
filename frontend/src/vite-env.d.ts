/// <reference types="vite/client" />

declare module '*.css';

declare module '../../js/startSite.js' {
    export function initStartSite(pageStart: HTMLElement | null): void;
    export function teardownStartSite(): void;
}

declare module '../../js/vortex.js' {
    export function mountVortex(host: HTMLElement | null): void;
    export function destroyVortex(): void;
}

declare module '../../../js/*.js';
declare module '../../../../js/*.js';
