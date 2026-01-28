export interface MoltbotMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface MoltbotContext {
    sessionId: string;
    action?: string;
    [key: string]: any;
}

export interface MoltbotResponse {
    action: 'ask_user' | 'update_post' | 'post_now' | 'suggest_matches' | 'chat' | 'update_listing' | 'publish_listing';
    message: string;
    quick_replies?: string[];
    data?: any;
}

export const callMoltbot = async (messages: MoltbotMessage[], context: MoltbotContext): Promise<MoltbotResponse> => {
    try {
        // IMPORTANT: never call LLM providers directly from the browser. API keys would be exposed.
        // This helper calls a server-side endpoint that runs Moltbot and returns a JSON response.
        const response = await fetch('/api/moltbot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages, context }),
        });

        if (!response.ok) {
            throw new Error(`moltbot_http_${response.status}`);
        }

        return (await response.json()) as MoltbotResponse;
    } catch (error) {
        console.error('Moltbot error:', error);
        // Fallback response
        return {
            action: 'ask_user',
            message: "I'm having trouble processing that. Could you rephrase?",
            quick_replies: ['Start over', 'Get help']
        };
    }
};
