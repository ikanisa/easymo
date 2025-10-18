"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "./IbiminaRegistryTable.module.css";
import { IbiminaFilters, type IbiminaFiltersState } from "./IbiminaFilters";
import { IbiminaListTable } from "./IbiminaListTable";
import { IbiminaEditPanel } from "./IbiminaEditPanel";
import {
  basketsQueryKeys,
  useIbiminaQuery,
  useSaccosQuery,
  updateIkiminaStatus,
  type BasketsQueryParams,
  type IbiminaRow,
} from "@/lib/queries/baskets";

const DEFAULT_FILTERS: IbiminaFiltersState = {
  status: "all",
  saccoId: "",
  search: "",
};

const SACCO_OPTIONS_PARAMS: BasketsQueryParams = {
  limit: 200,
  status: "active",
};

export interface IbiminaRegistryTableProps {
  params: BasketsQueryParams;
}

export function IbiminaRegistryTable({ params }: IbiminaRegistryTableProps) {
  const [filters, setFilters] = useState<IbiminaFiltersState>(DEFAULT_FILTERS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const queryParams: BasketsQueryParams = useMemo(
    () => ({
      ...params,
      status: filters.status === "all" ? undefined : filters.status,
      saccoId: filters.saccoId || undefined,
      search: filters.search || undefined,
    }),
    [filters, params],
  );

  const ibiminaQuery = useIbiminaQuery(queryParams, { keepPreviousData: true });
  const saccoOptionsQuery = useSaccosQuery(SACCO_OPTIONS_PARAMS);

  const rows = useMemo(
    () => ibiminaQuery.data?.data ?? [],
    [ibiminaQuery.data],
  );
  const total = ibiminaQuery.data?.total ?? 0;
  const saccoOptions = saccoOptionsQuery.data?.data ?? [];

  const editingRow = useMemo(() => {
    if (!editingId) return null;
    return rows.find((row) => row.id === editingId) ?? null;
  }, [editingId, rows]);

  useEffect(() => {
    if (editingId && !editingRow) {
      setEditingId(null);
    }
  }, [editingId, editingRow]);

  const invalidateIbimina = async () => {
    await queryClient.invalidateQueries({
      queryKey: basketsQueryKeys.ibimina(queryParams),
    });
  };

  const statusMutation = useMutation({
    mutationFn: (input: { id: string; status: IbiminaRow["status"] }) =>
      updateIkiminaStatus(input.id, input.status),
    onSuccess: async () => {
      pushToast("Ikimina status updated.", "success");
      await invalidateIbimina();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error
        ? error.message
        : "Failed to update status.";
      pushToast(message, "error");
    },
  });

  const handleStatusChange = (input: {
    id: string;
    status: IbiminaRow["status"];
  }) => {
    statusMutation.mutate(input);
  };

  return (
    <div className={styles.wrapper}>
      <IbiminaFilters
        filters={filters}
        saccoOptions={saccoOptions}
        onChange={setFilters}
      />
      <IbiminaListTable
        rows={rows}
        total={total}
        onRefresh={invalidateIbimina}
        onReview={(row) => setEditingId(row.id)}
        onStatusChange={handleStatusChange}
        isRefreshing={ibiminaQuery.isFetching}
        isStatusUpdating={statusMutation.isLoading}
      />
      {editingRow
        ? (
          <IbiminaEditPanel
            row={editingRow}
            saccoOptions={saccoOptions}
            onClose={() => setEditingId(null)}
            onUpdated={invalidateIbimina}
          />
        )
        : null}
    </div>
  );
}
