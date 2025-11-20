import { z } from 'zod';
import type { AgentDefinition } from '../../runner';
import type { AgentContext } from '../../types';

// Define tools for SalesAgent
const productLookupTool = {
  name: 'productLookup',
  description: 'Look up product details and pricing',
  parameters: z.object({
    query: z.string().describe('Product name or category'),
  }),
  execute: async ({ query: _query }: { query: string }, _context: AgentContext) => {
    // TODO: Implement actual DB lookup
    return {
      products: [
        {
          id: 'prod-1',
          name: 'Premium Fertilizer',
          price: '15,000 RWF',
          description: 'High quality fertilizer for maize',
        },
        {
          id: 'prod-2',
          name: 'Water Pump',
          price: '120,000 RWF',
          description: 'Solar powered water pump',
        },
      ],
    };
  },
};

const createLeadTool = {
  name: 'createLead',
  description: 'Create a sales lead for follow-up',
  parameters: z.object({
    customerName: z.string().optional(),
    interest: z.string().describe('What the customer is interested in'),
    phone: z.string().describe('Customer phone number'),
  }),
  execute: async ({ customerName: _customerName, interest: _interest, phone: _phone }: { customerName?: string; interest: string; phone: string }, _context: AgentContext) => {
    // TODO: Implement actual lead creation in DB
    return {
      success: true,
      leadId: `lead-${Date.now()}`,
      message: 'Lead created successfully. A sales representative will contact you shortly.',
    };
  },
};

export const SalesAgent: AgentDefinition = {
  name: 'SalesAgent',
  instructions: `You are a persuasive and helpful sales assistant for EasyMO.
Your goal is to help customers find products and generate leads for the sales team.

Capabilities:
- Look up product information and pricing.
- Answer questions about product features and benefits.
- Collect customer information to create sales leads.

Guidelines:
- Focus on the benefits of the products.
- Be polite and professional.
- If a customer shows strong interest, offer to have a human agent contact them (create a lead).`,
  model: 'gpt-4o',
  temperature: 0.7,
  tools: [productLookupTool, createLeadTool],
};
