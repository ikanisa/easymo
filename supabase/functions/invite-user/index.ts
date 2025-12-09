import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serveWithObservability } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = [
  "SYSTEM_ADMIN",
  "SACCO_MANAGER",
  "SACCO_STAFF",
  "SACCO_VIEWER",
  "DISTRICT_MANAGER",
  "MFI_MANAGER",
  "MFI_STAFF",
] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

interface InviteRequestBody {
  email: string;
  role: AllowedRole;
  saccoId?: string | null; // legacy
  org_type?: "SACCO" | "MFI" | "DISTRICT" | null;
  org_id?: string | null;
}

serveWithObservability("invite-user", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase credentials");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: requester },
      error: requesterError,
    } = await userClient.auth.getUser();

    if (requesterError || !requester) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: requesterProfile, error: profileError } = await serviceClient
      .from("users")
      .select("role")
      .eq("id", requester.id)
      .single();

    if (profileError || requesterProfile?.role !== "SYSTEM_ADMIN") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: InviteRequestBody = await req.json();
    const email = body?.email?.trim().toLowerCase();
    const role = body?.role;
    // Normalize organization assignment
    let requestedType = body?.org_type ?? null;
    let requestedOrgId = body?.org_id ?? null;
    const saccoIdLegacy = body?.saccoId || null;
    if (!requestedType && saccoIdLegacy) {
      requestedType = "SACCO";
      requestedOrgId = saccoIdLegacy;
    }

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requiresSacco =
      role === "SACCO_MANAGER" || role === "SACCO_STAFF" || role === "SACCO_VIEWER";
    const requiresDistrict = role === "DISTRICT_MANAGER";
    const requiresMfi = role === "MFI_MANAGER" || role === "MFI_STAFF";

    if (role !== "SYSTEM_ADMIN") {
      if (requiresSacco && (requestedType !== "SACCO" || !requestedOrgId)) {
        return new Response(JSON.stringify({ error: "SACCO assignment required for this role" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (requiresDistrict && (requestedType !== "DISTRICT" || !requestedOrgId)) {
        return new Response(
          JSON.stringify({ error: "District assignment required for this role" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (requiresMfi && (requestedType !== "MFI" || !requestedOrgId)) {
        return new Response(JSON.stringify({ error: "MFI assignment required for this role" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const temporaryPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: false,
    });

    if (createError || !created.user) {
      console.error("User creation failed", createError);
      throw createError || new Error("Unable to create user");
    }

    const { error: updateError } = await serviceClient
      .from("users")
      .update({ role, sacco_id: requiresSacco ? requestedOrgId : null })
      .eq("id", created.user.id);

    if (updateError) {
      console.error("Failed to update user profile", updateError);
      throw updateError;
    }

    // Optional: reflect in org_memberships if the table exists
    try {
      if (requestedOrgId) {
        const res = await serviceClient
          .schema("app")
          .from("org_memberships")
          .upsert(
            { user_id: created.user.id, org_id: requestedOrgId, role },
            { onConflict: "user_id,org_id" }
          );
        if (res.error) {
          console.warn("org_memberships upsert failed", res.error);
        }
      }
    } catch (e) {
      console.warn("org_memberships upsert attempt failed", e);
    }

    // Mark account as requiring password reset on first login
    if (created.user) {
      await serviceClient.auth.admin.updateUserById(created.user.id, {
        user_metadata: { pw_reset_required: true },
      });
    }

    // Send a custom welcome email with the temporary password if webhook is configured
    try {
      const webhookUrl = Deno.env.get("EMAIL_WEBHOOK_URL");
      const webhookKey = Deno.env.get("EMAIL_WEBHOOK_KEY");
      if (webhookUrl) {
        const appUrl = Deno.env.get("STAFF_APP_URL") ?? "";
        const firstLoginUrl = appUrl
          ? `${appUrl.replace(/\/$/, "")}/auth/first-login?email=${encodeURIComponent(email)}`
          : `/auth/first-login?email=${encodeURIComponent(email)}`;
        await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(webhookKey ? { Authorization: `Bearer ${webhookKey}` } : {}),
          },
          body: JSON.stringify({
            to: email,
            subject: "Welcome to the Staff Console",
            html: `<p>Hello,</p><p>You have been added as <b>${role}</b> for your organization.</p><p>Temporary password: <b>${temporaryPassword}</b></p><p>For your security, you must set a new password at first login.</p><p><a href="${firstLoginUrl}">Open Staff Console</a></p>`,
          }),
        });
      } else {
        // Fallback to Supabase invite if no webhook is configured
        const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email);
        if (inviteError) {
          console.warn("Failed to send invitation email", inviteError);
        }
      }
    } catch (e) {
      console.warn("Custom email dispatch failed; attempting Supabase invite", e);
      const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email);
      if (inviteError) {
        console.warn("Failed to send invitation email", inviteError);
      }
    }

    const auditDiff = {
      email,
      role,
      org_type: requestedType,
      org_id: requestedOrgId ?? null,
      sacco_id: requiresSacco ? (requestedOrgId ?? null) : null,
    };

    await serviceClient.schema("app").from("audit_logs").insert({
      actor: requester.id,
      action: "INVITE_USER",
      entity: "users",
      entity_id: created.user.id,
      diff: auditDiff,
    });

    return new Response(
      JSON.stringify({
        success: true,
        userId: created.user.id,
        temporaryPassword,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Invite user error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
