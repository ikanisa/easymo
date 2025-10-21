import 'dotenv/config';
import 'reflect-metadata';
import { Controller, Module, Post, Body } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import type { LeadInput } from '@va/shared';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

@Controller()
class AgentController {
  @Post('respond')
  async respond(
    @Body()
    body: {
      messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      call_id?: string;
    }
  ) {
    const response = await openai.responses.create({
      model: process.env.OPENAI_RESPONSES_MODEL || 'gpt-5',
      input: body.messages,
      tools: [
        {
          type: 'function',
          name: 'upsertLead',
          description: 'Create or update a CRM lead attached to a call',
          strict: false,
          parameters: {
            type: 'object',
            properties: {
              phone: { type: 'string' },
              name: { type: 'string' },
              company: { type: 'string' },
              intent: { type: 'string' },
              notes: { type: 'string' },
              call_id: { type: 'string' }
            }
          }
        }
      ]
    });

    const outputs: Array<{ tool_call_id: string; output: string }> = [];

    const toolCalls = ((response.output as any[]) ?? []).filter(
      (item) => item?.type === 'tool_call' && item?.name === 'upsertLead'
    );

    for (const item of toolCalls) {
      const args = item.arguments as LeadInput;
      const payload = { ...args, call_id: args?.call_id ?? body.call_id };

      const { data } = await supabase
        .from('leads')
        .insert({
          phone: payload.phone,
          full_name: payload.name,
          company: payload.company,
          intent: payload.intent,
          notes: payload.notes,
          call_id: payload.call_id
        })
        .select('*')
        .single();

      outputs.push({ tool_call_id: item.id as string, output: JSON.stringify(data) });
    }

    if (outputs.length && (openai as any)?.responses?.submitToolOutputs) {
      await (openai as any).responses.submitToolOutputs(response.id, {
        tool_outputs: outputs
      });
    }

    return response;
  }
}

@Module({ controllers: [AgentController] })
class AgentModule {}

async function bootstrap() {
  const app = await NestFactory.create(AgentModule);
  await app.listen(Number(process.env.AGENT_CORE_PORT) || 3002);
  // eslint-disable-next-line no-console
  console.log(`agent-core listening on :${process.env.AGENT_CORE_PORT || 3002}`);
}

bootstrap();
