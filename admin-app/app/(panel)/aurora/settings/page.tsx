/**
 * Aurora Settings Page - Modernized settings interface
 */
export const metadata = {
  title: 'Settings - EasyMO Admin',
  description: 'Manage your admin panel settings and preferences',
};

export default function AuroraSettingsPage() {
  return <AuroraSettingsClient />;
}

import { AuroraSettingsClient } from './AuroraSettingsClient';
