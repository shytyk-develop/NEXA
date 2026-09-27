// Chat folders, synced with the server (GET/POST/PUT/DELETE /api/folders).
//
// Shape the sidebar works with: Work and Personal are fixed roots (client ids
// 'work' / 'personal'), each holding one level of custom folders (their ids
// are the server's UUIDs — the client picks them, so an optimistic create
// already has its final id). `chats` maps a folder id to the partner
// usernames filed in it.
//
// Every change applies to the UI at once and is sent in order; if the server
// refuses, the store reloads from it. The first sign-in after this moved
// server-side uploads the folders this browser kept in localStorage.

import {
    createFolderRequest,
    deleteFolderRequest,
    getFolders,
    updateFolderRequest,
} from '../../../js/api.js';

export type FolderRoot = 'work' | 'personal';
export type CustomFolder = { id: string; name: string; children: CustomFolder[] };
export type FolderTree = { work: CustomFolder[]; personal: CustomFolder[] };
export type FolderChats = Record<string, string[]>;

type ServerFolder = {
    id: string;
    kind: 'work' | 'personal' | 'custom';
    parent_id: string | null;
    name: string;
    position: number;
    chat_ids: string[];
};

type State = {
    owner: string | null;
    loaded: boolean;
    tree: FolderTree;
    chats: FolderChats;
    /** Server ids of the Work / Personal rows. */
    rootIds: Partial<Record<FolderRoot, string>>;
};

const EMPTY_TREE: FolderTree = { work: [], personal: [] };
let state: State = { owner: null, loaded: false, tree: EMPTY_TREE, chats: {}, rootIds: {} };
const listeners = new Set<() => void>();

function setState(next: Partial<State>) {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
}

