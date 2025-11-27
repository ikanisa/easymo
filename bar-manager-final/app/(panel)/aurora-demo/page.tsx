/**
 * Aurora Complete Demo - All 22 Components
 */

'use client';

import { useState } from 'react';
import {
  Button, Card, CardContent, PageHeader,
  DataTable, Column, DropdownMenu, Breadcrumbs, Pagination,
  ThemeSwitcher, KpiCard, Badge,
} from '@/components';
import { MoreVertical, Edit, Trash, Users, DollarSign } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
}

const users: User[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'active' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'active' },
  { id: '3', name: 'Bob Johnson', email: 'bob@example.com', role: 'Manager', status: 'inactive' },
];

export default function AuroraDemoPage() {
  const [page, setPage] = useState(1);

  const columns: Column<User>[] = [
    { id: 'name', header: 'Name', accessor: 'name', sortable: true },
    { id: 'email', header: 'Email', accessor: 'email', sortable: true },
    { id: 'role', header: 'Role', accessor: 'role' },
    {
      id: 'status',
      header: 'Status',
      accessor: (row) => <Badge variant={row.status === 'active' ? 'success' : 'subtle'}>{row.status}</Badge>,
    },
    {
      id: 'actions',
      header: '',
      accessor: (row) => (
        <DropdownMenu
          trigger={<Button variant="ghost" size="sm" className="w-8 h-8 p-0"><MoreVertical className="w-4 h-4" /></Button>}
          items={[
            { id: 'edit', label: 'Edit', icon: <Edit className="w-4 h-4" /> },
            { id: 'delete', label: 'Delete', icon: <Trash className="w-4 h-4" />, danger: true },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--aurora-bg)] p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        <div className="flex justify-between items-center">
          <PageHeader title="Aurora Demo" description="22 components" />
          <ThemeSwitcher variant="dropdown" />
        </div>

        <Breadcrumbs items={[{ label: 'Components' }, { label: 'Demo' }]} />

        <div className="grid grid-cols-3 gap-4">
          <KpiCard title="Users" value={1234} change={12} trend="up" icon={<Users className="w-5 h-5" />} />
          <KpiCard title="Revenue" value="$45K" change={8} trend="up" icon={<DollarSign className="w-5 h-5" />} />
          <KpiCard title="Rate" value="24%" change={2} trend="up" icon={<Users className="w-5 h-5" />} />
        </div>

        <DataTable data={users} columns={columns} searchable selectable pageSize={2} />

        <Card>
          <CardContent>
            <Pagination currentPage={page} totalPages={5} onPageChange={setPage} />
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
