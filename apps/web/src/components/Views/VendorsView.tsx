import React from 'react';
import { VendorCard } from '../Cards/VendorCard';
import { Vendor } from '../../types';

interface VendorsViewProps {
    onVendorClick: (id: string) => void;
}

export const VendorsView: React.FC<VendorsViewProps> = ({ onVendorClick }) => {
    // Mock vendors for now
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
        },
        {
            id: 'v3',
            name: 'Home Decor Rwanda',
            avatar: '🏠',
            category: 'Home',
            rating: 4.9,
            reviewCount: 56,
            verified: true,
            location: 'Gishushu',
            productsCount: 88,
            responseTime: '< 2h'
        }
    ];

    return (
        <div style={{ padding: '20px', paddingBottom: '100px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '20px' }}>Top Vendors</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {mockVendors.map(vendor => (
                    <VendorCard key={vendor.id} vendor={vendor} onPress={onVendorClick} />
                ))}
            </div>
        </div>
    );
};
