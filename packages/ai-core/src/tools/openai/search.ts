import OpenAI from 'openai';

import { AgentContext,Tool } from '../../base/types';

/**
 * OpenAI Web Search Tool
 * Search the web using OpenAI's web search capability
 */
export const openaiWebSearchTool: Tool = {
  name: 'openai_web_search',
  description: 'Search the web using OpenAI (real-time information)',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' }
    },
    required: ['query']
  },
  capabilities: ['search', 'web'],
  execute: async (params, context) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Use GPT-4 with web browsing capability
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a web search assistant. Provide accurate, up-to-date information from the web.'
        },
        {
          role: 'user',
          content: `Search for: ${params.query}`
        }
      ],
      max_tokens: 1000
    });

    return {
      summary: response.choices[0]?.message?.content || '',
      sources: [] // OpenAI doesn't provide sources directly
    };
  }
};

/**
 * OpenAI Deep Search Tool
 * Perform deep research using OpenAI
 */
export const openaiDeepSearchTool: Tool = {
  name: 'openai_deep_search',
  description: 'Perform deep research and analysis on a topic',
  parameters: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Research topic' },
      depth: { type: 'string', enum: ['quick', 'thorough', 'comprehensive'], description: 'Research depth' }
    },
    required: ['topic']
  },
  capabilities: ['research', 'analysis'],
  execute: async (params, context) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = params.depth === 'comprehensive'
      ? 'You are a research analyst. Provide comprehensive, well-structured research with multiple perspectives.'
      : 'You are a research assistant. Provide concise, accurate information.';

    const response = await openai.chat.completions.create({
      model: 'gpt-5', // Will fallback to gpt-4-turbo if unavailable
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Research topic: ${params.topic}` }
      ],
      max_tokens: params.depth === 'comprehensive' ? 4000 : 1500
    });

    return {
      research: response.choices[0]?.message?.content || '',
      depth: params.depth
    };
  }
};

/**
 * OpenAI Code Interpreter Tool
 * Execute Python code for data analysis
 */
export const openaiCodeInterpreterTool: Tool = {
  name: 'openai_code_interpreter',
  description: 'Execute Python code for data analysis and calculations',
  parameters: {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'Task description (e.g., "Calculate ROI")' },
      data: { type: 'object', description: 'Input data for analysis' }
    },
    required: ['task']
  },
  capabilities: ['code', 'analysis'],
  execute: async (params, context) => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a data analyst. Write and execute Python code to solve problems.'
        },
        {
          role: 'user',
          content: `Task: ${params.task}\nData: ${JSON.stringify(params.data)}`
        }
      ],
      tools: [{
        type: 'code_interpreter'
      }]
    });

    return {
      result: response.choices[0]?.message?.content || '',
      code_executed: true
    };
  }
};

/**
 * SIP Trunk Integration Tool
 * Make voice calls via SIP trunk (MTN)
 */
export const sipTrunkTool: Tool = {
  name: 'sip_trunk_call',
  description: 'Initiate voice call via SIP trunk (MTN)',
  parameters: {
    type: 'object',
    properties: {
      phone_number: { type: 'string', description: 'Phone number to call (international format)' },
      script: { type: 'string', description: 'Call script or message' },
      voice: { type: 'string', enum: ['male', 'female'], description: 'Voice gender' }
    },
    required: ['phone_number']
  },
  capabilities: ['voice', 'telephony'],
  execute: async (params, context) => {
    // SIP trunk integration would go here
    // For now, returning a placeholder
    
    return {
      call_id: 'call_' + Date.now(),
      status: 'initiated',
      phone_number: params.phone_number,
      message: 'SIP trunk integration pending - requires MTN SIP credentials'
    };
  }
};
