import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/observability/logger";
import { Buffer } from "node:buffer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import { requestStructuredJson } from "@/lib/openai";
import type { Database } from "@/lib/supabase/types";

interface RouteContext {
  params: { id: string };
}

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB safety cap

function assertPdfFile(file: File | null): asserts file is File {
  if (!file) {
    throw new Error("No file uploaded");
  }
  if (file.type !== "application/pdf") {
    throw new Error("Only PDF files are supported for OCR import");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("PDF exceeds the 8MB limit. Upload a smaller file or split it.");
  }
}

async function ensureIkiminaAccess(ikiminaId: string, saccoId: string | null) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .schema("app")
    .from("ikimina")
    .select("id, sacco_id")
    .eq("id", ikiminaId)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load ikimina context");
  }

  if (!data) {
    const notFoundError = new Error("Ikimina not found");
    (notFoundError as { status?: number }).status = 404;
    throw notFoundError;
  }

  const record = data as Pick<Database["app"]["Tables"]["ikimina"]["Row"], "id" | "sacco_id">;

  if (saccoId && record.sacco_id && saccoId !== record.sacco_id) {
    const forbidden = new Error("You do not have access to this ikimina");
    (forbidden as { status?: number }).status = 403;
    throw forbidden;
  }

  return record;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: ikiminaId } = context.params;
    if (!ikiminaId) {
      return NextResponse.json({ error: "Missing ikimina id" }, { status: 400 });
    }

    const auth = await getUserAndProfile();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (auth.profile.role !== "SYSTEM_ADMIN" && !auth.profile.sacco_id) {
      return NextResponse.json(
        { error: "SACCO assignment required for OCR import" },
        { status: 403 }
      );
    }

    const canImport =
      auth.profile.role === "SYSTEM_ADMIN" ||
      auth.profile.role === "SACCO_MANAGER" ||
      auth.profile.role === "SACCO_STAFF";

    if (!canImport) {
      return NextResponse.json(
        { error: "Your role is read-only for member imports" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a PDF file" }, { status: 400 });
    }

    assertPdfFile(file);

    await ensureIkiminaAccess(
      ikiminaId,
      auth.profile.role === "SYSTEM_ADMIN" ? null : auth.profile.sacco_id
    );

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["members"],
      properties: {
        members: {
          type: "array",
          maxItems: 300,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["full_name"],
            properties: {
              full_name: { type: "string", minLength: 3 },
              msisdn: { type: ["string", "null"] },
              member_code: { type: ["string", "null"] },
            },
          },
        },
        warnings: {
          type: "array",
          items: { type: "string" },
        },
      },
    } as const;

    const systemPrompt = `You are an assistant that extracts tables of savings group members from PDF lists.
Return JSON that matches the required schema.
The PDF may contain tabular data, handwritten numbers, or bullet lists.
Clean up obvious OCR artefacts, normalize whitespace, and keep member names in title case.
MSISDN values should use digits only (allow leading +250 or 07 formats) when present.
If a value cannot be read confidently, set it to null and include a warning.`;

    const userPrompt = `Extract all members for sacco staff review.
Focus on columns such as full name, phone/MSISDN, membership code or number.
Ignore headers, totals, or narrative text. Limit the result to 300 members.`;

    const response = await requestStructuredJson<{
      members: Array<{ full_name: string; msisdn: string | null; member_code: string | null }>;
      warnings?: string[];
    }>({
      systemPrompt,
      userPrompt,
      schemaName: "ikimina_member_ai_import",
      schema,
      attachments: [{ mimeType: "application/pdf", base64Data }],
      maxOutputTokens: 2500,
    });

    const members = (response.members ?? []).map((member) => ({
      full_name: member.full_name?.trim() ?? "",
      msisdn: member.msisdn?.trim() ?? null,
      member_code: member.member_code?.trim() ?? null,
    }));

    return NextResponse.json({
      members,
      warnings: response.warnings ?? [],
    });
  } catch (error) {
    logError("member-ocr error", error);
    const status = (error as { status?: number }).status ?? 500;
    const message = error instanceof Error ? error.message : "Failed to process PDF";
    return NextResponse.json({ error: message }, { status });
  }
}
