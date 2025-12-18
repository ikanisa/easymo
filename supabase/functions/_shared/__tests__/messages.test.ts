/**
 * Message Utils Tests
 * Tests for WhatsApp message utilities
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import {
  isTextMessage,
  isInteractiveButtonMessage,
  isInteractiveListMessage,
  isLocationMessage,
  isMediaMessage,
  getTextBody,
  getButtonReplyId,
  getListReplyId,
} from "../wa-webhook-shared/utils/messages.ts";
import type {
  WhatsAppTextMessage,
  WhatsAppInteractiveButtonMessage,
  WhatsAppInteractiveListMessage,
  WhatsAppLocationMessage,
  WhatsAppMessage,
} from "../wa-webhook-shared/types.ts";

describe("Message Utils", () => {
  describe("isTextMessage", () => {
    it("should identify text message", () => {
      const msg: WhatsAppMessage = {
        type: "text",
        from: "+250788123456",
        id: "msg-123",
        timestamp: "1234567890",
        text: { body: "Hello" },
      };
      assertEquals(isTextMessage(msg), true);
    });

    it("should reject non-text message", () => {
      const msg: WhatsAppMessage = {
        type: "image",
        from: "+250788123456",
        id: "msg-123",
        timestamp: "1234567890",
      };
      assertEquals(isTextMessage(msg), false);
    });
  });

  describe("isInteractiveButtonMessage", () => {
    it("should identify button message", () => {
      const msg: WhatsAppMessage = {
        type: "interactive",
        from: "+250788123456",
        id: "msg-123",
        timestamp: "1234567890",
        interactive: {
          type: "button_reply",
          button_reply: { id: "btn-1", title: "Click" },
        },
      };
      assertEquals(isInteractiveButtonMessage(msg), true);
    });

    it("should reject list message", () => {
      const msg: WhatsAppMessage = {
        type: "interactive",
        from: "+250788123456",
        id: "msg-123",
        timestamp: "1234567890",
        interactive: {
          type: "list_reply",
          list_reply: { id: "list-1", title: "Item" },
        },
      };
      assertEquals(isInteractiveButtonMessage(msg), false);
    });
  });

  describe("getTextBody", () => {
    it("should extract text body", () => {
      const msg: WhatsAppTextMessage = {
        type: "text",
        from: "+250788123456",
        id: "msg-123",
        timestamp: "1234567890",
        text: { body: "Hello World" },
      };
      assertEquals(getTextBody(msg), "Hello World");
    });

    it("should trim whitespace", () => {
      const msg: WhatsAppTextMessage = {
        type: "text",
        from: "+250788123456",
        id: "msg-123",
        timestamp: "1234567890",
        text: { body: "  Hello  " },
      };
      assertEquals(getTextBody(msg), "Hello");
    });

    it("should return null for empty", () => {
      const msg: WhatsAppTextMessage = {
        type: "text",
        from: "+250788123456",
        id: "msg-123",
        timestamp: "1234567890",
        text: { body: "   " },
      };
      assertEquals(getTextBody(msg), null);
    });
  });

  describe("getButtonReplyId", () => {
    it("should extract button ID", () => {
      const msg: WhatsAppInteractiveButtonMessage = {
        type: "interactive",
        from: "+250788123456",
        id: "msg-123",
        timestamp: "1234567890",
        interactive: {
          type: "button_reply",
          button_reply: { id: "btn-123", title: "Click" },
        },
      };
      assertEquals(getButtonReplyId(msg), "btn-123");
    });
  });
});

