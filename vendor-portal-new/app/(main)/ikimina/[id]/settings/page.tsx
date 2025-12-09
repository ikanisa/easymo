import { notFound } from "next/navigation";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { IkiminaSettingsEditor } from "@/components/ikimina/ikimina-settings-editor";
import type { Database } from "@/lib/supabase/types";
import { hasSaccoReadAccess } from "@/lib/permissions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SettingsPage({ params }: PageProps) {
  const { id } = await params;
  const { profile } = await requireUserAndProfile();
  const supabase = await createSupabaseServerClient();

  const { data: group, error } = await supabase
    .schema("app")
    .from("ikimina")
    .select("id, sacco_id, name, settings_json")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!group) {
    notFound();
  }

  type GroupRow = Database["app"]["Tables"]["ikimina"]["Row"];
  const resolvedGroup = group as GroupRow;

  if (!hasSaccoReadAccess(profile, resolvedGroup.sacco_id)) notFound();

  const { data: historyRows } = await supabase
    .schema("app")
    .from("audit_logs")
    .select("id, action, created_at, diff, actor")
    .eq("entity", "ibimina")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const typedHistory = (historyRows ?? []) as Array<{
    id: string;
    action: string;
    created_at: string | null;
    diff: Record<string, unknown> | null;
    actor: string | null;
  }>;

  const actorIds = Array.from(
    new Set(typedHistory.map((row) => row.actor).filter((value): value is string => Boolean(value)))
  );
  let actorMap = new Map<string, string | null>();
  if (actorIds.length > 0) {
    const { data: actors } = await supabase.from("users").select("id, email").in("id", actorIds);
    if (actors) {
      actorMap = new Map(
        actors.map((row: { id: string; email: string | null }) => [row.id, row.email])
      );
    }
  }

  const history = typedHistory.map((row) => ({
    id: row.id,
    action: row.action,
    actorLabel: row.actor ? (actorMap.get(row.actor) ?? row.actor) : "System",
    createdAt: row.created_at ?? new Date().toISOString(),
    diff: (row.diff as Record<string, unknown> | null) ?? null,
  }));

  return (
    <IkiminaSettingsEditor
      ikiminaId={resolvedGroup.id}
      ikiminaName={resolvedGroup.name}
      saccoId={resolvedGroup.sacco_id}
      initialSettings={resolvedGroup.settings_json as Record<string, unknown> | null}
      history={history}
    />
  );
}
