'use client';

import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import './folder-interaction.css';

export type FolderPageDoc = {
    id: string;
    title: string;
    text: string;
};

type FolderInteractionProps = {
    documents?: FolderPageDoc[];
    onToggle?: (open: boolean) => void;
    onOpenDocument?: (id: string) => void;
};

const PAGE_SPRING = { type: 'spring' as const, duration: 0.6 };

const PAGE_SLOTS = [
    {
        initial: { rotate: -3, x: -38, y: 2 },
        open: { rotate: -8, x: -70, y: -55 },
        transition: {
            ...PAGE_SPRING,
            bounce: 0.15,
            stiffness: 160,
            damping: 22,
        },
        className: 'z-10 shadow-md',
    },
    {
        initial: { rotate: 0, x: 0, y: 0 },
        open: { rotate: 1, x: 2, y: -75 },
        transition: {
            ...PAGE_SPRING,
            duration: 0.55,
            bounce: 0.12,
            stiffness: 190,
            damping: 24,
        },
        className: 'z-20 shadow-lg',
    },
    {
        initial: { rotate: 3.5, x: 42, y: 1 },
        open: { rotate: 9, x: 75, y: -60 },
        transition: {
            ...PAGE_SPRING,
            duration: 0.58,
            bounce: 0.17,
            stiffness: 170,
            damping: 21,
        },
        className: 'z-10 shadow-md',
    },
] as const;

/** Pick motion slots so 1→center, 2→left+right, 3→all */
function slotsForCount(count: number) {
    if (count <= 1) return [PAGE_SLOTS[1]];
    if (count === 2) return [PAGE_SLOTS[0], PAGE_SLOTS[2]];
    return PAGE_SLOTS;
}

