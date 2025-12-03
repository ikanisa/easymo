"use client";

import Link from "next/link";
import {
  User,
  CreditCard,
  Moon,
  Bell,
  Globe,
  Info,
  FileText,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";

interface SettingsItem {
  icon: React.ReactNode;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  rightElement?: React.ReactNode;
}

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

export default function ClientSettingsPage() {
  const handleLogout = () => {
    // TODO: Implement logout
    console.log("Logout clicked");
  };

  const sections: SettingsSection[] = [
    {
      title: "Account",
      items: [
        {
          icon: <User className="w-5 h-5" />,
          label: "Profile",
          description: "View and edit your profile",
          href: "/client-portal/profile",
        },
        {
          icon: <CreditCard className="w-5 h-5" />,
          label: "Mobile Money Setup",
          description: "Configure your mobile money account",
          href: "/client-portal/momo-setup",
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          icon: <Moon className="w-5 h-5" />,
          label: "Theme",
          description: "Dark, Light, or System",
          href: "/client-portal/settings/theme",
        },
        {
          icon: <Globe className="w-5 h-5" />,
          label: "Language",
          description: "English",
          href: "/client-portal/settings/language",
        },
        {
          icon: <Bell className="w-5 h-5" />,
          label: "Notifications",
          description: "Manage notification preferences",
          href: "/client-portal/settings/notifications",
        },
      ],
    },
    {
      title: "About",
      items: [
        {
          icon: <Info className="w-5 h-5" />,
          label: "App Version",
          description: "1.0.0",
        },
        {
          icon: <FileText className="w-5 h-5" />,
          label: "Terms of Service",
          href: "/terms",
        },
        {
          icon: <Shield className="w-5 h-5" />,
          label: "Privacy Policy",
          href: "/privacy",
        },
        {
          icon: <HelpCircle className="w-5 h-5" />,
          label: "Contact Support",
          href: "/support",
        },
      ],
    },
  ];

  return (
    <div className="admin-page">
      <PageHeader
        title="Settings"
        description="Manage your account and preferences"
      />

      <div className="space-y-6">
        {sections.map((section) => (
          <div
            key={section.title}
            className="bg-[var(--aurora-surface)] border border-[var(--aurora-border)] rounded-xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[var(--aurora-border)]">
              <h3 className="text-sm font-semibold text-[var(--aurora-text-secondary)]">
                {section.title}
              </h3>
            </div>
            <div className="divide-y divide-[var(--aurora-border)]">
              {section.items.map((item) => {
                const content = (
                  <div className="flex items-center justify-between p-4 hover:bg-[var(--aurora-surface-elevated)] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="text-[var(--aurora-text-muted)]">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--aurora-text-primary)]">
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="text-xs text-[var(--aurora-text-muted)]">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {item.href && (
                      <ChevronRight className="w-5 h-5 text-[var(--aurora-text-muted)]" />
                    )}
                    {item.rightElement}
                  </div>
                );

                if (item.href) {
                  return (
                    <Link key={item.label} href={item.href}>
                      {content}
                    </Link>
                  );
                }

                if (item.onClick) {
                  return (
                    <button
                      key={item.label}
                      onClick={item.onClick}
                      className="w-full text-left"
                    >
                      {content}
                    </button>
                  );
                }

                return <div key={item.label}>{content}</div>;
              })}
            </div>
          </div>
        ))}

        {/* Logout Button */}
        <Button
          variant="secondary"
          onClick={handleLogout}
          className="w-full justify-center text-red-500 hover:bg-red-500/10"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}
