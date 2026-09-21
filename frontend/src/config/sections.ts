import type { ComponentType } from 'react';
import { Hero } from '../components/sections/Hero/Hero';
import { Marquee } from '../components/sections/Marquee/Marquee';
import { Stats } from '../components/sections/Stats/Stats';
import { Features } from '../components/sections/Features/Features';
import { SplitCards } from '../components/sections/SplitCards/SplitCards';
import { Product } from '../components/sections/Product/Product';
import { Orbit } from '../components/sections/Orbit/Orbit';
import { Mobile } from '../components/sections/Mobile/Mobile';
import { Quotes } from '../components/sections/Quotes/Quotes';
import { Faq } from '../components/sections/Faq/Faq';
import { CtaBand } from '../components/sections/CtaBand/CtaBand';
import { QrScanner } from '../components/sections/QrScanner/QrScanner';

export type PageSection = {
    id: string;
    component: ComponentType;
    isVisible: boolean;
};

export const pageSections: PageSection[] = [
    { id: 'hero', component: Hero, isVisible: true },
    { id: 'marquee', component: Marquee, isVisible: true },
    { id: 'stats', component: Stats, isVisible: true },
    { id: 'features', component: Features, isVisible: true },
    { id: 'chat', component: SplitCards, isVisible: false },
    { id: 'product', component: Product, isVisible: true },
    { id: 'orbit', component: Orbit, isVisible: true },
    { id: 'mobile', component: Mobile, isVisible: true },
    { id: 'quotes', component: Quotes, isVisible: true },
    { id: 'faq', component: Faq, isVisible: true },
    { id: 'cta', component: CtaBand, isVisible: true },
    { id: 'qr', component: QrScanner, isVisible: false },
];
