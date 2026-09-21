import { memo, useRef } from 'react';

/**
 * Vanilla island: ui.js owns children of #messages (bubbles, frost, grouping).
 * React must not render into this node.
 */
export const MessageFeed = memo(function MessageFeed() {
    const chatContainerRef = useRef<HTMLDivElement>(null);

    return (
        <div className="chat-stage">
            <div id="messages" ref={chatContainerRef} aria-live="polite" />
            <div id="chat-welcome">
                <p className="welcome-label">Select Chat</p>
            </div>
        </div>
    );
});
