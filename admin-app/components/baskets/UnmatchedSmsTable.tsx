"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { getAdminApiPath } from "@/lib/routes";
import {
  basketsQueryKeys,
  useUnmatchedSmsQuery,
  type BasketsQueryParams,
  type MomoUnmatchedRow,
} from "@/lib/queries/baskets";
import styles from "./UnmatchedSmsTable.module.css";

interface UnmatchedSmsTableProps {
  params: BasketsQueryParams;
}

export function UnmatchedSmsTable({ params }: UnmatchedSmsTableProps) {
  const [filters, setFilters] = useState<{ status: string; search: string }>({
    status: 'open',
    search: '',
  });

  const queryParams: BasketsQueryParams = useMemo(() => ({
    ...params,
    status: filters.status,
    search: filters.search || undefined,
  }), [filters, params]);

  const queryClient = useQueryClient();
  const unmatchedQuery = useUnmatchedSmsQuery(queryParams, { keepPreviousData: true });
  const { pushToast } = useToast();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: basketsQueryKeys.unmatchedSms(queryParams) });
  };

  const resolveMutation = useMutation({
    mutationFn: async (input: { id: string; reason?: string }) => {
      const response = await fetch(getAdminApiPath("baskets", "momo", "unmatched", input.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved', reason: input.reason }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to resolve');
      }
      return response.json();
    },
    onSuccess: async () => {
      pushToast('Marked as resolved.', 'success');
      await invalidate();
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : 'Failed to resolve unmatched SMS.', 'error');
    },
  });

  const rows = unmatchedQuery.data?.data ?? [];
  const total = unmatchedQuery.data?.total ?? 0;
  const [allocatingId, setAllocatingId] = useState<string | null>(null);
  const [allocationMemberId, setAllocationMemberId] = useState("");
  const [allocationNotes, setAllocationNotes] = useState("");

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <span className={styles.counter}>{total} unmatched SMS</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => invalidate()}
          disabled={unmatchedQuery.isFetching}
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
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <label className={styles.searchField}>
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Reason or MSISDN"
          />
        </label>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sender</th>
              <th>Amount</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Received</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className={styles.senderCell}>
                    <span className={styles.senderMsisdn}>{row.parsed?.msisdnE164 ?? 'Unknown number'}</span>
                    {row.parsed?.senderName ? (
                      <span className={styles.senderName}>{row.parsed.senderName}</span>
                    ) : null}
                    {row.parsed?.txnId ? (
                      <span className={styles.txnId}>{row.parsed.txnId}</span>
                    ) : null}
                  </div>
                </td>
                <td>
                  {row.parsed?.amount != null
                    ? `${row.parsed.amount.toLocaleString()} ${row.parsed.currency ?? ''}`
                    : '—'}
                </td>
                <td className={styles.reasonCell}>{row.reason}</td>
                <td className={styles.statusBadge}>{row.status}</td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td className="text-right space-x-2">
                  {row.status === 'open' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolveMutation.mutate({ id: row.id })}
                        disabled={resolveMutation.isLoading}
                      >
                        Mark resolved
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAllocatingId(row.id);
                          setAllocationMemberId('');
                          setAllocationNotes('');
                        }}
                      >
                        Allocate
                      </Button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {allocatingId ? (
        <form
          className={styles.allocateCard}
          onSubmit={async (event) => {
            event.preventDefault();
            if (!allocationMemberId) {
              pushToast('Provide member ID to allocate.', 'error');
              return;
            }
            try {
              const response = await fetch(
                getAdminApiPath("baskets", "momo", "unmatched", allocatingId, "allocate"),
                {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  memberId: allocationMemberId,
                  notes: allocationNotes || undefined,
                }),
              },
              if (!response.ok) {
                const data = await response.json().catch(() => null);
                pushToast(data?.message ?? 'Failed to allocate contribution.', 'error');
                return;
              }
              pushToast('Contribution allocated.', 'success');
              setAllocatingId(null);
              await invalidate();
            } catch (error) {
              console.error('unmatched_allocate_failed', error);
              pushToast('Unexpected error while allocating.', 'error');
            }
          }}
        >
          <div className={styles.allocateRow}>
            <label>
              <span>Member ID</span>
              <input
                required
                value={allocationMemberId}
                onChange={(event) => setAllocationMemberId(event.target.value)}
                placeholder="ibimina_members UUID"
              />
            </label>
            <label>
              <span>Notes</span>
              <input
                value={allocationNotes}
                onChange={(event) => setAllocationNotes(event.target.value)}
                placeholder="Optional notes"
              />
            </label>
          </div>
          <div className={styles.allocateActions}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAllocatingId(null)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Allocate ledger entry
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
