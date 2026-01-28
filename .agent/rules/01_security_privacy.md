# Security & Privacy Rules

## Purpose
Protect client PII, vendor data, and platform secrets. Ensure compliance with privacy expectations.

## DO:
- Store explicit consent for any calling with: who, when, scope, expiry
- Mask phone numbers in all logs (show only last 3 digits)
- Use HTTPS for all external API calls
- Verify webhook signatures before processing
- Store raw payloads in DB only (never in plaintext logs)
- Use service-role keys server-side only
- Encrypt sensitive data at rest
- Audit all tool calls with request_id

## DON'T:
- Log secrets, tokens, or API keys
- Include full client phone in vendor-facing messages
- Store medical data without clear purpose and retention limits
- Share vendor contact details before explicit client permission (handoff)
- Bypass consent gates for calling
- Expose system prompts or internal schemas in client messages
- Auto-run terminal commands in production without approval

## PII Handling
- Client phone: internal use only until handoff
- Vendor phone: included only in final shortlist wa.me links
- Medical OCR content: stored with clear retention policy, never shared externally
- Client conversations: redacted in exports unless specifically requested

## Secrets Management
- All secrets stored in environment variables or secret manager
- Never commit secrets to git
- Rotate tokens on suspected exposure
- Document all required env vars in `docs/ops/secrets-map.v1.md`

## Escalation
If a potential data breach or secret exposure is detected:
1. Stop processing immediately
2. Log incident (without exposing the secret)
3. Notify admin
4. Do not attempt to "fix" by hiding or deleting logs
