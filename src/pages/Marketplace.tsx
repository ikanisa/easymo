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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Store, Edit, Trash2, ExternalLink, MessageSquare, Folder } from "lucide-react";

interface MarketplaceCategory {
  id: number;
  name: string;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
}

interface Business {
  id: string;
  name: string;
  description: string | null;
  owner_whatsapp: string;
  catalog_url: string | null;
  is_active: boolean;
  category_id: number | null;
  created_at: string;
}

export default function Marketplace() {
  const [activeTab, setActiveTab] = useState("categories");
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MarketplaceCategory | null>(null);
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    is_active: true,
    sort_order: 0,
  });

  const queryClient = useQueryClient();

  // Fetch categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["marketplace-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('marketplace_categories')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as MarketplaceCategory[];
    },
  });

  // Fetch businesses
  const { data: businesses = [], isLoading: businessesLoading } = useQuery({
    queryKey: ["businesses"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Business[];
    },
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: typeof categoryFormData) => {
      const { data, error } = await (supabase as any)
        .from('marketplace_categories')
        .insert([{
          name: categoryData.name,
          is_active: categoryData.is_active,
          sort_order: categoryData.sort_order || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (category) => {
      toast({
        title: "Category Created",
        description: `${category.name} has been created successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["marketplace-categories"] });
      setIsCategoryModalOpen(false);
      resetCategoryForm();
    },
    onError: (error) => {
      toast({
        title: "Create Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MarketplaceCategory> }) => {
      const { error } = await (supabase as any)
        .from('marketplace_categories')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Category Updated",
        description: "Category has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["marketplace-categories"] });
      setIsCategoryModalOpen(false);
      resetCategoryForm();
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await (supabase as any)
        .from('marketplace_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Category Deleted",
        description: "Category has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["marketplace-categories"] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: "",
      is_active: true,
      sort_order: 0,
    });
    setEditingCategory(null);
  };

  const handleCreateCategory = () => {
    resetCategoryForm();
    setIsCategoryModalOpen(true);
  };

  const handleEditCategory = (category: MarketplaceCategory) => {
    setCategoryFormData({
      name: category.name,
      is_active: category.is_active,
      sort_order: category.sort_order || 0,
    });
    setEditingCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handleCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryFormData.name.trim()) {
      toast({
        title: "Invalid Name",
        description: "Category name is required",
        variant: "destructive",
      });
      return;
    }
    
    if (editingCategory) {
      updateCategoryMutation.mutate({
        id: editingCategory.id,
        data: categoryFormData,
      });
    } else {
      createCategoryMutation.mutate(categoryFormData);
    }
  };

  const handleDeleteCategory = (category: MarketplaceCategory) => {
    if (confirm(`Are you sure you want to delete "${category.name}"?`)) {
      deleteCategoryMutation.mutate(category.id);
    }
  };

  const contactBusiness = (business: Business) => {
    const whatsappUrl = `https://wa.me/${business.owner_whatsapp.replace(/[^0-9]/g, '')}?text=Hi, I'm interested in your business "${business.name}"`;
    window.open(whatsappUrl, '_blank');
  };

  const viewCatalog = (business: Business) => {
    if (business.catalog_url) {
      window.open(business.catalog_url, '_blank');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          title="Marketplace"
          description="Manage marketplace categories and business listings"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="businesses">Businesses</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-6">
            {/* Categories Management */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Categories ({categories.length})</CardTitle>
                    <CardDescription>
                      Manage marketplace business categories
                    </CardDescription>
                  </div>
                  <Button onClick={handleCreateCategory}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {categoriesLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                    ))}
                  </div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No categories created yet.</p>
                    <Button 
                      variant="outline" 
                      onClick={handleCreateCategory} 
                      className="mt-2"
                    >
                      Create First Category
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <div>
                              <h3 className="font-medium">{category.name}</h3>
                              <p className="text-xs text-muted-foreground">
                                Sort Order: {category.sort_order ?? "Not set"}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <Badge variant={category.is_active ? "default" : "secondary"}>
                            {category.is_active ? "Active" : "Inactive"}
                          </Badge>
                          
                          <div className="text-sm text-muted-foreground">
                            {new Date(category.created_at).toLocaleDateString()}
                          </div>
                          
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCategory(category)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCategory(category)}
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
          </TabsContent>

          <TabsContent value="businesses" className="space-y-6">
            {/* Businesses List */}
            <Card>
              <CardHeader>
                <CardTitle>Businesses ({businesses.length})</CardTitle>
                <CardDescription>
                  Business listings in the marketplace
                </CardDescription>
              </CardHeader>
              <CardContent>
                {businessesLoading ? (
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
                ) : businesses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No businesses registered yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {businesses.map((business) => {
                      const category = categories.find(c => c.id === business.category_id);
                      
                      return (
                        <div
                          key={business.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <div>
                                <h3 className="font-medium">{business.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {business.description || "No description"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  WhatsApp: {business.owner_whatsapp} | 
                                  Category: {category?.name || "Uncategorized"}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <Badge variant={business.is_active ? "default" : "secondary"}>
                              {business.is_active ? "Active" : "Inactive"}
                            </Badge>
                            
                            <div className="text-sm text-muted-foreground">
                              {new Date(business.created_at).toLocaleDateString()}
                            </div>
                            
                            <div className="flex space-x-1">
                              {business.catalog_url && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => viewCatalog(business)}
                                  title="View catalog"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => contactBusiness(business)}
                                title="Contact via WhatsApp"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Category Create/Edit Modal */}
        <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Edit Category" : "Create New Category"}
              </DialogTitle>
              <DialogDescription>
                {editingCategory 
                  ? "Update category information" 
                  : "Add a new marketplace category"
                }
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Electronics, Fashion, Food"
                  value={categoryFormData.name}
                  onChange={(e) =>
                    setCategoryFormData({ ...categoryFormData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input
                  id="sort_order"
                  type="number"
                  placeholder="0"
                  value={categoryFormData.sort_order}
                  onChange={(e) =>
                    setCategoryFormData({ 
                      ...categoryFormData, 
                      sort_order: parseInt(e.target.value) || 0 
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers appear first
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={categoryFormData.is_active}
                  onCheckedChange={(checked) =>
                    setCategoryFormData({ ...categoryFormData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    resetCategoryForm();
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                >
                  {editingCategory ? "Update Category" : "Create Category"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}