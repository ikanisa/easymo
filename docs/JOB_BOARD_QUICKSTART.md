# Job Board AI Agent - 5-Minute Quickstart 🚀

## What Is This?

A WhatsApp bot that lets people **post jobs** and **find work** using natural conversation. No forms, no apps—just chat!

**Example**:
```
👤 User: "I need someone to help move furniture tomorrow in Kigali, paying 10k"
🤖 Bot:  "Job posted! I've notified 5 matching workers."
```

## Prerequisites (5 min)

1. **OpenAI API Key**: Get from https://platform.openai.com/api-keys
2. **Supabase Project**: Have project URL and service role key
3. **Tools Installed**:
   ```bash
   supabase --version  # Need ≥1.110.0
   pnpm --version      # Need ≥10.18.3
   ```

## Deploy in 3 Steps (15 min)

### Step 1: Database (3 min)

```bash
cd /Users/jeanbosco/workspace/easymo-

# Apply migration
supabase db push

# Verify (should show 7 tables)
supabase db run "SELECT table_name FROM information_schema.tables 
                 WHERE table_schema = 'public' 
                 AND table_name LIKE 'job_%'"
```

**Expected output**:
```
job_listings
job_seekers
job_matches
job_conversations
job_applications
job_analytics
job_categories
```

✅ **Done? Move to Step 2**

### Step 2: Edge Function (5 min)

```bash
# Set OpenAI API key
supabase secrets set OPENAI_API_KEY=sk-your-key-here

# Deploy function
supabase functions deploy job-board-ai-agent

# Test it works
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/job-board-ai-agent \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -d '{"phone_number": "+250788000001", "message": "I need help"}'
```

**Expected**: JSON response with AI message

✅ **Done? Move to Step 3**

### Step 3: WhatsApp Integration (5 min)

Update wa-webhook to route job messages:

```typescript
// supabase/functions/wa-webhook/index.ts or router
import { handleJobDomain, isJobDomainMessage } from "./domains/jobs/handler.ts";

// In your message handler:
if (isJobDomainMessage(message)) {
  const response = await handleJobDomain({
    phoneNumber: from,
    message,
    messageType: type
  });
  await sendWhatsAppMessage(from, response.reply);
  return;
}
```

Redeploy:
```bash
supabase functions deploy wa-webhook
```

✅ **Done? Test it!**

## Test (2 min)

Send WhatsApp message to your business number:

```
"I need someone to deliver packages tomorrow, paying 8k per day"
```

**Expected Response**:
```
I'll create that job posting for you:

📦 Package Delivery Driver
📍 Location: [asking if not provided]
💰 8,000 RWF/day
🗓️ Start: Tomorrow

Is this correct?
```

Reply: `"Yes"`

**Expected**:
```
✅ Job posted! I've notified matching workers.
Job ID: abc-123-def
```

## View Dashboard (Optional, 2 min)

```bash
cd admin-app
npm run dev
```

Navigate to: `http://localhost:3000/jobs`

You should see:
- Total jobs: 1
- Open jobs: 1
- Recent job listing

## Common Issues

### ❌ "Extension vector does not exist"

**Fix**:
```bash
supabase db run "CREATE EXTENSION IF NOT EXISTS vector"
```

### ❌ "OPENAI_API_KEY not found"

**Fix**:
```bash
supabase secrets set OPENAI_API_KEY=sk-...
supabase functions deploy job-board-ai-agent
```

### ❌ "No matches created"

**Check embeddings**:
```bash
supabase db run "SELECT id, title, required_skills_embedding IS NOT NULL 
                 FROM job_listings LIMIT 5"
```

Should show `true` for embeddings.

### ❌ "Function timeout"

OpenAI API might be slow. Check:
```bash
supabase functions logs job-board-ai-agent --tail
```

## What Next?

### Try These Flows

1. **Post another job**:
   ```
   "Need construction worker for 3 days, concrete work, 15k daily"
   ```

2. **Search for work**:
   ```
   "Looking for delivery jobs, I have a motorcycle"
   ```

3. **View your jobs**:
   ```
   "Show my jobs"
   ```

4. **Express interest** (as seeker):
   ```
   First: "Looking for work..."
   Bot shows jobs
   You: "1" (select job #1)
   Bot shows details
   You: "Yes interested"
   ```

### Add Features

- **Notifications**: Send WhatsApp templates when matches occur
- **Ratings**: Add 5-star system after job completion
- **Photos**: Let users upload job site photos
- **Voice**: Accept voice message job descriptions

### Monitor

```bash
# View logs
supabase functions logs job-board-ai-agent --tail

# Check analytics
supabase db run "SELECT event_type, COUNT(*) 
                 FROM job_analytics 
                 GROUP BY event_type 
                 ORDER BY COUNT(*) DESC"

# See recent jobs
supabase db run "SELECT id, title, category, status 
                 FROM job_listings 
                 ORDER BY created_at DESC 
                 LIMIT 10"
```

## Architecture (1 min)

```
WhatsApp → wa-webhook → job-board-ai-agent → Database
                ↓                ↓
            Intent         OpenAI GPT-4
          Detection      + Embeddings
                               ↓
                         Vector Search
                               ↓
                          Matches!
```

## Key Files

- **Database**: `supabase/migrations/20251114220000_job_board_system.sql`
- **Edge Function**: `supabase/functions/job-board-ai-agent/index.ts`
- **WhatsApp**: `supabase/functions/wa-webhook/domains/jobs/handler.ts`
- **Admin**: `admin-app/app/(panel)/jobs/page.tsx`

## Full Documentation

- **Design**: `docs/JOB_BOARD_AI_AGENT_DESIGN.md`
- **Usage**: `docs/JOB_BOARD_README.md`
- **Deployment**: `docs/JOB_BOARD_DEPLOYMENT.md`
- **Summary**: `docs/JOB_BOARD_SUMMARY.md`

## Support

**Stuck?** Check:
1. Function logs: `supabase functions logs job-board-ai-agent`
2. Database logs: `SELECT * FROM job_analytics ORDER BY created_at DESC`
3. Full docs in `/docs` folder

**Questions?** See `JOB_BOARD_README.md` troubleshooting section.

## Cost

**For 1,000 users/month**:
- OpenAI: ~$33 (embeddings + chat)
- Supabase: $25 (shared across features)
- **Total**: ~$58/month = **$0.058 per user**

Very affordable! 💰

## Success!

You now have a fully functional AI-powered job marketplace running on WhatsApp! 🎉

**Next Steps**:
1. ✅ Invite users to test
2. ✅ Monitor dashboard metrics
3. ✅ Gather feedback
4. ✅ Iterate and improve

---

**Quickstart Version**: 1.0
**Total Time**: ~20 minutes
**Status**: Ready to Go! 🚀
