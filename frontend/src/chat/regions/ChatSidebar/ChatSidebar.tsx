import { memo, useCallback, useEffect, useMemo, useRef, useState, createContext, useContext, type MouseEvent, type ReactNode } from 'react';
import {
    Bell,
    Check,
    Folder,
    Inbox,
    MessageCircle,
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
import { getPrivacyFlags, isChatMuted } from '../../../../js/privacy.js';
import { useChatSnapshot } from '../../hooks/useChatEngine';
import { AsideToggle } from '../../components/AsideToggle';
import { ExpandableTabs, type ExpandableTabItem } from '../../components/ExpandableTabs';
import { Icon } from '../../components/Icon';
import { FileTree, FileTreeItem, FileTreeList } from '@/components/ui/file-tree';
import { ScrollBlur } from '@/components/ui/scroll-blur';

type HighlightBounds = {
    top: number;
    left: number;
    width: number;
    height: number;
};

const ContactHighlightContext = createContext<((element: HTMLElement | null) => void) | null>(null);
const LibraryHighlightContext = createContext<((element: HTMLElement | null) => void) | null>(null);

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

const MAX_FOLDER_DEPTH = 2;
const FOLDER_STORAGE_KEY = 'nexa.sidebar.custom-folders';

function folderOf(username: string): FolderRoot {
    return username === 'nexa_lab' ? 'work' : 'personal';
}

function loadFolderTree(): FolderTreeState {
    try {
        const raw = localStorage.getItem(FOLDER_STORAGE_KEY);
        if (!raw) return { work: [], personal: [] };
        const parsed = JSON.parse(raw);
        return {
            work: Array.isArray(parsed?.work) ? parsed.work : [],
            personal: Array.isArray(parsed?.personal) ? parsed.personal : [],
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
    const workTotal = chats.filter((chat) => folderOf(chat.username) === 'work').length;
    const personalTotal = chats.filter((chat) => folderOf(chat.username) === 'personal').length;
    const visibleChats = useMemo(() => {
        return chats.filter((chat) => {
            const unread = snap.unreadCounts[chat.username] ?? chat.unread_count ?? 0;
            const muted = Boolean(snap.myUsername && isChatMuted(snap.myUsername, chat.username));
            if (libraryFilter === 'unread') return unread > 0;
            if (libraryFilter === 'muted') return muted;
            if (libraryFilter === 'work') return folderOf(chat.username) === 'work';
            if (libraryFilter === 'personal') return folderOf(chat.username) === 'personal';
            if (libraryFilter.startsWith('folder:')) return false;
            return true;
        });
    }, [chats, libraryFilter, snap.myUsername, snap.unreadCounts]);
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
                    <header className="sidebar-brand">
                        <img src="/brand/nexa-logo.svg" alt="NEXA" className="sidebar-brand__mark" width={1007} height={176} decoding="async" />
                    </header>

                    <section className="sidebar-chats" aria-label="Chats">
                        <SidebarLibrary
                            unreadCount={unreadTotal}
                            mutedCount={mutedTotal}
                            workCount={workTotal}
                            personalCount={personalTotal}
                            active={libraryFilter}
                            onSelect={setLibraryFilter}
                        />
                        <div id="usersList">
                            <ScrollBlur
                                edgeSize={40}
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
                                ) : visibleChats.length === 0 ? (
                                    <div className="empty-state">
                                        {chats.length === 0 ? 'No conversations yet' : 'Nothing in this folder'}
                                    </div>
                                ) : (
                                    <ContactList>
                                        {visibleChats.map((user: any) => (
                                            <ContactRow
                                                key={user.username}
                                                user={user}
                                                myUsername={snap.myUsername}
                                                active={snap.activeUsername === user.username}
                                                online={privacy.showOnlineStatus ? snap.onlineUsers.has(user.username) : null}
                                                unread={snap.unreadCounts[user.username] ?? user.unread_count ?? 0}
                                                typing={Boolean(privacy.typingIndicators && snap.typingUsers.has(user.username))}
                                                muted={Boolean(snap.myUsername && isChatMuted(snap.myUsername, user.username))}
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

                <SidebarDock onOpenSpotlight={onOpenSpotlight} />

                <ProfileNav />
            </div>
        </div>
    );
}

function SidebarLibrary({
    unreadCount,
    mutedCount,
    workCount,
    personalCount,
    active,
    onSelect,
}: {
    unreadCount: number;
    mutedCount: number;
    workCount: number;
    personalCount: number;
    active: LibraryFilter;
    onSelect: (filter: LibraryFilter) => void;
}) {
    const [expandedIds, setExpandedIds] = useState<string[]>(['all', 'work']);
    const [tree, setTree] = useState<FolderTreeState>(() => loadFolderTree());
    const [drafting, setDrafting] = useState<{ root: FolderRoot; parentId: string | null } | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const foldersTotal = workCount + personalCount;

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
            if (parent === 'work' || parent === 'personal') {
                startDraft(parent, null);
                return;
            }
            startDraft(findFolderRoot(tree, parent), parent);
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

    return (
        <div id="uiSidebarLibrary" className="sidebar-library">
            <p className="sidebar-library__kicker">Inbox</p>
            <LibraryList>
                <LibraryRow
                    label="Unread"
                    count={unreadCount}
                    active={active === 'unread'}
                    Icon={Bell}
                    onClick={() => onSelect(active === 'unread' ? 'all' : 'unread')}
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
                    onClick={() => onSelect(active === 'muted' ? 'all' : 'muted')}
                />
            </LibraryList>

            <p className="sidebar-library__kicker">Folders</p>
            <ScrollBlur
                edgeSize={28}
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
                            <FileTreeItem nodeId="work" label={labelWithCount('Work', workCount)} hasChildren>
                                {tree.work.map((folder) => (
                                    <CustomFileTreeFolder
                                        key={folder.id}
                                        root="work"
                                        folder={folder}
                                        depth={1}
                                        drafting={drafting}
                                        renamingId={renamingId}
                                        onStartDraft={startDraft}
                                        onCommitDraft={commitDraft}
                                        onCancelDraft={cancelDraft}
                                        onStartRename={startRename}
                                        onCommitRename={commitRename}
                                        onCancelRename={cancelRename}
                                        onDeleteFolder={deleteFolder}
                                    />
                                ))}
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
                            <FileTreeItem nodeId="personal" label={labelWithCount('Personal', personalCount)} hasChildren>
                                {tree.personal.map((folder) => (
                                    <CustomFileTreeFolder
                                        key={folder.id}
                                        root="personal"
                                        folder={folder}
                                        depth={1}
                                        drafting={drafting}
                                        renamingId={renamingId}
                                        onStartDraft={startDraft}
                                        onCommitDraft={commitDraft}
                                        onCancelDraft={cancelDraft}
                                        onStartRename={startRename}
                                        onCommitRename={commitRename}
                                        onCancelRename={cancelRename}
                                        onDeleteFolder={deleteFolder}
                                    />
                                ))}
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

function CustomFileTreeFolder({
    root,
    folder,
    depth,
    drafting,
    renamingId,
    onStartDraft,
    onCommitDraft,
    onCancelDraft,
    onStartRename,
    onCommitRename,
    onCancelRename,
    onDeleteFolder,
}: {
    root: FolderRoot;
    folder: CustomFolder;
    depth: number;
    drafting: { root: FolderRoot; parentId: string | null } | null;
    renamingId: string | null;
    onStartDraft: (root: FolderRoot, parentId: string | null) => void;
    onCommitDraft: (name: string) => void;
    onCancelDraft: () => void;
    onStartRename: (folderId: string) => void;
    onCommitRename: (folderId: string, name: string) => void;
    onCancelRename: () => void;
    onDeleteFolder: (folderId: string) => void;
}) {
    const canNest = depth < MAX_FOLDER_DEPTH;
    const draftHere = drafting?.root === root && drafting.parentId === folder.id;
    const isRenaming = renamingId === folder.id;

    const trailing = isRenaming ? (
        <FolderNameDraft
            initialName={folder.name}
            overlay
            onCommit={(name) => onCommitRename(folder.id, name)}
            onCancel={onCancelRename}
        />
    ) : (
        <FolderItemActions
            onRename={() => onStartRename(folder.id)}
            onDelete={() => onDeleteFolder(folder.id)}
        />
    );

    const nested = canNest ? (
        <>
            {folder.children.map((child) => (
                <CustomFileTreeFolder
                    key={child.id}
                    root={root}
                    folder={child}
                    depth={depth + 1}
                    drafting={drafting}
                    renamingId={renamingId}
                    onStartDraft={onStartDraft}
                    onCommitDraft={onCommitDraft}
                    onCancelDraft={onCancelDraft}
                    onStartRename={onStartRename}
                    onCommitRename={onCommitRename}
                    onCancelRename={onCancelRename}
                    onDeleteFolder={onDeleteFolder}
                />
            ))}
            {draftHere ? (
                <FolderNameDraft onCommit={onCommitDraft} onCancel={onCancelDraft} />
            ) : (
                <FileTreeItem
                    nodeId={`${folder.id}:new`}
                    label="New Folder"
                    icon={<Plus className="size-4.5" />}
                    onClick={(event) => {
                        event.preventDefault();
                        onStartDraft(root, folder.id);
                    }}
                />
            )}
        </>
    ) : null;

    if (!canNest) {
        return (
            <FileTreeItem
                nodeId={folder.id}
                label={folder.name}
                className={isRenaming ? 'is-folder-renaming' : undefined}
                trailing={trailing}
            />
        );
    }

    return (
        <FileTreeItem
            nodeId={folder.id}
            label={folder.name}
            hasChildren
            className={isRenaming ? 'is-folder-renaming' : undefined}
            trailing={trailing}
        >
            {nested}
        </FileTreeItem>
    );
}

function FolderItemActions({
    onRename,
    onDelete,
}: {
    onRename: () => void;
    onDelete: () => void;
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
                <button
                    type="button"
                    className="folder-item-action folder-item-action--danger"
                    aria-label="Delete folder"
                    title="Delete"
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
                aria-label="Confirm delete folder"
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
                            transition={
                                reduceMotion
                                    ? { duration: 0 }
                                    : { type: 'spring', stiffness: 500, damping: 40 }
                            }
                        />
                    ) : null}
                </AnimatePresence>
                {children}
            </div>
        </LibraryHighlightContext.Provider>
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

    return (
        <button
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
                            className="contact-list-highlight"
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
                            transition={
                                reduceMotion
                                    ? { duration: 0 }
                                    : { type: 'spring', stiffness: 500, damping: 40 }
                            }
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
    onSelect,
}: {
    user: any;
    myUsername: string | null;
    active: boolean;
    online: boolean | null;
    unread: number;
    typing: boolean;
    muted: boolean;
    onSelect: () => void;
}) {
    const rowRef = useRef<HTMLButtonElement>(null);
    const onHighlight = useContext(ContactHighlightContext);
    const reduceMotion = useReducedMotion() === true;
    const profile = resolveContactProfile(user.username, user, myUsername);
    const label = getDisplayLabel(user.username, profile);
    const hasDisplayName = Boolean(profile.displayName?.trim());
    const presenceClass = online == null ? 'presence-neutral' : online ? 'is-online' : 'is-offline';
    const time = formatSidebarTime(user.last_message_at);
    const preview = truncateSidebarPreview(user.last_message_preview);
    const showBadge = unread > 0 && !active;

    const bumpHighlight = () => onHighlight?.(rowRef.current);
    const spring = reduceMotion
        ? { duration: 0 }
        : { type: 'spring' as const, stiffness: 460, damping: 34 };

    return (
        <button
            ref={rowRef}
            type="button"
            className={`contact-row${active ? ' is-active' : ''}`}
            data-username={user.username}
            aria-label={`Open chat with ${label}`}
            aria-current={active ? 'true' : 'false'}
            onClick={onSelect}
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
                    <div className={`contact-presence ${presenceClass}`} data-presence-dot="true" aria-hidden="true" />
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

const SidebarDock = memo(function SidebarDock({
    onOpenSpotlight,
}: {
    onOpenSpotlight?: () => void;
}) {
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
        <div className="sidebar-dock-bar">
            <ExpandableTabs
                id="uiSidebarDock"
                label="App sections"
                tabs={DOCK_TABS}
                activeIndex={activeIndex}
                onChange={(index) => {
                    if (index == null) return;
                    const tab = DOCK_TABS[index];
                    if (tab && 'action' in tab && tab.action) onOpenSpotlight?.();
                }}
            />
        </div>
    );
});

const ProfileNav = memo(function ProfileNav() {
    return (
        <nav id="uiProfileNav" className="profile-nav" hidden aria-hidden="true" aria-label="Settings">
            <header className="profile-nav-toolbar">
                <button id="uiProfileNavBackBtn" className="mini-icon-btn profile-nav-back-btn" type="button" title="Back to chats" aria-label="Back to chats">
                    <Icon href="#icon-arrow-left" />
                </button>
                <div className="profile-nav-toolbar-copy">
                    <p className="profile-nav-toolbar-title">Settings</p>
                </div>
            </header>
            <p className="profile-nav-kicker">Settings</p>
            <button type="button" className="profile-nav-btn is-active" data-profile-nav="appearance" aria-current="page">
                <svg className="profile-nav-icon ui-icon" aria-hidden="true"><use href="#icon-palette" /></svg>
                <span className="profile-nav-copy"><span className="profile-nav-label">Appearance</span></span>
            </button>
            <button type="button" className="profile-nav-btn" data-profile-nav="security">
                <svg className="profile-nav-icon ui-icon" aria-hidden="true"><use href="#icon-shield" /></svg>
                <span className="profile-nav-copy"><span className="profile-nav-label">Security</span></span>
            </button>
            <button type="button" className="profile-nav-btn" data-profile-nav="privacy">
                <svg className="profile-nav-icon ui-icon" aria-hidden="true"><use href="#icon-eye" /></svg>
                <span className="profile-nav-copy"><span className="profile-nav-label">Privacy</span></span>
            </button>
            <button type="button" className="profile-nav-btn" data-profile-nav="data">
                <svg className="profile-nav-icon ui-icon" aria-hidden="true"><use href="#icon-database" /></svg>
                <span className="profile-nav-copy"><span className="profile-nav-label">Data</span></span>
            </button>
            <button id="uiProfileLogoutBtn" className="profile-nav-btn profile-nav-btn--logout" type="button">
                <svg className="profile-nav-icon ui-icon" aria-hidden="true"><use href="#icon-logout" /></svg>
                <span className="profile-nav-copy"><span className="profile-nav-label">Log out</span></span>
            </button>
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
