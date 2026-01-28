import React from 'react';
import { CategoryPill } from '../Shared/CategoryPill';
import { ListingCard } from '../Cards/ListingCard';
import { VendorCard } from '../Cards/VendorCard';
import { useListings } from '../../hooks/useListings';
import { Listing, Vendor } from '../../types';

interface HomeViewProps {
    onListingClick: (id: string) => void;
    onVendorClick: (id: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onListingClick, onVendorClick }) => {
    const { listings, loading } = useListings();

    // Mock categories
    const categories = [
        { id: 'electronics', label: 'Electronics', icon: '📱' },
        { id: 'fashion', label: 'Fashion', icon: '👕' },
        { id: 'food', label: 'Food', icon: '🍔' },
        { id: 'services', label: 'Services', icon: '🔧' },
        { id: 'home', label: 'Home', icon: '🏠' },
    ];

    // Transform ProductListing to UI Listing type
    const uiListings: Listing[] = listings.slice(0, 4).map(l => ({
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

    // Mock vendors for now (real data would come from useVendors hook)
    const mockVendors: Vendor[] = [
        {
            id: 'v1',
            name: 'Kigali Electronics',
            avatar: '🔌',
            category: 'Electronics',
            rating: 4.8,
            reviewCount: 124,
            verified: true,
            location: 'Nyarugenge, Kigali',
            productsCount: 45,
            responseTime: '< 10m'
        },
        {
            id: 'v2',
            name: 'Fresh Foods Ltd',
            avatar: '🥬',
            category: 'Provisions',
            rating: 4.5,
            reviewCount: 32,
            verified: true,
            location: 'Kimironko Market',
            productsCount: 12,
            responseTime: '< 1h'
        }
    ];

    return (
        <div style={{ padding: '20px', paddingBottom: '100px' }}>

            {/* Categories */}
            <section style={{ marginBottom: '32px' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 800 }}>Categories</h2>
                    <button style={{ color: 'var(--primary-teal)', fontWeight: 600, border: 'none', background: 'none' }}>See all</button>
                </div>
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    overflowX: 'auto',
                    paddingBottom: '8px',
                    margin: '0 -20px',
                    padding: '0 20px 8px 20px',
                    scrollbarWidth: 'none'
                }}>
                    {categories.map(cat => (
                        <CategoryPill
                            key={cat.id}
                            label={cat.label}
                            icon={cat.icon}
                            onClick={() => { }}
                        />
                    ))}
                </div>
            </section>

            {/* Featured Vendors */}
            <section style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '16px' }}>Verified Vendors</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {mockVendors.map(vendor => (
                        <VendorCard key={vendor.id} vendor={vendor} onPress={onVendorClick} />
                    ))}
                </div>
            </section>

            {/* Recent Listings */}
            <section>
                <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '16px' }}>Recent Listings</h2>
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
            </section>
        </div>
    );
};
