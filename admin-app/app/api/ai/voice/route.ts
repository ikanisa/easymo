import { NextRequest, NextResponse } from "next/server";
import {
  createLiveSession,
  processAudioInput,
  textToSpeech,
  speechToText,
  closeLiveSession,
  createLiveSessionWithInstructions,
  type VoiceConfig,
} from "@/lib/ai/google/gemini-live";

export const dynamic = "force-dynamic";

// Store active sessions (in production, use Redis or database)
const activeSessions = new Map();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId, audioData, text, mimeType, voiceConfig, systemInstruction } = body;

    if (!action) {
      return NextResponse.json(
        { error: "action is required" },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case "create_session": {
        const session = systemInstruction
          ? await createLiveSessionWithInstructions(systemInstruction, voiceConfig as VoiceConfig)
          : await createLiveSession(voiceConfig as VoiceConfig);
        
        // Store session (serialize model reference)
        activeSessions.set(session.id, {
          ...session,
          model: null, // Don't store the actual model object
        });

        return NextResponse.json({
          success: true,
          sessionId: session.id,
          createdAt: session.createdAt,
        });
      }

      case "process_audio": {
        if (!sessionId) {
          return NextResponse.json(
            { error: "sessionId is required for process_audio action" },
            { status: 400 }
          );
        }

        if (!audioData) {
          return NextResponse.json(
            { error: "audioData is required for process_audio action" },
            { status: 400 }
          );
        }

        const storedSession = activeSessions.get(sessionId);
        if (!storedSession) {
          return NextResponse.json(
            { error: "Session not found or expired" },
            { status: 404 }
          );
        }

        // Recreate session for processing
        const session = systemInstruction
          ? await createLiveSessionWithInstructions(systemInstruction || "", voiceConfig)
          : await createLiveSession(voiceConfig);

        result = await processAudioInput(session, audioData, mimeType || "audio/wav");
        break;
      }

      case "text_to_speech": {
        if (!sessionId) {
          return NextResponse.json(
            { error: "sessionId is required for text_to_speech action" },
            { status: 400 }
          );
        }

        if (!text) {
          return NextResponse.json(
            { error: "text is required for text_to_speech action" },
            { status: 400 }
          );
        }

        const storedSession = activeSessions.get(sessionId);
        if (!storedSession) {
          return NextResponse.json(
            { error: "Session not found or expired" },
            { status: 404 }
          );
        }

        // Recreate session
        const session = await createLiveSession(voiceConfig);
        result = await textToSpeech(session, text);
        break;
      }

      case "speech_to_text": {
        if (!audioData) {
          return NextResponse.json(
            { error: "audioData is required for speech_to_text action" },
            { status: 400 }
          );
        }

        result = await speechToText(audioData, mimeType || "audio/wav");
        break;
      }

      case "close_session": {
        if (!sessionId) {
          return NextResponse.json(
            { error: "sessionId is required for close_session action" },
            { status: 400 }
          );
        }

        const storedSession = activeSessions.get(sessionId);
        if (storedSession) {
          activeSessions.delete(sessionId);
        }

        return NextResponse.json({
          success: true,
          message: "Session closed",
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      data: result,
    });
  } catch (error) {
    console.error("Voice API error:", error);
    const err = error as Error;

    if (err.message.includes("not configured")) {
      return NextResponse.json(
        {
          error: "Google AI API key not configured",
          details: "Please set GOOGLE_AI_API_KEY environment variable",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Voice request failed",
        details: err.message,
      },
      { status: 500 }
    );
  }
}
