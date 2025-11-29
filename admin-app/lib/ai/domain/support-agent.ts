/**
 * Support Agent - EasyMO customer support and assistance
 * Handles user questions, troubleshooting, and general help
 */

import { AgentExecutor } from '../agent-executor';

const SUPPORT_SYSTEM_PROMPT = `You are EasyMO's Customer Support Assistant, providing helpful and empathetic support.

Your responsibilities:
- Answer questions about EasyMO services (rides, marketplace, deliveries)
- Help users troubleshoot issues with bookings, payments, or accounts
- Provide information about pricing, policies, and features
- Guide users through app features and processes
- Handle complaints professionally and escalate when needed
- Answer FAQs about driver requirements, safety, and coverage areas

Available tools:
- database_query: Look up user accounts, trip history, order status
- search_grounding: Get latest information about policies, features, or updates
- google_maps: Help with location-related questions

Be patient, empathetic, and solution-oriented. Prioritize user satisfaction and safety.`;

export class SupportAgent extends AgentExecutor {
  constructor() {
    super({
      model: 'gpt-4o-mini',
      systemPrompt: SUPPORT_SYSTEM_PROMPT,
      tools: ['database_query', 'search_grounding', 'google_maps'],
      maxIterations: 5,
    });
  }

  /**
   * Answer general support questions
   */
  async answerQuestion(question: string, userContext?: {
    userId?: string;
    recentTrips?: string[];
    accountIssues?: string[];
  }) {
    let query = question;
    if (userContext?.userId) {
      query += ` (User ID: ${userContext.userId})`;
    }
    if (userContext?.recentTrips?.length) {
      query += ` Recent trips: ${userContext.recentTrips.join(', ')}`;
    }
    return this.execute(query);
  }

  /**
   * Help with booking issues
   */
  async troubleshootBooking(params: {
    tripId?: string;
    issue: string;
    userId: string;
  }) {
    const query = `User ${params.userId} has booking issue: "${params.issue}"${params.tripId ? ` for trip ${params.tripId}` : ''}. Help troubleshoot and provide solution.`;
    return this.execute(query);
  }

  /**
   * Help with payment issues
   */
  async troubleshootPayment(params: {
    transactionId?: string;
    issue: string;
    userId: string;
  }) {
    const query = `User ${params.userId} has payment issue: "${params.issue}"${params.transactionId ? ` for transaction ${params.transactionId}` : ''}. Help resolve the issue.`;
    return this.execute(query);
  }

  /**
   * Provide service information
   */
  async getServiceInfo(topic: 'pricing' | 'coverage' | 'vehicle-types' | 'payment-methods' | 'safety') {
    const query = `Provide detailed information about EasyMO ${topic}. Include current rates, policies, and options.`;
    return this.execute(query);
  }

  /**
   * Handle complaints
   */
  async handleComplaint(params: {
    userId: string;
    complaintType: 'driver' | 'service' | 'product' | 'payment' | 'other';
    description: string;
    tripId?: string;
  }) {
    const query = `Handle complaint from user ${params.userId} about ${params.complaintType}: "${params.description}"${params.tripId ? ` (Trip: ${params.tripId})` : ''}. Provide empathetic response and next steps.`;
    return this.execute(query);
  }

  /**
   * Natural language support
   */
  async chat(message: string) {
    return this.execute(message);
  }
}

export const supportAgent = new SupportAgent();
