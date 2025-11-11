import { createStateMachine, StateMachineConfig } from "./registry.js";

/**
 * Conversation context
 */
export interface ConversationContext {
  userId: string;
  locale?: string;
  lastIntent?: string;
  fallbackCount: number;
  metadata: Record<string, any>;
  history: Array<{
    state: string;
    timestamp: string;
    event?: string;
  }>;
}

/**
 * Conversation events
 */
export enum ConversationEvent {
  START = "START",
  MESSAGE_RECEIVED = "MESSAGE_RECEIVED",
  INTENT_RECOGNIZED = "INTENT_RECOGNIZED",
  AGENT_SELECTED = "AGENT_SELECTED",
  AGENT_PROCESSING = "AGENT_PROCESSING",
  AGENT_COMPLETED = "AGENT_COMPLETED",
  AGENT_FAILED = "AGENT_FAILED",
  USER_CANCELLED = "USER_CANCELLED",
  TIMEOUT = "TIMEOUT",
  FALLBACK = "FALLBACK",
  RESET = "RESET",
}

/**
 * Conversation states
 */
export enum ConversationState {
  IDLE = "idle",
  AWAITING_INPUT = "awaiting_input",
  PROCESSING_INTENT = "processing_intent",
  AGENT_ACTIVE = "agent_active",
  AWAITING_CONFIRMATION = "awaiting_confirmation",
  FALLBACK = "fallback",
  COMPLETED = "completed",
  ERROR = "error",
}

/**
 * Create conversation state machine configuration
 */
export function createConversationStateMachine() {
  const config: StateMachineConfig<ConversationContext, ConversationEvent> = {
    id: "conversation",
    initialState: ConversationState.IDLE,
    
    createContext: () => ({
      userId: "",
      fallbackCount: 0,
      metadata: {},
      history: [],
    }),
    
    states: [
      {
        name: ConversationState.IDLE,
        transitions: {
          [ConversationEvent.START]: {
            target: ConversationState.AWAITING_INPUT,
            action: async (context) => {
              context.history.push({
                state: ConversationState.AWAITING_INPUT,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.START,
              });
            },
          },
        },
      },
      
      {
        name: ConversationState.AWAITING_INPUT,
        transitions: {
          [ConversationEvent.MESSAGE_RECEIVED]: {
            target: ConversationState.PROCESSING_INTENT,
            action: async (context) => {
              context.history.push({
                state: ConversationState.PROCESSING_INTENT,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.MESSAGE_RECEIVED,
              });
            },
          },
          [ConversationEvent.TIMEOUT]: {
            target: ConversationState.IDLE,
            action: async (context) => {
              context.history.push({
                state: ConversationState.IDLE,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.TIMEOUT,
              });
            },
          },
        },
      },
      
      {
        name: ConversationState.PROCESSING_INTENT,
        transitions: {
          [ConversationEvent.INTENT_RECOGNIZED]: {
            target: ConversationState.AGENT_ACTIVE,
            guard: async (context) => {
              // Only proceed if we have a valid intent
              return !!context.lastIntent;
            },
            action: async (context) => {
              context.history.push({
                state: ConversationState.AGENT_ACTIVE,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.INTENT_RECOGNIZED,
              });
            },
          },
          [ConversationEvent.FALLBACK]: {
            target: ConversationState.FALLBACK,
            guard: async (context) => {
              // Allow fallback only if we haven't exceeded max attempts
              return context.fallbackCount < 3;
            },
            action: async (context) => {
              context.fallbackCount++;
              context.history.push({
                state: ConversationState.FALLBACK,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.FALLBACK,
              });
            },
          },
          [ConversationEvent.AGENT_FAILED]: {
            target: ConversationState.ERROR,
            action: async (context) => {
              context.history.push({
                state: ConversationState.ERROR,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.AGENT_FAILED,
              });
            },
          },
        },
      },
      
      {
        name: ConversationState.AGENT_ACTIVE,
        transitions: {
          [ConversationEvent.AGENT_COMPLETED]: {
            target: ConversationState.AWAITING_CONFIRMATION,
            action: async (context) => {
              context.history.push({
                state: ConversationState.AWAITING_CONFIRMATION,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.AGENT_COMPLETED,
              });
            },
          },
          [ConversationEvent.AGENT_FAILED]: {
            target: ConversationState.FALLBACK,
            guard: async (context) => {
              return context.fallbackCount < 3;
            },
            action: async (context) => {
              context.fallbackCount++;
              context.history.push({
                state: ConversationState.FALLBACK,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.AGENT_FAILED,
              });
            },
          },
          [ConversationEvent.USER_CANCELLED]: {
            target: ConversationState.IDLE,
            action: async (context) => {
              context.fallbackCount = 0;
              context.history.push({
                state: ConversationState.IDLE,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.USER_CANCELLED,
              });
            },
          },
        },
      },
      
      {
        name: ConversationState.AWAITING_CONFIRMATION,
        transitions: {
          [ConversationEvent.MESSAGE_RECEIVED]: {
            target: ConversationState.COMPLETED,
            action: async (context) => {
              context.fallbackCount = 0;
              context.history.push({
                state: ConversationState.COMPLETED,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.MESSAGE_RECEIVED,
              });
            },
          },
          [ConversationEvent.RESET]: {
            target: ConversationState.IDLE,
            action: async (context) => {
              context.fallbackCount = 0;
              context.lastIntent = undefined;
              context.history.push({
                state: ConversationState.IDLE,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.RESET,
              });
            },
          },
        },
      },
      
      {
        name: ConversationState.FALLBACK,
        transitions: {
          [ConversationEvent.MESSAGE_RECEIVED]: {
            target: ConversationState.PROCESSING_INTENT,
            action: async (context) => {
              context.history.push({
                state: ConversationState.PROCESSING_INTENT,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.MESSAGE_RECEIVED,
              });
            },
          },
          [ConversationEvent.RESET]: {
            target: ConversationState.IDLE,
            action: async (context) => {
              context.fallbackCount = 0;
              context.history.push({
                state: ConversationState.IDLE,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.RESET,
              });
            },
          },
        },
      },
      
      {
        name: ConversationState.COMPLETED,
        final: false,
        transitions: {
          [ConversationEvent.RESET]: {
            target: ConversationState.IDLE,
            action: async (context) => {
              context.fallbackCount = 0;
              context.lastIntent = undefined;
              context.metadata = {};
              context.history.push({
                state: ConversationState.IDLE,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.RESET,
              });
            },
          },
          [ConversationEvent.START]: {
            target: ConversationState.AWAITING_INPUT,
            action: async (context) => {
              context.fallbackCount = 0;
              context.history.push({
                state: ConversationState.AWAITING_INPUT,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.START,
              });
            },
          },
        },
      },
      
      {
        name: ConversationState.ERROR,
        final: false,
        transitions: {
          [ConversationEvent.RESET]: {
            target: ConversationState.IDLE,
            action: async (context) => {
              context.fallbackCount = 0;
              context.lastIntent = undefined;
              context.history.push({
                state: ConversationState.IDLE,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.RESET,
              });
            },
          },
          [ConversationEvent.FALLBACK]: {
            target: ConversationState.FALLBACK,
            guard: async (context) => {
              return context.fallbackCount < 3;
            },
            action: async (context) => {
              context.fallbackCount++;
              context.history.push({
                state: ConversationState.FALLBACK,
                timestamp: new Date().toISOString(),
                event: ConversationEvent.FALLBACK,
              });
            },
          },
        },
      },
    ],
  };

  return createStateMachine(config);
}