function FolderInteraction({
    documents = [],
    onToggle,
    onOpenDocument,
}: FolderInteractionProps = {}) {
    const [isOpen, setIsOpen] = useState(false);

    const pages = useMemo(() => {
        const docs = documents.slice(0, 3);
        const slots = slotsForCount(docs.length || 1);
        if (!docs.length) {
            return slots.map((slot, i) => ({ slot, doc: null as FolderPageDoc | null, key: `empty-${i}` }));
        }
        return docs.map((doc, i) => ({
            slot: slots[i] ?? PAGE_SLOTS[1],
            doc,
            key: doc.id,
        }));
    }, [documents]);

    const setOpen = (next: boolean) => {
        setIsOpen(next);
        onToggle?.(next);
    };

    return (
        <div
            className={`folder-interaction w-full flex justify-center items-center${isOpen ? ' is-open' : ''}`}
        >
            <div className="w-80 h-52 relative wrapper folder-interaction__wrapper">
                <div className="folder folder-interaction__body relative mx-auto flex h-full w-[87.5%] items-center justify-center">
                    {pages.map(({ slot, doc, key }) => (
                        <motion.div
                            key={key}
                            initial={slot.initial}
                            animate={isOpen ? slot.open : slot.initial}
                            whileHover={
                                isOpen
                                    ? {
                                          y: slot.open.y - 16,
                                          transition: {
                                              type: 'spring',
                                              stiffness: 420,
                                              damping: 28,
                                          },
                                      }
                                    : undefined
                            }
                            transition={slot.transition}
                            className={`absolute top-2 w-32 h-fit rounded-xl folder-interaction__sheet ${slot.className}`}
                            onClick={(event) => {
                                if (!doc || !isOpen) return;
                                event.stopPropagation();
                                onOpenDocument?.(doc.id);
                            }}
                        >
                            <Page title={doc?.title} text={doc?.text} />
                        </motion.div>
                    ))}
                </div>

                <motion.div
                    animate={{ rotateX: isOpen ? -40 : 0 }}
                    transition={{ type: 'spring', duration: 0.5, bounce: 0.2 }}
                    className="absolute -left-[1px] -right-[1px] -bottom-[1px] z-20 h-44 rounded-3xl origin-bottom flex justify-center items-center overflow-visible folder-interaction__flap"
                    role="button"
                    tabIndex={0}
                    aria-label={isOpen ? 'Close folder' : 'Open folder'}
                    aria-expanded={isOpen}
                    onClick={(event) => {
                        event.stopPropagation();
                        setOpen(!isOpen);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            setOpen(!isOpen);
                        }
                    }}
                >
                    <svg
                        className="w-full h-full overflow-visible"
                        viewBox="0 0 235 121"
                        fill="none"
                        preserveAspectRatio="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <foreignObject x="-13" y="-13" width="262.4" height="148.4">
                            <div
                                style={{
                                    backdropFilter: 'blur(6.5px)',
                                    clipPath: 'url(#bgblur_0_1_106_clip_path)',
                                    height: '100%',
                                    width: '100%',
                                }}
                            ></div>
                        </foreignObject>
                        <path
                            id="Vector"
                            data-figma-bg-blur-radius="13"
                            d="M104.615 0.350494L33.1297 0.838776C32.7542 0.841362 32.3825 0.881463 32.032 0.918854C31.6754 0.956907 31.3392 0.992086 31.0057 0.992096H31.0047C30.6871 0.99235 30.3673 0.962051 30.0272 0.929596C29.6927 0.897686 29.3384 0.863802 28.9803 0.866119L13.2693 0.967682H13.2527L13.2352 0.969635C13.1239 0.981406 13.0121 0.986674 12.9002 0.986237H9.91388C8.33299 0.958599 6.76052 1.22345 5.27423 1.76651H5.27325C4.33579 2.11246 3.48761 2.66213 2.7879 3.37393L2.49689 3.68839L2.492 3.69424C1.62667 4.73882 1.00023 5.96217 0.656067 7.27725C0.653324 7.28773 0.654065 7.29886 0.652161 7.30948C0.3098 8.62705 0.257231 10.0048 0.499817 11.3446L12.2147 114.399L12.2156 114.411L12.2176 114.423C12.6046 116.568 13.7287 118.508 15.3934 119.902C17.058 121.297 19.1572 122.056 21.3231 122.049V122.05H215.379C217.76 122.02 220.064 121.192 221.926 119.698V119.697C223.657 118.384 224.857 116.485 225.305 114.35L225.307 114.339L235.914 53.3798L235.968 53.1093L235.97 53.0985L235.971 53.0888C236.134 51.8978 236.044 50.685 235.705 49.5321C235.307 48.1669 234.63 46.9005 233.717 45.8144L233.383 45.4296C232.58 44.5553 231.614 43.8449 230.539 43.3398C229.311 42.7628 227.971 42.4685 226.616 42.4774H146.746C144.063 42.4705 141.423 41.8004 139.056 40.5263C136.691 39.2522 134.671 37.4127 133.175 35.1689L113.548 5.05948L113.544 5.05362L113.539 5.04776C112.545 3.65165 111.238 2.51062 109.722 1.72061C108.266 0.886502 106.627 0.422235 104.952 0.365143V0.364166L104.633 0.350494H104.615Z"
                            fill="url(#paint0_linear_1_106)"
                            fillOpacity="0.3"
                            stroke="url(#paint1_linear_1_106)"
                            strokeWidth="0.7"
                        />
                        <defs>
                            <clipPath
                                id="bgblur_0_1_106_clip_path"
                                transform="translate(13 13)"
                            >
                                <path d="M104.615 0.350494L33.1297 0.838776C32.7542 0.841362 32.3825 0.881463 32.032 0.918854C31.6754 0.956907 31.3392 0.992086 31.0057 0.992096H31.0047C30.6871 0.99235 30.3673 0.962051 30.0272 0.929596C29.6927 0.897686 29.3384 0.863802 28.9803 0.866119L13.2693 0.967682H13.2527L13.2352 0.969635C13.1239 0.981406 13.0121 0.986674 12.9002 0.986237H9.91388C8.33299 0.958599 6.76052 1.22345 5.27423 1.76651H5.27325C4.33579 2.11246 3.48761 2.66213 2.7879 3.37393L2.49689 3.68839L2.492 3.69424C1.62667 4.73882 1.00023 5.96217 0.656067 7.27725C0.653324 7.28773 0.654065 7.29886 0.652161 7.30948C0.3098 8.62705 0.257231 10.0048 0.499817 11.3446L12.2147 114.399L12.2156 114.411L12.2176 114.423C12.6046 116.568 13.7287 118.508 15.3934 119.902C17.058 121.297 19.1572 122.056 21.3231 122.049V122.05H215.379C217.76 122.02 220.064 121.192 221.926 119.698V119.697C223.657 118.384 224.857 116.485 225.305 114.35L225.307 114.339L235.914 53.3798L235.968 53.1093L235.97 53.0985L235.971 53.0888C236.134 51.8978 236.044 50.685 235.705 49.5321C235.307 48.1669 234.63 46.9005 233.717 45.8144L233.383 45.4296C232.58 44.5553 231.614 43.8449 230.539 43.3398C229.311 42.7628 227.971 42.4685 226.616 42.4774H146.746C144.063 42.4705 141.423 41.8004 139.056 40.5263C136.691 39.2522 134.671 37.4127 133.175 35.1689L113.548 5.05948L113.544 5.05362L113.539 5.04776C112.545 3.65165 111.238 2.51062 109.722 1.72061C108.266 0.886502 106.627 0.422235 104.952 0.365143V0.364166L104.633 0.350494H104.615Z" />
                            </clipPath>
                            <linearGradient
                                id="paint0_linear_1_106"
                                x1="114.7"
                                y1="0.700104"
                                x2="114.7"
                                y2="121.7"
                                gradientUnits="userSpaceOnUse"
                            >
                                <stop className="folder-interaction__grad-fill-start" offset="0" />
                                <stop className="folder-interaction__grad-fill-end" offset="1" />
                            </linearGradient>
                            <linearGradient
                                id="paint1_linear_1_106"
                                x1="114.7"
                                y1="0.700104"
                                x2="114.7"
                                y2="121.7"
                                gradientUnits="userSpaceOnUse"
                            >
                                <stop className="folder-interaction__grad-stroke-start" offset="0" stopOpacity="0.08" />
                                <stop className="folder-interaction__grad-stroke-end" offset="1" stopOpacity="0.35" />
                            </linearGradient>
                        </defs>
                    </svg>
                </motion.div>
            </div>
        </div>
    );
}

