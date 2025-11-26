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

import { Button } from "@/components-v2/primitives/Button";
import { Input } from "@/components-v2/primitives/Input";
import { PageHeader } from "@/components-v2/layout/PageHeader";
import { DataTable } from "@/components-v2/data-display/DataTable";
import { Badge } from "@/components-v2/data-display/Badge";
import { Spinner } from "@/components-v2/feedback/Spinner";
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
      user.phone_number?.toLowerCase().includes(searchLower) ||
      user.whatsapp_name?.toLowerCase().includes(searchLower) ||
      user.id?.toLowerCase().includes(searchLower)
    );
  });

  const columns = [
    {
      id: 'user',
      header: 'User',
      cell: (user: any) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-aurora-accent/10 
                          flex items-center justify-center text-aurora-accent font-semibold">
            {user.whatsapp_name?.[0]?.toUpperCase() || user.phone_number?.[0] || '?'}
          </div>
          <div>
            <p className="font-medium text-aurora-text-primary">
              {user.whatsapp_name || 'Unknown'}
            </p>
            <p className="text-sm text-aurora-text-muted">ID: {user.id?.slice(0, 8)}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Contact',
      cell: (user: any) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-aurora-text-secondary">
            <Phone className="w-3.5 h-3.5" />
            {user.phone_number || 'N/A'}
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
      cell: (user: any) => (
        <Badge variant={user.preferred_language === 'en' ? 'success' : 'default'}>
          {user.preferred_language?.toUpperCase() || 'N/A'}
        </Badge>
      ),
    },
    {
      id: 'joined',
      header: 'Joined',
      cell: (user: any) => (
        <span className="text-sm text-aurora-text-secondary">
          {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
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
        emptyState={
          <div className="text-center py-12">
            <UserPlus className="w-12 h-12 text-aurora-text-muted mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-aurora-text-primary">No users found</h3>
            <p className="text-sm text-aurora-text-muted mt-1">
              {search ? 'Try a different search term' : 'Get started by adding your first user'}
            </p>
            {!search && (
              <Button className="mt-4" leftIcon={<Plus className="w-4 h-4" />}>
                Add User
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
}
