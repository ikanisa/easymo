import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ImportWizard from "../components/import-wizard";

async function getGroups(saccoId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ikimina")
    .select("id, name, code")
    .eq("sacco_id", saccoId)
    .eq("status", "ACTIVE")
    .order("name");

  if (error) throw error;
  return data || [];
}

async function getSaccoId() {
  // TODO: Get from session/context
  // For now, hardcode or get from query param
  return "00000000-0000-0000-0000-000000000000";
}

export default async function ImportMembersPage() {
  const saccoId = await getSaccoId();
  const groups = await getGroups(saccoId);

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/members">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Import Members</h1>
          <p className="text-muted-foreground">
            Bulk import members from CSV file
          </p>
        </div>
      </div>

      <ImportWizard saccoId={saccoId} groups={groups} />
    </div>
  );
}
