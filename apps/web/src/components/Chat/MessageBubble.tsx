import React from 'react';
import { ChatMessage } from '../../hooks/useChat';

interface MessageBubbleProps {
    message: ChatMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
    const isUser = message.role === 'user';

    return (
        <div style={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            marginBottom: '16px',
            width: '100%',
            animation: 'slideUp 0.3s ease-out both'
        }}>
            <div
                className={isUser ? '' : 'clay-card'}
                style={{
                    maxWidth: '80%',
                    padding: '14px 18px',
                    borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                    background: isUser ? 'var(--gradient-primary)' : undefined, // Clay card has its own background
                    color: isUser ? '#fff' : 'var(--neutral-800)',
                    fontSize: '15px',
                    lineHeight: '1.5',
                    boxShadow: isUser ? '0 4px 12px rgba(78, 205, 196, 0.4)' : undefined, // Manual shadow for user bubble
                    backgroundBlendMode: isUser ? undefined : 'overlay'
                }}
            >
                {message.text}
            </div>
        </div>
    );
};
