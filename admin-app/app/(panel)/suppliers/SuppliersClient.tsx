"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Star, MapPin, Phone, TrendingUp } from "lucide-react";

interface PreferredSupplier {
  id: string;
  business_name: string;
  business_type: string;
  contact_phone: string;
  whatsapp_number: string;
  address: string;
  city: string;
  district: string;
  partnership_tier: string;
  priority_score: number;
  is_active: boolean;
  commission_rate: number;
  created_at: string;
}

export function SuppliersClient() {
  const supabase = createBrowserClient();
  const queryClient = useQueryClient();
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  // Fetch preferred suppliers
  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["preferred-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preferred_suppliers")
        .select("*")
        .order("priority_score", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PreferredSupplier[];
    },
  });

  // Fetch products count for each supplier
  const { data: productCounts } = useQuery({
    queryKey: ["supplier-product-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_products")
        .select("supplier_id, id")
        .eq("in_stock", true);

      if (error) throw error;

      // Group by supplier_id
      const counts: Record<string, number> = {};
      data.forEach((item: any) => {
        counts[item.supplier_id] = (counts[item.supplier_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Fetch benefits count for each supplier
  const { data: benefitCounts } = useQuery({
    queryKey: ["supplier-benefit-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_benefits")
        .select("supplier_id, id")
        .eq("is_active", true);

      if (error) throw error;

      const counts: Record<string, number> = {};
      data.forEach((item: any) => {
        counts[item.supplier_id] = (counts[item.supplier_id] || 0) + 1;
      });
      return counts;
    },
  });

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case "platinum":
        return "bg-purple-500 text-white";
      case "gold":
        return "bg-yellow-500 text-white";
      case "silver":
        return "bg-gray-400 text-white";
      default:
        return "bg-gray-200 text-gray-800";
    }
  };

  const getTierIcon = (tier: string) => {
    const starCount = {
      platinum: 4,
      gold: 3,
      silver: 2,
      standard: 1,
    }[tier] || 1;

    return (
      <div className="flex gap-0.5">
        {Array.from({ length: starCount }).map((_, i) => (
          <Star key={i} className="h-3 w-3 fill-current" />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return <div className="p-6">Loading preferred suppliers...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Preferred Suppliers Network</h1>
          <p className="text-muted-foreground mt-2">
            Manage priority suppliers with special benefits for EasyMO users
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Supplier
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Suppliers
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {suppliers?.filter((s) => s.is_active).length || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Platinum Partners
            </CardTitle>
            <Star className="h-4 w-4 text-purple-500 fill-current" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                suppliers?.filter(
                  (s) => s.partnership_tier === "platinum" && s.is_active
                ).length || 0
              }
            </div>
            <p className="text-xs text-muted-foreground">Highest priority</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gold Partners</CardTitle>
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                suppliers?.filter(
                  (s) => s.partnership_tier === "gold" && s.is_active
                ).length || 0
              }
            </div>
            <p className="text-xs text-muted-foreground">High priority</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Products
            </CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(productCounts || {}).reduce(
                (sum, count) => sum + count,
                0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Available items</p>
          </CardContent>
        </Card>
      </div>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Suppliers</CardTitle>
          <CardDescription>
            Manage your network of preferred suppliers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead>Business Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Benefits</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers?.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge className={getTierBadgeColor(supplier.partnership_tier)}>
                        {supplier.partnership_tier}
                      </Badge>
                      {getTierIcon(supplier.partnership_tier)}
                      <span className="text-xs text-muted-foreground">
                        Score: {supplier.priority_score}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {supplier.business_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{supplier.business_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground" />
                      <div className="text-sm">
                        {supplier.city && supplier.district
                          ? `${supplier.district}, ${supplier.city}`
                          : supplier.city || supplier.address || "N/A"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 text-sm">
                      {supplier.contact_phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {supplier.contact_phone}
                        </div>
                      )}
                      {supplier.whatsapp_number && (
                        <div className="text-xs text-green-600">
                          WA: {supplier.whatsapp_number}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {productCounts?.[supplier.id] || 0} items
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {benefitCounts?.[supplier.id] || 0} benefits
                    </Badge>
                  </TableCell>
                  <TableCell>{supplier.commission_rate}%</TableCell>
                  <TableCell>
                    <Badge
                      variant={supplier.is_active ? "default" : "secondary"}
                    >
                      {supplier.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
