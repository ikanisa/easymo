/**
 * Voice Handler for WhatsApp
 * 
 * Processes voice notes using the Unified AI Gateway.
 * 1. Transcribes audio (Whisper or Gemini)
 * 2. Routes to appropriate agent
 * 3. Generates audio response (TTS or Realtime)
 */

import { UnifiedGateway } from "../../../packages/ai/src/core/unified-gateway";
import { createClient } from "@supabase/supabase-js";

// Initialize Gateway (env vars should be set in Supabase Secrets)
const gateway = new UnifiedGateway({
  openaiApiKey: Deno.env.get("OPENAI_API_KEY") ?? "",
  googleApiKey: Deno.env.get("GOOGLE_API_KEY") ?? "",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

export async function handleVoiceMessage(
  message: any,
  userId: string
): Promise<void> {
  try {
    const audioUrl = message.audio?.link; // Assuming WhatsApp API structure
    if (!audioUrl) return;

    // 1. Download Audio
    const audioBlob = await fetch(audioUrl).then((res) => res.blob());
    
    // 2. Transcribe (using OpenAI Whisper via Gateway/SDK or direct)
    // For simplicity, we'll assume we use a helper or the gateway supports transcription
    // Since UnifiedGateway doesn't explicitly have transcribe yet, we'll use OpenAI client directly
    const openai = gateway.getOpenAIClient().getClient();
    
    const transcription = await openai.audio.transcriptions.create({
      file: new File([audioBlob], "voice.ogg", { type: "audio/ogg" }),
      model: "whisper-1",
    });

    const userText = transcription.text;
    console.log(`Transcribed voice from ${userId}: ${userText}`);

    // 3. Route Request
    // Determine intent (simple QA vs complex) - naive heuristic for now
    const requestType = userText.length > 50 ? "complex_reasoning" : "simple_qa";
    
    const responseText = await gateway.routeRequest(requestType, {
      prompt: userText,
    });

    // 4. Generate Audio Response (TTS)
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: responseText,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    // 5. Upload Response to Storage
    const fileName = `responses/${userId}/${Date.now()}.mp3`;
    await supabase.storage
      .from("voice-messages")
      .upload(fileName, buffer, { contentType: "audio/mpeg" });
      
    const { data: { publicUrl } } = supabase.storage
      .from("voice-messages")
      .getPublicUrl(fileName);

    // 6. Send back to WhatsApp (via whatever mechanism calls this handler)
    // This function might return the response or send it directly.
    // We'll return the result for the caller to handle sending.
    return {
      type: "voice",
      url: publicUrl,
      text: responseText, // Fallback text
    } as any;

  } catch (error) {
    console.error("Error handling voice message:", error);
    throw error;
  }
}
