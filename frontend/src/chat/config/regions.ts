import type { ComponentType } from 'react';
import { ChatSidebar } from '../regions/ChatSidebar/ChatSidebar';
import { PeerPanel } from '../regions/PeerPanel/PeerPanel';

export type ChatRegion = {
    id: 'sidebar' | 'peer';
    component: ComponentType<any>;
    isVisible: boolean;
};

export const chatRegions: ChatRegion[] = [
    { id: 'sidebar', component: ChatSidebar, isVisible: true },
    { id: 'peer', component: PeerPanel, isVisible: true },
];
