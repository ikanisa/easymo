'use client';

/**
 * SettingsList - Settings options list
 */

import { 
  Bell, 
  ChevronRight, 
  HelpCircle, 
  LogOut, 
  Moon, 
  Shield, 
  User 
} from 'lucide-react';

interface SettingsItem {
  id: string;
  icon: typeof User;
  title: string;
  description?: string;
  onClick?: () => void;
  danger?: boolean;
}

interface SettingsListProps {
  onProfileClick?: () => void;
  onNotificationsClick?: () => void;
  onSecurityClick?: () => void;
  onAppearanceClick?: () => void;
  onHelpClick?: () => void;
  onLogout?: () => void;
}

export function SettingsList({
  onProfileClick,
  onNotificationsClick,
  onSecurityClick,
  onAppearanceClick,
  onHelpClick,
  onLogout,
}: SettingsListProps) {
  const items: SettingsItem[] = [
    {
      id: 'profile',
      icon: User,
      title: 'Profile',
      description: 'Manage your account details',
      onClick: onProfileClick,
    },
    {
      id: 'notifications',
      icon: Bell,
      title: 'Notifications',
      description: 'Configure alerts and push notifications',
      onClick: onNotificationsClick,
    },
    {
      id: 'security',
      icon: Shield,
      title: 'Security',
      description: 'Password and authentication',
      onClick: onSecurityClick,
    },
    {
      id: 'appearance',
      icon: Moon,
      title: 'Appearance',
      description: 'Theme and display preferences',
      onClick: onAppearanceClick,
    },
    {
      id: 'help',
      icon: HelpCircle,
      title: 'Help & Support',
      description: 'Get help or contact support',
      onClick: onHelpClick,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="vp-card">
        <ul className="vp-settings-list">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="vp-settings-item"
                  onClick={item.onClick}
                >
                  <div className="vp-settings-item__icon">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="vp-settings-item__content">
                    <p className="vp-settings-item__title">{item.title}</p>
                    {item.description && (
                      <p className="vp-settings-item__description">{item.description}</p>
                    )}
                  </div>
                  <ChevronRight className="vp-settings-item__arrow" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="vp-card">
        <button
          type="button"
          className="vp-settings-item vp-settings-item--danger"
          onClick={onLogout}
        >
          <div className="vp-settings-item__icon vp-settings-item__icon--danger">
            <LogOut className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="vp-settings-item__content">
            <p className="vp-settings-item__title">Log Out</p>
            <p className="vp-settings-item__description">Sign out of your account</p>
          </div>
          <ChevronRight className="vp-settings-item__arrow" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
