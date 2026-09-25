import type React from 'react';
import { cn } from '@/lib/utils';

// Empty state building blocks (adapted from the cnippet "Empty" snippet in
// DraftComponents.tsx): same parts and props, default media variant only, and
// colours from the theme tokens (.empty-state* in public/css/peer-panel.css)
// since this Tailwind theme has no muted / card / heading tokens.

export function Empty({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn(
                'empty-state flex min-w-0 flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center',
                className,
            )}
            data-slot="empty"
            {...props}
        />
    );
}

export function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('flex max-w-sm flex-col items-center text-center', className)}
            data-slot="empty-header"
            {...props}
        />
    );
}

export function EmptyMedia({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('relative mb-6 flex shrink-0 items-center justify-center', className)}
            data-slot="empty-media"
            {...props}
        />
    );
}

export function EmptyTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('empty-state__title', className)}
            data-slot="empty-title"
            {...props}
        />
    );
}

export function EmptyDescription({ className, ...props }: React.ComponentProps<'p'>) {
    return (
        <p
            className={cn('empty-state__description', className)}
            data-slot="empty-description"
            {...props}
        />
    );
}

export function EmptyContent({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-sm', className)}
            data-slot="empty-content"
            {...props}
        />
    );
}
