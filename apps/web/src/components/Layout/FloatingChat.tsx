import React from 'react';
import { MessageCircle } from 'lucide-react';

interface FloatingChatProps {
    onClick: () => void;
    isOpen: boolean;
}

export const FloatingChat: React.FC<FloatingChatProps> = ({ onClick, isOpen }) => {
    if (isOpen) return null;

    return (
        <button
            onClick={onClick}
            style={{
                position: 'fixed',
                bottom: '100px', // Above bottom nav
                right: '20px',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'var(--gradient-primary)',
                border: 'none',
                boxShadow: '0 8px 32px rgba(78, 205, 196, 0.4), inset 2px 2px 4px rgba(255,255,255,0.3)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 900,
                animation: 'float 6s ease-in-out infinite',
                transition: 'transform 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
            <MessageCircle size={28} />
        </button>
    );
};
