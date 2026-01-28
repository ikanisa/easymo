/**
 * OpenAI Responses Service
 * 
 * Provides call summarization, entity extraction, and domain matching
 * using the OpenAI Responses API with structured outputs.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import express, { Request, Response } from 'express';
import OpenAI from 'openai';
import pino from 'pino';
import { z } from 'zod';

config();

const logger = pino({ name: 'responses-service' });

const app = express();
app.use(express.json());

// Clients
const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// SCHEMAS
// ============================================================================

const CallSummarySchema = z.object({
  summary: z.string().describe('2-3 sentence summary of the call'),
  language: z.string().describe('Primary language used (en, rw, fr, sw)'),
  main_intent: z.string().describe('What the caller wanted (job_search, sell_produce, find_property, etc.)'),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
  entities: z.object({
    person_name: z.string().optional(),
    phone_number: z.string().optional(),
    location: z.string().optional(),
    product_or_service: z.string().optional(),
    quantity: z.number().optional(),
    price: z.number().optional(),
    date: z.string().optional(),
  }).describe('Key entities extracted from the call'),
  next_actions: z.array(z.object({
    type: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    description: z.string(),
    scheduled_for: z.string().optional(),
  })).describe('Recommended follow-up actions'),
});

const JobsIntakeSchema = z.object({
  mode: z.enum(['seeking', 'hiring']),
  role_title: z.string(),
  category: z.string().optional(),
  location: z.string().optional(),
  skills: z.array(z.string()).optional(),
  experience_years: z.number().optional(),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'gig']).optional(),
  start_availability: z.string().optional(),
  notes: z.string().optional(),
});

const FarmersIntakeSchema = z.object({
  side: z.enum(['farmer', 'buyer']),
  produce_type: z.string(),
  variety: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  expected_harvest_date: z.string().optional(),
  delivery_window_start: z.string().optional(),
  delivery_window_end: z.string().optional(),
  location_district: z.string().optional(),
  location_sector: z.string().optional(),
  min_price: z.number().optional(),
  max_price: z.number().optional(),
  quality_grade: z.string().optional(),
  payment_preference: z.string().optional(),
  notes: z.string().optional(),
});

const RealEstateIntakeSchema = z.object({
  side: z.enum(['seeker', 'lister']),
  transaction_type: z.enum(['buy', 'rent']),
  property_type: z.string(),
  location_district: z.string().optional(),
  location_area: z.string().optional(),
  bedrooms_min: z.number().optional(),
  bedrooms_max: z.number().optional(),
  budget_min: z.number().optional(),
  budget_max: z.number().optional(),
  size_sqm_min: z.number().optional(),
  amenities: z.array(z.string()).optional(),
  move_in_date: z.string().optional(),
  notes: z.string().optional(),
});

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * POST /summarise-call
 * 
 * Generate summary and extract entities from call transcript
 */
