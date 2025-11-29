/**
 * Aurora Design System Showcase
 */

'use client';

import { DollarSign, Mail,MessageCircle, Search, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/data-display/Badge';
import { Card, CardContent,CardHeader, CardTitle } from '@/components/data-display/Card';
import { KpiCard } from '@/components/data-display/KpiCard';
import { Skeleton, SkeletonText } from '@/components/feedback/Skeleton';
import { Spinner } from '@/components/feedback/Spinner';
import { Modal, ModalFooter } from '@/components/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

export default function AuroraShowcasePage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--aurora-bg)] p-8">
      <div className="ambient-bg fixed inset-0 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-[var(--aurora-text-primary)] tracking-tight">
            Aurora Design System
          </h1>
          <p className="text-xl text-[var(--aurora-text-secondary)] max-w-2xl mx-auto">
            World-class UI components with fluid animations and responsive design
          </p>
        </div>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-[var(--aurora-text-primary)]">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="success">Success</Button>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-[var(--aurora-text-primary)]">KPI Cards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Active Users"
              value={12345}
              change={12.5}
              trend="up"
              changeLabel="vs last week"
              icon={<Users className="w-5 h-5" />}
            />
            <KpiCard
              title="Revenue"
              value="$45,231"
              change={8.2}
              trend="up"
              changeLabel="vs last week"
              icon={<DollarSign className="w-5 h-5" />}
            />
            <KpiCard
              title="Messages"
              value={5420}
              change={-3.1}
              trend="down"
              changeLabel="vs last week"
              icon={<MessageCircle className="w-5 h-5" />}
            />
            <KpiCard
              title="Conversion"
              value="24.8%"
              change={2.4}
              trend="up"
              changeLabel="vs last week"
              icon={<TrendingUp className="w-5 h-5" />}
            />
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-[var(--aurora-text-primary)]">Form Components</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Email" placeholder="you@example.com" leftIcon={<Mail className="w-4 h-4" />} />
            <Input label="Search" placeholder="Search..." leftIcon={<Search className="w-4 h-4" />} />
            <Input label="With Error" error="This field is required" />
            <Select
              label="Country"
              options={[
                { value: 'us', label: 'United States' },
                { value: 'uk', label: 'United Kingdom' },
                { value: 'ca', label: 'Canada' },
              ]}
            />
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-[var(--aurora-text-primary)]">Cards & Badges</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card hover>
              <CardHeader>
                <CardTitle>Card Component</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[var(--aurora-text-secondary)]">
                  Clean card with header and content sections.
                </p>
                <div className="flex gap-2 mt-4">
                  <Badge variant="success">Active</Badge>
                  <Badge variant="warning">Pending</Badge>
                  <Badge variant="error">Error</Badge>
                </div>
              </CardContent>
            </Card>

            <Card glass>
              <CardHeader>
                <CardTitle>Glass Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[var(--aurora-text-secondary)]">
                  Card with frosted glass effect.
                </p>
                <div className="flex gap-2 mt-4">
                  <Badge variant="accent" dot>Online</Badge>
                  <Badge variant="subtle">New</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-[var(--aurora-text-primary)]">Loading States</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Spinners</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Spinner size="sm" />
                  <Spinner size="md" />
                  <Spinner size="lg" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Skeleton</CardTitle>
              </CardHeader>
              <CardContent>
                <SkeletonText lines={3} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom Skeleton</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Skeleton variant="circular" width={48} height={48} />
                  <Skeleton variant="rectangular" height={20} />
                  <Skeleton variant="text" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-[var(--aurora-text-primary)]">Modal Dialog</h2>
          <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
          
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Example Modal"
            description="This is a beautiful animated modal with glass morphism"
            size="md"
          >
            <div className="space-y-4">
              <p className="text-[var(--aurora-text-secondary)]">
                The modal component features smooth animations, keyboard shortcuts (ESC to close),
                and proper focus management for accessibility.
              </p>
              <Input label="Your Name" placeholder="Enter your name" />
              <Input label="Email" type="email" placeholder="your@email.com" />
            </div>
            
            <ModalFooter>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Save Changes
              </Button>
            </ModalFooter>
          </Modal>
        </section>
      </div>
    </div>
  );
}
