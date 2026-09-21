import type { KeyboardEvent } from 'react';
import { peekChatEngine } from '../../engine/chatEngine';
import { Icon } from '../../components/Icon';

const EMOJIS = ['😀', '🚀', '🔥', '✨', '❤️', '👍', '🤔', '🎉'] as const;

type ChatInputProps = {
    onSend?: () => void;
};

export function ChatInput({ onSend }: ChatInputProps) {

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        const engine = peekChatEngine();
        const enterToSend = Boolean(engine?.state.preferences?.enterToSend);
        const primary = event.metaKey || event.ctrlKey;
        if (event.key === 'Enter' && !event.shiftKey && (enterToSend || primary)) {
            event.preventDefault();
            onSend?.();
        }
    };

    return (
        <div className="input-bar">
            <div id="uiPasteAttachments" className="paste-attachments hidden" aria-hidden="true" aria-label="Pasted text" />
            <div id="uiReplyBar" className="composer-reply-bar hidden" aria-live="polite">
                <div className="composer-reply-accent" aria-hidden="true" />
                <div className="composer-reply-body">
                    <p id="uiReplyLabel" className="composer-reply-label">Reply</p>
                    <p id="uiReplyPreview" className="composer-reply-preview" />
                </div>
                <button id="uiReplyCloseBtn" type="button" className="composer-reply-close" title="Cancel reply" aria-label="Cancel reply">
                    <Icon href="#icon-x" />
                </button>
            </div>
            <span id="uiDraftStatus" className="composer-status hidden" aria-live="polite" />
            <div className="composer-input-dock">
                <div className="input-row">
                    <button id="uiAttachBtn" className="btn-attach" type="button" title="Attach file" aria-label="Attach file">
                        <Icon href="#icon-paperclip" />
                    </button>
                    <input id="uiFileInput" className="hidden" type="file" multiple />
                    <div className="composer-field">
                        <textarea
                            id="messageInput"
                            placeholder="Type a message…"
                            rows={1}
                            maxLength={2000}
                            disabled
                            onKeyDown={onKeyDown}
                        />
                    </div>
                    <div className="composer-actions">
                        <div className="composer-emoji-wrap">
                            <button id="uiEmojiBtn" className="btn-attach" type="button" title="Insert emoji" aria-label="Insert emoji" aria-expanded="false" aria-haspopup="true" disabled>
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
                        <button id="uiComposerMenuBtn" className="hidden" type="button" tabIndex={-1} title="Message tools" aria-haspopup="menu" aria-label="Message tools" />
                        <button id="sendBtn" type="button" title="Send message" aria-label="Send message" disabled onClick={() => onSend?.()}>
                            <Icon href="#icon-send" />
                        </button>
                    </div>
                </div>
                <button id="uiScrollBottomBtn" className="chat-jump-bottom" type="button" title="Scroll to bottom" aria-label="Scroll to bottom" aria-hidden="true">
                    <Icon href="#icon-chevron-down" />
                </button>
            </div>
            <span id="uiCharCounter" className="composer-char-counter">0 / 2000</span>
        </div>
    );
}
