export interface AutomationHealthStub {
  pollers: Array<{
    id: string;
    displayName: string;
    status: string;
    lastPolledAt?: string | null;
    lastError?: string | null;
    lastLatencyMs?: number | null;
  }>;
  gateways: Array<{
    id: string;
    displayName: string;
    status: string;
    lastHeartbeatAt?: string | null;
    lastError?: string | null;
    lastLatencyMs?: number | null;
  }>;
}

const globalStore = globalThis as unknown as {
  __automationHealthStub__?: AutomationHealthStub | null;
};

export const getAutomationHealthStub = (): AutomationHealthStub | null =>
  globalStore.__automationHealthStub__ ?? null;

export const setAutomationHealthStub = (value: AutomationHealthStub | null) => {
  globalStore.__automationHealthStub__ = value;
};
