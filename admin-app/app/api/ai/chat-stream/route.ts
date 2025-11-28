import { NextRequest } from "next/server";
import { getOpenAIClient } from "@/lib/ai/providers/openai-client";
import { getGeminiClient } from "@/lib/ai/providers/gemini-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, provider = "openai", model } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response("messages array is required", { status: 400 });
    }

    const encoder = new TextEncoder();

    if (provider === "openai") {
      const client = getOpenAIClient();
      const stream = await client.chat.completions.create({
        model: model || "gpt-4o-mini",
        messages,
        stream: true,
      });

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } else {
      // Gemini streaming
      const client = getGeminiClient();
      const model = client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const prompt = messages[messages.length - 1].content;
      const result = await model.generateContentStream(prompt);

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of result.stream) {
              const content = chunk.text();
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }
  } catch (error) {
    console.error("Streaming error:", error);
    return new Response("Streaming failed", { status: 500 });
  }
}
