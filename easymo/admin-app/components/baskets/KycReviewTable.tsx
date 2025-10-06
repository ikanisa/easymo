"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import {
  basketsQueryKeys,
  useKycDocumentsQuery,
  type BasketsQueryParams,
  type KycDocumentRow,
} from "@/lib/queries/baskets";
import styles from "./KycReviewTable.module.css";

interface KycReviewTableProps {
  params: BasketsQueryParams;
}

export function KycReviewTable({ params }: KycReviewTableProps) {
  const [statusFilter, setStatusFilter] = useState<'pending' | 'verified' | 'rejected'>('pending');
  const [search, setSearch] = useState('');
  const queryParams: BasketsQueryParams = {
    ...params,
    status: statusFilter,
    search: search || undefined,
  };

  const kycQuery = useKycDocumentsQuery(queryParams, { keepPreviousData: true });
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const mutation = useMutation({
    mutationFn: async (input: { id: string; status: 'pending' | 'verified' | 'rejected'; notes?: string }) => {
      const response = await fetch(`/api/baskets/kyc/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: input.status, notes: input.notes }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to update KYC document');
      }
      return response.json();
    },
    onSuccess: async () => {
      pushToast('KYC document updated.', 'success');
      await queryClient.invalidateQueries({ queryKey: basketsQueryKeys.kyc(queryParams) });
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : 'Failed to update KYC document.', 'error');
    },
  });

  const rows = kycQuery.data?.data ?? [];

  return (
    <div className={styles.wrapper}>
      <div className={styles.filtersRow}>
        <label>
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label className={styles.searchField}>
          <span>Search</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or MSISDN"
          />
        </label>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Document</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className={styles.profileCell}>
                    <span>{row.profile?.displayName ?? 'Unknown user'}</span>
                    <span className={styles.profileMeta}>{row.profile?.msisdn ?? '—'}</span>
                  </div>
                </td>
                <td>
                  <div className={styles.docCell}>
                    <a href={row.frontUrl} target="_blank" rel="noreferrer">
                      Front
                    </a>
                    {row.backUrl ? (
                      <a href={row.backUrl} target="_blank" rel="noreferrer">
                        Back
                      </a>
                    ) : null}
                    <details>
                      <summary>Parsed data</summary>
                      <pre>{JSON.stringify(row.parsed, null, 2)}</pre>
                    </details>
                  </div>
                </td>
                <td className={styles.statusBadge}>{row.status}</td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td className={styles.actionsCell}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => mutation.mutate({ id: row.id, status: 'verified' })}
                    disabled={mutation.isLoading}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => mutation.mutate({ id: row.id, status: 'rejected' })}
                    disabled={mutation.isLoading}
                  >
                    Reject
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

