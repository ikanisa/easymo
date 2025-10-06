"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { useContributionsQuery, useSaccosQuery, type BasketsQueryParams } from "@/lib/queries/baskets";
import styles from "./ContributionsLedgerTable.module.css";

const SACCO_OPTIONS_PARAMS = { limit: 200, status: 'active' } as const;

interface ContributionsLedgerTableProps {
  params: BasketsQueryParams;
}

export function ContributionsLedgerTable({ params }: ContributionsLedgerTableProps) {
  const [filters, setFilters] = useState<{ saccoId: string; status: string; search: string; cycle: string }>({
    saccoId: '',
    status: 'all',
    search: '',
    cycle: '',
  });

  const queryParams: BasketsQueryParams = useMemo(() => ({
    ...params,
    saccoId: filters.saccoId || undefined,
    source: filters.status === 'all' ? undefined : filters.status,
    cycle: filters.cycle || undefined,
    search: filters.search || undefined,
  }), [filters, params]);

  const contributionsQuery = useContributionsQuery(queryParams, { keepPreviousData: true });
  const saccoOptionsQuery = useSaccosQuery(SACCO_OPTIONS_PARAMS);
  const queryClient = useQueryClient();

  const saccoOptions = saccoOptionsQuery.data?.data ?? [];
  const rows = contributionsQuery.data?.data ?? [];
  const total = contributionsQuery.data?.total ?? 0;

  const totals = useMemo(() => {
    const aggregate = rows.reduce((acc, row) => acc + Number(row.amount ?? 0), 0);
    return aggregate;
  }, [rows]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.summaryRow}>
        <div>
          <p className={styles.counter}>{total} records</p>
          <p className={styles.amount}>Total in view: {totals.toLocaleString()} RWF</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['baskets', 'contributions'] })}
          disabled={contributionsQuery.isFetching}
        >
          Refresh
        </Button>
      </div>

      <div className={styles.filtersRow}>
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
        <label>
          <span>Source</span>
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="all">All</option>
            <option value="sms">SMS</option>
            <option value="admin">Admin</option>
            <option value="correction">Correction</option>
          </select>
        </label>
        <label>
          <span>Cycle (YYYYMM)</span>
          <input
            value={filters.cycle}
            onChange={(event) => setFilters((prev) => ({ ...prev, cycle: event.target.value }))}
            placeholder="202510"
          />
        </label>
        <label className={styles.searchField}>
          <span>Search</span>
          <input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Txn ID or MSISDN"
          />
        </label>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ikimina</th>
              <th>Member</th>
              <th>Amount</th>
              <th>Cycle</th>
              <th>Source</th>
              <th>Allocated</th>
              <th>Txn ID</th>
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
                    <span className={styles.memberMeta}>{row.member?.profile?.msisdn ?? '—'}</span>
                  </div>
                </td>
                <td className={styles.amountCell}>{Number(row.amount ?? 0).toLocaleString()} {row.currency}</td>
                <td>{row.cycle}</td>
                <td className={styles.sourceBadge}>{row.source}</td>
                <td>{new Date(row.allocatedAt).toLocaleString()}</td>
                <td className={styles.txnCell}>{row.txnId ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.actionsRow}>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            const csv = rows.map((row) => [
              row.id,
              row.ikimina?.name ?? '',
              row.member?.profile?.displayName ?? '',
              row.member?.profile?.msisdn ?? '',
              row.amount,
              row.currency,
              row.cycle,
              row.source,
              row.allocatedAt,
              row.txnId ?? '',
            ].join(','));
            const blob = new Blob([
              'id,ikimina,member,msisdn,amount,currency,cycle,source,allocated_at,txn_id\n',
              ...csv,
            ], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `contributions-${Date.now()}.csv`;
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export CSV
        </Button>
      </div>
    </div>
  );
}

