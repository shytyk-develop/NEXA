import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, createContext, useContext, type MouseEvent, type ReactNode } from 'react';
import {
    Bell,
    Check,
    Folder,
    Inbox,
    MessageCircle,
    MessageSquarePlus,
    Pencil,
    Plus,
    Search,
    Settings,
    Trash2,
    User,
    VolumeX,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { getAvatarHue, getDisplayLabel, getInitials } from '../../../../js/profile.js';
import { resolveContactProfile } from '../../../../js/profileDirectory.js';
import { attachHoverHighlight } from '../../../../js/hoverHighlight.js';
import { getPrivacyFlags, isChatMuted } from '../../../../js/privacy.js';
import { useChatSnapshot } from '../../hooks/useChatEngine';
import { AsideToggle } from '../../components/AsideToggle';
import { ExpandableTabs, type ExpandableTabItem } from '../../components/ExpandableTabs';
import { Icon } from '../../components/Icon';
import { StatusArc } from '../../components/StatusArc';
import { LogoutSlider } from './LogoutSlider';
import { FileTree, FileTreeItem, FileTreeList } from '@/components/ui/file-tree';
import { ScrollBlur } from '@/components/ui/scroll-blur';
import { instantHoverTransition, listHoverTransition } from '@/lib/hoverMotion';
import {
    openAppSettings,
    openProfile,
    showChatsView,
} from '../../../../js/ui.js';
import { closeComposeSearch } from '../../../../js/composeSearch.js';

type HighlightBounds = {
    top: number;
    left: number;
    width: number;
    height: number;
};

const ContactHighlightContext = createContext<((element: HTMLElement | null) => void) | null>(null);
const LibraryHighlightContext = createContext<((element: HTMLElement | null) => void) | null>(null);
/** The Inbox list's active pill: the active row reports itself (null when it stops being active). */
const LibraryActiveContext = createContext<((element: HTMLElement | null, row: HTMLElement) => void) | null>(null);

/** One spring for the Inbox active pill: rapid clicks just retarget it. */
const LIBRARY_PILL_SPRING = { type: 'spring', stiffness: 500, damping: 35, mass: 0.5 } as const;

type ChatSidebarProps = {
    onSelectChat?: (username: string) => void;
    onOpenSpotlight?: () => void;
};

type LibraryFilter = 'all' | 'unread' | 'muted' | 'work' | 'personal' | `folder:${string}`;
type FolderRoot = 'work' | 'personal';

type CustomFolder = {
    id: string;
    name: string;
    children: CustomFolder[];
};

type FolderTreeState = {
    work: CustomFolder[];
    personal: CustomFolder[];
};

/*
 * Folder structure: All → Work / Personal (fixed) → one level of subfolders.
 * Subfolders can't contain folders; expanded, they offer "+ Add Chats".
 */
const FOLDER_STORAGE_KEY = 'nexa.sidebar.custom-folders';
/** Folder id ('work' | 'personal' | custom id) → usernames added to it. */
const FOLDER_CHATS_STORAGE_KEY = 'nexa.sidebar.folder-chats';

type FolderChats = Record<string, string[]>;

/**
 * Entering / leaving "add chats" mode: the dock ↔ pick bar swap uses the same
 * duration and curve as the rows' check / padding transition
 * (--pick-mode-duration / --pick-mode-ease in app-layout.css), so it all moves
 * as one.
 */
const PICK_MODE_TRANSITION = { duration: 0.24, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };

/** Target of "add chats" mode: which folder, and its name for the banner. */
type FolderPick = { folderId: string; name: string };

function loadFolderChats(): FolderChats {
    try {
        const raw = localStorage.getItem(FOLDER_CHATS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== 'object') return {};
        const out: FolderChats = {};
        Object.entries(parsed).forEach(([id, list]) => {
            if (Array.isArray(list)) out[id] = list.filter((u): u is string => typeof u === 'string');
        });
        return out;
    } catch {
        return {};
    }
}

function saveFolderChats(map: FolderChats) {
    try {
        localStorage.setItem(FOLDER_CHATS_STORAGE_KEY, JSON.stringify(map));
    } catch {
        /* ignore quota */
    }
}

/** Sidebar filter for a folder id. */
function filterForFolder(folderId: string): LibraryFilter {
    return folderId === 'work' || folderId === 'personal' ? folderId : `folder:${folderId}`;
}

/** Folder id a filter points at, if it's a folder filter. */
function folderIdOfFilter(filter: LibraryFilter): string | null {
    if (filter === 'work' || filter === 'personal') return filter;
    if (filter.startsWith('folder:')) return filter.slice('folder:'.length);
    return null;
}

/**
 * Subfolders are one level deep. Trees saved when two levels were allowed are
 * flattened (nested folders move up next to their parent), so no folder — or
 * its chats — silently disappears.
 */
function flattenFolders(folders: CustomFolder[]): CustomFolder[] {
    const out: CustomFolder[] = [];
    const visit = (list: CustomFolder[]) => {
        list.forEach((folder) => {
            out.push({ id: folder.id, name: folder.name, children: [] });
            if (Array.isArray(folder.children)) visit(folder.children);
        });
    };
    visit(folders);
    return out;
}

function loadFolderTree(): FolderTreeState {
    try {
        const raw = localStorage.getItem(FOLDER_STORAGE_KEY);
        if (!raw) return { work: [], personal: [] };
        const parsed = JSON.parse(raw);
        return {
            work: Array.isArray(parsed?.work) ? flattenFolders(parsed.work) : [],
            personal: Array.isArray(parsed?.personal) ? flattenFolders(parsed.personal) : [],
        };
    } catch {
        return { work: [], personal: [] };
    }
}

function saveFolderTree(tree: FolderTreeState) {
    try {
        localStorage.setItem(FOLDER_STORAGE_KEY, JSON.stringify(tree));
    } catch {
        /* ignore quota */
    }
}

function makeFolderId() {
    return `fld_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function insertChild(folders: CustomFolder[], parentId: string | null, child: CustomFolder): CustomFolder[] {
    if (parentId == null) return [...folders, child];
    return folders.map((folder) => {
        if (folder.id === parentId) {
            return { ...folder, children: [...folder.children, child] };
        }
        return { ...folder, children: insertChild(folder.children, parentId, child) };
    });
}

function renameFolderInTree(folders: CustomFolder[], id: string, name: string): CustomFolder[] {
    return folders.map((folder) => {
        if (folder.id === id) return { ...folder, name };
        return { ...folder, children: renameFolderInTree(folder.children, id, name) };
    });
}

function removeFolderFromTree(folders: CustomFolder[], id: string): CustomFolder[] {
    return folders
        .filter((folder) => folder.id !== id)
        .map((folder) => ({
            ...folder,
            children: removeFolderFromTree(folder.children, id),
        }));
}

function collectFolderIds(folder: CustomFolder): string[] {
    return [folder.id, ...folder.children.flatMap(collectFolderIds)];
}

function findFolder(folders: CustomFolder[], id: string): CustomFolder | null {
    for (const folder of folders) {
        if (folder.id === id) return folder;
        const nested = findFolder(folder.children, id);
        if (nested) return nested;
    }
    return null;
}

function folderExists(folders: CustomFolder[], id: string): boolean {
    return folders.some((folder) => folder.id === id || folderExists(folder.children, id));
}

function findFolderRoot(tree: FolderTreeState, folderId: string): FolderRoot {
    return folderExists(tree.work, folderId) ? 'work' : 'personal';
}

export function ChatSidebar({ onSelectChat, onOpenSpotlight }: ChatSidebarProps) {
    const snap = useChatSnapshot();
    const chats = (snap.chats || []).filter((chat: any) => chat.username !== snap.myUsername);
    const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');
    const privacy = getPrivacyFlags(snap.preferences || {});
    const unreadTotal = chats.reduce((sum, chat) => {
        const count = snap.unreadCounts[chat.username] ?? chat.unread_count ?? 0;
        return sum + count;
    }, 0);
    const mutedTotal = chats.filter((chat) => Boolean(snap.myUsername && isChatMuted(snap.myUsername, chat.username))).length;

    // Chats explicitly added to folders (Work / Personal / custom), persisted locally.
    const [folderChats, setFolderChats] = useState<FolderChats>(() => loadFolderChats());
    useEffect(() => {
        saveFolderChats(folderChats);
    }, [folderChats]);

    const chatNames = useMemo(() => new Set(chats.map((chat: any) => chat.username as string)), [chats]);
    /** Chats in a folder that still exist in the chat list. */
    const folderCount = useCallback(
        (folderId: string) => (folderChats[folderId] || []).filter((u) => chatNames.has(u)).length,
        [folderChats, chatNames],
    );
    const foldersTotal = useMemo(() => {
        const all = new Set<string>();
        Object.values(folderChats).forEach((list) => list.forEach((u) => chatNames.has(u) && all.add(u)));
        return all.size;
    }, [folderChats, chatNames]);

    // "Add chats to <folder>" mode: the list below turns into a multi-select.
    const [picking, setPicking] = useState<FolderPick | null>(null);
    const [picked, setPicked] = useState<Set<string>>(() => new Set());

    const startPicking = useCallback(
        (folderId: string, name: string) => {
            setPicking({ folderId, name });
            setPicked(new Set(folderChats[folderId] || []));
        },
        [folderChats],
    );
    const cancelPicking = useCallback(() => setPicking(null), []);
    const savePicking = () => {
        if (!picking) return;
        const { folderId } = picking;
        setFolderChats((prev) => ({ ...prev, [folderId]: [...picked] }));
        setPicking(null);
        // Show the folder's contents right away.
        setLibraryFilter(filterForFolder(folderId));
    };
    const togglePicked = (username: string) => {
        setPicked((prev) => {
            const next = new Set(prev);
            if (next.has(username)) next.delete(username);
            else next.add(username);
            return next;
        });
    };

    const chatByName = useMemo(() => new Map(chats.map((chat: any) => [chat.username as string, chat])), [chats]);
    /** Chats in a folder, in the order they were added (missing chats skipped). */
    const folderMembers = useCallback(
        (folderId: string) =>
            (folderChats[folderId] || []).map((u) => chatByName.get(u)).filter(Boolean) as any[],
        [folderChats, chatByName],
    );
    const removeFromFolder = useCallback((folderId: string, username: string) => {
        setFolderChats((prev) => ({ ...prev, [folderId]: (prev[folderId] || []).filter((u) => u !== username) }));
    }, []);

    const onFoldersRemoved = useCallback((ids: string[]) => {
        setFolderChats((prev) => {
            const next = { ...prev };
            ids.forEach((id) => delete next[id]);
            return next;
        });
        setPicking((current) => (current && ids.includes(current.folderId) ? null : current));
    }, []);

    useEffect(() => {
        if (!picking) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') cancelPicking();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [picking, cancelPicking]);

    const visibleChats = useMemo(() => {
        const folderId = folderIdOfFilter(libraryFilter);
        const members = folderId ? new Set(folderChats[folderId] || []) : null;
        return chats.filter((chat) => {
            const unread = snap.unreadCounts[chat.username] ?? chat.unread_count ?? 0;
            const muted = Boolean(snap.myUsername && isChatMuted(snap.myUsername, chat.username));
            if (libraryFilter === 'unread') return unread > 0;
            if (libraryFilter === 'muted') return muted;
            if (members) return members.has(chat.username);
            return true;
        });
    }, [chats, libraryFilter, folderChats, snap.myUsername, snap.unreadCounts]);
    // While picking, every chat is offered (checked if already in the folder).
    const listedChats = picking ? chats : visibleChats;
    const showWelcome = !snap.loading && chats.length === 0;

    return (
        <div className="left-capsule" id="uiLeftCapsule">
            <AsideToggle
                id="uiSidebarToggle"
                side="start"
                controls="uiSidebar"
                label="Hide contacts"
            />
            <div className="left-capsule-shelf">
                <div id="uiRailCollapsedTools" className="rail-collapsed-tools" hidden>
                    <button id="uiRailMark" className="rail-mark" type="button" title="Show contacts" aria-label="Show contacts">
                        <img src="/brand/nexa-mark.png" alt="" width={40} height={40} decoding="async" />
                    </button>
                    <button id="uiRailSidebarToggle" className="rail-sidebar-toggle" type="button" title="Show contacts" aria-label="Show contacts">
                        <Icon href="#icon-panel-left" />
                    </button>
                </div>

                <aside id="uiSidebar" className="sidebar" aria-label="Navigation and contacts">
                    <SidebarHeader toggleId="uiSidebarHeaderToggle">
                        {/* Drawn as a mask so it takes the theme's text colour (see .brand-logo). */}
                        <span role="img" aria-label="NEXA" className="sidebar-brand__mark brand-logo" />
                    </SidebarHeader>

                    <section className="sidebar-chats" aria-label="Chats">
                        <SidebarLibrary
                            unreadCount={unreadTotal}
                            mutedCount={mutedTotal}
                            foldersTotal={foldersTotal}
                            folderCount={folderCount}
                            pickingFolderId={picking?.folderId ?? null}
                            onAddChats={startPicking}
                            onFoldersRemoved={onFoldersRemoved}
                            folderMembers={folderMembers}
                            onRemoveFromFolder={removeFromFolder}
                            onOpenChat={(username) => onSelectChat?.(username)}
                            activeUsername={snap.activeUsername ?? null}
                            myUsername={snap.myUsername ?? null}
                            active={libraryFilter}
                            onSelect={setLibraryFilter}
                        />
                        <div id="usersList">
                            <ScrollBlur
                                edgeVariant="mask"
                                edgeSize={32}
                                className="sidebar-scroll-blur h-full min-h-0"
                                contentClassName="sidebar-scroll-blur__content"
                            >
                                {snap.loading ? (
                                    Array.from({ length: 6 }, (_, i) => (
                                        <div key={i} className="contact-skeleton" aria-hidden="true">
                                            <span className="skeleton skeleton-avatar" />
                                            <span className="skeleton-lines">
                                                <span className="skeleton skeleton-line skeleton-line--name" />
                                                <span className="skeleton skeleton-line skeleton-line--sub" />
                                            </span>
                                        </div>
                                    ))
                                ) : listedChats.length === 0 ? (
                                    <div className="empty-state">
                                        {chats.length === 0
                                            ? 'No conversations yet'
                                            : folderIdOfFilter(libraryFilter)
                                                ? 'No chats in this folder yet — hover it and press +'
                                                : 'Nothing in this folder'}
                                    </div>
                                ) : (
                                    <ContactList>
                                        {listedChats.map((user: any) => (
                                            <ContactRow
                                                key={user.username}
                                                user={user}
                                                myUsername={snap.myUsername}
                                                active={!picking && snap.activeUsername === user.username}
                                                online={privacy.showOnlineStatus ? snap.onlineUsers.has(user.username) : null}
                                                unread={snap.unreadCounts[user.username] ?? user.unread_count ?? 0}
                                                typing={Boolean(privacy.typingIndicators && snap.typingUsers.has(user.username))}
                                                muted={Boolean(snap.myUsername && isChatMuted(snap.myUsername, user.username))}
                                                pickable={Boolean(picking)}
                                                picked={picked.has(user.username)}
                                                onTogglePick={() => togglePicked(user.username)}
                                                onSelect={() => onSelectChat?.(user.username)}
                                            />
                                        ))}
                                    </ContactList>
                                )}
                            </ScrollBlur>
                        </div>
                        <div id="uiWelcomeBanner" className={`nexa-welcome-banner${showWelcome ? '' : ' hidden'}`}>
                            <div className="nexa-welcome-banner__row">
                                <div className="nexa-welcome-banner__copy">
                                    <p className="nexa-welcome-banner__title">Welcome to NEXA!</p>
                                    <p className="nexa-welcome-banner__tagline">
                                        Private.<br />Encrypted.<br />Yours.
                                    </p>
                                </div>
                                <div className="nexa-welcome-banner__art" aria-hidden="true">
                                    <img src="/brand/nexa-lock-glass.png" alt="" width={112} height={112} decoding="async" />
                                </div>
                            </div>
                            <a id="uiWelcomeLearnMore" className="nexa-welcome-banner__btn" href="/about-security" data-link>
                                Learn more
                                <Icon href="#icon-arrow-right" />
                            </a>
                        </div>
                    </section>

                    <div className="sidebar-hidden-controls hidden" aria-hidden="true">
                        <span id="status" className="sidebar-dock__status rail-presence status-offline" title="Disconnected" aria-label="Disconnected" />
                        <button id="uiSettingsBtn" type="button" tabIndex={-1} title="Interface settings" aria-label="Interface settings">
                            <Icon href="#icon-settings" />
                        </button>
                        <button id="uiFocusContactsBtn" type="button" tabIndex={-1} title="Focus contacts" aria-label="Focus contacts">
                            <Icon href="#icon-users" />
                        </button>
                        <button id="uiFocusComposerBtn" type="button" tabIndex={-1} title="Focus composer" aria-label="Focus composer">
                            <Icon href="#icon-message" />
                        </button>
                        <button id="uiCopyUsernameBtn" type="button" tabIndex={-1} title="Copy ID" aria-label="Copy ID">
                            <Icon href="#icon-copy" />
                        </button>
                        <button id="uiShortcutsBtn" type="button" tabIndex={-1} title="Keyboard shortcuts" aria-label="Keyboard shortcuts">
                            <Icon href="#icon-keyboard" />
                        </button>
                    </div>
                </aside>

                {/* While choosing chats for a folder, the dock's slot holds Cancel / Save. */}
                <SidebarDock
                    onOpenSpotlight={onOpenSpotlight}
                    pick={
                        picking
                            ? { name: picking.name, count: picked.size, onCancel: cancelPicking, onSave: savePicking }
                            : null
                    }
                />

                <ProfileNav />
            </div>
        </div>
    );
}

function SidebarLibrary({
    unreadCount,
    mutedCount,
    foldersTotal,
    folderCount,
    pickingFolderId,
    onAddChats,
    onFoldersRemoved,
    folderMembers,
    onRemoveFromFolder,
    onOpenChat,
    activeUsername,
    myUsername,
    active,
    onSelect,
}: {
    unreadCount: number;
    mutedCount: number;
    /** Distinct chats across all folders (All's count). */
    foldersTotal: number;
    folderCount: (folderId: string) => number;
    /** Folder currently receiving chats (highlighted), if any. */
    pickingFolderId: string | null;
    onAddChats: (folderId: string, name: string) => void;
    onFoldersRemoved: (folderIds: string[]) => void;
    folderMembers: (folderId: string) => any[];
    onRemoveFromFolder: (folderId: string, username: string) => void;
    onOpenChat: (username: string) => void;
    activeUsername: string | null;
    myUsername: string | null;
    active: LibraryFilter;
    onSelect: (filter: LibraryFilter) => void;
}) {
    // Default: only All is open — Work / Personal show as collapsed rows.
    const [expandedIds, setExpandedIds] = useState<string[]>(['all']);
    const [tree, setTree] = useState<FolderTreeState>(() => loadFolderTree());
    const [drafting, setDrafting] = useState<{ root: FolderRoot; parentId: string | null } | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);

    useEffect(() => {
        saveFolderTree(tree);
    }, [tree]);

    const ensureOpen = (id: string) => {
        setExpandedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    };

    const startDraft = (root: FolderRoot, parentId: string | null) => {
        setRenamingId(null);
        ensureOpen('all');
        ensureOpen(parentId ?? root);
        setDrafting({ root, parentId });
    };

    const commitDraft = (name: string) => {
        if (!drafting) return;
        const trimmed = name.trim();
        if (!trimmed) {
            setDrafting(null);
            return;
        }
        const child: CustomFolder = { id: makeFolderId(), name: trimmed, children: [] };
        setTree((prev) => ({
            ...prev,
            [drafting.root]: insertChild(prev[drafting.root], drafting.parentId, child),
        }));
        setDrafting(null);
        onSelect(`folder:${child.id}`);
    };

    const cancelDraft = () => setDrafting(null);

    const startRename = (folderId: string) => {
        setDrafting(null);
        setRenamingId(folderId);
    };

    const commitRename = (folderId: string, name: string) => {
        const trimmed = name.trim();
        setRenamingId(null);
        if (!trimmed) return;
        setTree((prev) => ({
            work: renameFolderInTree(prev.work, folderId, trimmed),
            personal: renameFolderInTree(prev.personal, folderId, trimmed),
        }));
    };

    const cancelRename = () => setRenamingId(null);

    const deleteFolder = (folderId: string) => {
        const root = findFolderRoot(tree, folderId);
        const target = findFolder(tree[root], folderId);
        const removedIds = target ? collectFolderIds(target) : [folderId];

        setTree((prev) => ({
            ...prev,
            [root]: removeFolderFromTree(prev[root], folderId),
        }));
        setExpandedIds((prev) => prev.filter((id) => !removedIds.includes(id)));
        // Their chat assignments go with them.
        onFoldersRemoved(removedIds);
        setRenamingId((id) => (id && removedIds.includes(id) ? null : id));
        setDrafting((draft) =>
            draft && draft.parentId && removedIds.includes(draft.parentId) ? null : draft
        );

        if (active.startsWith('folder:') && removedIds.includes(active.slice('folder:'.length))) {
            onSelect(root);
        }
    };

    const selectedIds = useMemo(() => {
        if (active === 'work' || active === 'personal') return [active];
        if (active.startsWith('folder:')) return [active.slice('folder:'.length)];
        return [];
    }, [active]);

    const onNodeClick = (nodeId: string, event?: MouseEvent) => {
        if (nodeId.endsWith(':new')) {
            event?.preventDefault();
            const parent = nodeId.slice(0, -':new'.length);
            if (parent === 'work' || parent === 'personal') startDraft(parent, null);
            return;
        }
        // "+ Add Chats" rows and chat rows act through their own onClick; neither is a
        // selectable folder.
        if (nodeId.endsWith(':add') || nodeId.startsWith('chat:')) {
            event?.preventDefault();
            return;
        }
        if (nodeId === 'all') return;
        if (nodeId === 'work' || nodeId === 'personal') {
            onSelect(nodeId);
            return;
        }
        onSelect(`folder:${nodeId}`);
    };

    const labelWithCount = (label: string, count: number) =>
        count > 0 ? `${label}  ${count}` : label;

    /** The chats added to a folder, as tree rows (open on click, remove on hover). */
    const renderFolderChats = (folderId: string) =>
        folderMembers(folderId).map((user) => (
            <FolderChatItem
                key={`${folderId}:${user.username}`}
                folderId={folderId}
                user={user}
                myUsername={myUsername}
                active={activeUsername === user.username}
                onOpen={() => onOpenChat(user.username)}
                onRemove={() => onRemoveFromFolder(folderId, user.username)}
            />
        ));

    return (
        <div id="uiSidebarLibrary" className="sidebar-library">
            <p className="sidebar-library__kicker">Inbox</p>
            <LibraryList>
                <LibraryRow
                    label="Unread"
                    count={unreadCount}
                    active={active === 'unread'}
                    Icon={Bell}
                    onClick={() => onSelect('unread')}
                />
                <LibraryRow
                    label="All chats"
                    active={active === 'all'}
                    Icon={Inbox}
                    onClick={() => onSelect('all')}
                />
                <LibraryRow
                    label="Muted"
                    count={mutedCount}
                    active={active === 'muted'}
                    Icon={VolumeX}
                    onClick={() => onSelect('muted')}
                />
            </LibraryList>

            <p className="sidebar-library__kicker">Folders</p>
            <ScrollBlur
                edgeVariant="mask"
                edgeSize={20}
                // Folder expand / collapse animates the height: keep the fades off
                // the rows while it moves, show them only once it overflows at rest.
                hideEdgesWhileResizing
                className="sidebar-folder-scroll max-h-[320px]"
                viewportClassName="sidebar-folder-scroll__viewport !h-auto max-h-[320px]"
                contentClassName="sidebar-folder-scroll__content"
            >
                <FileTree
                    className="sidebar-file-tree"
                    expandedIds={expandedIds}
                    onExpandedIdsChange={setExpandedIds}
                    selectedIds={selectedIds}
                    selectionMode="single"
                    indentSize={20}
                    highlightColor="var(--color-brand, #afb9cd)"
                    onNodeClick={onNodeClick}
                >
                    <FileTreeList>
                        <FileTreeItem nodeId="all" label={labelWithCount('All', foldersTotal)} hasChildren>
                            <FileTreeItem
                                nodeId="work"
                                label={labelWithCount('Work', folderCount('work'))}
                                hasChildren
                                className={pickingFolderId === 'work' ? 'is-folder-picking' : undefined}
                                trailing={<FolderAddChatsAction name="Work" onAddChats={() => onAddChats('work', 'Work')} />}
                            >
                                {tree.work.map((folder) => (
                                    <CustomFileTreeFolder
                                        key={folder.id}
                                        folder={folder}
                                        expanded={expandedIds.includes(folder.id)}
                                        renamingId={renamingId}
                                        onStartRename={startRename}
                                        onCommitRename={commitRename}
                                        onCancelRename={cancelRename}
                                        onDeleteFolder={deleteFolder}
                                        folderCount={folderCount}
                                        pickingFolderId={pickingFolderId}
                                        onAddChats={onAddChats}
                                        renderChats={renderFolderChats}
                                    />
                                ))}
                                {renderFolderChats('work')}
                                {drafting?.root === 'work' && drafting.parentId == null ? (
                                    <FolderNameDraft onCommit={commitDraft} onCancel={cancelDraft} />
                                ) : (
                                    <FileTreeItem
                                        nodeId="work:new"
                                        label="New Folder"
                                        icon={<Plus className="size-4.5" />}
                                        onClick={(event) => {
                                            event.preventDefault();
                                            startDraft('work', null);
                                        }}
                                    />
                                )}
                            </FileTreeItem>
                            <FileTreeItem
                                nodeId="personal"
                                label={labelWithCount('Personal', folderCount('personal'))}
                                hasChildren
                                className={pickingFolderId === 'personal' ? 'is-folder-picking' : undefined}
                                trailing={<FolderAddChatsAction name="Personal" onAddChats={() => onAddChats('personal', 'Personal')} />}
                            >
                                {tree.personal.map((folder) => (
                                    <CustomFileTreeFolder
                                        key={folder.id}
                                        folder={folder}
                                        expanded={expandedIds.includes(folder.id)}
                                        renamingId={renamingId}
                                        onStartRename={startRename}
                                        onCommitRename={commitRename}
                                        onCancelRename={cancelRename}
                                        onDeleteFolder={deleteFolder}
                                        folderCount={folderCount}
                                        pickingFolderId={pickingFolderId}
                                        onAddChats={onAddChats}
                                        renderChats={renderFolderChats}
                                    />
                                ))}
                                {renderFolderChats('personal')}
                                {drafting?.root === 'personal' && drafting.parentId == null ? (
                                    <FolderNameDraft onCommit={commitDraft} onCancel={cancelDraft} />
                                ) : (
                                    <FileTreeItem
                                        nodeId="personal:new"
                                        label="New Folder"
                                        icon={<Plus className="size-4.5" />}
                                        onClick={(event) => {
                                            event.preventDefault();
                                            startDraft('personal', null);
                                        }}
                                    />
                                )}
                            </FileTreeItem>
                        </FileTreeItem>
                    </FileTreeList>
                </FileTree>
            </ScrollBlur>
        </div>
    );
}

/** A subfolder of Work / Personal. Holds chats only — expanded, it offers "+ Add Chats". */
function CustomFileTreeFolder({
    folder,
    expanded,
    renamingId,
    onStartRename,
    onCommitRename,
    onCancelRename,
    onDeleteFolder,
    folderCount,
    pickingFolderId,
    onAddChats,
    renderChats,
}: {
    folder: CustomFolder;
    /** Open subfolders already show "+ Add Chats" inside, so the hover + steps aside. */
    expanded: boolean;
    renamingId: string | null;
    onStartRename: (folderId: string) => void;
    onCommitRename: (folderId: string, name: string) => void;
    onCancelRename: () => void;
    onDeleteFolder: (folderId: string) => void;
    folderCount: (folderId: string) => number;
    pickingFolderId: string | null;
    onAddChats: (folderId: string, name: string) => void;
    /** Rows for the chats added to this folder. */
    renderChats: (folderId: string) => ReactNode;
}) {
    const isRenaming = renamingId === folder.id;
    const count = folderCount(folder.id);
    const label = count > 0 ? `${folder.name}  ${count}` : folder.name;
    const rowClass =
        [isRenaming ? 'is-folder-renaming' : '', pickingFolderId === folder.id ? 'is-folder-picking' : '']
            .filter(Boolean)
            .join(' ') || undefined;
    const addChats = () => onAddChats(folder.id, folder.name);

    const trailing = isRenaming ? (
        <FolderNameDraft
            initialName={folder.name}
            overlay
            onCommit={(name) => onCommitRename(folder.id, name)}
            onCancel={onCancelRename}
        />
    ) : (
        <FolderItemActions
            name={folder.name}
            onAddChats={expanded ? undefined : addChats}
            onRename={() => onStartRename(folder.id)}
            onDelete={() => onDeleteFolder(folder.id)}
        />
    );

    return (
        <FileTreeItem
            nodeId={folder.id}
            label={label}
            hasChildren
            className={rowClass}
            trailing={trailing}
        >
            {renderChats(folder.id)}
            <FileTreeItem
                nodeId={`${folder.id}:add`}
                label="Add Chats"
                icon={<Plus className="size-4.5" />}
                onClick={(event) => {
                    event.preventDefault();
                    addChats();
                }}
            />
        </FileTreeItem>
    );
}

/** Shared "+ add chats" button for a folder row (shown on hover). */
function AddChatsButton({ name, onAddChats, tabIndex }: { name: string; onAddChats: () => void; tabIndex?: number }) {
    return (
        <button
            type="button"
            className="folder-item-action folder-item-action--add"
            aria-label={`Add chats to ${name}`}
            title="Add chats"
            tabIndex={tabIndex}
            onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onAddChats();
            }}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
            }}
            onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                onAddChats();
            }}
        >
            <MessageSquarePlus className="size-3.5" aria-hidden />
        </button>
    );
}

/** Work / Personal: fixed folders — adding chats is their only action. */
function FolderAddChatsAction({ name, onAddChats }: { name: string; onAddChats: () => void }) {
    return (
        <div className="folder-item-actions" data-folder-actions>
            <div className="folder-item-actions__idle">
                <AddChatsButton name={name} onAddChats={onAddChats} />
            </div>
        </div>
    );
}

function FolderItemActions({
    name,
    onAddChats,
    onRename,
    onDelete,
    deleteLabel = 'Delete folder',
}: {
    name: string;
    /** Omit to hide the "+ add chats" button. */
    onAddChats?: () => void;
    /** Omit to hide the rename button. */
    onRename?: () => void;
    onDelete: () => void;
    deleteLabel?: string;
}) {
    const [confirming, setConfirming] = useState(false);

    const stop = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <div
            className={['folder-item-actions', confirming ? 'is-confirming' : ''].filter(Boolean).join(' ')}
            data-folder-actions
            onMouseLeave={() => setConfirming(false)}
        >
            <div className="folder-item-actions__idle" aria-hidden={confirming}>
                {onAddChats ? (
                    <AddChatsButton name={name} onAddChats={onAddChats} tabIndex={confirming ? -1 : 0} />
                ) : null}
                {onRename ? (
                    <button
                        type="button"
                        className="folder-item-action"
                        aria-label="Rename folder"
                        title="Rename"
                        tabIndex={confirming ? -1 : 0}
                        onPointerDown={(event) => {
                            stop(event);
                            onRename();
                        }}
                        onClick={stop}
                    >
                        <Pencil className="size-3.5" aria-hidden />
                    </button>
                ) : null}
                <button
                    type="button"
                    className="folder-item-action folder-item-action--danger"
                    aria-label={deleteLabel}
                    title={deleteLabel}
                    tabIndex={confirming ? -1 : 0}
                    onPointerDown={(event) => {
                        stop(event);
                        setConfirming(true);
                    }}
                    onClick={stop}
                >
                    <Trash2 className="size-3.5" aria-hidden />
                </button>
            </div>

            <button
                type="button"
                className="folder-item-action folder-item-action--confirm"
                aria-label={`Confirm: ${deleteLabel.toLowerCase()}`}
                title="Confirm delete"
                tabIndex={confirming ? 0 : -1}
                aria-hidden={!confirming}
                onPointerDown={(event) => {
                    if (!confirming) return;
                    stop(event);
                    onDelete();
                }}
                onClick={stop}
            >
                <Check className="size-3.5 folder-item-action__check" aria-hidden />
            </button>
        </div>
    );
}

/** A chat inside a folder: mini avatar + name; opens on click, trash on hover. */
function FolderChatItem({
    folderId,
    user,
    myUsername,
    active,
    onOpen,
    onRemove,
}: {
    folderId: string;
    user: any;
    myUsername: string | null;
    active: boolean;
    onOpen: () => void;
    onRemove: () => void;
}) {
    const profile = resolveContactProfile(user.username, user, myUsername);
    const label = getDisplayLabel(user.username, profile);

    return (
        <FileTreeItem
            nodeId={`chat:${folderId}:${user.username}`}
            label={label}
            className={active ? 'is-folder-chat is-folder-chat-active' : 'is-folder-chat'}
            icon={
                <span
                    className={`contact-avatar folder-chat-avatar${profile.avatarDataUrl ? ' has-photo' : ''}`}
                    style={{ ['--avatar-hue' as string]: String(getAvatarHue(user.username)) }}
                    aria-hidden="true"
                >
                    {profile.avatarDataUrl ? (
                        <img src={profile.avatarDataUrl} alt="" className="contact-avatar-img" loading="lazy" />
                    ) : (
                        getInitials(label)
                    )}
                </span>
            }
            trailing={<FolderItemActions name={label} onDelete={onRemove} deleteLabel="Remove from folder" />}
            onClick={(event) => {
                event.preventDefault();
                onOpen();
            }}
        />
    );
}

function FolderNameDraft({
    onCommit,
    onCancel,
    initialName = '',
    overlay = false,
}: {
    onCommit: (name: string) => void;
    onCancel: () => void;
    initialName?: string;
    overlay?: boolean;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const doneRef = useRef(false);
    const [value, setValue] = useState(initialName);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const finish = (next: 'commit' | 'cancel') => {
        if (doneRef.current) return;
        doneRef.current = true;
        if (next === 'cancel') onCancel();
        else onCommit(inputRef.current?.value ?? value);
    };

    return (
        <div
            className={overlay ? 'folder-name-draft folder-name-draft--overlay' : 'folder-name-draft'}
            data-value="folder-draft"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <Folder className="folder-name-draft__icon" aria-hidden />
            <input
                ref={inputRef}
                className="folder-name-draft__input"
                type="text"
                value={value}
                placeholder="Folder name"
                maxLength={40}
                aria-label="Folder name"
                onChange={(event) => setValue(event.target.value)}
                onBlur={() => finish('commit')}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        finish('commit');
                    }
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        finish('cancel');
                    }
                }}
            />
        </div>
    );
}

function LibraryList({ children }: { children: ReactNode }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [highlightBounds, setHighlightBounds] = useState<HighlightBounds | null>(null);
    const reduceMotion = useReducedMotion() === true;
    // Active pill: ONE element that slides to the active row. Each row used to
    // fade its own fill, so fast clicking left two half-lit rows and the pill
    // looked stuck between items; one spring target can't desync.
    const [activeBounds, setActiveBounds] = useState<HighlightBounds | null>(null);
    const activeRowRef = useRef<HTMLElement | null>(null);
    // Placements that must not animate: coming back into view (Settings → Chats)
    // and resizes. Only a click glides the pill.
    const [instantPill, setInstantPill] = useState(true);
    const hiddenRef = useRef(false);

    const measure = useCallback((element: HTMLElement): HighlightBounds | null => {
        const container = containerRef.current;
        if (!container) return null;
        const containerRect = container.getBoundingClientRect();
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top - containerRect.top + container.scrollTop,
            left: rect.left - containerRect.left + container.scrollLeft,
            width: rect.width,
            height: rect.height,
        };
    }, []);

    const setActiveRow = useCallback((element: HTMLElement | null, row: HTMLElement) => {
        if (element) {
            activeRowRef.current = element;
            // Hidden (Settings open): nothing to measure — the observer places
            // the pill, instantly, once the list is visible again.
            if (!containerRef.current?.offsetWidth) return;
            setInstantPill(false);
            setActiveBounds(measure(element));
            return;
        }
        // A row that stopped being active only clears the pill if it still owns it.
        if (activeRowRef.current === row) {
            activeRowRef.current = null;
            setActiveBounds(null);
        }
    }, [measure]);

    // Keep the pill on its row when the sidebar resizes.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;
        const observer = new ResizeObserver(() => {
            // While hidden every rect is 0 × 0 at the top — measuring then parked
            // the pill on Unread, and coming back it flew down to All chats.
            if (!container.offsetWidth) {
                hiddenRef.current = true;
                return;
            }
            hiddenRef.current = false;
            if (!activeRowRef.current) return;
            setInstantPill(true);
            setActiveBounds(measure(activeRowRef.current));
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [measure]);

    const setHighlightFromElement = useCallback((element: HTMLElement | null) => {
        const container = containerRef.current;
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

    return (
        <LibraryActiveContext.Provider value={setActiveRow}>
        <LibraryHighlightContext.Provider value={setHighlightFromElement}>
            <div
                ref={containerRef}
                className="library-list"
                onMouseLeave={() => setHighlightBounds(null)}
            >

                <AnimatePresence>
                    {highlightBounds ? (
                        <motion.div
                            key="library-highlight"
                            className="library-list-highlight"
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
                            transition={reduceMotion ? instantHoverTransition : listHoverTransition}
                        />
                    ) : null}
                </AnimatePresence>
                {/* After the hover highlight: the active pill stays on top of it. */}
                <AnimatePresence initial={false}>
                    {activeBounds ? (
                        <motion.div
                            key="library-active"
                            className="library-list-active"
                            aria-hidden="true"
                            initial={{ opacity: 0, ...activeBounds }}
                            animate={{ opacity: 1, ...activeBounds }}
                            exit={{ opacity: 0 }}
                            transition={reduceMotion || instantPill ? { duration: 0 } : LIBRARY_PILL_SPRING}
                        />
                    ) : null}
                </AnimatePresence>
                {children}
            </div>
        </LibraryHighlightContext.Provider>
        </LibraryActiveContext.Provider>
    );
}

function LibraryRow({
    label,
    count,
    active,
    Icon,
    expandable = false,
    open = false,
    onClick,
}: {
    label: string;
    count?: number;
    active: boolean;
    Icon: typeof Folder;
    expandable?: boolean;
    open?: boolean;
    onClick: () => void;
}) {
    const setHighlightFromElement = useContext(LibraryHighlightContext);
    const setActiveRow = useContext(LibraryActiveContext);
    const rowRef = useRef<HTMLButtonElement>(null);

    // Report to the list's single active pill (layout effect: same frame as the click).
    useLayoutEffect(() => {
        const row = rowRef.current;
        if (!row || !setActiveRow) return undefined;
        if (!active) return undefined;
        setActiveRow(row, row);
        return () => setActiveRow(null, row);
    }, [active, setActiveRow]);

    return (
        <button
            ref={rowRef}
            type="button"
            className={['library-row', active ? 'is-active' : ''].filter(Boolean).join(' ')}
            aria-expanded={expandable ? open : undefined}
            onClick={onClick}
            onMouseEnter={(event) => setHighlightFromElement?.(event.currentTarget)}
            onFocus={(event) => setHighlightFromElement?.(event.currentTarget)}
        >
            <span className="library-row__body">
                <Icon size={16} strokeWidth={1.6} />
                <span className="library-row__label">{label}</span>
                {count != null && count > 0 ? <span className="library-row__count">{count}</span> : null}
            </span>
        </button>
    );
}

/** Takes the dock's place while choosing chats for a folder. */
function FolderPickBar({
    name,
    count,
    onCancel,
    onSave,
}: {
    name: string;
    count: number;
    onCancel: () => void;
    onSave: () => void;
}) {
    const reduceMotion = useReducedMotion() === true;
    return (
        <motion.div
            className="folder-pick-bar"
            role="region"
            aria-label={`Add chats to ${name}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={reduceMotion ? { duration: 0 } : PICK_MODE_TRANSITION}
        >
            {/* One line: "Add to <folder> (N)" … Cancel [Save]. The info side shrinks
                and clips (folder name ellipsizes; "Add to" drops on narrow bars);
                the buttons never shrink. */}
            <div className="folder-pick-bar__info">
                <span className="folder-pick-bar__prefix">Add to</span>
                <strong className="folder-pick-bar__name" title={name}>
                    {name}
                </strong>
                <span
                    className="folder-pick-bar__count"
                    data-empty={count === 0 || undefined}
                    aria-live="polite"
                    aria-label={count === 0 ? 'None selected' : `${count} selected`}
                >
                    {count}
                </span>
            </div>
            <div className="folder-pick-bar__actions">
                <button type="button" className="folder-pick-bar__btn folder-pick-bar__btn--cancel" onClick={onCancel}>
                    Cancel
                </button>
                <button type="button" className="folder-pick-bar__btn folder-pick-bar__btn--save" onClick={onSave}>
                    Save
                </button>
            </div>
        </motion.div>
    );
}

