import React from 'react';
import { ListingCard } from '../Cards/ListingCard';
import { useListings } from '../../hooks/useListings';
import { Listing } from '../../types';

interface ListingsViewProps {
    onListingClick: (id: string) => void;
}

export const ListingsView: React.FC<ListingsViewProps> = ({ onListingClick }) => {
    const { listings, loading } = useListings();

    const uiListings: Listing[] = listings.map(l => ({
        id: l.id,
        title: l.title,
        price: l.price ?? 0,
        currency: l.currency,
        image: l.media_urls[0] || '📦',
        category: l.category,
        location: l.location_text || 'Kigali',
        verified: l.is_verified_seller,
        postedAt: l.published_at || l.created_at
    }));

    return (
        <div style={{ padding: '20px', paddingBottom: '100px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>All Listings</h2>

            {/* Search Bar Placeholder */}
            <div style={{ marginBottom: '20px' }}>
                <input
                    type="text"
                    placeholder="Search products..."
                    className="clay-input"
                    style={{ width: '100%' }}
                />
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--neutral-500)' }}>
                    Loading listings...
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '16px'
                }}>
                    {uiListings.map(listing => (
                        <ListingCard
                            key={listing.id}
                            listing={listing}
                            onPress={onListingClick}
                            onFavorite={() => { }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
