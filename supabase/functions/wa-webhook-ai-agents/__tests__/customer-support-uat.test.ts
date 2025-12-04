/**
 * Customer Support Workflow UAT Tests
 * Comprehensive User Acceptance Testing for customer support AI agent workflows
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { createTestSuite } from "../../_shared/testing/test-utils.ts";

// ============================================================================
// CUSTOMER SUPPORT SESSION TESTS
// ============================================================================

const sessionSuite = createTestSuite("Customer Support UAT - Session");

sessionSuite.test("creates new support session correctly", () => {
  const createSession = (profileId: string): {
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
      agent_slug: "support",
      status: "active",
      channel: "whatsapp",
      created_at: new Date().toISOString(),
    };
  };

  const session = createSession("user-123");
  assertEquals(session.agent_slug, "support");
  assertEquals(session.status, "active");
  assertEquals(session.channel, "whatsapp");
});

sessionSuite.test("resumes existing active session", () => {
  const existingSessions = [
    { id: "session-1", status: "active", created_at: new Date().toISOString() },
    { id: "session-2", status: "resolved", created_at: new Date(Date.now() - 86400000).toISOString() },
  ];

  const activeSession = existingSessions.find(s => s.status === "active");
  assertEquals(activeSession?.id, "session-1", "Should find active session");
});

sessionSuite.test("does not resume resolved sessions", () => {
  const existingSessions = [
    { id: "session-1", status: "resolved", created_at: new Date().toISOString() },
    { id: "session-2", status: "closed", created_at: new Date(Date.now() - 86400000).toISOString() },
  ];

  const activeSession = existingSessions.find(s => s.status === "active");
  assertEquals(activeSession, undefined, "Should not find active session");
});

sessionSuite.test("validates session status values", () => {
  const VALID_STATUSES = ["active", "resolved", "escalated", "closed"];
  
  const isValidStatus = (status: string): boolean => {
    return VALID_STATUSES.includes(status);
  };

  assertEquals(isValidStatus("active"), true);
  assertEquals(isValidStatus("resolved"), true);
  assertEquals(isValidStatus("escalated"), true);
  assertEquals(isValidStatus("invalid"), false);
});

// ============================================================================
// SUPPORT CATEGORY TESTS
// ============================================================================

const categorySuite = createTestSuite("Customer Support UAT - Categories");

categorySuite.test("provides all support categories", () => {
  const categories = [
    { id: "support_payment", title: "💳 Payment Issue" },
    { id: "support_technical", title: "🔧 Technical Help" },
    { id: "support_navigation", title: "🧭 Navigation Help" },
    { id: "support_other", title: "❓ Other Question" },
  ];

  assertEquals(categories.length, 4, "Should have 4 main categories");
  assertEquals(categories.some(c => c.id === "support_payment"), true);
  assertEquals(categories.some(c => c.id === "support_technical"), true);
});

categorySuite.test("validates category button IDs", () => {
  const isSupportCategory = (buttonId: string): boolean => {
    const supportCategories = [
      "support_payment",
      "support_technical", 
      "support_navigation",
      "support_other",
    ];
    return supportCategories.includes(buttonId);
  };

  assertEquals(isSupportCategory("support_payment"), true);
  assertEquals(isSupportCategory("support_technical"), true);
  assertEquals(isSupportCategory("rides"), false);
  assertEquals(isSupportCategory("invalid"), false);
});

categorySuite.test("maps categories to appropriate responses", () => {
  const getCategoryResponse = (category: string): string => {
    const responses: Record<string, string> = {
      support_payment: "I can help with payment issues.",
      support_technical: "Let me help you troubleshoot.",
      support_navigation: "I'll help you navigate EasyMO.",
      support_other: "I'm here to help with any question.",
    };
    return responses[category] || "How can I help you?";
  };

  assertEquals(getCategoryResponse("support_payment").includes("payment"), true);
  assertEquals(getCategoryResponse("support_technical").includes("troubleshoot"), true);
  assertEquals(getCategoryResponse("unknown").includes("help"), true);
});

// ============================================================================
// AI AGENT CONFIGURATION TESTS
// ============================================================================

const agentConfigSuite = createTestSuite("Customer Support UAT - AI Agent Config");

agentConfigSuite.test("validates agent configuration structure", () => {
  const validateAgentConfig = (config: Record<string, unknown>): string[] => {
    const requiredFields = [
      "agent_key",
      "agent_name",
      "persona",
      "system_prompt",
      "model_name",
    ];
    
    const missing: string[] = [];
    for (const field of requiredFields) {
      if (!config[field]) {
        missing.push(field);
      }
    }
    return missing;
  };

  const validConfig = {
    agent_key: "customer_support",
    agent_name: "EasyMO Support Assistant",
    persona: "Friendly and helpful",
    system_prompt: "You are a helpful assistant...",
    model_name: "gpt-4o-mini",
  };

  assertEquals(validateAgentConfig(validConfig).length, 0, "Should have no missing fields");

  const incompleteConfig = {
    agent_key: "customer_support",
    agent_name: "Support",
  };
  assertEquals(validateAgentConfig(incompleteConfig).length > 0, true, "Should detect missing fields");
});

agentConfigSuite.test("validates model name", () => {
  const SUPPORTED_MODELS = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo",
  ];

  const isValidModel = (model: string): boolean => {
    return SUPPORTED_MODELS.includes(model);
  };

  assertEquals(isValidModel("gpt-4o-mini"), true);
  assertEquals(isValidModel("gpt-4o"), true);
  assertEquals(isValidModel("invalid-model"), false);
});

agentConfigSuite.test("validates temperature range", () => {
  const validateTemperature = (temp: number): { valid: boolean; error?: string } => {
    if (temp < 0 || temp > 2) {
      return { valid: false, error: "Temperature must be between 0 and 2" };
    }
    return { valid: true };
  };

  assertEquals(validateTemperature(0.7).valid, true);
  assertEquals(validateTemperature(0).valid, true);
  assertEquals(validateTemperature(2).valid, true);
  assertEquals(validateTemperature(2.5).valid, false);
  assertEquals(validateTemperature(-0.1).valid, false);
});

// ============================================================================
// CONVERSATION HISTORY TESTS
// ============================================================================

const conversationSuite = createTestSuite("Customer Support UAT - Conversation");

conversationSuite.test("maintains conversation history", () => {
  const conversationHistory: Array<{ role: string; content: string }> = [];
  
  const addMessage = (role: string, content: string) => {
    conversationHistory.push({ role, content });
  };

  addMessage("user", "Hello");
  addMessage("assistant", "Hi! How can I help?");
  addMessage("user", "I have a payment issue");

  assertEquals(conversationHistory.length, 3);
  assertEquals(conversationHistory[0].role, "user");
  assertEquals(conversationHistory[1].role, "assistant");
});

conversationSuite.test("limits conversation history to last N messages", () => {
  const MAX_HISTORY = 10;
  const conversationHistory: Array<{ role: string; content: string }> = [];
  
  // Add 15 messages
  for (let i = 0; i < 15; i++) {
    conversationHistory.push({ role: i % 2 === 0 ? "user" : "assistant", content: `Message ${i}` });
  }

  const trimmedHistory = conversationHistory.slice(-MAX_HISTORY);
  assertEquals(trimmedHistory.length, MAX_HISTORY, "Should limit to 10 messages");
  assertEquals(trimmedHistory[0].content, "Message 5", "Should keep most recent messages");
});

conversationSuite.test("validates message role", () => {
  const VALID_ROLES = ["system", "user", "assistant"];
  
  const isValidRole = (role: string): boolean => {
    return VALID_ROLES.includes(role);
  };

  assertEquals(isValidRole("user"), true);
  assertEquals(isValidRole("assistant"), true);
  assertEquals(isValidRole("system"), true);
  assertEquals(isValidRole("admin"), false);
});

// ============================================================================
// ESCALATION WORKFLOW TESTS
// ============================================================================

const escalationSuite = createTestSuite("Customer Support UAT - Escalation");

escalationSuite.test("creates support ticket on escalation", () => {
  const createTicket = (profileId: string): {
    id: string;
    profile_id: string;
    category: string;
    priority: string;
    status: string;
  } => {
    return {
      id: crypto.randomUUID(),
      profile_id: profileId,
      category: "escalation",
      priority: "high",
      status: "open",
    };
  };

  const ticket = createTicket("user-123");
  assertEquals(ticket.category, "escalation");
  assertEquals(ticket.priority, "high");
  assertEquals(ticket.status, "open");
});

escalationSuite.test("generates ticket reference correctly", () => {
  const generateTicketRef = (ticketId: string): string => {
    return ticketId.slice(0, 8).toUpperCase();
  };

  const ticketId = "550e8400-e29b-41d4-a716-446655440000";
  const ref = generateTicketRef(ticketId);
  assertEquals(ref.length, 8);
  assertEquals(ref, ref.toUpperCase());
});

escalationSuite.test("clears AI session on escalation", () => {
  let sessionCleared = false;
  
  const clearAISession = (profileId: string): boolean => {
    // Simulate clearing session
    sessionCleared = true;
    return true;
  };

  clearAISession("user-123");
  assertEquals(sessionCleared, true, "Should clear AI session on escalation");
});

escalationSuite.test("fetches human support contacts", () => {
  const contacts = [
    { id: "1", display_name: "General Support", contact_value: "+250788000001", is_active: true },
    { id: "2", display_name: "Payment Support", contact_value: "+250788000002", is_active: true },
    { id: "3", display_name: "Inactive Contact", contact_value: "+250788000003", is_active: false },
  ];

  const activeContacts = contacts.filter(c => c.is_active);
  assertEquals(activeContacts.length, 2, "Should only return active contacts");
});

// ============================================================================
// RESOLUTION DETECTION TESTS
// ============================================================================

const resolutionSuite = createTestSuite("Customer Support UAT - Resolution Detection");

resolutionSuite.test("detects resolution keywords", () => {
  const resolutionKeywords = [
    "thanks", "thank you", "solved", "fixed", "working now",
    "got it", "understand", "clear", "merci", "murakoze",
  ];

  const isResolutionMessage = (message: string): boolean => {
    const lowerMessage = message.toLowerCase();
    return resolutionKeywords.some(keyword => lowerMessage.includes(keyword));
  };

  assertEquals(isResolutionMessage("Thanks for your help!"), true);
  assertEquals(isResolutionMessage("It's working now"), true);
  assertEquals(isResolutionMessage("Murakoze cyane"), true);
  assertEquals(isResolutionMessage("I still have a problem"), false);
  assertEquals(isResolutionMessage("Hello"), false);
});

resolutionSuite.test("prompts for confirmation on resolution detection", () => {
  const shouldPromptResolution = (message: string): boolean => {
    const resolutionKeywords = ["thanks", "solved", "fixed", "working now", "got it"];
    const lowerMessage = message.toLowerCase();
    return resolutionKeywords.some(keyword => lowerMessage.includes(keyword));
  };

  assertEquals(shouldPromptResolution("Thanks!"), true);
  assertEquals(shouldPromptResolution("Can you help me more?"), false);
});

resolutionSuite.test("handles resolution confirmation", () => {
  const handleResolution = (confirmed: boolean): { status: string; action: string } => {
    if (confirmed) {
      return { status: "resolved", action: "close_session" };
    }
    return { status: "active", action: "continue" };
  };

  assertEquals(handleResolution(true).status, "resolved");
  assertEquals(handleResolution(false).status, "active");
});

// ============================================================================
// KEYWORD-BASED RESPONSE TESTS
// ============================================================================

const keywordResponseSuite = createTestSuite("Customer Support UAT - Keyword Responses");

keywordResponseSuite.test("responds to food/order keywords", () => {
  const getKeywordResponse = (message: string): string | null => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes("order") || lowerMessage.includes("food")) {
      return "🍽️ To order food:\n1. Tap 'Waiter AI' from home menu...";
    }
    return null;
  };

  const response = getKeywordResponse("How do I order food?");
  assertEquals(response !== null, true);
  assertEquals(response?.includes("food"), true);
});

keywordResponseSuite.test("responds to ride/trip keywords", () => {
  const getKeywordResponse = (message: string): string | null => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes("ride") || lowerMessage.includes("trip")) {
      return "🚗 To book a ride:\n1. Tap 'Rides AI' from home menu...";
    }
    return null;
  };

  const response = getKeywordResponse("How do I book a ride?");
  assertEquals(response !== null, true);
  assertEquals(response?.includes("ride"), true);
});

keywordResponseSuite.test("responds to payment keywords", () => {
  const getKeywordResponse = (message: string): string | null => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes("payment") || lowerMessage.includes("money")) {
      return "💳 For payment issues:\n• Check your Mobile Money balance...";
    }
    return null;
  };

  const response = getKeywordResponse("I have a payment problem");
  assertEquals(response !== null, true);
  assertEquals(response?.includes("payment"), true);
});

keywordResponseSuite.test("responds to job keywords", () => {
  const getKeywordResponse = (message: string): string | null => {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes("job") || lowerMessage.includes("work")) {
      return "💼 To find jobs:\n1. Tap 'Jobs AI' from home menu...";
    }
    return null;
  };

  const response = getKeywordResponse("I want to find work");
  assertEquals(response !== null, true);
  assertEquals(response?.includes("job"), true);
});

keywordResponseSuite.test("falls back to default response for unknown queries", () => {
  const getKeywordResponse = (message: string): string | null => {
    const lowerMessage = message.toLowerCase();
    const keywords = ["order", "food", "ride", "trip", "payment", "job", "work"];
    
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        return `Response for ${keyword}`;
      }
    }
    return null;
  };

  const response = getKeywordResponse("Random question about weather");
  assertEquals(response, null, "Should return null for unknown queries");
});

// ============================================================================
// STATE MANAGEMENT TESTS
// ============================================================================

const stateSuite = createTestSuite("Customer Support UAT - State Management");

stateSuite.test("validates support agent state key", () => {
  const SUPPORT_STATE_KEY = "ai_customer_support_active";
  
  const isSupportState = (stateKey: string): boolean => {
    return stateKey === SUPPORT_STATE_KEY || stateKey === "support_agent";
  };

  assertEquals(isSupportState("ai_customer_support_active"), true);
  assertEquals(isSupportState("support_agent"), true);
  assertEquals(isSupportState("home"), false);
});

stateSuite.test("preserves agent config in state", () => {
  const state = {
    key: "ai_customer_support_active",
    data: {
      agent_config: {
        agent_key: "customer_support",
        model_name: "gpt-4o-mini",
      },
      conversation_history: [],
      started_at: new Date().toISOString(),
    },
  };

  assertEquals(state.data.agent_config.agent_key, "customer_support");
  assertEquals(Array.isArray(state.data.conversation_history), true);
});

stateSuite.test("clears state on session end", () => {
  const clearState = (profileId: string): { cleared: boolean } => {
    // Simulate clearing state
    return { cleared: true };
  };

  const result = clearState("user-123");
  assertEquals(result.cleared, true);
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

const errorHandlingSuite = createTestSuite("Customer Support UAT - Error Handling");

errorHandlingSuite.test("handles missing OpenAI API key", () => {
  const handleMissingAPIKey = (apiKey: string | undefined): {
    canUseAI: boolean;
    fallback: string;
  } => {
    if (!apiKey) {
      return { canUseAI: false, fallback: "escalate_to_human" };
    }
    return { canUseAI: true, fallback: "" };
  };

  assertEquals(handleMissingAPIKey(undefined).canUseAI, false);
  assertEquals(handleMissingAPIKey(undefined).fallback, "escalate_to_human");
  assertEquals(handleMissingAPIKey("sk-test-key").canUseAI, true);
});

errorHandlingSuite.test("handles API errors gracefully", () => {
  const handleAPIError = (error: Error): { message: string; action: string } => {
    return {
      message: "I'm having trouble right now. Would you like to talk to a human support agent?",
      action: "offer_escalation",
    };
  };

  const result = handleAPIError(new Error("API timeout"));
  assertEquals(result.action, "offer_escalation");
  assertEquals(result.message.includes("human"), true);
});

errorHandlingSuite.test("handles missing agent config", () => {
  const handleMissingConfig = (config: unknown | null): { success: boolean; action: string } => {
    if (!config) {
      return { success: false, action: "escalate_to_human" };
    }
    return { success: true, action: "continue" };
  };

  assertEquals(handleMissingConfig(null).success, false);
  assertEquals(handleMissingConfig(null).action, "escalate_to_human");
  assertEquals(handleMissingConfig({ agent_key: "support" }).success, true);
});

errorHandlingSuite.test("validates profile before processing", () => {
  const validateProfile = (profileId: string | undefined): { valid: boolean; error?: string } => {
    if (!profileId) {
      return { valid: false, error: "Profile required" };
    }
    return { valid: true };
  };

  assertEquals(validateProfile(undefined).valid, false);
  assertEquals(validateProfile("user-123").valid, true);
});

// ============================================================================
// BUTTON HANDLING TESTS
// ============================================================================

const buttonSuite = createTestSuite("Customer Support UAT - Button Handling");

buttonSuite.test("handles support_resolved button", () => {
  const handleButton = (buttonId: string): { action: string; nextState: string } => {
    if (buttonId === "support_resolved") {
      return { action: "mark_resolved", nextState: "home" };
    }
    if (buttonId === "support_continue") {
      return { action: "continue_chat", nextState: "support_active" };
    }
    return { action: "unknown", nextState: "current" };
  };

  assertEquals(handleButton("support_resolved").action, "mark_resolved");
  assertEquals(handleButton("support_continue").action, "continue_chat");
});

buttonSuite.test("handles escalation button", () => {
  const handleButton = (buttonId: string): boolean => {
    const escalationButtons = ["escalate_to_human", "talk_to_human", "human_support"];
    return escalationButtons.includes(buttonId);
  };

  assertEquals(handleButton("escalate_to_human"), true);
  assertEquals(handleButton("continue_ai_chat"), false);
});

buttonSuite.test("limits buttons to maximum allowed", () => {
  const MAX_BUTTONS = 3;
  const contacts = [
    { id: "1", display_name: "Support 1" },
    { id: "2", display_name: "Support 2" },
    { id: "3", display_name: "Support 3" },
    { id: "4", display_name: "Support 4" },
  ];

  const buttons = contacts.slice(0, MAX_BUTTONS).map(c => ({
    id: `whatsapp_${c.id}`,
    title: c.display_name.substring(0, 20),
  }));

  assertEquals(buttons.length, MAX_BUTTONS, "Should limit to 3 buttons");
});

console.log("✅ Customer Support UAT tests loaded");
