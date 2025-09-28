"use client";

import { useCallback, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import type { StorageObject } from "@/lib/schemas";
import { useToast } from "@/components/ui/ToastProvider";
import styles from "./StorageTable.module.css";
import { Button } from "@/components/ui/Button";

interface StorageTableProps {
  data: StorageObject[];
}

export function StorageTable({ data }: StorageTableProps) {
  const { pushToast } = useToast();

  const handleSignedUrl = useCallback(async (object: StorageObject) => {
    try {
      const response = await fetch(
        `/api/files/signed-url?bucket=${
          encodeURIComponent(object.bucket)
        }&path=${encodeURIComponent(object.path)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        pushToast(data?.error ?? "Failed to create signed URL.", "error");
        return;
      }
      await navigator.clipboard.writeText(data.url);
      pushToast("Signed URL copied to clipboard.", "success");
      if (data?.integration?.status === "degraded") {
        pushToast(
          data.integration.message ?? "Signed URL generated in degraded mode.",
          "info",
        );
      }
    } catch (error) {
      console.error("Signed URL fetch failed", error);
      pushToast("Unexpected error while generating signed URL.", "error");
    }
  }, [pushToast]);

  const columns = useMemo<ColumnDef<StorageObject>[]>(
    () => [
      {
        header: "Bucket",
        accessorKey: "bucket",
      },
      {
        header: "Path",
        accessorKey: "path",
      },
      {
        header: "MIME type",
        accessorKey: "mimeType",
      },
      {
        header: "Size (KB)",
        accessorKey: "sizeKb",
      },
      {
        header: "Updated",
        accessorKey: "updatedAt",
        cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <div className={styles.actions}>
            <Button
              type="button"
              onClick={() => handleSignedUrl(row.original)}
              title="Copy a signed download link"
              aria-label={`Copy signed URL for ${row.original.path}`}
              size="sm"
              variant="outline"
            >
              Copy signed URL
            </Button>
          </div>
        ),
      },
    ],
    [handleSignedUrl],
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      searchPlaceholder="Search storage objects"
      globalFilterFn={(row, value) =>
        `${row.bucket} ${row.path}`.toLowerCase().includes(value.toLowerCase())}
      downloadFileName="storage-objects.csv"
    />
  );
}
