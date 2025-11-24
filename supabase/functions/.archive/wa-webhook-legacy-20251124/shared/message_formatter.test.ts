/**
 * Unit Tests for Message Formatter
 * 
 * Run with: deno test wa-webhook/shared/message_formatter.test.ts --allow-env
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";
import {
  formatEmojiList,
  parseEmojiSelection,
  formatMessageWithButtons,
  shouldUseFallbackFlow,
  createListMessage,
  validateActionButtons,
  isSelectionMessage,
  getSelectionHelpText,
  type ListOption,
  type ActionButton,
} from "./message_formatter.ts";

Deno.test("formatEmojiList - formats options with emoji numbers", () => {
  const options: ListOption[] = [
    { id: "1", title: "Option A", description: "Description A" },
    { id: "2", title: "Option B", description: "Description B" },
    { id: "3", title: "Option C" },
  ];

  const result = formatEmojiList(options);

  assertEquals(result.includes("1️⃣ Option A"), true);
  assertEquals(result.includes("2️⃣ Option B"), true);
  assertEquals(result.includes("3️⃣ Option C"), true);
  assertEquals(result.includes("Description A"), true);
  assertEquals(result.includes("Description B"), true);
});

Deno.test("formatEmojiList - limits to max options", () => {
  const options: ListOption[] = Array.from({ length: 15 }, (_, i) => ({
    id: String(i + 1),
    title: `Option ${i + 1}`,
  }));

  const result = formatEmojiList(options, 5);
  
  assertEquals(result.includes("1️⃣"), true);
  assertEquals(result.includes("5️⃣"), true);
  assertEquals(result.includes("6️⃣"), false);
});

Deno.test("parseEmojiSelection - parses plain numbers", () => {
  assertEquals(parseEmojiSelection("1", 5), 1);
  assertEquals(parseEmojiSelection("2", 5), 2);
  assertEquals(parseEmojiSelection("5", 5), 5);
  assertEquals(parseEmojiSelection("6", 5), null); // Out of range
  assertEquals(parseEmojiSelection("0", 5), null); // Invalid
});

Deno.test("parseEmojiSelection - parses emoji numbers", () => {
  assertEquals(parseEmojiSelection("1️⃣", 5), 1);
  assertEquals(parseEmojiSelection("2️⃣", 5), 2);
  assertEquals(parseEmojiSelection("3️⃣", 5), 3);
});

Deno.test("parseEmojiSelection - parses text numbers", () => {
  assertEquals(parseEmojiSelection("one", 5), 1);
  assertEquals(parseEmojiSelection("two", 5), 2);
  assertEquals(parseEmojiSelection("first", 5), 1);
  assertEquals(parseEmojiSelection("second", 5), 2);
  assertEquals(parseEmojiSelection("third", 5), 3);
});

Deno.test("parseEmojiSelection - parses phrases", () => {
  assertEquals(parseEmojiSelection("option 1", 5), 1);
  assertEquals(parseEmojiSelection("number 2", 5), 2);
  assertEquals(parseEmojiSelection("the first one", 5), 1);
  assertEquals(parseEmojiSelection("I want the second option", 5), 2);
});

Deno.test("parseEmojiSelection - returns null for invalid input", () => {
  assertEquals(parseEmojiSelection("invalid", 5), null);
  assertEquals(parseEmojiSelection("hello", 5), null);
  assertEquals(parseEmojiSelection("", 5), null);
});

Deno.test("formatMessageWithButtons - formats message with buttons", () => {
  const buttons: ActionButton[] = [
    { id: "btn1", title: "Button 1" },
    { id: "btn2", title: "Button 2" },
  ];

  const result = formatMessageWithButtons("Test message", buttons);

  assertEquals(result.text, "Test message");
  assertEquals(result.buttons.length, 2);
  assertEquals(result.buttons[0].id, "btn1");
  assertEquals(result.buttons[1].title, "Button 2");
});

Deno.test("formatMessageWithButtons - limits to 3 buttons", () => {
  const buttons: ActionButton[] = [
    { id: "btn1", title: "Button 1" },
    { id: "btn2", title: "Button 2" },
    { id: "btn3", title: "Button 3" },
    { id: "btn4", title: "Button 4" },
  ];

  const result = formatMessageWithButtons("Test", buttons);

  assertEquals(result.buttons.length, 3);
});

Deno.test("shouldUseFallbackFlow - detects explicit menu request", () => {
  const context: any = {
    currentMessage: "show me the menu",
    sessionData: {},
  };

  assertEquals(shouldUseFallbackFlow(context, "waiter"), true);
});

Deno.test("shouldUseFallbackFlow - detects list request", () => {
  const context: any = {
    currentMessage: "give me a list of options",
    sessionData: {},
  };

  assertEquals(shouldUseFallbackFlow(context, "waiter"), true);
});

Deno.test("shouldUseFallbackFlow - detects insurance vehicle details", () => {
  const context: any = {
    currentMessage: "I need insurance",
    sessionData: { stage: "vehicle_details" },
  };

  assertEquals(shouldUseFallbackFlow(context, "insurance"), true);
});

Deno.test("shouldUseFallbackFlow - detects low engagement", () => {
  const context: any = {
    currentMessage: "hello",
    sessionData: { chat_attempts: 3, chat_engaged: false },
  };

  assertEquals(shouldUseFallbackFlow(context, "waiter"), true);
});

Deno.test("shouldUseFallbackFlow - respects force_flow_mode flag", () => {
  const context: any = {
    currentMessage: "hello",
    sessionData: { force_flow_mode: true },
  };

  assertEquals(shouldUseFallbackFlow(context, "waiter"), true);
});

Deno.test("shouldUseFallbackFlow - returns false for normal chat", () => {
  const context: any = {
    currentMessage: "I'm looking for a restaurant",
    sessionData: {},
  };

  assertEquals(shouldUseFallbackFlow(context, "waiter"), false);
});

Deno.test("createListMessage - creates complete formatted message", () => {
  const options: ListOption[] = [
    { id: "1", title: "Restaurant A", description: "Italian" },
    { id: "2", title: "Restaurant B", description: "Japanese" },
  ];

  const buttons: ActionButton[] = [
    { id: "back", title: "🏠 Home" },
  ];

  const result = createListMessage(
    "🍽️ Found 2 restaurants:",
    options,
    "Reply with a number!",
    buttons
  );

  assertEquals(result.text.includes("🍽️ Found 2 restaurants:"), true);
  assertEquals(result.text.includes("1️⃣ Restaurant A"), true);
  assertEquals(result.text.includes("2️⃣ Restaurant B"), true);
  assertEquals(result.text.includes("Reply with a number!"), true);
  assertEquals(result.buttons.length, 1);
  assertEquals(result.optionsCount, 2);
});

Deno.test("validateActionButtons - truncates to 3 buttons", () => {
  const buttons: ActionButton[] = [
    { id: "1", title: "Button 1" },
    { id: "2", title: "Button 2" },
    { id: "3", title: "Button 3" },
    { id: "4", title: "Button 4" },
  ];

  const result = validateActionButtons(buttons);

  assertEquals(result.length, 3);
});

Deno.test("validateActionButtons - truncates long titles", () => {
  const buttons: ActionButton[] = [
    { id: "1", title: "This is a very long button title that exceeds 20 characters" },
  ];

  const result = validateActionButtons(buttons);

  assertEquals(result[0].title.length, 20);
});

Deno.test("isSelectionMessage - detects valid selection", () => {
  assertEquals(isSelectionMessage("1", 5), true);
  assertEquals(isSelectionMessage("2️⃣", 5), true);
  assertEquals(isSelectionMessage("the first one", 5), true);
});

Deno.test("isSelectionMessage - rejects invalid selection", () => {
  assertEquals(isSelectionMessage("hello", 5), false);
  assertEquals(isSelectionMessage("6", 5), false);
  assertEquals(isSelectionMessage("", 0), false);
});

Deno.test("getSelectionHelpText - provides appropriate help", () => {
  const help3 = getSelectionHelpText(3);
  assertEquals(help3.includes("1, 2, or 3"), true);

  const help5 = getSelectionHelpText(5);
  assertEquals(help5.includes("1-5"), true);

  const help10 = getSelectionHelpText(10);
  assertEquals(help10.includes("1-10"), true);
  assertEquals(help10.includes("describe"), true);
});
