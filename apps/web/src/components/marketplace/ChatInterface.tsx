import { useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { clayCard, clayButton } from '../../styles/clayStyles';
import { Message } from '../../types/marketplace';

interface ChatInterfaceProps {
    chatOpen: boolean;
    setChatOpen: (open: boolean) => void;
    messages: Message[];
    inputValue: string;
    setInputValue: (val: string) => void;
    handleSendMessage: () => void;
    handleQuickReply: (reply: string) => void;
}

export const ChatInterface = ({
    chatOpen,
    setChatOpen,
    messages,
    inputValue,
    setInputValue,
    handleSendMessage,
    handleQuickReply
}: ChatInterfaceProps) => {
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: chatOpen ? '80vh' : '0',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            borderTopLeftRadius: '32px',
            borderTopRightRadius: '32px',
            boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.1)',
            transition: 'height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Chat Header */}
            <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255, 255, 255, 0.8)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #4ECDC4, #44A08D)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px'
                    }}>
                        🤖
                    </div>
                    <div>
                        <h3 style={{
                            fontSize: '17px',
                            fontWeight: '800',
                            color: '#1e293b',
                            margin: 0
                        }}>
                            Moltbot Assistant
                        </h3>
                        <p style={{
                            fontSize: '12px',
                            color: '#4ECDC4',
                            margin: 0
                        }}>
                            ● Online
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setChatOpen(false)}
                    style={{
                        ...clayButton,
                        padding: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <X size={20} style={{ color: '#64748b' }} />
                </button>
            </div>

            {/* Messages */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
            }}>
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            animation: `slideUp 0.3s ease-out`
                        }}
                    >
                        <div style={{
                            maxWidth: '80%',
                            padding: '14px 18px',
                            borderRadius: '20px',
                            ...(msg.role === 'user' ? {
                                background: 'linear-gradient(135deg, #4ECDC4, #44A08D)',
                                color: '#fff',
                                boxShadow: '6px 6px 12px rgba(78, 205, 196, 0.3)'
                            } : {
                                ...clayCard,
                                color: '#1e293b'
                            }),
                            fontSize: '15px',
                            lineHeight: '1.5',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {msg.content}
                        </div>

                        {msg.quickReplies && (
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px',
                                marginTop: '12px',
                                maxWidth: '80%'
                            }}>
                                {msg.quickReplies.map((reply, rIdx) => (
                                    <button
                                        key={rIdx}
                                        onClick={() => handleQuickReply(reply)}
                                        style={{
                                            ...clayButton,
                                            padding: '10px 16px',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            color: '#4ECDC4',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {reply}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div style={{
                padding: '16px 24px',
                borderTop: '1px solid rgba(148, 163, 184, 0.2)',
                background: 'rgba(255, 255, 255, 0.9)'
            }}>
                <div style={{
                    ...clayCard,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Type your message..."
                        style={{
                            flex: 1,
                            border: 'none',
                            background: 'transparent',
                            fontSize: '15px',
                            color: '#1e293b',
                            outline: 'none'
                        }}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim()}
                        style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            border: 'none',
                            background: inputValue.trim()
                                ? 'linear-gradient(135deg, #4ECDC4, #44A08D)'
                                : 'rgba(148, 163, 184, 0.2)',
                            cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <Send size={18} style={{ color: inputValue.trim() ? '#fff' : '#94a3b8' }} />
                    </button>
                </div>
            </div>
        </div>
    );
};
