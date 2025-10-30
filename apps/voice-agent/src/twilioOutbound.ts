import { Request, Response } from "express";
import { logger, logStructuredEvent } from "./logger.js";

// Note: For full Twilio integration, install 'twilio' package
// This is a stub implementation showing the structure

interface OutboundCallRequest {
  to: string;
  tenantId?: string;
  contactName?: string;
  region?: string;
  profile?: string;
}

/**
 * Initiate an outbound call via Twilio.
 * 
 * This endpoint accepts a POST request with:
 * - to: Destination phone number
 * - tenantId: Optional tenant identifier
 * - contactName: Optional contact name
 * - region: Optional region
 * - profile: Optional agent profile
 * 
 * Returns:
 * - 202 Accepted with call SID
 * - 400 Bad Request if missing required fields
 * - 502 Bad Gateway if Twilio call fails
 */
export async function twilioOutboundHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { to, tenantId, contactName, region, profile }: OutboundCallRequest = req.body;
  const requestId = (req as any).requestId;

  // Validate required fields
  if (!to) {
    res.status(400).json({
      error: "Missing required field: to",
    });
    return;
  }

  // Check if Twilio credentials are configured
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    res.status(503).json({
      error: "Twilio not configured",
    });
    return;
  }

  try {
    // Build WebSocket URL with call metadata
    const publicWsUrl = process.env.PUBLIC_WS_URL || "wss://localhost/ws/twilio";
    const streamUrl = new URL(publicWsUrl);
    streamUrl.searchParams.set("callSid", "{{CallSid}}"); // Twilio will replace this
    streamUrl.searchParams.set("to", to);
    streamUrl.searchParams.set("direction", "outbound");
    
    if (tenantId) streamUrl.searchParams.set("tenantId", tenantId);
    if (contactName) streamUrl.searchParams.set("contactName", contactName);
    if (region) streamUrl.searchParams.set("region", region);
    if (profile) streamUrl.searchParams.set("profile", profile);

    // Generate TwiML for outbound call
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Hello, this is an AI assistant from EasyMO.</Say>
  <Connect>
    <Stream url="${streamUrl.toString()}">
      <Parameter name="to" value="${to}" />
      ${tenantId ? `<Parameter name="tenantId" value="${tenantId}" />` : ''}
      ${region ? `<Parameter name="region" value="${region}" />` : ''}
      ${profile ? `<Parameter name="profile" value="${profile}" />` : ''}
    </Stream>
  </Connect>
</Response>`;

    logStructuredEvent("twilio.call.outbound.initiating", {
      requestId,
      to,
      tenantId,
      contactName,
      region,
      profile,
    });

    // TODO: Make actual Twilio API call
    // For now, return stub response
    // In production, use twilio.calls.create() with the TwiML

    logger.info({
      msg: "twilio.outbound.stub",
      requestId,
      to,
      note: "Install 'twilio' package and uncomment implementation",
    });

    res.status(202).json({
      status: "queued",
      to,
      tenantId: tenantId || null,
      contactName: contactName || null,
      region: region || null,
      profile: profile || null,
      sid: `STUB_${Date.now()}`, // Replace with actual call.sid
      message: "Outbound call implementation requires twilio package",
    });
  } catch (error) {
    logger.error({
      msg: "twilio.outbound.failed",
      requestId,
      to,
      error: (error as Error).message,
    });

    res.status(502).json({
      error: "Failed to initiate outbound call",
      message: (error as Error).message,
    });
  }
}

/**
 * Example of full implementation with twilio package:
 * 
 * import twilio from 'twilio';
 * 
 * const twilioClient = twilio(
 *   process.env.TWILIO_ACCOUNT_SID,
 *   process.env.TWILIO_AUTH_TOKEN
 * );
 * 
 * const call = await twilioClient.calls.create({
 *   to,
 *   from: process.env.TWILIO_FROM_NUMBER,
 *   twiml,
 *   statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL,
 *   statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
 *   statusCallbackMethod: 'POST',
 * });
 * 
 * return res.status(202).json({
 *   status: 'queued',
 *   sid: call.sid,
 *   ...
 * });
 */
