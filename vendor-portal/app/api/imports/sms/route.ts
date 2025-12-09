import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/observability/logger";
import { z } from "zod";
import { getUserAndProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canImportStatements, isSystemAdmin } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const entrySchema = z.object({
  rawText: z.string().min(5),
  receivedAt: z.string().optional(),
  vendorMeta: z.record(z.unknown()).optional(),
});

const payloadSchema = z.object({
  saccoId: z.string().uuid().optional(),
  entries: z.array(entrySchema).min(1).max(200),
});

type ParsedTransaction = {
  msisdn: string;
  amount: number;
  txn_id?: string;
  txnId?: string;
  timestamp?: string;
  reference?: string | null;
  confidence?: number;
};

type PaymentRow = {
  id: string;
  txn_id: string;
  status: string;
};

type IkiminaRow = {
  id: string;
  code: string;
  name: string | null;
};

type MemberRow = {
  id: string;
  member_code: string | null;
  full_name: string | null;
  ikimina_id: string | null;
};

const toIsoString = (value: string | undefined) => {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
};

const normalizeTxnId = (value: string | undefined) => (value ?? "").trim();

const normalizeAmount = (value: number | string | undefined) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const clampConfidence = (value: number | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
};

const parseReference = (reference: string | null | undefined) => {
  if (!reference) {
    return { saccoCode: null, groupCode: null, memberCode: null };
  }
  const parts = reference
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3) {
    return { saccoCode: null, groupCode: null, memberCode: null };
  }
  return {
    saccoCode: parts[1] ?? null,
    groupCode: parts[2] ?? null,
    memberCode: parts[3] ?? null,
  };
};

