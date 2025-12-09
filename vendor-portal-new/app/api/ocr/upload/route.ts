import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import { OCRUploadReq } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const db = supabase as any;
  const auth = await getUserAndProfile();

  if (!auth) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const parsed = OCRUploadReq.safeParse({
    id_type: form.get("id_type") ?? undefined,
    id_number: form.get("id_number") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id_type, id_number } = parsed.data;

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const path = `ids/${auth.user.id}/${Date.now()}_${file.name}`;

  const { data: uploaded, error: uploadError } = await supabase.storage
    .from("private")
    .upload(path, bytes, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  let client: OpenAI;

  try {
    client = createOpenAiClient();
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
  const model = process.env.OPENAI_OCR_MODEL ?? "gpt-4.1-mini";

  const base64 = Buffer.from(bytes).toString("base64");

  const ocrPrompt = `Extract the ID number and holder details from this document. Only respond using the provided JSON schema.`;

  let response;
  let parsedOcr: OcrPayload;

  try {
    response = await client.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: ocrPrompt },
            { type: "input_image", image_base64: base64 },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "IdDocumentExtraction",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              id_type: { type: "string", enum: ["NID", "DL", "PASSPORT"] },
              id_number: { type: "string" },
              full_name: { type: "string" },
              given_names: { type: "string" },
              family_name: { type: "string" },
              birth_date: { type: "string" },
              expiry_date: { type: "string" },
              confidence: {
                type: "number",
                description: "Overall confidence between 0 and 1",
              },
            },
            required: ["id_number"],
          },
        },
      },
    });

    parsedOcr = parseOcrResponse(response);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 502 });
  }

  const extractedIdType = parsedOcr.id_type ?? id_type;
  const extractedIdNumber = parsedOcr.id_number ?? id_number;

  const ocr_json = {
    ...parsedOcr,
    source: "openai",
    response_id: response.id,
    model,
    received_at: new Date().toISOString(),
  } satisfies OcrPayload;

  const { error: updateError } = await db
    .from("members_app_profiles")
    .update({
      id_type: extractedIdType,
      id_number: extractedIdNumber,
      id_files: { front_url: uploaded?.path ?? path },
      ocr_json,
    })
    .eq("user_id", auth.user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    ocr_json,
    id_type: extractedIdType,
    id_number: extractedIdNumber,
    file: uploaded?.path ?? path,
  });
}

type OcrPayload = {
  id_type?: "NID" | "DL" | "PASSPORT";
  id_number?: string;
  full_name?: string;
  given_names?: string;
  family_name?: string;
  birth_date?: string;
  expiry_date?: string;
  confidence?: number;
  [key: string]: unknown;
};

const OcrSchema = z
  .object({
    id_type: z.enum(["NID", "DL", "PASSPORT"]).optional(),
    id_number: z.string().min(3).optional(),
    full_name: z.string().min(2).optional(),
    given_names: z.string().min(2).optional(),
    family_name: z.string().min(2).optional(),
    birth_date: z.string().min(4).optional(),
    expiry_date: z.string().min(4).optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .passthrough();

function createOpenAiClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }

  return new OpenAI({ apiKey });
}

function parseOcrResponse(
  response: Awaited<ReturnType<OpenAI["responses"]["create"]>>
): OcrPayload {
  const textCandidates: string[] = [];

  const outputText = (response as { output_text?: string }).output_text;

  if (typeof outputText === "string" && outputText.trim().length > 0) {
    textCandidates.push(outputText.trim());
  }

  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (!item?.content) continue;
      for (const content of item.content as Array<{ type?: string; text?: string }>) {
        if (content?.type === "output_text" && content.text && content.text.trim().length > 0) {
          textCandidates.push(content.text.trim());
        }
      }
    }
  }

  const textPayload = textCandidates.find((candidate) => candidate.length > 0);

  if (!textPayload) {
    throw new Error("OCR provider did not return text output");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(textPayload);
  } catch {
    throw new Error("Failed to parse OCR JSON output");
  }

  const validated = OcrSchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error("OCR payload validation failed");
  }

  return validated.data as OcrPayload;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown OCR provider error";
  }
}
