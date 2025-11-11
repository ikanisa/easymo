export type AtlasRoadmapStatus = "live" | "beta" | "next";

export interface AtlasHeroAction {
  label: string;
  href?: string;
  variant?: "primary" | "ghost";
}

export interface AtlasMetric {
  label: string;
  value: string;
  helper?: string;
}

export interface AtlasHighlight {
  pill: string;
  title: string;
  description: string;
}

export interface AtlasRoadmapItem {
  label: string;
  description: string;
  status: AtlasRoadmapStatus;
}

export interface AtlasQuickLink {
  pill: string;
  label: string;
  description: string;
  href: string;
}

export interface AtlasPageConfig {
  slug: string;
  hero: {
    icon: string;
    badge: string;
    title: string;
    description: string;
    actions?: AtlasHeroAction[];
  };
  metrics: AtlasMetric[];
  highlights: AtlasHighlight[];
  roadmap: AtlasRoadmapItem[];
  quickLinks?: AtlasQuickLink[];
}

const agentQuickLinks: AtlasQuickLink[] = [
  {
    pill: "Control Room",
    label: "Open Agents Dashboard",
    description: "Monitor live sessions, guardrails, and handoffs in real time.",
    href: "/agents/dashboard",
  },
  {
    pill: "Playbooks",
    label: "Agent Knowledge Studio",
    description: "Curate documents, embeddings, and workflows without leaving the browser.",
    href: "/agents",
  },
];

