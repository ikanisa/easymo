import React from 'react';
import { Home, Package, Store, ShoppingBag } from 'lucide-react';

export type NavTab = 'home' | 'listings' | 'vendors' | 'requests';

interface BottomNavProps {
    activeTab: NavTab;
    onTabChange: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
    const tabs: { id: NavTab; icon: React.FC<any>; label: string }[] = [
        { id: 'home', icon: Home, label: 'Home' },
        { id: 'listings', icon: Package, label: 'Listings' },
        { id: 'vendors', icon: Store, label: 'Vendors' },
        { id: 'requests', icon: ShoppingBag, label: 'Requests' },
    ];

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '72px',
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            zIndex: 800,
            paddingBottom: 'safe-area-inset-bottom',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.05)'
        }}>
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        style={{
                            background: 'none',
                            border: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            color: isActive ? 'var(--primary-teal)' : 'var(--neutral-400)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            transform: isActive ? 'scale(1.1)' : 'scale(1)'
                        }}
                    >
                        <tab.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                        <span style={{ fontSize: '11px', fontWeight: isActive ? 700 : 500 }}>
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
