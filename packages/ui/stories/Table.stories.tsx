import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentProps } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../src/components/table";

const meta: Meta<typeof Table> = {
  component: Table,
  title: "Data/Table",
};

export default meta;

type Story = StoryObj<typeof Table>;

const rows = [
  { id: "ord-123", owner: "Andile", status: "In transit", amount: "R1,240" },
  { id: "ord-124", owner: "Lerato", status: "Delivered", amount: "R890" },
  { id: "ord-125", owner: "Sipho", status: "Delayed", amount: "R450" },
];

type TableProps = ComponentProps<typeof Table>;

export const Default: Story = {
  render: (args: TableProps) => (
    <Table {...args}>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.id}</TableCell>
            <TableCell>{row.owner}</TableCell>
            <TableCell>{row.status}</TableCell>
            <TableCell>{row.amount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
  args: { zebra: true },
};
