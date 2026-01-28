import React, { useEffect } from 'react';
import { CheckCircle, Share2, Home, Search, Shield } from 'lucide-react';
import confetti from 'canvas-confetti';

interface SuccessScreenProps {
    type: 'listing' | 'request' | 'verification';
    onClose: () => void;
}

const SuccessScreen: React.FC<SuccessScreenProps> = ({ type, onClose }) => {
    useEffect(() => {
        // Trigger confetti
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#4ECDC4', '#FF6B6B', '#FFE66D']
        });
    }, []);

    const content = {
        listing: {
            title: 'Listing Posted! 🎉',
            message: 'Your item is now live on the marketplace. AI will start matching you with buyers.',
            primaryAction: 'View Listing',
            secondaryAction: 'Share'
        },
        request: {
            title: 'Request Sent! 🚀',
            message: 'Moltbot is searching for the best deals. You\'ll get a notification when we find matches.',
            primaryAction: 'View Status',
            secondaryAction: 'New Request'
        },
        verification: {
            title: 'Verified! ✅',
            message: 'Your account is now verified. You can post unlimited listings and access premium features.',
            primaryAction: 'Go Home',
            secondaryAction: 'View Profile'
        }
    };

    const details = content[type];

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
            <div className="clay-card" style={{
                maxWidth: '400px',
                width: '100%',
                padding: '40px',
                textAlign: 'center',
                animation: 'bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
            }}>
                <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.2), rgba(68, 160, 141, 0.2))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px auto',
                    animation: 'pulse 2s infinite'
                }}>
                    <CheckCircle
                        size={48}
                        style={{
                            color: 'var(--primary-teal)',
                            animation: 'scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.3s both'
                        }}
                    />
                </div>

                <h2 style={{
                    fontSize: '28px',
                    fontWeight: '900',
                    color: 'var(--neutral-800)',
                    marginBottom: '12px',
                    letterSpacing: '-0.5px'
                }}>
                    {details.title}
                </h2>

                <p style={{
                    fontSize: '16px',
                    color: 'var(--neutral-500)',
                    lineHeight: '1.6',
                    marginBottom: '32px'
                }}>
                    {details.message}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        className="clay-button"
                        style={{
                            width: '100%',
                            padding: '16px',
                            fontSize: '16px',
                            fontWeight: '700',
                            color: '#fff',
                            background: 'var(--gradient-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 8px 24px rgba(78, 205, 196, 0.3)'
                        }}
                    >
                        <Home size={20} />
                        {details.primaryAction}
                    </button>

                    <button
                        className="clay-button"
                        style={{
                            width: '100%',
                            padding: '16px',
                            fontSize: '16px',
                            fontWeight: '700',
                            color: 'var(--neutral-600)',
                            background: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <Share2 size={20} />
                        {details.secondaryAction}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SuccessScreen;
