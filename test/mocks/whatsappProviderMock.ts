/**
 * WhatsApp Provider Mock
 * 
 * Mock adapter for simulating WhatsApp Business API interactions.
 * Captures outbound messages and produces scripted inbound messages.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ScenarioContext, WhatsAppMockAdapter, ClientInbound } from '../e2e/scenario-runner';

// =============================================================================
// Types
// =============================================================================

export interface OutboundMessage {
    to: string;
    type: 'text' | 'buttons' | 'list' | 'template' | 'image' | 'document';
    content: unknown;
    timestamp: string;
    messageId: string;
}

export interface InboundMessage {
    messageId: string;
    from: string;
    type: 'text' | 'image' | 'document' | 'audio' | 'location' | 'interactive';
    body?: string;
    mediaUrl?: string;
    buttonId?: string;
    listId?: string;
    timestamp: string;
}

export interface WhatsAppMockConfig {
    phoneNumberId?: string;
    baseUrl?: string;
}

// =============================================================================
// WhatsApp Provider Mock Implementation
// =============================================================================

export class WhatsAppProviderMock implements WhatsAppMockAdapter {
    private outboundMessages: OutboundMessage[] = [];
    private inboundQueue: InboundMessage[] = [];
    private lastMessageId: string = '';
    private messageIdCounter: number = 0;

    constructor(private config: WhatsAppMockConfig = {}) { }

    // ==========================================================================
    // WhatsAppMockAdapter Interface
    // ==========================================================================

    async sendInbound(message: ClientInbound, context: ScenarioContext): Promise<string> {
        const messageId = message.duplicate
            ? this.lastMessageId
            : this.generateMessageId();

        const inbound: InboundMessage = {
            messageId,
            from: context.clientPhone,
            type: message.message_type,
            timestamp: new Date().toISOString(),
        };

        if (message.text) {
            inbound.body = message.text;
        }

        if (message.media_fixture) {
            inbound.mediaUrl = `mock://media/${message.media_fixture}`;
        }

        if (message.button_id) {
            inbound.buttonId = message.button_id;
        }

        if (message.list_id) {
            inbound.listId = message.list_id;
        }

        this.inboundQueue.push(inbound);
        this.lastMessageId = messageId;

        return messageId;
    }

    getOutbound(): OutboundMessage[] {
        return [...this.outboundMessages];
    }

    reset(): void {
        this.outboundMessages = [];
        this.inboundQueue = [];
        this.lastMessageId = '';
        this.messageIdCounter = 0;
    }

    // ==========================================================================
    // Message Sending (Mock Capture)
    // ==========================================================================

    async sendText(to: string, text: string): Promise<{ messageId: string }> {
        const messageId = this.generateMessageId();
        this.outboundMessages.push({
            to,
            type: 'text',
            content: text,
            timestamp: new Date().toISOString(),
            messageId,
        });
        return { messageId };
    }

    async sendButtons(
        to: string,
        text: string,
        buttons: Array<{ id: string; title: string }>,
    ): Promise<{ messageId: string }> {
        const messageId = this.generateMessageId();
        this.outboundMessages.push({
            to,
            type: 'buttons',
            content: { text, buttons },
            timestamp: new Date().toISOString(),
            messageId,
        });
        return { messageId };
    }

    async sendList(
        to: string,
        header: string,
        body: string,
        buttonText: string,
        sections: Array<{
            title: string;
            rows: Array<{ id: string; title: string; description?: string }>;
        }>,
    ): Promise<{ messageId: string }> {
        const messageId = this.generateMessageId();
        this.outboundMessages.push({
            to,
            type: 'list',
            content: { header, body, buttonText, sections },
            timestamp: new Date().toISOString(),
            messageId,
        });
        return { messageId };
    }

    async sendTemplate(
        to: string,
        templateName: string,
        languageCode: string,
        components?: Array<Record<string, unknown>>,
    ): Promise<{ messageId: string }> {
        const messageId = this.generateMessageId();
        this.outboundMessages.push({
            to,
            type: 'template',
            content: { templateName, languageCode, components },
            timestamp: new Date().toISOString(),
            messageId,
        });
        return { messageId };
    }

    async sendImage(
        to: string,
        imageUrl: string,
        caption?: string,
    ): Promise<{ messageId: string }> {
        const messageId = this.generateMessageId();
        this.outboundMessages.push({
            to,
            type: 'image',
            content: { imageUrl, caption },
            timestamp: new Date().toISOString(),
            messageId,
        });
        return { messageId };
    }

    async sendDocument(
        to: string,
        documentUrl: string,
        filename: string,
        caption?: string,
    ): Promise<{ messageId: string }> {
        const messageId = this.generateMessageId();
        this.outboundMessages.push({
            to,
            type: 'document',
            content: { documentUrl, filename, caption },
            timestamp: new Date().toISOString(),
            messageId,
        });
        return { messageId };
    }

    // ==========================================================================
    // Media Handling
    // ==========================================================================

    async getMediaUrl(mediaId: string): Promise<string> {
        return `mock://media/${mediaId}`;
    }

    async downloadMedia(mediaUrl: string): Promise<ArrayBuffer> {
        // Return empty buffer for mock
        return new ArrayBuffer(0);
    }

    // ==========================================================================
    // Helpers
    // ==========================================================================

    private generateMessageId(): string {
        this.messageIdCounter++;
        return `wamid.mock_${this.messageIdCounter}_${Date.now()}`;
    }

    /**
     * Get inbound messages (for inspection in tests)
     */
    getInbound(): InboundMessage[] {
        return [...this.inboundQueue];
    }

    /**
     * Get last outbound message
     */
    getLastOutbound(): OutboundMessage | undefined {
        return this.outboundMessages[this.outboundMessages.length - 1];
    }

    /**
     * Get messages sent to a specific recipient
     */
    getMessagesTo(recipient: string): OutboundMessage[] {
        return this.outboundMessages.filter(m => m.to === recipient);
    }

    /**
     * Check if any outbound contains a substring
     */
    hasOutboundContaining(substring: string): boolean {
        return this.outboundMessages.some(m => {
            const content = typeof m.content === 'string'
                ? m.content
                : JSON.stringify(m.content);
            return content.includes(substring);
        });
    }

    /**
     * Count wa.me links in all outbound messages
     */
    countWaMeLinks(): number {
        let count = 0;
        for (const msg of this.outboundMessages) {
            const content = typeof msg.content === 'string'
                ? msg.content
                : JSON.stringify(msg.content);
            const matches = content.match(/wa\.me\/\d+/g);
            count += matches?.length ?? 0;
        }
        return count;
    }

    /**
     * Create a webhook-style payload from an inbound message
     */
    createWebhookPayload(inbound: InboundMessage): Record<string, unknown> {
        const baseMessage: Record<string, unknown> = {
            id: inbound.messageId,
            from: inbound.from,
            timestamp: String(Math.floor(new Date(inbound.timestamp).getTime() / 1000)),
            type: inbound.type,
        };

        switch (inbound.type) {
            case 'text':
                baseMessage.text = { body: inbound.body };
                break;
            case 'interactive':
                if (inbound.buttonId) {
                    baseMessage.interactive = {
                        type: 'button_reply',
                        button_reply: { id: inbound.buttonId, title: 'Button' },
                    };
                } else if (inbound.listId) {
                    baseMessage.interactive = {
                        type: 'list_reply',
                        list_reply: { id: inbound.listId, title: 'List Item' },
                    };
                }
                break;
            case 'image':
                baseMessage.image = {
                    id: `media_${inbound.messageId}`,
                    mime_type: 'image/jpeg',
                };
                break;
            case 'document':
                baseMessage.document = {
                    id: `media_${inbound.messageId}`,
                    mime_type: 'application/pdf',
                };
                break;
        }

        return {
            object: 'whatsapp_business_account',
            entry: [
                {
                    id: 'test-entry-id',
                    changes: [
                        {
                            value: {
                                messaging_product: 'whatsapp',
                                metadata: {
                                    display_phone_number: this.config.phoneNumberId ?? '15550123456',
                                    phone_number_id: 'test-phone-id',
                                },
                                contacts: [
                                    {
                                        wa_id: inbound.from,
                                        profile: { name: 'Test User' },
                                    },
                                ],
                                messages: [baseMessage],
                            },
                            field: 'messages',
                        },
                    ],
                },
            ],
        };
    }
}

// =============================================================================
// Factory
// =============================================================================

export function createWhatsAppMock(config?: WhatsAppMockConfig): WhatsAppProviderMock {
    return new WhatsAppProviderMock(config);
}
