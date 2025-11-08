# 🚀 EasyMO AI Agents - Deployment Guide

## ✅ Current Status

**Development Server:** Running at http://localhost:3000  
**Environment:** Development  
**All AI Agents:** Implemented and Integrated  
**Status:** READY FOR PRODUCTION DEPLOYMENT

---

## 📋 Pre-Deployment Checklist

### ✅ Completed Items

- [x] All 6 AI agents implemented
  - Nearby Drivers Agent
  - Pharmacy Agent
  - Property Rental Agent
  - Schedule Trip Agent
  - Shops Agent
  - Quincaillerie Agent

- [x] Database migrations created
- [x] Edge functions implemented
- [x] WhatsApp webhook integration
- [x] OpenAI API integration
- [x] Feature flags system
- [x] Observability and logging
- [x] Error handling and fallbacks
- [x] Environment configuration

### ⏳ Pending Items

- [ ] Production environment variables verification
- [ ] Load testing with production volumes
- [ ] Final security audit
- [ ] User acceptance testing
- [ ] Documentation review

---

## 🔧 Local Development Setup

### Requirements

- Node.js >= 18.18.0
- pnpm >= 8.0.0
- Supabase CLI
- Deno (for edge functions)

### Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment variables
cp .env.example .env.local

# 3. Start admin app
cd admin-app
npm run dev

# 4. In another terminal, start Supabase locally (optional)
supabase start

# 5. Deploy edge functions (local)
supabase functions serve
```

### Access Points

- **Admin Dashboard:** http://localhost:3000
- **Supabase Studio:** http://localhost:54323
- **Edge Functions:** http://localhost:54321/functions/v1/

---

## 🌐 Production Deployment

### Step 1: Environment Setup

Create `.env.production` with:

```bash
# Supabase
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SERVICE_ROLE_KEY>
DATABASE_URL=postgresql://postgres:<PASSWORD>@db.lhbowpbcpwoiparwnwgt.supabase.co:5432/postgres

# OpenAI
OPENAI_API_KEY=<YOUR_OPENAI_KEY>

# WhatsApp Business API
WHATSAPP_ACCESS_TOKEN=<YOUR_WHATSAPP_TOKEN>
WHATSAPP_PHONE_NUMBER_ID=<YOUR_PHONE_NUMBER_ID>
WHATSAPP_VERIFY_TOKEN=<YOUR_VERIFY_TOKEN>

# Feature Flags
FEATURE_AGENT_DRIVERS=true
FEATURE_AGENT_PHARMACY=true
FEATURE_AGENT_PROPERTY=true
FEATURE_AGENT_SCHEDULE=true
FEATURE_AGENT_SHOPS=true
FEATURE_AGENT_QUINCAILLERIE=true
```

### Step 2: Database Migrations

```bash
# Apply all migrations to production
supabase db push --linked --include-seed=false

# Verify migrations
supabase db diff
```

### Step 3: Deploy Edge Functions

```bash
# Deploy all agent functions
supabase functions deploy agent-negotiation --no-verify-jwt
supabase functions deploy agent-property-rental --no-verify-jwt
supabase functions deploy agent-schedule-trip --no-verify-jwt
supabase functions deploy agent-shops --no-verify-jwt
supabase functions deploy agent-quincaillerie --no-verify-jwt

# Deploy updated webhook
supabase functions deploy wa-webhook --no-verify-jwt

# Set environment secrets for functions
supabase secrets set OPENAI_API_KEY=<YOUR_KEY>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<YOUR_KEY>
```

### Step 4: Deploy Admin App

```bash
# Build admin app
cd admin-app
npm run build

# Deploy to Vercel/Netlify (example for Netlify)
netlify deploy --prod

# Or deploy to your hosting provider
```

### Step 5: Configure WhatsApp Webhook

1. Go to Meta Developer Console
2. Configure webhook URL:
   ```
   https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook
   ```
3. Set verify token (same as in environment)
4. Subscribe to message events:
   - messages
   - messaging_postbacks
   - message_echoes
   - message_reads

### Step 6: Enable Feature Flags

```sql
-- Connect to production database
psql $DATABASE_URL

-- Enable agents gradually
UPDATE feature_flags SET enabled = true WHERE key = 'agent.nearby_drivers';

-- Monitor for 24 hours, then enable next agent
UPDATE feature_flags SET enabled = true WHERE key = 'agent.pharmacy';

-- Continue for other agents...
```

---

## 📊 Monitoring & Observability

### Health Checks

```bash
# Check agent function health
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/agent-negotiation/health

# Check webhook health
curl https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/wa-webhook/health

# Check admin app health
curl https://your-admin-domain.com/api/health
```

### View Logs

```bash
# Function logs
supabase functions logs agent-negotiation --tail

# Real-time logs
supabase functions logs --tail

