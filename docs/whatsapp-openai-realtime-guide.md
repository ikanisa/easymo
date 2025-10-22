# WhatsApp Calling ↔ OpenAI Realtime Voice Agent Integration

This document captures the production-ready blueprint for wiring Direct Meta (WhatsApp Cloud API) Calling to the OpenAI Realtime WebRTC agent that powers Easymo voice experiences. The goal is to enable fully interactive inbound and outbound WhatsApp calls that are handled end-to-end by an OpenAI voice agent, with complete observability and persistence inside the existing NestJS + Supabase stack.

## 1. High-Level Overview

- **Objective:** Accept and place WhatsApp VoIP calls, bridge audio streams to an OpenAI Realtime (WebRTC) agent, and execute follow-up workflows through the Responses API (gpt-5).
- **Scope:** Only approved, purpose-bound business use-cases (sales/support). No general chatbots in line with Meta's 2026 policy update.
- **Key Components:**
  - WhatsApp Cloud API with Calling enabled on the business phone number.
  - `wa-rtc-gateway` Node service that bridges WhatsApp ⇄ OpenAI audio via mediasoup/Janus/LiveKit.
  - `agent-core` (NestJS) orchestrating OpenAI Responses API tool calls (e.g., `upsertLead`, `scheduleFollowUp`).
  - Supabase tables for call state, transcripts, call events, and leads.

## 2. Prerequisites

1. **WhatsApp Business Account (WABA) & Number**
   - Phone number must be approved for Cloud API Calling.
   - Register webhook app with calling subscription and set `WA_VERIFY_TOKEN`.
2. **Compliance**
   - Ensure purpose-bound agent behaviour with documented opt-ins and consent records.
   - Follow policy prohibiting general-purpose chatbots effective January 15, 2026.
3. **OpenAI Access**
   - API key with Realtime (WebRTC) entitlement.
   - Models: `gpt-5` (tooling) and `gpt-5-realtime-preview` (voice agent).
4. **Infrastructure**
   - Mediasoup/Janus/LiveKit-capable server with public IP for WebRTC relay.
   - Supabase project configured with required tables.

## 3. Architecture

```
WhatsApp User
    ⇅ WebRTC (Opus)
WA-RTC Gateway (Node + mediasoup/Janus/LiveKit)
    ⇅ WebRTC (Opus)
OpenAI Realtime (gpt-5-realtime-preview) ←→ Responses API (gpt-5, tools)
                                      └── Supabase (calls, transcripts, leads)
```

- **wa-rtc-gateway**
  - Terminates the WhatsApp WebRTC leg.
  - Establishes second WebRTC leg with OpenAI Realtime.
  - Forwards audio bidirectionally and handles call lifecycle webhooks.
- **agent-core (NestJS)**
  - Runs the Responses API, executes Supabase tool actions, and streams structured results.
- **Supabase**
  - Persists call metadata, transcripts, events, and lead data.

## 4. Call Flows

1. **Business-Initiated (Outbound)**
   - Gateway issues SDP offer to WhatsApp Cloud API.
   - `call.connect` webhook returns SDP answer.
   - Gateway completes handshake and starts media immediately.
2. **User-Initiated (Inbound)**
   - Gateway receives SDP offer via webhook.
   - Generate SDP answer through mediasoup/Janus and return per regional flow.
3. **ICE Candidates**
   - Handle optional trickle ICE events for connectivity updates.
4. **Call Termination**
   - `call.ended` webhook triggers resource cleanup and Supabase status update.

## 5. Webhook Handling

- **GET `/wa/webhook`**: Echo `hub.challenge` after verifying `hub.verify_token`.
- **POST `/wa/webhook`**:
  - Parse entries and filter for calling events.
  - Verify `X-Hub-Signature-256` via HMAC SHA-256 with `WA_APP_SECRET`.
  - On SDP offer/answer events, invoke mediasoup/Janus helpers to create/consume transports.
  - Persist events in Supabase (`call_events`).

## 6. Media Pipeline (mediasoup reference)

