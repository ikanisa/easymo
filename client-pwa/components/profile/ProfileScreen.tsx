'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Phone,
  MapPin,
  Smartphone,
  CreditCard,
  ChevronRight,
  Edit2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';
import type { Country, UserMoMoConfig } from '@/types/country';
import { getCountryByCode } from '@/lib/countries';

/**
 * User Profile Screen
 * 
 * Displays:
 * - User's WhatsApp number
 * - Profile country (from WhatsApp)
 * - Mobile money country (may differ from profile)
 * - Mobile money number
 * - Provider (auto-determined)
 */

interface UserProfile {
  id: string;
  name?: string;
  whatsappNumber: string;
  profileCountry: string;
  momoConfig?: UserMoMoConfig;
  createdAt: string;
}

interface ProfileScreenProps {
  user: UserProfile;
  onEdit: () => void;
  onEditMoMo: () => void;
}

export function ProfileScreen({ user, onEdit, onEditMoMo }: ProfileScreenProps) {
  const { trigger } = useHaptics();
  const [profileCountryData, setProfileCountryData] = useState<Country | null>(null);
  const [momoCountryData, setMomoCountryData] = useState<Country | null>(null);

  // Load country data
  useEffect(() => {
    async function loadCountries() {
      if (user.profileCountry) {
        const country = await getCountryByCode(user.profileCountry);
        setProfileCountryData(country);
      }
      
      if (user.momoConfig?.momoCountry) {
        const country = await getCountryByCode(user.momoConfig.momoCountry);
        setMomoCountryData(country);
      }
    }
    loadCountries();
  }, [user.profileCountry, user.momoConfig?.momoCountry]);

  const handleEditClick = () => {
    trigger('light');
    onEdit();
  };

  const handleEditMoMoClick = () => {
    trigger('light');
    onEditMoMo();
  };

  const isDifferentMoMoCountry =
    user.momoConfig &&
    user.momoConfig.momoCountry !== user.profileCountry;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 pt-12 pb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Profile</h1>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleEditClick}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full"
          >
            <Edit2 className="w-4 h-4" />
            <span className="text-sm font-medium">Edit</span>
          </motion.button>
        </div>
      </div>

      {/* Profile Avatar */}
      <div className="flex justify-center pb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
          <User className="w-12 h-12 text-primary-foreground" />
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-4 space-y-4">
        {/* Name (if available) */}
        {user.name && (
          <ProfileInfoCard
            icon={<User className="w-5 h-5" />}
            label="Name"
            value={user.name}
          />
        )}

        {/* WhatsApp Number */}
        <ProfileInfoCard
          icon={<Phone className="w-5 h-5 text-green-600" />}
          label="WhatsApp Number"
          value={user.whatsappNumber}
          sublabel="Used for registration"
        />

        {/* Profile Country */}
        <ProfileInfoCard
          icon={<MapPin className="w-5 h-5" />}
          label="Profile Country"
          value={
            profileCountryData
              ? `${profileCountryData.flagEmoji} ${profileCountryData.name}`
              : user.profileCountry
          }
          sublabel="Based on your WhatsApp number"
        />
      </div>

      {/* Mobile Money Section */}
      <div className="px-4 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Mobile Money</h2>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleEditMoMoClick}
            className="text-sm text-primary font-medium"
          >
            {user.momoConfig ? 'Edit' : 'Setup'}
          </motion.button>
        </div>

        {user.momoConfig ? (
          <div className="space-y-4">
            {/* MoMo Country (with indicator if different) */}
            <ProfileInfoCard
              icon={<MapPin className="w-5 h-5" />}
              label="Mobile Money Country"
              value={
                momoCountryData
                  ? `${momoCountryData.flagEmoji} ${momoCountryData.name}`
                  : user.momoConfig.momoCountry
              }
              sublabel={
                isDifferentMoMoCountry
                  ? 'Different from profile country'
                  : 'Same as profile country'
              }
              highlight={isDifferentMoMoCountry}
            />

            {/* MoMo Number */}
            <ProfileInfoCard
              icon={<Smartphone className="w-5 h-5 text-yellow-600" />}
              label="Mobile Money Number"
              value={user.momoConfig.momoNumber}
            />

            {/* Provider */}
            <ProfileInfoCard
              icon={<CreditCard className="w-5 h-5" />}
              label="Provider"
              value={user.momoConfig.momoProvider}
              sublabel={
                momoCountryData
                  ? `${momoCountryData.mobileMoneyBrand}`
                  : 'Auto-determined from country'
              }
            />
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleEditMoMoClick}
            className={cn(
              'w-full flex items-center justify-between gap-4 p-4',
              'bg-card border-2 border-dashed border-primary/30 rounded-2xl',
              'hover:border-primary/50 transition-colors'
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-medium">Setup Mobile Money</p>
                <p className="text-sm text-muted-foreground">
                  Configure your mobile money account
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </motion.button>
        )}
      </div>

      {/* Account Info */}
      <div className="px-4 mt-8 mb-8">
        <p className="text-sm text-muted-foreground text-center">
          Member since{' '}
          {new Date(user.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
          })}
        </p>
      </div>
    </div>
  );
}

interface ProfileInfoCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
}

function ProfileInfoCard({
  icon,
  label,
  value,
  sublabel,
  highlight,
}: ProfileInfoCardProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-4 p-4',
        'bg-card border rounded-2xl',
        highlight ? 'border-primary/30 bg-primary/5' : 'border-border'
      )}
    >
      <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium truncate">{value}</p>
        {sublabel && (
          <p
            className={cn(
              'text-xs mt-0.5',
              highlight ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}
