import { NextRequest, NextResponse } from "next/server";

import { guardAdminAction } from "@/lib/admin/guard";
import type { Database } from "@/lib/supabase/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const allowedRoles: Array<Database["public"]["Enums"]["app_role"]> = [
    "SYSTEM_ADMIN",
    "SACCO_MANAGER",
  ];

  const guard = await guardAdminAction(
    {
      action: "admin_audit_export",
      reason: "Only system administrators or SACCO managers can export audit logs.",
      logEvent: "admin_audit_export_denied",
      allowedRoles,
    },
    () => NextResponse.json({ error: "Forbidden" }, { status: 403 })
  );

  if (guard.denied) {
    return guard.result;
  }

  const { profile, supabase } = guard.context;

  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get("action")?.trim() ?? "";
  const entity = searchParams.get("entity")?.trim() ?? "";
  const actorSearch = searchParams.get("actor")?.trim() ?? "";
  const from = searchParams.get("from")?.trim() ?? "";
  const to = searchParams.get("to")?.trim() ?? "";
  const overrideSacco = searchParams.get("saccoId")?.trim() ?? "";

  const actorIds: string[] = [];

  if (actorSearch.length > 0) {
    const { data: actorRows, error: actorError } = await supabase
      .from("users")
      .select("id")
      .ilike("email", `%${actorSearch}%`)
      .limit(100);
    if (actorError) {
      return NextResponse.json({ error: actorError.message }, { status: 500 });
    }
    actorIds.push(...(actorRows ?? []).map((row) => String(row.id)));
    if (actorIds.length === 0) {
      return new NextResponse("id,action,entity,entity_id,actor,created_at,diff\n", {
        headers: csvHeaders(),
      });
    }
  }

  let query = supabase
    .schema("app")
    .from("audit_logs")
    .select("id, action, entity, entity_id, diff, created_at, actor, sacco_id")
    .order("created_at", { ascending: false })
    .limit(1000);

  const saccoScope =
    profile.role === "SYSTEM_ADMIN"
      ? overrideSacco || null
      : (profile.sacco_id ?? (overrideSacco || null));

  if (saccoScope) {
    query = query.eq("sacco_id", saccoScope);
  }

  if (action) {
    query = query.ilike("action", `%${action}%`);
  }
  if (entity) {
    query = query.ilike("entity", `%${entity}%`);
  }
  if (actorIds.length > 0) {
    query = query.in("actor", actorIds);
  } else if (actorSearch.length > 0) {
    query = query.eq("actor", actorSearch);
  }
  if (from) {
    const fromIso = new Date(`${from}T00:00:00Z`).toISOString();
    query = query.gte("created_at", fromIso);
  }
  if (to) {
    const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();
    query = query.lte("created_at", toIso);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const csvLines = [
    "id,action,entity,entity_id,actor,created_at,diff",
    ...rows.map((row) =>
      [
        csvValue(row.id),
        csvValue(row.action),
        csvValue(row.entity),
        csvValue(row.entity_id),
        csvValue(row.actor),
        csvValue(row.created_at),
        csvValue(row.diff ? JSON.stringify(row.diff) : null),
      ].join(",")
    ),
  ];

  const body = csvLines.join("\n");
  return new NextResponse(body, { headers: csvHeaders() });
}

export function csvHeaders(): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="audit-export-${Date.now()}.csv"`,
  };
}

export function csvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const raw = String(value).replace(/"/g, '""');
  if (raw.includes(",") || raw.includes("\n") || raw.includes("\r") || raw.includes('"')) {
    return `"${raw}"`;
  }
  return raw;
}
