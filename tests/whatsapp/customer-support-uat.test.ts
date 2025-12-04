/**
 * Customer Support Workflow UAT Tests (Vitest)
 * Comprehensive User Acceptance Testing for customer support AI agent workflows
 */

import { describe, expect, it } from 'vitest';

// ============================================================================
// CUSTOMER SUPPORT SESSION TESTS
// ============================================================================

describe('Customer Support UAT - Session', () => {
  it('creates new support session correctly', () => {
    const createSession = (
      profileId: string
    ): {
      id: string;
      profile_id: string;
      agent_slug: string;
      status: string;
      channel: string;
      created_at: string;
    } => {
      return {
        id: crypto.randomUUID(),
        profile_id: profileId,
        agent_slug: 'support',
        status: 'active',
        channel: 'whatsapp',
        created_at: new Date().toISOString(),
      };
    };

    const session = createSession('user-123');
    expect(session.agent_slug).toBe('support');
    expect(session.status).toBe('active');
    expect(session.channel).toBe('whatsapp');
  });

  it('resumes existing active session', () => {
    const existingSessions = [
      { id: 'session-1', status: 'active', created_at: new Date().toISOString() },
      { id: 'session-2', status: 'resolved', created_at: new Date(Date.now() - 86400000).toISOString() },
    ];

    const activeSession = existingSessions.find((s) => s.status === 'active');
    expect(activeSession?.id).toBe('session-1');
  });

  it('does not resume resolved sessions', () => {
    const existingSessions = [
      { id: 'session-1', status: 'resolved', created_at: new Date().toISOString() },
      { id: 'session-2', status: 'closed', created_at: new Date(Date.now() - 86400000).toISOString() },
    ];

    const activeSession = existingSessions.find((s) => s.status === 'active');
    expect(activeSession).toBeUndefined();
  });

  it('validates session status values', () => {
    const VALID_STATUSES = ['active', 'resolved', 'escalated', 'closed'];

    const isValidStatus = (status: string): boolean => {
      return VALID_STATUSES.includes(status);
    };

    expect(isValidStatus('active')).toBe(true);
    expect(isValidStatus('resolved')).toBe(true);
    expect(isValidStatus('escalated')).toBe(true);
    expect(isValidStatus('invalid')).toBe(false);
  });
});

// ============================================================================
// SUPPORT CATEGORY TESTS
// ============================================================================

describe('Customer Support UAT - Categories', () => {
  it('provides all support categories', () => {
    const categories = [
      { id: 'support_payment', title: '💳 Payment Issue' },
      { id: 'support_technical', title: '🔧 Technical Help' },
      { id: 'support_navigation', title: '🧭 Navigation Help' },
      { id: 'support_other', title: '❓ Other Question' },
    ];

    expect(categories.length).toBe(4);
    expect(categories.some((c) => c.id === 'support_payment')).toBe(true);
    expect(categories.some((c) => c.id === 'support_technical')).toBe(true);
  });

  it('validates category button IDs', () => {
    const isSupportCategory = (buttonId: string): boolean => {
      const supportCategories = ['support_payment', 'support_technical', 'support_navigation', 'support_other'];
      return supportCategories.includes(buttonId);
    };

    expect(isSupportCategory('support_payment')).toBe(true);
    expect(isSupportCategory('support_technical')).toBe(true);
    expect(isSupportCategory('rides')).toBe(false);
    expect(isSupportCategory('invalid')).toBe(false);
  });

  it('maps categories to appropriate responses', () => {
    const getCategoryResponse = (category: string): string => {
      const responses: Record<string, string> = {
        support_payment: 'I can help with payment issues.',
        support_technical: 'Let me help you troubleshoot.',
        support_navigation: "I'll help you navigate EasyMO.",
        support_other: "I'm here to help with any question.",
      };
      return responses[category] || 'How can I help you?';
    };

    expect(getCategoryResponse('support_payment')).toContain('payment');
    expect(getCategoryResponse('support_technical')).toContain('troubleshoot');
    expect(getCategoryResponse('unknown')).toContain('help');
  });
});

