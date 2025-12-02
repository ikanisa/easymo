/**
 * Test Utilities and Helpers
 * Shared testing infrastructure for all microservices
 */

import { assertEquals, assertExists, assertRejects } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { spy, stub, Spy, Stub } from "https://deno.land/std@0.203.0/testing/mock.ts";

// ============================================================================
// TYPES
// ============================================================================

export type MockSupabaseClient = {
  from: (table: string) => MockQueryBuilder;
  functions: {
    invoke: (name: string, options?: any) => Promise<{ data: any; error: any }>;
  };
  storage: {
    from: (bucket: string) => MockStorageBucket;
  };
};

export type MockQueryBuilder = {
  select: (columns?: string) => MockQueryBuilder;
  insert: (data: any) => MockQueryBuilder;
  update: (data: any) => MockQueryBuilder;
  delete: () => MockQueryBuilder;
  upsert: (data: any, options?: any) => MockQueryBuilder;
  eq: (column: string, value: any) => MockQueryBuilder;
  neq: (column: string, value: any) => MockQueryBuilder;
  gt: (column: string, value: any) => MockQueryBuilder;
  gte: (column: string, value: any) => MockQueryBuilder;
  lt: (column: string, value: any) => MockQueryBuilder;
  lte: (column: string, value: any) => MockQueryBuilder;
  like: (column: string, value: string) => MockQueryBuilder;
  ilike: (column: string, value: string) => MockQueryBuilder;
  in: (column: string, values: any[]) => MockQueryBuilder;
  order: (column: string, options?: any) => MockQueryBuilder;
  limit: (count: number) => MockQueryBuilder;
  single: () => Promise<{ data: any; error: any }>;
  maybeSingle: () => Promise<{ data: any; error: any }>;
  then: (resolve: (result: { data: any; error: any }) => void) => Promise<void>;
};

export type MockStorageBucket = {
  upload: (path: string, file: any, options?: any) => Promise<{ data: any; error: any }>;
  download: (path: string) => Promise<{ data: any; error: any }>;
  createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: any; error: any }>;
  remove: (paths: string[]) => Promise<{ data: any; error: any }>;
};

export type TestContext = {
  supabase: MockSupabaseClient;
  from: string;
  profileId: string;
  locale: string;
};

// ============================================================================
// MOCK FACTORIES
// ============================================================================

/**
 * Create a mock Supabase client
 */
export function createMockSupabase(options: {
  data?: Record<string, any>;
  error?: any;
  functionResults?: Record<string, any>;
} = {}): MockSupabaseClient {
  const mockData = options.data || {};
  const mockError = options.error || null;
  const functionResults = options.functionResults || {};

  const createQueryBuilder = (table: string): MockQueryBuilder => {
    let result = { data: mockData[table] || null, error: mockError };

    const builder: MockQueryBuilder = {
      select: () => builder,
      insert: (data) => {
        result = { data: { ...data, id: crypto.randomUUID() }, error: mockError };
        return builder;
      },
      update: (data) => {
        result = { data, error: mockError };
        return builder;
      },
      delete: () => builder,
      upsert: (data) => {
        result = { data, error: mockError };
        return builder;
      },
      eq: () => builder,
      neq: () => builder,
      gt: () => builder,
      gte: () => builder,
      lt: () => builder,
      lte: () => builder,
      like: () => builder,
      ilike: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      single: async () => result,
      maybeSingle: async () => result,
      then: async (resolve) => resolve(result),
    };

    return builder;
  };

  return {
    from: (table: string) => createQueryBuilder(table),
    functions: {
      invoke: async (name: string, options?: any) => {
        return functionResults[name] || { data: null, error: null };
      },
    },
    storage: {
      from: (bucket: string) => ({
        upload: async () => ({ data: { path: "test/path" }, error: null }),
        download: async () => ({ data: new Uint8Array(), error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: "https://example.com/signed" }, error: null }),
        remove: async () => ({ data: null, error: null }),
      }),
    },
  };
}

/**
 * Create a mock router context
 */
export function createMockContext(overrides: Partial<TestContext> = {}): TestContext {
  return {
    supabase: createMockSupabase(),
    from: "+250788123456",
    profileId: "test-profile-id",
    locale: "en",
    ...overrides,
  };
}

/**
 * Create a mock WhatsApp webhook payload
 */
export function createMockWebhookPayload(options: {
  messageType?: "text" | "interactive" | "location" | "image" | "document";
  text?: string;
  buttonId?: string;
  listId?: string;
  location?: { latitude: number; longitude: number };
  mediaId?: string;
  from?: string;
} = {}): any {
  const from = options.from || "+250788123456";
  const messageId = crypto.randomUUID();

  const baseMessage: any = {
    id: messageId,
    from,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };

  switch (options.messageType || "text") {
    case "text":
      baseMessage.type = "text";
      baseMessage.text = { body: options.text || "Hello" };
      break;

    case "interactive":
      baseMessage.type = "interactive";
      if (options.buttonId) {
        baseMessage.interactive = {
          type: "button_reply",
          button_reply: { id: options.buttonId, title: "Button" },
        };
      } else if (options.listId) {
        baseMessage.interactive = {
          type: "list_reply",
          list_reply: { id: options.listId, title: "List Item" },
        };
      }
      break;

    case "location":
      baseMessage.type = "location";
      baseMessage.location = {
        latitude: options.location?.latitude || -1.9403,
        longitude: options.location?.longitude || 29.8739,
      };
      break;

    case "image":
      baseMessage.type = "image";
      baseMessage.image = {
        id: options.mediaId || "media-123",
        mime_type: "image/jpeg",
      };
      break;

    case "document":
      baseMessage.type = "document";
      baseMessage.document = {
        id: options.mediaId || "media-123",
        mime_type: "application/pdf",
      };
      break;
  }

  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "test-entry-id",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15550123456",
                phone_number_id: "test-phone-id",
              },
              contacts: [{ wa_id: from, profile: { name: "Test User" } }],
              messages: [baseMessage],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

