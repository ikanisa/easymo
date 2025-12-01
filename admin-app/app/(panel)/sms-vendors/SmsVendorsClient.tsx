"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  type SmsVendor,
  type SmsVendorsQueryParams,
  useSmsVendorsQuery,
  useUpdateSmsVendorMutation,
} from "@/lib/queries/sms-vendors";

const STATUS_BADGE_VARIANTS: Record<string, "yellow" | "green" | "red" | "gray"> = {
  pending: "yellow",
  active: "green",
  suspended: "red",
  expired: "gray",
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SmsVendorsClient() {
  const router = useRouter();
  const [params, setParams] = useState<SmsVendorsQueryParams>({ limit: 50 });
  const [search, setSearch] = useState("");
  
  const vendorsQuery = useSmsVendorsQuery(params);
  const updateMutation = useUpdateSmsVendorMutation();
  
  const vendors = vendorsQuery.data?.data ?? [];
  const hasMore = vendorsQuery.data?.hasMore;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setParams((prev) => ({ ...prev, search: search || undefined, offset: 0 }));
  };

  const handleStatusFilter = (status: string) => {
    setParams((prev) => ({
      ...prev,
      status: status || undefined,
      offset: 0,
    }));
  };

  const handleActivate = async (vendor: SmsVendor) => {
    await updateMutation.mutateAsync({
      id: vendor.id,
      data: { subscriptionStatus: "active" },
    });
  };

  const handleSuspend = async (vendor: SmsVendor) => {
    await updateMutation.mutateAsync({
      id: vendor.id,
      data: { subscriptionStatus: "suspended" },
    });
  };

  const handleLoadMore = () => {
    setParams((prev) => ({
      ...prev,
      limit: (prev.limit ?? 50) + 25,
    }));
  };

  return (
    <div className="admin-page">
      <PageHeader
        title="SMS Vendors"
        description="Register and manage vendors for SMS parsing service via MomoTerminal."
        actions={
          <Link href="/sms-vendors/new">
            <Button variant="primary">Register New Vendor</Button>
          </Link>
        }
      />

      <SectionCard
        title="Registered Vendors"
        description="All vendors registered for SMS parsing service."
        actions={
          <div className="flex items-center gap-3">
            <select
              className="h-10 px-3 rounded-lg bg-[var(--aurora-surface)] border border-[var(--aurora-border)] text-[var(--aurora-text-primary)] text-sm"
              value={params.status ?? ""}
              onChange={(e) => handleStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="expired">Expired</option>
            </select>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Search vendors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>
          </div>
        }
      >
        {vendorsQuery.isLoading ? (
          <LoadingState title="Loading vendors" description="Fetching registered vendors..." />
        ) : vendorsQuery.isError ? (
          <EmptyState
            title="Failed to load vendors"
            description="An error occurred while loading vendors. Please try again."
            action={
              <Button onClick={() => vendorsQuery.refetch()} variant="secondary">
                Retry
              </Button>
            }
          />
        ) : vendors.length === 0 ? (
          <EmptyState
            title="No vendors registered"
            description="Register your first vendor to start receiving SMS parsing data."
            action={
              <Link href="/sms-vendors/new">
                <Button variant="primary">Register New Vendor</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--aurora-border)]">
                    <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                      Vendor Name
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                      Payee Number
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                      WhatsApp
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                      Created
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-[var(--aurora-text-secondary)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((vendor) => (
                    <tr
                      key={vendor.id}
                      className="border-b border-[var(--aurora-border)] hover:bg-[var(--aurora-surface-elevated)] cursor-pointer"
                      onClick={() => router.push(`/sms-vendors/${vendor.id}`)}
                    >
                      <td className="py-3 px-4 text-[var(--aurora-text-primary)]">
                        {vendor.vendorName}
                      </td>
                      <td className="py-3 px-4 text-[var(--aurora-text-secondary)]">
                        {vendor.payeeMomoNumber}
                      </td>
                      <td className="py-3 px-4 text-[var(--aurora-text-secondary)]">
                        {vendor.whatsappE164}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={STATUS_BADGE_VARIANTS[vendor.subscriptionStatus] ?? "gray"}>
                          {vendor.subscriptionStatus}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-[var(--aurora-text-secondary)]">
                        {formatDate(vendor.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Link href={`/sms-vendors/${vendor.id}`}>
                            <Button size="sm" variant="ghost">
                              View
                            </Button>
                          </Link>
                          {vendor.subscriptionStatus === "pending" && (
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleActivate(vendor)}
                              loading={updateMutation.isPending && updateMutation.variables?.id === vendor.id}
                            >
                              Activate
                            </Button>
                          )}
                          {vendor.subscriptionStatus === "active" && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleSuspend(vendor)}
                              loading={updateMutation.isPending && updateMutation.variables?.id === vendor.id}
                            >
                              Suspend
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="secondary"
                  onClick={handleLoadMore}
                  loading={vendorsQuery.isFetching}
                >
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
