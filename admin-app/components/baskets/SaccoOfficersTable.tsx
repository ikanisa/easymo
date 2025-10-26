"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { getAdminApiPath } from "@/lib/routes";
import styles from "./SaccoOfficersTable.module.css";
import { maskMsisdn } from "@va/shared";
import {
  basketsQueryKeys,
  type BasketsQueryParams,
  type SaccoOfficerRow,
  useSaccoOfficersQuery,
} from "@/lib/queries/baskets";
import { SaccoOfficerForm } from "./SaccoOfficerForm";

interface SaccoOfficersTableProps {
  params: BasketsQueryParams;
}

export function SaccoOfficersTable({ params }: SaccoOfficersTableProps) {
  const queryClient = useQueryClient();
  const officersQuery = useSaccoOfficersQuery(params, { keepPreviousData: true });
  const { pushToast } = useToast();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: basketsQueryKeys.saccoOfficers(params) });
  };

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(getAdminApiPath("baskets", "saccos", "officers", id), {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to remove officer');
      }
      return response.json();
    },
    onSuccess: async () => {
      pushToast('Officer removed.', 'success');
      await invalidate();
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : 'Failed to remove officer.', 'error');
    },
    onSettled: () => setRemovingId(null),
  });

  const rowsData = officersQuery.data?.data;
  const rows = useMemo(
    () => rowsData ?? [],
    [rowsData],
  );
  const total = officersQuery.data?.total ?? 0;

  return (
    <div className={styles.wrapper}>
      <SaccoOfficerForm onCreated={invalidate} />

      <div className={styles.headerRow}>
        <span className={styles.counter}>{total} officer{total === 1 ? '' : 's'}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => invalidate()}
          disabled={officersQuery.isFetching}
        >
          Refresh
        </Button>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Officer</th>
              <th>SACCO</th>
              <th>Role</th>
              <th>Created</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className={styles.officerCell}>
                    <span className={styles.officerName}>
                      {row.profile?.displayName ?? 'Unknown user'}
                    </span>
                    <span className={styles.officerMsisdn}>
                      {row.profile?.msisdn ? maskMsisdn(row.profile.msisdn) : '—'}
                    </span>
                    <span className={styles.officerId}>{row.userId}</span>
                  </div>
                </td>
                <td>
                  {row.sacco
                    ? `${row.sacco.name}${row.sacco.branchCode ? ` (${row.sacco.branchCode})` : ''}`
                    : '—'}
                </td>
                <td className={styles.roleBadge}>{row.role}</td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td className="text-right">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setRemovingId(row.id);
                      removeMutation.mutate(row.id);
                    }}
                    disabled={removeMutation.isLoading && removingId === row.id}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