1. Create router with Opus codec @ 48 kHz stereo.
2. Create dual transports for WhatsApp and AI legs (send/receive each).
3. When SDP is exchanged:
   - Map ICE + DTLS parameters onto the respective transports.
   - Produce/consume audio tracks between legs:
     - User → AI: `waRecv` producer → `aiSend` consumer → OpenAI track.
     - AI → User: OpenAI track → `waSend` producer.
4. Maintain Opus throughout to avoid transcoding.
5. Prepare OpenAI peer connection before acknowledging WhatsApp to avoid timeout.

## 7. OpenAI Realtime Session

- Establish WebRTC peer connection to OpenAI Realtime endpoint.
- Send `session.update` payload:

```json
{
  "type": "session.update",
  "session": {
    "model": "gpt-5-realtime-preview",
    "voice": "verse",
    "turn_detection": {
      "type": "server_vad",
      "threshold": 0.5,
      "prefix_padding_ms": 80,
      "silence_duration_ms": 220
    },
    "input_audio_transcription": { "enabled": true }
  }
}
```

- Enable transcription for Supabase logging.
- Use Responses API (`gpt-5`) for tool invocation and stateful orchestration.

## 8. Agent Tools & Workflows

- Tools accessible via Responses API or NestJS actions:
  - `upsertLead` → write leads to Supabase.
  - `scheduleFollowUp` → manage reminders/tasks.
  - `logOutcome` → capture disposition.
- Tool execution pipeline:
  1. Realtime model emits tool call request.
  2. `wa-rtc-gateway` posts payload to `agent-core`.
  3. `agent-core` executes business logic and responds via `runs.submitToolOutputs`.

## 9. Supabase Data Model

- `calls`: `id`, `wacid`, `direction`, `status`, timestamps.
- `transcripts`: `call_id`, `speaker`, `text`, `sequence`.
- `call_events`: raw webhook payload snapshots, error logs.
- `leads`: upserted lead data referencing `call_id`.

## 10. Security & Compliance

- Validate every webhook signature before processing.
- Keep Meta access tokens and OpenAI keys server-side only.
- Record consent for outbound calls and potential recording (respect local law).
- Enforce purpose-bound prompts to align with Meta 2026 policy changes.

## 11. Observability & Resilience

- Metrics: call setup time, AI time-to-first-byte, barge-in count, ASR coverage, tool latency.
- Logs: SDP direction (offer/answer), call events, tool I/O, errors with `call_id` context.
- Retry strategy: attempt one Realtime reconnection on failure; otherwise end call gracefully.

## 12. Testing Checklist

1. Webhook verification handshake.
2. Outbound (business-initiated) call establishing bidirectional media.
3. Inbound (user-initiated) call acceptance and audio flow.
4. Tool invocation resulting in Supabase `leads` row.
5. Transcript capture for both user and assistant.
6. Hangup sequence that closes transports and updates status to `completed`.

## 13. Deployment Notes

- Define environment variables in `apps/wa-rtc-gateway/.env` (see prerequisites).
- Expose gateway HTTP port (default 4000) plus mediasoup UDP/TCP ports.
- Deploy to infrastructure close to both Meta and OpenAI POPs to minimise latency.
- Ensure CI/CD enforces linting/tests for new gateway service.
- For self-hosted deployment of the existing frontend, ensure backend endpoints remain accessible via secure networking (e.g., HTTPS tunnel or private connectivity).

## 14. Future Enhancements

- Agent Builder integration with purpose-bound prompt and HTTPS actions.
- SIP/PSTN fallback via Twilio if non-WhatsApp voice channels are desired.
- Automated DNC handling using Supabase policies.
- Enhanced analytics dashboard showing call outcomes and lead funnels.

---

**Responsibility Matrix**

| Team        | Responsibility                                                    |
|-------------|------------------------------------------------------------------|
| Voice Infra | Operate `wa-rtc-gateway`, ensure low-latency WebRTC bridging.     |
| AI Platform | Maintain OpenAI Realtime configuration and agent prompts/tools.   |
| Backend     | Build/maintain `agent-core` NestJS services + Supabase schema.    |
| Compliance  | Track opt-ins, consent, and Meta policy alignment.                |
| QA          | Execute end-to-end testing checklist before each release.        |

