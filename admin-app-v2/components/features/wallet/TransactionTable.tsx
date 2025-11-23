import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";

interface Transaction {
  id: string;
  type: "allocation" | "redemption" | "transfer";
  amount: string;
  from: string;
  to: string;
  status: "completed" | "pending" | "failed";
  date: string;
}

const mockTransactions: Transaction[] = [
  {
    id: "TX123",
    type: "allocation",
    amount: "+500",
    from: "System",
    to: "Partner A",
    status: "completed",
    date: "2024-11-23 10:30",
  },
  {
    id: "TX124",
    type: "redemption",
    amount: "-50",
    from: "User B",
    to: "Partner A",
    status: "completed",
    date: "2024-11-23 11:15",
  },
  {
    id: "TX125",
    type: "transfer",
    amount: "100",
    from: "User C",
    to: "User D",
    status: "pending",
    date: "2024-11-23 12:00",
  },
];

export function TransactionTable() {
  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transaction ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mockTransactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="font-medium">{tx.id}</TableCell>
              <TableCell className="capitalize">{tx.type}</TableCell>
              <TableCell
                className={
                  tx.type === "allocation"
                    ? "text-green-600 font-medium"
                    : tx.type === "redemption"
                    ? "text-red-600 font-medium"
                    : "text-gray-900"
                }
              >
                {tx.amount}
              </TableCell>
              <TableCell>{tx.from}</TableCell>
              <TableCell>{tx.to}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    tx.status === "completed"
                      ? "success"
                      : tx.status === "pending"
                      ? "warning"
                      : "destructive"
                  }
                  className="capitalize"
                >
                  {tx.status}
                </Badge>
              </TableCell>
              <TableCell className="text-gray-500">{tx.date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
