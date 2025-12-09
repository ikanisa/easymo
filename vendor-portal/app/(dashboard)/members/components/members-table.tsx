"use client";

import { MemberWithRelations } from "@/types/member";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Eye, Edit, Trash2 } from "lucide-react";
import Link from "next/link";

interface MembersTableProps {
  members: MemberWithRelations[];
  onEdit?: (member: MemberWithRelations) => void;
  onDelete?: (member: MemberWithRelations) => void;
}

export function MembersTable({ members, onEdit, onDelete }: MembersTableProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      ACTIVE: "default",
      INACTIVE: "secondary",
      SUSPENDED: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="p-3 text-left text-sm font-medium">Member Code</th>
            <th className="p-3 text-left text-sm font-medium">Name</th>
            <th className="p-3 text-left text-sm font-medium">Phone</th>
            <th className="p-3 text-left text-sm font-medium">Group</th>
            <th className="p-3 text-left text-sm font-medium">Balance</th>
            <th className="p-3 text-left text-sm font-medium">Status</th>
            <th className="p-3 text-right text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.length === 0 ? (
            <tr>
              <td colSpan={7} className="p-8 text-center text-muted-foreground">
                No members found
              </td>
            </tr>
          ) : (
            members.map((member) => (
              <tr key={member.id} className="border-b hover:bg-muted/30">
                <td className="p-3 font-mono text-sm">{member.member_code}</td>
                <td className="p-3">{member.full_name}</td>
                <td className="p-3 font-mono text-sm">{member.msisdn_masked || "-"}</td>
                <td className="p-3 text-sm">{member.ikimina?.name || "-"}</td>
                <td className="p-3 font-mono text-sm">
                  {formatCurrency(member.total_balance || 0)}
                </td>
                <td className="p-3">{getStatusBadge(member.status)}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/members/${member.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    {onEdit && (
                      <Button variant="ghost" size="sm" onClick={() => onEdit(member)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button variant="ghost" size="sm" onClick={() => onDelete(member)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
