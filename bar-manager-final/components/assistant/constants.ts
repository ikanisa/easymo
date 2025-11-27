import type { AssistantMessage } from "@/lib/schemas";

export interface QuickPrompt {
  id: string;
  label: string;
  description: string;
  promptId: string;
}

export const QUICK_PROMPTS: QuickPrompt[] = [
  {
    id: "summary-24h",
    label: "Summarize last 24h",
    description: "Highlights key incidents, automations, and red flags",
    promptId: "summary.last24h",
  },
  {
    id: "explain-policy",
    label: "Explain policy block",
    description: "Translate opt-out / quiet-hour blocks into next steps",
    promptId: "policy.explainBlock",
  },
  {
    id: "prep-standup",
    label: "Prep stand-up",
    description: "Compile talking points for the ops huddle",
    promptId: "briefing.opsStandup",
  },
];

export const INTRO_MESSAGE: AssistantMessage = {
  id: "assistant-intro",
  role: "assistant",
  content:
    "Hey there! I'm your Ops assistant. Pick a prompt or ask a question and I'll pull together context from notifications, dispatch events, and logs.",
  createdAt: new Date().toISOString(),
};

export const DEFAULT_LIMITATIONS = [
  "AI responses may be outdated. Confirm before taking action.",
  "Never share PII or sensitive codes in prompts.",
] as const;
