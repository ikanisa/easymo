import React from 'react';
import { Star, MapPin, CheckCircle, Package, Clock } from 'lucide-react';
import { Vendor } from '../../types';

interface VendorCardProps {
    vendor: Vendor;
    onPress: (id: string) => void;
}

export const VendorCard: React.FC<VendorCardProps> = ({ vendor, onPress }) => {
    return (
        <div
            className="clay-card"
            onClick={() => onPress(vendor.id)}
            style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'row',
                gap: '20px',
                cursor: 'pointer',
                alignItems: 'flex-start',
                width: '100%'
            }}
        >
            {/* Avatar */}
            <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                background: 'var(--gradient-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
                flexShrink: 0,
                boxShadow: 'inset 2px 2px 4px rgba(255,255,255,0.5), inset -2px -2px 4px rgba(0,0,0,0.05)'
            }}>
                {vendor.avatar.startsWith('http') ? (
                    <img src={vendor.avatar} alt={vendor.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '20px' }} />
                ) : (
                    <span>{vendor.avatar}</span>
                )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--neutral-800)' }}>
                        {vendor.name}
                    </h3>
                    {vendor.verified && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(78, 205, 196, 0.1)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--primary-teal)'
                        }}>
                            <CheckCircle size={12} />
                            VERIFIED
                        </div>
                    )}
                </div>

                <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--neutral-500)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span>{vendor.category}</span>
                    <span style={{ color: 'var(--neutral-300)' }}>•</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--primary-yellow)' }}>
                        <Star size={14} fill="var(--primary-yellow)" />
                        <span style={{ color: 'var(--neutral-800)', fontWeight: 700 }}>{vendor.rating}</span>
                        <span style={{ color: 'var(--neutral-400)', fontWeight: 400 }}>({vendor.reviewCount})</span>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    marginTop: '8px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--neutral-600)' }}>
                        <Package size={14} color="var(--primary-coral)" />
                        <span>{vendor.productsCount} products</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--neutral-600)' }}>
                        <Clock size={14} color="var(--primary-teal)" />
                        <span>{vendor.responseTime}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--neutral-600)' }}>
                        <MapPin size={14} color="var(--neutral-500)" />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vendor.location}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
