/**
 * State Machine Registry for Conversation Management
 * 
 * Provides a type-safe, explicit state machine with:
 * - Defined states and transitions
 * - Transition guards for validation
 * - Entry/exit actions
 * - Hierarchical states
 */

export interface StateConfig<TContext = any, TEvent = string> {
  /** State identifier */
  name: string;
  
  /** Parent state for hierarchical state machines */
  parent?: string;
  
  /** Allowed transitions from this state */
  transitions: {
    [event: string]: {
      /** Target state */
      target: string;
      
      /** Guard function - return true to allow transition */
      guard?: (context: TContext, event: TEvent) => boolean | Promise<boolean>;
      
      /** Action to execute during transition */
      action?: (context: TContext, event: TEvent) => void | Promise<void>;
    };
  };
  
  /** Action to execute when entering this state */
  onEntry?: (context: TContext) => void | Promise<void>;
  
  /** Action to execute when exiting this state */
  onExit?: (context: TContext) => void | Promise<void>;
  
  /** Whether this is a final state */
  final?: boolean;
}

export interface StateMachineConfig<TContext = any, TEvent = string> {
  /** Unique identifier for this state machine */
  id: string;
  
  /** Initial state */
  initialState: string;
  
  /** State definitions */
  states: StateConfig<TContext, TEvent>[];
  
  /** Context factory */
  createContext?: () => TContext;
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly event: string,
    public readonly to?: string,
    public readonly reason?: string
  ) {
    super(`Invalid transition from "${from}" on event "${event}"${reason ? `: ${reason}` : ""}`);
    this.name = "InvalidTransitionError";
  }
}

export class StateNotFoundError extends Error {
  constructor(public readonly state: string) {
    super(`State "${state}" not found in state machine`);
    this.name = "StateNotFoundError";
  }
}

/**
 * State Machine Registry
 * Manages state machine definitions and enforces transition rules
 */
export class StateMachineRegistry<TContext = any, TEvent = string> {
  private config: StateMachineConfig<TContext, TEvent>;
  private stateMap: Map<string, StateConfig<TContext, TEvent>>;

  constructor(config: StateMachineConfig<TContext, TEvent>) {
    this.config = config;
    this.stateMap = new Map();
    
    // Build state map for quick lookups
    for (const state of config.states) {
      this.stateMap.set(state.name, state);
    }
    
    // Validate initial state exists
    if (!this.stateMap.has(config.initialState)) {
      throw new StateNotFoundError(config.initialState);
    }
    
    // Validate all transition targets exist
    this.validateTransitions();
  }

  private validateTransitions(): void {
    for (const state of this.config.states) {
      for (const [event, transition] of Object.entries(state.transitions)) {
        if (!this.stateMap.has(transition.target)) {
          throw new StateNotFoundError(transition.target);
        }
      }
    }
  }

  /**
   * Get the initial state
   */
  getInitialState(): string {
    return this.config.initialState;
  }

  /**
   * Get state configuration
   */
  getState(stateName: string): StateConfig<TContext, TEvent> | undefined {
    return this.stateMap.get(stateName);
  }

  /**
   * Check if a transition is allowed
   */
  canTransition(from: string, event: TEvent, context: TContext): boolean {
    const state = this.stateMap.get(from);
    if (!state) return false;
    
    const eventStr = String(event);
    const transition = state.transitions[eventStr];
    if (!transition) return false;
    
    return true;
  }

  /**
   * Get the target state for a transition
   */
  getTransitionTarget(from: string, event: TEvent): string | undefined {
    const state = this.stateMap.get(from);
    if (!state) return undefined;
    
    const eventStr = String(event);
    const transition = state.transitions[eventStr];
    return transition?.target;
  }

  /**
   * Execute a transition with guards and actions
   */
  async transition(
    from: string,
    event: TEvent,
    context: TContext
  ): Promise<{ state: string; context: TContext }> {
    const state = this.stateMap.get(from);
    if (!state) {
      throw new StateNotFoundError(from);
    }

    // Check if state is final
    if (state.final) {
      throw new InvalidTransitionError(from, String(event), undefined, "State is final");
    }

    const eventStr = String(event);
    const transition = state.transitions[eventStr];
    if (!transition) {
      throw new InvalidTransitionError(from, eventStr, undefined, "No transition defined");
    }

    // Execute guard
    if (transition.guard) {
      const allowed = await transition.guard(context, event);
      if (!allowed) {
        throw new InvalidTransitionError(
          from,
          eventStr,
          transition.target,
          "Guard condition failed"
        );
      }
    }

    // Get target state
    const targetState = this.stateMap.get(transition.target);
    if (!targetState) {
      throw new StateNotFoundError(transition.target);
    }

    // Execute exit action
    if (state.onExit) {
      await state.onExit(context);
    }

    // Execute transition action
    if (transition.action) {
      await transition.action(context, event);
    }

    // Execute entry action
    if (targetState.onEntry) {
      await targetState.onEntry(context);
    }

    return {
      state: transition.target,
      context,
    };
  }

  /**
   * Get all possible transitions from a state
   */
  getAvailableTransitions(from: string): string[] {
    const state = this.stateMap.get(from);
    if (!state) return [];
    return Object.keys(state.transitions);
  }

  /**
   * Check if a state is final
   */
  isFinalState(stateName: string): boolean {
    const state = this.stateMap.get(stateName);
    return state?.final ?? false;
  }

  /**
   * Create initial context
   */
  createContext(): TContext {
    if (this.config.createContext) {
      return this.config.createContext();
    }
    return {} as TContext;
  }

  /**
   * Get state hierarchy path (for hierarchical states)
   */
  getStatePath(stateName: string): string[] {
    const path: string[] = [];
    let current = this.stateMap.get(stateName);
    
    while (current) {
      path.unshift(current.name);
      if (current.parent) {
        current = this.stateMap.get(current.parent);
      } else {
        break;
      }
    }
    
    return path;
  }
}

/**
 * Create a new state machine registry
 */
export function createStateMachine<TContext = any, TEvent = string>(
  config: StateMachineConfig<TContext, TEvent>
): StateMachineRegistry<TContext, TEvent> {
  return new StateMachineRegistry(config);
}
