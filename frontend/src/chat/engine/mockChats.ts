import { ingestUserRecords } from '../../../js/profileDirectory.js';
import type { ChatEngine } from './chatEngine';

export type MockMessage = {
    id: string;
    clientMessageId: string;
    sender: string;
    text: string;
    type: 'incoming' | 'outgoing';
    timestamp: number;
    status?: string;
};

export type MockChatFixture = {
    username: string;
    display_name: string;
    last_message_at: string;
    last_message_preview: string;
    unread_count?: number;
    online?: boolean;
    messages: MockMessage[];
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function ago(ms: number) {
    return Date.now() - ms;
}

function outgoing(id: string, text: string, timestamp: number, status = 'read'): MockMessage {
    return {
        id,
        clientMessageId: `mock-out-${id}`,
        sender: 'You',
        text,
        type: 'outgoing',
        timestamp,
        status,
    };
}

function incoming(username: string, id: string, text: string, timestamp: number): MockMessage {
    return {
        id,
        clientMessageId: `mock-in-${id}`,
        sender: username,
        text,
        type: 'incoming',
        timestamp,
    };
}

export const MOCK_CHATS: MockChatFixture[] = [
    {
        username: 'mira',
        display_name: 'Mira Chen',
        last_message_at: new Date(ago(8 * MINUTE)).toISOString(),
        last_message_preview: 'Keys stay on the device. That’s the whole point.',
        unread_count: 2,
        online: true,
        messages: [
            incoming('mira', 'mira-1', 'Did the React shell land without touching crypto?', ago(3 * HOUR)),
            outgoing('mira-2', 'Yes. Engine still owns keys and the wire.', ago(3 * HOUR - 4 * MINUTE)),
            incoming('mira', 'mira-3', 'Then the center column is just a host for vanilla bubbles?', ago(2 * HOUR)),
            outgoing('mira-4', 'Exactly. #messages is a Trojan-horse ref.', ago(2 * HOUR - 6 * MINUTE)),
            incoming('mira', 'mira-5', 'Keys stay on the device. That’s the whole point.', ago(8 * MINUTE)),
        ],
    },
    {
        username: 'jonas',
        display_name: 'Jonas Hale',
        last_message_at: new Date(ago(42 * MINUTE)).toISOString(),
        last_message_preview: 'Ping me when the dock stacks on mobile.',
        messages: [
            outgoing('jonas-1', 'Sidebar is 288 again. Workspace flexes.', ago(5 * HOUR)),
            incoming('jonas', 'jonas-2', 'Good. Last time the root was a block and the composer fell off the page.', ago(5 * HOUR - 10 * MINUTE)),
            outgoing('jonas-3', 'Fixed. Profile is a sibling, not a third chat column.', ago(4 * HOUR)),
            incoming('jonas', 'jonas-4', 'Ping me when the dock stacks on mobile.', ago(42 * MINUTE)),
        ],
    },
    {
        username: 'nexa_lab',
        display_name: 'NEXA Lab',
        last_message_at: new Date(ago(26 * HOUR)).toISOString(),
        last_message_preview: 'Mock thread for the hybrid bridge test.',
        online: true,
        messages: [
            incoming('nexa_lab', 'lab-1', 'This conversation is local-only. Nothing is sent.', ago(28 * HOUR)),
            outgoing('lab-2', 'Understood. Selecting this chat should paint bubbles in #messages.', ago(27 * HOUR)),
            incoming('nexa_lab', 'lab-3', 'Mock thread for the hybrid bridge test.', ago(26 * HOUR)),
        ],
    },
];

export function seedMockChats(engine: ChatEngine, fixtures: MockChatFixture[] = MOCK_CHATS) {
    ingestUserRecords(fixtures.map((chat) => ({
        username: chat.username,
        display_name: chat.display_name,
        public_key: 'mock',
    })));
    engine.seedMockChats(fixtures);
}
