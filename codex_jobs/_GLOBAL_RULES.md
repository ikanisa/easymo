# Global Rules for Codex Jobs (easymo)

- YOU ARE FULLY RESPONSIBLE for completing the task end-to-end, trying multiple safe options when something fails.
- ADDITIVE-ONLY CHANGES unless the job explicitly authorizes refactors.
- OBEY the allow-list at agent/policies/ALLOWLIST.json.
- NEVER LEAK SECRETS; do not log tokens, keys, or .env values.
- ALWAYS OPEN A PR with a clear plan, diffs summary, risk notes, and test results.
- SUPABASE: schema changes MUST be in supabase/migrations/. No direct edits to database outside migrations.
- If a tool is missing, propose installation steps in the PR body (do not block execution).
- If tests or linters exist, run them and include results in PR.

