"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Plus, 
  Download, 
  Filter, 
  Search,
  UserPlus,
  Mail,
  Phone,
  MapPin
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/data-display/DataTable";
import { Badge } from "@/components/data-display/Badge";
import { Spinner } from "@/components/feedback/Spinner";
import { type UsersQueryParams } from "@/lib/queries/users";
import { useUsersQuery } from "@/lib/queries/users";

interface AuroraUsersClientProps {
  initialParams: UsersQueryParams;
}

export function AuroraUsersClient({ initialParams }: AuroraUsersClientProps) {
  const [params, setParams] = useState<UsersQueryParams>(initialParams);
  const [search, setSearch] = useState("");
  const usersQuery = useUsersQuery(params);

  const users = usersQuery.data?.data || [];
  const isLoading = usersQuery.isLoading;

  // Filter users based on search
  const filteredUsers = users.filter(user => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      user.msisdn?.toLowerCase().includes(searchLower) ||
      user.displayName?.toLowerCase().includes(searchLower) ||
      user.id?.toLowerCase().includes(searchLower)
    );
  });

  const columns = [
    {
      id: 'user',
      header: 'User',
      accessor: (user: any) => user.displayName || 'Unknown',
      cell: (user: any) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-aurora-accent/10 
                          flex items-center justify-center text-aurora-accent font-semibold">
            {user.displayName?.[0]?.toUpperCase() || user.msisdn?.[0] || '?'}
          </div>
          <div>
            <p className="font-medium text-aurora-text-primary">
              {user.displayName || 'Unknown'}
            </p>
            <p className="text-sm text-aurora-text-muted">ID: {user.id?.slice(0, 8)}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Contact',
      accessor: (user: any) => user.msisdn,
      cell: (user: any) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-aurora-text-secondary">
            <Phone className="w-3.5 h-3.5" />
            {user.msisdn || 'N/A'}
          </div>
          {user.email && (
            <div className="flex items-center gap-2 text-sm text-aurora-text-muted">
              <Mail className="w-3.5 h-3.5" />
              {user.email}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'language',
      header: 'Language',
      accessor: (user: any) => user.locale,
      cell: (user: any) => (
        <Badge variant={user.locale === 'en' ? 'success' : 'default'}>
          {user.locale?.toUpperCase() || 'N/A'}
        </Badge>
      ),
    },
    {
      id: 'joined',
      header: 'Joined',
      accessor: (user: any) => user.createdAt,
      cell: (user: any) => (
        <span className="text-sm text-aurora-text-secondary">
          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      accessor: (user: any) => user.id,
      cell: (user: any) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost">
            View
          </Button>
          <Button size="sm" variant="ghost">
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Users"
        description={`${filteredUsers.length} total users`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" leftIcon={<Download className="w-4 h-4" />}>
              Export
            </Button>
            <Button leftIcon={<UserPlus className="w-4 h-4" />}>
              Add User
            </Button>
          </div>
        }
      />

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aurora-text-muted" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or ID..."
            className="pl-10"
          />
        </div>
        <Button variant="secondary" leftIcon={<Filter className="w-4 h-4" />}>
          Filters
        </Button>
      </div>

      {/* Users Table */}
      <DataTable
        data={filteredUsers}
        columns={columns}
        loading={isLoading}
        selectable
        emptyMessage={search ? 'No users match your search' : 'No users found. Get started by adding your first user.'}
      />
    </div>
  );
}
