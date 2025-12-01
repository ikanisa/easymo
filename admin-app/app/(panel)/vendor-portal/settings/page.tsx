'use client';

/**
 * Settings Page
 * User preferences and account options
 */

import { useRouter } from 'next/navigation';

import { PortalShell } from '@/components/vendor-portal/layout';
import { SettingsList } from '@/components/vendor-portal/settings';

export default function SettingsPage() {
  const router = useRouter();

  const handleLogout = () => {
    // In a real app, this would clear auth and redirect
    console.log('Logging out...');
    router.push('/login');
  };

  return (
    <PortalShell title="Settings">
      <SettingsList
        onProfileClick={() => console.log('Profile clicked')}
        onNotificationsClick={() => console.log('Notifications clicked')}
        onSecurityClick={() => console.log('Security clicked')}
        onAppearanceClick={() => console.log('Appearance clicked')}
        onHelpClick={() => console.log('Help clicked')}
        onLogout={handleLogout}
      />
    </PortalShell>
  );
}
