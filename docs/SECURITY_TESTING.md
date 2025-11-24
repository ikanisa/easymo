# Security Testing Guide for EasyMO Platform

## Overview

This guide covers security testing procedures for the EasyMO platform, including webhook
verification, authentication, authorization, and vulnerability scanning.

## Table of Contents

1. [Webhook Security Testing](#webhook-security-testing)
2. [Authentication Testing](#authentication-testing)
3. [Authorization Testing](#authorization-testing)
4. [Input Validation Testing](#input-validation-testing)
5. [Rate Limiting Testing](#rate-limiting-testing)
6. [Idempotency Testing](#idempotency-testing)
7. [Automated Security Scanning](#automated-security-scanning)

---

## Webhook Security Testing

### WhatsApp Webhook Verification

**Test Case 1: Valid Signature**

```bash
#!/bin/bash
# Test WhatsApp webhook with valid signature

WEBHOOK_URL="https://your-project.supabase.co/functions/v1/wa-webhook-core"
PAYLOAD='{"object":"whatsapp_business_account","entry":[{"id":"123","changes":[]}]}'
SECRET="your_wa_app_secret"

# Calculate signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

# Send request
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"
```

**Expected:** 200 OK response

**Test Case 2: Invalid Signature**

```bash
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=invalid_signature" \
  -d "$PAYLOAD"
```

**Expected:** 401 Unauthorized

**Test Case 3: Missing Signature**

```bash
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

**Expected:** 401 Unauthorized

### Twilio Webhook Verification

**Test Case: Valid Twilio Signature**

```javascript
const crypto = require("crypto");

const authToken = process.env.TWILIO_AUTH_TOKEN;
const url = "https://your-domain.com/twilio/voice";
const params = {
  CallSid: "CA1234567890ABCDE",
  From: "+15558675310",
  To: "+15551234567",
};

// Build signature
const data =
  url +
  Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], "");
const signature = crypto
  .createHmac("sha1", authToken)
  .update(Buffer.from(data, "utf-8"))
  .digest("base64");

// Test
fetch(url, {
  method: "POST",
  headers: {
    "X-Twilio-Signature": signature,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams(params),
});
```

---

## Authentication Testing

### Service Token Testing

**Test Case 1: Valid Service Token**

```bash
curl -X POST http://localhost:4400/wallet/transfer \
  -H "Authorization: Bearer valid_service_token" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "currency": "USD"}'
```

**Expected:** 201 Created (or appropriate success response)

**Test Case 2: Invalid Token**

```bash
curl -X POST http://localhost:4400/wallet/transfer \
  -H "Authorization: Bearer invalid_token" \
  -d '{"amount": 100}'
```

**Expected:** 401 Unauthorized

**Test Case 3: Missing Token**

```bash
curl -X POST http://localhost:4400/wallet/transfer \
  -d '{"amount": 100}'
```

**Expected:** 401 Unauthorized

**Test Case 4: Expired Token**

```bash
# Use a token that's expired (JWT with exp in past)
curl -X POST http://localhost:4400/wallet/transfer \
  -H "Authorization: Bearer expired_jwt_token" \
  -d '{"amount": 100}'
```

**Expected:** 401 Unauthorized with "token expired" message

---

## Authorization Testing

### Role-Based Access Control

**Test Case 1: Admin Access to Admin Endpoints**

```bash
curl -X GET https://your-project.supabase.co/functions/v1/admin-users \
  -H "x-api-key: $ADMIN_TOKEN"
```

**Expected:** 200 OK

**Test Case 2: Regular User Access to Admin Endpoints**

```bash
curl -X GET https://your-project.supabase.co/functions/v1/admin-users \
  -H "Authorization: Bearer $USER_JWT"
```

**Expected:** 403 Forbidden

**Test Case 3: Cross-Tenant Access Prevention**

```bash
# User from tenant A trying to access tenant B's data
curl -X GET http://localhost:4400/wallet/accounts/tenant_b_account \
  -H "Authorization: Bearer tenant_a_user_token"
```

**Expected:** 403 Forbidden or 404 Not Found

---

## Input Validation Testing

### SQL Injection Testing

**Test Case 1: SQL Injection in Query Parameters**

```bash
curl "http://localhost:4400/wallet/accounts/123' OR '1'='1"
```

**Expected:** 400 Bad Request (not SQL error)

**Test Case 2: SQL Injection in JSON Payload**

```bash
curl -X POST http://localhost:4400/wallet/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceAccountId": "123",
    "destinationAccountId": "456\"; DROP TABLE transactions; --",
    "amount": 100
  }'
```

**Expected:** 400 Bad Request (validation error)

### XSS Testing

**Test Case: Script Injection in Input**

```bash
curl -X POST http://localhost:4404/agent/execute \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "<script>alert(\"XSS\")</script>",
    "userId": "user_123"
  }'
```

**Expected:** Input should be sanitized/escaped in response

### Command Injection Testing

**Test Case: Shell Command in Input**

```bash
curl -X POST http://localhost:4400/wallet/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "reference": "Payment; rm -rf /"
  }'
```

**Expected:** Input validation rejects special characters

---

## Rate Limiting Testing

### Standard Rate Limit

**Test Case: Exceed Rate Limit**

```bash
#!/bin/bash
# Send 101 requests rapidly (limit is 100 per 15 min)

for i in {1..101}; do
  curl -X GET http://localhost:4400/health
  echo "Request $i"
done
```

**Expected:**

- First 100 requests: 200 OK
- 101st request: 429 Too Many Requests

**Test Case: Rate Limit Headers**

```bash
curl -v http://localhost:4400/health
```

**Expected Headers:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 2024-03-15T11:00:00Z
```

### Strict Rate Limit (Sensitive Operations)

**Test Case: Password Reset Rate Limit**

```bash
#!/bin/bash
# Attempt 6 password resets (limit is 5 per hour)

for i in {1..6}; do
  curl -X POST http://localhost:4400/auth/reset-password \
    -d '{"email": "test@example.com"}'
  sleep 1
done
```

**Expected:**

- First 5 requests: 200 OK
- 6th request: 429 Too Many Requests

---

## Idempotency Testing

### Duplicate Request Prevention

**Test Case 1: Same Idempotency Key Returns Same Response**

```bash
IDEMPOTENCY_KEY="test-$(uuidgen)"

# First request
RESPONSE1=$(curl -X POST http://localhost:4400/wallet/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceAccountId": "src_123",
    "destinationAccountId": "dst_456",
    "amount": 100,
    "currency": "USD"
  }')

# Second request with same key
RESPONSE2=$(curl -X POST http://localhost:4400/wallet/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceAccountId": "src_123",
    "destinationAccountId": "dst_456",
    "amount": 100,
    "currency": "USD"
  }')

# Compare responses
echo "$RESPONSE1" > /tmp/response1.json
echo "$RESPONSE2" > /tmp/response2.json
diff /tmp/response1.json /tmp/response2.json
```

**Expected:** No difference (responses are identical)

**Test Case 2: Different Keys Create Different Transactions**

```bash
KEY1="test-$(uuidgen)"
KEY2="test-$(uuidgen)"

curl -X POST http://localhost:4400/wallet/transfer \
  -H "Idempotency-Key: $KEY1" \
  -d '{"amount": 100}' | jq .transaction.id

curl -X POST http://localhost:4400/wallet/transfer \
  -H "Idempotency-Key: $KEY2" \
  -d '{"amount": 100}' | jq .transaction.id
```

**Expected:** Different transaction IDs

---

## Automated Security Scanning

### Using npm audit

```bash
cd /home/runner/work/easymo-/easymo-

# Scan for vulnerabilities
pnpm audit

# Fix vulnerabilities
pnpm audit fix
```

### Using OWASP Dependency-Check

```bash
# Install dependency-check
brew install dependency-check  # macOS
# or download from https://owasp.org/www-project-dependency-check/

# Run scan
dependency-check.sh \
  --project "EasyMO" \
  --scan . \
  --format HTML \
  --out ./security-reports
```

### Using Snyk

```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth

# Test for vulnerabilities
snyk test

# Monitor project
snyk monitor
```

### Static Code Analysis

```bash
# ESLint security plugins
pnpm add -D eslint-plugin-security

# Update eslint.config.js
# Add security rules for common vulnerabilities

# Run linter
pnpm lint
```

---

## Security Checklist

### Pre-Deployment

- [ ] All webhooks verify signatures
- [ ] Authentication required on all non-public endpoints
- [ ] Authorization checks prevent cross-tenant access
- [ ] Input validation on all user inputs
- [ ] Rate limiting on all public endpoints
- [ ] Idempotency keys required for financial operations
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] CSRF tokens on state-changing operations
- [ ] Secrets not exposed in client-side code
- [ ] HTTPS enforced on all endpoints
- [ ] Security headers configured (HSTS, CSP, etc.)
- [ ] Dependency vulnerabilities scanned and fixed
- [ ] Database backups configured
- [ ] Audit logging enabled on sensitive operations

### Post-Deployment

- [ ] Security scanning scheduled (weekly)
- [ ] Penetration testing performed (quarterly)
- [ ] Security incident response plan documented
- [ ] Access logs monitored for suspicious activity
- [ ] Failed authentication attempts monitored
- [ ] Rate limit violations tracked
- [ ] API keys rotated regularly
- [ ] Security patches applied promptly

---

## Reporting Security Issues

**DO NOT** open public issues for security vulnerabilities.

**Email:** security@easymo.com  
**PGP Key:** Available at https://easymo.com/security/pgp

Include:

1. Description of vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if available)

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

---

**Last Updated:** 2024-03-15  
**Version:** 1.0  
**Owner:** Security Team
