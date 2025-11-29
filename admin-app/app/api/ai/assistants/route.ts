import { NextRequest, NextResponse } from "next/server";
import { assistantsManager, ASSISTANT_TEMPLATES } from "@/lib/ai/assistants/manager";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const action = searchParams.get("action");
    const id = searchParams.get("id");

    switch (action) {
      case "list":
        const assistants = await assistantsManager.listAssistants();
        return NextResponse.json({ success: true, assistants });

      case "get":
        if (!id) {
          return NextResponse.json({ error: "id required" }, { status: 400 });
        }
        const assistant = await assistantsManager.getAssistant(id);
        return NextResponse.json({ success: true, assistant });

      case "templates":
        return NextResponse.json({
          success: true,
          templates: ASSISTANT_TEMPLATES,
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Assistants GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch assistants", details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case "create":
        const assistant = await assistantsManager.createAssistant(data);
        return NextResponse.json({ success: true, assistant });

      case "chat":
        if (!data.assistantId || !data.messages) {
          return NextResponse.json(
            { error: "assistantId and messages required" },
            { status: 400 }
          );
        }
        const result = await assistantsManager.chat(data.assistantId, data.messages);
        return NextResponse.json({ success: true, ...result });

      case "update":
        if (!data.assistantId) {
          return NextResponse.json(
            { error: "assistantId required" },
            { status: 400 }
          );
        }
        const updated = await assistantsManager.updateAssistant(
          data.assistantId,
          data.config
        );
        return NextResponse.json({ success: true, assistant: updated });

      case "delete":
        if (!data.assistantId) {
          return NextResponse.json(
            { error: "assistantId required" },
            { status: 400 }
          );
        }
        await assistantsManager.deleteAssistant(data.assistantId);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Assistants POST error:", error);
    return NextResponse.json(
      { error: "Assistant operation failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}
