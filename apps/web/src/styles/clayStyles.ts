import { CSSProperties } from 'react';

export const clayCard: CSSProperties = {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(10px)',
    borderRadius: '24px',
    boxShadow: `
    8px 8px 16px rgba(163, 177, 198, 0.6),
    -8px -8px 16px rgba(255, 255, 255, 0.9),
    inset 2px 2px 4px rgba(255, 255, 255, 0.3)
  `,
    border: '1px solid rgba(255, 255, 255, 0.5)'
};

export const clayCardPressed: CSSProperties = {
    background: 'rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(10px)',
    borderRadius: '24px',
    boxShadow: `
    inset 4px 4px 8px rgba(163, 177, 198, 0.4),
    inset -4px -4px 8px rgba(255, 255, 255, 0.7)
  `,
    border: '1px solid rgba(255, 255, 255, 0.3)'
};

export const clayButton: CSSProperties = {
    background: 'linear-gradient(145deg, #ffffff, #f0f0f0)',
    borderRadius: '16px',
    boxShadow: `
    6px 6px 12px rgba(163, 177, 198, 0.5),
    -6px -6px 12px rgba(255, 255, 255, 0.9)
  `,
    border: 'none',
    transition: 'all 0.3s ease'
};
