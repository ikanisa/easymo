import { CheckCircle, Star, Package, Clock, MapPin, MessageCircle, Phone } from 'lucide-react';
import { clayCard, clayButton } from '../../styles/clayStyles';
import { listings } from '../../data/mockMarketplace';
import { Vendor, Listing } from '../../types/marketplace';
import { ListingCard } from './HomeView';

interface VendorDetailViewProps {
    selectedListing: Listing | Vendor | null;
    setChatOpen: (open: boolean) => void;
    setInputValue: (val: string) => void;
    setSelectedListing: (listing: Listing | Vendor) => void;
    setCurrentView: (view: string) => void;
}

export const VendorDetailView = ({ selectedListing, setChatOpen, setInputValue, setSelectedListing, setCurrentView }: VendorDetailViewProps) => {
    if (!selectedListing) return null;
    const vendor = selectedListing as Vendor; // Type assertion

    return (
        <div className="vendor-detail-view">
            <div style={{
                ...clayCard,
                padding: '24px',
                marginBottom: '20px'
            }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'start', marginBottom: '20px' }}>
                    <div style={{
                        width: '96px',
                        height: '96px',
                        borderRadius: '24px',
                        background: `linear-gradient(135deg, ${vendor.color}22, ${vendor.color}44)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '48px',
                        flexShrink: 0
                    }}>
                        {vendor.image}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <h1 style={{
                                fontSize: '24px',
                                fontWeight: '900',
                                color: '#1e293b',
                                margin: 0,
                                letterSpacing: '-0.5px'
                            }}>
                                {vendor.name}
                            </h1>
                            <CheckCircle size={24} style={{ color: '#4ECDC4', flexShrink: 0 }} />
                        </div>
                        <p style={{
                            fontSize: '15px',
                            color: '#64748b',
                            margin: '0 0 12px 0'
                        }}>
                            {vendor.category}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Star size={16} style={{ color: '#FFD93D', fill: '#FFD93D' }} />
                            <span style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b' }}>
                                {vendor.rating}
                            </span>
                            <span style={{ fontSize: '14px', color: '#94a3b8' }}>
                                ({vendor.reviews} reviews)
                            </span>
                        </div>
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '16px',
                    marginBottom: '20px'
                }}>
                    <div style={{
                        ...clayCard,
                        padding: '16px',
                        textAlign: 'center'
                    }}>
                        <Package size={24} style={{ color: '#4ECDC4', margin: '0 auto 8px' }} />
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', marginBottom: '4px' }}>
                            {vendor.products}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Products
                        </div>
                    </div>
                    <div style={{
                        ...clayCard,
                        padding: '16px',
                        textAlign: 'center'
                    }}>
                        <Clock size={24} style={{ color: '#FFE66D', margin: '0 auto 8px' }} />
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', marginBottom: '4px' }}>
                            {vendor.responseTime}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Response
                        </div>
                    </div>
                    <div style={{
                        ...clayCard,
                        padding: '16px',
                        textAlign: 'center'
                    }}>
                        <MapPin size={24} style={{ color: '#FF6B6B', margin: '0 auto 8px' }} />
                        <div style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b', marginBottom: '4px' }}>
                            {vendor.location.split(',')[0]}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Location
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => {
                            setInputValue(`I'd like to know more about ${vendor.name}`);
                            setChatOpen(true);
                        }}
                        style={{
                            ...clayButton,
                            flex: 1,
                            padding: '16px',
                            fontSize: '15px',
                            fontWeight: '700',
                            color: '#fff',
                            background: 'linear-gradient(135deg, #4ECDC4, #44A08D)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <MessageCircle size={18} />
                        Contact Vendor
                    </button>
                    <button
                        style={{
                            ...clayButton,
                            padding: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <Phone size={20} style={{ color: '#4ECDC4' }} />
                    </button>
                </div>
            </div>

            <h3 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1e293b',
                margin: '0 0 16px 0'
            }}>
                Products from {vendor.name}
            </h3>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '16px'
            }}>
                {listings.filter(l => l.vendorName === vendor.name).map((listing, idx) => (
                    <ListingCard
                        key={listing.id}
                        listing={listing}
                        idx={idx}
                        setSelectedListing={setSelectedListing}
                        setCurrentView={setCurrentView}
                    />
                ))}
            </div>
        </div>
    );
};