function ContactList({ children }: { children: ReactNode }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [highlightBounds, setHighlightBounds] = useState<HighlightBounds | null>(null);
    const reduceMotion = useReducedMotion() === true;

    const setHighlightFromElement = useCallback((element: HTMLElement | null) => {
        const container = containerRef.current;
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

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const viewport = container.closest('[data-slot="scroll-blur-viewport"]');
        const clear = () => setHighlightBounds(null);
        viewport?.addEventListener('scroll', clear, { passive: true });
        return () => viewport?.removeEventListener('scroll', clear);
    }, []);

    return (
        <ContactHighlightContext.Provider value={setHighlightFromElement}>
            <div
                ref={containerRef}
                className="contact-list"
                onMouseLeave={() => setHighlightBounds(null)}
            >
                <AnimatePresence>
                    {highlightBounds ? (
                        <motion.div
                            key="contact-highlight"
                            className="contact-list-highlight list-hover-highlight"
                            aria-hidden="true"
                            style={{ position: 'absolute', pointerEvents: 'none', zIndex: 0 }}
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
                            transition={reduceMotion ? instantHoverTransition : listHoverTransition}
                        />
                    ) : null}
                </AnimatePresence>
                {children}
            </div>
        </ContactHighlightContext.Provider>
    );
}

