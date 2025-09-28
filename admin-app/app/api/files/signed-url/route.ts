import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const querySchema = z.object({
  bucket: z.string().min(1),
  path: z.string().min(1),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { bucket, path } = querySchema.parse({
      bucket: searchParams.get("bucket"),
      path: searchParams.get("path"),
    });

    const adminClient = getSupabaseAdminClient();
    if (adminClient) {
      try {
        const { data, error } = await adminClient.storage
          .from(bucket)
          .createSignedUrl(path, 60);
        if (!error && data?.signedUrl) {
          return NextResponse.json({
            url: data.signedUrl,
            expiresIn: 60,
            integration: { target: "storageSignedUrl", status: "ok" as const },
          });
        }
        console.error("Supabase signed URL failed", error);
      } catch (err) {
        console.error("Supabase storage error", err);
      }
    }

    // Fallback mock URL
    return NextResponse.json({
      url: `https://example.com/mock/${encodeURIComponent(path)}`,
      expiresIn: 0,
      message: "Signed URLs require Supabase credentials.",
      integration: {
        target: "storageSignedUrl",
        status: "degraded",
        reason: "mock_signed_url",
        message:
          "Returning mock URL because storage credentials are not configured.",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "invalid_query",
        details: error.flatten(),
      }, { status: 400 });
    }
    console.error("Signed URL generation failed", error);
    return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
  }
}
