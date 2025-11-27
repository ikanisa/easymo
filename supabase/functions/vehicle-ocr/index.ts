import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/http.ts";
import { logStructuredEvent } from "../_shared/observability.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface VehicleOCRRequest {
  profile_id: string;
  org_id: string;
  vehicle_plate: string;
  file_url: string;
  vehicle_id?: string; // Optional: if vehicle already exists
}

interface OCRFields {
  plate?: string;
  policy_no?: string;
  insurer?: string;
  effective_from?: string;
  expires_on?: string;
}

interface VehicleOCRResponse {
  success: boolean;
  vehicle_id: string;
  status: "active" | "pending";
  reason?: string;
  ocr_confidence?: number;
  fields?: OCRFields;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const body: VehicleOCRRequest = await req.json();
    const { profile_id, org_id, vehicle_plate, file_url, vehicle_id } = body;

    if (!profile_id || !org_id || !vehicle_plate || !file_url) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await logStructuredEvent("VEHICLE_OCR_START", {
      profile_id,
      plate: vehicle_plate,
      has_vehicle_id: !!vehicle_id,
    });

    // Extract text from certificate using OCR
    const ocrResult = await extractCertificateData(file_url);
    const { fields, confidence, raw } = ocrResult;

    // Validate the certificate
    const plateMatch = fields.plate?.toUpperCase() === vehicle_plate.toUpperCase();
    const notExpired = fields.expires_on ? new Date(fields.expires_on) >= new Date() : false;
    const highConfidence = confidence >= 0.8;
    const isValid = plateMatch && notExpired && highConfidence;

    // Create or update vehicle
    let finalVehicleId = vehicle_id;
    
    if (!finalVehicleId) {
      const { data: vehicleData, error: vehicleError } = await supabase
        .from("vehicles")
        .insert({
          org_id,
          profile_id,
          plate: vehicle_plate,
          status: isValid ? "active" : "pending",
        })
        .select("id")
        .single();

      if (vehicleError) {
        // Check if vehicle already exists
        const { data: existingVehicle } = await supabase
          .from("vehicles")
          .select("id")
          .eq("org_id", org_id)
          .eq("plate", vehicle_plate)
          .single();

        if (existingVehicle) {
          finalVehicleId = existingVehicle.id;
        } else {
          throw vehicleError;
        }
      } else {
        finalVehicleId = vehicleData.id;
      }
    }

    // Store insurance certificate
    const { error: certError } = await supabase
      .from("insurance_certificates")
      .insert({
        org_id,
        vehicle_id: finalVehicleId,
        policy_no: fields.policy_no || null,
        insurer: fields.insurer || null,
        effective_from: fields.effective_from || null,
        expires_on: fields.expires_on || null,
        ocr_raw: raw,
        ocr_confidence: confidence,
        verified: isValid,
        file_url,
      });

    if (certError) {
      await logStructuredEvent("ERROR", { data: "Error storing certificate:", certError });
      throw certError;
    }

    // If valid, activate the vehicle
    if (isValid) {
      await supabase
        .from("vehicles")
        .update({ status: "active" })
        .eq("id", finalVehicleId);
    }

    await logStructuredEvent("VEHICLE_OCR_COMPLETE", {
      profile_id,
      vehicle_id: finalVehicleId,
      status: isValid ? "active" : "pending",
      confidence,
    });

    const response: VehicleOCRResponse = {
      success: true,
      vehicle_id: finalVehicleId,
      status: isValid ? "active" : "pending",
      reason: !isValid ? determineFailureReason(plateMatch, notExpired, highConfidence) : undefined,
      ocr_confidence: confidence,
      fields,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    await logStructuredEvent("ERROR", { data: "Vehicle OCR error:", error });
    
    await logStructuredEvent("VEHICLE_OCR_ERROR", {
      error: error.message,
    });

    return new Response(
      JSON.stringify({ 
        success: false,
        error: "Internal server error", 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function extractCertificateData(fileUrl: string): Promise<{
  fields: OCRFields;
  confidence: number;
  raw: any;
}> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  // Use OpenAI Vision API for OCR
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting information from vehicle insurance certificates (Yellow Cards). Extract the following fields: plate number, policy number, insurer name, effective date, and expiry date. Return as JSON.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract: plate, policy_no, insurer, effective_from (YYYY-MM-DD), expires_on (YYYY-MM-DD)",
            },
            {
              type: "image_url",
              image_url: { url: fileUrl },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const rawText = data.choices[0]?.message?.content || "{}";
  
  // Parse JSON from response
  let fields: OCRFields = {};
  try {
    // Try to extract JSON from the response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      fields = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    await logStructuredEvent("ERROR", { data: "Error parsing OCR response:", e });
  }

  // Calculate confidence based on field completeness
  const fieldCount = Object.keys(fields).filter(k => fields[k as keyof OCRFields]).length;
  const confidence = Math.min((fieldCount / 5) * 100, 95); // Max 95% from OCR

  return {
    fields,
    confidence: confidence / 100, // Convert to 0-1 range
    raw: data,
  };
}

function determineFailureReason(
  plateMatch: boolean,
  notExpired: boolean,
  highConfidence: boolean
): string {
  if (!plateMatch) return "plate_mismatch";
  if (!notExpired) return "certificate_expired";
  if (!highConfidence) return "low_confidence";
  return "unknown";
}
