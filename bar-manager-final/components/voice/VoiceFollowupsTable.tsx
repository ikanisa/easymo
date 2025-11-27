import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table/DataTable";

interface VoiceFollowupRow {
  id: string;
  callId: string | null;
  scheduledAt: string;
  channel: string;
  status: string;
  notes?: string | null;
}

interface VoiceFollowupsTableProps {
  data: VoiceFollowupRow[];
}

const columns: ColumnDef<VoiceFollowupRow>[] = [
  {
    header: "Scheduled",
    accessorFn: (row) => new Date(row.scheduledAt).toLocaleString(),
  },
  {
    header: "Channel",
    accessorKey: "channel",
  },
  {
    header: "Status",
    accessorKey: "status",
  },
  {
    header: "Notes",
    accessorFn: (row) => row.notes || "",
  },
];

export function VoiceFollowupsTable({ data }: VoiceFollowupsTableProps) {
  return (
    <DataTable
      data={data}
      columns={columns}
      searchPlaceholder="Search follow-ups"
      globalFilterFn={(row, value) => {
        const searchString = JSON.stringify(row).toLowerCase();
        return searchString.includes(value.toLowerCase());
      }}
      downloadFileName="voice-followups.csv"
    />
  );
}
