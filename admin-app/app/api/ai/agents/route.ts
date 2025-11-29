/**
 * AI Agents API Route
 * Create, manage, and execute AI agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { mobilityAgent, marketplaceAgent, supportAgent } from '@/lib/ai/domain';
import { runAgent } from '@/lib/ai/agent-executor';
import { logStructuredEvent } from '@/lib/monitoring/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AgentRequest {
  agent: 'mobility' | 'marketplace' | 'support' | 'custom';
  message: string;
  context?: Record<string, any>;
  systemPrompt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: AgentRequest = await request.json();

    await logStructuredEvent('AI_AGENT_REQUEST', {
      agent: body.agent,
      messageLength: body.message.length,
    });

    let result;

    // Route to appropriate domain agent
    switch (body.agent) {
      case 'mobility':
        result = await mobilityAgent.execute(body.message);
        break;
      case 'marketplace':
        result = await marketplaceAgent.execute(body.message);
        break;
      case 'support':
        result = await supportAgent.execute(body.message);
        break;
      case 'custom':
        if (!body.systemPrompt) {
          return NextResponse.json(
            { error: 'systemPrompt required for custom agent' },
            { status: 400 }
          );
        }
        const customResult = await runAgent(body.message, {
          systemPrompt: body.systemPrompt,
        });
        result = { response: customResult, toolCalls: [], iterations: 1 };
        break;
      default:
        return NextResponse.json(
          { error: `Unknown agent: ${body.agent}` },
          { status: 400 }
        );
    }

    await logStructuredEvent('AI_AGENT_RESPONSE', {
      agent: body.agent,
      iterations: result.iterations,
      toolCallsCount: result.toolCalls.length,
    });

    return NextResponse.json({
      response: result.response,
      toolCalls: result.toolCalls,
      iterations: result.iterations,
    });
  } catch (error) {
    await logStructuredEvent('AI_AGENT_ERROR', {
      error: (error as Error).message,
    });

    return NextResponse.json(
      {
        error: 'Agent execution failed',
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