app.post('/summarise-call', async (req: Request, res: Response) => {
  try {
    const { call_id } = req.body;

    if (!call_id) {
      return res.status(400).json({ error: 'call_id required' });
    }

    // Fetch transcript
    const { data: transcripts } = await supabase
      .from('call_transcripts')
      .select('role, text')
      .eq('call_id', call_id)
      .order('seq', { ascending: true });

    if (!transcripts || transcripts.length === 0) {
      return res.status(404).json({ error: 'No transcript found for call' });
    }

    const fullTranscript = transcripts
      .map((t) => `${t.role}: ${t.text}`)
      .join('\n');

    // Get call metadata
    const { data: call } = await supabase
      .from('calls')
      .select('agent_id, metadata')
      .eq('id', call_id)
      .single();

    const agentId = call?.agent_id || 'generic';

    // Generate summary with structured output
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are analyzing a phone call transcript. Extract key information and provide a structured summary. The call was handled by agent: ${agentId}`,
        },
        {
          role: 'user',
          content: `Analyze this call transcript and extract structured data:\n\n${fullTranscript}`,
        },
      ],
      response_format: { 
        type: 'json_schema',
        json_schema: {
          name: 'call_summary',
          schema: zodToJsonSchema(CallSummarySchema),
        },
      },
    });

    const summaryData = JSON.parse(response.choices[0].message.content || '{}');

    // Get call duration
    const { data: callData } = await supabase
      .from('calls')
      .select('started_at, ended_at')
      .eq('id', call_id)
      .single();

    let durationSeconds = null;
    if (callData?.started_at && callData?.ended_at) {
      durationSeconds = Math.floor(
        (new Date(callData.ended_at).getTime() - new Date(callData.started_at).getTime()) / 1000
      );
    }

    // Save summary
    await supabase.from('call_summaries').upsert({
      call_id,
      summary: summaryData.summary,
      language: summaryData.language,
      main_intent: summaryData.main_intent,
      sentiment: summaryData.sentiment,
      entities: summaryData.entities,
      next_actions: summaryData.next_actions,
      duration_seconds: durationSeconds,
      word_count: fullTranscript.split(/\s+/).length,
    });

    logger.info({ call_id, intent: summaryData.main_intent, msg: 'call.summarised' });

    res.json({
      call_id,
      ...summaryData,
    });
  } catch (error) {
    logger.error({ error, msg: 'summarise-call.error' });
    res.status(500).json({ error: 'Failed to summarise call' });
  }
});

/**
 * POST /extract-intake
 * 
 * Extract domain-specific intake data from transcript
 */
app.post('/extract-intake', async (req: Request, res: Response) => {
  try {
    const { call_id, domain } = req.body;

    if (!call_id || !domain) {
      return res.status(400).json({ error: 'call_id and domain required' });
    }

    // Fetch transcript
    const { data: transcripts } = await supabase
      .from('call_transcripts')
      .select('role, text')
      .eq('call_id', call_id)
      .order('seq', { ascending: true });

    if (!transcripts || transcripts.length === 0) {
      return res.status(404).json({ error: 'No transcript found' });
    }

    const fullTranscript = transcripts.map((t) => `${t.role}: ${t.text}`).join('\n');

    // Select schema based on domain
    let schema: z.ZodSchema;
    let tableName: string;
    let prompt: string;

    switch (domain) {
      case 'jobs':
        schema = JobsIntakeSchema;
        tableName = 'jobs_call_intakes';
        prompt = 'Extract job search or hiring requirements from this call. Determine if the caller is seeking a job or hiring.';
        break;
      case 'farmers':
        schema = FarmersIntakeSchema;
        tableName = 'farmers_call_intakes';
        prompt = 'Extract produce details from this call. Determine if the caller is a farmer selling or a buyer looking to purchase.';
        break;
      case 'real_estate':
        schema = RealEstateIntakeSchema;
        tableName = 'real_estate_call_intakes';
        prompt = 'Extract property requirements from this call. Determine if the caller is seeking property or listing one.';
        break;
      default:
        return res.status(400).json({ error: 'Invalid domain. Use: jobs, farmers, real_estate' });
    }

    // Extract with structured output
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: fullTranscript },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: `${domain}_intake`,
          schema: zodToJsonSchema(schema),
        },
      },
    });

    const intakeData = JSON.parse(response.choices[0].message.content || '{}');

    // Save to domain table
    await supabase.from(tableName).upsert({
      call_id,
      ...intakeData,
    });

    logger.info({ call_id, domain, msg: 'intake.extracted' });

    res.json({
      call_id,
      domain,
      intake: intakeData,
    });
  } catch (error) {
    logger.error({ error, msg: 'extract-intake.error' });
    res.status(500).json({ error: 'Failed to extract intake' });
  }
});

/**
 * POST /match-domain
 * 
 * Find matches for domain-specific intake
 */
app.post('/match-domain', async (req: Request, res: Response) => {
  try {
    const { call_id, domain, limit = 5 } = req.body;

    if (!call_id || !domain) {
      return res.status(400).json({ error: 'call_id and domain required' });
    }

    // Get intake data
    let intakeTable: string;
    let matchTable: string;

    switch (domain) {
      case 'jobs':
        intakeTable = 'jobs_call_intakes';
        matchTable = 'jobs_matches';
        break;
      case 'farmers':
        intakeTable = 'farmers_call_intakes';
        matchTable = 'farmers_matches';
        break;
      case 'real_estate':
        intakeTable = 'real_estate_call_intakes';
        matchTable = 'real_estate_matches';
        break;
      default:
        return res.status(400).json({ error: 'Invalid domain' });
    }

    const { data: intake } = await supabase
      .from(intakeTable)
      .select('*')
      .eq('call_id', call_id)
      .single();

    if (!intake) {
      return res.status(404).json({ error: 'Intake not found. Run /extract-intake first.' });
    }

    // Run domain-specific matching
    let matches: any[] = [];

    switch (domain) {
      case 'jobs':
        matches = await matchJobs(intake, limit);
        break;
      case 'farmers':
        matches = await matchFarmers(intake, limit);
        break;
      case 'real_estate':
        matches = await matchRealEstate(intake, limit);
        break;
    }

    // Save matches
    for (const match of matches) {
      await supabase.from(matchTable).upsert({
        call_id,
        ...match,
      });
    }

    logger.info({ call_id, domain, matchCount: matches.length, msg: 'matches.found' });

    res.json({
      call_id,
      domain,
      matches,
    });
  } catch (error) {
    logger.error({ error, msg: 'match-domain.error' });
    res.status(500).json({ error: 'Failed to find matches' });
  }
});

// ============================================================================
// MATCHING FUNCTIONS
// ============================================================================

async function matchJobs(intake: any, limit: number): Promise<any[]> {
  // Match based on role, location, skills
  const { data: jobs } = await supabase
    .from('job_listings')
    .select('id, title, company, location, salary_range, requirements')
    .textSearch('title', intake.role_title || '', { type: 'websearch' })
    .limit(limit);

  return (jobs || []).map((job) => ({
    matched_listing_id: job.id,
    match_score: 0.75, // TODO: Calculate actual score
    status: 'pending',
    metadata: { job },
  }));
}

async function matchFarmers(intake: any, limit: number): Promise<any[]> {
  // Match farmers to buyers or vice versa
  const opposingSide = intake.side === 'farmer' ? 'buyer' : 'farmer';
  
  const { data: counterparties } = await supabase
    .from('farmers_call_intakes')
    .select('call_id, produce_type, quantity, location_district')
    .eq('side', opposingSide)
    .eq('produce_type', intake.produce_type)
    .limit(limit);

  return (counterparties || []).map((cp) => ({
    call_id: intake.call_id,
    matched_with_call_id: cp.call_id,
    match_score: 0.8,
    status: 'pending',
    metadata: { counterparty: cp },
  }));
}

async function matchRealEstate(intake: any, limit: number): Promise<any[]> {
  // Match seekers to listers
  const opposingSide = intake.side === 'seeker' ? 'lister' : 'seeker';
  
  const { data: properties } = await supabase
    .from('properties')
    .select('id, title, price, location, bedrooms, property_type')
    .eq('transaction_type', intake.transaction_type)
    .limit(limit);

  return (properties || []).map((prop) => ({
    matched_property_id: prop.id,
    match_score: 0.7,
    status: 'pending',
    metadata: { property: prop },
  }));
}

// ============================================================================
// UTILITIES
// ============================================================================

function zodToJsonSchema(schema: z.ZodSchema): object {
  // Simple Zod to JSON Schema conversion
  // For production, use zod-to-json-schema package
  const shape = (schema as any)._def?.shape?.();
  if (!shape) return { type: 'object', properties: {} };

  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodType = value as any;
    properties[key] = { type: getJsonType(zodType) };
    if (zodType._def?.description) {
      properties[key].description = zodType._def.description;
    }
    if (!zodType.isOptional?.()) {
      required.push(key);
    }
  }

  return { type: 'object', properties, required };
}

function getJsonType(zodType: any): string {
  const typeName = zodType._def?.typeName;
  switch (typeName) {
    case 'ZodString': return 'string';
    case 'ZodNumber': return 'number';
    case 'ZodBoolean': return 'boolean';
    case 'ZodArray': return 'array';
    case 'ZodEnum': return 'string';
    case 'ZodOptional': return getJsonType(zodType._def?.innerType);
    default: return 'string';
  }
}

// ============================================================================
// START SERVER
// ============================================================================

const PORT = parseInt(process.env.RESPONSES_SERVICE_PORT || '3031', 10);

app.listen(PORT, () => {
  logger.info({ port: PORT, msg: 'responses-service.started' });
});
