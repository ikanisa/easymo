import React, { useState } from 'react';
import { CheckCircle, ChevronRight, Upload, DollarSign, MapPin } from 'lucide-react';

interface ListingData {
    category: string;
    title: string;
    description: string;
    price: string;
    location: string;
    images: string[];
}

interface ListingCreationWizardProps {
    onComplete: (data: ListingData) => void;
}

const ListingCreationWizard: React.FC<ListingCreationWizardProps> = ({ onComplete }) => {
    const [step, setStep] = useState(0);
    const [listingData, setListingData] = useState<ListingData>({
        category: '',
        title: '',
        description: '',
        price: '',
        location: '',
        images: []
    });

    const categories = [
        { id: 'electronics', name: 'Electronics', icon: '📱', color: '#4ECDC4' },
        { id: 'fashion', name: 'Fashion', icon: '👕', color: '#FFE66D' },
        { id: 'food', name: 'Food', icon: '🍔', color: '#FF8B94' },
        { id: 'services', name: 'Services', icon: '🔧', color: '#A8E6CF' },
        { id: 'home', name: 'Home', icon: '🏠', color: '#C7CEEA' }
    ];

    const wizardSteps = [
        {
            title: 'Choose Category',
            subtitle: 'What are you selling?',
            component: (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '16px'
                }}>
                    {categories.map((cat, idx) => (
                        <button
                            key={cat.id}
                            onClick={() => setListingData({ ...listingData, category: cat.id })}
                            className="clay-card"
                            style={{
                                padding: '24px',
                                cursor: 'pointer',
                                border: listingData.category === cat.id ? `2px solid ${cat.color}` : '1px solid rgba(255, 255, 255, 0.5)',
                                animation: `slideUp 0.5s ease-out ${idx * 0.1}s both`,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <div style={{ fontSize: '48px', marginBottom: '12px' }}>
                                {cat.icon}
                            </div>
                            <div style={{
                                fontSize: '16px',
                                fontWeight: '700',
                                color: listingData.category === cat.id ? cat.color : 'var(--neutral-600)'
                            }}>
                                {cat.name}
                            </div>
                        </button>
                    ))}
                </div>
            )
        },
        {
            title: 'Basic Details',
            subtitle: 'Tell us about your item',
            component: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '700',
                            color: 'var(--neutral-600)',
                            marginBottom: '8px'
                        }}>
                            Title *
                        </label>
                        <input
                            type="text"
                            value={listingData.title}
                            onChange={(e) => setListingData({ ...listingData, title: e.target.value })}
                            placeholder="e.g. iPhone 13 Pro Max"
                            className="clay-input"
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: '700',
                            color: 'var(--neutral-600)',
                            marginBottom: '8px'
                        }}>
                            Description
                        </label>
                        <textarea
                            value={listingData.description}
                            onChange={(e) => setListingData({ ...listingData, description: e.target.value })}
                            placeholder="Describe your item..."
                            rows={4}
                            className="clay-input"
                            style={{
                                width: '100%',
                                resize: 'vertical',
                                fontFamily: "'Plus Jakarta Sans', sans-serif"
                            }}
                        />
                    </div>
                </div>
            )
        },
        {
            title: 'Price & Location',
            subtitle: 'Set your price and location',
            component: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            color: 'var(--neutral-600)',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <DollarSign size={16} />
                            Price (RWF) *
                        </label>
                        <input
                            type="number"
                            value={listingData.price}
                            onChange={(e) => setListingData({ ...listingData, price: e.target.value })}
                            placeholder="50000"
                            className="clay-input"
                            style={{
                                width: '100%',
                                fontSize: '20px',
                                fontWeight: '800',
                                color: 'var(--primary-coral)'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            color: 'var(--neutral-600)',
                            marginBottom: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <MapPin size={16} />
                            Location *
                        </label>
                        <input
                            type="text"
                            value={listingData.location}
                            onChange={(e) => setListingData({ ...listingData, location: e.target.value })}
                            placeholder="e.g. Kigali, Nyarugenge"
                            className="clay-input"
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            )
        },
        {
            title: 'Add Photos',
            subtitle: 'Upload images of your item (optional)',
            component: (
                <div>
                    <div
                        className="clay-card"
                        style={{
                            padding: '48px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            border: '2px dashed rgba(78, 205, 196, 0.3)'
                        }}>
                        <Upload size={48} style={{ color: 'var(--primary-teal)', marginBottom: '16px' }} />
                        <p style={{
                            fontSize: '16px',
                            fontWeight: '700',
                            color: 'var(--neutral-600)',
                            marginBottom: '8px'
                        }}>
                            Click to upload photos
                        </p>
                        <p style={{
                            fontSize: '14px',
                            color: 'var(--neutral-400)'
                        }}>
                            or drag and drop
                        </p>
                    </div>

                    {listingData.images.length > 0 && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '12px',
                            marginTop: '20px'
                        }}>
                            {listingData.images.map((img, idx) => (
                                <div
                                    key={idx}
                                    className="clay-card"
                                    style={{
                                        aspectRatio: '1',
                                        backgroundImage: `url(${img})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center'
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Review & Post',
            subtitle: 'Check your listing before posting',
            component: (
                <div
                    className="clay-card"
                    style={{
                        padding: '24px',
                        background: 'rgba(148, 163, 184, 0.05)'
                    }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '20px'
                    }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '16px',
                            background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.15), rgba(255, 107, 107, 0.15))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '40px'
                        }}>
                            {categories.find(c => c.id === listingData.category)?.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{
                                fontSize: '20px',
                                fontWeight: '800',
                                color: 'var(--neutral-800)',
                                marginBottom: '4px'
                            }}>
                                {listingData.title || 'Your Title'}
                            </h3>
                            <p style={{
                                fontSize: '24px',
                                fontWeight: '900',
                                color: 'var(--primary-coral)',
                                margin: 0
                            }}>
                                {listingData.price ? `${parseInt(listingData.price).toLocaleString()} RWF` : 'Price not set'}
                            </p>
                        </div>
                    </div>

                    <div style={{
                        padding: '16px',
                        borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.5)',
                        marginBottom: '16px'
                    }}>
                        <p style={{
                            fontSize: '14px',
                            color: 'var(--neutral-500)',
                            lineHeight: '1.6',
                            margin: 0
                        }}>
                            {listingData.description || 'No description provided'}
                        </p>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        color: 'var(--neutral-500)'
                    }}>
                        <MapPin size={14} />
                        {listingData.location || 'Location not set'}
                    </div>
                </div>
            )
        }
    ];

    const canProceed = () => {
        switch (step) {
            case 0: return listingData.category !== '';
            case 1: return listingData.title !== '';
            case 2: return listingData.price !== '' && listingData.location !== '';
            case 3: return true;
            case 4: return true;
            default: return false;
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--gradient-soft)',
            padding: '20px',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
            <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                paddingTop: '40px'
            }}>
                {/* Progress Bar */}
                <div className="clay-card" style={{
                    padding: '16px',
                    marginBottom: '24px'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '12px'
                    }}>
                        <span style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            color: 'var(--primary-teal)'
                        }}>
                            Step {step + 1} of {wizardSteps.length}
                        </span>
                        <span style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            color: 'var(--neutral-500)'
                        }}>
                            {Math.round(((step + 1) / wizardSteps.length) * 100)}%
                        </span>
                    </div>
                    <div style={{
                        height: '8px',
                        borderRadius: '4px',
                        background: 'rgba(148, 163, 184, 0.2)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${((step + 1) / wizardSteps.length) * 100}%`,
                            background: 'var(--gradient-primary)',
                            transition: 'width 0.5s ease',
                            borderRadius: '4px'
                        }} />
                    </div>
                </div>

                {/* Step Content */}
                <div className="clay-card" style={{
                    padding: '32px',
                    marginBottom: '24px',
                    animation: 'slideUp 0.5s ease-out'
                }}>
                    <h2 style={{
                        fontSize: '26px',
                        fontWeight: '900',
                        color: 'var(--neutral-800)',
                        marginBottom: '8px',
                        letterSpacing: '-0.5px'
                    }}>
                        {wizardSteps[step].title}
                    </h2>
                    <p style={{
                        fontSize: '15px',
                        color: 'var(--neutral-500)',
                        marginBottom: '32px'
                    }}>
                        {wizardSteps[step].subtitle}
                    </p>

                    {wizardSteps[step].component}
                </div>

                {/* Navigation */}
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
                            if (step < wizardSteps.length - 1) {
                                setStep(step + 1);
                            } else {
                                onComplete(listingData);
                            }
                        }}
                        disabled={!canProceed()}
                        className="clay-button"
                        style={{
                            flex: 2,
                            padding: '16px',
                            fontSize: '15px',
                            fontWeight: '700',
                            color: '#fff',
                            background: canProceed()
                                ? 'var(--gradient-primary)'
                                : 'rgba(148, 163, 184, 0.3)',
                            cursor: canProceed() ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: canProceed() ? '0 8px 24px rgba(78, 205, 196, 0.3)' : 'none'
                        }}
                    >
                        {step < wizardSteps.length - 1 ? 'Continue' : 'Post Listing'}
                        {step === wizardSteps.length - 1 && <CheckCircle size={18} />}
                        {step < wizardSteps.length - 1 && <ChevronRight size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ListingCreationWizard;
