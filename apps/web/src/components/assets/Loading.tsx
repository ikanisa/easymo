import React from 'react';

export const SkeletonCard = () => (
    <div style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
        borderRadius: '24px',
        padding: '16px',
        animation: 'pulse 2s infinite'
    }}>
        <div style={{
            width: '100%',
            aspectRatio: '1',
            borderRadius: '16px',
            background: 'linear-gradient(90deg, rgba(148, 163, 184, 0.1) 0%, rgba(148, 163, 184, 0.2) 50%, rgba(148, 163, 184, 0.1) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s infinite',
            marginBottom: '12px'
        }} />
        <div style={{
            height: '16px',
            borderRadius: '8px',
            background: 'linear-gradient(90deg, rgba(148, 163, 184, 0.1) 0%, rgba(148, 163, 184, 0.2) 50%, rgba(148, 163, 184, 0.1) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s infinite',
            marginBottom: '8px'
        }} />
        <div style={{
            height: '20px',
            width: '60%',
            borderRadius: '8px',
            background: 'linear-gradient(90deg, rgba(148, 163, 184, 0.1) 0%, rgba(148, 163, 184, 0.2) 50%, rgba(148, 163, 184, 0.1) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s infinite'
        }} />
    </div>
);

export const Spinner = ({ size = 32, color = '#4ECDC4' }: { size?: number, color?: string }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 50 50"
        style={{ animation: 'spin 1s linear infinite' }}
    >
        <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="31.415, 31.415"
            transform="rotate(-90 25 25)"
        />
    </svg>
);
