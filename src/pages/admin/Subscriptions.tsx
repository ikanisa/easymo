import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/ui/data-table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CreditCard, Copy, Check, X, MessageCircle, Calendar, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatsCards } from "@/components/admin/StatsCards";
import { ADAPTER } from "@/lib/adapter";
import { useToast } from "@/hooks/use-toast";
import { formatUserRefCode } from "@/lib/utils";
import type { Subscription } from "@/lib/types";

export default function SubscriptionsAdmin() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function load() {
    try {
      setLoading(true);
      const data = await ADAPTER.getSubscriptions();
      setSubscriptions(data);
    } catch (error) {
      console.error("Failed to load subscriptions:", error);
      toast({
        title: "Error",
        description: "Failed to load subscriptions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: number) {
    try {
      await ADAPTER.approveSubscription(id);
      await load(); // Refresh data
      toast({
        title: "Success",
        description: "Subscription approved successfully",
      });
    } catch (error) {
      console.error("Failed to approve subscription:", error);
      toast({
        title: "Error", 
        description: "Failed to approve subscription",
        variant: "destructive",
      });
    }
  }

  async function reject(id: number) {
    try {
      await ADAPTER.rejectSubscription(id);
      await load(); // Refresh data
      toast({
        title: "Success",
        description: "Subscription rejected successfully",
      });
    } catch (error) {
      console.error("Failed to reject subscription:", error);
      toast({
        title: "Error",
        description: "Failed to reject subscription", 
        variant: "destructive",
      });
    }
  }

  async function copyToClipboard(text: string, description: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${description} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/10 text-success border-success/20">Active</Badge>;
      case "pending_review":
        return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Rejected</Badge>;
      case "expired":
        return <Badge variant="outline">Expired</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const columns: Column<Subscription>[] = [
    {
      id: "user_ref_code",
      header: "User",
      accessorKey: "user_ref_code",
      cell: (subscription) => (
        <span className="font-medium font-mono">{formatUserRefCode(subscription.user_ref_code)}</span>
      ),
      sortable: true,
      filterable: true,
      searchWeight: 3,
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: (subscription) => getStatusBadge(subscription.status),
      filterable: true,
      filterType: "select",
      filterOptions: [
        { value: "active", label: "Active" },
        { value: "pending_review", label: "Pending Review" },
        { value: "rejected", label: "Rejected" },
        { value: "expired", label: "Expired" },
      ],
      searchWeight: 2,
    },
    {
      id: "amount",
      header: "Amount",
      accessorKey: "amount",
      cell: (subscription) => (
        <span>{subscription.amount?.toLocaleString()}</span>
      ),
      sortable: true,
      filterable: true,
      searchWeight: 1,
    },
    {
      id: "txn_id",
      header: "Transaction ID",
      accessorKey: "txn_id",
      cell: (subscription) => (
        <span className="font-mono text-sm">{subscription.txn_id || "-"}</span>
      ),
      sortable: true,
      filterable: true,
      searchWeight: 2,
    },
    {
      id: "created_at",
      header: "Created",
      accessorKey: "created_at",
      cell: (subscription) => (
        <div className="flex items-center space-x-1 text-sm">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">{formatDate(subscription.created_at)}</span>
        </div>
      ),
      sortable: true,
      filterable: true,
      searchWeight: 1,
    },
    {
      id: "expires_at",
      header: "Expires",
      accessorKey: "expires_at",
      cell: (subscription) => (
        subscription.expires_at ? (
          <div className="flex items-center space-x-1 text-sm">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{formatDate(subscription.expires_at)}</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )
      ),
      sortable: true,
      filterable: true,
      searchWeight: 1,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (subscription) => (
        <div className="flex space-x-2">
          {subscription.status === "pending_review" && (
            <>
              <Button
                size="sm"
                onClick={() => approve(subscription.id)}
              >
                <Check className="h-3 w-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => reject(subscription.id)}
              >
                <X className="h-3 w-3 mr-1" />
                Reject
              </Button>
            </>
          )}
          {/* Command copy removed for Phase-1 simplification */}
        </div>
      ),
      searchable: false,
    },
  ];

  useEffect(() => { 
    load(); 
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Subscriptions"
          description="Manage driver subscription payments"
        />
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Manage driver subscription payments"
        action={{
          label: "Refresh",
          onClick: load,
          variant: "outline",
        }}
      />

      <StatsCards subscriptions={subscriptions} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Subscription Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TooltipProvider>
            <DataTable
              data={subscriptions}
              columns={columns}
              searchPlaceholder="Search subscriptions by user, transaction ID, status..."
              emptyMessage="No subscriptions found"
              enableGlobalSearch={true}
              enableFilters={true}
            />
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  );
}