export type LiveCallRecord = {
  callSid: string;
  tenantId?: string;
  leadName: string | null;
  leadPhone: string;
  agentRegion: string | null;
  startedAt: string;
  lastMediaAt: string | null;
  status: "active" | "handoff" | "ended";
  direction: "inbound" | "outbound";
  warmTransferQueue: string | null;
  optOutDetected: boolean;
  transcriptPreview: string | null;
  durationSeconds: number | null;
};

class LiveCallRegistry {
  private readonly calls = new Map<string, LiveCallRecord>();

  startSession(
    callSid: string,
    direction: "inbound" | "outbound",
    leadPhone: string,
    leadName?: string | null,
    region?: string | null,
    tenantId?: string,
  ) {
    this.calls.set(callSid, {
      callSid,
      tenantId,
      leadName: leadName ?? null,
      leadPhone,
      agentRegion: region ?? null,
      startedAt: new Date().toISOString(),
      lastMediaAt: null,
      status: "active",
      direction,
      warmTransferQueue: null,
      optOutDetected: false,
      transcriptPreview: null,
      durationSeconds: null,
    });
  }

  updateMedia(callSid: string, size: number) {
    const current = this.calls.get(callSid);
    if (!current) return;
    const now = new Date();
    const started = new Date(current.startedAt);
    const duration = Math.max(0, Math.round((now.getTime() - started.getTime()) / 1000));
    this.calls.set(callSid, {
      ...current,
      lastMediaAt: now.toISOString(),
      durationSeconds: duration,
    });
  }

  markWarmTransfer(callSid: string, queue: string) {
    const current = this.calls.get(callSid);
    if (!current) return;
    this.calls.set(callSid, {
      ...current,
      status: "handoff",
      warmTransferQueue: queue,
    });
  }

  registerOptOut(callSid: string, transcript: string) {
    const current = this.calls.get(callSid);
    if (!current) return;
    this.calls.set(callSid, {
      ...current,
      optOutDetected: true,
      transcriptPreview: transcript.slice(0, 120),
    });
  }

  endSession(callSid: string) {
    const current = this.calls.get(callSid);
    if (!current) return;
    const now = new Date();
    const started = new Date(current.startedAt);
    const duration = Math.max(0, Math.round((now.getTime() - started.getTime()) / 1000));
    this.calls.set(callSid, {
      ...current,
      status: "ended",
      lastMediaAt: current.lastMediaAt ?? now.toISOString(),
      durationSeconds: duration,
    });
  }

  remove(callSid: string) {
    this.calls.delete(callSid);
  }

  snapshot() {
    const calls = Array.from(this.calls.values()).sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    return {
      generatedAt: new Date().toISOString(),
      calls,
    };
  }
}

export const liveCallRegistry = new LiveCallRegistry();
