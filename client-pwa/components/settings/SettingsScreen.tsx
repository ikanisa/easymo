'use client';

import { motion } from 'framer-motion';
import {
  User,
  Smartphone,
  Globe,
  Bell,
  Shield,
  HelpCircle,
  Info,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';

/**
 * Settings Screen
 * 
 * Cleaned up version per requirements:
 * - REMOVED: Developer Options
 * - REMOVED: SMS Synchronisation (SMS permission is OPTIONAL)
 * - REMOVED: Open Source Licence
 * - REMOVED: Webhook Configuration (admin panel only)
 * 
 * KEPT/ADDED:
 * - Profile
 * - Mobile Money Setup
 * - Language/Locale
 * - Notifications
 * - NFC Settings (if NFC toggle is needed in settings too)
 * - Security
 * - Help & Support
 * - About
 * - Sign Out
 */

interface SettingsItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  rightContent?: React.ReactNode;
}

interface SettingsScreenProps {
  onNavigate: (screen: string) => void;
  onLogout: () => void;
  currentLanguage?: string;
  version?: string;
}

export function SettingsScreen({
  onNavigate,
  onLogout,
  currentLanguage = 'English',
  version = '1.0.0',
}: SettingsScreenProps) {
  const { trigger } = useHaptics();

  const handleItemClick = (item: SettingsItem) => {
    trigger('light');
    item.onClick();
  };

  const settingsItems: SettingsItem[] = [
    // Account Section
    {
      id: 'profile',
      icon: <User className="w-5 h-5" />,
      label: 'Profile',
      description: 'View and edit your profile',
      onClick: () => onNavigate('profile'),
    },
    {
      id: 'mobile-money',
      icon: <Smartphone className="w-5 h-5" />,
      label: 'Mobile Money Setup',
      description: 'Configure your mobile money account',
      onClick: () => onNavigate('momo-setup'),
    },
    // Preferences Section
    {
      id: 'language',
      icon: <Globe className="w-5 h-5" />,
      label: 'Language',
      description: 'Change app language',
      onClick: () => onNavigate('language'),
      rightContent: (
        <span className="text-sm text-muted-foreground">{currentLanguage}</span>
      ),
    },
    {
      id: 'notifications',
      icon: <Bell className="w-5 h-5" />,
      label: 'Notifications',
      description: 'Manage notification preferences',
      onClick: () => onNavigate('notifications'),
    },
    // Security Section
    {
      id: 'security',
      icon: <Shield className="w-5 h-5" />,
      label: 'Security',
      description: 'PIN, biometrics, and security settings',
      onClick: () => onNavigate('security'),
    },
    // Support Section
    {
      id: 'help',
      icon: <HelpCircle className="w-5 h-5" />,
      label: 'Help & Support',
      description: 'Get help or contact support',
      onClick: () => onNavigate('help'),
    },
    {
      id: 'about',
      icon: <Info className="w-5 h-5" />,
      label: 'About',
      description: `Version ${version}`,
      onClick: () => onNavigate('about'),
    },
    // Sign Out
    {
      id: 'logout',
      icon: <LogOut className="w-5 h-5" />,
      label: 'Sign Out',
      onClick: onLogout,
      variant: 'destructive',
    },
  ];

  const groupedItems = {
    account: settingsItems.filter((i) => ['profile', 'mobile-money'].includes(i.id)),
    preferences: settingsItems.filter((i) => ['language', 'notifications'].includes(i.id)),
    security: settingsItems.filter((i) => i.id === 'security'),
    support: settingsItems.filter((i) => ['help', 'about'].includes(i.id)),
    actions: settingsItems.filter((i) => i.id === 'logout'),
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Settings List */}
      <div className="px-4 space-y-6 pb-8">
        {/* Account Section */}
        <SettingsSection title="Account" items={groupedItems.account} onItemClick={handleItemClick} />

        {/* Preferences Section */}
        <SettingsSection title="Preferences" items={groupedItems.preferences} onItemClick={handleItemClick} />

        {/* Security Section */}
        <SettingsSection title="Security" items={groupedItems.security} onItemClick={handleItemClick} />

        {/* Support Section */}
        <SettingsSection title="Support" items={groupedItems.support} onItemClick={handleItemClick} />

        {/* Actions Section */}
        <SettingsSection items={groupedItems.actions} onItemClick={handleItemClick} />
      </div>
    </div>
  );
}

interface SettingsSectionProps {
  title?: string;
  items: SettingsItem[];
  onItemClick: (item: SettingsItem) => void;
}

function SettingsSection({ title, items, onItemClick }: SettingsSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      {title && (
        <h2 className="text-sm font-medium text-muted-foreground px-2 uppercase tracking-wide">
          {title}
        </h2>
      )}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {items.map((item, index) => (
          <motion.button
            key={item.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => onItemClick(item)}
            className={cn(
              'w-full flex items-center gap-4 px-4 py-4',
              'text-left transition-colors',
              'hover:bg-accent active:bg-accent/80',
              index < items.length - 1 && 'border-b border-border'
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                item.variant === 'destructive'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-primary/10 text-primary'
              )}
            >
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'font-medium',
                  item.variant === 'destructive' && 'text-destructive'
                )}
              >
                {item.label}
              </p>
              {item.description && (
                <p className="text-sm text-muted-foreground truncate">
                  {item.description}
                </p>
              )}
            </div>
            {item.rightContent || (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
