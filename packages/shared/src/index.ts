export type CallEvent =
  | { kind: 'user_speech'; text?: string }
  | { kind: 'assistant_speech'; text?: string }
  | { kind: 'tool_call'; name: string; args: unknown }
  | { kind: 'tool_result'; name: string; result: unknown }
  | { kind: 'error'; message: string };

export interface LeadInput {
  phone?: string;
  name?: string;
  company?: string;
  intent?: string;
  notes?: string;
  call_id?: string;
}

export interface ScheduleFollowUpInput {
  call_id?: string;
  when?: string;
  channel?: string;
  notes?: string;
}

export interface LogOutcomeInput {
  call_id?: string;
  status?: string;
  notes?: string;
  disposition?: string;
}

export * from "./routes";
export * from "./wa-calls";
export * from "./voice/dto";
