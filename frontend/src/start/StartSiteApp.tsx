import { Nav } from '../components/sections/Nav/Nav';
import { Footer } from '../components/sections/Footer/Footer';
import { pageSections } from '../config/sections';
import { useStartSiteMotion } from '../hooks/useStartSiteMotion';
import { SectionErrorBoundary } from './SectionErrorBoundary';
import './start-shared.css';

export function StartSiteApp() {
    useStartSiteMotion();

    return (
        <>
            <div className="start-site__shell start-site__main">
                <Nav />
                {pageSections
                    .filter((section) => section.isVisible)
                    .map((section) => {
                        const Section = section.component;
                        return (
                            <SectionErrorBoundary key={section.id} id={section.id}>
                                <Section />
                            </SectionErrorBoundary>
                        );
                    })}
            </div>
            <Footer />
        </>
    );
}