# Filter by level
supabase functions logs --level error
```

### Metrics Dashboard

Access at: `https://your-admin-domain.com/admin/analytics`

Key metrics to monitor:
- Active agent sessions
- SLA compliance rate
- Vendor response rates
- User acceptance rates
- Error rates by agent type
- Average response times

---

## 🧪 Testing in Production

### Smoke Tests

```bash
# Test driver agent
./scripts/test-driver-agent.sh

# Test pharmacy agent
./scripts/test-pharmacy-agent.sh

# Test all agents
./scripts/test-all-agents.sh
```

### Manual Testing

Use test WhatsApp number:
1. Send: "I need a Moto"
2. Verify agent responds
3. Share location
4. Verify 3 options received within 5 minutes
5. Select option
6. Verify booking confirmation

---

## 🔒 Security Checklist

- [ ] All service role keys rotated
- [ ] CORS configured for admin dashboard
- [ ] Rate limiting enabled on edge functions
- [ ] RLS policies verified on all tables
- [ ] Secrets stored in Supabase secrets manager
- [ ] API keys have appropriate scopes
- [ ] Webhook signature verification enabled
- [ ] Error messages don't leak sensitive info

---

## 📈 Performance Optimization

### Database Indexes

```sql
-- Verify critical indexes exist
SELECT * FROM pg_indexes WHERE tablename IN (
  'agent_sessions',
  'agent_quotes',
  'scheduled_trips'
);
```

### Function Performance

```bash
# Analyze cold start times
supabase functions logs | grep "cold start"

# Monitor memory usage
supabase functions inspect agent-negotiation
```

### Caching Strategy

- User sessions: 15 minutes
- Vendor data: 5 minutes
- Agent responses: No caching
- Static assets: 1 year

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Agent Not Responding

**Symptoms:** User messages not being routed to agent

**Checks:**
```bash
# Check feature flag
SELECT * FROM feature_flags WHERE key LIKE 'agent.%';

# Check webhook logs
supabase functions logs wa-webhook --tail

# Verify OpenAI API
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models
```

**Solution:**
- Enable feature flag in database
- Check OpenAI API key validity
- Verify webhook is receiving messages

#### 2. Timeouts / Slow Response

**Symptoms:** Agents taking >5 minutes to respond

**Checks:**
```bash
# Check vendor availability
SELECT COUNT(*) FROM vendors WHERE status = 'active';

# Check agent session timing
SELECT 
  agent_type,
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration
FROM agent_sessions
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY agent_type;
```

**Solution:**
- Ensure enough vendors in database
- Check network latency
- Verify OpenAI API response times
- Consider increasing SLA timeout

#### 3. Database Connection Errors

**Symptoms:** Functions failing with connection errors

**Solution:**
```bash
# Check connection pool
supabase db pooler-stats

# Increase pool size if needed
# Update supabase/config.toml:
# [db.pooler]
# pool_size = 20
```

---

## 🔄 Rollback Procedure

If issues occur in production:

### Quick Rollback

```bash
# 1. Disable all agents via feature flags
psql $DATABASE_URL -c "UPDATE feature_flags SET enabled = false WHERE key LIKE 'agent.%';"

# 2. Deploy previous webhook version
supabase functions deploy wa-webhook --project-ref lhbowpbcpwoiparwnwgt

# 3. Monitor error rates decrease
```

### Full Rollback

```bash
# 1. Rollback database migrations
supabase db diff --file migrations/rollback.sql
supabase db push --file migrations/rollback.sql

# 2. Deploy previous function versions
git checkout <previous-commit>
supabase functions deploy --all

# 3. Update environment variables
supabase secrets unset OPENAI_API_KEY
```

---

## 📞 Support Contacts

- **Technical Issues:** dev@easymo.com
- **OpenAI API Issues:** support.openai.com
- **Supabase Issues:** support.supabase.com
- **On-Call:** (Available 24/7)

---

## 📚 Additional Resources

- [AI Agents Technical Specification](./AI_AGENTS_DEEP_REVIEW_REPORT.md)
- [Complete Implementation Report](./AI_AGENTS_IMPLEMENTATION_COMPLETE.md)
- [Quick Reference Guide](./AGENTS_QUICK_REFERENCE.md)
- [Ground Rules](./GROUND_RULES.md)

---

## ✅ Final Deployment Sign-off

Before deploying to production, ensure:

- [ ] All tests passing
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] Documentation reviewed
- [ ] Team trained on monitoring
- [ ] Rollback plan tested
- [ ] Customer support briefed
- [ ] Stakeholders notified

**Sign-off Date:** __________________  
**Deployed By:** __________________  
**Approved By:** __________________

---

**Last Updated:** November 8, 2025  
**Version:** 1.0.0  
**Status:** Ready for Production Deployment 🚀
