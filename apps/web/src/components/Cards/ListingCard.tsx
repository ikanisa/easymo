import React from 'react';
import { Heart, MapPin, CheckCircle } from 'lucide-react';
import { Listing } from '../../types';

interface ListingCardProps {
    listing: Listing;
    onPress: (id: string) => void;
    onFavorite: (id: string) => void;
    isFavorite?: boolean;
}

export const ListingCard: React.FC<ListingCardProps> = ({
    listing,
    onPress,
    onFavorite,
    isFavorite = false
}) => {
    return (
        <div
            className="clay-card"
            onClick={() => onPress(listing.id)}
            style={{
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                cursor: 'pointer',
                position: 'relative',
                minWidth: '160px',
                height: '100%'
            }}
        >
            {/* Image Area */}
            <div style={{
                aspectRatio: '1/1',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #f0f4f8, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {listing.image.startsWith('http') ? (
                    <img src={listing.image} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <span>{listing.image}</span>
                )}

                {/* Favorite Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onFavorite(listing.id);
                    }}
                    style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        border: 'none',
                        background: 'rgba(255, 255, 255, 0.8)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Heart
                        size={18}
                        color={isFavorite ? 'var(--primary-coral)' : 'var(--neutral-400)'}
                        fill={isFavorite ? 'var(--primary-coral)' : 'none'}
                    />
                </button>
            </div>

            {/* Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <h3 style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--neutral-800)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1
                    }}>
                        {listing.title}
                    </h3>
                    {listing.verified && (
                        <CheckCircle size={14} color="var(--primary-teal)" fill="var(--primary-teal)" stroke="white" />
                    )}
                </div>

                <div style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    color: 'var(--primary-coral)'
                }}>
                    {listing.currency} {listing.price.toLocaleString()}
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--neutral-500)',
                    fontSize: '11px',
                    marginTop: '4px'
                }}>
                    <MapPin size={12} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {listing.location}
                    </span>
                </div>
            </div>
        </div>
    );
};
