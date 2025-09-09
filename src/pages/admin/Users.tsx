import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, Column } from "@/components/ui/data-table";
import { Users, MessageCircle, Calendar, Coins } from "lucide-react";
import { AdminAPI } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { formatUserRefCode } from "@/lib/utils";
import type { User } from "@/lib/types";

export default function UsersAdmin() {
  const { 
    data: users = [], 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['admin-users'],
    queryFn: AdminAPI.getUsers,
    select: (data) => 
      [...data].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
  });

  const columns: Column<User>[] = [
    {
      id: "ref_code",
      header: "Ref Code",
      accessorKey: "ref_code",
      cell: (user) => (
        <span className="font-mono font-medium">{formatUserRefCode(user.ref_code)}</span>
      ),
      sortable: true,
      filterable: true,
      searchWeight: 3,
    },
    {
      id: "whatsapp_e164",
      header: "WhatsApp Number",
      accessorKey: "whatsapp_e164",
      cell: (user) => (
        <div className="flex items-center space-x-2">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono">{user.whatsapp_e164}</span>
        </div>
      ),
      sortable: true,
      filterable: true,
      searchWeight: 3,
    },
    {
      id: "credits_balance",
      header: "Credits",
      accessorKey: "credits_balance",
      cell: (user) => (
        <div className="flex items-center space-x-2">
          <Coins className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono">{user.credits_balance}</span>
        </div>
      ),
      sortable: true,
      filterable: true,
      searchWeight: 1,
    },
    {
      id: "subscription_status",
      header: "Subscription",
      accessorKey: "subscription_status",
      cell: (user) => (
        <span className={`text-sm px-2 py-1 rounded-md ${
          user.subscription_status === 'active' 
            ? 'bg-success/10 text-success' 
            : user.subscription_status === 'expired'
            ? 'bg-muted/10 text-muted-foreground'
            : 'bg-warning/10 text-warning'
        }`}>
          {user.subscription_status === 'none' ? 'No Sub' : user.subscription_status}
        </span>
      ),
      filterable: true,
      filterType: "select",
      filterOptions: [
        { value: "active", label: "Active" },
        { value: "expired", label: "Expired" },
        { value: "none", label: "No Subscription" },
      ],
      searchWeight: 2,
    },
    {
      id: "created_at",
      header: "Joined",
      accessorKey: "created_at",
      cell: (user) => (
        <div className="flex items-center space-x-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{timeAgo(user.created_at)}</span>
        </div>
      ),
      sortable: true,
      filterable: true,
      searchWeight: 1,
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Users" description="Manage platform users and their activity" />
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-16 bg-muted rounded"></div>
                  <div className="h-5 w-12 bg-muted rounded"></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-3 w-24 bg-muted rounded"></div>
                <div className="h-3 w-20 bg-muted rounded"></div>
                <div className="h-3 w-16 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Users" description="WhatsApp platform users (most recent first)" />
        <Card className="px-4 py-2">
          <div className="flex items-center space-x-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{users.length}</span>
            <span className="text-muted-foreground">Total Users</span>
          </div>
        </Card>
      </div>

      <DataTable
        data={users}
        columns={columns}
        searchPlaceholder="Search users by ref code, phone number..."
        emptyMessage="No users found"
        enableGlobalSearch={true}
        enableFilters={true}
      />
    </div>
  );
}