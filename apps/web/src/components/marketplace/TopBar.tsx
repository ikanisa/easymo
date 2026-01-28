import { ChevronRight, Bell, User } from 'lucide-react';
import { clayButton } from '../../styles/clayStyles';

interface TopBarProps {
    currentView: string;
    selectedListing: any; // Using any for simplicity as it can be Vendor or Listing
    setCurrentView: (view: string) => void;
    setSelectedListing: (listing: any) => void;
    notifications: any[];
}

export const TopBar = ({ currentView, selectedListing, setCurrentView, setSelectedListing, notifications }: TopBarProps) => {
    return (
        <div style={{
            position: 'sticky',
            top: 0,
            padding: '16px 20px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            zIndex: 90,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {(currentView !== 'home' && selectedListing) && (
                    <button
                        onClick={() => {
                            setSelectedListing(null);
                            const parentView = currentView === 'vendor-detail' ? 'vendors' : 'listings';
                            setCurrentView(parentView);
                        }}
                        style={{
                            ...clayButton,
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <ChevronRight size={20} style={{ color: '#64748b', transform: 'rotate(180deg)' }} />
                    </button>
                )}
                <h2 style={{
                    fontSize: '20px',
                    fontWeight: '800',
                    background: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    margin: 0
                }}>
                    Moltbot
                </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                    style={{
                        ...clayButton,
                        padding: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                    }}
                >
                    <Bell size={20} style={{ color: '#64748b' }} />
                    {notifications.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#FF6B6B'
                        }} />
                    )}
                </button>
                <button
                    style={{
                        ...clayButton,
                        padding: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <User size={20} style={{ color: '#64748b' }} />
                </button>
            </div>
        </div>
    );
};
