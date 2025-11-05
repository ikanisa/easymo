import type { Meta, StoryObj } from "@storybook/react";
import { DataTable, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from "../../table/Table";

const meta: Meta<typeof DataTable> = {
  title: "Components/Table",
  component: DataTable,
  args: {
    striped: true,
  },
};

export default meta;

type Story = StoryObj<typeof DataTable>;

const data = [
  { vendor: "Kimironko Logistics", status: "Active", orders: 128, sla: "98%" },
  { vendor: "Downtown Dispatch", status: "Review", orders: 32, sla: "88%" },
  { vendor: "Night Riders", status: "Paused", orders: 12, sla: "73%" },
];

export const Default: Story = {
  render: (args) => (
    <DataTable {...args}>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Vendor</TableHead>
          <TableHead scope="col">Status</TableHead>
          <TableHead scope="col">Orders (7d)</TableHead>
          <TableHead scope="col">SLA</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.vendor}>
            <TableCell>{row.vendor}</TableCell>
            <TableCell>{row.status}</TableCell>
            <TableCell>{row.orders}</TableCell>
            <TableCell>{row.sla}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableCaption>Live vendor telemetry aggregated from Supabase and voice analytics.</TableCaption>
    </DataTable>
  ),
};
