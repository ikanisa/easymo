import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import {
  getButtonReplyId,
  getListReplyId,
  getTextBody,
  isInteractiveButtonMessage,
  isInteractiveListMessage,
  isLocationMessage,
  isMediaMessage,
  isTextMessage,
} from "./messages.ts";
import type {
  WhatsAppInteractiveButtonMessage,
  WhatsAppInteractiveListMessage,
  WhatsAppLocationMessage,
  WhatsAppMediaMessage,
  WhatsAppMessage,
  WhatsAppTextMessage,
} from "../types.ts";

const base = {
  id: "wamid.1",
  from: "250700000000",
} as const;

Deno.test("isTextMessage narrows text payloads", () => {
  const textMsg: WhatsAppTextMessage = { ...base, type: "text", text: { body: "hello" } };
  assertEquals(isTextMessage(textMsg), true);
  const notText = { ...base, type: "image", image: {} } as WhatsAppMessage;
  assertEquals(isTextMessage(notText), false);
  const malformed = { ...base, type: "text", text: 123 } as unknown as WhatsAppMessage;
  assertEquals(isTextMessage(malformed), false);
});

Deno.test("isInteractiveButtonMessage recognises button replies", () => {
  const buttonMsg: WhatsAppInteractiveButtonMessage = {
    ...base,
    type: "interactive",
    interactive: { type: "button_reply", button_reply: { id: "ok" } },
  };
  assertEquals(isInteractiveButtonMessage(buttonMsg), true);
  const listMsg: WhatsAppInteractiveListMessage = {
    ...base,
    type: "interactive",
    interactive: { type: "list_reply", list_reply: { id: "row" } },
  };
  assertEquals(isInteractiveButtonMessage(listMsg), false);
  const malformed = {
    ...base,
    type: "interactive",
    interactive: { type: "button_reply", button_reply: null },
  } as unknown as WhatsAppMessage;
  assertEquals(isInteractiveButtonMessage(malformed), false);
});

Deno.test("isInteractiveListMessage recognises list replies", () => {
  const listMsg: WhatsAppInteractiveListMessage = {
    ...base,
    type: "interactive",
    interactive: { type: "list_reply", list_reply: { id: "row" } },
  };
  assertEquals(isInteractiveListMessage(listMsg), true);
  const buttonMsg: WhatsAppInteractiveButtonMessage = {
    ...base,
    type: "interactive",
    interactive: { type: "button_reply", button_reply: { id: "ok" } },
  };
  assertEquals(isInteractiveListMessage(buttonMsg), false);
  const malformed = {
    ...base,
    type: "interactive",
    interactive: { type: "list_reply", list_reply: null },
  } as unknown as WhatsAppMessage;
  assertEquals(isInteractiveListMessage(malformed), false);
});

Deno.test("isLocationMessage validates coordinates payload", () => {
  const locationMsg: WhatsAppLocationMessage = {
    ...base,
    type: "location",
    location: { latitude: "1.23", longitude: "4.56" },
  };
  assertEquals(isLocationMessage(locationMsg), true);
  const malformed = { ...base, type: "location", location: 123 } as unknown as WhatsAppMessage;
  assertEquals(isLocationMessage(malformed), false);
});

Deno.test("isMediaMessage recognises image and document payloads", () => {
  const imageMsg: WhatsAppMediaMessage = { ...base, type: "image", image: { id: "media" } };
  assertEquals(isMediaMessage(imageMsg), true);
  const docMsg: WhatsAppMediaMessage = { ...base, type: "document", document: { id: "doc" } };
  assertEquals(isMediaMessage(docMsg), true);
  const malformed = { ...base, type: "document", document: 123 } as unknown as WhatsAppMessage;
  assertEquals(isMediaMessage(malformed), false);
  assertEquals(isMediaMessage({ ...base, type: "text", text: { body: "hi" } }), false);
});

Deno.test("getTextBody trims and validates text payloads", () => {
  const textMsg: WhatsAppTextMessage = { ...base, type: "text", text: { body: "  Hello  " } };
  assertEquals(getTextBody(textMsg), "Hello");
  const empty: WhatsAppTextMessage = { ...base, type: "text", text: { body: "   " } };
  assertEquals(getTextBody(empty), null);
  const missing = { ...base, type: "text" } as unknown as WhatsAppTextMessage;
  assertEquals(getTextBody(missing), null);
});

Deno.test("getButtonReplyId normalises button reply identifiers", () => {
  const msg: WhatsAppInteractiveButtonMessage = {
    ...base,
    type: "interactive",
    interactive: { type: "button_reply", button_reply: { id: " back_home " } },
  };
  assertEquals(getButtonReplyId(msg), "back_home");
  const missing: WhatsAppInteractiveButtonMessage = {
    ...base,
    type: "interactive",
    interactive: { type: "button_reply", button_reply: { id: "   " } },
  } as any;
  assertEquals(getButtonReplyId(missing as any), null);
});

Deno.test("getListReplyId normalises list reply identifiers", () => {
  const msg: WhatsAppInteractiveListMessage = {
    ...base,
    type: "interactive",
    interactive: { type: "list_reply", list_reply: { id: " item-1 " } },
  };
  assertEquals(getListReplyId(msg), "item-1");
  const malformed = {
    ...base,
    type: "interactive",
    interactive: { type: "list_reply", list_reply: null },
  };
  assertEquals(getListReplyId(malformed as any), null);
});
