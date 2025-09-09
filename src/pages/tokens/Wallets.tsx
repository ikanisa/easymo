import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TokensApi } from "@/lib/tokensApi";
import { Wallet2, Search, Plus, ChevronLeft, ChevronRight, Loader2, Eye } from "lucide-react";
import type { Wallet, WalletBalance } from "@/lib/types";

export default function TokensWallets() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(0);
  const navigate = useNavigate();
  
  const pageSize = 20;

  // Fetch wallets
  const { data: wallets = [], isLoading } = useQuery<Wallet[]>({
    queryKey: ["wallets", search, statusFilter, currentPage],
    queryFn: () =>
      TokensApi.listWallets({
        q: search,
        status: statusFilter,
        limit: pageSize,
        offset: currentPage * pageSize,
      }),
  });

  // Fetch balances for current page
  const walletIds = wallets.map((w) => w.id);
  const { data: balances = {} } = useQuery<Record<string, number>>({
    queryKey: ["wallet-balances", walletIds],
    queryFn: () => TokensApi.getBatchBalances(walletIds),
    enabled: walletIds.length > 0,
  });

  // Filter wallets client-side for search
  const filteredWallets = wallets.filter((wallet) => {
    if (!search) return true;
    return (
      wallet.user_code.toLowerCase().includes(search.toLowerCase()) ||
      wallet.whatsapp.includes(search)
    );
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      active: "default",
      frozen: "secondary", 
      expired: "destructive",
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status}
      </Badge>
    );
  };

  const formatBalance = (walletId: string) => {
    const balance = balances[walletId];
    if (balance === undefined) {
      return <Skeleton className="h-4 w-16" />;
    }
    return <span className="font-mono">{balance.toLocaleString()} RWF</span>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Wallets"
            description="Manage user wallets and balances"
          />
          <Button asChild>
            <Link to="/tokens/issue">
              <Plus className="h-4 w-4 mr-2" />
              Issue Tokens
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filter Wallets</CardTitle>
            <CardDescription>Search by user code or WhatsApp number</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search user code or WhatsApp..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="frozen">Frozen</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Wallets Table */}
        <Card>
          <CardHeader>
            <CardTitle>Wallets ({filteredWallets.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            ) : filteredWallets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No wallets match your filters.</p>
                <Button variant="outline" onClick={() => window.location.reload()} className="mt-2">
                  Refresh
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-12 gap-4 pb-2 border-b text-sm font-medium text-muted-foreground">
                  <div className="col-span-2">User Code</div>
                  <div className="col-span-3">WhatsApp</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Balance</div>
                  <div className="col-span-2">Created</div>
                  <div className="col-span-1">Actions</div>
                </div>

                {/* Rows */}
                {filteredWallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className="grid grid-cols-12 gap-4 py-3 border-b hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/tokens/wallets/${wallet.id}`)}
                  >
                    <div className="col-span-2 font-mono text-sm">
                      {wallet.user_code}
                    </div>
                    <div className="col-span-3 text-sm">
                      {wallet.whatsapp}
                    </div>
                    <div className="col-span-2">
                      {getStatusBadge(wallet.status)}
                    </div>
                    <div className="col-span-2 text-sm">
                      {formatBalance(wallet.id)}
                    </div>
                    <div className="col-span-2 text-sm text-muted-foreground">
                      {new Date(wallet.created_at).toLocaleDateString()}
                    </div>
                    <div className="col-span-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/tokens/wallets/${wallet.id}`);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {filteredWallets.length === pageSize && (
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage + 1}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={filteredWallets.length < pageSize}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}