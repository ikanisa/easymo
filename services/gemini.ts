import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import { createBlob, decodeBase64, decodeAudioData } from './audioUtils';

// Ensure API KEY is available
if (!process.env.API_KEY) {
  console.error("API_KEY is missing in process.env");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Live API Configuration ---
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
const SYSTEM_INSTRUCTION_LIVE = `
You are "EasyMo Agent", a highly skilled, persuasive, and friendly sales representative and broker for the Rwandan market.

**LANGUAGE PRIORITY:**
1. **Kinyarwanda (Primary):** You must be very fluent in Kinyarwanda. Start all conversations in Kinyarwanda, as most locals prefer it. Use natural, local idioms.
2. **English & French (Secondary):** You are also fluent in English and French. Only switch to these languages if the user speaks them first or struggles with Kinyarwanda.

**GOAL:**
Promote EasyMo services:
1. Insurance via WhatsApp.
2. Instant Chat with nearby drivers/passengers for trips.
3. EasyMo AI Broker: Connecting buyers and sellers naturally.

**CONTEXT:**
You are currently conducting a cold call or acting as a broker. Be polite, professional, and efficient.
`;

export interface LiveSessionCallbacks {
  onOpen: () => void;
  onMessage: (text: string | null, isUser: boolean) => void;
  onAudioData: (audioBuffer: AudioBuffer) => void;
  onClose: () => void;
  onError: (error: any) => void;
}

let currentSession: any = null;
let inputAudioContext: AudioContext | null = null;
let outputAudioContext: AudioContext | null = null;
let stream: MediaStream | null = null;
let processor: ScriptProcessorNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let nextStartTime = 0;
const audioSources = new Set<AudioBufferSourceNode>();

export const connectLiveSession = async (callbacks: LiveSessionCallbacks, voiceName: string = 'Kore') => {
  try {
    inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    nextStartTime = outputAudioContext.currentTime;

    stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const sessionPromise = ai.live.connect({
      model: LIVE_MODEL,
      callbacks: {
        onopen: () => {
          callbacks.onOpen();
          if (!inputAudioContext || !stream) return;

          sourceNode = inputAudioContext.createMediaStreamSource(stream);
          processor = inputAudioContext.createScriptProcessor(4096, 1, 1);

          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createBlob(inputData);
            sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
            });
          };

          sourceNode.connect(processor);
          processor.connect(inputAudioContext.destination);
        },
        onmessage: async (msg: LiveServerMessage) => {
          // Handle Text Transcription
          if (msg.serverContent?.outputTranscription?.text) {
             callbacks.onMessage(msg.serverContent.outputTranscription.text, false);
          }
          if (msg.serverContent?.inputTranscription?.text) {
             callbacks.onMessage(msg.serverContent.inputTranscription.text, true);
          }

          // Handle Audio Output
          const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioData && outputAudioContext) {
            const rawBytes = decodeBase64(audioData);
            const buffer = await decodeAudioData(rawBytes, outputAudioContext, 24000);
            
            // Scheduling
            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
            const source = outputAudioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(outputAudioContext.destination);
            source.start(nextStartTime);
            nextStartTime += buffer.duration;
            
            source.onended = () => audioSources.delete(source);
            audioSources.add(source);
            callbacks.onAudioData(buffer);
          }

          if (msg.serverContent?.interrupted) {
             audioSources.forEach(s => s.stop());
             audioSources.clear();
             nextStartTime = 0;
          }
        },
        onclose: () => callbacks.onClose(),
        onerror: (err) => callbacks.onError(err),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
        },
        systemInstruction: SYSTEM_INSTRUCTION_LIVE,
        inputAudioTranscription: { model: 'gemini-2.5-flash' },
        outputAudioTranscription: {},
      },
    });

    currentSession = await sessionPromise;
  } catch (error) {
    callbacks.onError(error);
  }
};

export const disconnectLiveSession = async () => {
  if (currentSession) {
    try {
        (currentSession as any).close(); 
    } catch(e) { console.warn("Session close error", e)}
    currentSession = null;
  }
  
  if (processor && inputAudioContext) {
    processor.disconnect();
    sourceNode?.disconnect();
    processor = null;
    sourceNode = null;
  }
  
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }

  if (inputAudioContext) {
    await inputAudioContext.close();
    inputAudioContext = null;
  }
  if (outputAudioContext) {
    await outputAudioContext.close();
    outputAudioContext = null;
  }
  audioSources.forEach(s => s.stop());
  audioSources.clear();
};


// --- Grounding (Search & Maps) ---

export const findLeads = async (query: string, useMaps: boolean, useSearch: boolean) => {
  const tools = [];
  if (useSearch) tools.push({ googleSearch: {} });
  if (useMaps) tools.push({ googleMaps: {} });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Find potential leads/contacts in Rwanda relevant to: "${query}". 
    Extract names, addresses, phone numbers if public, and website URIs. 
    Present the data as a structured summary.`,
    config: {
      tools: tools,
    }
  });

  return {
    text: response.text,
    groundingMetadata: response.candidates?.[0]?.groundingMetadata
  };
};

// --- Structured Business Search (Directory) ---
export const searchLocalBusinesses = async (query: string, city: string): Promise<any[]> => {
  const prompt = `
    Act as a Data Extractor. Search for "${query}" in "${city}, Rwanda" using Google Maps.
    
    Return a valid JSON array of objects. Each object must have:
    - "name": Name of the business.
    - "address": Full address.
    - "city": City name.
    - "phone": Phone number (if available, else "N/A").
    - "category": The business category (e.g., Pharmacy, Hardware).
    - "rating": Number (0-5).
    - "lat": Estimated latitude (number).
    - "lng": Estimated longitude (number).
    
    Do NOT return markdown code blocks. Return ONLY the raw JSON string.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        // Note: responseSchema is NOT allowed with googleMaps tool, so we rely on the prompt for JSON.
      }
    });

    let jsonStr = response.text?.trim();
    if (!jsonStr) return [];

    // Clean up markdown if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '');
    } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '');
    }

    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to search businesses", e);
    return [];
  }
};


// --- Chat (Strategy & Fast) ---

export const chatWithStrategist = async (history: {role: string, text: string}[], newMessage: string) => {
  // Gemini 3 Pro for Thinking
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: [
        ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
        { role: 'user', parts: [{ text: newMessage }] }
    ],
    config: {
        thinkingConfig: { thinkingBudget: 32768 }, // Max thinking budget
    }
  });
  return response.text;
};

export const chatFast = async (history: {role: string, text: string}[], newMessage: string) => {
    // Gemini 2.5 Flash Lite for Low Latency
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite-latest', // Alias handling done in thought, using specific name
        contents: [
            ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
            { role: 'user', parts: [{ text: newMessage }] }
        ]
    });
    return response.text;
};

// --- Transcription ---
export const transcribeAudioFile = async (base64Audio: string, mimeType: string) => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { data: base64Audio, mimeType } },
                { text: "Transcribe this audio into Kinyarwanda or English as appropriate." }
            ]
        }
    });
    return response.text;
};
