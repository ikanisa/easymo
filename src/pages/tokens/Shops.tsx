import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { TokensApi } from "@/lib/tokensApi";
import { Store, Plus, Edit, Trash2 } from "lucide-react";
import type { Shop } from "@/lib/types";

export default function TokensShops() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    short_code: "",
    is_active: true,
  });

  const queryClient = useQueryClient();

  // Fetch shops
  const { data: shops = [], isLoading } = useQuery<Shop[]>({
    queryKey: ["shops"],
    queryFn: TokensApi.listShops,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      short_code: "",
      is_active: true,
    });
    setEditingShop(null);
  };

  const handleCreateClick = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleEditClick = (shop: Shop) => {
    setFormData({
      name: shop.name,
      short_code: shop.short_code,
      is_active: shop.is_active,
    });
    setEditingShop(shop);
    setIsCreateModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // For now, these operations are disabled since we don't have backend endpoints
    toast({
      title: "Feature Not Available",
      description: "Shop create/edit requires backend endpoints not yet exposed via admin API",
      variant: "destructive",
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Shops"
            description="Manage merchant shops for wallet transactions"
          />
          <Button onClick={handleCreateClick} disabled>
            <Plus className="h-4 w-4 mr-2" />
            Create Shop
          </Button>
        </div>

        {/* Shops List */}
        <Card>
          <CardHeader>
            <CardTitle>All Shops ({shops.length})</CardTitle>
            <CardDescription>
              Shops where wallet tokens can be spent
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
            ) : shops.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No shops configured yet.</p>
                <Button variant="outline" onClick={() => window.location.reload()} className="mt-2">
                  Refresh
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {shops.map((shop) => (
                  <div
                    key={shop.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h3 className="font-medium">{shop.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Code: {shop.short_code}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Badge variant={shop.is_active ? "default" : "secondary"}>
                        {shop.is_active ? "Active" : "Inactive"}
                      </Badge>
                      
                      <div className="text-sm text-muted-foreground">
                        {new Date(shop.created_at).toLocaleDateString()}
                      </div>
                      
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(shop)}
                          disabled
                          title="Backend endpoint required"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled
                          title="Backend endpoint required"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingShop ? "Edit Shop" : "Create New Shop"}
              </DialogTitle>
              <DialogDescription>
                {editingShop 
                  ? "Update shop information" 
                  : "Add a new merchant shop to the system"
                }
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Shop Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Downtown Market"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="short_code">Short Code</Label>
                <Input
                  id="short_code"
                  placeholder="e.g., DM001"
                  value={formData.short_code}
                  onChange={(e) =>
                    setFormData({ ...formData, short_code: e.target.value.toUpperCase() })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Used for quick identification (will be converted to uppercase)
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled>
                  {editingShop ? "Update Shop" : "Create Shop"}
                </Button>
              </div>
            </form>

            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Shop create/edit operations are disabled until backend endpoints are exposed via the admin API.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}