import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
    ChevronRight,
    CircleUser,
    MessagesSquare,
    Search,
    X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

import { normalizeUsername, searchUsers } from './api.js';
import { applyContactAvatar, getDisplayLabel } from './profile.js';
import { ingestUserRecords, resolveContactProfile } from './profileDirectory.js';

const cn = (...classes) => classes.filter(Boolean).join(' ');

let typedCharSeq = 0;

function syncTypedChars(items, nextValue) {
    const prevValue = items.map((item) => item.ch).join('');
    if (nextValue === prevValue) return items;
    if (nextValue.startsWith(prevValue)) {
        return items.concat(
            Array.from(nextValue.slice(prevValue.length), (ch) => ({
                id: `c${++typedCharSeq}`,
                ch,
            })),
        );
    }
    if (prevValue.startsWith(nextValue)) {
        return items.slice(0, nextValue.length);
    }

    let index = 0;
    const limit = Math.min(nextValue.length, prevValue.length);
    while (index < limit && nextValue[index] === prevValue[index]) index += 1;

    return items.slice(0, index).concat(
        Array.from(nextValue.slice(index), (ch) => ({
            id: `c${++typedCharSeq}`,
            ch,
        })),
    );
}

const SEARCH_MODES = {
    new: {
        id: 'new',
        label: 'New Conversations',
        placeholder: 'New Conversations',
        Icon: CircleUser,
    },
    chats: {
        id: 'chats',
        label: 'Find a chat',
        placeholder: 'Find a chat',
        Icon: MessagesSquare,
    },
    messages: {
        id: 'messages',
        label: 'Search messages',
        placeholder: 'Search messages',
        Icon: Search,
    },
};

const DEFAULT_SHORTCUTS = [
    SEARCH_MODES.new,
    SEARCH_MODES.chats,
    SEARCH_MODES.messages,
    { id: 'close', label: 'Close', Icon: X },
];

const SHORTCUT_SIZE = 52;
const SHORTCUT_GAP = 12;
const LIQUID_SPRING = {
    type: 'spring',
    duration: 0.8,
    bounce: 0.2,
};
const LIQUID_LAYOUT_SPRING = {
    type: 'spring',
    duration: 0.8,
    bounce: 0,
};
const SHORTCUT_TRANSITION = {
    scale: LIQUID_SPRING,
    x: LIQUID_SPRING,
    opacity: { type: 'spring', duration: 0.45, bounce: 0 },
    width: LIQUID_LAYOUT_SPRING,
    marginLeft: LIQUID_LAYOUT_SPRING,
};
const SWAP_MOTION = {
    initial: { opacity: 0, y: 8, filter: 'blur(5px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { duration: 0.18, ease: 'easeOut' },
};

function truncatePreview(text, max = 72) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (value.length <= max) return value;
    return `${value.slice(0, max - 1)}…`;
}

