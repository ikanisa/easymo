import React, { useRef, useEffect } from 'react';
import { Send, X, MessageCircle } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { ChatMessage } from '../../hooks/useChat';

interface ChatInterfaceProps {
    isOpen: boolean;
    onClose: () => void;
    messages: ChatMessage[];
    onSendMessage: (text: string) => void;
    isLoading?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    isOpen,
    onClose,
    messages,
    onSendMessage,
    isLoading = false
}) => {
    const [inputValue, setInputValue] = React.useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            onSendMessage(inputValue);
            setInputValue('');
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '80vh',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            borderTopLeftRadius: '32px',
            borderTopRightRadius: '32px',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.1)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            borderTop: '1px solid rgba(255,255,255,0.5)'
        }}>
            {/* Header */}
            <div style={{
                height: '60px',
                padding: '0 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'var(--gradient-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                    }}>
                        <MessageCircle size={18} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--neutral-800)' }}>Moltbot</h3>
                        <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>Online</span>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '50%',
                        color: 'var(--neutral-500)'
                    }}
                >
                    <X size={24} />
                </button>
            </div>

            {/* Messages */}
            <div style={{
                flex: 1,
                padding: '24px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {messages.map((msg) => (
                    <React.Fragment key={msg.id}>
                        <MessageBubble message={msg} />
                        {/* Render Quick Replies if available from bot and it's the last message */}
                        {msg.role === 'moltbot' && msg.quickReplies && (
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px',
                                marginBottom: '16px',
                                marginLeft: '4px',
                                animation: 'fadeIn 0.5s ease 0.2s both'
                            }}>
                                {msg.quickReplies.map(reply => (
                                    <button
                                        key={reply}
                                        onClick={() => onSendMessage(reply)}
                                        className="clay-button"
                                        style={{
                                            padding: '8px 16px',
                                            fontSize: '13px',
                                            borderRadius: '12px',
                                            color: 'var(--primary-teal)',
                                            border: '1px solid currentColor' // Slightly customized clay button
                                        }}
                                    >
                                        {reply}
                                    </button>
                                ))}
                            </div>
                        )}
                    </ React.Fragment>
                ))}
                {isLoading && (
                    <div style={{ display: 'flex', gap: '4px', padding: '12px', marginLeft: '12px' }}>
                        <div style={{ width: '8px', height: '8px', background: 'var(--neutral-400)', borderRadius: '50%', animation: 'bounceIn 1s infinite 0s' }} />
                        <div style={{ width: '8px', height: '8px', background: 'var(--neutral-400)', borderRadius: '50%', animation: 'bounceIn 1s infinite 0.2s' }} />
                        <div style={{ width: '8px', height: '8px', background: 'var(--neutral-400)', borderRadius: '50%', animation: 'bounceIn 1s infinite 0.4s' }} />
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{
                padding: '16px 24px',
                borderTop: '1px solid rgba(0,0,0,0.05)',
                background: 'rgba(255,255,255,0.5)',
                marginBottom: 'safe-area-inset-bottom'
            }}>
                <form
                    onSubmit={handleSubmit}
                    style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
                >
                    <input
                        type="text"
                        className="clay-input"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type a message..."
                        style={{ flex: 1 }}
                    />
                    <button
                        type="submit"
                        className="clay-button"
                        disabled={!inputValue.trim()}
                        style={{
                            width: '48px',
                            height: '48px',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            background: inputValue.trim() ? 'var(--gradient-primary)' : undefined,
                            color: inputValue.trim() ? 'white' : 'var(--neutral-400)',
                            opacity: inputValue.trim() ? 1 : 0.7
                        }}
                    >
                        <Send size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
};
