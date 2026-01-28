import React from 'react';

export const NoListingsIllustration = ({ size = 200 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
        <defs>
            <linearGradient id="emptyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4ECDC4" opacity="0.2" />
                <stop offset="100%" stopColor="#FF6B6B" opacity="0.2" />
            </linearGradient>
        </defs>
        {/* Empty box */}
        <rect x="50" y="60" width="100" height="80" rx="12" fill="url(#emptyGradient)" />
        <rect x="50" y="60" width="100" height="80" rx="12" stroke="#94A3B8" strokeWidth="2" strokeDasharray="8 4" fill="none" />
        {/* Sad face */}
        <circle cx="80" cy="100" r="4" fill="#94A3B8" />
        <circle cx="120" cy="100" r="4" fill="#94A3B8" />
        <path d="M 85 120 Q 100 110 115 120" stroke="#94A3B8" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* Search icon */}
        <circle cx="160" cy="50" r="15" stroke="#4ECDC4" strokeWidth="3" fill="none" />
        <line x1="171" y1="61" x2="180" y2="70" stroke="#4ECDC4" strokeWidth="3" strokeLinecap="round" />
    </svg>
);

export const NoMatchesIllustration = ({ size = 200 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
        <defs>
            <linearGradient id="matchGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFE66D" opacity="0.3" />
                <stop offset="100%" stopColor="#4ECDC4" opacity="0.3" />
            </linearGradient>
        </defs>
        {/* Puzzle pieces that don't fit */}
        <path d="M 60 80 L 60 100 L 80 100 L 80 80 L 70 80 Q 70 70 80 70 L 80 60 L 60 60 Z" fill="url(#matchGradient)" stroke="#94A3B8" strokeWidth="2" />
        <path d="M 120 80 L 120 100 L 140 100 L 140 80 L 130 80 Q 130 90 120 90 L 120 60 L 140 60 Z" fill="url(#matchGradient)" stroke="#94A3B8" strokeWidth="2" />
        {/* X between them */}
        <line x1="90" y1="75" x2="110" y2="95" stroke="#FF6B6B" strokeWidth="4" strokeLinecap="round" />
        <line x1="110" y1="75" x2="90" y2="95" stroke="#FF6B6B" strokeWidth="4" strokeLinecap="round" />
    </svg>
);

export const ConnectionErrorIllustration = ({ size = 200 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
        {/* Broken connection lines */}
        <line x1="50" y1="100" x2="85" y2="100" stroke="#94A3B8" strokeWidth="3" strokeDasharray="6 3" />
        <line x1="115" y1="100" x2="150" y2="100" stroke="#94A3B8" strokeWidth="3" strokeDasharray="6 3" />
        {/* Alert triangle */}
        <path d="M 100 85 L 110 105 L 90 105 Z" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="100" y1="92" x2="100" y2="98" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="100" cy="102" r="1.5" fill="#F59E0B" />
        {/* Disconnected nodes */}
        <circle cx="50" cy="100" r="8" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
        <circle cx="150" cy="100" r="8" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="2" />
    </svg>
);
