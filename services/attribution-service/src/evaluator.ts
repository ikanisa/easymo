export type EvaluateInput = {
  referrals?: any[];
  events?: any[];
  timeboxDays?: number;
};

export function evaluateAttribution(input: EvaluateInput) {
  const referrals = input.referrals ?? [];
  const events = input.events ?? [];
  const now = Date.now();
  const windowMs = (input.timeboxDays ?? 7) * 86400000;

  const ctwa = referrals.find((r: any) => String(r?.source || r?.type || r || "").toLowerCase().includes("ctwa"));
  let endorserFromCtwa: string | undefined;
  if (ctwa) {
    const raw = (ctwa?.param || ctwa?.ref || ctwa?.data || ctwa) as string;
    const m = String(raw).match(/endorser[-_:]?([A-Za-z0-9_-]+)/i);
    if (m) endorserFromCtwa = m[1];
    if (!endorserFromCtwa && typeof ctwa === 'object') {
      endorserFromCtwa = ctwa.endorserId ?? ctwa.endorser ?? undefined;
    }
  }

  const endorserClick = events.find((e: any) => String(e?.type).toUpperCase() === "CONTACT_ENDORSER");
  const endorserClickId = endorserClick?.endorserId ?? endorserClick?.actorId;
  const withinWindow = endorserClick?.timestamp ? (now - Number(new Date(endorserClick.timestamp))) <= windowMs : false;

  const agentEvent = events.find((e: any) => String(e?.type).toUpperCase() === "AGENT_ASSIST" || String(e?.role).toUpperCase() === "AGENT");
  const agentId = agentEvent?.agentId ?? agentEvent?.actorId;

  let type: "ENDORSER" | "AGENT" | "AD" = "AGENT";
  let entityId: string | undefined = undefined;

  if (endorserFromCtwa) {
    type = "ENDORSER";
    entityId = endorserFromCtwa;
  } else if (endorserClick && withinWindow) {
    type = "ENDORSER";
    entityId = endorserClickId;
  } else if (agentId) {
    type = "AGENT";
    entityId = agentId;
  }

  return { type, entityId };
}

