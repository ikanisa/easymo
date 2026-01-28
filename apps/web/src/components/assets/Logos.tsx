import React from 'react';

export const MoltbotLogo = ({ size = 32 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF6B6B" />
                <stop offset="50%" stopColor="#4ECDC4" />
                <stop offset="100%" stopColor="#44A08D" />
            </linearGradient>
        </defs>
        {/* Robot head with chat bubble */}
        <circle cx="50" cy="40" r="25" fill="url(#logoGradient)" opacity="0.9" />
        <circle cx="42" cy="35" r="4" fill="white" />
        <circle cx="58" cy="35" r="4" fill="white" />
        <path d="M 35 50 Q 50 58 65 50" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* Antenna */}
        <line x1="50" y1="15" x2="50" y2="22" stroke="url(#logoGradient)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="50" cy="12" r="3" fill="url(#logoGradient)" />
        {/* Chat bubble */}
        <path d="M 30 70 L 70 70 L 70 85 L 55 85 L 50 92 L 45 85 L 30 85 Z" fill="url(#logoGradient)" opacity="0.8" />
        <line x1="38" y1="77" x2="62" y2="77" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

export const MoltbotIcon = ({ size = 24 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <defs>
            <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ECDC4" />
                <stop offset="100%" stopColor="#44A08D" />
            </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="18" fill="url(#iconGradient)" />
        <circle cx="18" cy="20" r="3" fill="white" />
        <circle cx="30" cy="20" r="3" fill="white" />
        <path d="M 16 28 Q 24 32 32 28" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <line x1="24" y1="6" x2="24" y2="10" stroke="url(#iconGradient)" strokeWidth="2" />
        <circle cx="24" cy="4" r="2" fill="url(#iconGradient)" />
    </svg>
);

export const MoltbotWordmark = ({ height = 40 }: { height?: number }) => (
    <svg height={height} viewBox="0 0 200 50" fill="none">
        <defs>
            <linearGradient id="wordmarkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FF6B6B" />
                <stop offset="50%" stopColor="#4ECDC4" />
                <stop offset="100%" stopColor="#44A08D" />
            </linearGradient>
        </defs>
        <text
            x="10"
            y="35"
            fontFamily="'Plus Jakarta Sans', sans-serif"
            fontSize="32"
            fontWeight="900"
            fill="url(#wordmarkGradient)"
            letterSpacing="-1"
        >
            Moltbot
        </text>
    </svg>
);
