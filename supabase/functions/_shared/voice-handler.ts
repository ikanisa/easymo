// =====================================================
// VOICE MESSAGE HANDLER - MULTI-PROVIDER
// =====================================================
// WhatsApp audio download, transcription, TTS
// Supports: Google Cloud AI (primary) + OpenAI (fallback)
// =====================================================

import OpenAI from "https://deno.land/x/openai@v4.20.0/mod.ts";

import { logStructuredEvent } from "./observability.ts";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
});

// Feature flag for Google AI (default: enabled)
const USE_GOOGLE_AI = Deno.env.get("USE_GOOGLE_AI") !== "false";

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
 * Transcribe audio using Google STT (primary) or OpenAI Whisper (fallback)
 */
export async function transcribeAudio(
  audioBuffer: Uint8Array,
  format: string = "ogg"
): Promise<{
  text: string;
  language: string;
  duration?: number;
  provider?: 'google' | 'openai';
}> {
  const correlationId = crypto.randomUUID();

  // Try Google Cloud Speech-to-Text first
  if (USE_GOOGLE_AI) {
    try {
      const result = await transcribeWithGoogle(audioBuffer, correlationId);
      return {
        text: result.transcript,
        language: result.languageCode,
        provider: 'google',
      };
    } catch (googleError) {
      await logStructuredEvent('voice.transcribe.google_fallback', {
        correlationId,
        error: googleError instanceof Error ? googleError.message : String(googleError),
      }, 'warn');
      // Fall through to OpenAI
    }
  }

  // Fallback to OpenAI Whisper
  try {
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

    await logStructuredEvent('voice.transcribe.openai_success', {
      correlationId,
      textLength: response.text.length,
      language: response.language,
    });

    return {
      text: response.text,
      language: response.language || "unknown",
      duration: response.duration,
      provider: 'openai',
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

/**
 * Google Cloud Speech-to-Text implementation
 */
async function transcribeWithGoogle(
  audioBuffer: Uint8Array,
  correlationId: string
): Promise<{ transcript: string; languageCode: string }> {
  const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
  if (!apiKey) {
    throw new Error('GOOGLE_CLOUD_API_KEY not configured');
  }

  const base64Audio = btoa(String.fromCharCode(...audioBuffer));

  const response = await fetch(
    'https://speech.googleapis.com/v1/speech:recognize',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        config: {
          encoding: 'OGG_OPUS',
          sampleRateHertz: 16000,
          languageCode: 'rw-RW',
          alternativeLanguageCodes: ['en-US', 'fr-FR', 'sw-TZ'],
          enableAutomaticPunctuation: true,
          model: 'phone_call',
          useEnhanced: true,
        },
        audio: { content: base64Audio },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google STT failed: ${error}`);
  }

  const data = await response.json();
  const result = data.results?.[0];

  if (!result?.alternatives?.[0]) {
    throw new Error('No transcription result from Google STT');
  }

  const alt = result.alternatives[0];
  
  await logStructuredEvent('voice.transcribe.google_success', {
    correlationId,
    transcript: alt.transcript,
    confidence: alt.confidence,
    languageCode: result.languageCode,
  });

  return {
    transcript: alt.transcript || '',
    languageCode: result.languageCode || 'rw-RW',
  };
}

/**
 * Generate speech from text using Google TTS (primary) or OpenAI (fallback)
 */
export async function textToSpeech(
  text: string,
  language: "rw" | "en" | "fr" | "sw" = "en",
  voice: string = "alloy"
): Promise<Uint8Array> {
  const correlationId = crypto.randomUUID();

  // Try Google Cloud Text-to-Speech first
  if (USE_GOOGLE_AI) {
    try {
      const result = await synthesizeWithGoogle(text, language, correlationId);
      return new Uint8Array(result);
    } catch (googleError) {
      await logStructuredEvent('voice.tts.google_fallback', {
        correlationId,
        error: googleError instanceof Error ? googleError.message : String(googleError),
      }, 'warn');
      // Fall through to OpenAI
    }
  }

  // Fallback to OpenAI TTS
  try {
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice as any,
      input: text,
      response_format: "opus", // WhatsApp supports opus
      speed: 1.0,
    });

    const arrayBuffer = await response.arrayBuffer();
    
    await logStructuredEvent('voice.tts.openai_success', {
      correlationId,
      audioSize: arrayBuffer.byteLength,
      voice,
    });

    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error("TTS error:", error);
    throw error;
  }
}

/**
 * Google Cloud Text-to-Speech implementation
 */
async function synthesizeWithGoogle(
  text: string,
  language: "rw" | "en" | "fr" | "sw",
  correlationId: string
): Promise<ArrayBuffer> {
  const apiKey = Deno.env.get('GOOGLE_CLOUD_API_KEY');
  if (!apiKey) {
    throw new Error('GOOGLE_CLOUD_API_KEY not configured');
  }

  // Map language to voice
  const voiceMap: Record<string, any> = {
    'rw': { languageCode: 'rw-RW', name: 'rw-RW-Standard-A', ssmlGender: 'FEMALE' },
    'en': { languageCode: 'en-US', name: 'en-US-Neural2-F', ssmlGender: 'FEMALE' },
    'fr': { languageCode: 'fr-FR', name: 'fr-FR-Neural2-A', ssmlGender: 'FEMALE' },
    'sw': { languageCode: 'sw-KE', name: 'sw-KE-Standard-A', ssmlGender: 'FEMALE' },
  };

  const voice = voiceMap[language] || voiceMap['en'];

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice,
        audioConfig: {
          audioEncoding: 'OGG_OPUS',
          speakingRate: 1.0,
          pitch: 0.0,
          effectsProfileId: ['telephony-class-application'],
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google TTS failed: ${error}`);
  }

  const data = await response.json();

  if (!data.audioContent) {
    throw new Error('No audio content in TTS response');
  }

  const audioContent = Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0)).buffer;

  await logStructuredEvent('voice.tts.google_success', {
    correlationId,
    audioSize: audioContent.byteLength,
    voiceName: voice.name,
  });

  return audioContent;
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