const atlasPageConfigs: Record<string, AtlasPageConfig> = {
  "agents/driver-negotiation": {
    slug: "agents/driver-negotiation",
    hero: {
      icon: "🚗",
      badge: "Mobility",
      title: "Driver Negotiation Agent",
      description:
        "Automates fare discovery and driver negotiations with contextual guardrails borrowed from ChatGPT Atlas' marketplace flows.",
      actions: [
        { label: "Launch orchestration", href: "/agent-orchestration" },
        { label: "View transcripts", href: "/agents/conversations", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Live intents", value: "42", helper: "+7 vs last hour" },
      { label: "Median counter-offer", value: "14s", helper: "Target < 20s" },
      { label: "Win rate", value: "78%", helper: "+5 pts WoW" },
    ],
    highlights: [
      {
        pill: "Realtime context",
        title: "Lane-aware counter offers",
        description:
          "Streams telemetry, surge bands, and historical win rates to craft guardrail-safe counter offers without pinging an operator.",
      },
      {
        pill: "Compliance",
        title: "Red team policies baked in",
        description:
          "Atlas-style policy packs ensure every outbound message is logged, attributed, and explainable for regulators.",
      },
      {
        pill: "Voice ready",
        title: "Hands-free co-pilot",
        description:
          "Supports WhatsApp, in-app chat, and voice IVR so agents can negotiate across channels while sharing the same memory.",
      },
    ],
    roadmap: [
      {
        label: "Driver reputation blending",
        description: "Ingests partner ratings + fraud signals to prioritise the best supply first.",
        status: "live",
      },
      {
        label: "Earned wage payouts",
        description: "Auto-creates payout schedules when an offer is accepted, matching Atlas' wallet primitives.",
        status: "beta",
      },
      {
        label: "Predictive SLA guardrails",
        description: "Forecasts when negotiations will breach SLA and reroutes to human operators pre-emptively.",
        status: "next",
      },
    ],
    quickLinks: agentQuickLinks,
  },
  "agents/pharmacy": {
    slug: "agents/pharmacy",
    hero: {
      icon: "💊",
      badge: "Health",
      title: "Pharmacy Sourcing Agent",
      description:
        "Digitises pharmacy procurement, verifying stock, expiry windows, and ministry of health limits inside a single Atlas-inspired cockpit.",
      actions: [
        { label: "Sync catalogues", href: "/marketplace" },
        { label: "Escalate request", href: "/agents/performance", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "SKUs monitored", value: "3.6k", helper: "Cold-chain ready" },
      { label: "Verification latency", value: "9s", helper: "Supplier acknowledgement" },
      { label: "Fulfilment accuracy", value: "96%", helper: "Audit sampled daily" },
    ],
    highlights: [
      {
        pill: "Catalog sync",
        title: "Batch classifications with OCR",
        description:
          "Leverages Atlas' vision stack to parse leaflets, lot numbers, and dosage guidance before surfacing to agents.",
      },
      {
        pill: "Policy aware",
        title: "Country-specific compliance",
        description:
          "Applies controlled/OTC rules plus subsidy eligibility, preventing cart creation when paperwork is missing.",
      },
      {
        pill: "Ops automation",
        title: "Smart supplier routing",
        description:
          "Prioritises verified suppliers based on freshness, MoQ, and lead times while sharing reasoning notes with humans.",
      },
    ],
    roadmap: [
      {
        label: "Temperature excursion tracking",
        description: "Joins IoT logs with sourcing tasks to auto-flag risky consignments.",
        status: "live",
      },
      {
        label: "Formulary intelligence",
        description: "Maps prescriber patterns to highlight generics and eligible substitutions.",
        status: "beta",
      },
      {
        label: "End-to-end eRx approvals",
        description: "Moves prescriptions through insurer checks with Atlas-style conversational approvals.",
        status: "next",
      },
    ],
    quickLinks: agentQuickLinks,
  },
  "agents/shops": {
    slug: "agents/shops",
    hero: {
      icon: "🛍️",
      badge: "Retail",
      title: "Shops Discovery Agent",
      description:
        "Surfaces nearby inventory, pricing, and bundle suggestions for general trade merchants with Atlas-grade search UX.",
      actions: [
        { label: "Launch retail canvas", href: "/marketplace/settings" },
        { label: "View active intents", href: "/agents/conversations", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Merchant coverage", value: "1.9k", helper: "+120 stores this week" },
      { label: "Quote latency", value: "6s", helper: "Median multi-supplier response" },
      { label: "NPS", value: "+54", helper: "Surveyed after fulfilment" },
    ],
    highlights: [
      {
        pill: "Discovery",
        title: "Search that explains itself",
        description:
          "Atlas-style answer cards show why a product was selected, including stock freshness and logistics costs.",
      },
      {
        pill: "Bundling",
        title: "Smart cart intelligence",
        description:
          "Suggests add-ons with contribution margin goals, then writes the WhatsApp message for reps automatically.",
      },
      {
        pill: "Ops visibility",
        title: "Unified merchant timeline",
        description:
          "Combines disputes, claims, and payments so support reps can join a thread with full context.",
      },
    ],
    roadmap: [
      {
        label: "Autonomous cart edits",
        description: "Lets the agent nudge suppliers for partial fulfilment instead of stalling the thread.",
        status: "live",
      },
      {
        label: "Geo heat-maps",
        description: "Identifies cold spots for category managers straight from agent telemetry.",
        status: "beta",
      },
      {
        label: "Dynamic SLA promises",
        description: "Blends courier ETAs with store hours before replying to shoppers.",
        status: "next",
      },
    ],
    quickLinks: agentQuickLinks,
  },
  "agents/quincaillerie": {
    slug: "agents/quincaillerie",
    hero: {
      icon: "🔧",
      badge: "Hardware",
      title: "Quincaillerie Agent",
      description:
        "Specialised for hardware and construction workflows—tracks measurements, BOM approvals, and multi-vendor sourcing.",
      actions: [
        { label: "Open sourcing board", href: "/marketplace" },
        { label: "Share spec sheet", href: "/files", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Projects orchestrated", value: "128", helper: "Rolling 30 days" },
      { label: "Average BOM cycle", value: "2.1h", helper: "-36% vs manual" },
      { label: "Supplier SLA", value: "94%", helper: "On-time confirmations" },
    ],
    highlights: [
      {
        pill: "Engineer friendly",
        title: "Understands schematics",
        description:
          "Atlas' multimodal embeddings let the agent read CAD snippets and reason about SKU compatibility.",
      },
      {
        pill: "Approvals",
        title: "One-click supervisor loops",
        description:
          "Routes complex quotes to supervisors with generated summaries instead of raw PDFs.",
      },
      {
        pill: "Field mobility",
        title: "Offline-first bundles",
        description:
          "Site supervisors can text specs from remote areas; the agent drafts sourcing bundles once connectivity resumes.",
      },
    ],
    roadmap: [
      {
        label: "Dimensional conflict checks",
        description: "Highlights incompatible parts before the PO is sent.",
        status: "live",
      },
      {
        label: "Project memory",
        description: "Keeps per-site context like soil type, load limits, and preferred vendors.",
        status: "beta",
      },
      {
        label: "AR-assisted walkthroughs",
        description: "Pairs the agent with phone cameras to document installation progress.",
        status: "next",
      },
    ],
    quickLinks: agentQuickLinks,
  },
  "agents/property-rental": {
    slug: "agents/property-rental",
    hero: {
      icon: "🏠",
      badge: "Real estate",
      title: "Property Rental Agent",
      description:
        "Handles inquiries, bookings, and vetting for rentals while mirroring the conversational polish of ChatGPT Atlas.",
      actions: [
        { label: "Open rental board", href: "/leads" },
        { label: "Pipeline analytics", href: "/voice-analytics", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Prospects in play", value: "312", helper: "Updated hourly" },
      { label: "Tour confirmations", value: "87%", helper: "Self-serve scheduling" },
      { label: "Screening completion", value: "68%", helper: "Identity + affordability" },
    ],
    highlights: [
      {
        pill: "Guided replies",
        title: "Lifestyle-aware answers",
        description:
          "References neighbourhood data, schools, and commute times automatically so agents reply like locals.",
      },
      {
        pill: "Trust & safety",
        title: "Tenant screening funnel",
        description:
          "Collects IDs, payslips, and references with explainable decisions before escalating to brokers.",
      },
      {
        pill: "Calendars",
        title: "Atlas-grade scheduling",
        description:
          "Synchronises across Google Calendar and internal calendars with automatic buffer management.",
      },
    ],
    roadmap: [
      {
        label: "Instant lease drafting",
        description: "Merges approved terms into the legal packet ready for e-sign.",
        status: "live",
      },
      {
        label: "Deposits orchestration",
        description: "Connects wallet escrows to each booking automatically.",
        status: "beta",
      },
      {
        label: "Dynamic collateral recommendations",
        description: "Suggests guarantees or insurance based on risk profile.",
        status: "next",
      },
    ],
    quickLinks: agentQuickLinks,
  },
  "agents/schedule-trip": {
    slug: "agents/schedule-trip",
    hero: {
      icon: "📅",
      badge: "Mobility",
      title: "Schedule Trip Agent",
      description:
        "Plans multi-leg journeys, synchronising passengers, drivers, and payments with Atlas-inspired clarity.",
      actions: [
        { label: "Planner workspace", href: "/trips" },
        { label: "Route library", href: "/qr", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Trips queued", value: "64", helper: "Next 48h" },
      { label: "Adjustment SLA", value: "11m", helper: "From edit to confirmation" },
      { label: "Payment readiness", value: "91%", helper: "E-wallet or card on file" },
    ],
    highlights: [
      {
        pill: "Itinerary graph",
        title: "Understands segments + dependencies",
        description:
          "Draws on Atlas' timeline components to visualise pickups, layovers, and resources.",
      },
      {
        pill: "Financials",
        title: "Auto-generated budgets",
        description:
          "Builds a rolled-up quote with taxes, surcharges, and margins before sharing externally.",
      },
      {
        pill: "Recovery loops",
        title: "Fallback plans ready",
        description:
          "Drafts rebooking flows the moment a partner misses check-in, keeping riders informed.",
      },
    ],
    roadmap: [
      {
        label: "Multi-rider chat",
        description: "Hosts a shared inbox for each trip with read receipts and tasks.",
        status: "live",
      },
      {
        label: "Budget variance alerts",
        description: "Monitors price drift vs approved plan.",
        status: "beta",
      },
      {
        label: "Embedded visas",
        description: "Packs visa requirements + document collection directly into the flow.",
        status: "next",
      },
    ],
    quickLinks: agentQuickLinks,
  },
  "agents/conversations": {
    slug: "agents/conversations",
    hero: {
      icon: "💬",
      badge: "Ops cockpit",
      title: "Live Conversations",
      description:
        "Monitor every message, escalation, and safety flag in a single Atlas-like stream that is filterable and explainable.",
      actions: [
        { label: "Open monitoring deck", href: "/notifications" },
        { label: "Download transcript", href: "/files", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Active threads", value: "118", helper: "Across WhatsApp + in-app" },
      { label: "Escalations", value: "6", helper: "Last 60 minutes" },
      { label: "Policy hits", value: "3", helper: "Awaiting review" },
    ],
    highlights: [
      {
        pill: "Observability",
        title: "Streamed like Atlas",
        description:
          "All updates are structured as events so supervisors can time-travel a thread with context.",
      },
      {
        pill: "Safety",
        title: "Inline guardrail nudges",
        description:
          "If the model approaches a sensitive zone, we highlight the prompt, suggested response, and reason.",
      },
      {
        pill: "Productivity",
        title: "Keyboard-first triage",
        description:
          "Use global search, bulk actions, and quick labels to keep the queue healthy.",
      },
    ],
    roadmap: [
      {
        label: "Agent sentiment radar",
        description: "Pinpoints conversations trending negative before CSAT drops.",
        status: "live",
      },
      {
        label: "Supervisor macros",
        description: "Atlas-style slash commands to inject policies, canned text, or bookmarks.",
        status: "beta",
      },
      {
        label: "Auto QA summaries",
        description: "Auto-grade a conversation against quality rubrics every morning.",
        status: "next",
      },
    ],
    quickLinks: agentQuickLinks,
  },
  "agents/learning": {
    slug: "agents/learning",
    hero: {
      icon: "🧠",
      badge: "Knowledge",
      title: "Agent Learning Studio",
      description:
        "Train, evaluate, and deploy updated reasoning packs with the same ergonomics as ChatGPT Atlas' workspace.",
      actions: [
        { label: "Launch learning board", href: "/ai/chat-completions" },
        { label: "Embed documents", href: "/files", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Datasets tracked", value: "57", helper: "Versioned automatically" },
      { label: "Evaluation suites", value: "14", helper: "Nightly regression" },
      { label: "Deployment time", value: "3m", helper: "From merge to prod" },
    ],
    highlights: [
      {
        pill: "Source control",
        title: "Version every prompt",
        description:
          "Changes flow through review + approvals so you always know who shipped what.",
      },
      {
        pill: "Telemetry",
        title: "Atlas-quality dashboards",
        description:
          "Win/loss analysis, drift alerts, and embedding coverage visualised consistently.",
      },
      {
        pill: "Tooling",
        title: "Bring your own model",
        description:
          "Swap between OpenAI, Anthropic, or local models while keeping evaluation harnesses identical.",
      },
    ],
    roadmap: [
      {
        label: "Auto PR suggestions",
        description: "The system drafts fine-tune diffs straight from failed evals.",
        status: "live",
      },
      {
        label: "Real-time offline testing",
        description: "Shadow traffic analysis before promoting a model.",
        status: "beta",
      },
      {
        label: "Closed-loop retraining",
        description: "Collects feedback from operations and pushes into training sets.",
        status: "next",
      },
    ],
    quickLinks: agentQuickLinks,
  },
  "agents/performance": {
    slug: "agents/performance",
    hero: {
      icon: "📈",
      badge: "Insights",
      title: "Agent Performance Board",
      description:
        "Atlas-inspired scorecards for speed, accuracy, CSAT, and compliance across every agent.",
      actions: [
        { label: "Open insights", href: "/dashboard" },
        { label: "Download weekly brief", href: "/logs", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Global CSAT", value: "4.6 ★", helper: "Weighted across channels" },
      { label: "Avg. first response", value: "7.8s", helper: "-1.2s WoW" },
      { label: "Policy confidence", value: "98.2%", helper: "No red findings" },
    ],
    highlights: [
      {
        pill: "Scorecards",
        title: "Context-first dashboards",
        description:
          "Stacked layouts inspired by Atlas show time-series + narrative in a single glance.",
      },
      {
        pill: "Benchmarks",
        title: "Compare to humans",
        description:
          "Overlay human averages to prove ROI and identify where to invest training.",
      },
      {
        pill: "Alerting",
        title: "Auto Slack digests",
        description:
          "Ships daily recaps with anomalies, hero runs, and blocked tasks.",
      },
    ],
    roadmap: [
      {
        label: "Trust & safety lens",
        description: "Separate scoring backed by policy audits.",
        status: "live",
      },
      {
        label: "Attribution explorer",
        description: "Quantifies how data sources contribute to outcomes.",
        status: "beta",
      },
      {
        label: "Revenue impact overlay",
        description: "Connects agent actions to GMV and margin.",
        status: "next",
      },
    ],
    quickLinks: agentQuickLinks,
  },
  "agents/settings": {
    slug: "agents/settings",
    hero: {
      icon: "⚙️",
      badge: "Control",
      title: "Agent Settings",
      description:
        "Central command for credentials, feature flags, and safety levers—mirroring the clarity of ChatGPT Atlas' admin pages.",
      actions: [
        { label: "Open admin settings", href: "/settings" },
        { label: "Audit log", href: "/logs", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Feature flags", value: "34", helper: "5 toggled today" },
      { label: "Connected data sources", value: "18", helper: "Synced hourly" },
      { label: "Policy packs", value: "7", helper: "Live enforcement" },
    ],
    highlights: [
      {
        pill: "Access",
        title: "Scoped API keys",
        description:
          "Issue keys per agent or integration with automatic rotation reminders.",
      },
      {
        pill: "Safety",
        title: "Policy packs",
        description:
          "Bundle guardrails, prompts, and evaluation suites under one switch.",
      },
      {
        pill: "Change control",
        title: "Atlas-style audit log",
        description:
          "Every toggle, secret, or schema edit is time-stamped and attributable.",
      },
    ],
    roadmap: [
      {
        label: "Environment promotion",
        description: "Push changes from staging → prod with approvals.",
        status: "live",
      },
      {
        label: "Secrets escrow",
        description: "Managed vault integration for zero-touch rotation.",
        status: "beta",
      },
      {
        label: "Automated runbooks",
        description: "Self-healing workflows triggered by alerts.",
        status: "next",
      },
    ],
    quickLinks: agentQuickLinks,
  },
  sessions: {
    slug: "sessions",
    hero: {
      icon: "🔄",
      badge: "Operations",
      title: "Active Sessions",
      description:
        "Atlas-quality command center showing every session, channel, owner, and SLA in one scroll.",
      actions: [
        { label: "Launch live view", href: "/agents/dashboard" },
        { label: "Export telemetry", href: "/logs", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Sessions live now", value: "118", helper: "+14 vs last hour" },
      { label: "Warned SLAs", value: "5", helper: "Intervention recommended" },
      { label: "Median duration", value: "6m 21s", helper: "Rolling 24h" },
    ],
    highlights: [
      {
        pill: "Timeline",
        title: "Atlas-style time travel",
        description:
          "Scrub back any session to inspect prompts, tool calls, or handoffs without leaving the page.",
      },
      {
        pill: "Routing",
        title: "Smart muting",
        description:
          "Pause or reroute a task in one click; the agent receives guidance instantly.",
      },
      {
        pill: "Search",
        title: "Global filters",
        description:
          "Slice by agent, geography, queue, or channel using command palette-style shortcuts.",
      },
    ],
    roadmap: [
      {
        label: "Automated pacing",
        description: "Auto-slow down launches when error budgets are hit.",
        status: "live",
      },
      {
        label: "Shadow observers",
        description: "Let new operators watch a session with annotations.",
        status: "beta",
      },
      {
        label: "Session replay",
        description: "Pixel-perfect playback for escalations.",
        status: "next",
      },
    ],
    quickLinks: [
      {
        pill: "Guardrails",
        label: "View policy dashboard",
        description: "Audits, exemptions, and red teams in one place.",
        href: "/agents/performance",
      },
      {
        pill: "Readiness",
        label: "Open health console",
        description: "Check rate limits, latency, and outages.",
        href: "/whatsapp-health",
      },
    ],
  },
  negotiations: {
    slug: "negotiations",
    hero: {
      icon: "🤝",
      badge: "Operations",
      title: "Negotiations",
      description:
        "Purpose-built grid for high-stakes negotiations—see price history, policy exceptions, and human assists inspired by ChatGPT Atlas' trading UI.",
      actions: [
        { label: "Open queue", href: "/agents/dashboard" },
        { label: "Share insight", href: "/logs", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Active deals", value: "63", helper: "Across all channels" },
      { label: "Avg. rounds", value: "3.2", helper: "Counter offers per win" },
      { label: "Manual assists", value: "9%", helper: "-3 pts WoW" },
    ],
    highlights: [
      {
        pill: "Price memory",
        title: "Context at a glance",
        description:
          "Atlas-like panels show the last accepted fare, willingness to pay, and justification.",
      },
      {
        pill: "Coach",
        title: "Suggested next move",
        description:
          "See model guidance with citations and guardrail checks.",
      },
      {
        pill: "Risk",
        title: "Exception routing",
        description:
          "Escalate out-of-policy requests without reopening the case elsewhere.",
      },
    ],
    roadmap: [
      {
        label: "A/B negotiation strategies",
        description: "Experiment with tone, concessions, and anchors safely.",
        status: "live",
      },
      {
        label: "Auto wrap-ups",
        description: "Drafts the CRM note and ledger entry once done.",
        status: "beta",
      },
      {
        label: "Revenue impact tracking",
        description: "Quantifies negotiated deltas per cohort.",
        status: "next",
      },
    ],
    quickLinks: [
      {
        pill: "Playbooks",
        label: "Update reply macros",
        description: "Keep negotiation snippets fresh.",
        href: "/agents/learning",
      },
      {
        pill: "Ops",
        label: "View escalation policy",
        description: "Ensure humans stay in the loop on sensitive cases.",
        href: "/settings",
      },
    ],
  },
  "vendor-responses": {
    slug: "vendor-responses",
    hero: {
      icon: "📨",
      badge: "Operations",
      title: "Vendor Responses",
      description:
        "Central inbox for supply-side replies—blend Atlas-style labeling, assignment, and AI summaries.",
      actions: [
        { label: "Open vendor inbox", href: "/notifications" },
        { label: "Sync suppliers", href: "/marketplace", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Responses today", value: "204", helper: "+18% daily" },
      { label: "Median reply latency", value: "3m 40s", helper: "-22% WoW" },
      { label: "Actioned", value: "91%", helper: "Within SLA" },
    ],
    highlights: [
      {
        pill: "Summaries",
        title: "ChatGPT Atlas tone",
        description:
          "Every inbound message is distilled with intent, urgency, and structured fields.",
      },
      {
        pill: "Assignments",
        title: "Smart routing",
        description:
          "Route to the correct buyer or agent automatically using metadata.",
      },
      {
        pill: "Quality",
        title: "Duplication control",
        description:
          "Merge duplicate responses and highlight conflicting data.",
      },
    ],
    roadmap: [
      {
        label: "Supplier health scoring",
        description: "Combines responsiveness + fulfilment reliability.",
        status: "live",
      },
      {
        label: "Auto-generated POs",
        description: "Drafts sourcing requests straight from affirmative replies.",
        status: "beta",
      },
      {
        label: "Pricing anomaly alerts",
        description: "Flags outlier price changes in real time.",
        status: "next",
      },
    ],
    quickLinks: [
      {
        pill: "Suppliers",
        label: "Manage rosters",
        description: "Invite or suspend vendors instantly.",
        href: "/marketplace/settings",
      },
      {
        pill: "Analytics",
        label: "Open performance view",
        description: "Benchmark vendors vs peers.",
        href: "/agents/performance",
      },
    ],
  },
  leads: {
    slug: "leads",
    hero: {
      icon: "🎯",
      badge: "Growth",
      title: "Leads Workspace",
      description:
        "Pipeline view inspired by Atlas' CRM—every lead scored, enriched, and assigned with AI summaries.",
      actions: [
        { label: "Open pipeline", href: "/leads" },
        { label: "Download CSV", href: "/files", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Open leads", value: "842", helper: "Across segments" },
      { label: "Avg. SLA", value: "1h 12m", helper: "First reply" },
      { label: "Qualified rate", value: "63%", helper: "+4 pts WoW" },
    ],
    highlights: [
      {
        pill: "Scoring",
        title: "Signal-rich ranking",
        description:
          "Blend behaviour, firmographics, and channel source data.",
      },
      {
        pill: "Copilot",
        title: "Next best action",
        description:
          "Atlas-style suggestions help SDRs prioritise with confidence.",
      },
      {
        pill: "Collaboration",
        title: "Slack + email loops",
        description:
          "Push updates or approvals to the right stakeholder instantly.",
      },
    ],
    roadmap: [
      {
        label: "Lead recycling",
        description: "Auto-nurture stalled prospects.",
        status: "live",
      },
      {
        label: "Doc intelligence",
        description: "Parse uploaded contracts for extra signals.",
        status: "beta",
      },
      {
        label: "Revenue attribution",
        description: "Join closed deals back to original playbooks.",
        status: "next",
      },
    ],
    quickLinks: [
      {
        pill: "Insights",
        label: "Open performance board",
        description: "See funnel health at a glance.",
        href: "/agents/performance",
      },
      {
        pill: "Nurture",
        label: "Coordinate follow-ups",
        description: "Plug qualified leads back into AI agents.",
        href: "/agents/conversations",
      },
    ],
  },
  "live-calls": {
    slug: "live-calls",
    hero: {
      icon: "📞",
      badge: "Realtime",
      title: "Live Calls",
      description:
        "Atlas-quality wallboard for voice operations. Track concurrent calls, sentiment, and auto QA in one place.",
      actions: [
        { label: "Launch voice board", href: "/live-calls" },
        { label: "Review analytics", href: "/voice-analytics", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Active calls", value: "38", helper: "Blended inbound + outbound" },
      { label: "Avg. handle time", value: "4m 02s", helper: "LLM + human" },
      { label: "CSAT (voice)", value: "4.4 ★", helper: "Rolling 7d" },
    ],
    highlights: [
      {
        pill: "Transcription",
        title: "Realtime Whisper",
        description:
          "Atlas-grade transcripts feed analytics, QA, and coaching instantly.",
      },
      {
        pill: "Safety",
        title: "Live policy guardrails",
        description:
          "Flag risky phrases and push rescue script suggestions mid-call.",
      },
      {
        pill: "Recording",
        title: "Snippets for coaching",
        description:
          "Bookmark key moments and share with squads later.",
      },
    ],
    roadmap: [
      {
        label: "Agent assist overlays",
        description: "Show contextual cards to humans during hybrid calls.",
        status: "live",
      },
      {
        label: "Auto QA rubric builder",
        description: "Generate evaluation forms from policies.",
        status: "beta",
      },
      {
        label: "Voice-to-chat pivot",
        description: "Seamlessly move a call into messaging with context.",
        status: "next",
      },
    ],
    quickLinks: [
      {
        pill: "Infrastructure",
        label: "Check voice health",
        description: "Latency, packet loss, and carrier status.",
        href: "/whatsapp-health",
      },
      {
        pill: "Analytics",
        label: "Deep dive",
        description: "Open the voice analytics board.",
        href: "/voice-analytics",
      },
    ],
  },
  "voice-analytics": {
    slug: "voice-analytics",
    hero: {
      icon: "🎙️",
      badge: "Insights",
      title: "Voice Analytics",
      description:
        "Mirror ChatGPT Atlas' storytelling dashboards for voice: trends, transcripts, and action items in a single narrative.",
      actions: [
        { label: "Download weekly report", href: "/files" },
        { label: "Open live calls", href: "/live-calls", variant: "ghost" },
      ],
    },
    metrics: [
      { label: "Calls analysed", value: "1,284", helper: "Past 7 days" },
      { label: "Auto QA coverage", value: "92%", helper: "+8 pts WoW" },
      { label: "Sentiment delta", value: "+0.6", helper: "vs prior week" },
    ],
    highlights: [
      {
        pill: "Dashboards",
        title: "Tell the story",
        description:
          "Stacked layouts pair metrics with narrative text so executives grasp the signal instantly.",
      },
      {
        pill: "Topics",
        title: "Surface recurring themes",
        description:
          "LLM clustering groups intents and attaches example snippets.",
      },
      {
        pill: "Actions",
        title: "Auto-generated TODOs",
        description:
          "The system drafts follow-ups for Ops, Product, and Sales.",
      },
    ],
    roadmap: [
      {
        label: "Cross-channel insights",
        description: "Blend chat + voice to expose friction anywhere.",
        status: "live",
      },
      {
        label: "Auto coaching plans",
        description: "Pair analytics with personalised playbooks.",
        status: "beta",
      },
      {
        label: "Streaming analytics API",
        description: "Expose stats to BI stacks in real time.",
        status: "next",
      },
    ],
    quickLinks: [
      {
        pill: "Operations",
        label: "Visit live call board",
        description: "Jump straight into realtime monitoring.",
        href: "/live-calls",
      },
      {
        pill: "Data",
        label: "Explore exports",
        description: "Download anonymised transcripts + metrics.",
        href: "/files",
      },
    ],
  },
};

export function getAtlasConfig(slug: string): AtlasPageConfig {
  const config = atlasPageConfigs[slug];
  if (!config) {
    throw new Error(`Missing Atlas page config for "${slug}"`);
  }
  return config;
}
