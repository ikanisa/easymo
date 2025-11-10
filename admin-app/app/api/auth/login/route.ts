import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminCredential } from "@/lib/server/admin-credentials";
import { writeSessionToCookies } from "@/lib/server/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const payload = loginSchema.parse(body);
    const credential = verifyAdminCredential(payload.email, payload.password);

    if (!credential) {
      return NextResponse.json(
        { error: "invalid_credentials", message: "Email or password is incorrect." },
        { status: 401 },
      );
    }

    writeSessionToCookies({
      actorId: credential.actorId,
      label: credential.label ?? credential.username ?? credential.email,
    });

    const response = NextResponse.json({
      actorId: credential.actorId,
      label: credential.label ?? credential.username ?? null,
    });
    response.headers.set("x-admin-session-refreshed", "true");
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_request", issues: error.issues }, { status: 400 });
    }
    console.error("auth.login.unhandled", error);
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }
}
