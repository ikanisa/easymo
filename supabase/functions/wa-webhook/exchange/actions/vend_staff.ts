import type { FlowExchangeRequest, FlowExchangeResponse } from "../../types.ts";
import { supabase } from "../../config.ts";
import { normalizeE164 } from "../../utils/phone.ts";
import {
  generateStaffVerificationCode,
  hashStaffVerificationCode,
} from "../../utils/staff_verification.ts";
import { notifyStaffInvite } from "../../notify/hooks.ts";

const VERIFICATION_TTL_HOURS = 24;

export async function handleVendorStaff(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  switch (req.action_id) {
    case "a_staff_refresh":
      return await refreshStaff(req);
    case "a_staff_add":
      return await addStaff(req);
    case "a_staff_remove":
      return await removeStaff(req);
    default:
      return {
        next_screen_id: req.screen_id,
        messages: [{
          level: "warning",
          text: `Unknown action ${req.action_id}`,
        }],
      };
  }
}

async function refreshStaff(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = String(req.context?.bar_id ?? req.fields?.bar_id ?? "");
  if (!barId) return missingBar(req);
  const payload = await buildStaffPayload(barId);
  if (!payload) return failure(req, "Failed to load staff");
  return {
    next_screen_id: "s_staff_list",
    data: payload,
  };
}

async function addStaff(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = String(req.context?.bar_id ?? req.fields?.bar_id ?? "");
  const rawPhone = String(req.fields?.phone ?? "");
  const requestedRole = String(req.fields?.role ?? "staff").toLowerCase();
  if (!barId) return missingBar(req);
  const phone = normalizeE164(rawPhone);
  if (!phone) {
    return failure(
      req,
      "Enter number in international format, e.g. +233501234567",
    );
  }
  const role = requestedRole === "manager" ? "manager" : "staff";

  const { data: bar, error: barError } = await supabase
    .from("bars")
    .select("id, name")
    .eq("id", barId)
    .maybeSingle();
  if (barError || !bar) return failure(req, "Bar not found");

  const existing = await supabase
    .from("bar_numbers")
    .select("id, is_active, verified_at, role")
    .eq("bar_id", barId)
    .eq("number_e164", phone)
    .maybeSingle();
  if (existing.error) return failure(req, "Could not read staff record");

  if (existing.data && existing.data.is_active && existing.data.verified_at) {
    if (existing.data.role !== role) {
      await supabase
        .from("bar_numbers")
        .update({ role, updated_at: new Date().toISOString() })
        .eq("id", existing.data.id);
    }
    const payload = await buildStaffPayload(barId);
    return {
      next_screen_id: "s_staff_list",
      data: payload ?? { bar_id: barId },
      messages: [{ level: "info", text: "Staff member already verified." }],
    };
  }

  const code = generateStaffVerificationCode();
  const verificationHash = await hashStaffVerificationCode(code, barId, phone);
  const expiresAt = new Date(
    Date.now() + VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
  );
  const upsertPayload = {
    bar_id: barId,
    number_e164: phone,
    role,
    is_active: true,
    verified_at: null,
    verification_code_hash: verificationHash,
    verification_expires_at: expiresAt.toISOString(),
    verification_attempts: 0,
    invited_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from("bar_numbers")
    .upsert(upsertPayload, { onConflict: "bar_id,number_e164" });
  if (upsertError) return failure(req, "Failed to save staff");

  await notifyStaffInvite({
    to: phone,
    barName: bar.name ?? "Your bar",
    code,
    expiresInHours: VERIFICATION_TTL_HOURS,
  });

  const payload = await buildStaffPayload(barId);
  return {
    next_screen_id: "s_staff_list",
    data: payload ?? { bar_id: barId },
    messages: [{
      level: "info",
      text:
        "Invite sent. Ask the staff member to reply CODE ###### within 24h.",
    }],
  };
}

async function removeStaff(
  req: FlowExchangeRequest,
): Promise<FlowExchangeResponse> {
  const barId = String(req.context?.bar_id ?? req.fields?.bar_id ?? "");
  const rawPhone = String(req.fields?.phone ?? "");
  if (!barId) return missingBar(req);
  const phone = normalizeE164(rawPhone) ?? rawPhone.trim();
  if (!phone) return failure(req, "Select a number to remove");
  await supabase
    .from("bar_numbers")
    .update({
      is_active: false,
      verification_code_hash: null,
      verification_expires_at: null,
      verification_attempts: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("bar_id", barId)
    .eq("number_e164", phone);
  const payload = await buildStaffPayload(barId);
  return {
    next_screen_id: "s_staff_list",
    data: payload ?? { bar_id: barId },
    messages: [{ level: "info", text: "Staff removed." }],
  };
}

async function buildStaffPayload(
  barId: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from("bar_numbers")
    .select(
      "number_e164, role, is_active, verified_at, verification_expires_at",
    )
    .eq("bar_id", barId)
    .order("role", { ascending: true })
    .order("number_e164", { ascending: true });
  if (error) return null;
  const rows = data ?? [];
  const lines = rows.length
    ? rows.map((row) => formatStaffLine(row)).join("\n")
    : "No staff numbers yet.";
  const options = rows
    .filter((row) => row.is_active)
    .map((row) => ({
      id: row.number_e164,
      title: `${row.number_e164} (${row.role})`,
    }));
  return {
    bar_id: barId,
    staff_text: lines,
    staff_options: options,
  };
}

function formatStaffLine(row: {
  number_e164: string;
  role: string;
  is_active: boolean;
  verified_at: string | null;
  verification_expires_at: string | null;
}): string {
  const statusBits: string[] = [];
  if (!row.is_active) {
    statusBits.push("inactive");
  } else if (!row.verified_at) {
    statusBits.push(
      row.verification_expires_at ? "pending verification" : "invite needed",
    );
  } else {
    statusBits.push("verified");
  }
  return `${row.role.toUpperCase()}: ${row.number_e164} (${
    statusBits.join(", ")
  })`;
}

function missingBar(req: FlowExchangeRequest): FlowExchangeResponse {
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "error", text: "Missing bar context" }],
  };
}

function failure(
  req: FlowExchangeRequest,
  message: string,
): FlowExchangeResponse {
  return {
    next_screen_id: req.screen_id,
    messages: [{ level: "error", text: message }],
  };
}
