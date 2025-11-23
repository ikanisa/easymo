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
  recipient: string;
  status: "completed" | "pending" | "failed";
  timestamp: string;
}

interface TransactionTableProps {
  transactions?: Transaction[];
}

export function TransactionTable({ transactions }: TransactionTableProps) {
  const data = transactions ?? [
    {
      id: "TX123",
      type: "allocation",
      amount: "+500",
      recipient: "Partner A",
      status: "completed",
      timestamp: "2024-01-15 10:30",
    },
    {
      id: "TX124",
      type: "transfer",
      amount: "-200",
      recipient: "User B",
      status: "pending",
      timestamp: "2024-01-15 11:00",
    },
  ];

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transaction ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="font-medium">{tx.id}</TableCell>
              <TableCell className="capitalize">{tx.type}</TableCell>
              <TableCell className={tx.amount.startsWith("+") ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                {tx.amount}
              </TableCell>
              <TableCell>{tx.recipient}</TableCell>
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
              <TableCell className="text-gray-500">{tx.timestamp}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
