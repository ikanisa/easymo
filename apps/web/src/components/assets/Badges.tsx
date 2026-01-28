import React from 'react';

export const VerifiedBadge = ({ size = 20 }: { size?: number }) => (
    <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        borderRadius: '12px',
        background: 'rgba(78, 205, 196, 0.15)',
        fontSize: size * 0.6,
        fontWeight: '700',
        color: '#4ECDC4'
    }}>
        <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#4ECDC4" />
            <path d="M 8 12 L 11 15 L 16 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Verified
    </div>
);

export const HotBadge = ({ size = 20 }: { size?: number }) => (
    <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        borderRadius: '12px',
        background: 'rgba(255, 107, 107, 0.15)',
        fontSize: size * 0.6,
        fontWeight: '700',
        color: '#FF6B6B'
    }}>
        <span style={{ fontSize: size * 0.8 }}>🔥</span>
        Hot
    </div>
);

export const NewBadge = ({ size = 20 }: { size?: number }) => (
    <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        borderRadius: '12px',
        background: 'rgba(255, 230, 109, 0.15)',
        fontSize: size * 0.6,
        fontWeight: '700',
        color: '#F59E0B',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    }}>
        New
    </div>
);
