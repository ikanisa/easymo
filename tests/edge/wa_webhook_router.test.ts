import { assertEquals } from "../deps/asserts.ts";
import {
  __resetRouterTestOverrides,
  __setRouterTestOverrides,
  handleMessage,
} from "../../supabase/functions/wa-webhook/router/router.ts";

const ctx = {
  supabase: {} as never,
  from: "+250700000000",
  profileId: crypto.randomUUID(),
};

const state = { data: {} } as any;

type StubCall = { args: unknown[] };

function makeStub<T extends (...args: any[]) => any>(
  implementation: T,
): { fn: T; calls: StubCall[] } {
  const calls: StubCall[] = [];
  const fn = ((...args: any[]) => {
    calls.push({ args });
    return implementation(...args);
  }) as T;
  return { fn, calls };
}

Deno.test({
  name: "handleMessage short-circuits when guard passes",
  async fn() {
    const guardStub = makeStub(async () => true);
    const mediaStub = makeStub(async () => false);
    const listStub = makeStub(async () => false);
    const buttonStub = makeStub(async () => false);
    const locationStub = makeStub(async () => false);
    const textStub = makeStub(async () => false);
    const unhandledStub = makeStub(async () => {});
    __setRouterTestOverrides({
      runGuards: guardStub.fn,
      handleMedia: mediaStub.fn,
      handleList: listStub.fn,
      handleButton: buttonStub.fn,
      handleLocation: locationStub.fn,
      handleText: textStub.fn,
      logUnhandled: unhandledStub.fn,
    });
    try {
      await handleMessage(ctx, { type: "text" }, state);
      assertEquals(mediaStub.calls.length, 0);
      assertEquals(textStub.calls.length, 0);
      assertEquals(unhandledStub.calls.length, 0);
    } finally {
      __resetRouterTestOverrides();
    }
  },
});

Deno.test({
  name: "handleMessage routes text payloads",
  async fn() {
    const guardStub = makeStub(async () => false);
    const mediaStub = makeStub(async () => false);
    const listStub = makeStub(async () => false);
    const buttonStub = makeStub(async () => false);
    const locationStub = makeStub(async () => false);
    const textStub = makeStub(async () => true);
    const unhandledStub = makeStub(async () => {});
    __setRouterTestOverrides({
      runGuards: guardStub.fn,
      handleMedia: mediaStub.fn,
      handleList: listStub.fn,
      handleButton: buttonStub.fn,
      handleLocation: locationStub.fn,
      handleText: textStub.fn,
      logUnhandled: unhandledStub.fn,
    });
    try {
      await handleMessage(
        ctx,
        { type: "text", text: { body: "hello" } },
        state,
      );
      assertEquals(textStub.calls.length, 1);
      assertEquals(unhandledStub.calls.length, 0);
    } finally {
      __resetRouterTestOverrides();
    }
  },
});

Deno.test({
  name: "handleMessage routes interactive list replies",
  async fn() {
    const stubs = {
      runGuards: makeStub(async () => false),
      handleMedia: makeStub(async () => false),
      handleList: makeStub(async () => true),
      handleButton: makeStub(async () => false),
      handleLocation: makeStub(async () => false),
      handleText: makeStub(async () => false),
      logUnhandled: makeStub(async () => {}),
    };
    __setRouterTestOverrides({
      runGuards: stubs.runGuards.fn,
      handleMedia: stubs.handleMedia.fn,
      handleList: stubs.handleList.fn,
      handleButton: stubs.handleButton.fn,
      handleLocation: stubs.handleLocation.fn,
      handleText: stubs.handleText.fn,
      logUnhandled: stubs.logUnhandled.fn,
    });
    try {
      await handleMessage(
        ctx,
        {
          type: "interactive",
          interactive: { type: "list_reply", list_reply: { id: "option" } },
        },
        state,
      );
      assertEquals(stubs.handleList.calls.length, 1);
      assertEquals(stubs.logUnhandled.calls.length, 0);
    } finally {
      __resetRouterTestOverrides();
    }
  },
});

Deno.test({
  name: "handleMessage logs unhandled types",
  async fn() {
    const stubs = {
      runGuards: makeStub(async () => false),
      handleMedia: makeStub(async () => false),
      handleList: makeStub(async () => false),
      handleButton: makeStub(async () => false),
      handleLocation: makeStub(async () => false),
      handleText: makeStub(async () => false),
      logUnhandled: makeStub(async () => {}),
    };
    __setRouterTestOverrides({
      runGuards: stubs.runGuards.fn,
      handleMedia: stubs.handleMedia.fn,
      handleList: stubs.handleList.fn,
      handleButton: stubs.handleButton.fn,
      handleLocation: stubs.handleLocation.fn,
      handleText: stubs.handleText.fn,
      logUnhandled: stubs.logUnhandled.fn,
    });
    try {
      await handleMessage(ctx, { type: "unsupported" }, state);
      assertEquals(stubs.logUnhandled.calls.length, 1);
    } finally {
      __resetRouterTestOverrides();
    }
  },
});
