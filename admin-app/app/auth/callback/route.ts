import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import type { Database } from "@/src/v2/lib/supabase/database.types";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");
  const origin = requestUrl.origin;

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server Component - ignore cookie setting errors
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Handle different callback types
      if (type === "recovery") {
        // Password reset - redirect to reset password page
        return NextResponse.redirect(`${origin}/reset-password`);
      } else if (type === "signup" || type === "email_confirm") {
        // Email verification - redirect to login with success message
        return NextResponse.redirect(`${origin}/login?verified=true`);
      } else if (type === "magiclink") {
        // Magic link login - redirect to dashboard
        return NextResponse.redirect(`${origin}/dashboard`);
      }
      
      // Default: redirect to dashboard for any authenticated session
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // Return to login page if there's an error or no code
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
