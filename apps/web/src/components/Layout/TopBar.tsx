import React from 'react';
import { ChevronLeft, Bell, User } from 'lucide-react';

interface TopBarProps {
    showBack?: boolean;
    onBack?: () => void;
    title?: string;
    onProfileClick?: () => void;
    onNotificationsClick?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
    showBack = false,
    onBack,
    title = "Moltbot",
    onProfileClick,
    onNotificationsClick
}) => {
    return (
        <div style={{
            position: 'sticky',
            top: 0,
            height: '64px',
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            zIndex: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.5)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {showBack && (
                    <button
                        onClick={onBack}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '12px',
                            border: 'none',
                            background: 'rgba(255,255,255,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'var(--neutral-600)'
                        }}
                    >
                        <ChevronLeft size={20} />
                    </button>
                )}
                <h1 style={{
                    fontSize: '20px',
                    fontWeight: 900,
                    background: 'var(--gradient-primary)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '-0.5px'
                }}>
                    {title}
                </h1>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
                <button
                    onClick={onNotificationsClick}
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'linear-gradient(145deg, #ffffff, #f0f0f0)',
                        boxShadow: '4px 4px 8px rgba(163, 177, 198, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--neutral-600)'
                    }}
                >
                    <Bell size={20} />
                </button>

                <button
                    onClick={onProfileClick}
                    style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'linear-gradient(145deg, #ffffff, #f0f0f0)',
                        boxShadow: '4px 4px 8px rgba(163, 177, 198, 0.3), -4px -4px 8px rgba(255, 255, 255, 0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--neutral-600)'
                    }}
                >
                    <User size={20} />
                </button>
            </div>
        </div>
    );
};
