import { assertEquals } from "../deps/asserts.ts";
import { stub } from "../deps/mock.ts";
import { handleMessage } from "../../supabase/functions/wa-webhook/router/router.ts";
import * as guards from "../../supabase/functions/wa-webhook/router/guards.ts";
import * as media from "../../supabase/functions/wa-webhook/router/media.ts";
import * as list from "../../supabase/functions/wa-webhook/router/interactive_list.ts";
import * as button from "../../supabase/functions/wa-webhook/router/interactive_button.ts";
import * as location from "../../supabase/functions/wa-webhook/router/location.ts";
import * as text from "../../supabase/functions/wa-webhook/router/text.ts";
import * as logging from "../../supabase/functions/wa-webhook/observe/logging.ts";

const ctx = {
  supabase: {} as never,
  from: "+250700000000",
  profileId: crypto.randomUUID(),
};

const state = { data: {} } as any;

function reset(stubs: Array<{ restore: () => void }>) {
  for (const stubRef of stubs) {
    try {
      stubRef.restore();
    } catch (_) {
      // ignore
    }
  }
}

Deno.test({
  name: "handleMessage short-circuits when guard passes",
  async fn() {
    const guardStub = stub(guards, "runGuards", async () => true);
    const mediaStub = stub(media, "handleMedia", async () => false);
    const listStub = stub(list, "handleList", async () => false);
    const buttonStub = stub(button, "handleButton", async () => false);
    const locationStub = stub(location, "handleLocation", async () => false);
    const textStub = stub(text, "handleText", async () => false);
    const unhandledStub = stub(logging, "logUnhandled", async () => {});
    try {
      await handleMessage(ctx, { type: "text" }, state);
      assertEquals(mediaStub.calls.length, 0);
      assertEquals(textStub.calls.length, 0);
      assertEquals(unhandledStub.calls.length, 0);
    } finally {
      reset([
        guardStub,
        mediaStub,
        listStub,
        buttonStub,
        locationStub,
        textStub,
        unhandledStub,
      ]);
    }
  },
});

Deno.test({
  name: "handleMessage routes text payloads",
  async fn() {
    const guardStub = stub(guards, "runGuards", async () => false);
    const mediaStub = stub(media, "handleMedia", async () => false);
    const listStub = stub(list, "handleList", async () => false);
    const buttonStub = stub(button, "handleButton", async () => false);
    const locationStub = stub(location, "handleLocation", async () => false);
    const textStub = stub(text, "handleText", async () => true);
    const unhandledStub = stub(logging, "logUnhandled", async () => {});
    try {
      await handleMessage(
        ctx,
        { type: "text", text: { body: "hello" } },
        state,
      );
      assertEquals(textStub.calls.length, 1);
      assertEquals(unhandledStub.calls.length, 0);
    } finally {
      reset([
        guardStub,
        mediaStub,
        listStub,
        buttonStub,
        locationStub,
        textStub,
        unhandledStub,
      ]);
    }
  },
});

Deno.test({
  name: "handleMessage routes interactive list replies",
  async fn() {
    const stubs = [
      stub(guards, "runGuards", async () => false),
      stub(media, "handleMedia", async () => false),
      stub(list, "handleList", async () => true),
      stub(button, "handleButton", async () => false),
      stub(location, "handleLocation", async () => false),
      stub(text, "handleText", async () => false),
      stub(logging, "logUnhandled", async () => {}),
    ];
    try {
      await handleMessage(
        ctx,
        {
          type: "interactive",
          interactive: { type: "list_reply", list_reply: { id: "option" } },
        },
        state,
      );
      assertEquals(stubs[2].calls.length, 1);
      assertEquals(stubs[6].calls.length, 0);
    } finally {
      reset(stubs);
    }
  },
});

Deno.test({
  name: "handleMessage logs unhandled types",
  async fn() {
    const stubs = [
      stub(guards, "runGuards", async () => false),
      stub(media, "handleMedia", async () => false),
      stub(list, "handleList", async () => false),
      stub(button, "handleButton", async () => false),
      stub(location, "handleLocation", async () => false),
      stub(text, "handleText", async () => false),
      stub(logging, "logUnhandled", async () => {}),
    ];
    try {
      await handleMessage(ctx, { type: "unsupported" }, state);
      assertEquals(stubs[6].calls.length, 1);
    } finally {
      reset(stubs);
    }
  },
});
