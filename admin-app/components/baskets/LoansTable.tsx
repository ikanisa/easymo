"use client";

import { useMemo, useState } from "react";
import {
  useLoansQuery,
  useSaccosQuery,
  type BasketsQueryParams,
} from "@/lib/queries/baskets";
import { Button } from "@/components/ui/Button";
import { LoanReviewDrawer } from "./LoanReviewDrawer";
import styles from "./LoansTable.module.css";
import { maskMsisdn } from "@va/shared";

const SACCO_OPTIONS_PARAMS = { limit: 200, status: 'active' } as const;

interface LoansTableProps {
  params: BasketsQueryParams;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function LoansTable({ params }: LoansTableProps) {
  const [filters, setFilters] = useState<{ status: string; saccoId: string; search: string }>({
    status: 'pending',
    saccoId: '',
    search: '',
  });

  const queryParams: BasketsQueryParams = useMemo(() => ({
    ...params,
    status: filters.status === 'all' ? undefined : filters.status,
    saccoId: filters.saccoId || undefined,
    search: filters.search || undefined,
  }), [filters, params]);

  const loansQuery = useLoansQuery(queryParams, { keepPreviousData: true });
  const saccoOptionsQuery = useSaccosQuery(SACCO_OPTIONS_PARAMS);

  const loanRowsData = loansQuery.data?.data;
  const rows = useMemo(
    () => loanRowsData ?? [],
    [loanRowsData],
  );
  const saccoOptionsData = saccoOptionsQuery.data?.data;
  const saccoOptions = useMemo(
    () => saccoOptionsData ?? [],
    [saccoOptionsData],
  );

  const [activeLoanId, setActiveLoanId] = useState<string | null>(null);
  const activeLoan = useMemo(() => (
    activeLoanId ? rows.find((row) => row.id === activeLoanId) ?? null : null
  ), [activeLoanId, rows]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.filtersRow}>
        <label>
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="pending">Pending</option>
            <option value="endorsing">Endorsing</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="disbursed">Disbursed</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
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
            placeholder="Purpose or MSISDN"
          />
        </label>
        <Button
          size="sm"
          variant="outline"
          onClick={() => loansQuery.refetch()}
          disabled={loansQuery.isFetching}
        >
          Refresh
        </Button>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ikimina</th>
              <th>Member</th>
              <th>Principal</th>
              <th>Tenure</th>
              <th>Rate APR</th>
              <th>Status</th>
              <th>Collateral</th>
              <th>LTV</th>
              <th>Created</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className={styles.ikiminaCell}>
                    <span className={styles.ikiminaName}>{row.ikimina?.name ?? '—'}</span>
                    <span className={styles.ikiminaMeta}>
                      {row.ikimina?.sacco ? row.ikimina.sacco.name : 'No SACCO'}
                    </span>
                  </div>
                </td>
                <td>
                  <div className={styles.memberCell}>
                    <span>{row.member?.profile?.displayName ?? 'Unknown'}</span>
                    <span className={styles.memberMeta}>{row.member?.profile?.msisdn ? maskMsisdn(row.member.profile.msisdn) : '—'}</span>
                  </div>
                </td>
                <td className={styles.amountCell}>{formatCurrency(row.principal, row.currency)}</td>
                <td>{row.tenureMonths} months</td>
                <td>{row.rateApr != null ? `${row.rateApr}%` : '—'}</td>
                <td className={styles.statusBadge}>{row.status}</td>
                <td>{formatCurrency(row.collateralTotal, row.currency)}</td>
                <td>{row.ltvRatio != null ? `${(row.ltvRatio * 100).toFixed(1)}%` : '—'}</td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td className={styles.actionsCell}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveLoanId(row.id)}
                  >
                    Review
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeLoan ? (
        <LoanReviewDrawer
          loan={activeLoan}
          onClose={() => setActiveLoanId(null)}
          onUpdated={() => loansQuery.refetch()}
        />
      ) : null}
    </div>
  );
}
