"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MembersTable } from "./components";
import { Button } from "@/components/ui/button";
import { Plus, Download, Upload } from "lucide-react";
import Link from "next/link";
import type { MemberWithRelations } from "@/types/member";

const SACCO_ID = "550e8400-e29b-41d4-a716-446655440000";

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<MemberWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        sacco_id: SACCO_ID,
        status: "ACTIVE",
        limit: "50",
        offset: "0",
      });

      const response = await fetch(`/api/members?${params}`);
      if (!response.ok) throw new Error("Failed to fetch members");

      const data = await response.json();
      setMembers(data.data);
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (member: MemberWithRelations) => {
    router.push(`/members/${member.id}/edit`);
  };

  const handleDelete = async (member: MemberWithRelations) => {
    if (!confirm(`Deactivate ${member.full_name}?`)) return;

    try {
      const response = await fetch(`/api/members/${member.id}`, { method: "DELETE" });
      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to deactivate member");
        return;
      }
      fetchMembers();
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to deactivate member");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members</h1>
          <p className="text-muted-foreground">Manage SACCO members and accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/members/import">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Link>
          </Button>
          <Button asChild>
            <Link href="/members/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Member
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading members...</div>
        </div>
      ) : (
        <MembersTable members={members} onEdit={handleEdit} onDelete={handleDelete} />
      )}
    </div>
  );
}
