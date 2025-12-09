import { z } from "zod";

import { logError } from "@/lib/observability/logger";

export interface OnboardingOcrResult {
  name: string | null;
  idNumber: string | null;
  dob: string | null;
  sex: string | null;
  address: string | null;
}

export const onboardingPayloadSchema = z.object({
  whatsapp_msisdn: z.string().min(5, "WhatsApp number is required"),
  momo_msisdn: z.string().min(5, "MoMo number is required"),
  ocr_json: z
    .object({
      name: z.string().nullable().optional(),
      idNumber: z.string().nullable().optional(),
      dob: z.string().nullable().optional(),
      sex: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  preferred_language: z.string().trim().toLowerCase().min(2).max(5).optional(),
});

export type OnboardingPayload = z.infer<typeof onboardingPayloadSchema>;

export type OnboardingProfileResult = { success: true } | { success: false; error: string };

export async function upsertMemberOnboardingProfile(
  legacyClient: any,
  userId: string,
  data: OnboardingPayload
): Promise<OnboardingProfileResult> {
  const now = new Date().toISOString();

  const updatePayload = {
    whatsapp_msisdn: data.whatsapp_msisdn,
    momo_msisdn: data.momo_msisdn,
    ocr_json: data.ocr_json ?? null,
    id_number: data.ocr_json?.idNumber ?? null,
    lang: data.preferred_language ?? null,
    updated_at: now,
  };

  const { data: existing, error: existingError } = await legacyClient
    .from("members_app_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    logError("member.onboarding.load_failed", existingError);
    return { success: false, error: "Unable to complete onboarding" };
  }

  if (existing) {
    const { error } = await legacyClient
      .from("members_app_profiles")
      .update(updatePayload)
      .eq("user_id", userId);

    if (error) {
      logError("member.onboarding.update_failed", error);
      return { success: false, error: "Unable to update profile" };
    }
  } else {
    const insertPayload = {
      user_id: userId,
      whatsapp_msisdn: data.whatsapp_msisdn,
      momo_msisdn: data.momo_msisdn,
      ocr_json: data.ocr_json ?? null,
      id_number: data.ocr_json?.idNumber ?? null,
      lang: data.preferred_language ?? null,
      created_at: now,
      updated_at: now,
    };

    const { error } = await legacyClient.from("members_app_profiles").insert(insertPayload);

    if (error) {
      logError("member.onboarding.insert_failed", error);
      return { success: false, error: "Unable to create profile" };
    }
  }

  return { success: true };
}
