/**
 * Driver Verification with OCR
 * Handles driver license and insurance certificate verification
 * Uses OpenAI GPT-4 Vision and Google Gemini for OCR
 */

import type { MessageContext } from "../types.ts";
import { sendWhatsAppMessage } from "../wa/client.ts";
import { logEvent } from "../observe/logger.ts";
import { t } from "../i18n/index.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

interface LicenseOCRResult {
  success: boolean;
  data?: {
    licenseNumber: string;
    fullName: string;
    dateOfBirth?: string;
    issueDate?: string;
    expiryDate: string;
    licenseClass: string;
    nationality?: string;
    address?: string;
    gender?: string;
    bloodGroup?: string;
  };
  error?: string;
  rawData?: any;
}

interface InsuranceOCRResult {
  success: boolean;
  data?: {
    insurerName: string;
    policyNumber: string;
    certificateNumber: string;
    policyInception: string;
    policyExpiry: string;
    carteJauneNumber?: string;
    carteJauneExpiry?: string;
    vehiclePlate: string;
    make?: string;
    model?: string;
    vehicleYear?: number;
    vinChassis?: string;
    usage?: string;
    licensedToCarry?: number;
  };
  error?: string;
  rawData?: any;
}

/**
 * Extract license data using OpenAI GPT-4 Vision
 */
async function extractLicenseWithOpenAI(imageUrl: string): Promise<LicenseOCRResult> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract all text from this driver's license. Return ONLY a JSON object with these fields:
{
  "licenseNumber": "string (required)",
  "fullName": "string (required)",
  "dateOfBirth": "YYYY-MM-DD",
  "issueDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD (required)",
  "licenseClass": "string (e.g., A, B, C, D)",
  "nationality": "string",
  "address": "string",
  "gender": "M or F",
  "bloodGroup": "string"
}
Be precise. Use null for missing fields.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logEvent("OPENAI_OCR_FAILED", { error }, "error");
      return { success: false, error: `OpenAI API error: ${error}` };
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    
    if (!content) {
      return { success: false, error: "No content in OpenAI response" };
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "No JSON found in response" };
    }

    const data = JSON.parse(jsonMatch[0]);
    
    // Validate required fields
    if (!data.licenseNumber || !data.fullName || !data.expiryDate) {
      return {
        success: false,
        error: "Missing required fields: licenseNumber, fullName, or expiryDate",
        rawData: data,
      };
    }

    return {
      success: true,
      data: {
        licenseNumber: data.licenseNumber,
        fullName: data.fullName,
        dateOfBirth: data.dateOfBirth || undefined,
        issueDate: data.issueDate || undefined,
        expiryDate: data.expiryDate,
        licenseClass: data.licenseClass || "B",
        nationality: data.nationality || undefined,
        address: data.address || undefined,
        gender: data.gender || undefined,
        bloodGroup: data.bloodGroup || undefined,
      },
      rawData: data,
    };
  } catch (err) {
    logEvent("OPENAI_OCR_ERROR", { error: err.message }, "error");
    return { success: false, error: err.message };
  }
}

/**
 * Extract license data using Google Gemini Vision
 */