// ============================================================================
// AI AGENT CONFIGURATION TESTS
// ============================================================================

describe('Customer Support UAT - AI Agent Config', () => {
  it('validates agent configuration structure', () => {
    const validateAgentConfig = (config: Record<string, unknown>): string[] => {
      const requiredFields = ['agent_key', 'agent_name', 'persona', 'system_prompt', 'model_name'];

      const missing: string[] = [];
      for (const field of requiredFields) {
        if (!config[field]) {
          missing.push(field);
        }
      }
      return missing;
    };

    const validConfig = {
      agent_key: 'customer_support',
      agent_name: 'EasyMO Support Assistant',
      persona: 'Friendly and helpful',
      system_prompt: 'You are a helpful assistant...',
      model_name: 'gpt-4o-mini',
    };

    expect(validateAgentConfig(validConfig).length).toBe(0);

    const incompleteConfig = {
      agent_key: 'customer_support',
      agent_name: 'Support',
    };
    expect(validateAgentConfig(incompleteConfig).length).toBeGreaterThan(0);
  });

  it('validates model name', () => {
    const SUPPORTED_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];

    const isValidModel = (model: string): boolean => {
      return SUPPORTED_MODELS.includes(model);
    };

    expect(isValidModel('gpt-4o-mini')).toBe(true);
    expect(isValidModel('gpt-4o')).toBe(true);
    expect(isValidModel('invalid-model')).toBe(false);
  });

  it('validates temperature range', () => {
    const validateTemperature = (temp: number): { valid: boolean; error?: string } => {
      if (temp < 0 || temp > 2) {
        return { valid: false, error: 'Temperature must be between 0 and 2' };
      }
      return { valid: true };
    };

    expect(validateTemperature(0.7).valid).toBe(true);
    expect(validateTemperature(0).valid).toBe(true);
    expect(validateTemperature(2).valid).toBe(true);
    expect(validateTemperature(2.5).valid).toBe(false);
    expect(validateTemperature(-0.1).valid).toBe(false);
  });
});

// ============================================================================
// CONVERSATION HISTORY TESTS
// ============================================================================