export function subscribeFolders(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function getFoldersSnapshot() {
    return state;
}

/** Requests go out one after another, in the order the UI made the changes. */
let queue: Promise<unknown> = Promise.resolve();
function enqueue(task: () => Promise<unknown>) {
    const owner = state.owner;
    queue = queue
        .then(task)
        .catch((error) => {
            console.warn('Folder sync failed; reloading from the server.', error);
            if (owner && owner === state.owner) void loadFolders(owner, { force: true });
        });
    return queue;
}

function fromServer(folders: ServerFolder[]): Pick<State, 'tree' | 'chats' | 'rootIds'> {
    const rootIds: Partial<Record<FolderRoot, string>> = {};
    const rootKindById = new Map<string, FolderRoot>();
    folders.forEach((folder) => {
        if (folder.kind !== 'custom') {
            rootIds[folder.kind] = folder.id;
            rootKindById.set(folder.id, folder.kind);
        }
    });
    const tree: FolderTree = { work: [], personal: [] };
    const chats: FolderChats = {};
    folders.forEach((folder) => {
        const clientId = folder.kind === 'custom' ? folder.id : folder.kind;
        if (folder.chat_ids.length) chats[clientId] = [...folder.chat_ids];
        if (folder.kind === 'custom' && folder.parent_id) {
            const root = rootKindById.get(folder.parent_id);
            if (root) tree[root].push({ id: folder.id, name: folder.name, children: [] });
        }
    });
    return { tree, chats, rootIds };
}

/** Server id for a client folder id ('work' / 'personal' → their rows). */
function serverId(folderId: string) {
    return folderId === 'work' || folderId === 'personal' ? state.rootIds[folderId] : folderId;
}

// ── Legacy localStorage (pre-sync) ───────────────────────────────────────────

const LEGACY_TREE_KEY = 'nexa.sidebar.custom-folders';
const LEGACY_CHATS_KEY = 'nexa.sidebar.folder-chats';

function readLegacy(): { tree: FolderTree; chats: FolderChats } | null {
    try {
        const rawTree = localStorage.getItem(LEGACY_TREE_KEY);
        const rawChats = localStorage.getItem(LEGACY_CHATS_KEY);
        if (!rawTree && !rawChats) return null;
        const parsedTree = rawTree ? JSON.parse(rawTree) : {};
        const parsedChats = rawChats ? JSON.parse(rawChats) : {};
        const flatten = (list: unknown): CustomFolder[] => {
            const out: CustomFolder[] = [];
            const visit = (items: any[]) =>
                items.forEach((item) => {
                    if (item && typeof item.id === 'string' && typeof item.name === 'string') {
                        out.push({ id: item.id, name: item.name, children: [] });
                        if (Array.isArray(item.children)) visit(item.children);
                    }
                });
            if (Array.isArray(list)) visit(list);
            return out;
        };
        const chats: FolderChats = {};
        if (parsedChats && typeof parsedChats === 'object') {
            Object.entries(parsedChats).forEach(([id, list]) => {
                if (Array.isArray(list)) chats[id] = list.filter((u): u is string => typeof u === 'string');
            });
        }
        return { tree: { work: flatten(parsedTree?.work), personal: flatten(parsedTree?.personal) }, chats };
    } catch {
        return null;
    }
}

function clearLegacy() {
    try {
        localStorage.removeItem(LEGACY_TREE_KEY);
        localStorage.removeItem(LEGACY_CHATS_KEY);
    } catch {
        /* ignore */
    }
}

/** Upload this browser's old local folders — only into an account that has none yet. */
async function migrateLegacy(folders: ServerFolder[]): Promise<boolean> {
    const legacy = readLegacy();
    if (!legacy) return false;
    const serverHasData = folders.some((f) => f.kind === 'custom' || f.chat_ids.length);
    const hasLocal = legacy.tree.work.length || legacy.tree.personal.length || Object.values(legacy.chats).some((l) => l.length);
    if (serverHasData || !hasLocal) {
        clearLegacy();
        return false;
    }
    const roots = fromServer(folders).rootIds;
    for (const root of ['work', 'personal'] as FolderRoot[]) {
        for (const [index, folder] of legacy.tree[root].entries()) {
            await createFolderRequest({
                id: crypto.randomUUID(),
                name: folder.name.slice(0, 32) || 'Folder',
                root,
                position: index,
                chat_ids: legacy.chats[folder.id] || [],
            });
        }
        const rootId = roots[root];
        if (rootId && legacy.chats[root]?.length) {
            await updateFolderRequest(rootId, { chat_ids: legacy.chats[root] });
        }
    }
    clearLegacy();
    return true;
}

// ── Loading ──────────────────────────────────────────────────────────────────

let loadToken = 0;

/** Load (or reload) the signed-in user's folders from the server. */
export async function loadFolders(owner: string | null, { force = false } = {}) {
    if (!owner) {
        loadToken += 1;
        setState({ owner: null, loaded: false, tree: EMPTY_TREE, chats: {}, rootIds: {} });
        return;
    }
    if (!force && state.owner === owner && state.loaded) return;
    const token = ++loadToken;
    if (state.owner !== owner) setState({ owner, loaded: false, tree: EMPTY_TREE, chats: {}, rootIds: {} });
    try {
        let { folders } = (await getFolders()) as { folders: ServerFolder[] };
        if (await migrateLegacy(folders)) {
            ({ folders } = (await getFolders()) as { folders: ServerFolder[] });
        }
        if (token !== loadToken) return;
        setState({ owner, loaded: true, ...fromServer(folders) });
    } catch (error) {
        console.warn('Could not load folders.', error);
    }
}

// ── Changes (optimistic) ─────────────────────────────────────────────────────

/** New custom folder under a root; returns its id right away. */
export function createFolder(root: FolderRoot, name: string): string {
    const id = crypto.randomUUID();
    setState({ tree: { ...state.tree, [root]: [...state.tree[root], { id, name, children: [] }] } });
    const position = state.tree[root].length - 1;
    void enqueue(() => createFolderRequest({ id, name, root, position, chat_ids: [] }));
    return id;
}

export function renameFolder(folderId: string, name: string) {
    const rename = (list: CustomFolder[]) => list.map((f) => (f.id === folderId ? { ...f, name } : f));
    setState({ tree: { work: rename(state.tree.work), personal: rename(state.tree.personal) } });
    void enqueue(() => updateFolderRequest(folderId, { name }));
}

/** Delete a custom folder (the chats stay; only the grouping goes). */
export function deleteFolder(folderId: string) {
    const drop = (list: CustomFolder[]) => list.filter((f) => f.id !== folderId);
    const chats = { ...state.chats };
    delete chats[folderId];
    setState({ tree: { work: drop(state.tree.work), personal: drop(state.tree.personal) }, chats });
    void enqueue(() => deleteFolderRequest(folderId));
}

/** Replace the chats filed in a folder (roots included). */
export function setFolderChats(folderId: string, usernames: string[]) {
    const unique = [...new Set(usernames)];
    setState({ chats: { ...state.chats, [folderId]: unique } });
    void enqueue(async () => {
        const id = serverId(folderId);
        if (id) await updateFolderRequest(id, { chat_ids: unique });
    });
}

export function removeChatFromFolder(folderId: string, username: string) {
    setFolderChats(folderId, (state.chats[folderId] || []).filter((u) => u !== username));
}
