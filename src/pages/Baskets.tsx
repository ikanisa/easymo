import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Users, Eye, Share, QrCode, Copy } from "lucide-react";
import type { Basket } from "@/lib/types";

export default function Baskets() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "public" as "public" | "private",
    momo_payee_number: "",
    momo_ussd_code: "",
    momo_target: "",
    momo_is_code: false,
  });

  const queryClient = useQueryClient();

  // Fetch baskets
  const { data: baskets = [], isLoading } = useQuery({
    queryKey: ["baskets"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('baskets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Create basket mutation
  const createMutation = useMutation({
    mutationFn: async (basketData: typeof formData) => {
      const { data, error } = await (supabase as any)
        .from('baskets')
        .insert([{
          name: basketData.name,
          description: basketData.description,
          type: basketData.type,
          momo_payee_number: basketData.momo_payee_number,
          momo_ussd_code: basketData.momo_ussd_code,
          momo_target: basketData.momo_target,
          momo_is_code: basketData.momo_is_code,
          status: 'draft',
          public_slug: basketData.type === 'public' ? `basket-${Date.now()}` : null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (basket) => {
      toast({
        title: "Basket Created",
        description: `${basket.name} has been created successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["baskets"] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Create Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "public",
      momo_payee_number: "",
      momo_ussd_code: "",
      momo_target: "",
      momo_is_code: false,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Invalid Name",
        description: "Basket name is required",
        variant: "destructive",
      });
      return;
    }
    
    createMutation.mutate(formData);
  };

  const copyShareLink = (basket: any) => {
    const link = basket.public_slug 
      ? `https://baskets.example.com/${basket.public_slug}`
      : `https://baskets.example.com/join?id=${basket.id}`;
    
    navigator.clipboard.writeText(link);
    toast({
      title: "Link Copied",
      description: "Share link copied to clipboard",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "secondary",
      active: "default", 
      closed: "destructive",
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status}
      </Badge>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Baskets"
            description="Manage collective savings and contribution baskets"
          />
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Basket
          </Button>
        </div>

        {/* Baskets List */}
        <Card>
          <CardHeader>
            <CardTitle>All Baskets ({baskets.length})</CardTitle>
            <CardDescription>
              Collective savings groups and contribution baskets
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            ) : baskets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No baskets created yet.</p>
                <Button 
                  variant="outline" 
                  onClick={() => setIsCreateModalOpen(true)} 
                  className="mt-2"
                >
                  Create First Basket
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {baskets.map((basket: any) => (
                  <div
                    key={basket.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h3 className="font-medium">{basket.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {basket.description || "No description"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Type: {basket.type} | MoMo: {basket.momo_payee_number || "Not set"}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(basket.status)}
                      
                      <div className="text-sm text-muted-foreground">
                        {new Date(basket.created_at).toLocaleDateString()}
                      </div>
                      
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyShareLink(basket)}
                          title="Copy share link"
                        >
                          <Share className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Basket</DialogTitle>
              <DialogDescription>
                Set up a new collective savings basket
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Basket Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Group Savings 2024"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What is this basket for?"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Basket Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: "public" | "private") =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public (Anyone can join)</SelectItem>
                    <SelectItem value="private">Private (Invite only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="momo_number">MoMo Collection Number</Label>
                <Input
                  id="momo_number"
                  placeholder="+250..."
                  value={formData.momo_payee_number}
                  onChange={(e) =>
                    setFormData({ ...formData, momo_payee_number: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="momo_ussd">USSD Code (optional)</Label>
                <Input
                  id="momo_ussd"
                  placeholder="*182*7*1#"
                  value={formData.momo_ussd_code}
                  onChange={(e) =>
                    setFormData({ ...formData, momo_ussd_code: e.target.value })
                  }
                />
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
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Basket"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}