# @easymo/state-machine

Type-safe state machine implementation for managing conversation flows with explicit states, transitions, and guards.

## Features

- **Type-safe**: Full TypeScript support with generic context and events
- **Transition Guards**: Validate transitions before execution
- **Entry/Exit Actions**: Execute logic when entering or leaving states
- **Hierarchical States**: Support for parent-child state relationships
- **History Tracking**: Built-in tracking of state transitions
- **Validation**: Ensures all transition targets are defined

## Usage

### Basic State Machine

```typescript
import { createStateMachine, StateMachineConfig } from "@easymo/state-machine";

interface MyContext {
  count: number;
}

enum MyEvent {
  INCREMENT = "INCREMENT",
  RESET = "RESET",
}

const config: StateMachineConfig<MyContext, MyEvent> = {
  id: "counter",
  initialState: "idle",
  
  createContext: () => ({ count: 0 }),
  
  states: [
    {
      name: "idle",
      transitions: {
        [MyEvent.INCREMENT]: {
          target: "counting",
          action: async (context) => {
            context.count++;
          },
        },
      },
    },
    {
      name: "counting",
      transitions: {
        [MyEvent.INCREMENT]: {
          target: "counting",
          guard: async (context) => context.count < 10,
          action: async (context) => {
            context.count++;
          },
        },
        [MyEvent.RESET]: {
          target: "idle",
          action: async (context) => {
            context.count = 0;
          },
        },
      },
    },
  ],
};

const machine = createStateMachine(config);
```

### Conversation State Machine

Pre-built conversation state machine with common patterns:

```typescript
import { createConversationStateMachine, ConversationEvent } from "@easymo/state-machine";

const conversationMachine = createConversationStateMachine();

// Start a conversation
let context = conversationMachine.createContext();
context.userId = "user123";

// Transition through states
const result1 = await conversationMachine.transition(
  conversationMachine.getInitialState(),
  ConversationEvent.START,
  context
);

// Check available transitions
const available = conversationMachine.getAvailableTransitions(result1.state);
console.log("Available transitions:", available);

// Execute next transition
const result2 = await conversationMachine.transition(
  result1.state,
  ConversationEvent.MESSAGE_RECEIVED,
  result1.context
);
```

## State Machine Registry API

### `createStateMachine(config)`

Creates a new state machine from configuration.

### `getInitialState(): string`

Returns the initial state name.

### `transition(from, event, context): Promise<{ state, context }>`

Executes a state transition with guards and actions.

### `canTransition(from, event, context): boolean`

Checks if a transition is allowed without executing it.

### `getAvailableTransitions(state): string[]`

Returns all possible transitions from the given state.

### `isFinalState(state): boolean`

Checks if a state is marked as final.

### `createContext(): TContext`

Creates initial context using the factory function.

## Transition Guards

Guards are functions that determine if a transition should be allowed:

```typescript
{
  name: "processing",
  transitions: {
    "COMPLETE": {
      target: "done",
      guard: async (context, event) => {
        // Only allow if conditions are met
        return context.itemsProcessed > 0;
      },
    },
  },
}
```

## Entry/Exit Actions

Execute logic when entering or leaving states:

```typescript
{
  name: "active",
  onEntry: async (context) => {
    console.log("Entered active state");
    context.startTime = Date.now();
  },
  onExit: async (context) => {
    console.log("Exited active state");
    context.duration = Date.now() - context.startTime;
  },
  transitions: { /* ... */ },
}
```

## Conversation States

Pre-defined conversation states:
- `idle`: No active conversation
- `awaiting_input`: Waiting for user input
- `processing_intent`: Analyzing user intent
- `agent_active`: Agent is processing
- `awaiting_confirmation`: Waiting for user confirmation
- `fallback`: Fallback mode (with retry limits)
- `completed`: Conversation completed
- `error`: Error state

## Conversation Events

Pre-defined conversation events:
- `START`: Begin conversation
- `MESSAGE_RECEIVED`: User sent a message
- `INTENT_RECOGNIZED`: Intent was identified
- `AGENT_COMPLETED`: Agent finished processing
- `AGENT_FAILED`: Agent encountered an error
- `USER_CANCELLED`: User cancelled
- `TIMEOUT`: Session timeout
- `FALLBACK`: Trigger fallback
- `RESET`: Reset conversation

## Error Handling

The state machine throws typed errors:

```typescript
try {
  await machine.transition(currentState, event, context);
} catch (error) {
  if (error instanceof InvalidTransitionError) {
    console.error(`Cannot transition from ${error.from} on ${error.event}`);
  } else if (error instanceof StateNotFoundError) {
    console.error(`State ${error.state} not found`);
  }
}
```

## Best Practices

1. **Define all states upfront**: Ensure all transition targets exist
2. **Use guards for validation**: Don't allow invalid transitions
3. **Keep context minimal**: Only store essential data
4. **Track history**: Use the built-in history tracking
5. **Handle errors**: Always catch and handle transition errors
6. **Test transitions**: Write tests for all state paths
