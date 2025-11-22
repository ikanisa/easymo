"use client";

import { useState } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import { InviteUserCard } from "@/components/users/InviteUserCard";
import { UsersTable } from "@/components/users/UsersTable";
import { type UsersQueryParams, useUsersQuery } from "@/lib/queries/users";

interface UsersClientProps {
  initialParams?: UsersQueryParams;
}

export function UsersClient(
  { initialParams = { limit: 200 } }: UsersClientProps,
) {
  const [params, setParams] = useState<UsersQueryParams>(initialParams);
  const usersQuery = useUsersQuery(params);

  const users = usersQuery.data?.data ?? [];
  const hasMore = usersQuery.data?.hasMore;
  const loadingMore = usersQuery.isFetching && !usersQuery.isLoading;

  return (
    <ProtectedRoute requireAdmin>
      <div className="admin-page">
        <PageHeader
          title="Users"
          description="Search, filter, and inspect user profiles. Drawers will surface messaging activity and insurance quotes soon."
        />
        <InviteUserCard />
        <SectionCard
          title="Directory"
          description="Click a name to open the profile drawer. Actions will expand as write APIs arrive."
        >
          {usersQuery.isLoading
            ? (
              <LoadingState
                title="Loading users"
                description="Fetching the latest directory entries."
              />
            )
            : users.length
            ? (
              <UsersTable
                data={users}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={() =>
                  setParams((prev) => ({
                    ...prev,
                    limit: (prev.limit ?? initialParams.limit ?? 200) + 50,
                  }))}
              />
            )
            : (
              <EmptyState
                title="No users yet"
                description="Load fixtures or connect Supabase to populate the directory."
              />
            )}
        </SectionCard>
        <SectionCard
          title="Next steps"
          description="Messaging history, insurance interactions, and quick actions will live in the drawer."
        >
          <EmptyState
            title="Drawer enhancements pending"
            description="Future milestones will add timeline views and insurance review data here."
          />
        </SectionCard>
      </div>
    </ProtectedRoute>
  );
}
