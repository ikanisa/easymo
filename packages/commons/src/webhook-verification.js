import crypto from "crypto";
/**
 * Verify Twilio webhook signature
 *
 * @param options - Verification parameters
 * @returns true if signature is valid
 *
 * @example
 * ```typescript
 * import { verifyTwilioSignature } from "@easymo/commons";
 *
 * app.post("/twilio/voice", (req, res) => {
 *   const signature = req.headers["x-twilio-signature"];
 *   const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
 *
 *   const isValid = verifyTwilioSignature({
 *     authToken: process.env.TWILIO_AUTH_TOKEN,
 *     signature,
 *     url,
 *     params: req.body
 *   });
 *
 *   if (!isValid) {
 *     return res.status(403).json({ error: "Invalid signature" });
 *   }
 *
 *   // Process webhook...
 * });
 * ```
 */
export function verifyTwilioSignature(options) {
    const { authToken, signature, url, params } = options;
    if (!authToken || !signature || !url) {
        return false;
    }
    // Build the data string: URL + sorted params
    const data = Object.keys(params)
        .sort()
        .reduce((acc, key) => acc + key + params[key], url);
    // Calculate expected signature
    const expectedSignature = crypto
        .createHmac("sha1", authToken)
        .update(Buffer.from(data, "utf-8"))
        .digest("base64");
    // Timing-safe comparison
    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }
    catch {
        // Different lengths - definitely not equal
        return false;
    }
}
/**
 * Verify Stripe webhook signature
 *
 * @param options - Verification parameters
 * @returns true if signature is valid
 *
 * @example
 * ```typescript
 * import { verifyStripeSignature } from "@easymo/commons";
 *
 * app.post("/stripe/webhook", express.raw({ type: "application/json" }), (req, res) => {
 *   const signature = req.headers["stripe-signature"];
 *   const payload = req.body.toString();
 *
 *   const isValid = verifyStripeSignature({
 *     payload,
 *     signature,
 *     secret: process.env.STRIPE_WEBHOOK_SECRET
 *   });
 *
 *   if (!isValid) {
 *     return res.status(403).json({ error: "Invalid signature" });
 *   }
 *
 *   // Process webhook...
 * });
 * ```
 */
export function verifyStripeSignature(options) {
    const { payload, signature, secret, tolerance = 300 } = options;
    if (!payload || !signature || !secret) {
        return false;
    }
    try {
        // Parse signature header: t=timestamp,v1=signature
        const parts = signature.split(",");
        const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
        const sig = parts.find((p) => p.startsWith("v1="))?.split("=")[1];
        if (!timestamp || !sig) {
            return false;
        }
        // Check timestamp tolerance
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - parseInt(timestamp, 10)) > tolerance) {
            return false;
        }
        // Calculate expected signature
        const signedPayload = `${timestamp}.${payload}`;
        const expectedSig = crypto
            .createHmac("sha256", secret)
            .update(signedPayload, "utf8")
            .digest("hex");
        // Timing-safe comparison
        return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
    }
    catch {
        return false;
    }
}
/**
 * Verify generic HMAC signature
 *
 * @param options - Verification parameters
 * @returns true if signature is valid
 *
 * @example
 * ```typescript
 * import { verifyHMACSignature } from "@easymo/commons";
 *
 * const isValid = verifyHMACSignature({
 *   payload: JSON.stringify(req.body),
 *   signature: req.headers["x-signature"],
 *   secret: process.env.WEBHOOK_SECRET,
 *   algorithm: "sha256",
 *   encoding: "hex"
 * });
 * ```
 */
export function verifyHMACSignature(options) {
    const { payload, signature, secret, algorithm = "sha256", encoding = "hex", } = options;
    if (!payload || !signature || !secret) {
        return false;
    }
    try {
        const expectedSignature = crypto
            .createHmac(algorithm, secret)
            .update(payload, "utf8")
            .digest(encoding);
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }
    catch {
        return false;
    }
}
/**
 * Create an Express middleware for webhook verification
 *
 * @example
 * ```typescript
 * import { createWebhookVerificationMiddleware, verifyTwilioSignature } from "@easymo/commons";
 *
 * const twilioVerify = createWebhookVerificationMiddleware({
 *   verify: (req) => verifyTwilioSignature({
 *     authToken: process.env.TWILIO_AUTH_TOKEN,
 *     signature: req.headers["x-twilio-signature"],
 *     url: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
 *     params: req.body
 *   })
 * });
 *
 * app.post("/twilio/voice", twilioVerify, voiceHandler);
 * ```
 */
export function createWebhookVerificationMiddleware(options) {
    return (req, res, next) => {
        const isValid = options.verify(req);
        if (!isValid) {
            if (options.onError) {
                options.onError(req, res);
            }
            else {
                res.status(403).json({
                    error: "webhook_verification_failed",
                    message: "Invalid webhook signature",
                });
            }
            return;
        }
        next();
    };
}
