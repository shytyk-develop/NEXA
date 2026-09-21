export type ChatEngineEvent =
    | 'chatsChanged'
    | 'activeChatChanged'
    | 'messageAppended'
    | 'messagePatched'
    | 'historyReplaced'
    | 'connectionChanged'
    | 'pendingReplyChanged'
    | 'uiSync'
    | 'chatsLoading';

export type ChatEngineListener = (payload?: any) => void;

export function createEmitter() {
    const listeners = new Map<ChatEngineEvent, Set<ChatEngineListener>>();

    return {
        on(event: ChatEngineEvent, fn: ChatEngineListener) {
            let bucket = listeners.get(event);
            if (!bucket) {
                bucket = new Set();
                listeners.set(event, bucket);
            }
            bucket.add(fn);
            return () => bucket!.delete(fn);
        },
        emit(event: ChatEngineEvent, payload?: any) {
            listeners.get(event)?.forEach((fn) => fn(payload));
        },
    };
}
