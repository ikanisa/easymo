import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { TokensApi } from "@/lib/tokensApi";
import { Copy, Coins, Loader2, ExternalLink } from "lucide-react";
import type { Shop, IssueTokensRequest, IssueTokensResponse } from "@/lib/types";

export default function TokensIssue() {
  const [formData, setFormData] = useState<IssueTokensRequest>({
    whatsapp: "",
    user_code: "",
    amount: 1000,
    allow_any_shop: true,
    allowed_shop_ids: [],
  });
  const [issuedResult, setIssuedResult] = useState<IssueTokensResponse | null>(null);

  const queryClient = useQueryClient();

  // Fetch shops for the multi-select
  const { data: shops = [] } = useQuery<Shop[]>({
    queryKey: ["shops"],
    queryFn: TokensApi.listShops,
  });

  // Issue tokens mutation
  const issueMutation = useMutation({
    mutationFn: TokensApi.issue,
    onSuccess: (result: IssueTokensResponse) => {
      setIssuedResult(result);
      toast({
        title: "Tokens Issued Successfully",
        description: `Issued ${formData.amount} RWF to ${formData.whatsapp}. QR link copied.`,
      });
      
      // Copy link to clipboard
      navigator.clipboard.writeText(result.link);
      
      // Reset form
      setFormData({
        whatsapp: "",
        user_code: "",
        amount: 1000,
        allow_any_shop: true,
        allowed_shop_ids: [],
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
    onError: (error) => {
      toast({
        title: "Issue Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.whatsapp.startsWith("+") || formData.whatsapp.length < 10) {
      toast({
        title: "Invalid WhatsApp Number",
        description: "Must start with + and have at least 10 digits",
        variant: "destructive",
      });
      return;
    }
    
    if (formData.amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Amount must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (!formData.user_code.trim()) {
      toast({
        title: "Invalid User Code",
        description: "User code is required",
        variant: "destructive",
      });
      return;
    }
    
    // Check if user code already exists
    try {
      const exists = await TokensApi.checkUserCodeExists(formData.user_code);
      if (exists) {
        toast({
          title: "User Code Already Exists",
          description: "This user code is already in use. Please choose a different one.",
          variant: "destructive",
        });
        return;
      }
    } catch (error) {
      console.error("Failed to check user code:", error);
      // Continue with submission if check fails
    }
    
    issueMutation.mutate(formData);
  };

  const copyLink = () => {
    if (issuedResult?.link) {
      navigator.clipboard.writeText(issuedResult.link);
      toast({
        title: "Link Copied",
        description: "QR link copied to clipboard",
      });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title="Issue Tokens"
          description="Create new wallet tokens for users"
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Issue Form */}
          <Card>
            <CardHeader>
              <CardTitle>Token Details</CardTitle>
              <CardDescription>
                Enter user information and token amount
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp Number</Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    placeholder="+250..."
                    value={formData.whatsapp}
                    onChange={(e) =>
                      setFormData({ ...formData, whatsapp: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user_code">User Code</Label>
                  <Input
                    id="user_code"
                    placeholder="e.g., USR123"
                    value={formData.user_code}
                    onChange={(e) =>
                      setFormData({ ...formData, user_code: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (RWF)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="1"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })
                    }
                    required
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="allow_any_shop"
                    checked={formData.allow_any_shop}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, allow_any_shop: checked })
                    }
                  />
                  <Label htmlFor="allow_any_shop">Allow any shop</Label>
                </div>

                {!formData.allow_any_shop && (
                  <div className="space-y-2">
                    <Label>Allowed Shops</Label>
                    <Select
                      onValueChange={(value) => {
                        const currentIds = formData.allowed_shop_ids || [];
                        if (!currentIds.includes(value)) {
                          setFormData({
                            ...formData,
                            allowed_shop_ids: [...currentIds, value],
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select shops..." />
                      </SelectTrigger>
                      <SelectContent>
                        {shops.map((shop) => (
                          <SelectItem key={shop.id} value={shop.id}>
                            {shop.name} ({shop.short_code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {formData.allowed_shop_ids && formData.allowed_shop_ids.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.allowed_shop_ids.map((shopId) => {
                          const shop = shops.find((s) => s.id === shopId);
                          return (
                            <span
                              key={shopId}
                              className="inline-flex items-center px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-sm"
                            >
                              {shop?.name}
                              <button
                                type="button"
                                onClick={() =>
                                  setFormData({
                                    ...formData,
                                    allowed_shop_ids: formData.allowed_shop_ids?.filter(
                                      (id) => id !== shopId
                                    ),
                                  })
                                }
                                className="ml-1 text-muted-foreground hover:text-foreground"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={issueMutation.isPending}
                  className="w-full"
                >
                  {issueMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Coins className="h-4 w-4 mr-2" />
                  )}
                  Issue Tokens
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Result */}
          {issuedResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-success">Tokens Issued Successfully</CardTitle>
                <CardDescription>
                  Wallet created with QR link
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Wallet ID</Label>
                  <div className="font-mono text-sm bg-muted p-2 rounded">
                    {issuedResult.wallet_id}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>QR Link</Label>
                  <div className="flex gap-2">
                    <Textarea
                      value={issuedResult.link}
                      readOnly
                      className="font-mono text-sm"
                      rows={3}
                    />
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" size="sm" onClick={copyLink}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a
                          href={issuedResult.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}