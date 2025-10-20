# Service Auth Deployment & Key Rotation Guide

## 1. Required Environment Variables

Inject the following variables for every service that now verifies service JWTs.

| Variable | Purpose |
|----------|---------|
| `SERVICE_AUTH_AUDIENCE` | Token `aud` value the service expects (e.g. `wallet-service`, `agent-core`). |
| `SERVICE_JWT_KEYS` | Comma-separated HMAC secrets (newest first) used to verify tokens. Store in your secret manager. |
| `SERVICE_NAME` | Identifier emitted in outgoing requests; helps trace call chains. |
| `RATE_LIMIT_REDIS_URL` | Redis instance for per-service rate limiting. Leave unset to disable. |
| `RATE_LIMIT_POINTS` / `RATE_LIMIT_WINDOW_SECONDS` | Optional throttle budget (defaults vary by service). |

### Service-specific audiences

| Service | Audience |
|---------|----------|
| buyer-service | `buyer-service` |
| wallet-service | `wallet-service` |
| attribution-service | `attribution-service` |
| voice-bridge | `voice-bridge` |
| ranking-service | `ranking-service` |
| vendor-service | `vendor-service` |
| reconciliation-service | `reconciliation-service` |
| agent-core (AI/tasks) | `agent-core` |
| whatsapp-bot | `whatsapp-bot` |

## 2. Sample Kubernetes Snippet

```yaml
env:
  - name: SERVICE_AUTH_AUDIENCE
    value: "wallet-service"
  - name: SERVICE_NAME
    value: "wallet-service"
  - name: SERVICE_JWT_KEYS
    valueFrom:
      secretKeyRef:
        name: wallet-service-secrets
        key: service-jwt-keys
  - name: RATE_LIMIT_REDIS_URL
    value: "redis://redis.svc.cluster.local:6379"
  - name: RATE_LIMIT_POINTS
    value: "120"
  - name: RATE_LIMIT_WINDOW_SECONDS
    value: "60"
```

## 3. docker-compose Example

```yaml
services:
  wallet-service:
    environment:
      SERVICE_AUTH_AUDIENCE: wallet-service
      SERVICE_NAME: wallet-service
      SERVICE_JWT_KEYS: ${SERVICE_JWT_KEYS}
      RATE_LIMIT_REDIS_URL: redis://redis:6379
      RATE_LIMIT_POINTS: 120
      RATE_LIMIT_WINDOW_SECONDS: 60
```

## 4. Deployment Checklist

1. **Update secrets**  
   Store new HMAC keys in your secret manager. Configure `SERVICE_JWT_KEYS` with the latest key first followed by any older keys still accepted.

2. **Roll out verifier services**  
   Redeploy the services that *validate* tokens (wallet, ranking, vendor, reconciliation, agent-core modules, etc.) so they recognise the new key set. At this stage they continue to accept existing tokens.

3. **Rotate issuers**  
   Update services that *issue* tokens (callers or gateway) to sign with the new key. Confirm outbound requests succeed against the updated verifiers.

4. **Clean up old keys**  
   After verifying traffic flows with the new key, remove the retired keys from `SERVICE_JWT_KEYS` on all services and redeploy.

5. **Monitor**  
   Watch 401/403 rates and rate-limit responses. Services emit structured logs like `invalid_scope` and `missing_token` to help trace issues.

## 5. Scope Reference

| Scope | Service |
|-------|---------|
| `wallet:transfer.write`, `wallet:accounts.read`, `wallet:accounts.write` | wallet-service |
| `ranking:read`, `ranking:feedback.write` | ranking-service |
| `vendor:read`, `vendor:write`, `vendor:quote.write` | vendor-service |
| `reconciliation:write` | reconciliation-service |
| `ai:broker.orchestrate`, `ai:settlement`, `ai:attribution`, `ai:reconciliation`, `ai:support` | agent-core AI module |
| `tasks:schedule`, `tasks:run` | agent-core tasks module |
| `voice:read`, `voice:outbound.write` | voice-bridge |
| `buyer:intent.write`, `buyer:purchase.write`, etc. | buyer-service |

Document any additional internal scopes as you onboard new clients.
