# Dialogflow CX Flow Map - EasyMo Cold Caller

## Overview
This agent uses a "Stream-to-Webhook" pattern. Dialogflow handles the Telephony audio (Speech-to-Text and Text-to-Speech), while the logic and conversation generation are offloaded entirely to Gemini 3 Pro via a Cloud Run webhook.

## 1. Default Start Flow
*   **Start Page:**
    *   **Event:** `sys.no-match-default` (Catch-all for initial silence or noise)
    *   **Event:** `WELCOME` (Triggered by SIP trunk connection)
    *   **Route:** Always transitions to **Page: Gateway**.

*   **Page: Gateway**
    *   **Entry Fulfillment:** Call Webhook (`init_call_session`).
    *   **Webhook Action:**
        *   Retrieves target lead data from Firestore.
        *   Generates opening line using Gemini (e.g., "Hello, is this [Name]? I'm calling from EasyMo...").
    *   **Route:** Transition to **Page: Conversation Loop**.

## 2. Page: Conversation Loop
This is the single page where the entire conversation happens, relying on Gemini's context window.

*   **Parameters:**
    *   `$session.params.user_utterance` (Captured input)

*   **Routes:**
    1.  **Intent:** `sys.no-input` (User is silent)
        *   **Webhook:** Call `handle_silence`.
        *   **Gemini Action:** "Are you still there?" or gently nudge.
    2.  **Intent:** `end_call` (User says "bye", "not interested", "hang up")
        *   **Webhook:** Call `finalize_call`.
        *   **Transition:** **Page: End Session**.
    3.  **Condition:** `true` (Catch-all for user speech)
        *   **Webhook:** Call `process_turn` (Main Logic).
        *   **Payload:** Sends transcript + conversation history to Gemini 3 Pro.
        *   **Response:** Returns Gemini's text to be spoken via TTS.

## 3. Page: End Session
*   **Entry Fulfillment:** "Thank you for your time. Have a great day."
*   **Webhook:** Async trigger to log analytics to BigQuery and update Lead Status in Firestore.
*   **End Flow.**