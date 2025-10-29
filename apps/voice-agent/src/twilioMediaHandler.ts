import { WebSocket } from "ws";
import { logger, logStructuredEvent } from "./logger.js";
import { RealtimeSession, closeRealtimeSession } from "./realtimeSession.js";
import { decodeUlaw, resample8kTo16k } from "./transcode.js";
import { persistCallEvent } from "./supabaseClient.js";

export interface CallMetadata {
  callSid: string;
  from: string;
  to: string;
  direction: string;
  correlationId: string;
}

/**
 * Handle Twilio media stream and bridge to OpenAI Realtime.
 * 
 * This function:
 * 1. Receives Twilio media messages (μ-law encoded audio)
 * 2. Decodes and resamples to PCM16 16kHz
 * 3. Sends to OpenAI Realtime via input_audio_buffer.append
 * 4. Handles Realtime responses and sends back to Twilio
 */
export async function handleTwilioMediaStream(
  twilioWs: WebSocket,
  realtimeSession: RealtimeSession,
  metadata: CallMetadata,
): Promise<void> {
  const { callSid, correlationId, from, to, direction } = metadata;
  const { ws: realtimeWs } = realtimeSession;

  let streamSid: string | null = null;
  let callStarted = false;

  // Handle Twilio messages
  twilioWs.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.event) {
        case "start":
          streamSid = message.start?.streamSid;
          callStarted = true;

          logger.info({
            msg: "twilio.stream.start",
            correlationId,
            callSid,
            streamSid,
          });

          // Persist call start event
          await persistCallEvent(callSid, "start", {
            from,
            to,
            direction,
            streamSid,
          });

          logStructuredEvent("CALL_STARTED", {
            correlationId,
            callSid,
            direction,
          });
          break;

        case "media":
          if (message.media?.payload) {
            // Decode μ-law to PCM16
            const ulawData = Buffer.from(message.media.payload, "base64");
            const pcm8k = decodeUlaw(ulawData);

            // Resample 8kHz to 16kHz
            const pcm16k = resample8kTo16k(pcm8k);

            // Convert to base64 for OpenAI
            const pcm16kBase64 = pcm16k.toString("base64");

            // Send to OpenAI Realtime
            if (realtimeWs.readyState === WebSocket.OPEN) {
              realtimeWs.send(
                JSON.stringify({
                  type: "input_audio_buffer.append",
                  audio: pcm16kBase64,
                }),
              );
            }
          }
          break;

        case "stop":
          logger.info({
            msg: "twilio.stream.stop",
            correlationId,
            callSid,
            streamSid,
          });

          // Commit audio buffer and request response
          if (realtimeWs.readyState === WebSocket.OPEN) {
            realtimeWs.send(
              JSON.stringify({
                type: "input_audio_buffer.commit",
              }),
            );

            realtimeWs.send(
              JSON.stringify({
                type: "response.create",
                response: {
                  modalities: ["audio", "text"],
                },
              }),
            );
          }

          // Persist call end event
          await persistCallEvent(callSid, "stop", {
            streamSid,
          });

          logStructuredEvent("CALL_ENDED", {
            correlationId,
            callSid,
          });

          // Close sessions
          setTimeout(() => {
            closeRealtimeSession(realtimeSession);
            if (twilioWs.readyState === WebSocket.OPEN) {
              twilioWs.close();
            }
          }, 1000);
          break;

        case "mark":
          // Mark events are used for synchronization
          logger.debug({
            msg: "twilio.stream.mark",
            correlationId,
            callSid,
            mark: message.mark,
          });
          break;

        default:
          logger.debug({
            msg: "twilio.stream.unknown_event",
            correlationId,
            callSid,
            event: message.event,
          });
      }
    } catch (error) {
      logger.error({
        msg: "twilio.stream.error",
        correlationId,
        callSid,
        error: (error as Error).message,
      });
    }
  });

  // Handle OpenAI Realtime messages
  realtimeWs.on("message", async (data) => {
    try {
      const event = JSON.parse(data.toString());

      switch (event.type) {
        case "session.created":
        case "session.updated":
          logger.info({
            msg: "realtime.session.event",
            correlationId,
            callSid,
            type: event.type,
          });
          break;

        case "response.audio.delta":
        case "response.output_audio.delta":
          // Send audio back to Twilio
          if (event.delta && twilioWs.readyState === WebSocket.OPEN) {
            twilioWs.send(
              JSON.stringify({
                event: "media",
                streamSid,
                media: {
                  payload: event.delta,
                },
              }),
            );
          }
          break;

        case "response.audio.done":
        case "response.output_audio.done":
          logger.debug({
            msg: "realtime.audio.complete",
            correlationId,
            callSid,
          });
          break;

        case "response.text.delta":
        case "response.output_text.delta":
          // Log transcript
          await persistCallEvent(callSid, "transcript", {
            role: "assistant",
            content: event.delta,
          });
          break;

        case "input_audio_buffer.speech_started":
          logger.debug({
            msg: "realtime.speech.started",
            correlationId,
            callSid,
          });
          break;

        case "input_audio_buffer.speech_stopped":
          logger.debug({
            msg: "realtime.speech.stopped",
            correlationId,
            callSid,
          });
          break;

        case "conversation.item.input_audio_transcription.completed":
        case "input_audio_transcription.completed":
          // Log user transcript
          if (event.transcript) {
            await persistCallEvent(callSid, "transcript", {
              role: "user",
              content: event.transcript,
            });

            logStructuredEvent("TRANSCRIPT_USER", {
              correlationId,
              callSid,
              transcript: event.transcript,
            });
          }
          break;

        case "response.function_call_arguments.done":
        case "response.tool_calls":
          // Log tool calls
          await persistCallEvent(callSid, "tool_call", event);
          
          logStructuredEvent("TOOL_CALL", {
            correlationId,
            callSid,
            tool: event.name,
          });
          break;

        case "error":
          logger.error({
            msg: "realtime.error",
            correlationId,
            callSid,
            error: event.error,
          });

          await persistCallEvent(callSid, "error", {
            source: "realtime",
            error: event.error,
          });
          break;

        default:
          // Log other events at debug level
          logger.debug({
            msg: "realtime.event",
            correlationId,
            callSid,
            type: event.type,
          });
      }
    } catch (error) {
      logger.error({
        msg: "realtime.message.error",
        correlationId,
        callSid,
        error: (error as Error).message,
      });
    }
  });

  // Handle WebSocket errors and closures
  realtimeWs.on("error", (error) => {
    logger.error({
      msg: "realtime.ws.error",
      correlationId,
      callSid,
      error: error.message,
    });
  });

  realtimeWs.on("close", () => {
    logger.info({
      msg: "realtime.ws.closed",
      correlationId,
      callSid,
    });
  });
}
