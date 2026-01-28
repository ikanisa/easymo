# Coding Standards

## TypeScript
- Avoid `any`; prefer explicit types.
- Use `unknown` and narrow types when needed.
- Keep modules small and focused.

## Imports and Naming
- Files: kebab-case
- Components/Types: PascalCase
- Functions/variables: camelCase
- Constants: UPPER_SNAKE_CASE

## Validation and Errors
- Validate inputs (Zod where applicable).
- Return structured errors; avoid leaking internals.

## Logging
- Use structured logs with correlation IDs.
- Mask PII in logs.

## Guardrails (Non-Negotiable)
- No Twilio usage (use WhatsApp Cloud API directly).
- No MoMo API usage (use USSD flows).
- No Kinyarwanda UI translation.
- Rwanda (RW) only.

## Git Hygiene
- Use Conventional Commits (feat:, fix:, docs:, chore:).
