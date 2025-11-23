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
  return null;
}
