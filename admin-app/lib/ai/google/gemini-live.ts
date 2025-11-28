import { getGeminiClient } from "../providers/gemini-client";

export interface LiveSession {
  id: string;
  model: any;
  isActive: boolean;
  createdAt: string;
}

export interface AudioConfig {
  sampleRate?: number;
  encoding?: "linear16" | "mulaw" | "alaw";
  channels?: number;
}

export interface VoiceConfig {
  voiceName?: "Kore" | "Charon" | "Aoede" | "Fenrir";
  languageCode?: string;
}

/**
 * Create a new Gemini Live session for voice interactions
 * Supports real-time audio input and output
 */
export async function createLiveSession(
  voiceConfig?: VoiceConfig
): Promise<LiveSession> {
  const client = getGeminiClient();

  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      responseModalities: ["AUDIO"] as any,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceConfig?.voiceName ?? "Kore",
          },
        },
      },
    } as any,
  });

  return {
    id: crypto.randomUUID(),
    model,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Process audio input and get audio response
 * @param session - Active live session
 * @param audioData - Audio data as base64 string or Uint8Array
 * @param mimeType - Audio MIME type (e.g., 'audio/wav', 'audio/mp3')
 */
export async function processAudioInput(
  session: LiveSession,
  audioData: string | Uint8Array,
  mimeType: string = "audio/wav"
) {
  if (!session.isActive) {
    throw new Error("Session is not active");
  }

  const data = typeof audioData === "string" ? audioData : Buffer.from(audioData).toString("base64");

  const result = await session.model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data,
            },
          },
        ],
      },
    ],
  });

  const response = result.response;
  
  // Extract audio from response if available
  const candidate = response.candidates?.[0];
  const audioPart = candidate?.content?.parts?.find((part: any) => part.inlineData?.mimeType?.startsWith("audio/"));

  return {
    text: response.text(),
    audioData: audioPart?.inlineData?.data,
    audioMimeType: audioPart?.inlineData?.mimeType,
  };
}

/**
 * Process text input and get audio response
 * Useful for text-to-speech with Gemini's voice
 */
export async function textToSpeech(
  session: LiveSession,
  text: string
) {
  if (!session.isActive) {
    throw new Error("Session is not active");
  }

  const result = await session.model.generateContent(text);
  const response = result.response;

  // Extract audio from response
  const candidate = response.candidates?.[0];
  const audioPart = candidate?.content?.parts?.find((part: any) => part.inlineData?.mimeType?.startsWith("audio/"));

  return {
    text: response.text(),
    audioData: audioPart?.inlineData?.data,
    audioMimeType: audioPart?.inlineData?.mimeType,
  };
}

/**
 * Process audio input and get text response (speech-to-text)
 */
export async function speechToText(
  audioData: string | Uint8Array,
  mimeType: string = "audio/wav"
) {
  const client = getGeminiClient();
  
  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
  });

  const data = typeof audioData === "string" ? audioData : Buffer.from(audioData).toString("base64");

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data,
            },
          },
        ],
      },
    ],
  });

  return {
    text: result.response.text(),
  };
}

/**
 * Stream audio conversation (for real-time interactions)
 * This is a simplified version - actual streaming would use WebSockets
 */
export async function streamAudioConversation(
  session: LiveSession,
  audioChunks: AsyncIterable<Uint8Array>,
  mimeType: string = "audio/wav"
) {
  const responses: Array<{
    text: string;
    audioData?: string;
  }> = [];

  for await (const chunk of audioChunks) {
    const response = await processAudioInput(session, chunk, mimeType);
    responses.push(response);
  }

  return responses;
}

/**
 * Close a live session
 */
export function closeLiveSession(session: LiveSession) {
  session.isActive = false;
}

/**
 * Create a session with custom system instructions
 */
export async function createLiveSessionWithInstructions(
  systemInstruction: string,
  voiceConfig?: VoiceConfig
): Promise<LiveSession> {
  const client = getGeminiClient();

  const model = client.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    systemInstruction,
    generationConfig: {
      responseModalities: ["AUDIO"] as any,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceConfig?.voiceName ?? "Kore",
          },
        },
      },
    } as any,
  });

  return {
    id: crypto.randomUUID(),
    model,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Helper function to convert audio file to base64
 */
export function audioFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Helper function to play audio from base64
 */
export function playAudioFromBase64(base64Data: string, mimeType: string): HTMLAudioElement {
  const audio = new Audio(`data:${mimeType};base64,${base64Data}`);
  audio.play();
  return audio;
}
