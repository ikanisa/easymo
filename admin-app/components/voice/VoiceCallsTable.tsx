import { DataTable } from "@/components/data-table/DataTable";
import type { ColumnDef } from "@tanstack/react-table";

interface VoiceCallRow {
  id: string;
  waCallId: string | null;
  leadName: string | null;
  phone: string | null;
  status: string;
  channel: string;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds?: number | null;
  lastNote?: string | null;
}

interface VoiceCallsTableProps {
  data: VoiceCallRow[];
}

const columns: ColumnDef<VoiceCallRow>[] = [
  {
    header: "Status",
    accessorKey: "status",
  },
  {
    header: "Channel",
    accessorKey: "channel",
  },
  {
    header: "Lead",
    accessorFn: (row) => row.leadName || row.phone || "—",
  },
  {
    header: "Started",
    accessorFn: (row) => new Date(row.startedAt).toLocaleString(),
  },
  {
    header: "Duration",
    accessorFn: (row) => formatSeconds(row.durationSeconds),
  },
  {
    header: "Note",
    accessorFn: (row) => row.lastNote || "",
  },
];

export function VoiceCallsTable({ data }: VoiceCallsTableProps) {
  return (
    <DataTable
      data={data}
      columns={columns}
      searchPlaceholder="Search calls"
      globalFilterFn={(row, value) => {
        const searchString = JSON.stringify(row).toLowerCase();
        return searchString.includes(value.toLowerCase());
      }}
      downloadFileName="voice-calls.csv"
    />
  );
}

function formatSeconds(value: number | null | undefined) {
  if (!value || value <= 0) return "—";
  if (value < 60) return `${value.toFixed(1)}s`;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}m ${seconds}s`;
}
