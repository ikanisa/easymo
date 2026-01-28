# Code Signing (macOS)

Use the signing scripts under `scripts/` for local signing.

## Local Signing Workflow

```bash
# Verify certificate
./scripts/check_certificate.sh "Developer ID Application: Company (TEAMID)"

# List identities
./scripts/list_identities.sh

# Sign all apps
SIGNING_IDENTITY="Developer ID Application: Company (TEAMID)" \
  ./scripts/sign_all_apps.sh

# Verify signatures
./scripts/verify_apps.sh

# End-to-end test
./scripts/test_signing_workflow.sh
```

## CI/CD (GitHub Actions)
Workflow: `.github/workflows/macos-signing.yml`

Required secrets:
- MACOS_CERTIFICATE_BASE64
- MACOS_CERTIFICATE_PASSWORD
- KEYCHAIN_PASSWORD

Trigger by pushing a version tag (e.g., `v1.0.0`) or manually running the workflow.

## Notes
- Do not commit `.p12` or certificate files.
- Keep signing identities in the local keychain.
