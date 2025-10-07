import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { TokensApi } from "@/lib/tokensApi";
import { shouldUseMock } from "@/lib/env";
import { Wallet2, ArrowLeft, Plus, Copy, ExternalLink, Snowflake, RotateCcw, Activity, Store } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { Wallet, Transaction, Shop } from "@/lib/types";

export default function TokensWalletDetail() {
  const { id } = useParams<{ id: string }>();
  const walletId = id ?? '';
  const isMock = shouldUseMock();

  // Fetch wallet details
  const { data: wallet, isLoading: walletLoading } = useQuery<Wallet>({
    queryKey: ["wallet", walletId],
    queryFn: () => TokensApi.getWallet(walletId),
    enabled: isMock && Boolean(id),
  });

  // Fetch wallet balance
  const { data: balance = 0, isLoading: balanceLoading } = useQuery<number>({
    queryKey: ["wallet-balance", walletId],
    queryFn: () => TokensApi.getBalance(walletId),
    enabled: isMock && Boolean(id),
  });

  // Fetch transactions
  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["wallet-transactions", walletId],
    queryFn: () => TokensApi.listTx({ wallet_id: walletId, limit: 50 }),
    enabled: isMock && Boolean(id),
  });

  // Fetch shops for allowed shops display
  const { data: shops = [] } = useQuery<Shop[]>({
    queryKey: ["shops"],
    queryFn: TokensApi.listShops,
    enabled: isMock,
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

  const copyWalletId = () => {
    if (!walletId) return;
    navigator.clipboard.writeText(walletId);
    toast({
      title: "Copied",
      description: "Wallet ID copied to clipboard",
    });
  };

  const allowedShops = wallet?.allowed_shop_ids 
    ? shops.filter(shop => wallet.allowed_shop_ids?.includes(shop.id))
    : [];

  if (!isMock) {
    return (
      <AdminLayout>
        <Card>
          <CardHeader>
            <CardTitle>Tokens module unavailable</CardTitle>
            <CardDescription>
              Wallet details are only accessible in the mock testing environment.
            </CardDescription>
          </CardHeader>
        </Card>
      </AdminLayout>
    );
  }

  if (!id) {
    return (
      <AdminLayout>
        <div className="text-center py-8">
          <Wallet2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Wallet ID not found</p>
          <Button variant="outline" asChild className="mt-2">
            <Link to="/tokens/wallets">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Wallets
            </Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  if (walletLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Skeleton className="h-96 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!wallet) {
    return (
      <AdminLayout>
        <div className="text-center py-8">
          <Wallet2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Wallet not found</p>
          <Button variant="outline" asChild className="mt-2">
            <Link to="/tokens/wallets">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Wallets
            </Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title={wallet.user_code}
            description={`User ${wallet.user_code} • ${wallet.whatsapp}`}
          />
          <Button variant="outline" asChild>
            <Link to="/tokens/wallets">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Wallets
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Wallet Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-3xl">
                      {balanceLoading ? (
                        <Skeleton className="h-8 w-32" />
                      ) : (
                        <span className="font-mono">{balance.toLocaleString()} RWF</span>
                      )}
                    </CardTitle>
                    <CardDescription>Balance</CardDescription>
                  </div>
                  <div className="text-right space-y-2">
                    {getStatusBadge(wallet.status)}
                    <div className="text-sm text-muted-foreground">
                      Created {new Date(wallet.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    asChild
                    disabled
                    className="tooltip"
                    title="Backend endpoint required"
                  >
                    <Link to={`/tokens/issue?prefill=${wallet.id}`}>
                      <Plus className="h-4 w-4 mr-2" />
                      Top-up
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    disabled
                    title="Backend endpoint required"
                  >
                    <Snowflake className="h-4 w-4 mr-2" />
                    Freeze/Unfreeze
                  </Button>
                  <Button
                    variant="outline"
                    disabled
                    title="Backend endpoint required"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Rotate QR
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="activity">
              <TabsList>
                <TabsTrigger value="activity">
                  <Activity className="h-4 w-4 mr-2" />
                  Activity
                </TabsTrigger>
                {!wallet.allow_any_shop && (
                  <TabsTrigger value="shops">
                    <Store className="h-4 w-4 mr-2" />
                    Allowed Shops
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="activity">
                <Card>
                  <CardHeader>
                    <CardTitle>Transaction History</CardTitle>
                    <CardDescription>Last 50 transactions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {txLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex items-center space-x-4">
                            <Skeleton className="h-6 w-16" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                        ))}
                      </div>
                    ) : transactions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No transactions yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {transactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between py-3 border-b last:border-0"
                          >
                            <div className="flex items-center space-x-3">
                              {getTransactionTypeBadge(tx.type)}
                              <div>
                                <div className="font-medium">
                                  {tx.type === 'spend' && tx.shops
                                    ? `${tx.shops.name} (${tx.shops.short_code})`
                                    : tx.type}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {new Date(tx.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`font-mono ${
                                tx.type === 'spend' ? 'text-destructive' : 'text-success'
                              }`}>
                                {tx.type === 'spend' ? '-' : '+'}
                                {tx.amount.toLocaleString()} RWF
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {!wallet.allow_any_shop && (
                <TabsContent value="shops">
                  <Card>
                    <CardHeader>
                      <CardTitle>Allowed Shops</CardTitle>
                      <CardDescription>
                        This wallet can only be used at the following shops
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {allowedShops.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No allowed shops configured</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {allowedShops.map((shop) => (
                            <div
                              key={shop.id}
                              className="flex items-center justify-between py-3 border-b last:border-0"
                            >
                              <div>
                                <div className="font-medium">{shop.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  {shop.short_code}
                                </div>
                              </div>
                              <Badge variant={shop.is_active ? "default" : "secondary"}>
                                {shop.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Right Rail */}
          <div className="space-y-6">
            {/* Wallet Info */}
            <Card>
              <CardHeader>
                <CardTitle>Wallet Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Wallet ID</div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1">
                      {id}
                    </code>
                    <Button variant="ghost" size="sm" onClick={copyWalletId}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="text-sm font-medium text-muted-foreground">User Code</div>
                  <div className="font-mono mt-1">{wallet.user_code}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground">WhatsApp</div>
                  <div className="mt-1">{wallet.whatsapp}</div>
                </div>

                <div>
                  <div className="text-sm font-medium text-muted-foreground">Shop Access</div>
                  <div className="mt-1">
                    {wallet.allow_any_shop ? (
                      <Badge variant="default">Any Shop</Badge>
                    ) : (
                      <Badge variant="secondary">
                        {allowedShops.length} Allowed Shops
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* QR Link */}
            <Card>
              <CardHeader>
                <CardTitle>QR Deep Link</CardTitle>
                <CardDescription>
                  Share this link with the user
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    disabled
                    className="w-full"
                    title="QR link not available from detail endpoint"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open QR Link
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    QR link is available after token issuance
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
