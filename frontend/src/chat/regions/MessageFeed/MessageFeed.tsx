import { memo } from 'react';
import { ScrollBlur } from '@/components/ui/scroll-blur';

/**
 * Vanilla island: ui.js owns children of #messages (bubbles, grouping).
 * React must not render into that node. Scroll lives on ScrollBlur’s viewport;
 * ui.js resolves it via closest([data-slot=scroll-blur-viewport]).
 */
export const MessageFeed = memo(function MessageFeed() {
    return (
        <div className="chat-stage">
            <ScrollBlur
                edgeSize={56}
                forceEdges
                hideScrollbar={false}
                className="chat-messages-scroll"
                viewportClassName="chat-messages-scroll__viewport"
                contentClassName="chat-messages-scroll__content"
            >
                <div id="messages" aria-live="polite" />
            </ScrollBlur>
            <div id="chat-welcome">
                <p className="welcome-label">Select Chat</p>
            </div>
        </div>
    );
});
