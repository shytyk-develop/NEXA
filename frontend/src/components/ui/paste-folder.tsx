'use client';

import { motion } from 'motion/react';
import FolderInteraction from '@/components/ui/folder-interaction';
import { cn } from '@/lib/utils';

export type PasteFolderDoc = {
    id: string;
    title: string;
    text: string;
};

type PasteFolderProps = {
    documents: PasteFolderDoc[];
    disabled?: boolean;
    onOpenDocument?: (id: string) => void;
    onRemoveDocument?: (id: string) => void;
    className?: string;
};

/** The folder is drawn at 52% (the layout box stays full size for the tuck). */
const FOLDER_SCALE = 0.52;

const SLIDE = { type: 'spring' as const, stiffness: 380, damping: 30 };

/**
 * Exit: an eased glide back under the composer instead of the spring (which
 * snapped down and faded almost at once). The composer covers it and the shelf
 * clips below the tuck line, so opacity only lets go near the end.
 */
const TUCK_EASE = [0.45, 0, 0.2, 1] as const;
const TUCK = {
    y: { duration: 0.42, ease: TUCK_EASE },
    opacity: { duration: 0.18, delay: 0.24, ease: 'easeOut' as const },
};

/**
 * Paste shelf host — slides up from behind the composer's top edge (the
 * composer paints above; the shelf clips below its tuck line) and back down
 * behind it on removal before unmounting.
 */
export function PasteFolder({
    documents,
    disabled = false,
    onOpenDocument,
    className,
}: PasteFolderProps) {
    if (!documents.length) return null;

    const primary = documents[0];

    return (
        <motion.div
            className={cn('paste-folder', disabled && 'is-disabled', className)}
            aria-label={
                documents.length === 1
                    ? `Pasted document: ${primary.title}`
                    : `${documents.length} pasted documents`
            }
            initial={{ y: '100%', opacity: 0, scale: FOLDER_SCALE }}
            animate={{ y: '0%', opacity: 1, scale: FOLDER_SCALE, transition: SLIDE }}
            exit={{ y: '100%', opacity: 0, scale: FOLDER_SCALE, transition: TUCK }}
            style={{ transformOrigin: 'bottom left' }}
        >
            <div
                onDoubleClick={() => {
                    if (!disabled) onOpenDocument?.(primary.id);
                }}
            >
                <FolderInteraction
                    documents={documents.slice(0, 3)}
                    onOpenDocument={(id) => {
                        if (!disabled) onOpenDocument?.(id);
                    }}
                />
            </div>
        </motion.div>
    );
}
