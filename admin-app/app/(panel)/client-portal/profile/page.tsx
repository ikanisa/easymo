"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { User, Phone, MapPin, CreditCard, ChevronRight, Edit2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import type { SupportedCountryCode } from "@/lib/countries/types";
import {
  COUNTRY_FLAGS,
  COUNTRY_MOMO_BRANDS,
  COUNTRY_NAMES,
  COUNTRY_PHONE_PREFIXES,
  DEFAULT_COUNTRY_CODE,
} from "@/lib/countries/types";

interface UserProfile {
  id: string;
  name: string;
  whatsappPhone: string;
  whatsappCountryCode: SupportedCountryCode;
  momoCountryCode: SupportedCountryCode | null;
  momoPhoneNumber: string | null;
  email?: string;
}

// Mock user data - replace with actual Supabase query
const mockUser: UserProfile = {
  id: "user-1",
  name: "John Doe",
  whatsappPhone: "+1 555 123 4567",
  whatsappCountryCode: "RW", // Profile country from WhatsApp
  momoCountryCode: "RW",
  momoPhoneNumber: "+250 788 123 456",
  email: "john@example.com",
};

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with actual Supabase query
    const loadUser = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setUser(mockUser);
      setIsLoading(false);
    };
    loadUser();
  }, []);

  if (isLoading) {
    return (
      <div className="admin-page">
        <LoadingState title="Loading profile" description="Fetching your data..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="admin-page">
        <PageHeader title="Profile" description="User not found" />
      </div>
    );
  }

  const hasMomoSetup = user.momoCountryCode && user.momoPhoneNumber;

  return (
    <div className="admin-page">
      <PageHeader
        title="Profile"
        description="Manage your account and mobile money settings"
      />

      {/* User Info Card */}
      <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-[var(--aurora-accent)]/10 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-[var(--aurora-accent)]" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-[var(--aurora-text-primary)]">
              {user.name}
            </h2>
            {user.email && (
              <p className="text-sm text-[var(--aurora-text-muted)]">{user.email}</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* WhatsApp Number */}
          <div className="flex items-center gap-3 p-3 bg-[var(--aurora-surface-elevated)] rounded-lg">
            <Phone className="w-5 h-5 text-green-500" />
            <div className="flex-1">
              <p className="text-xs text-[var(--aurora-text-muted)]">WhatsApp</p>
              <p className="text-sm font-medium text-[var(--aurora-text-primary)]">
                {user.whatsappPhone}
              </p>
            </div>
          </div>

          {/* Profile Country */}
          <div className="flex items-center gap-3 p-3 bg-[var(--aurora-surface-elevated)] rounded-lg">
            <MapPin className="w-5 h-5 text-[var(--aurora-accent)]" />
            <div className="flex-1">
              <p className="text-xs text-[var(--aurora-text-muted)]">Profile Country</p>
              <p className="text-sm font-medium text-[var(--aurora-text-primary)]">
                {COUNTRY_FLAGS[user.whatsappCountryCode]} {COUNTRY_NAMES[user.whatsappCountryCode]}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Money Section */}
      <div className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl overflow-hidden mb-6">
        <div className="p-4 border-b border-[var(--aurora-border)]">
          <h3 className="font-semibold text-[var(--aurora-text-primary)]">
            Mobile Money
          </h3>
          <p className="text-xs text-[var(--aurora-text-muted)]">
            Your mobile money account for receiving payments
          </p>
        </div>

        {hasMomoSetup ? (
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[var(--aurora-accent)]/10 rounded-full flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-[var(--aurora-accent)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--aurora-text-primary)]">
                    {COUNTRY_FLAGS[user.momoCountryCode!]} {user.momoPhoneNumber}
                  </p>
                  <p className="text-xs text-[var(--aurora-text-muted)]">
                    {COUNTRY_MOMO_BRANDS[user.momoCountryCode!]} • {COUNTRY_NAMES[user.momoCountryCode!]}
                  </p>
                </div>
              </div>
              <Link href="/client-portal/momo-setup">
                <Button variant="secondary" size="sm">
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <Link href="/client-portal/momo-setup" className="block">
            <div className="p-4 flex items-center justify-between hover:bg-[var(--aurora-surface-elevated)] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[var(--aurora-accent)]/10 rounded-full flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-[var(--aurora-accent)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--aurora-text-primary)]">
                    Add Mobile Money Number
                  </p>
                  <p className="text-xs text-[var(--aurora-text-muted)]">
                    Set up your mobile money account to receive payments
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--aurora-text-muted)]" />
            </div>
          </Link>
        )}
      </div>

      {/* Info Note */}
      <div className="p-4 bg-blue-500/10 rounded-xl">
        <p className="text-sm text-[var(--aurora-text-primary)]">
          <strong>Note:</strong> Your mobile money country can be different from your WhatsApp/profile country.
          For example, you can have a US WhatsApp number but receive payments to a Rwanda MoMo account.
        </p>
      </div>
    </div>
  );
}
