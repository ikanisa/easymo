import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/observability/logger";
import { z } from "zod";
import { getUserAndProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canImportStatements, hasSaccoReadAccess, isSystemAdmin } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rowSchema = z.object({
  occurredAt: z
    .string()
    .min(4)
    .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid occurredAt" }),
  txnId: z.string().min(3),
  msisdn: z.string().min(6),
  amount: z.coerce.number().positive(),
  reference: z
    .string()
    .trim()
    .transform((value) => (value.length === 0 ? null : value))
    .optional()
    .nullable(),
});

const payloadSchema = z.object({
  saccoId: z.string().uuid().optional(),
  ikiminaId: z.string().uuid().optional(),
  rows: z.array(rowSchema).min(1).max(5000),
  dryRun: z.boolean().optional(),
});

type ParsedPayload = z.infer<typeof payloadSchema>;

type IkiminaRecord = {
  id: string;
  code: string;
  sacco_id: string;
};

const normalizeTxnId = (value: string) => value.trim();

const normalizeMsisdn = (value: string) => value.replace(/\s+/g, "").trim();

const dedupeTxnIds = (rows: ParsedPayload["rows"]) => {
  const encountered = new Set<string>();
  let duplicateCount = 0;
  for (const row of rows) {
    const key = normalizeTxnId(row.txnId).toUpperCase();
    if (encountered.has(key)) {
      duplicateCount += 1;
    } else {
      encountered.add(key);
    }
  }
  return duplicateCount;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await getUserAndProfile();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = payloadSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { saccoId: requestedSaccoId, ikiminaId, rows, dryRun = false } = parsed.data;

    const saccoScope = (() => {
      if (isSystemAdmin(auth.profile)) {
        return requestedSaccoId ?? auth.profile.sacco_id ?? null;
      }
      return auth.profile.sacco_id ?? null;
    })();

    if (!saccoScope) {
      return NextResponse.json({ error: "SACCO context required" }, { status: 422 });
    }

    if (!canImportStatements(auth.profile, saccoScope)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createSupabaseServerClient();

    let ikiminaRecord: IkiminaRecord | null = null;
    if (ikiminaId) {
      const { data: group, error: groupError } = await supabase
        .from("ibimina")
        .select("id, code, sacco_id")
        .eq("id", ikiminaId)
        .maybeSingle();

      if (groupError) {
        logError("imports/statement ikimina lookup failed", groupError);
        return NextResponse.json({ error: "Failed to validate ikimina" }, { status: 500 });
      }

      if (!group) {
        return NextResponse.json({ error: "Ikimina not found" }, { status: 404 });
      }

      const typed = group as IkiminaRecord;
      if (typed.sacco_id !== saccoScope) {
        return NextResponse.json(
          { error: "Ikimina does not belong to the selected SACCO" },
          { status: 400 }
        );
      }
      ikiminaRecord = typed;
    }

    if (!hasSaccoReadAccess(auth.profile, saccoScope)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clientDuplicateCount = dedupeTxnIds(rows);

    const normalizedRows = rows.map((row) => {
      const occurred = new Date(row.occurredAt);
      const isoOccurred = Number.isNaN(occurred.getTime())
        ? row.occurredAt
        : occurred.toISOString();
      return {
        occurredAt: isoOccurred,
        txnId: normalizeTxnId(row.txnId),
        msisdn: normalizeMsisdn(row.msisdn),
        amount: Number(row.amount),
        reference: row.reference ?? null,
      };
    });

    if (dryRun) {
      return NextResponse.json({
        success: true,
        saccoId: saccoScope,
        ikiminaId: ikiminaRecord?.id ?? null,
        inserted: 0,
        duplicates: clientDuplicateCount,
        posted: 0,
        unallocated: 0,
        dryRun: true,
        rowCount: normalizedRows.length,
      });
    }

    const adminClient = createSupabaseAdminClient();
    const { data, error } = await (adminClient.functions.invoke as any)("import-statement", {
      body: {
        saccoId: saccoScope,
        ikiminaId: ikiminaRecord?.id ?? null,
        rows: normalizedRows,
        actorId: auth.profile.id,
      },
    });

    if (error) {
      logError("imports/statement invoke failed", error);
      return NextResponse.json(
        { error: error.message ?? "Statement import failed" },
        { status: 502 }
      );
    }

    const summary = data ?? { inserted: 0, duplicates: 0, posted: 0, unallocated: 0 };

    return NextResponse.json({
      success: true,
      saccoId: saccoScope,
      ikiminaId: ikiminaRecord?.id ?? null,
      inserted: summary.inserted,
      duplicates: summary.duplicates + clientDuplicateCount,
      posted: summary.posted,
      unallocated: summary.unallocated,
      clientDuplicates: clientDuplicateCount,
      rowCount: normalizedRows.length,
    });
  } catch (error) {
    logError("imports/statement unexpected", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
