import { test, expect } from '@playwright/test';

const registryPayload = {
  agents: [
    {
      id: 'agent-driver',
      agent_type: 'driver_negotiation',
      name: 'Driver Negotiation',
      enabled: true,
      sla_minutes: 5,
      feature_flag_scope: 'pilot',
      enabled_tools: ['quotes'],
    },
    {
      id: 'agent-pharmacy',
      agent_type: 'pharmacy_sourcing',
      name: 'Pharmacy Sourcing',
      enabled: false,
      sla_minutes: 7,
      feature_flag_scope: 'staging',
      enabled_tools: [],
    },
  ],
};

const sessionsPayload = {
  sessions: [
    {
      id: 'session-1',
      agent_type: 'driver_negotiation',
      flow_type: 'rides',
      status: 'searching',
      started_at: new Date().toISOString(),
      deadline_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      agent_quotes: [{ count: 1 }],
    },
  ],
  total: 1,
  limit: 20,
  offset: 0,
};

const metricsPayload = {
  metrics: [],
  kpis: {
    active_sessions: 1,
    timeout_rate: '0.0',
    acceptance_rate: '90.0',
    total_sessions: 4,
  },
};

test.describe('Critical realtime operator flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/auth/v1/token', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify({ access_token: 'stub-token', user: { id: 'user_1' } }),
        headers: { 'content-type': 'application/json' },
      });
    });

    await page.route('**/api/monitoring/**', (route) => {
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });

    await page.route('**/api/agent-orchestration/registry**', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify(registryPayload),
        headers: { 'content-type': 'application/json' },
      });
    });

    await page.route('**/api/agent-orchestration/metrics**', (route) => {
      route.fulfill({
        status: 200,
        body: JSON.stringify(metricsPayload),
        headers: { 'content-type': 'application/json' },
      });
    });

    await page.route('**/api/agent-orchestration/sessions**', (route, request) => {
      if (request.method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify(sessionsPayload),
          headers: { 'content-type': 'application/json' },
        });
        return;
      }

      if (request.method() === 'POST') {
        route.fulfill({
          status: 201,
          body: JSON.stringify({ session: { ...sessionsPayload.sessions[0], id: 'session-2' } }),
          headers: { 'content-type': 'application/json' },
        });
        return;
      }

      route.continue();
    });

    await page.route('**/api/agent-orchestration/sessions/session-1**', (route, request) => {
      if (request.method() === 'GET') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            session: {
              id: 'session-1',
              status: 'searching',
              agent_type: 'driver_negotiation',
              flow_type: 'rides',
              started_at: new Date().toISOString(),
              deadline_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
              extensions_count: 0,
              request_data: { pickup: 'Kigali' },
            },
            quotes: [],
          }),
          headers: { 'content-type': 'application/json' },
        });
        return;
      }

      if (request.method() === 'PATCH') {
        route.fulfill({
          status: 200,
          body: JSON.stringify({
            session: {
              id: 'session-1',
              status: 'searching',
              agent_type: 'driver_negotiation',
              flow_type: 'rides',
              started_at: new Date().toISOString(),
              deadline_at: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
              extensions_count: 1,
              request_data: { pickup: 'Kigali' },
            },
          }),
          headers: { 'content-type': 'application/json' },
        });
        return;
      }

      route.continue();
    });
  });

  test('surfaces realtime agent dashboard metrics', async ({ page }) => {
    await page.goto('/agents/dashboard');

    await expect(page.getByRole('heading', { name: 'AI Agents Dashboard' })).toBeVisible();
    await expect(page.getByText('Agent Status')).toBeVisible();
    await expect(page.getByText('Driver Negotiation')).toBeVisible();
  });

  test('walks through agent orchestration session controls', async ({ page }) => {
    await page.goto('/agent-orchestration');

    await expect(page.getByRole('heading', { name: 'AI Agent Orchestration' })).toBeVisible();
    await expect(page.getByText('Driver Negotiation')).toBeVisible();

    await page.getByText('Driver Negotiation').click();
    await expect(page.getByRole('heading', { name: /Agent Config/i })).toBeVisible();
    await page.getByRole('button', { name: /Close/ }).click();

    await page.getByText('session-1'.slice(0, 8)).click();
    await expect(page.getByRole('heading', { name: /Session/ })).toBeVisible();

    const patchPromise = page.waitForRequest((request) =>
      request.method() === 'PATCH' && request.url().includes('/api/agent-orchestration/sessions/session-1'),
    );
    await page.getByRole('button', { name: /Extend \+2 min/ }).click();
    await patchPromise;

    await page.getByRole('button', { name: /Close/ }).click();
  });
});
