import React from 'react';

export const RequestsView: React.FC = () => {
    return (
        <div style={{ padding: '20px', paddingBottom: '100px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>Requests</h2>
            <div className="clay-card" style={{ padding: '40px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛍️</div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No active requests</h3>
                <p style={{ color: 'var(--neutral-500)', marginBottom: '24px' }}>
                    Looking for something specific? Ask Moltbot to find it for you.
                </p>
                <button className="clay-button" style={{ color: 'var(--primary-teal)' }}>
                    Create Request
                </button>
            </div>
        </div>
    );
};