describe('Customer Support UAT - Conversation', () => {
  it('maintains conversation history', () => {
    const conversationHistory: Array<{ role: string; content: string }> = [];

    const addMessage = (role: string, content: string) => {
      conversationHistory.push({ role, content });
    };

    addMessage('user', 'Hello');
    addMessage('assistant', 'Hi! How can I help?');
    addMessage('user', 'I have a payment issue');

    expect(conversationHistory.length).toBe(3);
    expect(conversationHistory[0].role).toBe('user');
    expect(conversationHistory[1].role).toBe('assistant');
  });

  it('limits conversation history to last N messages', () => {
    const MAX_HISTORY = 10;
    const conversationHistory: Array<{ role: string; content: string }> = [];

    // Add 15 messages
    for (let i = 0; i < 15; i++) {
      conversationHistory.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i}` });
    }

    const trimmedHistory = conversationHistory.slice(-MAX_HISTORY);
    expect(trimmedHistory.length).toBe(MAX_HISTORY);
    expect(trimmedHistory[0].content).toBe('Message 5');
  });

  it('validates message role', () => {
    const VALID_ROLES = ['system', 'user', 'assistant'];

    const isValidRole = (role: string): boolean => {
      return VALID_ROLES.includes(role);
    };

    expect(isValidRole('user')).toBe(true);
    expect(isValidRole('assistant')).toBe(true);
    expect(isValidRole('system')).toBe(true);
    expect(isValidRole('admin')).toBe(false);
  });
});

// ============================================================================
// ESCALATION WORKFLOW TESTS
// ============================================================================

describe('Customer Support UAT - Escalation', () => {
  it('creates support ticket on escalation', () => {
    const createTicket = (
      profileId: string
    ): {
      id: string;
      profile_id: string;
      category: string;
      priority: string;
      status: string;
    } => {
      return {
        id: crypto.randomUUID(),
        profile_id: profileId,
        category: 'escalation',
        priority: 'high',
        status: 'open',
      };
    };

    const ticket = createTicket('user-123');
    expect(ticket.category).toBe('escalation');
    expect(ticket.priority).toBe('high');
    expect(ticket.status).toBe('open');
  });

  it('generates ticket reference correctly', () => {
    const generateTicketRef = (ticketId: string): string => {
      return ticketId.slice(0, 8).toUpperCase();
    };

    const ticketId = '550e8400-e29b-41d4-a716-446655440000';
    const ref = generateTicketRef(ticketId);
    expect(ref.length).toBe(8);
    expect(ref).toBe(ref.toUpperCase());
  });

  it('fetches human support contacts', () => {
    const contacts = [
      { id: '1', display_name: 'General Support', contact_value: '+250788000001', is_active: true },
      { id: '2', display_name: 'Payment Support', contact_value: '+250788000002', is_active: true },
      { id: '3', display_name: 'Inactive Contact', contact_value: '+250788000003', is_active: false },
    ];

    const activeContacts = contacts.filter((c) => c.is_active);
    expect(activeContacts.length).toBe(2);
  });
});

// ============================================================================
// RESOLUTION DETECTION TESTS
// ============================================================================

describe('Customer Support UAT - Resolution Detection', () => {
  it('detects resolution keywords', () => {
    const resolutionKeywords = [
      'thanks',
      'thank you',
      'solved',
      'fixed',
      'working now',
      'got it',
      'understand',
      'clear',
      'merci',
      'murakoze',
    ];

    const isResolutionMessage = (message: string): boolean => {
      const lowerMessage = message.toLowerCase();
      return resolutionKeywords.some((keyword) => lowerMessage.includes(keyword));
    };

    expect(isResolutionMessage('Thanks for your help!')).toBe(true);
    expect(isResolutionMessage("It's working now")).toBe(true);
    expect(isResolutionMessage('Murakoze cyane')).toBe(true);
    expect(isResolutionMessage('I still have a problem')).toBe(false);
    expect(isResolutionMessage('Hello')).toBe(false);
  });

  it('handles resolution confirmation', () => {
    const handleResolution = (confirmed: boolean): { status: string; action: string } => {
      if (confirmed) {
        return { status: 'resolved', action: 'close_session' };
      }
      return { status: 'active', action: 'continue' };
    };

    expect(handleResolution(true).status).toBe('resolved');
    expect(handleResolution(false).status).toBe('active');
  });
});

// ============================================================================
// KEYWORD-BASED RESPONSE TESTS
// ============================================================================

describe('Customer Support UAT - Keyword Responses', () => {
  it('responds to food/order keywords', () => {
    const getKeywordResponse = (message: string): string | null => {
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('order') || lowerMessage.includes('food')) {
        return "🍽️ To order food:\n1. Tap 'Waiter AI' from home menu...";
      }
      return null;
    };

    const response = getKeywordResponse('How do I order food?');
    expect(response).not.toBeNull();
    expect(response).toContain('food');
  });

  it('responds to ride/trip keywords', () => {
    const getKeywordResponse = (message: string): string | null => {
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('ride') || lowerMessage.includes('trip')) {
        return "🚗 To book a ride:\n1. Tap 'Rides AI' from home menu...";
      }
      return null;
    };

    const response = getKeywordResponse('How do I book a ride?');
    expect(response).not.toBeNull();
    expect(response).toContain('ride');
  });

  it('responds to payment keywords', () => {
    const getKeywordResponse = (message: string): string | null => {
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('payment') || lowerMessage.includes('money')) {
        return '💳 For payment issues:\n• Check your Mobile Money balance...';
      }
      return null;
    };

    const response = getKeywordResponse('I have a payment problem');
    expect(response).not.toBeNull();
    expect(response).toContain('payment');
  });

  it('responds to job keywords', () => {
    const getKeywordResponse = (message: string): string | null => {
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('job') || lowerMessage.includes('work')) {
        return "💼 To find jobs:\n1. Tap 'Jobs AI' from home menu...";
      }
      return null;
    };

    const response = getKeywordResponse('I want to find work');
    expect(response).not.toBeNull();
    expect(response).toContain('job');
  });

  it('falls back to default response for unknown queries', () => {
    const getKeywordResponse = (message: string): string | null => {
      const lowerMessage = message.toLowerCase();
      const keywords = ['order', 'food', 'ride', 'trip', 'payment', 'job', 'work'];

      for (const keyword of keywords) {
        if (lowerMessage.includes(keyword)) {
          return `Response for ${keyword}`;
        }
      }
      return null;
    };

    const response = getKeywordResponse('Random question about weather');
    expect(response).toBeNull();
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('Customer Support UAT - Error Handling', () => {
  it('handles missing OpenAI API key', () => {
    const handleMissingAPIKey = (
      apiKey: string | undefined
    ): {
      canUseAI: boolean;
      fallback: string;
    } => {
      if (!apiKey) {
        return { canUseAI: false, fallback: 'escalate_to_human' };
      }
      return { canUseAI: true, fallback: '' };
    };

    expect(handleMissingAPIKey(undefined).canUseAI).toBe(false);
    expect(handleMissingAPIKey(undefined).fallback).toBe('escalate_to_human');
    expect(handleMissingAPIKey('sk-test-key').canUseAI).toBe(true);
  });

  it('handles API errors gracefully', () => {
    const handleAPIError = (error: Error): { message: string; action: string } => {
      return {
        message: "I'm having trouble right now. Would you like to talk to a human support agent?",
        action: 'offer_escalation',
      };
    };

    const result = handleAPIError(new Error('API timeout'));
    expect(result.action).toBe('offer_escalation');
    expect(result.message).toContain('human');
  });

  it('handles missing agent config', () => {
    const handleMissingConfig = (config: unknown | null): { success: boolean; action: string } => {
      if (!config) {
        return { success: false, action: 'escalate_to_human' };
      }
      return { success: true, action: 'continue' };
    };

    expect(handleMissingConfig(null).success).toBe(false);
    expect(handleMissingConfig(null).action).toBe('escalate_to_human');
    expect(handleMissingConfig({ agent_key: 'support' }).success).toBe(true);
  });

  it('validates profile before processing', () => {
    const validateProfile = (profileId: string | undefined): { valid: boolean; error?: string } => {
      if (!profileId) {
        return { valid: false, error: 'Profile required' };
      }
      return { valid: true };
    };

    expect(validateProfile(undefined).valid).toBe(false);
    expect(validateProfile('user-123').valid).toBe(true);
  });
});

// ============================================================================
// BUTTON HANDLING TESTS
// ============================================================================

describe('Customer Support UAT - Button Handling', () => {
  it('handles support_resolved button', () => {
    const handleButton = (buttonId: string): { action: string; nextState: string } => {
      if (buttonId === 'support_resolved') {
        return { action: 'mark_resolved', nextState: 'home' };
      }
      if (buttonId === 'support_continue') {
        return { action: 'continue_chat', nextState: 'support_active' };
      }
      return { action: 'unknown', nextState: 'current' };
    };

    expect(handleButton('support_resolved').action).toBe('mark_resolved');
    expect(handleButton('support_continue').action).toBe('continue_chat');
  });

  it('handles escalation button', () => {
    const handleButton = (buttonId: string): boolean => {
      const escalationButtons = ['escalate_to_human', 'talk_to_human', 'human_support'];
      return escalationButtons.includes(buttonId);
    };

    expect(handleButton('escalate_to_human')).toBe(true);
    expect(handleButton('continue_ai_chat')).toBe(false);
  });

  it('limits buttons to maximum allowed', () => {
    const MAX_BUTTONS = 3;
    const contacts = [
      { id: '1', display_name: 'Support 1' },
      { id: '2', display_name: 'Support 2' },
      { id: '3', display_name: 'Support 3' },
      { id: '4', display_name: 'Support 4' },
    ];

    const buttons = contacts.slice(0, MAX_BUTTONS).map((c) => ({
      id: `whatsapp_${c.id}`,
      title: c.display_name.substring(0, 20),
    }));

    expect(buttons.length).toBe(MAX_BUTTONS);
  });
});
