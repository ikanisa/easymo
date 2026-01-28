import { CheckCircle, AlertCircle, MapPin, MessageCircle, Heart, Share2 } from 'lucide-react';
import { clayCard, clayButton } from '../../styles/clayStyles';
import { Listing, Vendor } from '../../types/marketplace';

interface ListingDetailViewProps {
    selectedListing: Listing | Vendor | null;
    setChatOpen: (open: boolean) => void;
    setInputValue: (val: string) => void;
}

export const ListingDetailView = ({ selectedListing, setChatOpen, setInputValue }: ListingDetailViewProps) => {
    if (!selectedListing) return null;

    // Cast to Listing to access listing-specific props safely
    // In a real app we'd use discriminated unions or separate types more strictly
    const listing = selectedListing as Listing;

    return (
        <div className="listing-detail-view">
            <div style={{
                ...clayCard,
                padding: '24px',
                marginBottom: '20px'
            }}>
                <div style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.15), rgba(255, 107, 107, 0.15))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '120px',
                    marginBottom: '24px'
                }}>
                    {listing.image}
                </div>

                <div style={{ marginBottom: '16px' }}>
                    {listing.verified ? (
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '12px',
                            background: 'rgba(78, 205, 196, 0.15)',
                            marginBottom: '12px'
                        }}>
                            <CheckCircle size={14} style={{ color: '#4ECDC4' }} />
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#4ECDC4' }}>
                                Verified Vendor
                            </span>
                        </div>
                    ) : (
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '12px',
                            background: 'rgba(255, 230, 109, 0.15)',
                            marginBottom: '12px'
                        }}>
                            <AlertCircle size={14} style={{ color: '#F59E0B' }} />
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#F59E0B' }}>
                                Unverified Seller
                            </span>
                        </div>
                    )}

                    <h1 style={{
                        fontSize: '26px',
                        fontWeight: '800',
                        color: '#1e293b',
                        margin: '0 0 8px 0',
                        letterSpacing: '-0.5px',
                        lineHeight: '1.3'
                    }}>
                        {listing.title}
                    </h1>

                    <p style={{
                        fontSize: '32px',
                        fontWeight: '900',
                        color: '#FF6B6B',
                        margin: '0 0 16px 0'
                    }}>
                        {listing.price?.toLocaleString() || 'N/A'} {listing.currency || ''}
                    </p>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    padding: '16px',
                    borderRadius: '16px',
                    background: 'rgba(148, 163, 184, 0.05)',
                    marginBottom: '20px'
                }}>
                    <div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                            Condition
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>
                            {listing.condition || 'N/A'}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                            Category
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>
                            {listing.category}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                            Location
                        </div>
                        <div style={{
                            fontSize: '14px',
                            fontWeight: '700',
                            color: '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <MapPin size={12} />
                            {listing.location}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                            Posted
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>
                            {listing.postedTime || 'Recently'}
                        </div>
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '12px',
                    paddingTop: '16px',
                    borderTop: '1px solid rgba(148, 163, 184, 0.2)'
                }}>
                    <button
                        onClick={() => {
                            setInputValue(`I'm interested in: ${listing.title}`);
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
                        Contact Seller
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
                        <Heart
                            size={20}
                            style={{
                                color: '#94a3b8',
                                fill: 'none'
                            }}
                        />
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
                        <Share2 size={20} style={{ color: '#4ECDC4' }} />
                    </button>
                </div>
            </div>

            <div style={{
                ...clayCard,
                padding: '20px'
            }}>
                <h3 style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#1e293b',
                    margin: '0 0 12px 0'
                }}>
                    Seller Information
                </h3>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    borderRadius: '16px',
                    background: 'rgba(148, 163, 184, 0.05)'
                }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.2), rgba(78, 205, 196, 0.4))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px'
                    }}>
                        {listing.image}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                                {listing.vendorName || listing.name} {/* Fallback to name if vendorName missing */}
                            </span>
                            {listing.verified && (
                                <CheckCircle size={14} style={{ color: '#4ECDC4' }} />
                            )}
                        </div>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                            Usually responds in 1-2 hours
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