const buildDuplicateSet = (items: Array<{ txnId: string }>) => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    const key = item.txnId.toUpperCase();
    if (seen.has(key)) {
      duplicates.add(key);
    } else if (key) {
      seen.add(key);
    }
  }
  return duplicates;
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

    const { saccoId: requestedSaccoId, entries } = parsed.data;

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

    const adminClient = createSupabaseAdminClient();

    const parseResults: Array<{
      rawText: string;
      parsed: ParsedTransaction | null;
      parseSource: string | null;
      modelUsed: string | null;
      error: string | null;
      receivedAt: string | undefined;
    }> = [];

    for (const entry of entries) {
      try {
        const { data, error } = await (adminClient.functions.invoke as any)("parse-sms", {
          body: {
            rawText: entry.rawText,
            receivedAt: entry.receivedAt,
            vendorMeta: entry.vendorMeta,
          },
        });

        if (error || !data) {
          parseResults.push({
            rawText: entry.rawText,
            parsed: null,
            parseSource: null,
            modelUsed: null,
            error: error?.message ?? "Unable to parse SMS",
            receivedAt: entry.receivedAt,
          });
          continue;
        }

        if (!data.success || !data.parsed) {
          parseResults.push({
            rawText: entry.rawText,
            parsed: null,
            parseSource: data.parseSource ?? null,
            modelUsed: data.modelUsed ?? null,
            error: data.error ?? "Parsing failed",
            receivedAt: entry.receivedAt,
          });
          continue;
        }

        parseResults.push({
          rawText: entry.rawText,
          parsed: data.parsed,
          parseSource: data.parseSource ?? null,
          modelUsed: data.modelUsed ?? null,
          error: null,
          receivedAt: entry.receivedAt,
        });
      } catch (invokeError) {
        logError("imports/sms invoke failed", invokeError);
        parseResults.push({
          rawText: entry.rawText,
          parsed: null,
          parseSource: null,
          modelUsed: null,
          error: invokeError instanceof Error ? invokeError.message : "Unknown parse error",
          receivedAt: entry.receivedAt,
        });
      }
    }

    const successful = parseResults.filter((item) => item.parsed);
    const normalized = successful.map((item) => {
      const parsedTxn = item.parsed as ParsedTransaction;
      const txnId = normalizeTxnId(parsedTxn.txn_id ?? parsedTxn.txnId);
      const timestamp = toIsoString(parsedTxn.timestamp ?? item.receivedAt);
      const amount = normalizeAmount(parsedTxn.amount);
      const reference = parsedTxn.reference ?? null;
      const confidence = clampConfidence(parsedTxn.confidence);
      const refParts = parseReference(reference);
      return {
        rawText: item.rawText,
        txnId,
        timestamp,
        amount,
        reference,
        confidence,
        refParts,
      };
    });

    const payloadDuplicateSet = buildDuplicateSet(normalized);

    const txnIds = normalized.map((item) => item.txnId).filter(Boolean);
    const groupCodes = Array.from(
      new Set(
        normalized
          .map((item) => item.refParts.groupCode)
          .filter((code): code is string => Boolean(code))
      )
    );
    const memberCodes = Array.from(
      new Set(
        normalized
          .map((item) =>
            item.refParts.memberCode
              ? `${item.refParts.groupCode ?? ""}:${item.refParts.memberCode}`
              : null
          )
          .filter((code): code is string => Boolean(code))
      )
    );

    const supabase = await createSupabaseServerClient();

    let existingPayments: PaymentRow[] = [];
    if (txnIds.length > 0) {
      const { data: paymentRows, error: paymentError } = await supabase
        .from("payments")
        .select("id, txn_id, status")
        .eq("sacco_id", saccoScope)
        .in("txn_id", txnIds)
        .returns<PaymentRow[]>();
      if (paymentError) {
        logError("imports/sms payments lookup failed", paymentError);
        return NextResponse.json({ error: "Failed to inspect existing payments" }, { status: 500 });
      }
      existingPayments = paymentRows ?? [];
    }

    let groupRecords: IkiminaRow[] = [];
    if (groupCodes.length > 0) {
      const { data: groups, error: groupError } = await supabase
        .from("ibimina")
        .select("id, code, name")
        .eq("sacco_id", saccoScope)
        .in("code", groupCodes)
        .returns<IkiminaRow[]>();
      if (groupError) {
        logError("imports/sms ikimina lookup failed", groupError);
        return NextResponse.json(
          { error: "Failed to resolve ikimina references" },
          { status: 500 }
        );
      }
      groupRecords = groups ?? [];
    }

    let memberRecords: MemberRow[] = [];
    if (memberCodes.length > 0) {
      const memberCodeValues = Array.from(
        new Set(memberCodes.map((entry) => entry.split(":")[1]).filter((code) => code))
      );
      const groupIds = Array.from(new Set(groupRecords.map((group) => group.id)));
      const { data: members, error: memberError } = await supabase
        .from("ikimina_members_public")
        .select("id, member_code, full_name, ikimina_id")
        .eq("sacco_id", saccoScope)
        .in("ikimina_id", groupIds)
        .in("member_code", memberCodeValues)
        .returns<MemberRow[]>();
      if (memberError) {
        logError("imports/sms members lookup failed", memberError);
        return NextResponse.json({ error: "Failed to resolve member references" }, { status: 500 });
      }
      memberRecords = members ?? [];
      // Ensure members align to existing groups by code mapping.
      memberRecords = memberRecords.filter((member) => {
        if (!member.ikimina_id) return false;
        const group = groupRecords.find((candidate) => candidate.id === member.ikimina_id);
        return Boolean(group && member.member_code);
      });
    }

    const paymentMap = new Map(
      existingPayments.map((payment) => [payment.txn_id.toUpperCase(), payment] as const)
    );
    const groupMap = new Map(groupRecords.map((group) => [group.code, group] as const));
    const memberMap = new Map(
      memberRecords
        .filter((member) => member.member_code && member.ikimina_id)
        .map((member) => [`${member.ikimina_id}:${member.member_code}`, member] as const)
    );

    let parsedCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    let matchedCount = 0;
    let unallocatedCount = 0;
    let unknownReferenceCount = 0;

    const results = parseResults.map((item) => {
      if (!item.parsed) {
        errorCount += 1;
        return {
          rawText: item.rawText,
          parsed: null,
          error: item.error ?? "Parsing failed",
          parseSource: item.parseSource,
          modelUsed: item.modelUsed,
        };
      }

      parsedCount += 1;
      const parsedTxn = item.parsed as ParsedTransaction;
      const txnId = normalizeTxnId(parsedTxn.txn_id ?? parsedTxn.txnId);
      const timestamp = toIsoString(parsedTxn.timestamp ?? item.receivedAt);
      const amount = normalizeAmount(parsedTxn.amount);
      const reference = parsedTxn.reference ?? null;
      const confidence = clampConfidence(parsedTxn.confidence);
      const { groupCode, memberCode } = parseReference(reference);

      const duplicate = Boolean(
        txnId &&
          (paymentMap.has(txnId.toUpperCase()) || payloadDuplicateSet.has(txnId.toUpperCase()))
      );
      if (duplicate) {
        duplicateCount += 1;
      }

      let groupMatch: IkiminaRow | null = null;
      let memberMatch: MemberRow | null = null;

      if (groupCode) {
        groupMatch = groupMap.get(groupCode) ?? null;
      }

      if (groupMatch && memberCode) {
        const key = `${groupMatch.id}:${memberCode}` as `${string}:${string}`;
        memberMatch = memberMap.get(key) ?? null;
      }

      if (!groupMatch) {
        unknownReferenceCount += 1;
      } else if (!memberMatch) {
        unallocatedCount += 1;
      } else {
        matchedCount += 1;
      }

      return {
        rawText: item.rawText,
        parsed: {
          txnId,
          occurredAt: timestamp,
          amount,
          reference,
          msisdn: parsedTxn.msisdn,
          confidence,
        },
        duplicate,
        group: groupMatch,
        member: memberMatch,
        parseSource: item.parseSource,
        modelUsed: item.modelUsed,
      };
    });

    return NextResponse.json({
      success: true,
      saccoId: saccoScope,
      results,
      summary: {
        total: entries.length,
        parsed: parsedCount,
        errors: errorCount,
        duplicates: duplicateCount,
        matched: matchedCount,
        unallocated: unallocatedCount,
        unknownReference: unknownReferenceCount,
      },
    });
  } catch (error) {
    logError("imports/sms unexpected", error);
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}