function ContactRow({
    user,
    myUsername,
    active,
    online,
    unread,
    typing,
    muted,
    pickable = false,
    picked = false,
    onTogglePick,
    onSelect,
}: {
    user: any;
    myUsername: string | null;
    active: boolean;
    online: boolean | null;
    unread: number;
    typing: boolean;
    muted: boolean;
    /** "Add chats to folder" mode: the row toggles a checkmark instead of opening the chat. */
    pickable?: boolean;
    picked?: boolean;
    onTogglePick?: () => void;
    onSelect: () => void;
}) {
    const rowRef = useRef<HTMLButtonElement>(null);
    const onHighlight = useContext(ContactHighlightContext);
    const reduceMotion = useReducedMotion() === true;
    const profile = resolveContactProfile(user.username, user, myUsername);
    const label = getDisplayLabel(user.username, profile);
    const hasDisplayName = Boolean(profile.displayName?.trim());
    // Presence arc around the avatar (hidden when online status is turned off)
    const presence = online == null ? undefined : online ? 'online' : 'offline';
    const time = formatSidebarTime(user.last_message_at);
    const preview = truncateSidebarPreview(user.last_message_preview);
    // Kept mounted in pick mode (CSS fades it out) so nothing pops.
    const showBadge = unread > 0 && !active;

    const bumpHighlight = () => onHighlight?.(rowRef.current);
    const spring = reduceMotion
        ? { duration: 0 }
        : { type: 'spring' as const, stiffness: 460, damping: 34 };

    return (
        <button
            ref={rowRef}
            type="button"
            className={`contact-row${active ? ' is-active' : ''}${pickable ? ' is-pickable' : ''}${picked ? ' is-picked' : ''}`}
            data-username={user.username}
            role={pickable ? 'checkbox' : undefined}
            aria-checked={pickable ? picked : undefined}
            aria-label={pickable ? `Include ${label}` : `Open chat with ${label}`}
            aria-current={!pickable && active ? 'true' : 'false'}
            onClick={pickable ? onTogglePick : onSelect}
            onMouseEnter={bumpHighlight}
            onFocus={bumpHighlight}
        >
            <motion.span
                className="contact-row__rail"
                aria-hidden="true"
                initial={false}
                animate={{
                    opacity: active ? 1 : 0,
                    scaleY: active ? 1 : 0.28,
                    y: '-50%',
                }}
                transition={spring}
            />
            {/* Always mounted: in pick mode it eases in at the row's start while the
                row's padding opens room for it — [ check | avatar | name / preview ]. */}
            <span className="contact-row__pick" aria-hidden="true">
                <motion.span
                    className="contact-row__pick-mark"
                    initial={false}
                    animate={{ scale: picked ? 1 : 0.4, opacity: picked ? 1 : 0 }}
                    transition={spring}
                >
                    <Check size={12} strokeWidth={3} />
                </motion.span>
            </span>
            <span className="avatar-status" data-status={presence}>
                <div
                    className={`contact-avatar${profile.avatarDataUrl ? ' has-photo' : ''}`}
                    style={{ ['--avatar-hue' as string]: String(getAvatarHue(user.username)) }}
                >
                    {profile.avatarDataUrl ? (
                        <img src={profile.avatarDataUrl} alt="" className="contact-avatar-img" loading="lazy" />
                    ) : (
                        getInitials(label)
                    )}
                </div>
                <StatusArc />
            </span>
            <div className="contact-meta">
                <div className="contact-name-row">
                    <div className={`contact-name${hasDisplayName ? ' has-display-name' : ''}`}>{label}</div>
                    {hasDisplayName ? <span className="contact-handle">@{user.username}</span> : null}
                    <span className="contact-time" data-contact-time="true" hidden={!time}>
                        {time}
                    </span>
                </div>
                <div className="contact-preview-row">
                    <div
                        className={`contact-subtitle${muted ? ' is-muted' : ''}${typing ? ' is-typing' : ''}`}
                        data-contact-subtitle="true"
                    >
                        {muted ? 'Muted' : typing ? (
                            <span className="typing-dots" aria-label="Typing"><span /><span /><span /></span>
                        ) : (preview || 'Secure channel')}
                    </div>
                </div>
            </div>
            {showBadge ? (
                <span data-unread-badge="true" className="contact-unread">
                    {unread > 99 ? '99+' : String(unread)}
                </span>
            ) : null}

        </button>
    );
}

