
import { useState, useCallback } from 'react';
import { callMoltbot, MoltbotMessage } from '../utils/moltbot';

export interface ChatMessage {
    role: 'user' | 'moltbot';
    content: string;
    text: string; // Required for ChatWindow

    // Guide standard:
    quickReplies?: string[];
    data?: any;
    action?: string;
    timestamp: Date;
    id: string; // Required for ChatWindow
    tone?: "clarify" | "confirm" | string; // ChatWindow uses these
}

export const useChat = (sessionId: string, initialMessages: ChatMessage[] = []) => {
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
    const [isLoading, setIsLoading] = useState(false);

    const sendMessage = useCallback(async (userMessage: string) => {
        // Add user message
        const newUserMessage: ChatMessage = {
            role: 'user',
            content: userMessage,
            text: userMessage,
            timestamp: new Date(),
            id: crypto.randomUUID()
        };

        setMessages(prev => [...prev, newUserMessage]);
        setIsLoading(true);

        try {
            // Build conversation history for API
            const conversationHistory: MoltbotMessage[] = messages.map(m => ({
                role: (m.role === 'moltbot' ? 'assistant' : m.role) as 'user' | 'assistant',
                content: m.content || m.text || ''
            }));
            conversationHistory.push({ role: 'user', content: userMessage });

            // Call Moltbot
            const response = await callMoltbot(conversationHistory, {
                sessionId,
                action: 'chat'
            });

            // Add bot response
            const botMessage: ChatMessage = {
                role: 'moltbot', // Keeping 'moltbot' to be consistent with existing UI components if they rely on it, guide says 'assistant' in hook but 'moltbot' in App.tsx.
                content: response.message,
                text: response.message,
                quickReplies: response.quick_replies,
                data: response.data,
                action: response.action,
                timestamp: new Date(),
                id: crypto.randomUUID()
            };

            setMessages(prev => [...prev, botMessage]);

            return response;
        } catch (error) {
            console.error('Chat error:', error);

            const errorMessage: ChatMessage = {
                role: 'moltbot',
                content: 'Sorry, I encountered an error. Please try again.',
                text: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
                id: crypto.randomUUID()
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [messages, sessionId]);

    const reset = useCallback(() => {
        setMessages([]);
    }, []);

    return {
        messages,
        setMessages,
        sendMessage,
        isLoading,
        reset
    };
};
