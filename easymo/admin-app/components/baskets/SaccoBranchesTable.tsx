"use client";

import { useMemo, useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { SaccoBranchForm } from "./SaccoBranchForm";
import styles from "./SaccoBranchesTable.module.css";
import {
  basketsQueryKeys,
  type BasketsQueryParams,
  type SaccoRow,
  useSaccosQuery,
} from "@/lib/queries/baskets";

interface SaccoBranchesTableProps {
  params: BasketsQueryParams;
}

type EditableSacco = Pick<
  SaccoRow,
  'id' | 'name' | 'branchCode' | 'umurengeName' | 'district' | 'contactPhone' | 'status' | 'ltvMinRatio'
>;

export function SaccoBranchesTable({ params }: SaccoBranchesTableProps) {
  const queryClient = useQueryClient();
  const saccoQuery = useSaccosQuery(params, { keepPreviousData: true });
  const { pushToast } = useToast();
  const [editing, setEditing] = useState<EditableSacco | null>(null);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: basketsQueryKeys.saccos(params) });
  };

  const statusMutation = useMutation({
    mutationFn: async (input: { id: string; status: SaccoRow['status'] }) => {
      const response = await fetch(`/api/baskets/saccos/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: input.status }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to update status');
      }
      return response.json();
    },
    onSuccess: async () => {
      pushToast('SACCO status updated.', 'success');
      await invalidate();
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : 'Failed to update status.', 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (input: EditableSacco) => {
      const response = await fetch(`/api/baskets/saccos/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: input.name,
          branchCode: input.branchCode,
          umurengeName: input.umurengeName,
          district: input.district,
          contactPhone: input.contactPhone,
          status: input.status,
          ltvMinRatio: input.ltvMinRatio,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? 'Failed to update branch');
      }
      return response.json();
    },
    onSuccess: async () => {
      pushToast('SACCO branch updated.', 'success');
      setEditing(null);
      await invalidate();
    },
    onError: (error) => {
      pushToast(error instanceof Error ? error.message : 'Failed to update branch.', 'error');
    },
  });

  const saccoRowsData = saccoQuery.data?.data;
  const saccoRows = useMemo(
    () => saccoRowsData ?? [],
    [saccoRowsData],
  );
  const total = saccoQuery.data?.total ?? 0;

  const editingState: EditableSacco | null = useMemo(() => (
    editing && saccoRows.find((row) => row.id === editing.id)
      ? editing
      : null
  ), [editing, saccoRows]);

  return (
    <div className={styles.wrapper}>
      <SaccoBranchForm onCreated={invalidate} />

      <div className={styles.headerRow}>
        <span className={styles.counter}>{total} branch{total === 1 ? '' : 'es'}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => invalidate()}
          disabled={saccoQuery.isFetching}
        >
          Refresh
        </Button>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Branch code</th>
              <th>Location</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Min LTV</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {saccoRows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.branchCode}</td>
                <td>
                  {[row.umurengeName, row.district].filter(Boolean).join(' • ') || '—'}
                </td>
                <td>{row.contactPhone ?? '—'}</td>
                <td>
                  <select
                    className={styles.statusSelect}
                    value={row.status}
                    onChange={(event) =>
                      statusMutation.mutate({ id: row.id, status: event.target.value as SaccoRow['status'] })}
                    disabled={statusMutation.isLoading}
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </td>
                <td>{row.ltvMinRatio.toFixed(2)}x</td>
                <td className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing({
                      id: row.id,
                      name: row.name,
                      branchCode: row.branchCode,
                      umurengeName: row.umurengeName,
                      district: row.district,
                      contactPhone: row.contactPhone,
                      status: row.status,
                      ltvMinRatio: row.ltvMinRatio,
                    })}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingState ? (
        <form
          className={styles.editCard}
          onSubmit={(event) => {
            event.preventDefault();
            updateMutation.mutate(editingState);
          }}
        >
          <div className={styles.editRow}>
            <label>
              <span>Name</span>
              <input
                value={editingState.name}
                onChange={(event) => setEditing({ ...editingState, name: event.target.value })}
              />
            </label>
            <label>
              <span>Branch code</span>
              <input
                value={editingState.branchCode}
                onChange={(event) => setEditing({ ...editingState, branchCode: event.target.value.toUpperCase() })}
              />
            </label>
            <label>
              <span>Umurenge</span>
              <input
                value={editingState.umurengeName ?? ''}
                onChange={(event) => setEditing({ ...editingState, umurengeName: event.target.value })}
              />
            </label>
            <label>
              <span>District</span>
              <input
                value={editingState.district ?? ''}
                onChange={(event) => setEditing({ ...editingState, district: event.target.value })}
              />
            </label>
            <label>
              <span>Contact</span>
              <input
                value={editingState.contactPhone ?? ''}
                onChange={(event) => setEditing({ ...editingState, contactPhone: event.target.value })}
              />
            </label>
            <label>
              <span>Status</span>
              <select
                value={editingState.status}
                onChange={(event) =>
                  setEditing({ ...editingState, status: event.target.value as EditableSacco['status'] })}
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
            <label>
              <span>Min LTV coverage</span>
              <input
                type="number"
                min={0.1}
                max={10}
                step={0.05}
                value={editingState.ltvMinRatio.toString()}
                onChange={(event) => {
                  const next = event.target.value;
                  setEditing({
                    ...editingState,
                    ltvMinRatio: next === '' ? editingState.ltvMinRatio : Number(next),
                  });
                }}
              />
            </label>
          </div>
          <div className={styles.editActions}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={updateMutation.isLoading}>
              {updateMutation.isLoading ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
