import { NextRequest, NextResponse } from "next/server";

import { multiModalProcessor } from "@/lib/rag/multimodal";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case "analyze_image":
        if (!data.imageUrl) {
          return NextResponse.json(
            { error: "imageUrl required" },
            { status: 400 }
          );
        }
        const analysis = await multiModalProcessor.analyzeImage(
          data.imageUrl,
          data.prompt
        );
        return NextResponse.json({ success: true, ...analysis });

      case "analyze_image_gemini":
        if (!data.imageBase64) {
          return NextResponse.json(
            { error: "imageBase64 required" },
            { status: 400 }
          );
        }
        const geminiAnalysis = await multiModalProcessor.analyzeImageGemini(
          data.imageBase64,
          data.prompt
        );
        return NextResponse.json({ success: true, ...geminiAnalysis });

      case "extract_text":
        if (!data.imageUrl) {
          return NextResponse.json(
            { error: "imageUrl required" },
            { status: 400 }
          );
        }
        const text = await multiModalProcessor.extractTextFromImage(data.imageUrl);
        return NextResponse.json({ success: true, text });

      case "generate_image":
        if (!data.prompt) {
          return NextResponse.json({ error: "prompt required" }, { status: 400 });
        }
        const generated = await multiModalProcessor.generateImage(
          data.prompt,
          data.size
        );
        return NextResponse.json({ success: true, ...generated });

      case "compare_images":
        if (!data.imageUrl1 || !data.imageUrl2) {
          return NextResponse.json(
            { error: "imageUrl1 and imageUrl2 required" },
            { status: 400 }
          );
        }
        const comparison = await multiModalProcessor.compareImages(
          data.imageUrl1,
          data.imageUrl2
        );
        return NextResponse.json({ success: true, ...comparison });

      case "transcribe_audio":
        // Handle file upload
        const formData = await request.formData();
        const audioFile = formData.get("audio") as File;

        if (!audioFile) {
          return NextResponse.json(
            { error: "audio file required" },
            { status: 400 }
          );
        }

        const transcription = await multiModalProcessor.transcribeAudio(audioFile);
        return NextResponse.json({ success: true, text: transcription });

      case "text_to_speech":
        if (!data.text) {
          return NextResponse.json({ error: "text required" }, { status: 400 });
        }

        const audio = await multiModalProcessor.textToSpeech(data.text, data.voice);

        return new NextResponse(audio, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Disposition": "attachment; filename=speech.mp3",
          },
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Multimodal operation error:", error);
    return NextResponse.json(
      {
        error: "Multimodal operation failed",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
