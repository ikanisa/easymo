import { logStructuredEvent } from "../../_shared/observability.ts";
import type { SupabaseClient } from "../deps.ts";
import { sendText } from "../wa/client.ts";

type ContactColumns = {
  whatsapp_number?: string | null;
  phone_number?: string | null;
  whatsapp_e164?: string | null;
  wa_id?: string | null;
};

async function resolveContact(
  client: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("profiles")
    .select("whatsapp_number, phone_number, whatsapp_e164, wa_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    await logStructuredEvent("TRIP_NOTIFICATION_CONTACT_FAILED", {
      userId,
      error: error.message,
    }, "error");
    return null;
  }

  return data?.whatsapp_number ?? data?.phone_number ?? data?.whatsapp_e164 ?? data?.wa_id ?? null;
}

async function notifyUser(
  client: SupabaseClient,
  userId: string,
  audience: "passenger" | "driver",
  message: string,
): Promise<boolean> {
  const contact = await resolveContact(client, userId);
  if (!contact) {
    await logStructuredEvent("TRIP_NOTIFICATION_MISSING_CONTACT", {
      audience,
      userId,
    }, "warn");
    return false;
  }

  try {
    await sendText(contact, message);
    await logStructuredEvent("TRIP_NOTIFICATION_SENT", {
      audience,
      userId,
    });
    return true;
  } catch (error) {
    await logStructuredEvent("TRIP_NOTIFICATION_SEND_FAILED", {
      audience,
      userId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return false;
  }
}

export async function notifyPassenger(
  client: SupabaseClient,
  passengerId: string,
  message: string,
): Promise<boolean> {
  return await notifyUser(client, passengerId, "passenger", message);
}

export async function notifyDriver(
  client: SupabaseClient,
  driverId: string,
  message: string,
): Promise<boolean> {
  return await notifyUser(client, driverId, "driver", message);
}