const DOCK_TABS: ExpandableTabItem[] = [
    { title: 'Chats', icon: MessageCircle, id: 'uiRailChats', rail: 'chats' },
    { title: 'Profile', icon: User, id: 'uiRailProfile', rail: 'identity' },
    { title: 'Settings', icon: Settings, id: 'uiDockSettings', rail: 'settings' },
    { title: 'Search', icon: Search, id: 'uiDockNewChat', action: true, className: 'sidebar-dock-compose' },
];

function readDockActiveIndex() {
    const page = document.getElementById('page-chat');
    if (page?.classList.contains('is-app-view-settings')) return 2;
    if (page?.classList.contains('is-app-view-identity')) return 1;
    return 0;
}

type DockPick = { name: string; count: number; onCancel: () => void; onSave: () => void };

const SidebarDock = memo(function SidebarDock({
    onOpenSpotlight,
    pick = null,
}: {
    onOpenSpotlight?: () => void;
    /** "Add chats to folder" in progress: show its Cancel / Save bar instead of the tabs. */
    pick?: DockPick | null;
}) {
    const reduceMotion = useReducedMotion() === true;
    const dockSwap = reduceMotion ? { duration: 0 } : PICK_MODE_TRANSITION;
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const page = document.getElementById('page-chat');
        if (!page) return;
        const sync = () => setActiveIndex(readDockActiveIndex());
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(page, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    return (
        <div className="sidebar-dock-bar" data-mode={pick ? 'pick' : 'nav'}>
            {/* Tabs and the pick bar share one cell. The tabs stay mounted (hidden and
                inert while picking): app.js binds its own click handlers to those
                buttons at startup, and a remount would drop them. */}
            <div className="sidebar-dock-bar__stack">
                <motion.div
                    className="sidebar-dock-bar__nav"
                    initial={false}
                    animate={{ opacity: pick ? 0 : 1, y: pick ? 8 : 0 }}
                    transition={dockSwap}
                    inert={pick ? true : undefined}
                    aria-hidden={pick ? true : undefined}
                >
                        <ExpandableTabs
                            id="uiSidebarDock"
                            label="App sections"
                            tabs={DOCK_TABS}
                            activeIndex={activeIndex}
                            onChange={(index) => {
                                if (index == null) return;
                                const tab = DOCK_TABS[index];
                                if (!tab) return;
                                if ('action' in tab && tab.action) {
                                    onOpenSpotlight?.();
                                    return;
                                }
                                closeComposeSearch({ immediate: true });
                                if (tab.rail === 'chats') showChatsView();
                                else if (tab.rail === 'identity') openProfile('identity');
                                else if (tab.rail === 'settings') openAppSettings();
                            }}
                        />
                </motion.div>
                <AnimatePresence initial={false}>
                    {pick ? (
                        <FolderPickBar
                            key="pick"
                            name={pick.name}
                            count={pick.count}
                            onCancel={pick.onCancel}
                            onSave={pick.onSave}
                        />
                    ) : null}
                </AnimatePresence>
            </div>
        </div>
    );
});

/**
 * The left sidebar's header: a rounded block with the hide button in a
 * top-right cutout (see .left-sidebar-header). Used by the chat list (NEXA
 * logo) and the settings nav ("Settings"); the label replays a short fade-in
 * whenever its view is shown, so switching views reads as NEXA ⇄ Settings.
 */
function SidebarHeader({ toggleId, children }: { toggleId: string; children: ReactNode }) {
    return (
        <header className="sidebar-brand left-sidebar-header">
            <span className="left-sidebar-header__label">{children}</span>
            {/* Aside-coloured cutout holding the hide button. The edge tab
                (#uiSidebarToggle) only returns once collapsed. */}
            <span className="left-sidebar-header__notch" aria-hidden="true">
                <span className="left-sidebar-header__joint left-sidebar-header__joint--top" />
                <span className="left-sidebar-header__joint left-sidebar-header__joint--side" />
            </span>
            <button
                id={toggleId}
                className="left-sidebar-collapse-btn"
                type="button"
                aria-controls="uiSidebar"
                aria-label="Hide sidebar"
                title="Hide sidebar"
            >
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
                    <line x1="15" y1="3" x2="15" y2="21" />
                    <path d="M7 8h2M7 12h2M7 16h2" />
                </svg>
            </button>
        </header>
    );
}

const ProfileNav = memo(function ProfileNav() {
    // Same sliding hover highlight as the chat list / folder tree.
    const navRef = useRef<HTMLElement>(null);
    useEffect(() => attachHoverHighlight(navRef.current, '.profile-nav-btn'), []);

    return (
        <nav ref={navRef} id="uiProfileNav" className="profile-nav" hidden aria-hidden="true" aria-label="Settings">
            <header className="profile-nav-toolbar">
                <button id="uiProfileNavBackBtn" className="mini-icon-btn profile-nav-back-btn" type="button" title="Back to chats" aria-label="Back to chats">
                    <Icon href="#icon-arrow-left" />
                </button>
                <div className="profile-nav-toolbar-copy">
                    <p className="profile-nav-toolbar-title">Settings</p>
                </div>
            </header>
            {/* Same header as the chat list's (shape, cutout, hide button), titled */}
            <SidebarHeader toggleId="uiSettingsHeaderToggle">
                <span className="left-sidebar-header__title">Settings</span>
            </SidebarHeader>
            {/* You: avatar + status, name, @handle → the Profile page (filled by profileSettings.js) */}
            <button id="uiProfileNavCard" className="profile-nav-card" type="button" aria-label="Open your profile">
                <span className="profile-nav-card__avatar-wrap">
                    <span id="uiProfileNavAvatar" className="contact-avatar profile-nav-card__avatar" aria-hidden="true" />
                    <span id="uiProfileNavStatus" className="profile-nav-card__status" data-status="available" aria-hidden="true" />
                </span>
                <span className="profile-nav-card__copy">
                    <span id="uiProfileNavName" className="profile-nav-card__name" />
                    <span id="uiProfileNavHandle" className="profile-nav-card__handle" />
                </span>
                <span className="profile-nav-card__chev" aria-hidden="true">
                    <svg className="ui-icon" aria-hidden="true"><use href="#icon-chevron-right" /></svg>
                </span>
            </button>
            <p className="profile-nav-kicker">Preferences</p>
            <button type="button" className="profile-nav-btn is-active" data-profile-nav="appearance" aria-current="page">
                <span className="profile-nav-tile" aria-hidden="true">
                    <svg className="profile-nav-icon ui-icon" aria-hidden="true"><use href="#icon-palette" /></svg>
                </span>
                <span className="profile-nav-copy">
                    <span className="profile-nav-label">Appearance</span>
                    <span className="profile-nav-sub">Theme & chat look</span>
                </span>
                <span className="profile-nav-trail">
                    <svg className="profile-nav-arrow ui-icon" aria-hidden="true"><use href="#icon-arrow-right" /></svg>
                </span>
            </button>
            <button type="button" className="profile-nav-btn" data-profile-nav="security">
                <span className="profile-nav-tile" aria-hidden="true">
                    <svg className="profile-nav-icon ui-icon" aria-hidden="true"><use href="#icon-shield" /></svg>
                </span>
                <span className="profile-nav-copy">
                    <span className="profile-nav-label">Security</span>
                    <span className="profile-nav-sub">Keys & devices</span>
                </span>
                <span className="profile-nav-trail">
                    <svg className="profile-nav-arrow ui-icon" aria-hidden="true"><use href="#icon-arrow-right" /></svg>
                </span>
            </button>
            <button type="button" className="profile-nav-btn" data-profile-nav="privacy">
                <span className="profile-nav-tile" aria-hidden="true">
                    <svg className="profile-nav-icon ui-icon" aria-hidden="true"><use href="#icon-eye" /></svg>
                </span>
                <span className="profile-nav-copy">
                    <span className="profile-nav-label">Privacy</span>
                    <span className="profile-nav-sub">Visibility & links</span>
                </span>
                <span className="profile-nav-trail">
                    <svg className="profile-nav-arrow ui-icon" aria-hidden="true"><use href="#icon-arrow-right" /></svg>
                </span>
            </button>
            <button type="button" className="profile-nav-btn" data-profile-nav="data">
                <span className="profile-nav-tile" aria-hidden="true">
                    <svg className="profile-nav-icon ui-icon" aria-hidden="true"><use href="#icon-database" /></svg>
                </span>
                <span className="profile-nav-copy">
                    <span className="profile-nav-label">Data</span>
                    <span className="profile-nav-sub">Storage & exports</span>
                </span>
                <span className="profile-nav-trail">
                    <span id="uiProfileNavDataSize" className="profile-nav-meta" />
                    <svg className="profile-nav-arrow ui-icon" aria-hidden="true"><use href="#icon-arrow-right" /></svg>
                </span>
            </button>
            <hr className="profile-nav-divider" />
            {/* Slide to log out → 3·2·1 countdown (cancellable) → nexa:logout (js/app.js). */}
            <LogoutSlider />
            <div className="profile-nav-foot">
                <div className="profile-e2ee-card">
                    <div className="profile-e2ee-head">
                        <span className="profile-e2ee-kicker">E2EE status</span>
                        <span className="profile-e2ee-verified">Verified</span>
                    </div>
                    <p className="profile-e2ee-copy">All your data is end-to-end encrypted and stored locally.</p>
                    <button id="uiProfileViewSecurity" className="profile-e2ee-link" type="button">View security details</button>
                </div>
            </div>
        </nav>
    );
});

function formatSidebarTime(isoValue?: string) {
    if (!isoValue) return '';
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function truncateSidebarPreview(text: string, maxLen = 42) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    if (clean.length <= maxLen) return clean;
    return `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}
