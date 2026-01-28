import { Home, Package, Store, ShoppingBag } from 'lucide-react';
import { clayCard } from '../../styles/clayStyles';

interface BottomNavProps {
    currentView: string;
    setCurrentView: (view: string) => void;
}

export const BottomNav = ({ currentView, setCurrentView }: BottomNavProps) => {
    const navItems = [
        { id: 'home', icon: Home, label: 'Home' },
        { id: 'listings', icon: Package, label: 'Listings' },
        { id: 'vendors', icon: Store, label: 'Vendors' },
        { id: 'requests', icon: ShoppingBag, label: 'Requests' }
    ];

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 20px 20px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(148, 163, 184, 0.2)',
            zIndex: 100
        }}>
            <div style={{
                ...clayCard,
                padding: '12px',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center'
            }}>
                {navItems.map(nav => (
                    <button
                        key={nav.id}
                        onClick={() => setCurrentView(nav.id)}
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.3s ease',
                            borderRadius: '12px'
                        }}
                    >
                        <nav.icon
                            size={22}
                            style={{
                                color: currentView === nav.id ? '#4ECDC4' : '#94a3b8',
                                transition: 'all 0.3s ease'
                            }}
                        />
                        <span style={{
                            fontSize: '11px',
                            fontWeight: currentView === nav.id ? '700' : '600',
                            color: currentView === nav.id ? '#4ECDC4' : '#94a3b8',
                            transition: 'all 0.3s ease'
                        }}>
                            {nav.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};
