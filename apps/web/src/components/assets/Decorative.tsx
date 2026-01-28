import React from 'react';

export const Sparkles = ({ count = 5, spread = 100 }: { count?: number, spread?: number }) => (
    <svg width={spread} height={spread} viewBox={`0 0 ${spread} ${spread}`} fill="none">
        {Array.from({ length: count }).map((_, i) => {
            const x = Math.random() * spread;
            const y = Math.random() * spread;
            const size = 4 + Math.random() * 8;
            return (
                <g key={i} opacity={0.6 + Math.random() * 0.4}>
                    <line x1={x} y1={y - size} x2={x} y2={y + size} stroke="#FFD93D" strokeWidth="2" strokeLinecap="round" />
                    <line x1={x - size} y1={y} x2={x + size} y2={y} stroke="#FFD93D" strokeWidth="2" strokeLinecap="round" />
                </g>
            );
        })}
    </svg>
);

export const Confetti = ({ count = 20 }: { count?: number }) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#C7CEEA'];
    return (
        <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
            {Array.from({ length: count }).map((_, i) => {
                const x = Math.random() * 200;
                const y = Math.random() * 200;
                const size = 4 + Math.random() * 8;
                const rotation = Math.random() * 360;
                const color = colors[Math.floor(Math.random() * colors.length)];
                return (
                    <rect
                        key={i}
                        x={x}
                        y={y}
                        width={size}
                        height={size}
                        rx={size / 4}
                        fill={color}
                        opacity={0.7}
                        transform={`rotate(${rotation} ${x + size / 2} ${y + size / 2})`}
                    />
                );
            })}
        </svg>
    );
};

export const GradientMesh = () => (
    <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, zIndex: -1 }}>
        <defs>
            <radialGradient id="mesh1" cx="20%" cy="20%">
                <stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="mesh2" cx="80%" cy="30%">
                <stop offset="0%" stopColor="#4ECDC4" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#4ECDC4" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="mesh3" cx="50%" cy="80%">
                <stop offset="0%" stopColor="#FFE66D" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#FFE66D" stopOpacity="0" />
            </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#mesh1)" />
        <rect width="100%" height="100%" fill="url(#mesh2)" />
        <rect width="100%" height="100%" fill="url(#mesh3)" />
    </svg>
);
