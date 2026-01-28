import React from 'react';

interface CategoryPillProps {
    label: string;
    icon: string; // Emoji
    isActive?: boolean;
    onClick?: () => void;
    color?: string; // e.g. 'var(--primary-teal)'
}

export const CategoryPill: React.FC<CategoryPillProps> = ({
    label,
    icon,
    isActive = false,
    onClick,
    color = 'var(--primary-teal)'
}) => {
    return (
        <button
            onClick={onClick}
            className={isActive ? 'clay-card-pressed' : 'clay-button'}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                height: '44px',
                borderRadius: '16px',
                fontSize: '13px',
                fontWeight: 600,
                color: isActive ? color : 'var(--neutral-600)',
                border: isActive ? `1px solid ${color}` : undefined,
                background: isActive ? 'rgba(255, 255, 255, 0.5)' : undefined,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                transform: isActive ? 'scale(0.98)' : 'scale(1)',
                flexShrink: 0
            }}
        >
            <span style={{ fontSize: '20px' }}>{icon}</span>
            <span>{label}</span>
            {isActive && (
                <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: color,
                    marginLeft: '4px'
                }} />
            )}
        </button>
    );
};