/**
 * Create a mock HTTP request
 */
export function createMockRequest(options: {
  method?: string;
  path?: string;
  body?: any;
  headers?: Record<string, string>;
} = {}): Request {
  const method = options.method || "POST";
  const path = options.path || "/";
  const headers = new Headers(options.headers || {});
  
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const body = options.body ? JSON.stringify(options.body) : undefined;

  return new Request(`https://example.com${path}`, {
    method,
    headers,
    body,
  });
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Assert response status and body
 */
export async function assertResponse(
  response: Response,
  expectedStatus: number,
  bodyCheck?: (body: any) => void
): Promise<void> {
  assertEquals(response.status, expectedStatus, `Expected status ${expectedStatus}, got ${response.status}`);
  
  if (bodyCheck) {
    const body = await response.json();
    bodyCheck(body);
  }
}

/**
 * Assert that a response is successful
 */
export async function assertSuccess(response: Response): Promise<any> {
  assertEquals(response.ok, true, `Expected successful response, got ${response.status}`);
  return await response.json();
}

/**
 * Assert that a response is an error
 */
export async function assertError(
  response: Response,
  expectedStatus: number,
  expectedCode?: string
): Promise<any> {
  assertEquals(response.status, expectedStatus);
  const body = await response.json();
  if (expectedCode) {
    assertEquals(body.error, expectedCode);
  }
  return body;
}

// ============================================================================
// MOCK WHATSAPP API
// ============================================================================

export type MockWhatsAppAPI = {
  sendText: Spy<any>;
  sendButtons: Spy<any>;
  sendList: Spy<any>;
  sendLocation: Spy<any>;
  sendImage: Spy<any>;
  sendTemplate: Spy<any>;
  getMedia: Spy<any>;
  messages: any[];
  reset: () => void;
};

/**
 * Create a mock WhatsApp API
 */
export function createMockWhatsAppAPI(): MockWhatsAppAPI {
  const messages: any[] = [];

  const sendText = spy(async (to: string, text: string) => {
    messages.push({ type: "text", to, text });
    return { success: true, messageId: crypto.randomUUID() };
  });

  const sendButtons = spy(async (to: string, text: string, buttons: any[]) => {
    messages.push({ type: "buttons", to, text, buttons });
    return { success: true, messageId: crypto.randomUUID() };
  });

  const sendList = spy(async (to: string, options: any) => {
    messages.push({ type: "list", to, ...options });
    return { success: true, messageId: crypto.randomUUID() };
  });

  const sendLocation = spy(async (to: string, location: any) => {
    messages.push({ type: "location", to, location });
    return { success: true, messageId: crypto.randomUUID() };
  });

  const sendImage = spy(async (to: string, imageUrl: string, caption?: string) => {
    messages.push({ type: "image", to, imageUrl, caption });
    return { success: true, messageId: crypto.randomUUID() };
  });

  const sendTemplate = spy(async (to: string, template: any) => {
    messages.push({ type: "template", to, template });
    return { success: true, messageId: crypto.randomUUID() };
  });

  const getMedia = spy(async (mediaId: string) => {
    return { url: `https://example.com/media/${mediaId}` };
  });

  return {
    sendText,
    sendButtons,
    sendList,
    sendLocation,
    sendImage,
    sendTemplate,
    getMedia,
    messages,
    reset: () => {
      messages.length = 0;
      sendText.calls.length = 0;
      sendButtons.calls.length = 0;
      sendList.calls.length = 0;
      sendLocation.calls.length = 0;
      sendImage.calls.length = 0;
      sendTemplate.calls.length = 0;
      getMedia.calls.length = 0;
    },
  };
}

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Create test profile data
 */
export function createTestProfile(overrides: Record<string, any> = {}): any {
  return {
    user_id: crypto.randomUUID(),
    whatsapp_e164: "+250788123456",
    full_name: "Test User",
    language: "en",
    country_code: "RW",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create test trip data
 */
export function createTestTrip(overrides: Record<string, any> = {}): any {
  return {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    role: "passenger",
    vehicle_type: "moto",
    pickup_lat: -1.9403,
    pickup_lng: 29.8739,
    status: "open",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create test insurance lead data
 */
export function createTestInsuranceLead(overrides: Record<string, any> = {}): any {
  return {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    whatsapp: "+250788123456",
    status: "received",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create test claim data
 */
export function createTestClaim(overrides: Record<string, any> = {}): any {
  return {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    whatsapp: "+250788123456",
    claim_type: "claim_accident",
    description: "Test claim description",
    documents: [],
    status: "submitted",
    submitted_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// TEST RUNNER UTILITIES
// ============================================================================

/**
 * Setup and teardown helpers
 */
export function createTestSuite(name: string) {
  const beforeEachCallbacks: (() => void | Promise<void>)[] = [];
  const afterEachCallbacks: (() => void | Promise<void>)[] = [];

  return {
    beforeEach: (callback: () => void | Promise<void>) => {
      beforeEachCallbacks.push(callback);
    },
    afterEach: (callback: () => void | Promise<void>) => {
      afterEachCallbacks.push(callback);
    },
    test: (testName: string, fn: () => void | Promise<void>) => {
      Deno.test(`${name} > ${testName}`, async () => {
        for (const cb of beforeEachCallbacks) {
          await cb();
        }
        try {
          await fn();
        } finally {
          for (const cb of afterEachCallbacks) {
            await cb();
          }
        }
      });
    },
  };
}

console.log("✅ Test utilities loaded");
