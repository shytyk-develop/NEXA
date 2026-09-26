import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowDown, Check, Loader2 } from 'lucide-react';

import './export-button.css';

// Settings → Data → Export: a three-phase button (js/profileSettings.js mounts
// it into the Export card). idle → preparing (progress fills over 1.5s) →
// downloading (the file is handed to the browser) → completed ("Export
// saved!", emerald glow) → back to idle after 2.5s. `onPhase` lets the card
// animate its icon along.

export type ExportState = 'idle' | 'preparing' | 'downloading' | 'completed';

type ExportButtonProps = {
    /** Returns false when there's nothing to export (the caller explains why). */
    canExport: () => boolean;
    /** Builds and downloads the file; false if it failed. */
    download: () => boolean | Promise<boolean>;
    onPhase?: (state: ExportState) => void;
};

const PREPARE_MS = 1500;
const DOWNLOAD_MS = 450;
const COMPLETED_MS = 2500;

const LABELS: Record<ExportState, string> = {
    idle: 'Download export',
    preparing: 'Encrypting & packaging…',
    downloading: 'Downloading…',
    completed: 'Export saved!',
};

function ExportButton({ canExport, download, onPhase }: ExportButtonProps) {
    const reduce = useReducedMotion();
    const [exportState, setExportState] = useState<ExportState>('idle');
    const timers = useRef<number[]>([]);

    const later = (ms: number, fn: () => void) => {
        timers.current.push(window.setTimeout(fn, ms));
    };

    useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);
    useEffect(() => onPhase?.(exportState), [exportState, onPhase]);

    const start = useCallback(() => {
        if (exportState !== 'idle' || !canExport()) return;
        setExportState('preparing');
        later(reduce ? 200 : PREPARE_MS, async () => {
            setExportState('downloading');
            let ok = false;
            try {
                ok = await download();
            } catch {
                ok = false;
            }
            if (!ok) {
                setExportState('idle');
                return;
            }
            later(reduce ? 0 : DOWNLOAD_MS, () => {
                setExportState('completed');
                later(COMPLETED_MS, () => setExportState('idle'));
            });
        });
    }, [exportState, canExport, download, reduce]);

    const busy = exportState === 'preparing' || exportState === 'downloading';
    const swap = reduce
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
        : {
            initial: { opacity: 0, y: 10, filter: 'blur(4px)' },
            animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
            exit: { opacity: 0, y: -10, filter: 'blur(4px)' },
        };

    return (
        <motion.button
            type="button"
            id="uiProfileExportDataBtn"
            className="export-btn"
            data-state={exportState}
            onClick={start}
            aria-busy={busy}
            aria-live="polite"
            whileHover={exportState === 'idle' && !reduce ? { scale: 1.02 } : undefined}
            whileTap={exportState === 'idle' && !reduce ? { scale: 0.98 } : undefined}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        >
            {/* Packing progress: a darker wash sweeping left → right. */}
            <AnimatePresence>
                {busy && (
                    <motion.span
                        key="progress"
                        className="export-btn__progress"
                        initial={{ width: '0%', opacity: 1 }}
                        animate={{ width: exportState === 'downloading' ? '100%' : '92%' }}
                        exit={{ opacity: 0, transition: { duration: 0.25 } }}
                        transition={
                            exportState === 'downloading'
                                ? { duration: 0.3, ease: 'easeOut' }
                                : { duration: (reduce ? 200 : PREPARE_MS) / 1000, ease: [0.4, 0, 0.2, 1] }
                        }
                        aria-hidden="true"
                    />
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait" initial={false}>
                <motion.span
                    key={exportState}
                    className="export-btn__content"
                    {...swap}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                    {busy && <Loader2 className="export-btn__spin" aria-hidden="true" />}
                    {exportState === 'completed' && (
                        <motion.span
                            className="export-btn__check"
                            initial={reduce ? false : { scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 520, damping: 18, delay: 0.05 }}
                            aria-hidden="true"
                        >
                            <Check strokeWidth={3} />
                        </motion.span>
                    )}
                    <span>{LABELS[exportState]}</span>
                    {exportState === 'idle' && (
                        <motion.span
                            className="export-btn__arrow"
                            animate={reduce ? undefined : { y: [0, 3, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            aria-hidden="true"
                        >
                            <ArrowDown strokeWidth={2.4} />
                        </motion.span>
                    )}
                </motion.span>
            </AnimatePresence>
        </motion.button>
    );
}

/** Replace the Export card's placeholder button with the animated one. */
export function mountExportButton(host: HTMLElement, props: ExportButtonProps) {
    const root = createRoot(host);
    root.render(<ExportButton {...props} />);
    return () => root.unmount();
}
