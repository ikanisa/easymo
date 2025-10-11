import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { TokensApi } from "@/lib/tokensApi";
import { shouldUseMock } from "@/lib/env";
import { FileBarChart, Download, Filter, RefreshCw } from "lucide-react";
import type { Transaction, Shop, Wallet } from "@/lib/types";

export default function TokensReports() {
  const isMock = shouldUseMock();
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    shopId: "",
    walletId: "",
  });

  // Fetch shops for filter dropdown
  const { data: shops = [] } = useQuery<Shop[]>({
    queryKey: ["shops"],
    queryFn: TokensApi.listShops,
    enabled: isMock,
  });

  // Fetch wallets for filter dropdown (just get first page)
  const { data: wallets = [] } = useQuery<Wallet[]>({
    queryKey: ["wallets-for-filter"],
    queryFn: () => TokensApi.listWallets({ limit: 100 }),
    enabled: isMock,
  });

  // Fetch transactions based on filters
  const { data: transactions = [], isLoading, refetch } = useQuery<Transaction[]>({
    queryKey: ["reports-transactions", filters],
    queryFn: () =>
      TokensApi.listTx({
        wallet_id: filters.walletId || undefined,
        merchant_id: filters.shopId || undefined,
        from: filters.startDate || undefined,
        to: filters.endDate || undefined,
        limit: 1000, // Get more for reports
      }),
    enabled: isMock,
  });

  // Calculate totals
  const totals = transactions.reduce(
    (acc, tx) => {
      if (tx.type === 'spend') {
        acc.totalSpend += tx.amount;
        acc.spendCount += 1;
      } else if (tx.type === 'issue') {
        acc.totalIssued += tx.amount;
        acc.issueCount += 1;
      }
      acc.totalTransactions += 1;
      return acc;
    },
    {
      totalSpend: 0,
      totalIssued: 0,
      spendCount: 0,
      issueCount: 0,
      totalTransactions: 0,
    }
  );

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      shopId: "",
      walletId: "",
    });
  };

  const exportCSV = () => {
    if (transactions.length === 0) {
      toast({
        title: "No Data",
        description: "No transactions to export",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = ["ID", "Type", "Amount", "Wallet ID", "Shop", "Created At"];
    const csvContent = [
      headers.join(","),
      ...transactions.map((tx) =>
        [
          tx.id,
          tx.type,
          tx.amount,
          tx.wallet_id || "",
          tx.shops ? `"${tx.shops.name} (${tx.shops.short_code})"` : "",
          tx.created_at,
        ].join(",")
      ),
    ].join("\n");

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Exported ${transactions.length} transactions`,
    });
  };

  const getTransactionTypeBadge = (type: string) => {
    const variants = {
      issue: "default",
      spend: "secondary",
      reversal: "destructive",
      settlement: "outline",
    } as const;
    
    return (
      <Badge variant={variants[type as keyof typeof variants] || "outline"}>
        {type}
      </Badge>
    );
  };

  if (!isMock) {
    return (
      <AdminLayout>
        <Card>
          <CardHeader>
            <CardTitle>Tokens module unavailable</CardTitle>
            <CardDescription>
              Token analytics are not yet available when connected to the live Supabase backend.
            </CardDescription>
          </CardHeader>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Reports"
            description="Transaction reports and analytics"
          />
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Filter className="h-5 w-5 mr-2 inline" />
              Filters
            </CardTitle>
            <CardDescription>Filter transactions by date range, shop, or wallet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Shop</Label>
                <Select value={filters.shopId} onValueChange={(value) => handleFilterChange("shopId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All shops" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All shops</SelectItem>
                    {shops.map((shop) => (
                      <SelectItem key={shop.id} value={shop.id}>
                        {shop.name} ({shop.short_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Wallet</Label>
                <Select value={filters.walletId} onValueChange={(value) => handleFilterChange("walletId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All wallets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All wallets</SelectItem>
                    {wallets.map((wallet) => (
                      <SelectItem key={wallet.id} value={wallet.id}>
                        {wallet.user_code} ({wallet.whatsapp})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
              <Button onClick={exportCSV} disabled={transactions.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.totalTransactions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Issued</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {totals.totalIssued.toLocaleString()} RWF
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totals.issueCount} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {totals.totalSpend.toLocaleString()} RWF
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totals.spendCount} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Net Position</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                (totals.totalIssued - totals.totalSpend) >= 0 ? 'text-success' : 'text-destructive'
              }`}>
                {(totals.totalIssued - totals.totalSpend).toLocaleString()} RWF
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transactions ({transactions.length})</CardTitle>
            <CardDescription>
              {Object.values(filters).some(v => v) 
                ? "Filtered transactions matching your criteria"
                : "All transactions"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileBarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No transactions match your filters.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 pb-2 border-b text-sm font-medium text-muted-foreground">
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Amount</div>
                  <div className="col-span-2">Wallet</div>
                  <div className="col-span-3">Shop</div>
                  <div className="col-span-3">Date</div>
                </div>

                {/* Rows */}
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="grid grid-cols-12 gap-4 py-3 border-b hover:bg-muted/50"
                  >
                    <div className="col-span-2">
                      {getTransactionTypeBadge(tx.type)}
                    </div>
                    <div className={`col-span-2 font-mono text-sm ${
                      tx.type === 'spend' ? 'text-destructive' : 'text-success'
                    }`}>
                      {tx.type === 'spend' ? '-' : '+'}
                      {tx.amount.toLocaleString()} RWF
                    </div>
                    <div className="col-span-2 text-sm font-mono">
                      {tx.wallet_id ? tx.wallet_id.slice(0, 8) + "..." : "-"}
                    </div>
                    <div className="col-span-3 text-sm">
                      {tx.shops 
                        ? `${tx.shops.name} (${tx.shops.short_code})`
                        : "-"
                      }
                    </div>
                    <div className="col-span-3 text-sm text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
