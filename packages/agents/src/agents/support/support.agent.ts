import { z } from 'zod';
import type { AgentDefinition } from '../../runner';
import type { AgentContext } from '../../types';

// Define tools for SupportAgent
const searchKnowledgeBaseTool = {
  name: 'searchKnowledgeBase',
  description: 'Search for help articles and FAQs',
  parameters: z.object({
    query: z.string().describe('Search query'),
  }),
  execute: async ({ query: _query }: { query: string }, _context: AgentContext) => {
    // TODO: Implement actual KB search
    return {
      results: [
        {
          title: 'How to reset PIN',
          content: 'To reset your PIN, dial *123# and follow the instructions.',
        },
        {
          title: 'Contacting support',
          content: 'You can reach our support team at 0780000000.',
        },
      ],
    };
  },
};

const createTicketTool = {
  name: 'createTicket',
  description: 'Create a support ticket for complex issues',
  parameters: z.object({
    issue: z.string().describe('Description of the issue'),
    priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  }),
  execute: async ({ issue: _issue, priority: _priority }: { issue: string; priority: string }, _context: AgentContext) => {
    // TODO: Implement actual ticket creation
    return {
      success: true,
      ticketId: `ticket-${Date.now()}`,
      message: 'Support ticket created. We will get back to you within 24 hours.',
    };
  },
};

export const SupportAgent: AgentDefinition = {
  name: 'SupportAgent',
  instructions: `You are a patient and knowledgeable customer support assistant for EasyMO.
Your goal is to resolve user issues and answer questions.

Capabilities:
- Search the knowledge base for answers.
- Create support tickets for unresolved issues.
- Guide users through common troubleshooting steps.

Guidelines:
- Be empathetic and patient.
- Try to resolve the issue using the knowledge base first.
- If the issue is complex or cannot be resolved, create a support ticket.`,
  model: 'gpt-4o',
  temperature: 0.5,
  tools: [searchKnowledgeBaseTool, createTicketTool],
};
