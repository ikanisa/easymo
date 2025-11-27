/**
 * Aurora Components Demo - Complete Showcase
 */

'use client';

import { useState } from 'react';
import {
  Button,
  Input,
  Select,
  Textarea,
  Toggle,
  Checkbox,
  Card,
  CardTitle,
  CardContent,
  Badge,
  KpiCard,
  Modal,
  ModalFooter,
  Tooltip,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Spinner,
  SkeletonText,
  useToast,
  PageHeader,
} from '@/components';
import { Mail, Settings, Home, Users, DollarSign, MessageCircle, TrendingUp } from 'lucide-react';

const COUNTRY_OPTIONS = [
  { value: 'RW', label: 'Rwanda' },
  { value: 'CD', label: 'Democratic Republic of Congo' },
  { value: 'BI', label: 'Burundi' },
  { value: 'TZ', label: 'Tanzania' },
];

export default function ComponentsDemoPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [toggleChecked, setToggleChecked] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const { addToast } = useToast();

  return (
    <div className="min-h-screen bg-[var(--aurora-bg)] p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        <PageHeader
          title="Aurora Components Demo"
          description="All 16 components in action"
          actions={<div className="flex gap-2"><Button variant="secondary">Export</Button><Button>Save</Button></div>}
        />

        <section>
          <h2 className="text-2xl font-bold mb-4">KPI Cards</h2>
          <div className="grid grid-cols-4 gap-4">
            <KpiCard title="Users" value={12345} change={12.5} trend="up" icon={<Users className="w-5 h-5" />} />
            <KpiCard title="Revenue" value="$45K" change={8.2} trend="up" icon={<DollarSign className="w-5 h-5" />} />
            <KpiCard title="Messages" value={5420} change={-3.1} trend="down" icon={<MessageCircle className="w-5 h-5" />} />
            <KpiCard title="Rate" value="24.8%" change={2.4} trend="up" icon={<TrendingUp className="w-5 h-5" />} />
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">Forms</h2>
          <div className="grid grid-cols-2 gap-6">
            <Input label="Email" placeholder="you@example.com" leftIcon={<Mail className="w-4 h-4" />} />
            <Select label="Country" options={COUNTRY_OPTIONS} />
            <Textarea label="Message" rows={3} />
            <div className="space-y-4">
              <Toggle checked={toggleChecked} onChange={setToggleChecked} label="Notifications" />
              <Checkbox checked={checkboxChecked} onChange={setCheckboxChecked} label="I agree" />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">Buttons & Badges</h2>
          <Card>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                  <Button loading>Loading</Button>
                </div>
                <div className="flex gap-2">
                  <Badge variant="success" dot>Active</Badge>
                  <Badge variant="warning">Pending</Badge>
                  <Badge variant="error">Error</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">Tabs</h2>
          <Tabs defaultValue="1">
            <TabsList>
              <TabsTrigger value="1"><Home className="w-4 h-4 mr-2" />Home</TabsTrigger>
              <TabsTrigger value="2"><Settings className="w-4 h-4 mr-2" />Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="1">
              <Card><CardContent>Home</CardContent></Card>
            </TabsContent>
            <TabsContent value="2">
              <Card><CardContent>Settings</CardContent></Card>
            </TabsContent>
          </Tabs>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">Interactions</h2>
          <div className="flex gap-4">
            <Tooltip content="Tooltip"><Button variant="secondary">Hover</Button></Tooltip>
            <Button onClick={() => setModalOpen(true)}>Modal</Button>
            <Button onClick={() => addToast({ type: 'success', title: 'Success!' })} variant="success">Toast</Button>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">Loading</h2>
          <div className="grid grid-cols-3 gap-4">
            <Card><CardTitle>Spinners</CardTitle><div className="flex gap-4 p-4"><Spinner size="sm" /><Spinner /></div></Card>
            <Card><CardTitle>Skeleton</CardTitle><div className="p-4"><SkeletonText lines={3} /></div></Card>
          </div>
        </section>

        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Demo Modal">
          <Input label="Name" />
          <ModalFooter>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => setModalOpen(false)}>OK</Button>
          </ModalFooter>
        </Modal>

      </div>
    </div>
  );
}
