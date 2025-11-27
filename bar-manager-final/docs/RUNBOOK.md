# Admin Panel Operational Runbook

## Table of Contents

1. [Deployment Procedures](#deployment-procedures)
2. [Monitoring & Alerts](#monitoring--alerts)
3. [Troubleshooting Guides](#troubleshooting-guides)
4. [Incident Response](#incident-response)
5. [Maintenance Tasks](#maintenance-tasks)

---

## 1. Deployment Procedures

### Pre-Deployment Checklist

- [ ] All tests passing (`npm run test`)
- [ ] Type checking successful (`npm run type-check`)
- [ ] Lint checks passing (`npm run lint`)
- [ ] Environment variables configured
- [ ] Database migrations reviewed
- [ ] Sentry DSN configured
- [ ] Supabase credentials verified
- [ ] Admin credentials updated

### Environment Variables

**Required Variables:**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn

# Admin Authentication
ADMIN_ACCESS_CREDENTIALS=[{"actorId":"...","email":"...","password":"...","label":"..."}]
ADMIN_SESSION_SECRET=minimum-16-character-secret
EASYMO_ADMIN_TOKEN=optional-admin-token

# Environment
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://admin.yourdomain.com
```

### Database Migration Steps

1. **Backup Current Database**
   ```bash
   # Using Supabase CLI
   supabase db dump -f backup-$(date +%Y%m%d-%H%M%S).sql
   ```

2. **Review Pending Migrations**
   ```bash
   # List pending migrations
   supabase migration list
   ```

3. **Apply Migrations**
   ```bash
   # Apply to staging first
   supabase db push --db-url $STAGING_DB_URL
   
   # Verify staging
   # Then apply to production
   supabase db push --db-url $PRODUCTION_DB_URL
   ```

### Deployment Steps

#### Option 1: Vercel Deployment

```bash
# 1. Build locally to verify
npm run build

# 2. Deploy to staging
vercel --env staging

# 3. Run smoke tests
npm run test:e2e --env staging

# 4. Deploy to production
vercel --prod
```

#### Option 2: Docker Deployment

```bash
# 1. Build Docker image
docker build -t admin-panel:$(git rev-parse --short HEAD) .

# 2. Tag for registry
docker tag admin-panel:$(git rev-parse --short HEAD) registry.example.com/admin-panel:latest

# 3. Push to registry
docker push registry.example.com/admin-panel:latest

# 4. Deploy to production
kubectl apply -f k8s/production/
kubectl rollout status deployment/admin-panel
```

### Rollback Procedures

#### Vercel Rollback
```bash
# List recent deployments
vercel list

# Rollback to specific deployment
vercel rollback [deployment-url]
```

#### Docker/Kubernetes Rollback
```bash
# Rollback to previous revision
kubectl rollout undo deployment/admin-panel

# Rollback to specific revision
kubectl rollout undo deployment/admin-panel --to-revision=2
```

---

## 2. Monitoring & Alerts

### Sentry Error Tracking

**Dashboard:** https://sentry.io/organizations/your-org/projects/admin-panel/

**Key Metrics to Monitor:**
- Error rate (should be < 1%)
- Response time (p95 should be < 500ms)
- Unhandled exceptions
- Rate limit violations

**Alert Thresholds:**
- **Critical**: Error rate > 5% for 5 minutes
- **Warning**: Error rate > 2% for 10 minutes
- **Info**: New error type detected

### Web Vitals Monitoring

**Metrics Endpoint:** `/api/v2/dashboard/metrics/vitals`

**Target Thresholds:**
- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1

### API Latency Monitoring

**Endpoints to Monitor:**
- `/api/auth/login` - Target: < 200ms
- `/api/users/invite` - Target: < 500ms
- `/api/settings` - Target: < 300ms

**Alert Conditions:**
- p95 latency > 1000ms for 5 minutes
- p99 latency > 2000ms for 3 minutes

### Rate Limit Monitoring

**Expected Limits:**
- `/api/auth/login`: 10 req/min per IP
- `/api/users/invite`: 10 req/min per IP
- `/api/settings` (GET): 30 req/min per IP
- `/api/settings` (POST): 10 req/min per IP

**Alert on:**
- Sustained 429 responses > 100/min
- Rate limit bypass attempts

---

## 3. Troubleshooting Guides

### Common Error Scenarios

#### 1. Authentication Failures

**Symptoms:**
- Users unable to log in
- 401 Unauthorized errors
- Session cookie not being set

**Diagnosis:**
```bash
# Check environment variables
echo $ADMIN_ACCESS_CREDENTIALS
echo $ADMIN_SESSION_SECRET

# Verify session secret length
echo $ADMIN_SESSION_SECRET | wc -c  # Should be >= 16
```

**Resolution:**
1. Verify `ADMIN_ACCESS_CREDENTIALS` is valid JSON
2. Ensure `ADMIN_SESSION_SECRET` is at least 16 characters
3. Check Sentry for specific error messages
4. Clear browser cookies and retry

#### 2. Database Connection Issues

**Symptoms:**
- 503 Service Unavailable
- "Supabase admin client unavailable" errors
- Timeout errors

**Diagnosis:**
```bash
# Test Supabase connection
curl -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
     "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/"
```

**Resolution:**
1. Verify Supabase project is active
2. Check service role key is correct
3. Verify network connectivity
4. Check Supabase dashboard for outages

#### 3. Rate Limiting Issues

**Symptoms:**
- Legitimate users getting 429 errors
- Rate limits not being enforced

**Diagnosis:**
```bash
# Check rate limit implementation
grep -r "rateLimit" app/api/

# Test rate limit manually
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}'
  echo "Request $i"
done
```

**Resolution:**
1. Verify rate limit configuration in code
2. Check if IP forwarding is configured correctly
3. Review `x-forwarded-for` header handling
4. Consider adjusting rate limit thresholds

#### 4. Sentry Integration Problems

**Symptoms:**
- Errors not appearing in Sentry
- Missing stack traces
- Incomplete error context

**Diagnosis:**
```bash
# Verify Sentry DSN
echo $NEXT_PUBLIC_SENTRY_DSN

# Test Sentry manually
curl -X POST https://sentry.io/api/[project-id]/store/ \
  -H "X-Sentry-Auth: Sentry sentry_key=[key]" \
  -d '{"message":"test"}'
```

**Resolution:**
1. Verify `NEXT_PUBLIC_SENTRY_DSN` is set
2. Check Sentry project quota
3. Verify source maps are uploaded
4. Check browser console for Sentry errors

---

## 4. Incident Response

### Severity Levels

**P0 - Critical (Response: Immediate)**
- Complete service outage
- Data breach or security incident
- Authentication system down

**P1 - High (Response: < 1 hour)**
- Major feature unavailable
- Significant performance degradation
- Database connectivity issues

**P2 - Medium (Response: < 4 hours)**
- Minor feature broken
- Intermittent errors
- Non-critical API failures

**P3 - Low (Response: < 24 hours)**
- UI glitches
- Minor performance issues
- Documentation errors

### Escalation Procedures

1. **Initial Response** (On-call engineer)
   - Acknowledge incident in monitoring system
   - Assess severity level
   - Begin initial investigation

2. **Escalation** (If not resolved in 30 minutes)
   - Notify team lead
   - Create incident channel (#incident-YYYYMMDD)
   - Update status page

3. **Executive Escalation** (P0/P1 incidents > 1 hour)
   - Notify engineering manager
   - Prepare executive summary
   - Coordinate external communications

### Communication Templates

**Internal Status Update:**
```
🚨 Incident Update - [TIMESTAMP]
Severity: [P0/P1/P2/P3]
Status: [Investigating/Identified/Monitoring/Resolved]
Impact: [Description of user impact]
Next Update: [Time]
```

**User-Facing Status:**
```
We're currently experiencing issues with [feature].
Our team is actively working on a resolution.
Estimated resolution: [Time]
Updates: [Status page URL]
```

---

## 5. Maintenance Tasks

### Daily Tasks

- [ ] Review Sentry error dashboard
- [ ] Check Web Vitals metrics
- [ ] Monitor API latency
- [ ] Review rate limit violations

### Weekly Tasks

- [ ] Review and update dependencies (`npm outdated`)
- [ ] Check for security vulnerabilities (`npm audit`)
- [ ] Review and archive old logs
- [ ] Test backup restoration procedure

### Monthly Tasks

- [ ] Conduct security audit
- [ ] Review and update access credentials
- [ ] Performance optimization review
- [ ] Disaster recovery drill

### Quarterly Tasks

- [ ] Full security penetration test
- [ ] Load testing and capacity planning
- [ ] Documentation review and updates
- [ ] Incident response training

---

## Emergency Contacts

**On-Call Rotation:** [Link to PagerDuty/OpsGenie]

**Escalation Chain:**
1. On-Call Engineer: [Contact]
2. Team Lead: [Contact]
3. Engineering Manager: [Contact]
4. CTO: [Contact]

**External Contacts:**
- Supabase Support: support@supabase.io
- Sentry Support: support@sentry.io
- Vercel Support: support@vercel.com

---

## Additional Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [API Documentation](./API.md)
- [Security Policy](./SECURITY.md)
- [Contributing Guidelines](./CONTRIBUTING.md)
