// =====================================================
// VOICE MESSAGE HANDLER
// =====================================================
// WhatsApp audio download, transcription, TTS
// =====================================================

import OpenAI from "https://deno.land/x/openai@v4.20.0/mod.ts";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
});

/**
 * Download audio from WhatsApp Cloud API
 */
export async function downloadWhatsAppAudio(
  mediaId: string,
  accessToken: string
): Promise<Uint8Array> {
  try {
    // Step 1: Get media URL
    const urlResponse = await fetch(
      `https://graph.facebook.com/v21.0/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!urlResponse.ok) {
      throw new Error(`Failed to get media URL: ${urlResponse.statusText}`);
    }

    const { url } = await urlResponse.json();

    // Step 2: Download the actual audio file
    const audioResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }

    const arrayBuffer = await audioResponse.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error("Error downloading WhatsApp audio:", error);
    throw error;
  }
}

/**
 * Transcribe audio using OpenAI Whisper
 */
export async function transcribeAudio(
  audioBuffer: Uint8Array,
  format: string = "ogg"
): Promise<{
  text: string;
  language: string;
  duration?: number;
}> {
  try {
    // Create a File object from the buffer
    const audioFile = new File([audioBuffer], `audio.${format}`, {
      type: `audio/${format}`
    });

    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: undefined, // Auto-detect
      response_format: "verbose_json",
      temperature: 0,
    });

    return {
      text: response.text,
      language: response.language || "unknown",
      duration: response.duration,
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

/**
 * Generate speech from text using OpenAI TTS
 */
export async function textToSpeech(
  text: string,
  language: "rw" | "en" | "fr" = "en",
  voice: string = "alloy"
): Promise<Uint8Array> {
  try {
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice as any,
      input: text,
      response_format: "opus", // WhatsApp supports opus
      speed: 1.0,
    });

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error("TTS error:", error);
    throw error;
  }
}

/**
 * Upload media to WhatsApp Cloud API
 */
export async function uploadWhatsAppMedia(
  audioBuffer: Uint8Array,
  accessToken: string,
  phoneNumberId: string
): Promise<string> {
  try {
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: "audio/ogg" });
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("type", "audio/ogg");
    formData.append("messaging_product", "whatsapp");

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to upload media: ${response.statusText}`);
    }

    const { id } = await response.json();
    return id;
  } catch (error) {
    console.error("Error uploading WhatsApp media:", error);
    throw error;
  }
}
