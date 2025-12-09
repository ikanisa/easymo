import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import MemberForm from "../../components/member-form";
import type { Member } from "@/types/member";

interface EditMemberPageProps {
  params: { id: string };
}

async function getMember(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("members")
    .select(
      `
      *,
      ikimina:ikimina!members_ikimina_id_fkey (
        id,
        name,
        code
      )
    `
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  if (!data) return null;

  return data as Member;
}

async function getGroups(saccoId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ikimina")
    .select("id, name, code, type")
    .eq("sacco_id", saccoId)
    .eq("status", "ACTIVE")
    .order("name");

  if (error) throw error;
  return data || [];
}

export default async function EditMemberPage({ params }: EditMemberPageProps) {
  const member = await getMember(params.id);

  if (!member) {
    notFound();
  }

  const groups = await getGroups(member.sacco_id);

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/members/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Member</h1>
          <p className="text-muted-foreground">{member.full_name} • {member.member_code}</p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Member Information</CardTitle>
          <CardDescription>Update member details and group assignment</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberForm member={member} groups={groups} mode="edit" />
        </CardContent>
      </Card>
    </div>
  );
}
