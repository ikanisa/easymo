import React from 'react';
import { ChevronLeft, MapPin, Clock, Star, Package, CheckCircle, Share2, MessageCircle } from 'lucide-react';
import { Vendor, Listing } from '../../types';
import { ListingCard } from '../Cards/ListingCard';

interface VendorDetailProps {
    vendor: Vendor;
    vendorListings: Listing[]; // Listings belonging to this vendor
    onBack: () => void;
    onContact: () => void;
    onListingClick: (id: string) => void;
}

export const VendorDetail: React.FC<VendorDetailProps> = ({
    vendor,
    vendorListings,
    onBack,
    onContact,
    onListingClick
}) => {
    return (
        <div style={{
            paddingBottom: '100px',
            animation: 'slideInRight 0.3s ease-out both'
        }}>
            {/* Header / Cover */}
            <div style={{
                height: '140px',
                background: 'var(--gradient-category-electronics)', // Dynamic based on category ideally
                position: 'relative'
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
            </div>

            <div style={{ padding: '0 20px', marginTop: '-40px' }}>
                {/* Profile Card */}
                <div className="clay-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '24px',
                        background: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '40px',
                        marginBottom: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                        {vendor.avatar}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--neutral-800)' }}>{vendor.name}</h1>
                        {vendor.verified && <CheckCircle size={18} color="var(--primary-teal)" fill="white" />}
                    </div>

                    <div style={{ fontSize: '14px', color: 'var(--neutral-500)', fontWeight: 600, marginBottom: '16px' }}>
                        {vendor.category} • {vendor.location}
                    </div>

                    <div style={{ display: 'flex', gap: '24px', width: '100%', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '16px', fontWeight: 800, color: 'var(--neutral-800)' }}>
                                <Star size={16} fill="var(--primary-yellow)" color="var(--primary-yellow)" />
                                {vendor.rating}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--neutral-400)' }}>{vendor.reviewCount} Reviews</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '16px', fontWeight: 800, color: 'var(--neutral-800)' }}>
                                <Clock size={16} color="var(--primary-teal)" />
                                {vendor.responseTime}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--neutral-400)' }}>Response</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '16px', fontWeight: 800, color: 'var(--neutral-800)' }}>
                                <Package size={16} color="var(--primary-coral)" />
                                {vendor.productsCount}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--neutral-400)' }}>Products</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px', width: '100%' }}>
                        <button className="clay-button" style={{ flex: 1, padding: '10px', fontSize: '14px' }} onClick={onContact}>Message</button>
                        <button className="clay-button" style={{ padding: '10px 16px' }}><Share2 size={20} /></button>
                    </div>
                </div>

                {/* Listings Section */}
                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: 'var(--neutral-800)' }}>
                    Active Listings
                </h3>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: '16px'
                }}>
                    {vendorListings.map(listing => (
                        <ListingCard
                            key={listing.id}
                            listing={listing}
                            onPress={onListingClick}
                            onFavorite={() => { }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
