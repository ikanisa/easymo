import React from 'react';
import { ChevronLeft, MapPin, Clock, Heart, Share2, MessageCircle, CheckCircle, Shield } from 'lucide-react';
import { Listing } from '../../types';

interface ListingDetailProps {
    listing: Listing;
    onBack: () => void;
    onContact: () => void;
    onFavorite: () => void;
    isFavorite?: boolean;
}

export const ListingDetail: React.FC<ListingDetailProps> = ({
    listing,
    onBack,
    onContact,
    onFavorite,
    isFavorite = false
}) => {
    return (
        <div style={{
            paddingBottom: '120px',
            animation: 'slideUp 0.3s ease-out both'
        }}>
            {/* Image Area */}
            <div style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1/1',
                background: 'linear-gradient(135deg, #f0f4f8, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '120px',
                overflow: 'hidden',
                borderBottomLeftRadius: '32px',
                borderBottomRightRadius: '32px',
                boxShadow: '0 10px 30px rgba(163, 177, 198, 0.3)'
            }}>
                <button
                    onClick={onBack}
                    style={{
                        position: 'absolute',
                        top: '20px',
                        left: '20px',
                        width: '40px',
                        height: '40px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.6)',
                        backdropFilter: 'blur(10px)',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 10
                    }}
                >
                    <ChevronLeft size={24} color="#1e293b" />
                </button>

                {listing.image.startsWith('http') ? (
                    <img src={listing.image} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <span>{listing.image}</span>
                )}
            </div>

            <div style={{ padding: '24px' }}>
                {/* Header */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        {listing.verified && (
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(78, 205, 196, 0.1)',
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: 700,
                                color: 'var(--primary-teal)',
                                marginBottom: '8px'
                            }}>
                                <CheckCircle size={14} />
                                VERIFIED SELLER
                            </div>
                        )}
                        <div style={{ fontSize: '14px', color: 'var(--neutral-500)', fontWeight: 600 }}>
                            Posted 2h ago
                        </div>
                    </div>

                    <h1 style={{
                        fontSize: '28px',
                        fontWeight: 800,
                        color: 'var(--neutral-800)',
                        marginBottom: '8px',
                        lineHeight: 1.2
                    }}>
                        {listing.title}
                    </h1>

                    <div style={{
                        fontSize: '24px',
                        fontWeight: 800,
                        color: 'var(--primary-coral)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        {listing.currency} {listing.price.toLocaleString()}
                    </div>
                </div>

                {/* Info Grid */}
                <div className="clay-card" style={{ padding: '20px', marginBottom: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--neutral-500)', marginBottom: '4px' }}>Category</div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--neutral-800)' }}>{listing.category}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '12px', color: 'var(--neutral-500)', marginBottom: '4px' }}>Condition</div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--neutral-800)' }}>Like New</div>
                        </div>
                        <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <MapPin size={18} color="var(--neutral-500)" />
                            <span style={{ fontSize: '15px', color: 'var(--neutral-800)', fontWeight: 600 }}>{listing.location}</span>
                        </div>
                    </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px' }}>Description</h3>
                    <p style={{ fontSize: '15px', lineHeight: 1.6, color: 'var(--neutral-600)' }}>
                        Excellent condition, barely used. Comes with all original accessories and box. Selling because I upgraded to a newer model. Price is slightly negotiable for serious buyers.
                    </p>
                </div>

                {/* Trust Badge */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.5)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.5)'
                }}>
                    <Shield size={24} color="var(--primary-teal)" />
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--neutral-800)' }}>Safe Transaction</div>
                        <div style={{ fontSize: '12px', color: 'var(--neutral-500)' }}>Meet in public places. Inspect item before paying.</div>
                    </div>
                </div>
            </div>

            {/* Floating Action Bar */}
            <div style={{
                position: 'fixed',
                bottom: '24px',
                left: '20px',
                right: '20px',
                display: 'flex',
                gap: '12px',
                zIndex: 900
            }}>
                <button
                    onClick={onFavorite}
                    className="clay-button"
                    style={{
                        width: '56px',
                        height: '56px',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '20px'
                    }}
                >
                    <Heart size={24} fill={isFavorite ? 'var(--primary-coral)' : 'none'} color={isFavorite ? 'var(--primary-coral)' : 'var(--neutral-600)'} />
                </button>

                <button
                    onClick={onContact}
                    className="clay-button"
                    style={{
                        flex: 1,
                        background: 'var(--gradient-primary)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '16px',
                        borderRadius: '20px'
                    }}
                >
                    <MessageCircle size={20} />
                    Chat with Seller
                </button>
            </div>
        </div>
    );
};
