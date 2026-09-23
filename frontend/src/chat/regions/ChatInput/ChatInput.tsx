import {
    type FocusEvent,
    type KeyboardEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { motion } from 'motion/react';
import { peekChatEngine } from '../../engine/chatEngine';
import { Icon } from '../../components/Icon';
import { cn } from '@/lib/utils';

const EMOJIS = ['😀', '🚀', '🔥', '✨', '❤️', '👍', '🤔', '🎉'] as const;

/** Smooth open/close — no bounce/overshoot */
const OPEN_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const OPEN_TRANSITION = `max-width 0.35s ${OPEN_EASING}, height 0.35s ${OPEN_EASING}`;
const SMOOTH_HEIGHT_TRANSITION = `max-width 0.35s ${OPEN_EASING}, height 0.15s ease-out`;
const SPRING_SOFT = { type: 'spring' as const, stiffness: 380, damping: 40, mass: 0.9 };

const COLLAPSED_MAX_WIDTH = 320;
const EXPANDED_MAX_WIDTH = 560;
const COLLAPSED_HEIGHT = 48;
const TEXTAREA_MIN = 50;
const TEXTAREA_MAX = 160;
const TEXTAREA_MAX_TALL = TEXTAREA_MAX * 2;
/** Reserved space under the textarea for attach/emoji/send — keeps text from clipping into actions */
const ACTIONS_BAND = 48;
const EXPANDED_MIN_HEIGHT = 96;
const BOTTOM_FADE_H = 22;

type ChatInputProps = {
    onSend?: () => void;
};

function readComposerFlags(input: HTMLTextAreaElement | null) {
    const paste = document.getElementById('uiPasteAttachments');
    const reply = document.getElementById('uiReplyBar');
    const hasPaste = Boolean(paste && !paste.classList.contains('hidden') && paste.childElementCount > 0);
    const hasReply = Boolean(reply?.dataset.active === 'true');
    const hasText = Boolean(input?.value.trim());
    const disabled = Boolean(input?.disabled);
    return { hasPaste, hasReply, hasText, disabled, hasContent: hasText || hasPaste };
}

export function ChatInput({ onSend }: ChatInputProps) {
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const shellRef = useRef<HTMLDivElement>(null);
    const dockRef = useRef<HTMLDivElement>(null);
    const topFadeRef = useRef<HTMLDivElement>(null);
    const bottomFadeRef = useRef<HTMLDivElement>(null);

    const [expanded, setExpanded] = useState(false);
    const [isSmoothResize, setIsSmoothResize] = useState(false);
    const [hasContent, setHasContent] = useState(false);
    const [hasShelf, setHasShelf] = useState(false);
    const [hasReply, setHasReply] = useState(false);
    const [disabled, setDisabled] = useState(true);
    const [textareaHeight, setTextareaHeight] = useState(TEXTAREA_MIN);
    const [scrolling, setScrolling] = useState(false);
    const [editorTall, setEditorTall] = useState(false);

    const textareaMax = editorTall ? TEXTAREA_MAX_TALL : TEXTAREA_MAX;
    // Derive shell from textarea in the same render — never grow the shell alone.
    const shellHeight = expanded
        ? Math.max(EXPANDED_MIN_HEIGHT, textareaHeight + ACTIONS_BAND)
        : COLLAPSED_HEIGHT;
    const showTallToggle = expanded && (scrolling || editorTall || textareaHeight >= TEXTAREA_MAX - 2);

    const syncMeta = useCallback(() => {
        const flags = readComposerFlags(inputRef.current);
        setHasContent(flags.hasContent);
        setHasShelf(flags.hasPaste);
        setHasReply(flags.hasReply);
        setDisabled(flags.disabled);
        return flags;
    }, []);

    const updateFades = useCallback(() => {
        const el = inputRef.current;
        if (!el) return;
        const { scrollTop, scrollHeight, clientHeight } = el;
        const canScroll = scrollHeight > clientHeight + 2;
        if (!canScroll) {
            if (topFadeRef.current) topFadeRef.current.style.opacity = '0';
            if (bottomFadeRef.current) bottomFadeRef.current.style.opacity = '0';
            return;
        }
        if (topFadeRef.current) {
            topFadeRef.current.style.opacity =
                scrollTop > 2 ? String(Math.min(0.25 + scrollTop / 18, 0.85)) : '0';
        }
        // Bottom fade replaces padding-bottom: solid fill at the edge, soft above.
        // Always on while overflowing so the last line eases into the action band.
        if (bottomFadeRef.current) {
            const remain = Math.max(0, scrollHeight - clientHeight - scrollTop);
            bottomFadeRef.current.style.opacity =
                remain > 2
                    ? String(Math.min(0.55 + remain / 16, 1))
                    : '0.92';
        }
    }, []);

    const keepCaretVisible = useCallback(() => {
        const el = inputRef.current;
        if (!el) return;
        const atEnd = el.selectionStart >= el.value.length - 1;
        if (atEnd) {
            el.scrollTop = el.scrollHeight;
        }
        updateFades();
    }, [updateFades]);

    const measureTextarea = useCallback(() => {
        const el = inputRef.current;
        if (!el) return TEXTAREA_MIN;

        const maxH = editorTall ? TEXTAREA_MAX_TALL : TEXTAREA_MAX;
        const prevHeight = el.style.height;
        const prevMax = el.style.maxHeight;
        const prevTransition = el.style.transition;
        // Probe scrollHeight without committing a snapped height — React styles
        // own the animated height so shell + textarea stay locked together.
        el.style.transition = 'none';
        el.style.maxHeight = 'none';
        el.style.height = '0px';
        const scrollH = el.scrollHeight;
        el.style.height = prevHeight;
        el.style.maxHeight = prevMax;
        void el.offsetHeight;
        el.style.transition = prevTransition;

        // Tall mode stays pinned at full height; content scrolls when it overflows.
        // Normal mode grows with content up to TEXTAREA_MAX.
        const next = editorTall
            ? maxH
            : Math.max(TEXTAREA_MIN, Math.min(scrollH, maxH));
        setTextareaHeight(next);
        setScrolling(scrollH > maxH);
        requestAnimationFrame(() => {
            keepCaretVisible();
        });
        return next;
    }, [editorTall, keepCaretVisible]);

    const openComposer = useCallback(() => {
        if (inputRef.current?.disabled) return;
        setIsSmoothResize(false);
        setExpanded(true);
        // Focus immediately so spring open + caret land together (PromptInput uses 50ms delay).
        requestAnimationFrame(() => {
            const el = inputRef.current;
            if (!el || el.disabled) return;
            el.focus({ preventScroll: true });
            const len = el.value.length;
            el.setSelectionRange(len, len);
        });
    }, []);

    const closeComposer = useCallback(() => {
        // Only the explicit close control collapses the field (keeps draft text).
        setIsSmoothResize(false);
        setEditorTall(false);
        setExpanded(false);
        inputRef.current?.blur();
    }, []);

    const toggleEditorTall = useCallback(() => {
        setIsSmoothResize(false);
        const el = inputRef.current;
        const next = !editorTall;
        const maxH = next ? TEXTAREA_MAX_TALL : TEXTAREA_MAX;
        let nextHeight = TEXTAREA_MIN;
        if (el) {
            // Measure content size without writing height — React owns both
            // textarea + shell heights in the same commit so they stay in sync.
            const prevHeight = el.style.height;
            const prevTransition = el.style.transition;
            const prevMax = el.style.maxHeight;
            el.style.transition = 'none';
            el.style.maxHeight = 'none';
            el.style.height = '0px';
            const scrollH = el.scrollHeight;
            el.style.height = prevHeight;
            el.style.maxHeight = prevMax;
            void el.offsetHeight;
            el.style.transition = prevTransition;
            // Tall mode locks the full viewport; shrink fits content again.
            nextHeight = next
                ? maxH
                : Math.max(TEXTAREA_MIN, Math.min(scrollH, maxH));
            setScrolling(scrollH > maxH);
        } else if (next) {
            nextHeight = maxH;
        }
        setTextareaHeight(nextHeight);
        setEditorTall(next);
        requestAnimationFrame(() => {
            inputRef.current?.focus({ preventScroll: true });
            requestAnimationFrame(() => keepCaretVisible());
        });
    }, [editorTall, keepCaretVisible]);

    useEffect(() => {
        syncMeta();
    }, [syncMeta]);

    // Fade overlays track the textarea viewport; clear when collapsed.
    useEffect(() => {
        if (!expanded) {
            if (topFadeRef.current) topFadeRef.current.style.opacity = '0';
            if (bottomFadeRef.current) bottomFadeRef.current.style.opacity = '0';
            return;
        }
        // After height commits, pin caret and refresh edge masks.
        requestAnimationFrame(() => keepCaretVisible());
    }, [expanded, textareaHeight, keepCaretVisible]);

    // Focus after expand spring
    useEffect(() => {
        if (!expanded || disabled) return;
        const timer = window.setTimeout(() => {
            const el = inputRef.current;
            if (!el) return;
            el.focus({ preventScroll: true });
            const len = el.value.length;
            el.setSelectionRange(len, len);
        }, 50);
        return () => window.clearTimeout(timer);
    }, [expanded, disabled]);

    // Remeasure when opening — tall toggle sets height itself (avoid snapping
    // the textarea while the shell height is still transitioning).
    useEffect(() => {
        if (!expanded) return;
        measureTextarea();
        // intentionally only on expand; measureTextarea identity changes with editorTall
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expanded]);

    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;

        const onInput = () => {
            setIsSmoothResize(true);
            syncMeta();
            measureTextarea();
            if (!input.disabled && (input.value.trim() || readComposerFlags(input).hasPaste)) {
                setIsSmoothResize(false);
                setExpanded(true);
            }
        };
        const onFocus = () => {
            if (!input.disabled) {
                setIsSmoothResize(false);
                setExpanded(true);
            }
        };
        const onResizeEvent = () => {
            setIsSmoothResize(true);
            measureTextarea();
            syncMeta();
        };

        input.addEventListener('input', onInput);
        input.addEventListener('focus', onFocus);
        input.addEventListener('nexa:composer-resize', onResizeEvent);
        const onOpenEvent = () => {
            if (!input.disabled) openComposer();
        };
        input.addEventListener('nexa:composer-open', onOpenEvent);

        const attrObserver = new MutationObserver(() => {
            const flags = syncMeta();
            if (flags.disabled) {
                setIsSmoothResize(false);
                setEditorTall(false);
                setExpanded(false);
            }
            measureTextarea();
        });
        attrObserver.observe(input, { attributes: true, attributeFilter: ['disabled'] });

        const paste = document.getElementById('uiPasteAttachments');
        const reply = document.getElementById('uiReplyBar');
        const shelfObserver = new MutationObserver(() => {
            const flags = syncMeta();
            if (flags.hasPaste || flags.hasReply) {
                setIsSmoothResize(false);
                setExpanded(true);
            }
            measureTextarea();
        });
        if (paste) shelfObserver.observe(paste, { attributes: true, childList: true, subtree: true });

        const onReplyEvent = (event: Event) => {
            const active = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
            setHasReply(active);
            if (active && !input.disabled) {
                setIsSmoothResize(false);
                setExpanded(true);
                requestAnimationFrame(() => {
                    input.focus({ preventScroll: true });
                });
            }
            syncMeta();
        };
        reply?.addEventListener('nexa:composer-reply', onReplyEvent);

        return () => {
            input.removeEventListener('input', onInput);
            input.removeEventListener('focus', onFocus);
            input.removeEventListener('nexa:composer-resize', onResizeEvent);
            input.removeEventListener('nexa:composer-open', onOpenEvent);
            reply?.removeEventListener('nexa:composer-reply', onReplyEvent);
            attrObserver.disconnect();
            shelfObserver.disconnect();
        };
    }, [syncMeta, measureTextarea, openComposer]);

    const onBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
        if (dockRef.current?.contains(event.relatedTarget as Node)) return;
        // Outside blur no longer collapses — only the close (×) control does.
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        const engine = peekChatEngine();
        const enterToSend = Boolean(engine?.state.preferences?.enterToSend);
        const primary = event.metaKey || event.ctrlKey;
        if (event.key === 'Enter' && !event.shiftKey && (enterToSend || primary)) {
            event.preventDefault();
            setIsSmoothResize(false);
            onSend?.();
            requestAnimationFrame(() => {
                syncMeta();
                // Stay expanded after send — collapse only via ×.
            });
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            inputRef.current?.blur();
        }
    };

    const canSend = hasContent && !disabled;
    const dockMaxWidth = expanded ? EXPANDED_MAX_WIDTH : COLLAPSED_MAX_WIDTH;
    const dockTransition = isSmoothResize
        ? 'max-width 0.15s ease-out'
        : `max-width 0.35s ${OPEN_EASING}`;
    const shellTransition = isSmoothResize ? SMOOTH_HEIGHT_TRANSITION : OPEN_TRANSITION;
    const fieldTransition = isSmoothResize
        ? 'height 0.15s ease-out'
        : `opacity 0.3s ease-out, transform 0.3s ease-out, height 0.35s ${OPEN_EASING}`;
    const labelTransition = isSmoothResize
        ? 'none'
        : `opacity 0.3s ease-out, transform 0.35s ${OPEN_EASING}`;

    return (
        <div className="input-bar">
            <div
                id="uiPasteAttachments"
                className={cn('paste-attachments', !hasShelf && 'hidden')}
                aria-hidden={hasShelf ? 'false' : 'true'}
                aria-label="Pasted text"
            />
            <span id="uiDraftStatus" className="composer-status hidden" aria-live="polite" />

            <div className="composer-input-dock" ref={dockRef} onBlur={onBlurCapture}>
                <div
                    className="composer-scale-wrap"
                    style={{
                        maxWidth: dockMaxWidth,
                        transition: dockTransition,
                    }}
                >
                    <div
                        id="uiReplyBar"
                        className={cn(
                            'composer-reply-bar',
                            (!hasReply || !expanded) && 'hidden',
                        )}
                        aria-live="polite"
                        aria-hidden={!hasReply || !expanded}
                    >
                        <div className="composer-reply-accent" aria-hidden="true" />
                        <div className="composer-reply-body">
                            <p id="uiReplyLabel" className="composer-reply-label">Reply</p>
                            <p id="uiReplyPreview" className="composer-reply-preview" />
                        </div>
                        <button
                            id="uiReplyCloseBtn"
                            type="button"
                            className="composer-reply-close"
                            title="Cancel reply"
                            aria-label="Cancel reply"
                        >
                            <Icon href="#icon-x" />
                        </button>
                    </div>

                    <div
                        ref={shellRef}
                        className={cn(
                            'composer-shell input-row',
                            expanded && 'is-expanded',
                            disabled && 'is-disabled',
                            hasShelf && 'has-shelf',
                            hasReply && expanded && 'has-reply',
                        )}
                        style={{
                            height: expanded ? shellHeight : COLLAPSED_HEIGHT,
                            transition: shellTransition,
                            overflow: 'hidden',
                        }}
                        onMouseDown={(event) => {
                            if (!expanded || disabled) return;
                            if (event.target === inputRef.current) return;
                            if ((event.target as HTMLElement).closest('button, a, input, textarea, .composer-emoji-picker')) return;
                            event.preventDefault();
                            inputRef.current?.focus({ preventScroll: true });
                        }}
                    >
                        <textarea
                            ref={inputRef}
                            id="messageInput"
                            placeholder="Type a message…"
                            rows={1}
                            maxLength={2000}
                            disabled
                            onKeyDown={onKeyDown}
                            onScroll={updateFades}
                            style={{
                                height: expanded ? textareaHeight : COLLAPSED_HEIGHT,
                                maxHeight: expanded ? textareaMax : COLLAPSED_HEIGHT,
                                overflowY: scrolling ? 'auto' : 'hidden',
                                transition: fieldTransition,
                            }}
                            className={cn(
                                'composer-textarea',
                                scrolling && 'is-scrolling',
                                expanded ? 'is-visible' : 'is-ghost',
                            )}
                            aria-label="Message"
                        />

                        <div
                            ref={topFadeRef}
                            className="composer-field__fade composer-field__fade--top"
                            aria-hidden="true"
                        />
                        <div
                            ref={bottomFadeRef}
                            className="composer-field__fade composer-field__fade--bottom"
                            aria-hidden="true"
                            style={{
                                top: Math.max(0, (expanded ? textareaHeight : 0) - BOTTOM_FADE_H),
                                height: BOTTOM_FADE_H,
                                transition: isSmoothResize
                                    ? 'top 0.15s ease-out, opacity 0.15s ease'
                                    : `top 0.35s ${OPEN_EASING}, opacity 0.15s ease`,
                            }}
                        />

                        <button
                            type="button"
                            className={cn('composer-close-btn', expanded && 'is-visible')}
                            title="Close composer"
                            aria-label="Close message composer"
                            tabIndex={expanded ? 0 : -1}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                                e.stopPropagation();
                                closeComposer();
                            }}
                        >
                            <Icon href="#icon-x" />
                        </button>

                        <button
                            type="button"
                            className={cn(
                                'composer-tall-toggle',
                                showTallToggle && 'is-visible',
                                editorTall && 'is-tall',
                            )}
                            title={editorTall ? 'Shrink editor' : 'Expand editor'}
                            aria-label={editorTall ? 'Shrink message editor' : 'Expand message editor'}
                            aria-pressed={editorTall}
                            tabIndex={showTallToggle ? 0 : -1}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleEditorTall();
                            }}
                        >
                            <Icon href={editorTall ? '#icon-collapse-diag' : '#icon-expand-diag'} />
                        </button>

                        <button
                            type="button"
                            className={cn('composer-collapsed-label', expanded && 'is-hidden')}
                            style={{ transition: labelTransition }}
                            onClick={(event) => {
                                event.stopPropagation();
                                openComposer();
                            }}
                            disabled={disabled}
                            aria-label="Open message composer"
                            tabIndex={expanded ? -1 : 0}
                        >
                            Type a message…
                        </button>

                        <div
                            className={cn(
                                'composer-actions',
                                expanded ? 'is-actions-visible' : 'is-actions-hidden',
                            )}
                        >
                            <button
                                id="uiAttachBtn"
                                className="composer-tool-btn"
                                type="button"
                                title="Attach file"
                                aria-label="Attach file"
                                disabled
                                tabIndex={expanded ? 0 : -1}
                                onMouseDown={(e) => e.preventDefault()}
                            >
                                <Icon href="#icon-paperclip" />
                            </button>
                            <input id="uiFileInput" className="hidden" type="file" multiple />

                            <div className="composer-emoji-wrap">
                                <button
                                    id="uiEmojiBtn"
                                    className="composer-tool-btn"
                                    type="button"
                                    title="Insert emoji"
                                    aria-label="Insert emoji"
                                    aria-expanded="false"
                                    aria-haspopup="true"
                                    disabled
                                    tabIndex={expanded ? 0 : -1}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    <Icon href="#icon-smile" />
                                </button>
                                <div id="uiEmojiPicker" className="composer-emoji-picker hidden" role="listbox" aria-label="Emoji">
                                    {EMOJIS.map((emoji) => (
                                        <button key={emoji} type="button" className="composer-emoji-item" data-emoji={emoji} aria-label={emoji}>
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <span id="uiCharCounter" className="composer-char-counter" aria-live="polite">
                                0 / 2000
                            </span>

                            <button
                                id="uiComposerMenuBtn"
                                className="hidden"
                                type="button"
                                tabIndex={-1}
                                title="Message tools"
                                aria-haspopup="menu"
                                aria-label="Message tools"
                            />
                        </div>

                        <motion.button
                            id="sendBtn"
                            type="button"
                            className={cn(
                                'composer-send-btn',
                                canSend && 'is-ready',
                            )}
                            title={expanded ? 'Send message' : 'Open message composer'}
                            aria-label={expanded ? 'Send message' : 'Open message composer'}
                            disabled={expanded && !canSend}
                            tabIndex={expanded && !canSend ? -1 : 0}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                            onClick={() => {
                                if (!expanded) {
                                    openComposer();
                                    return;
                                }
                                if (!canSend) return;
                                setIsSmoothResize(false);
                                onSend?.();
                                requestAnimationFrame(() => {
                                    syncMeta();
                                    // Stay expanded after send — collapse only via ×.
                                });
                            }}
                            whileTap={canSend || !expanded ? { scale: 0.92 } : undefined}
                            transition={SPRING_SOFT}
                        >
                            <span className="composer-send-btn__icon">
                                <Icon href="#icon-arrow-up" />
                            </span>
                        </motion.button>
                    </div>
                </div>

            </div>

            <button
                id="uiScrollBottomBtn"
                className="chat-jump-bottom"
                type="button"
                title="Scroll to bottom"
                aria-label="Scroll to bottom"
                aria-hidden="true"
            >
                <Icon href="#icon-chevron-down" />
            </button>
        </div>
    );
}
