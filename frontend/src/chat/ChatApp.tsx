import { createContext, useContext, useState } from 'react';
import { chatRegions } from './config/regions';
import { ChatHeader } from './regions/ChatHeader/ChatHeader';
import { ChatInput } from './regions/ChatInput/ChatInput';
import { MessageFeed } from './regions/MessageFeed/MessageFeed';

export type ChatAppHandlers = {
    onSelectChat?: (username: string) => void;
    onSend?: () => void;
    onOpenSpotlight?: () => void;
};

const ChatAppContext = createContext<ChatAppHandlers>({});

export function useChatAppHandlers() {
    return useContext(ChatAppContext);
}

export function ChatApp({ handlers }: { handlers?: ChatAppHandlers }) {
    const [isSpotlightOpen, setSpotlightOpen] = useState(false);
    const sidebar = chatRegions.find((region) => region.id === 'sidebar' && region.isVisible);
    const peer = chatRegions.find((region) => region.id === 'peer' && region.isVisible);
    const Sidebar = sidebar?.component;
    const Peer = peer?.component;

    const merged: ChatAppHandlers = {
        onSelectChat: handlers?.onSelectChat,
        onSend: handlers?.onSend,
        onOpenSpotlight: () => {
            setSpotlightOpen(true);
            handlers?.onOpenSpotlight?.();
        },
    };

    return (
        <ChatAppContext.Provider value={merged}>
            {Sidebar ? <Sidebar onSelectChat={merged.onSelectChat} onOpenSpotlight={merged.onOpenSpotlight} /> : null}
            <div id="uiChatWorkspace" className="chat-workspace">
                <main className="chat-main">
                    <ChatAtmosphere />
                    <ChatHeader />
                    <ChatInput onSend={merged.onSend} />
                    <MessageFeed />
                </main>
                {Peer ? <Peer /> : null}
            </div>
            <span hidden data-spotlight-open={isSpotlightOpen ? '1' : '0'} />
        </ChatAppContext.Provider>
    );
}

function ChatAtmosphere() {
    return (
        <div className="chat-stage-atmosphere" aria-hidden="true">
            <svg className="chat-stage-atmosphere__field" viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid slice" focusable="false">
                <defs>
                    <linearGradient id="chatSky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.035" />
                        <stop offset="18%" stopColor="#ffffff" stopOpacity="0.018" />
                        <stop offset="52%" stopColor="#ffffff" stopOpacity="0.006" />
                        <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="chatSilk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                        <stop offset="22%" stopColor="#ffffff" stopOpacity="0.018" />
                        <stop offset="38%" stopColor="#ffffff" stopOpacity="0.07" />
                        <stop offset="68%" stopColor="#ffffff" stopOpacity="0.018" />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                    </linearGradient>
                    <filter id="chatSoft" x="-20%" y="-10%" width="140%" height="120%">
                        <feGaussianBlur stdDeviation="32" />
                    </filter>
                </defs>
                <rect width="800" height="1200" fill="url(#chatSky)" />
                <g filter="url(#chatSoft)" fill="url(#chatSilk)">
                    <ellipse cx="170" cy="460" rx="70" ry="520" />
                    <ellipse cx="330" cy="380" rx="90" ry="640" />
                    <ellipse cx="490" cy="500" rx="64" ry="500" />
                    <ellipse cx="640" cy="360" rx="80" ry="580" />
                </g>
                <g fill="#ffffff">
                    <circle cx="92" cy="140" r="1.1" opacity="0.18" />
                    <circle cx="210" cy="86" r="0.8" opacity="0.12" />
                    <circle cx="268" cy="230" r="1" opacity="0.16" />
                    <circle cx="410" cy="70" r="0.7" opacity="0.1" />
                    <circle cx="520" cy="160" r="1.2" opacity="0.2" />
                    <circle cx="612" cy="112" r="0.8" opacity="0.12" />
                    <circle cx="718" cy="210" r="1" opacity="0.15" />
                    <circle cx="148" cy="340" r="0.7" opacity="0.1" />
                    <circle cx="356" cy="190" r="0.9" opacity="0.14" />
                    <circle cx="678" cy="360" r="0.8" opacity="0.11" />
                    <circle cx="88" cy="520" r="0.6" opacity="0.08" />
                    <circle cx="760" cy="480" r="0.9" opacity="0.12" />
                    <circle cx="244" cy="610" r="0.7" opacity="0.09" />
                    <circle cx="574" cy="560" r="0.8" opacity="0.1" />
                </g>
            </svg>
        </div>
    );
}
