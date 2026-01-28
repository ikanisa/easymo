import { MessageCircle, ShoppingBag, CheckCircle, Star, MapPin, Clock, ChevronRight, Heart, AlertCircle } from 'lucide-react';
import { clayCard, clayButton } from '../../styles/clayStyles';
import { categories, verifiedVendors, listings } from '../../data/mockMarketplace';
import { Vendor, Listing } from '../../types/marketplace';

interface HomeViewProps {
    setChatOpen: (open: boolean) => void;
    setCurrentView: (view: string) => void;
    setSelectedCategory: (category: string) => void;
    setSelectedListing: (listing: Listing | Vendor) => void;
}

export const HomeView = ({ setChatOpen, setCurrentView, setSelectedCategory, setSelectedListing }: HomeViewProps) => {
    return (
        <div className="home-view">
            {/* Hero Section */}
            <div style={{
                ...clayCard,
                padding: '32px',
                marginBottom: '24px',
                background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.15), rgba(78, 205, 196, 0.15))',
                animation: 'float 6s ease-in-out infinite'
            }}>
                <h1 style={{
                    fontSize: '32px',
                    fontWeight: '800',
                    background: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '12px',
                    letterSpacing: '-0.5px'
                }}>
                    Welcome to Moltbot
                </h1>
                <p style={{
                    color: '#64748b',
                    fontSize: '16px',
                    lineHeight: '1.6',
                    marginBottom: '20px'
                }}>
                    Your AI-powered community marketplace. Buy, sell, and connect with verified vendors in Rwanda.
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setChatOpen(true)}
                        style={{
                            ...clayButton,
                            padding: '14px 24px',
                            fontSize: '15px',
                            fontWeight: '600',
                            color: '#FF6B6B',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <MessageCircle size={18} style={{ marginRight: '8px' }} />
                        Chat with Moltbot
                    </button>
                    <button
                        onClick={() => setCurrentView('listings')}
                        style={{
                            ...clayButton,
                            padding: '14px 24px',
                            fontSize: '15px',
                            fontWeight: '600',
                            color: '#4ECDC4',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <ShoppingBag size={18} style={{ marginRight: '8px' }} />
                        Browse Listings
                    </button>
                </div>
            </div>

            {/* Categories */}
            <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '16px',
                letterSpacing: '-0.3px'
            }}>
                Categories
            </h2>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: '12px',
                marginBottom: '32px'
            }}>
                {categories.map((cat, idx) => (
                    <div
                        key={cat.id}
                        onClick={() => {
                            setSelectedCategory(cat.id);
                            setCurrentView('listings');
                        }}
                        style={{
                            ...clayCard,
                            padding: '20px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            animation: `slideUp 0.5s ease-out ${idx * 0.1}s both`
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = `
                10px 10px 20px rgba(163, 177, 198, 0.6),
                -10px -10px 20px rgba(255, 255, 255, 0.9),
                inset 2px 2px 4px rgba(255, 255, 255, 0.3)
              `;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = clayCard.boxShadow as string;
                        }}
                    >
                        <div style={{
                            fontSize: '32px',
                            marginBottom: '8px'
                        }}>
                            {cat.icon}
                        </div>
                        <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#475569'
                        }}>
                            {cat.name}
                        </div>
                    </div>
                ))}
            </div>

            {/* Featured Vendors */}
            <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '16px',
                letterSpacing: '-0.3px'
            }}>
                Verified Vendors
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                {verifiedVendors.map((vendor, idx) => (
                    <div
                        key={vendor.id}
                        style={{
                            ...clayCard,
                            padding: '20px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            animation: `slideUp 0.5s ease-out ${idx * 0.15}s both`
                        }}
                        onClick={() => {
                            setSelectedListing(vendor);
                            setCurrentView('vendor-detail');
                        }}
                    >
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'start' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '16px',
                                background: `linear-gradient(135deg, ${vendor.color}22, ${vendor.color}44)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '32px',
                                flexShrink: 0
                            }}>
                                {vendor.image}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <h3 style={{
                                        fontSize: '17px',
                                        fontWeight: '700',
                                        color: '#1e293b',
                                        margin: 0
                                    }}>
                                        {vendor.name}
                                    </h3>
                                    {vendor.verified && (
                                        <CheckCircle size={16} style={{ color: '#4ECDC4', flexShrink: 0 }} />
                                    )}
                                </div>
                                <p style={{
                                    fontSize: '13px',
                                    color: '#64748b',
                                    margin: '0 0 8px 0'
                                }}>
                                    {vendor.category}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Star size={14} style={{ color: '#FFD93D', fill: '#FFD93D' }} />
                                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                                            {vendor.rating}
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                                            ({vendor.reviews})
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <MapPin size={14} style={{ color: '#94a3b8' }} />
                                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                                            {vendor.location}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={14} style={{ color: '#94a3b8' }} />
                                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                                            {vendor.responseTime}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Listings Preview */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#1e293b',
                    margin: 0,
                    letterSpacing: '-0.3px'
                }}>
                    Recent Listings
                </h2>
                <button
                    onClick={() => setCurrentView('listings')}
                    style={{
                        ...clayButton,
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#4ECDC4',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                >
                    View All
                    <ChevronRight size={16} />
                </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px' }}>
                {listings.slice(0, 4).map((listing, idx) => (
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

// Extracted ListingCard since it's used here
interface ListingCardProps {
    listing: Listing;
    idx: number;
    setSelectedListing: (listing: Listing) => void;
    setCurrentView: (view: string) => void;
}

export const ListingCard = ({ listing, idx, setSelectedListing, setCurrentView }: ListingCardProps) => (
    <div
        onClick={() => {
            setSelectedListing(listing);
            setCurrentView('listing-detail');
        }}
        style={{
            ...clayCard,
            padding: '16px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            animation: `slideUp 0.5s ease-out ${idx * 0.1}s both`,
            position: 'relative'
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
        }}
    >
        <button
            onClick={(e) => {
                e.stopPropagation();
                // toggleFavorite(listing.id); // Passing this prop down feels excessive for now
            }}
            style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(255, 255, 255, 0.9)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                zIndex: 10
            }}
        >
            <Heart
                size={16}
                style={{
                    color: '#94a3b8',
                    fill: 'none'
                }}
            />
        </button>

        <div style={{
            width: '100%',
            aspectRatio: '1',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(78, 205, 196, 0.1), rgba(255, 107, 107, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            marginBottom: '12px'
        }}>
            {listing.image}
        </div>

        <h4 style={{
            fontSize: '14px',
            fontWeight: '700',
            color: '#1e293b',
            margin: '0 0 6px 0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
        }}>
            {listing.title}
        </h4>

        <p style={{
            fontSize: '16px',
            fontWeight: '800',
            color: '#FF6B6B',
            margin: '0 0 8px 0'
        }}>
            {listing.price.toLocaleString()} {listing.currency}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
            <MapPin size={12} style={{ color: '#94a3b8', flexShrink: 0 }} />
            <span style={{
                fontSize: '11px',
                color: '#64748b',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
            }}>
                {listing.location}
            </span>
        </div>

        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '8px',
            borderTop: '1px solid rgba(148, 163, 184, 0.2)'
        }}>
            {listing.verified ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle size={12} style={{ color: '#4ECDC4' }} />
                    <span style={{ fontSize: '10px', color: '#4ECDC4', fontWeight: '600' }}>
                        Verified
                    </span>
                </div>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={12} style={{ color: '#FFE66D' }} />
                    <span style={{ fontSize: '10px', color: '#F59E0B', fontWeight: '600' }}>
                        Unverified
                    </span>
                </div>
            )}
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                {listing.postedTime}
            </span>
        </div>
    </div>
);
