import { Search, Filter } from 'lucide-react';
import { clayCard, clayButton, clayCardPressed } from '../../styles/clayStyles';
import { categories, listings } from '../../data/mockMarketplace';
import { Listing, Vendor } from '../../types/marketplace';
import { ListingCard } from './HomeView'; // Reuse ListingCard

interface ListingsViewProps {
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
    setSelectedListing: (listing: Listing | Vendor) => void;
    setCurrentView: (view: string) => void;
}

export const ListingsView = ({ selectedCategory, setSelectedCategory, setSelectedListing, setCurrentView }: ListingsViewProps) => {
    return (
        <div className="listings-view">
            <div style={{
                ...clayCard,
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
            }}>
                <Search size={20} style={{ color: '#94a3b8' }} />
                <input
                    type="text"
                    placeholder="Search listings..."
                    style={{
                        flex: 1,
                        border: 'none',
                        background: 'transparent',
                        fontSize: '15px',
                        color: '#1e293b',
                        outline: 'none'
                    }}
                />
                <button style={{
                    ...clayButton,
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Filter size={18} style={{ color: '#4ECDC4' }} />
                </button>
            </div>

            <div style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                marginBottom: '24px',
                paddingBottom: '8px'
            }}>
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        style={{
                            ...(selectedCategory === cat.id ? clayCardPressed : clayButton),
                            padding: '10px 20px',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: selectedCategory === cat.id ? cat.color : '#64748b',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        <span style={{ marginRight: '6px' }}>{cat.icon}</span>
                        {cat.name}
                    </button>
                ))}
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: '16px'
            }}>
                {listings.map((listing, idx) => (
                    <ListingCard
                        key={listing.id}
                        listing={listing}
                        idx={idx}
                        setSelectedListing={() => setSelectedListing(listing)} // Correct type mismatch handling? Listing is compatible.
                        setCurrentView={setCurrentView}
                    />
                ))}
            </div>
        </div>
    );
};
