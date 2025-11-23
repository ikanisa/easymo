import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  status: "success" | "failed" | "warning";
  ipAddress?: string;
}

const mockLogs: AuditLogEntry[] = [
  {
    id: "1",
    timestamp: "2024-11-23 14:30:00",
    user: "admin@easymo.com",
    action: "User Created",
    resource: "users/123",
    status: "success",
    ipAddress: "192.168.1.1",
  },
  {
    id: "2",
    timestamp: "2024-11-23 14:25:00",
    user: "manager@easymo.com",
    action: "Policy Updated",
    resource: "policies/POL-001",
    status: "success",
    ipAddress: "192.168.1.2",
  },
  {
    id: "3",
    timestamp: "2024-11-23 14:20:00",
    user: "user@easymo.com",
    action: "Login Failed",
    resource: "auth/login",
    status: "failed",
    ipAddress: "192.168.1.3",
  },
];

export function AuditLog() {
  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Audit Log</h3>
        <p className="text-sm text-gray-500">System activity and security events</p>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>IP Address</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm text-gray-500">
                  {log.timestamp}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar fallback={log.user} />
                    <span className="text-sm font-medium">{log.user}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{log.action}</TableCell>
                <TableCell className="text-sm text-gray-600">
                  {log.resource}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      log.status === "success"
                        ? "success"
                        : log.status === "failed"
                        ? "destructive"
                        : "warning"
                    }
                    className="capitalize"
                  >
                    {log.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-500">
                  {log.ipAddress}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