function toTimestampMs(value) {
    if (value instanceof Date) {
        const ms = value.getTime();
        return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value > 0 && value < 1e12 ? value * 1000 : value;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatSpotlightWhen(timestamp) {
    const ms = toTimestampMs(timestamp);
    if (!ms) return '';
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return '';

    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayDiff = Math.round((today - day) / 86400000);

    if (dayDiff === 0) return time;
    if (dayDiff === 1) return `Yesterday, ${time}`;

    const datePart = date.toLocaleDateString([], {
        day: 'numeric',
        month: 'short',
        ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
    });
    return `${datePart}, ${time}`;
}

function conversationPeers() {
    const fromSidebar = context.getConversations?.() || [];
    const history = context.getChatHistory?.() || {};
    const map = new Map();
    for (const chat of fromSidebar) {
        const username = normalizeUsername(chat?.username || '');
        if (username) map.set(username, chat);
    }
    for (const username of Object.keys(history)) {
        const key = normalizeUsername(username);
        if (key && !map.has(key)) map.set(key, { username: key });
    }
    return [...map.values()];
}

function mapPersonResult(user, mine) {
    const profile = resolveContactProfile(user.username, user, mine);
    const bio = (profile.bio || '').trim();
    return {
        kind: 'person',
        id: user.username,
        username: user.username,
        profile,
        label: getDisplayLabel(user.username, profile),
        description: bio || `@${user.username}`,
    };
}

function searchExistingChats(query, mine) {
    const needle = query.trim().toLowerCase();
    return conversationPeers()
        .filter((chat) => {
            const username = normalizeUsername(chat.username || '');
            if (!username || username === mine) return false;
            const profile = resolveContactProfile(username, chat, mine);
            const label = getDisplayLabel(username, profile).toLowerCase();
            return username.includes(needle) || label.includes(needle);
        })
        .slice(0, 20)
        .map((chat) => {
            const username = normalizeUsername(chat.username);
            const profile = resolveContactProfile(username, chat, mine);
            const preview = truncatePreview(chat.last_message_preview);
            return {
                kind: 'chat',
                id: username,
                username,
                profile,
                label: getDisplayLabel(username, profile),
                description: preview || `@${username}`,
            };
        });
}

function searchLocalMessages(query, mine) {
    const needle = query.trim().toLowerCase();
    const history = context.getChatHistory?.() || {};
    const hits = [];

    for (const [username, messages] of Object.entries(history)) {
        const peer = normalizeUsername(username);
        if (!peer || peer === mine || !Array.isArray(messages)) continue;
        for (const message of messages) {
            if (!message?.text || message.deleted) continue;
            if (!String(message.text).toLowerCase().includes(needle)) continue;
            hits.push({
                username: peer,
                message,
                timestamp: toTimestampMs(message.timestamp),
            });
        }
    }

    hits.sort((a, b) => b.timestamp - a.timestamp);

    return hits.slice(0, 20).map(({ username, message, timestamp }) => {
        const profile = resolveContactProfile(username, null, mine);
        const chatName = getDisplayLabel(username, profile);
        const outgoing = message.type === 'outgoing'
            || message.sender === 'You'
            || message.sender === mine;
        const who = outgoing ? 'You' : chatName;
        const when = formatSpotlightWhen(timestamp || message.timestamp);
        const parts = outgoing ? [who, chatName, when] : [who, when];
        return {
            kind: 'message',
            id: `${username}:${message.id || message.clientMessageId || timestamp}`,
            username,
            messageId: message.id,
            clientMessageId: message.clientMessageId,
            profile,
            label: truncatePreview(message.text),
            description: [...new Set(parts.filter(Boolean))].join(' · '),
        };
    });
}

let context = {};
let reactRoot = null;
let isOpen = false;
let closeOptions = {};
let renderVersion = 0;
let stateObserver = () => {};

function pageChat() {
    return document.getElementById('page-chat');
}

function spotlightHost() {
    return document.getElementById('uiComposeSpotlight');
}

function headerInner() {
    return document.querySelector('#page-chat .chat-header-inner');
}

function ensureRoot() {
    const host = document.getElementById('uiComposeReactRoot');
    if (!host) return null;
    reactRoot ||= createRoot(host);
    return reactRoot;
}

function renderSpotlight() {
    ensureRoot()?.render(
        <AppleSpotlight
            key={renderVersion}
            isOpen={isOpen}
            version={renderVersion}
            handleClose={() => closeComposeSearch({ restoreWelcome: true })}
            onSelect={(result) => {
                closeComposeSearch({ immediate: true });
                context?.onSelect?.(result);
            }}
            onExitComplete={finishClose}
        />,
    );
}

function finishClose() {
    if (isOpen) return;

    const host = spotlightHost();
    const inner = headerInner();
    if (host) {
        host.hidden = true;
        host.setAttribute('aria-hidden', 'true');
    }
    inner?.removeAttribute('aria-hidden');
    if (inner) inner.inert = false;

    context?.onClose?.();
    if (closeOptions.restoreWelcome) context?.onRestoreWelcome?.();
    closeOptions = {};
}

export function initComposeSearch(nextContext = {}) {
    context = nextContext;
    renderSpotlight();
}

export function setComposeStateObserver(observer) {
    stateObserver = typeof observer === 'function' ? observer : () => {};
}

export function isComposeSearchOpen() {
    return isOpen;
}

export function openComposeSearch() {
    const host = spotlightHost();
    const page = pageChat();
    const inner = headerInner();
    if (!host || !page) return;

    const alreadyVisible =
        isOpen &&
        !host.hidden &&
        page.classList.contains('is-compose-search');
    if (alreadyVisible) {
        document.getElementById('uiComposeSearchInput')?.focus({ preventScroll: true });
        return;
    }

    isOpen = true;
    stateObserver(true);
    closeOptions = {};
    renderVersion += 1;

    inner?.setAttribute('aria-hidden', 'true');
    if (inner) inner.inert = true;
    host.hidden = false;
    host.setAttribute('aria-hidden', 'false');
    page.classList.add('is-compose-search');
    document.getElementById('uiPeerEmpty')?.classList.remove('is-entering');
    document.getElementById('chat-welcome')?.classList.remove('hidden');
    void host.offsetWidth;

    const root = ensureRoot();
    if (root) {
        flushSync(() => {
            root.render(null);
        });
    }
    renderSpotlight();
    context?.onOpen?.();
}

export function closeComposeSearch(options = {}) {
    if (!isOpen) {
        if (options.restoreWelcome) context?.onRestoreWelcome?.();
        return;
    }

    isOpen = false;
    stateObserver(false);
    closeOptions = options;

    // Unhide welcome while compose class is still on (opacity: 0), then drop the
    // class so it fades in with the composer slide — no delayed enter animation.
    const welcome = document.getElementById('chat-welcome');
    if (options.restoreWelcome) {
        welcome?.classList.remove('hidden');
        void welcome?.offsetWidth;
    } else {
        welcome?.classList.add('hidden');
    }

    pageChat()?.classList.remove('is-compose-search');
    document.getElementById('uiPeerEmpty')?.classList.remove('is-entering');

    if (options.immediate) {
        renderVersion += 1;
        const root = ensureRoot();
        if (root) {
            flushSync(() => {
                root.render(null);
            });
        }
        finishClose();
        return;
    }

    renderSpotlight();
}

function SVGFilter() {
    return (
        <svg width="0" height="0" aria-hidden="true">
            <filter id="compose-blob">
                <feGaussianBlur stdDeviation="10" in="SourceGraphic" />
                <feColorMatrix
                    values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 18 -9
            "
                    result="blob"
                />
                <feBlend in="SourceGraphic" in2="blob" />
            </filter>
        </svg>
    );
}

function ShortcutButton({
    icon,
    label,
    onClick,
    active = false,
    close = false,
    onHoverStart,
    onHoverEnd,
}) {
    return (
        <button
            type="button"
            className={cn(
                'compose-react-shortcut-button',
                active && 'is-active',
                close && 'is-close',
            )}
            title={label}
            aria-label={label}
            aria-pressed={active}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={onHoverStart}
            onMouseLeave={onHoverEnd}
            onClick={onClick}
        >
            {active ? (
                <motion.span
                    layoutId="compose-shortcut-active"
                    className="compose-react-shortcut-active"
                    transition={{ type: 'spring', duration: 0.42, bounce: 0.12 }}
                />
            ) : null}
            <span className="compose-react-shortcut-icon">
                {icon}
            </span>
        </button>
    );
}

function SpotlightPlaceholder({ text, className }) {
    return (
        <div className={cn('compose-react-placeholder', className)}>
            <motion.p key={text} {...SWAP_MOTION}>
                {text}
            </motion.p>
        </div>
    );
}

function SpotlightLeadIcon({ icon: Icon, swapKey }) {
    return (
        <div className="compose-react-search-icon" aria-hidden="true">
            <motion.span
                key={swapKey}
                className="compose-react-search-icon-swap"
                {...SWAP_MOTION}
            >
                {React.createElement(Icon || Search)}
            </motion.span>
        </div>
    );
}

function SpotlightInput({
    placeholder,
    hidePlaceholder,
    value,
    onChange,
    onKeyDown,
    placeholderClassName,
    LeadIcon,
    leadIconKey,
    ariaLabel,
}) {
    const inputRef = useRef(null);
    const charsRef = useRef([]);
    const typedChars = useMemo(() => {
        const next = syncTypedChars(charsRef.current, value);
        charsRef.current = next;
        return next;
    }, [value]);

    useEffect(() => {
        inputRef.current?.focus({ preventScroll: true });
    }, []);

    return (
        <div className="compose-react-input-row">
            <SpotlightLeadIcon icon={LeadIcon} swapKey={leadIconKey} />
            <div className="compose-react-input-field">
                {!hidePlaceholder && (
                    <SpotlightPlaceholder
                        text={placeholder}
                        className={placeholderClassName}
                    />
                )}
                <div className="compose-react-input-mirror" aria-hidden="true">
                    {typedChars.map((item) => (
                        <span key={item.id} className="compose-react-input-char">
                            {item.ch === ' ' ? '\u00a0' : item.ch}
                        </span>
                    ))}
                </div>
                <input
                    id="uiComposeSearchInput"
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={onKeyDown}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={ariaLabel || 'Search'}
                    enterKeyHint="search"
                    className="compose-react-input"
                />
            </div>
        </div>
    );
}

function ContactAvatar({ username, profile }) {
    const ref = useRef(null);

    useEffect(() => {
        if (ref.current) applyContactAvatar(ref.current, username, profile);
    }, [profile, username]);

    return <div ref={ref} className="contact-avatar compose-react-result-avatar" />;
}

function SearchResultCard({ result, isLast, isActive, onSelect }) {
    return (
        <button
            type="button"
            className={cn(
                'compose-react-result-card',
                isLast && 'is-last',
                isActive && 'is-active',
                result.kind && `is-${result.kind}`,
            )}
            onClick={onSelect}
        >
            <ContactAvatar
                username={result.username}
                profile={result.profile}
            />
            <span className="compose-react-result-copy">
                <span className="compose-react-result-label">{result.label}</span>
                <span className="compose-react-result-description">
                    {result.description}
                </span>
            </span>
            <span className="compose-react-result-chevron" aria-hidden="true">
                <ChevronRight />
            </span>
        </button>
    );
}

function SearchResultsContainer({
    searchResults,
    status,
    hoveredIndex,
    onHover,
    onSelect,
}) {
    return (
        <div
            onMouseLeave={() => onHover(null)}
            className="compose-react-results"
        >
            {status ? (
                <p key={status} className="compose-react-results-status">
                    {status}
                </p>
            ) : (
                searchResults.map((result, index) => (
                    <div
                        key={result.id || result.username}
                        onMouseEnter={() => onHover(index)}
                        className="compose-react-result-enter"
                        style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
                    >
                        <SearchResultCard
                            result={result}
                            isLast={index === searchResults.length - 1}
                            isActive={hoveredIndex === index}
                            onSelect={() => onSelect(result)}
                        />
                    </div>
                ))
            )}
        </div>
    );
}

function AppleSpotlight({
    shortcuts = DEFAULT_SHORTCUTS,
    isOpen: openProp = true,
    handleClose = () => {},
    onSelect = () => {},
    onExitComplete = () => {},
    version,
}) {
    const [hoveredSearchResult, setHoveredSearchResult] = useState(null);
    const [hoveredShortcut, setHoveredShortcut] = useState(null);
    const [activeMode, setActiveMode] = useState('new');
    const [searchValue, setSearchValue] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [status, setStatus] = useState('');
    const [entered, setEntered] = useState(false);
    const [resultsMounted, setResultsMounted] = useState(false);
    const resultsOpen = Boolean(searchValue);
    const showShortcuts = !searchValue;
    const selectedMode = SEARCH_MODES[activeMode] || SEARCH_MODES.new;
    const hoveredMode = hoveredShortcut !== null ? shortcuts[hoveredShortcut] : null;
    const previewMode = hoveredMode || selectedMode;
    const placeholder = previewMode.placeholder || previewMode.label;
    const PreviewIcon = previewMode.Icon;

    useEffect(() => {
        setEntered(true);
    }, []);

    useEffect(() => {
        if (resultsOpen) {
            setResultsMounted(true);
            return undefined;
        }
        const timer = window.setTimeout(() => setResultsMounted(false), 280);
        return () => window.clearTimeout(timer);
    }, [resultsOpen]);

    useEffect(() => {
        setHoveredSearchResult(null);
        setHoveredShortcut(null);
        setActiveMode('new');
        setSearchValue('');
        setSearchResults([]);
        setStatus('');
    }, [version]);

    useEffect(() => {
        const raw = searchValue;
        const peopleQuery = normalizeUsername(raw);
        const textQuery = raw.trim();

        if (!raw) {
            setSearchResults([]);
            setStatus('');
            return undefined;
        }

        const mine = context?.getMyUsername?.() || '';

        if (activeMode === 'chats') {
            if (!textQuery) {
                setSearchResults([]);
                setStatus('');
                return undefined;
            }
            const peers = conversationPeers().filter((chat) => {
                const username = normalizeUsername(chat.username || '');
                return username && username !== mine;
            });
            if (!peers.length) {
                setSearchResults([]);
                setStatus('No chats yet');
                setHoveredSearchResult(null);
                return undefined;
            }
            const mapped = searchExistingChats(textQuery, mine);
            setSearchResults(mapped);
            setStatus(mapped.length ? '' : `No chats matching “${textQuery}”`);
            setHoveredSearchResult(mapped.length ? 0 : null);
            return undefined;
        }

        if (activeMode === 'messages') {
            if (textQuery.length < 2) {
                setSearchResults([]);
                setStatus('Keep typing…');
                return undefined;
            }
            const mapped = searchLocalMessages(textQuery, mine);
            setSearchResults(mapped);
            setStatus(mapped.length ? '' : `No messages matching “${textQuery}”`);
            setHoveredSearchResult(mapped.length ? 0 : null);
            return undefined;
        }

        if (!peopleQuery) {
            setSearchResults([]);
            setStatus('');
            return undefined;
        }
        if (peopleQuery.length < 2) {
            setSearchResults([]);
            setStatus('Keep typing…');
            return undefined;
        }

        let cancelled = false;
        setStatus('Searching…');
        const timer = window.setTimeout(async () => {
            const token = context?.getToken?.();
            if (!token) {
                if (!cancelled) setStatus('Sign in to search people.');
                return;
            }

            try {
                const users = await searchUsers(token, peopleQuery, 20);
                if (cancelled) return;

                ingestUserRecords(users);
                const existing = new Set(
                    conversationPeers().map((chat) => normalizeUsername(chat.username)),
                );
                const others = (Array.isArray(users) ? users : [])
                    .filter((user) => user?.username && user.username !== mine);
                const alreadyChatting = others.some((user) =>
                    existing.has(normalizeUsername(user.username)),
                );
                const mapped = others
                    .filter((user) => !existing.has(normalizeUsername(user.username)))
                    .map((user) => mapPersonResult(user, mine));

                setSearchResults(mapped);
                setStatus(
                    mapped.length
                        ? ''
                        : alreadyChatting
                            ? 'Already in your chats — try Find a chat'
                            : `No new people matching “${peopleQuery}”`,
                );
                setHoveredSearchResult(mapped.length ? 0 : null);
            } catch (error) {
                if (cancelled) return;
                console.error('Compose search failed:', error);
                setStatus(error?.message || 'Search failed');
                context?.onError?.(error);
            }
        }, 200);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [searchValue, activeMode]);

    const handleSearchValueChange = (value) => {
        setSearchValue(activeMode === 'new' ? normalizeUsername(value) : value);
        setHoveredSearchResult(null);
    };

    const handleShortcutClick = (shortcut) => {
        if (shortcut.id === 'close') {
            handleClose();
            return;
        }
        setActiveMode(shortcut.id);
        setHoveredShortcut(null);
        document.getElementById('uiComposeSearchInput')?.focus({ preventScroll: true });
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            handleClose();
            return;
        }
        if (!searchResults.length) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            setHoveredSearchResult((current) => {
                if (current === null) return direction > 0 ? 0 : searchResults.length - 1;
                return (current + direction + searchResults.length) % searchResults.length;
            });
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const result = searchResults[hoveredSearchResult ?? 0];
            if (result) onSelect(result);
        }
    };

    return (
        <AnimatePresence initial={true} onExitComplete={onExitComplete}>
            {openProp && entered && (
                <motion.div
                    key={version}
                    initial={{
                        opacity: 0,
                        filter: 'blur(20px)',
                        scaleX: 1.3,
                        scaleY: 1.1,
                        y: -10,
                    }}
                    animate={{
                        opacity: 1,
                        filter: 'blur(0px)',
                        scaleX: 1,
                        scaleY: 1,
                        y: 0,
                    }}
                    exit={{
                        opacity: 0,
                        filter: 'blur(20px)',
                        scaleX: 1.3,
                        scaleY: 1.1,
                        y: 10,
                    }}
                    transition={{
                        stiffness: 550,
                        damping: 50,
                        type: 'spring',
                    }}
                    className="compose-react-overlay"
                    onClick={handleClose}
                >
                    <SVGFilter />
                    <div
                        onMouseLeave={() => setHoveredShortcut(null)}
                        onClick={(event) => event.stopPropagation()}
                        className={cn(
                            'compose-spotlight__shell',
                            searchValue && 'is-compose-query',
                        )}
                        data-mode={activeMode}
                    >
                        <div className="compose-react-card">
                            <SpotlightInput
                                placeholder={placeholder}
                                hidePlaceholder={Boolean(searchValue)}
                                value={searchValue}
                                onChange={handleSearchValueChange}
                                onKeyDown={handleKeyDown}
                                LeadIcon={PreviewIcon}
                                leadIconKey={previewMode.id}
                                ariaLabel={selectedMode.label}
                            />

                            <div
                                className={cn(
                                    'compose-react-results-slot',
                                    resultsOpen && 'is-open',
                                )}
                            >
                                <div className="compose-react-results-slot__clip">
                                    {resultsMounted ? (
                                        <SearchResultsContainer
                                            searchResults={searchResults}
                                            status={status}
                                            hoveredIndex={hoveredSearchResult}
                                            onHover={setHoveredSearchResult}
                                            onSelect={onSelect}
                                        />
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <LayoutGroup id="compose-shortcuts">
                        {shortcuts.map((shortcut, index) => (
                            <motion.div
                                key={shortcut.id}
                                className={cn(
                                    'compose-react-shortcut',
                                    shortcut.id === 'close' && 'is-close',
                                    shortcut.id !== 'close'
                                        && shortcut.id === activeMode
                                        && 'is-active',
                                    !showShortcuts && 'is-away',
                                )}
                                initial={{
                                    scale: 0.7,
                                    x: -SHORTCUT_SIZE * (index + 1),
                                    width: 0,
                                    marginLeft: 0,
                                    opacity: 0,
                                }}
                                animate={
                                    showShortcuts
                                        ? {
                                              scale: 1,
                                              x: 0,
                                              width: SHORTCUT_SIZE,
                                              marginLeft: SHORTCUT_GAP,
                                              opacity: 1,
                                          }
                                        : {
                                              scale: 0.7,
                                              x: -SHORTCUT_SIZE * (index + 1),
                                              width: 0,
                                              marginLeft: 0,
                                              opacity: 0,
                                          }
                                }
                                transition={SHORTCUT_TRANSITION}
                                aria-hidden={!showShortcuts}
                            >
                                <ShortcutButton
                                    icon={React.createElement(shortcut.Icon)}
                                    label={shortcut.label}
                                    active={
                                        shortcut.id !== 'close'
                                        && shortcut.id === activeMode
                                    }
                                    close={shortcut.id === 'close'}
                                    onHoverStart={() => setHoveredShortcut(index)}
                                    onHoverEnd={() => setHoveredShortcut(null)}
                                    onClick={() => handleShortcutClick(shortcut)}
                                />
                            </motion.div>
                        ))}
                        </LayoutGroup>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
