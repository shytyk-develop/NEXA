import * as React from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';

import { cn } from '@/lib/utils';
import './drawer.css';

// Drawer (vaul), adapted from the cnippet snippet in DraftComponents.tsx: same
// parts and props. It portals to <body>, outside #page-chat, so it's styled by
// drawer.css on the theme tokens (this Tailwind theme has no background /
// muted tokens there) — light and dark themes both read right.

function Drawer({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) {
    return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
    return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
    return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Close>) {
    return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
    return <DrawerPrimitive.Overlay data-slot="drawer-overlay" className={cn('nexa-drawer__overlay', className)} {...props} />;
}

function DrawerContent({ className, children, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content>) {
    return (
        <DrawerPortal data-slot="drawer-portal">
            <DrawerOverlay />
            <DrawerPrimitive.Content data-slot="drawer-content" className={cn('nexa-drawer', className)} {...props}>
                <div className="nexa-drawer__handle" aria-hidden="true" />
                {children}
            </DrawerPrimitive.Content>
        </DrawerPortal>
    );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return <div data-slot="drawer-header" className={cn('nexa-drawer__header', className)} {...props} />;
}

function DrawerBody({ className, ...props }: React.ComponentProps<'div'>) {
    return <div data-slot="drawer-body" className={cn('nexa-drawer__body', className)} {...props} />;
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return <div data-slot="drawer-footer" className={cn('nexa-drawer__footer', className)} {...props} />;
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
    return <DrawerPrimitive.Title data-slot="drawer-title" className={cn('nexa-drawer__title', className)} {...props} />;
}

function DrawerDescription({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Description>) {
    return (
        <DrawerPrimitive.Description
            data-slot="drawer-description"
            className={cn('nexa-drawer__description', className)}
            {...props}
        />
    );
}

export {
    Drawer,
    DrawerPortal,
    DrawerOverlay,
    DrawerTrigger,
    DrawerClose,
    DrawerContent,
    DrawerHeader,
    DrawerBody,
    DrawerFooter,
    DrawerTitle,
    DrawerDescription,
};