export default FolderInteraction;

/** Same outer size as before — text fills the sheet, clipped inside */
const Page = ({ title, text }: { title?: string; text?: string }) => (
    <div className="folder-interaction__page w-full h-full bg-gradient-to-b from-[#E8E7F0] to-[#DCDAE8] rounded-xl shadow-lg p-3 sm:p-4">
        {title || text ? (
            <div className="folder-interaction__page-copy">
                {title ? (
                    <p className="folder-interaction__page-title">{title}</p>
                ) : null}
                {text ? (
                    <p className="folder-interaction__page-text">{text}</p>
                ) : null}
            </div>
        ) : (
            <div className="folder-interaction__page-lines flex flex-col gap-1.5 sm:gap-2">
                <div className="folder-interaction__line folder-interaction__line--full w-full h-1 sm:h-1.5 bg-[#CFCDE0] rounded-full" />
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="folder-interaction__line-row flex gap-1.5 sm:gap-2">
                        <div className="folder-interaction__line flex-1 h-1 sm:h-1.5 bg-[#CFCDE0] rounded-full" />
                        <div className="folder-interaction__line flex-1 h-1 sm:h-1.5 bg-[#CFCDE0] rounded-full" />
                    </div>
                ))}
            </div>
        )}
        <div className="folder-interaction__page-fade" aria-hidden="true">
            <span className="folder-interaction__page-fade-step" />
            <span className="folder-interaction__page-fade-step" />
            <span className="folder-interaction__page-fade-step" />
            <span className="folder-interaction__page-fade-step" />
        </div>
    </div>
);
