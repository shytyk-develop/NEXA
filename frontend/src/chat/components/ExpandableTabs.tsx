import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

type Tab = {
    title: string;
    icon: LucideIcon;
    id?: string;
    rail?: string;
    action?: boolean;
    className?: string;
    type?: never;
};

type Separator = {
    type: 'separator';
    title?: never;
    icon?: never;
};

export type ExpandableTabItem = Tab | Separator;

type ExpandableTabsProps = {
    tabs: ExpandableTabItem[];
    className?: string;
    id?: string;
    label?: string;
    activeIndex?: number;
    onChange?: (index: number | null) => void;
};

type HighlightBounds = {
    top: number;
    left: number;
    width: number;
    height: number;
};

const SWAP_MOTION = {
    initial: { opacity: 0, y: 8, filter: 'blur(5px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.18, ease: 'easeOut' as const },
};

function isTab(item: ExpandableTabItem): item is Tab {
    return item.type !== 'separator';
}

export function ExpandableTabs({
    tabs,
    className = '',
    id,
    label,
    activeIndex = 0,
    onChange,
}: ExpandableTabsProps) {
    const [selected, setSelected] = useState(activeIndex);
    const [captionWidth, setCaptionWidth] = useState<number | undefined>();
    const [highlightBounds, setHighlightBounds] = useState<HighlightBounds | null>(null);
    const sizerRef = useRef<HTMLSpanElement>(null);
    const navRef = useRef<HTMLElement>(null);
    const skipEnter = useRef(true);
    const reduceMotion = useReducedMotion() === true;
    const items = tabs
        .map((tab, index) => ({ tab, index }))
        .filter((entry): entry is { tab: Tab; index: number } => isTab(entry.tab));
    const current = tabs[selected];
    const caption = current && isTab(current) ? current.title : 'Chats';
    const longestCaption = useMemo(
        () => items.reduce((max, { tab }) => (tab.title.length > max.length ? tab.title : max), 'Settings'),
        [items],
    );

    useEffect(() => {
        setSelected(activeIndex);
    }, [activeIndex]);

    useEffect(() => {
        skipEnter.current = false;
    }, []);

    useLayoutEffect(() => {
        const next = sizerRef.current?.offsetWidth;
        if (next != null) setCaptionWidth(next);
    }, [longestCaption]);

    const setHighlightFromElement = useCallback((element: HTMLElement | null) => {
        const container = navRef.current;
        if (!(element && container)) return;

        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();

        setHighlightBounds({
            top: elementRect.top - containerRect.top + container.scrollTop,
            left: elementRect.left - containerRect.left + container.scrollLeft,
            width: elementRect.width,
            height: elementRect.height,
        });
    }, []);

    const handleSelect = (index: number) => {
        setSelected(index);
        onChange?.(index);
    };

    const spring = reduceMotion
        ? { duration: 0 }
        : { type: 'spring' as const, stiffness: 500, damping: 40 };

    return (
        <nav
            ref={navRef}
            id={id}
            className={`sidebar-dock expandable-tabs${className ? ` ${className}` : ''}`}
            aria-label={label}
            onMouseLeave={() => setHighlightBounds(null)}
        >
            <AnimatePresence>
                {highlightBounds ? (
                    <motion.div
                        key="dock-highlight"
                        className="expandable-tabs__highlight"
                        aria-hidden="true"
                        initial={{
                            opacity: 0,
                            top: highlightBounds.top,
                            left: highlightBounds.left,
                            width: highlightBounds.width,
                            height: highlightBounds.height,
                        }}
                        animate={{
                            opacity: 1,
                            top: highlightBounds.top,
                            left: highlightBounds.left,
                            width: highlightBounds.width,
                            height: highlightBounds.height,
                        }}
                        exit={{ opacity: 0 }}
                        transition={spring}
                    />
                ) : null}
            </AnimatePresence>
            {items.map(({ tab, index }) => {
                const Icon = tab.icon;
                const isSelected = selected === index;
                const isActive = !tab.action && activeIndex === index;
                const classes = [
                    'expandable-tabs__btn',
                    'sidebar-dock__item',
                    tab.className || '',
                    isSelected ? 'is-selected' : '',
                    isActive ? 'is-active' : '',
                ].filter(Boolean).join(' ');

                return (
                    <button
                        key={tab.title}
                        id={tab.id}
                        type="button"
                        title={tab.title}
                        aria-label={tab.title}
                        aria-current={isActive ? 'page' : undefined}
                        data-rail={tab.rail}
                        onClick={() => handleSelect(index)}
                        onMouseEnter={(event) => setHighlightFromElement(event.currentTarget)}
                        onFocus={(event) => setHighlightFromElement(event.currentTarget)}
                        className={classes}
                    >
                        <Icon size={20} strokeWidth={1.75} />
                    </button>
                );
            })}
            <div className="expandable-tabs__sep" aria-hidden="true" />
            <span
                className="expandable-tabs__caption"
                aria-hidden="true"
                style={captionWidth != null ? { width: captionWidth } : undefined}
            >
                <span ref={sizerRef} className="expandable-tabs__caption-sizer">
                    {longestCaption}
                </span>
                <motion.span
                    key={caption}
                    className="expandable-tabs__caption-text"
                    initial={skipEnter.current ? false : SWAP_MOTION.initial}
                    animate={SWAP_MOTION.animate}
                    transition={SWAP_MOTION.transition}
                >
                    {caption}
                </motion.span>
            </span>
        </nav>
    );
}
