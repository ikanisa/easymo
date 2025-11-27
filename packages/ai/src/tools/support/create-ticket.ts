import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { Tool } from '../../core/types';

import { childLogger } from '@easymo/commons';

const log = childLogger({ service: 'ai' });

const CreateTicketSchema = z.object({
  user_id: z.string().uuid(),
  subject: z.string().min(5).max(200),
  description: z.string().min(10),
  category: z.enum([
    'booking_issue',
    'payment_issue',
    'technical_issue',
    'account_issue',
    'general_inquiry',
    'complaint',
    'feedback',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  related_booking_id: z.string().uuid().optional(),
  related_transaction_id: z.string().uuid().optional(),
  attachments: z.array(z.string()).optional(),
});

export const createTicketTool: Tool = {
  name: 'create_ticket',
  description: 'Create a support ticket for user issues, complaints, or inquiries.',
  parameters: CreateTicketSchema,
  category: 'support',
  requiresAuth: true,
  handler: async (args, context) => {
    const {
      user_id,
      subject,
      description,
      category,
      priority,
      related_booking_id,
      related_transaction_id,
      attachments,
    } = args;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // 1. Validate user exists
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, email, phone_number')
        .eq('id', user_id)
        .single();

      if (userError || !user) {
        return {
          success: false,
          error: 'User not found',
          message: "I couldn't find your account. Please try again.",
        };
      }

      // 2. Check for duplicate tickets (within last hour)
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { data: recentTickets } = await supabase
        .from('support_tickets')
        .select('id, subject')
        .eq('user_id', user_id)
        .eq('subject', subject)
        .gte('created_at', oneHourAgo);

      if (recentTickets && recentTickets.length > 0) {
        return {
          success: false,
          error: 'Duplicate ticket',
          message: "You already submitted a similar ticket recently. Please check your existing tickets or wait before creating a new one.",
          existing_ticket_id: recentTickets[0].id,
        };
      }

      // 3. Generate ticket number
      const ticketNumber = generateTicketNumber();

      // 4. Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          ticket_number: ticketNumber,
          user_id,
          subject,
          description,
          category,
          priority,
          status: 'open',
          related_booking_id,
          related_transaction_id,
          created_at: new Date().toISOString(),
          metadata: {
            source: 'whatsapp',
            conversation_id: context?.conversationId,
            attachments: attachments || [],
          },
        })
        .select(`
          id,
          ticket_number,
          subject,
          category,
          priority,
          status,
          created_at
        `)
        .single();

      if (ticketError) {
        return {
          success: false,
          error: ticketError.message,
          message: "Failed to create support ticket. Please try again.",
        };
      }

      // 5. Create initial ticket message
      await supabase.from('support_messages').insert({
        ticket_id: ticket.id,
        user_id,
        message: description,
        is_from_user: true,
        created_at: new Date().toISOString(),
      });

      // 6. Send notifications (would trigger notification system)
      // await notifySupportTeam(ticket);
      // await notifyUser(user, ticket);

      // 7. Auto-assign based on category and priority
      const assignedAgent = await autoAssignTicket(ticket.id, category, priority);

      return {
        success: true,
        ticket: {
          id: ticket.id,
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
          category: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
          created_at: ticket.created_at,
          assigned_to: assignedAgent,
        },
        message: `✅ Support ticket created successfully!\n\nTicket #: ${ticket.ticket_number}\nCategory: ${category}\nPriority: ${priority}\n\nOur support team will respond within ${getResponseTime(priority)}. You can check the status anytime by saying "Check ticket ${ticket.ticket_number}".`,
        estimated_response_time: getResponseTime(priority),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: "An error occurred while creating your support ticket. Please try again.",
      };
    }
  },
};

// Helper: Generate unique ticket number
function generateTicketNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `TKT-${timestamp}-${random}`;
}

// Helper: Get estimated response time based on priority
function getResponseTime(priority: string): string {
  const times: Record<string, string> = {
    urgent: '1 hour',
    high: '4 hours',
    medium: '24 hours',
    low: '48 hours',
  };
  return times[priority] || '24 hours';
}

// Helper: Auto-assign ticket to agent
async function autoAssignTicket(
  ticketId: string,
  category: string,
  priority: string
): Promise<string | null> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Find available agent with lowest ticket count in this category
    const { data: agent } = await supabase
      .rpc('find_available_support_agent', {
        p_category: category,
        p_priority: priority,
      })
      .single();

    if (agent) {
      await supabase
        .from('support_tickets')
        .update({
          assigned_to: agent.id,
          assigned_at: new Date().toISOString(),
        })
        .eq('id', ticketId);

      return agent.name;
    }

    return null;
  } catch (error) {
    log.error('Auto-assign failed:', error);
    return null;
  }
}
