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

/** Match composer open ease — one continuous path, no spring bounce */
const FOLDER_EASE = [0.4, 0, 0.2, 1] as const;

const SLIDE_IN = {
    duration: 0.36,
    ease: FOLDER_EASE,
};

/** Soft dissolve + slight tuck under the shell */
const HIDE_OUT = {
    duration: 0.22,
    ease: FOLDER_EASE,
};

/**
 * Paste shelf host — eases up from under the composer on enter,
 * fades/tucks under the shell on collapse.
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
            initial={{ y: 48, opacity: 0, scale: 0.52 }}
            animate={{
                y: 0,
                opacity: 1,
                scale: 0.52,
                transition: SLIDE_IN,
            }}
            exit={{
                y: -10,
                opacity: 0,
                scale: 0.5,
                transition: HIDE_OUT,
            }}
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
