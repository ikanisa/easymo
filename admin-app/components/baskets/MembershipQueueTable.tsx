"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { getAdminApiPath } from "@/lib/routes";
import {
  basketsQueryKeys,
  type BasketsQueryParams,
  type IbiminaMemberRow,
  useMembershipsQuery,
  useSaccosQuery,
} from "@/lib/queries/baskets";
import styles from "./MembershipQueueTable.module.css";
import { maskMsisdn } from "@va/shared";

const SACCO_OPTIONS_PARAMS = { limit: 200, status: 'active' } as const;

interface MembershipQueueTableProps {
  params: BasketsQueryParams;
}

export function MembershipQueueTable({ params }: MembershipQueueTableProps) {
  const [filters, setFilters] = useState<{ status: string; saccoId: string; search: string }>({
    status: 'pending',
    saccoId: '',
    search: '',
  });

  const queryParams: BasketsQueryParams = useMemo(() => ({
    ...params,
    status: filters.status,
    saccoId: filters.saccoId || undefined,
    search: filters.search || undefined,
  }), [filters, params]);

  const queryClient = useQueryClient();
  const membershipsQuery = useMembershipsQuery(queryParams, { keepPreviousData: true });
  const saccoOptionsQuery = useSaccosQuery(SACCO_OPTIONS_PARAMS);
  const { pushToast } = useToast();

  const saccoOptions = saccoOptionsQuery.data?.data ?? [];

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: basketsQueryKeys.memberships(queryParams) });
  };

  const updateMutation = useMutation({
    mutationFn: async (input: { id: string; status: IbiminaMemberRow['status'] }) => {
      const response = await fetch(getAdminApiPath("baskets", "memberships", input.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: input.status }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to update membership');
      }
      return response.json();
    },
    onSuccess: async () => {
      pushToast('Membership updated.', 'success');
      await invalidate();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to update membership.';
      if (message.toLowerCase().includes('already has an active ikimina membership')) {
        pushToast('User already belongs to another active Ikimina.', 'error');
      } else {
        pushToast(message, 'error');
      }
    },
  });

  const rows = membershipsQuery.data?.data ?? [];
  const total = membershipsQuery.data?.total ?? 0;

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <span className={styles.counter}>{total} member{total === 1 ? '' : 's'}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => invalidate()}
          disabled={membershipsQuery.isFetching}
        >
          Refresh
        </Button>
      </div>

      <div className={styles.filtersRow}>
        <label>
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="removed">Removed</option>
          </select>
        </label>
        <label>
          <span>SACCO</span>
          <select
            value={filters.saccoId}
            onChange={(event) => setFilters((prev) => ({ ...prev, saccoId: event.target.value }))}
          >
            <option value="">All</option>
            {saccoOptions.map((sacco) => (
              <option key={sacco.id} value={sacco.id}>
                {sacco.name}
                {sacco.branchCode ? ` (${sacco.branchCode})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.searchField}>
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Name or MSISDN"
          />
        </label>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Member</th>
              <th>Ikimina</th>
              <th>Status</th>
              <th>Joined</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className={styles.memberCell}>
                    <span className={styles.memberName}>
                      {row.profile?.displayName ?? 'Unknown user'}
                    </span>
                    <span className={styles.memberMsisdn}>{row.profile?.msisdn ? maskMsisdn(row.profile.msisdn) : '—'}</span>
                    <span className={styles.memberId}>{row.userId}</span>
                  </div>
                </td>
                <td>
                  <div className={styles.ikiminaCell}>
                    <span>{row.ikimina.name}</span>
                    <span className={styles.ikiminaMeta}>
                      {row.ikimina.status} {row.saccoId ? '• SACCO linked' : ''}
                    </span>
                  </div>
                </td>
                <td className={styles.statusBadge}>{row.status}</td>
                <td>{new Date(row.joinedAt).toLocaleString()}</td>
                <td className="text-right space-x-2">
                  {row.status !== 'active' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateMutation.mutate({ id: row.id, status: 'active' })}
                      disabled={updateMutation.isLoading}
                    >
                      Approve
                    </Button>
                  ) : null}
                  {row.status !== 'removed' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateMutation.mutate({ id: row.id, status: 'removed' })}
                      disabled={updateMutation.isLoading}
                    >
                      Remove
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
