import { FadeIn } from '../../animations/FadeIn';
import { GlassCard } from '../../ui/GlassCard';
import { Button } from '../../ui/Button';
import { GridContainer } from '../../layouts/GridContainer';

export function QrScanner() {
    return (
        <section id="qr" aria-label="QR scanner">
            <GridContainer>
                <div className="nexa-col-12 nexa-col-md-6">
                    <FadeIn>
                        <GlassCard style={{ padding: 28 }}>
                            <h2 className="start-h2" style={{ fontSize: 28, margin: '0 0 12px' }}>
                                QR scanner
                            </h2>
                            <p className="start-lead" style={{ marginBottom: 16 }}>
                                Slot for a custom QR scanner. Toggle <code>isVisible</code> in
                                {' '}
                                <code>config/sections.ts</code>
                                {' '}
                                to show this block.
                            </p>
                            <Button variant="glass" type="button">
                                Scan a code
                            </Button>
                        </GlassCard>
                    </FadeIn>
                </div>
            </GridContainer>
        </section>
    );
}
