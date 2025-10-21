export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getFunctionsBaseUrl } from '@/lib/server/functions-client';
import { assistantRunSchema } from '@/lib/schemas';

const schema = z.object({ promptId: z.string(), input: z.string().optional().nullable() });

function mapPromptToAgentKind(promptId: string): 'broker' | 'support' | 'sales' | 'marketing' {
  const id = promptId.toLowerCase();
  if (id.includes('broker') || id.includes('quote') || id.includes('market')) return 'broker';
  if (id.includes('sales')) return 'sales';
  if (id.includes('marketing')) return 'marketing';
  return 'support';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = schema.parse(body);
    const base = getFunctionsBaseUrl();
    const token = process.env.EASYMO_ADMIN_TOKEN || process.env.ADMIN_TOKEN || process.env.VITE_ADMIN_TOKEN || '';
    if (!base || !token) return NextResponse.json({ error: 'functions_base_or_admin_token_missing' }, { status: 503 });

    const agent_kind = mapPromptToAgentKind(payload.promptId);
    const res = await fetch(`${base}/agent-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': token },
      body: JSON.stringify({ agent_kind, message: payload.input || 'Hello' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: 'agent_chat_failed', data }, { status: res.status });

    const now = new Date().toISOString();
    const run = assistantRunSchema.parse({
      promptId: payload.promptId,
      suggestion: {
        id: `suggestion-${Date.now()}`,
        title: 'Assistant Suggestion',
        summary: data?.assistant?.text || data?.stub?.text || 'No suggestion',
        generatedAt: now,
        actions: (data?.assistant?.suggestions || data?.stub?.suggestions || []).map((label: string, idx: number) => ({
          id: `action-${idx}`, label, summary: '', impact: 'low', recommended: idx === 0,
        })),
        references: [],
        limitations: [],
      },
      messages: [
        { id: `assistant-${Date.now()}`, role: 'assistant', content: data?.assistant?.text || data?.stub?.text || 'OK', createdAt: now },
      ],
    });
    return NextResponse.json(run);
  } catch (error) {
    return NextResponse.json({ error: 'bad_request', message: (error as Error).message }, { status: 400 });
  }
}

