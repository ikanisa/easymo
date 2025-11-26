"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Save, 
  Bell,
  Shield,
  Palette,
  Globe,
  Key,
  Mail,
  Smartphone,
  Moon,
  Sun
} from "lucide-react";

import { Button } from "@/components-v2/primitives/Button";
import { Input } from "@/components-v2/primitives/Input";
import { Toggle } from "@/components-v2/primitives/Toggle";
import { Select } from "@/components-v2/primitives/Select";
import { PageHeader } from "@/components-v2/layout/PageHeader";
import { Card } from "@/components-v2/data-display/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components-v2/navigation/Tabs";

export function AuroraSettingsClient() {
  const [darkMode, setDarkMode] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [language, setLanguage] = useState('en');

  const handleSave = () => {
    // TODO: Implement save logic
    console.log('Saving settings...');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Settings"
        description="Manage your admin panel preferences and configurations"
        actions={
          <Button leftIcon={<Save className="w-4 h-4" />} onClick={handleSave}>
            Save Changes
          </Button>
        }
      />

      {/* Settings Tabs */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">
            <Palette className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Globe className="w-4 h-4 mr-2" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6 mt-6">
          <Card>
            <div className="p-6 border-b border-aurora-border">
              <h3 className="text-lg font-semibold text-aurora-text-primary">Appearance</h3>
              <p className="text-sm text-aurora-text-muted mt-1">
                Customize how the admin panel looks and feels
              </p>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {darkMode ? <Moon className="w-5 h-5 text-aurora-text-muted" /> : <Sun className="w-5 h-5 text-aurora-text-muted" />}
                  <div>
                    <p className="font-medium text-aurora-text-primary">Dark Mode</p>
                    <p className="text-sm text-aurora-text-muted">
                      Enable dark theme for reduced eye strain
                    </p>
                  </div>
                </div>
                <Toggle checked={darkMode} onChange={setDarkMode} />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-aurora-text-primary">
                  <Globe className="w-4 h-4" />
                  Language
                </label>
                <Select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'fr', label: 'Français' },
                    { value: 'rw', label: 'Kinyarwanda' },
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-6 border-b border-aurora-border">
              <h3 className="text-lg font-semibold text-aurora-text-primary">Regional Settings</h3>
              <p className="text-sm text-aurora-text-muted mt-1">
                Configure timezone and date formats
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-aurora-text-primary">Timezone</label>
                <Select
                  value="Africa/Kigali"
                  options={[
                    { value: 'Africa/Kigali', label: 'Africa/Kigali (CAT)' },
                    { value: 'Africa/Nairobi', label: 'Africa/Nairobi (EAT)' },
                    { value: 'UTC', label: 'UTC' },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-aurora-text-primary">Date Format</label>
                <Select
                  value="DD/MM/YYYY"
                  options={[
                    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                  ]}
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Notifications Settings */}
        <TabsContent value="notifications" className="space-y-6 mt-6">
          <Card>
            <div className="p-6 border-b border-aurora-border">
              <h3 className="text-lg font-semibold text-aurora-text-primary">Notification Preferences</h3>
              <p className="text-sm text-aurora-text-muted mt-1">
                Choose how you want to be notified about important events
              </p>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-aurora-text-muted" />
                  <div>
                    <p className="font-medium text-aurora-text-primary">Email Notifications</p>
                    <p className="text-sm text-aurora-text-muted">
                      Receive email alerts for system events
                    </p>
                  </div>
                </div>
                <Toggle checked={emailNotifications} onChange={setEmailNotifications} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-aurora-text-muted" />
                  <div>
                    <p className="font-medium text-aurora-text-primary">SMS Notifications</p>
                    <p className="text-sm text-aurora-text-muted">
                      Get SMS alerts for critical issues
                    </p>
                  </div>
                </div>
                <Toggle checked={smsNotifications} onChange={setSmsNotifications} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-aurora-text-muted" />
                  <div>
                    <p className="font-medium text-aurora-text-primary">Push Notifications</p>
                    <p className="text-sm text-aurora-text-muted">
                      Browser push notifications
                    </p>
                  </div>
                </div>
                <Toggle checked={true} onChange={() => {}} />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6 mt-6">
          <Card>
            <div className="p-6 border-b border-aurora-border">
              <h3 className="text-lg font-semibold text-aurora-text-primary">Security & Privacy</h3>
              <p className="text-sm text-aurora-text-muted mt-1">
                Manage your account security settings
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-aurora-text-primary">Current Password</label>
                <Input type="password" placeholder="Enter current password" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-aurora-text-primary">New Password</label>
                <Input type="password" placeholder="Enter new password" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-aurora-text-primary">Confirm Password</label>
                <Input type="password" placeholder="Confirm new password" />
              </div>

              <Button variant="primary" className="mt-4" leftIcon={<Key className="w-4 h-4" />}>
                Update Password
              </Button>
            </div>
          </Card>

          <Card>
            <div className="p-6 border-b border-aurora-border">
              <h3 className="text-lg font-semibold text-aurora-text-primary">Two-Factor Authentication</h3>
              <p className="text-sm text-aurora-text-muted mt-1">
                Add an extra layer of security to your account
              </p>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-aurora-text-primary">Enable 2FA</p>
                  <p className="text-sm text-aurora-text-muted mt-1">
                    Require a verification code in addition to your password
                  </p>
                </div>
                <Toggle checked={false} onChange={() => {}} />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Integrations Settings */}
        <TabsContent value="integrations" className="space-y-6 mt-6">
          <Card>
            <div className="p-6 border-b border-aurora-border">
              <h3 className="text-lg font-semibold text-aurora-text-primary">API & Webhooks</h3>
              <p className="text-sm text-aurora-text-muted mt-1">
                Manage API keys and webhook configurations
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-aurora-text-primary">API Key</label>
                <div className="flex gap-2">
                  <Input 
                    type="password" 
                    value="sk_live_••••••••••••••••" 
                    readOnly 
                    className="flex-1"
                  />
                  <Button variant="secondary">Regenerate</Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-aurora-text-primary">Webhook URL</label>
                <Input 
                  type="url" 
                  placeholder="https://your-app.com/webhooks/easymo"
                />
              </div>

              <Button variant="primary" className="mt-4">
                Save Integration Settings
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
