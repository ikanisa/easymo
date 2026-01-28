import React, { useState } from 'react';
import { Sparkles, Shield, Users, ChevronRight } from 'lucide-react';

interface OnboardingWizardProps {
    onComplete: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
    const [step, setStep] = useState(0);

    const steps = [
        {
            title: 'Welcome to Moltbot! 👋',
            description: 'Your AI-powered marketplace for Rwanda',
            icon: <Sparkles size={64} style={{ color: 'var(--primary-teal)' }} />,
            features: [
                { icon: '🤖', text: 'Chat with AI to buy or sell' },
                { icon: '✅', text: 'Connect with verified vendors' },
                { icon: '🎯', text: 'Smart matching & suggestions' }
            ]
        },
        {
            title: 'Anonymous & Secure 🔒',
            description: 'No registration needed - start trading instantly',
            icon: <Shield size={64} style={{ color: 'var(--primary-teal)' }} />,
            features: [
                { icon: '🚫', text: 'No email or phone required' },
                { icon: '🔐', text: 'Your data stays private' },
                { icon: '⚡', text: 'Quick and easy to use' }
            ]
        },
        {
            title: 'How It Works 💬',
            description: 'Everything happens through chat',
            icon: <Users size={64} style={{ color: 'var(--primary-teal)' }} />,
            features: [
                { icon: '1️⃣', text: 'Tell Moltbot what you need' },
                { icon: '2️⃣', text: 'Get matched with sellers' },
                { icon: '3️⃣', text: 'Connect and complete trade' }
            ]
        }
    ];

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--gradient-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
            <div className="clay-card" style={{
                maxWidth: '480px',
                width: '100%',
                padding: '40px',
                textAlign: 'center',
                animation: 'slideUp 0.5s ease-out'
            }}>
                {/* Progress Indicator */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    justifyContent: 'center',
                    marginBottom: '32px'
                }}>
                    {steps.map((_, idx) => (
                        <div
                            key={idx}
                            style={{
                                width: idx === step ? '32px' : '8px',
                                height: '8px',
                                borderRadius: '4px',
                                background: idx <= step
                                    ? 'var(--gradient-primary)'
                                    : 'rgba(148, 163, 184, 0.3)',
                                transition: 'all 0.3s ease'
                            }}
                        />
                    ))}
                </div>

                {/* Icon */}
                <div style={{
                    marginBottom: '24px',
                    animation: 'float 3s ease-in-out infinite'
                }}>
                    {steps[step].icon}
                </div>

                {/* Title */}
                <h1 style={{
                    fontSize: '28px',
                    fontWeight: '900',
                    color: 'var(--neutral-800)',
                    marginBottom: '12px',
                    letterSpacing: '-0.5px'
                }}>
                    {steps[step].title}
                </h1>

                {/* Description */}
                <p style={{
                    fontSize: '16px',
                    color: 'var(--neutral-500)',
                    lineHeight: '1.6',
                    marginBottom: '32px'
                }}>
                    {steps[step].description}
                </p>

                {/* Features */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    marginBottom: '32px',
                    textAlign: 'left'
                }}>
                    {steps[step].features.map((feature, idx) => (
                        <div
                            key={idx}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '16px',
                                borderRadius: '16px',
                                background: 'rgba(148, 163, 184, 0.05)',
                                animation: `slideUp 0.5s ease-out ${idx * 0.1}s both`
                            }}
                        >
                            <span style={{ fontSize: '24px' }}>{feature.icon}</span>
                            <span style={{
                                fontSize: '15px',
                                fontWeight: '600',
                                color: 'var(--neutral-600)'
                            }}>
                                {feature.text}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Navigation Buttons */}
                <div style={{ display: 'flex', gap: '12px' }}>
                    {step > 0 && (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="clay-button"
                            style={{
                                flex: 1,
                                padding: '16px',
                                fontSize: '15px',
                                background: 'var(--neutral-100)',
                                color: 'var(--neutral-600)'
                            }}
                        >
                            Back
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (step < steps.length - 1) {
                                setStep(step + 1);
                            } else {
                                onComplete();
                            }
                        }}
                        className="clay-button"
                        style={{
                            flex: 2,
                            padding: '16px',
                            fontSize: '15px',
                            color: '#fff',
                            background: 'var(--gradient-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: '0 8px 24px rgba(78, 205, 196, 0.3)'
                        }}
                    >
                        {step < steps.length - 1 ? 'Continue' : 'Get Started'}
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingWizard;
