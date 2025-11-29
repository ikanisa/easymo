import { NextRequest, NextResponse } from "next/server";

import { processDocument,ragQuery, vectorStore } from "@/lib/rag/vector-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get("query");
    const limit = parseInt(searchParams.get("limit") || "5");

    if (!query) {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }

    const results = await vectorStore.search(query, limit);

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error("RAG search error:", error);
    return NextResponse.json(
      { error: "Search failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case "add_document":
        if (!data.content) {
          return NextResponse.json(
            { error: "content required" },
            { status: 400 }
          );
        }
        const id = await vectorStore.addDocument(data.content, data.metadata);
        return NextResponse.json({ success: true, id });

      case "add_documents":
        if (!data.documents || !Array.isArray(data.documents)) {
          return NextResponse.json(
            { error: "documents array required" },
            { status: 400 }
          );
        }
        const ids = await vectorStore.addDocuments(data.documents);
        return NextResponse.json({ success: true, ids, count: ids.length });

      case "process_document":
        if (!data.text) {
          return NextResponse.json({ error: "text required" }, { status: 400 });
        }
        const chunkIds = await processDocument(data.text, data.metadata);
        return NextResponse.json({
          success: true,
          ids: chunkIds,
          chunks: chunkIds.length,
        });

      case "query":
        if (!data.question) {
          return NextResponse.json(
            { error: "question required" },
            { status: 400 }
          );
        }
        const result = await ragQuery(
          data.question,
          data.context,
          data.numResults
        );
        return NextResponse.json({
          success: true,
          answer: result.answer,
          sources: result.sources,
        });

      case "delete":
        if (!data.id) {
          return NextResponse.json({ error: "id required" }, { status: 400 });
        }
        await vectorStore.deleteDocument(data.id);
        return NextResponse.json({ success: true });

      case "update":
        if (!data.id || !data.content) {
          return NextResponse.json(
            { error: "id and content required" },
            { status: 400 }
          );
        }
        await vectorStore.updateDocument(data.id, data.content, data.metadata);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("RAG operation error:", error);
    return NextResponse.json(
      { error: "RAG operation failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}
