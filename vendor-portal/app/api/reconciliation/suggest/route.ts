import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/observability/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import { requestStructuredJson } from "@/lib/openai";
import type { Database } from "@/lib/supabase/types";

interface SuggestionPayload {
  paymentId?: string;
}

type PaymentRow = Database["app"]["Tables"]["payments"]["Row"];
type MemberViewRow = Database["public"]["Views"]["ikimina_members_public"]["Row"];

function normalizeDigits(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SuggestionPayload | null;
    const paymentId = body?.paymentId;

    if (!paymentId) {
      return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });
    }

    const auth = await getUserAndProfile();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canRequestSuggestion =
      auth.profile.role === "SYSTEM_ADMIN" ||
      auth.profile.role === "SACCO_MANAGER" ||
      auth.profile.role === "SACCO_STAFF";

    if (!canRequestSuggestion) {
      return NextResponse.json({ error: "Your role is read-only" }, { status: 403 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: payment, error: paymentError } = await supabase
      .schema("app")
      .from("payments")
      .select(
        "id, amount, msisdn, msisdn_masked, reference, ikimina_id, sacco_id, occurred_at, member_id, currency"
      )
      .eq("id", paymentId)
      .maybeSingle();

    if (paymentError) {
      logError("suggestion payment lookup failed", paymentError);
      throw new Error("Failed to load payment");
    }

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const paymentRecord = payment as Pick<
      PaymentRow,
      | "id"
      | "amount"
      | "msisdn"
      | "reference"
      | "ikimina_id"
      | "sacco_id"
      | "occurred_at"
      | "currency"
      | "member_id"
    >;

    if (auth.profile.role !== "SYSTEM_ADMIN") {
      if (!auth.profile.sacco_id) {
        return NextResponse.json(
          { error: "Assign yourself to a SACCO to request AI suggestions" },
          { status: 403 }
        );
      }
      if (auth.profile.sacco_id !== paymentRecord.sacco_id) {
        return NextResponse.json(
          { error: "You do not have access to this payment" },
          { status: 403 }
        );
      }
    }

    const candidateLimit = 25;
    let memberQuery = supabase
      .from("ikimina_members_public")
      .select("id, full_name, member_code, msisdn, ikimina_id, ikimina_name, sacco_id")
      .eq("sacco_id", paymentRecord.sacco_id)
      .limit(candidateLimit);

    if (paymentRecord.ikimina_id) {
      memberQuery = memberQuery.eq("ikimina_id", paymentRecord.ikimina_id);
    }

    const { data: candidates, error: candidateError } = await memberQuery;

    if (candidateError) {
      logError("candidate fetch error", candidateError);
      throw new Error("Failed to load candidate members");
    }

    const normalizedMsisdn = normalizeDigits(paymentRecord.msisdn);
    const paymentLast4 = normalizedMsisdn.slice(-4) || null;
    const referenceUpper = (paymentRecord.reference ?? "").toUpperCase();

    const candidateSummaries = (candidates ?? []).map((candidate) => {
      const candidateRecord = candidate as Pick<
        MemberViewRow,
        "id" | "full_name" | "member_code" | "msisdn" | "ikimina_id" | "ikimina_name"
      >;
      const candidateDigits = normalizeDigits(candidateRecord.msisdn ?? "");
      const candidateLast4 = candidateDigits.slice(-4) || null;
      const lastFourMatch =
        paymentLast4 && candidateLast4 ? Number(paymentLast4 === candidateLast4) : 0;
      const codeMatch =
        candidateRecord.member_code && referenceUpper
          ? Number(referenceUpper.includes(candidateRecord.member_code.toUpperCase()))
          : 0;

      return {
        id: candidateRecord.id,
        full_name: candidateRecord.full_name,
        member_code: candidateRecord.member_code,
        msisdn_masked: candidateRecord.msisdn,
        ikimina_id: candidateRecord.ikimina_id,
        ikimina_name: candidateRecord.ikimina_name,
        heuristics: {
          last_four_match: lastFourMatch,
          code_in_reference: codeMatch,
        },
      };
    });

    if (candidateSummaries.length === 0) {
      return NextResponse.json({
        suggestion: null,
        alternatives: [],
        payment: { id: paymentRecord.id },
      });
    }

    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["suggestion", "alternatives"],
      properties: {
        suggestion: {
          type: ["object", "null"],
          additionalProperties: false,
          required: ["member_id", "confidence", "reason"],
          properties: {
            member_id: { type: "string" },
            ikimina_id: { type: ["string", "null"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reason: { type: "string", minLength: 6 },
            member_code: { type: ["string", "null"] },
          },
        },
        alternatives: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["member_id", "confidence", "reason"],
            properties: {
              member_id: { type: "string" },
              ikimina_id: { type: ["string", "null"] },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              reason: { type: "string", minLength: 6 },
              member_code: { type: ["string", "null"] },
            },
          },
        },
      },
    } as const;

    const paymentSummary = {
      id: paymentRecord.id,
      amount: paymentRecord.amount,
      currency: paymentRecord.currency,
      occurred_at: paymentRecord.occurred_at,
      msisdn_last4: paymentLast4,
      reference: paymentRecord.reference,
      ikimina_id: paymentRecord.ikimina_id,
    } satisfies Partial<PaymentRow> & { msisdn_last4: string | null };

    const systemPrompt = `You help Umurenge SACCO staff reconcile deposits to group members.
You receive one payment and a shortlist of possible members with simple heuristics.
Only recommend a member when the evidence is strong. Otherwise return null.
Never invent IDs or values.`;

    const userPrompt = `Payment summary: ${JSON.stringify(paymentSummary)}.
Candidates (array of up to ${candidateSummaries.length}): ${JSON.stringify(candidateSummaries)}.
Use the heuristics to support your reasoning (1 means strong signal, 0 means none).
Prefer matches with exact last four digit or member-code agreement.
If confidence is below 0.6 set suggestion to null, but you may populate up to three alternative options ordered by confidence.`;

    const aiResult = await requestStructuredJson<{
      suggestion: {
        member_id: string;
        ikimina_id: string | null;
        confidence: number;
        reason: string;
        member_code?: string | null;
      } | null;
      alternatives: Array<{
        member_id: string;
        ikimina_id: string | null;
        confidence: number;
        reason: string;
        member_code?: string | null;
      }>;
    }>({
      systemPrompt,
      userPrompt,
      schemaName: "ikimina_reconciliation_suggestion",
      schema,
      maxOutputTokens: 1200,
    });

    return NextResponse.json({
      payment: { id: paymentRecord.id },
      suggestion: aiResult.suggestion,
      alternatives: aiResult.alternatives ?? [],
    });
  } catch (error) {
    logError("reconciliation suggest error", error);
    const message = error instanceof Error ? error.message : "Failed to generate suggestion";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