async function extractLicenseWithGemini(imageUrl: string): Promise<LicenseOCRResult> {
  try {
    // Download image to base64
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();
    const imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Extract all text from this driver's license. Return ONLY a JSON object with these fields:
{
  "licenseNumber": "string (required)",
  "fullName": "string (required)",
  "dateOfBirth": "YYYY-MM-DD",
  "issueDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD (required)",
  "licenseClass": "string (e.g., A, B, C, D)",
  "nationality": "string",
  "address": "string",
  "gender": "M or F",
  "bloodGroup": "string"
}`,
                },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logEvent("GEMINI_OCR_FAILED", { error }, "error");
      return { success: false, error: `Gemini API error: ${error}` };
    }

    const result = await response.json();
    const content = result.candidates[0]?.content?.parts[0]?.text;
    
    if (!content) {
      return { success: false, error: "No content in Gemini response" };
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "No JSON found in response" };
    }

    const data = JSON.parse(jsonMatch[0]);
    
    // Validate required fields
    if (!data.licenseNumber || !data.fullName || !data.expiryDate) {
      return {
        success: false,
        error: "Missing required fields",
        rawData: data,
      };
    }

    return {
      success: true,
      data: {
        licenseNumber: data.licenseNumber,
        fullName: data.fullName,
        dateOfBirth: data.dateOfBirth || undefined,
        issueDate: data.issueDate || undefined,
        expiryDate: data.expiryDate,
        licenseClass: data.licenseClass || "B",
        nationality: data.nationality || undefined,
        address: data.address || undefined,
        gender: data.gender || undefined,
        bloodGroup: data.bloodGroup || undefined,
      },
      rawData: data,
    };
  } catch (err) {
    logEvent("GEMINI_OCR_ERROR", { error: err.message }, "error");
    return { success: false, error: err.message };
  }
}

/**
 * Extract insurance certificate data using OpenAI
 */
async function extractInsuranceWithOpenAI(imageUrl: string): Promise<InsuranceOCRResult> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract all text from this vehicle insurance certificate. Return ONLY a JSON object:
{
  "insurerName": "string (required)",
  "policyNumber": "string (required)",
  "certificateNumber": "string (required)",
  "policyInception": "YYYY-MM-DD (required)",
  "policyExpiry": "YYYY-MM-DD (required)",
  "carteJauneNumber": "string",
  "carteJauneExpiry": "YYYY-MM-DD",
  "vehiclePlate": "string (required)",
  "make": "string",
  "model": "string",
  "vehicleYear": number,
  "vinChassis": "string",
  "usage": "string",
  "licensedToCarry": number
}`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `OpenAI API error: ${error}` };
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return { success: false, error: "No JSON found in response" };
    }

    const data = JSON.parse(jsonMatch[0]);
    
    if (!data.insurerName || !data.policyNumber || !data.policyExpiry || !data.vehiclePlate) {
      return {
        success: false,
        error: "Missing required fields",
        rawData: data,
      };
    }

    return { success: true, data, rawData: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Extract insurance certificate data using Gemini
 */
async function extractInsuranceWithGemini(imageUrl: string): Promise<InsuranceOCRResult> {
  try {
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();
    const imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Extract all text from this vehicle insurance certificate. Return ONLY a JSON object with insurance details.`,
                },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Gemini API error: ${error}` };
    }

    const result = await response.json();
    const content = result.candidates[0]?.content?.parts[0]?.text;
    const jsonMatch = content?.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return { success: false, error: "No JSON found in response" };
    }

    const data = JSON.parse(jsonMatch[0]);
    
    if (!data.insurerName || !data.policyNumber || !data.policyExpiry || !data.vehiclePlate) {
      return {
        success: false,
        error: "Missing required fields",
        rawData: data,
      };
    }

    return { success: true, data, rawData: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Process driver license upload
 */
export async function processDriverLicense(
  ctx: MessageContext,
  imageUrl: string,
  mediaId: string
): Promise<{ success: boolean; message: string }> {
  try {
    logEvent("LICENSE_OCR_STARTED", { userId: ctx.profile.user_id });

    // Try OpenAI first, fallback to Gemini
    let ocrResult: LicenseOCRResult;
    let provider: string;

    if (OPENAI_API_KEY) {
      ocrResult = await extractLicenseWithOpenAI(imageUrl);
      provider = "openai";
    } else if (GEMINI_API_KEY) {
      ocrResult = await extractLicenseWithGemini(imageUrl);
      provider = "gemini";
    } else {
      return {
        success: false,
        message: "No OCR provider configured",
      };
    }

    if (!ocrResult.success) {
      logEvent("LICENSE_OCR_FAILED", {
        error: ocrResult.error,
        provider,
      }, "error");
      
      await sendWhatsAppMessage(ctx.wa_phone_number_id, ctx.from, {
        type: "text",
        text: {
          body: t(ctx.locale, "driver_verification.license.ocr_failed"),
        },
      });
      
      return {
        success: false,
        message: ocrResult.error || "OCR failed",
      };
    }

    // Check if license is expired
    const expiryDate = new Date(ocrResult.data!.expiryDate);
    const isExpired = expiryDate < new Date();

    // Save to database
    const { error: dbError } = await ctx.supabaseClient
      .from("driver_licenses")
      .insert({
        user_id: ctx.profile.user_id,
        license_number: ocrResult.data!.licenseNumber,
        full_name: ocrResult.data!.fullName,
        date_of_birth: ocrResult.data!.dateOfBirth || null,
        issue_date: ocrResult.data!.issueDate || null,
        expiry_date: ocrResult.data!.expiryDate,
        license_class: ocrResult.data!.licenseClass,
        nationality: ocrResult.data!.nationality || null,
        address: ocrResult.data!.address || null,
        gender: ocrResult.data!.gender || null,
        blood_group: ocrResult.data!.bloodGroup || null,
        license_media_url: imageUrl,
        license_media_id: mediaId,
        ocr_provider: provider,
        raw_ocr_data: ocrResult.rawData,
        status: isExpired ? "expired" : "pending",
        is_validated: false,
      });

    if (dbError) {
      logEvent("LICENSE_DB_INSERT_FAILED", { error: dbError.message }, "error");
      return {
        success: false,
        message: "Failed to save license data",
      };
    }

    // Send success message
    const message = isExpired
      ? t(ctx.locale, "driver_verification.license.expired", {
          expiryDate: expiryDate.toLocaleDateString(),
        })
      : t(ctx.locale, "driver_verification.license.success", {
          licenseNumber: ocrResult.data!.licenseNumber,
          expiryDate: expiryDate.toLocaleDateString(),
        });

    await sendWhatsAppMessage(ctx.wa_phone_number_id, ctx.from, {
      type: "text",
      text: { body: message },
    });

    logEvent("LICENSE_OCR_SUCCESS", {
      userId: ctx.profile.user_id,
      licenseNumber: ocrResult.data!.licenseNumber,
      provider,
      isExpired,
    });

    return { success: true, message: "License processed successfully" };
  } catch (err) {
    logEvent("LICENSE_PROCESSING_ERROR", {
      error: err.message,
      userId: ctx.profile.user_id,
    }, "error");
    
    return {
      success: false,
      message: err.message,
    };
  }
}

/**
 * Process insurance certificate upload
 */
export async function processInsuranceCertificate(
  ctx: MessageContext,
  imageUrl: string,
  mediaId: string
): Promise<{ success: boolean; message: string }> {
  try {
    logEvent("INSURANCE_OCR_STARTED", { userId: ctx.profile.user_id });

    // Try OpenAI first, fallback to Gemini
    let ocrResult: InsuranceOCRResult;
    let provider: string;

    if (OPENAI_API_KEY) {
      ocrResult = await extractInsuranceWithOpenAI(imageUrl);
      provider = "openai";
    } else if (GEMINI_API_KEY) {
      ocrResult = await extractInsuranceWithGemini(imageUrl);
      provider = "gemini";
    } else {
      return {
        success: false,
        message: "No OCR provider configured",
      };
    }

    if (!ocrResult.success) {
      logEvent("INSURANCE_OCR_FAILED", {
        error: ocrResult.error,
        provider,
      }, "error");
      
      await sendWhatsAppMessage(ctx.wa_phone_number_id, ctx.from, {
        type: "text",
        text: {
          body: t(ctx.locale, "driver_verification.insurance.ocr_failed"),
        },
      });
      
      return {
        success: false,
        message: ocrResult.error || "OCR failed",
      };
    }

    // Check if insurance is expired
    const expiryDate = new Date(ocrResult.data!.policyExpiry);
    const isExpired = expiryDate < new Date();

    // Save to database
    const { error: dbError } = await ctx.supabaseClient
      .from("driver_insurance_certificates")
      .insert({
        user_id: ctx.profile.user_id,
        insurer_name: ocrResult.data!.insurerName,
        policy_number: ocrResult.data!.policyNumber,
        certificate_number: ocrResult.data!.certificateNumber,
        policy_inception: ocrResult.data!.policyInception,
        policy_expiry: ocrResult.data!.policyExpiry,
        carte_jaune_number: ocrResult.data!.carteJauneNumber || null,
        carte_jaune_expiry: ocrResult.data!.carteJauneExpiry || null,
        vehicle_plate: ocrResult.data!.vehiclePlate,
        make: ocrResult.data!.make || null,
        model: ocrResult.data!.model || null,
        vehicle_year: ocrResult.data!.vehicleYear || null,
        vin_chassis: ocrResult.data!.vinChassis || null,
        usage: ocrResult.data!.usage || null,
        licensed_to_carry: ocrResult.data!.licensedToCarry || null,
        certificate_media_url: imageUrl,
        certificate_media_id: mediaId,
        ocr_provider: provider,
        raw_ocr_data: ocrResult.rawData,
        status: isExpired ? "expired" : "pending",
        is_validated: false,
      });

    if (dbError) {
      logEvent("INSURANCE_DB_INSERT_FAILED", { error: dbError.message }, "error");
      return {
        success: false,
        message: "Failed to save insurance data",
      };
    }

    // Send success message
    const message = isExpired
      ? t(ctx.locale, "driver_verification.insurance.expired", {
          expiryDate: expiryDate.toLocaleDateString(),
        })
      : t(ctx.locale, "driver_verification.insurance.success", {
          policyNumber: ocrResult.data!.policyNumber,
          vehiclePlate: ocrResult.data!.vehiclePlate,
          expiryDate: expiryDate.toLocaleDateString(),
        });

    await sendWhatsAppMessage(ctx.wa_phone_number_id, ctx.from, {
      type: "text",
      text: { body: message },
    });

    logEvent("INSURANCE_OCR_SUCCESS", {
      userId: ctx.profile.user_id,
      policyNumber: ocrResult.data!.policyNumber,
      vehiclePlate: ocrResult.data!.vehiclePlate,
      provider,
      isExpired,
    });

    return { success: true, message: "Insurance processed successfully" };
  } catch (err) {
    logEvent("INSURANCE_PROCESSING_ERROR", {
      error: err.message,
      userId: ctx.profile.user_id,
    }, "error");
    
    return {
      success: false,
      message: err.message,
    };
  }
}
