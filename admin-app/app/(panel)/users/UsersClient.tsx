"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { UsersTable } from "@/components/users/UsersTable";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { type UsersQueryParams, useUsersQuery } from "@/lib/queries/users";

interface UsersClientProps {
  initialParams?: UsersQueryParams;
}

export function UsersClient(
  { initialParams = { limit: 200 } }: UsersClientProps,
) {
  const [params] = useState<UsersQueryParams>(initialParams);
  const usersQuery = useUsersQuery(params);

  const users = usersQuery.data?.data ?? [];

  return (
    <div className="admin-page">
      <PageHeader
        title="Users"
        description="Search, filter, and inspect user profiles. Drawers will surface voucher activity and insurance quotes soon."
      />
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
          ? <UsersTable data={users} />
          : (
            <EmptyState
              title="No users yet"
              description="Load fixtures or connect Supabase to populate the directory."
            />
          )}
      </SectionCard>
      <SectionCard
        title="Next steps"
        description="Voucher history, insurance interactions, and quick actions will live in the drawer."
      >
        <EmptyState
          title="Drawer enhancements pending"
          description="Future milestones will add voucher timelines and insurance review data here."
        />
      </SectionCard>
    </div>
  );
}
