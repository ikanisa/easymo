'use client';

import { useState } from 'react';
import { Save, Printer, Bell, Lock, Globe, Palette, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'printers', label: 'Printers', icon: Printer },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'security', label: 'Security', icon: Lock },
  ];

  return (
    <div className="flex h-full bg-zinc-950">
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-800 bg-zinc-900/50 p-4">
        <h1 className="text-xl font-bold text-white mb-6">Settings</h1>
        <nav className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary text-black'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                )}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'general' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">General Settings</h2>
              <p className="text-sm text-zinc-400">Configure basic venue information</p>
            </div>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="text-white">Venue Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-zinc-400">Venue Name</label>
                  <Input defaultValue="EasyMO Bar & Restaurant" className="mt-1 bg-zinc-800 border-zinc-700" />
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-400">Address</label>
                  <Input defaultValue="KN 4 Ave, Kigali" className="mt-1 bg-zinc-800 border-zinc-700" />
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-400">Phone</label>
                  <Input defaultValue="+250788123456" className="mt-1 bg-zinc-800 border-zinc-700" />
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-400">Currency</label>
                  <select className="mt-1 w-full h-10 px-3 rounded-md border border-zinc-700 bg-zinc-800 text-white">
                    <option>RWF - Rwandan Franc</option>
                    <option>USD - US Dollar</option>
                  </select>
                </div>
              </CardContent>
            </Card>
            <Button className="bg-primary"><Save className="h-4 w-4 mr-2" />Save Changes</Button>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Notifications</h2>
              <p className="text-sm text-zinc-400">Manage notification preferences</p>
            </div>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="text-white">Sound Alerts</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'New Order', enabled: true },
                  { label: 'Order Ready', enabled: true },
                  { label: 'Low Stock Alert', enabled: false },
                  { label: 'Staff Clock In/Out', enabled: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-white">{item.label}</span>
                    <div className={cn('h-6 w-11 rounded-full transition-colors', item.enabled ? 'bg-primary' : 'bg-zinc-700')}>
                      <div className={cn('h-6 w-6 rounded-full bg-white transition-transform', item.enabled ? 'translate-x-5' : 'translate-x-0')} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'printers' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Printer Configuration</h2>
              <p className="text-sm text-zinc-400">Manage receipt and kitchen printers</p>
            </div>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="text-white">Connected Printers</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: 'Kitchen Printer', type: 'Kitchen Tickets', status: 'Online' },
                  { name: 'Receipt Printer', type: 'Customer Receipts', status: 'Online' },
                  { name: 'Bar Printer', type: 'Drink Orders', status: 'Offline' },
                ].map((printer) => (
                  <div key={printer.name} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/50 p-3">
                    <div>
                      <p className="font-medium text-white">{printer.name}</p>
                      <p className="text-sm text-zinc-400">{printer.type}</p>
                    </div>
                    <Badge className={printer.status === 'Online' ? 'bg-green-500' : 'bg-red-500'}>
                      {printer.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Appearance</h2>
              <p className="text-sm text-zinc-400">Customize the look and feel</p>
            </div>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="text-white">Theme</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {['Dark', 'Light'].map((theme) => (
                    <div key={theme} className={cn('rounded-lg border-2 p-4 cursor-pointer', theme === 'Dark' ? 'border-primary bg-primary/10' : 'border-zinc-700')}>
                      <div className={cn('h-20 rounded mb-2', theme === 'Dark' ? 'bg-zinc-950' : 'bg-white')} />
                      <p className="text-center font-medium text-white">{theme}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Security</h2>
              <p className="text-sm text-zinc-400">Manage access and permissions</p>
            </div>
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader><CardTitle className="text-white">Change Password</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-zinc-400">Current Password</label>
                  <Input type="password" className="mt-1 bg-zinc-800 border-zinc-700" />
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-400">New Password</label>
                  <Input type="password" className="mt-1 bg-zinc-800 border-zinc-700" />
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-400">Confirm Password</label>
                  <Input type="password" className="mt-1 bg-zinc-800 border-zinc-700" />
                </div>
                <Button className="bg-primary">Update Password</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
