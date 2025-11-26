'use client';

import { FluidShell } from '@/components/aurora-v2/layout';
import { CommandPalette } from '@/components/aurora-v2/command';
import { PageHeader } from '@/components/aurora-v2/PageHeader';
import { KpiCard } from '@/components/aurora-v2/KpiCard';
import { Card } from '@/components/aurora-v2/Card';
import { Button } from '@/components/aurora-v2/Button';
import { DataTable } from '@/components/aurora-v2/DataTable';
import { Users, DollarSign, TrendingUp, Activity } from 'lucide-react';

export default function FluidShellDemoPage() {
  // Sample KPI data
  const kpiData = [
    {
      title: 'Active Users',
      value: 12345,
      change: 12.5,
      trend: 'up' as const,
      changeLabel: 'vs last week',
      icon: <Users className="w-5 h-5" />,
    },
    {
      title: 'Revenue',
      value: '$45,231',
      change: 8.2,
      trend: 'up' as const,
      changeLabel: 'vs last week',
    },
    {
      title: 'Conversion',
      value: '24.8%',
      change: -3.1,
      trend: 'down' as const,
      changeLabel: 'vs last week',
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      title: 'Activity',
      value: 8420,
      change: 5.7,
      trend: 'up' as const,
      changeLabel: 'vs last week',
      icon: <Activity className="w-5 h-5" />,
    },
  ];

  // Sample table data
  const tableData = [
    { id: '1', name: 'John Doe', email: 'john@example.com', status: 'Active', role: 'Admin' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'Active', role: 'User' },
    { id: '3', name: 'Bob Johnson', email: 'bob@example.com', status: 'Pending', role: 'User' },
  ];

  const tableColumns = [
    {
      id: 'name',
      header: 'Name',
      cell: (row: any) => row.name,
    },
    {
      id: 'email',
      header: 'Email',
      cell: (row: any) => row.email,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row: any) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.status === 'Active'
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: (row: any) => row.role,
    },
  ];

  return (
    <FluidShell>
      {/* Command Palette */}
      <CommandPalette />

      {/* Page Header */}
      <PageHeader
        title="FluidShell Demo"
        description="Complete Aurora layout with collapsible sidebar, glass header, and command palette (⌘K)"
      />

      {/* Demo Instructions */}
      <div className="mb-8">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-aurora-text-primary mb-4">
              🎯 Try These Features
            </h3>
            <ul className="space-y-2 text-sm text-aurora-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-aurora-accent">•</span>
                <span>
                  <strong>Collapsible Sidebar:</strong> Hover over the left sidebar to expand it (desktop only)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-aurora-accent">•</span>
                <span>
                  <strong>Command Palette:</strong> Press <kbd className="px-2 py-1 text-xs bg-aurora-surface-muted rounded border border-aurora-border">⌘K</kbd> or <kbd className="px-2 py-1 text-xs bg-aurora-surface-muted rounded border border-aurora-border">Ctrl+K</kbd> to open global search
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-aurora-accent">•</span>
                <span>
                  <strong>Mobile View:</strong> Resize window to see bottom navigation and mobile menu
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-aurora-accent">•</span>
                <span>
                  <strong>Dark Mode:</strong> Click the moon/sun icon in the header
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-aurora-accent">•</span>
                <span>
                  <strong>Notifications:</strong> Click the bell icon (red dot indicator)
                </span>
              </li>
            </ul>
          </div>
        </Card>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpiData.map((kpi, index) => (
          <KpiCard key={index} {...kpi} />
        ))}
      </div>

      {/* Data Table */}
      <div className="mb-8">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-aurora-text-primary mb-4">
              Recent Users
            </h3>
            <DataTable
              data={tableData}
              columns={tableColumns}
              selectable
              searchable
            />
          </div>
        </Card>
      </div>

      {/* Component Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-aurora-text-primary mb-4">
              Glass Morphism
            </h3>
            <p className="text-sm text-aurora-text-secondary mb-4">
              Notice the glass effect on the header and sidebar with subtle backdrop blur.
            </p>
            <div className="glass-surface p-4 rounded-xl border border-aurora-border">
              <p className="text-sm text-aurora-text-secondary">
                This card demonstrates the glass morphism effect used throughout the Aurora design system.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-aurora-text-primary mb-4">
              Smooth Animations
            </h3>
            <p className="text-sm text-aurora-text-secondary mb-4">
              All interactions use spring-based animations for a natural feel.
            </p>
            <div className="space-y-2">
              <Button fullWidth>Hover me</Button>
              <Button variant="secondary" fullWidth>
                Click animations
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </FluidShell>
  );
}
