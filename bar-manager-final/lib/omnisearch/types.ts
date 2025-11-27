export type OmniSearchCategory = "agent" | "request" | "policy" | "task";

export interface OmniSearchResultBase {
  id: string;
  title: string;
  description?: string | null;
  subtitle?: string | null;
}

export interface OmniSearchAgentResult extends OmniSearchResultBase {
  category: "agent";
  agentType: string;
  personaId?: string | null;
  enabled?: boolean | null;
  slaMinutes?: number | null;
}

export interface OmniSearchRequestResult extends OmniSearchResultBase {
  category: "request";
  status: string;
  agentType: string;
  startedAt?: string | null;
  deadlineAt?: string | null;
}

export interface OmniSearchPolicyResult extends OmniSearchResultBase {
  category: "policy";
  key: string;
  valuePreview?: string | null;
  updatedAt?: string | null;
}

export interface OmniSearchTaskResult extends OmniSearchResultBase {
  category: "task";
  status?: string | null;
  agentId?: string | null;
  dueAt?: string | null;
}

export type OmniSearchResult =
  | OmniSearchAgentResult
  | OmniSearchRequestResult
  | OmniSearchPolicyResult
  | OmniSearchTaskResult;

export interface OmniSearchSuggestion {
  id: string;
  category: OmniSearchCategory;
  label: string;
  description?: string | null;
  query: string;
}
