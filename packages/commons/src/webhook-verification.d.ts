/**
 * Twilio webhook signature verification
 *
 * Verifies that a webhook request actually came from Twilio
 *
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
export interface TwilioVerificationOptions {
    authToken: string;
    signature: string;
    url: string;
    params: Record<string, string>;
}
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
export declare function verifyTwilioSignature(options: TwilioVerificationOptions): boolean;
/**
 * Stripe webhook signature verification
 *
 * @see https://stripe.com/docs/webhooks/signatures
 */
export interface StripeVerificationOptions {
    payload: string;
    signature: string;
    secret: string;
    tolerance?: number;
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
export declare function verifyStripeSignature(options: StripeVerificationOptions): boolean;
/**
 * Generic HMAC signature verification
 *
 * Useful for custom webhook implementations
 */
export interface HMACVerificationOptions {
    payload: string;
    signature: string;
    secret: string;
    algorithm?: "sha1" | "sha256" | "sha512";
    encoding?: "hex" | "base64";
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
export declare function verifyHMACSignature(options: HMACVerificationOptions): boolean;
/**
 * Express middleware for webhook signature verification
 */
export interface WebhookVerificationMiddlewareOptions {
    verify: (req: any) => boolean;
    onError?: (req: any, res: any) => void;
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
export declare function createWebhookVerificationMiddleware(options: WebhookVerificationMiddlewareOptions): (req: any, res: any, next: any) => void;
//# sourceMappingURL=webhook-verification.d.ts.map