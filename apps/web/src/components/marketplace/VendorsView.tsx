import { CheckCircle, Star, Package, MapPin, Clock } from 'lucide-react';
import { clayCard, clayButton } from '../../styles/clayStyles';
import { verifiedVendors } from '../../data/mockMarketplace';
import { Vendor, Listing } from '../../types/marketplace';

interface VendorsViewProps {
    setSelectedListing: (listing: Listing | Vendor) => void;
    setCurrentView: (view: string) => void;
}

export const VendorsView = ({ setSelectedListing, setCurrentView }: VendorsViewProps) => {
    return (
        <div className="vendors-view">
            <h2 style={{
                fontSize: '24px',
                fontWeight: '800',
                color: '#1e293b',
                marginBottom: '20px',
                letterSpacing: '-0.5px'
            }}>
                Verified Vendors
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {verifiedVendors.map((vendor, idx) => (
                    <div
                        key={vendor.id}
                        onClick={() => {
                            setSelectedListing(vendor);
                            setCurrentView('vendor-detail');
                        }}
                        style={{
                            ...clayCard,
                            padding: '24px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            animation: `slideUp 0.5s ease-out ${idx * 0.15}s both`
                        }}
                    >
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'start', marginBottom: '16px' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '20px',
                                background: `linear-gradient(135deg, ${vendor.color}22, ${vendor.color}44)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '40px',
                                flexShrink: 0
                            }}>
                                {vendor.image}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <h3 style={{
                                        fontSize: '20px',
                                        fontWeight: '800',
                                        color: '#1e293b',
                                        margin: 0
                                    }}>
                                        {vendor.name}
                                    </h3>
                                    {vendor.verified && (
                                        <CheckCircle size={20} style={{ color: '#4ECDC4', flexShrink: 0 }} />
                                    )}
                                </div>
                                <p style={{
                                    fontSize: '14px',
                                    color: '#64748b',
                                    margin: '0 0 12px 0'
                                }}>
                                    {vendor.category}
                                </p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                    <div style={{
                                        ...clayButton,
                                        padding: '6px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '12px'
                                    }}>
                                        <Star size={14} style={{ color: '#FFD93D', fill: '#FFD93D' }} />
                                        <span style={{ fontWeight: '700', color: '#1e293b' }}>
                                            {vendor.rating}
                                        </span>
                                        <span style={{ color: '#94a3b8' }}>
                                            ({vendor.reviews})
                                        </span>
                                    </div>
                                    <div style={{
                                        ...clayButton,
                                        padding: '6px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '12px',
                                        color: '#64748b'
                                    }}>
                                        <Package size={14} />
                                        {vendor.products} Products
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                            gap: '12px',
                            paddingTop: '16px',
                            borderTop: '1px solid rgba(148, 163, 184, 0.2)'
                        }}>
                            <div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                                    Location
                                </div>
                                <div style={{
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#475569',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <MapPin size={12} />
                                    {vendor.location}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                                    Response Time
                                </div>
                                <div style={{
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    color: '#475569',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <Clock size={12} />
                                    {vendor.responseTime}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
