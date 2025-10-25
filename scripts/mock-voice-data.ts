#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function seed() {
  const now = new Date();
  const calls = Array.from({ length: 10 }).map((_, index) => {
    const started = new Date(now.getTime() - index * 60 * 60 * 1000);
    const durationSeconds = 120 + Math.floor(Math.random() * 300);
    return {
      channel: "whatsapp",
      status: "completed",
      outcome: "lead_created",
      lead_name: `Test Lead ${index + 1}`,
      lead_phone: "+2507" + Math.floor(1000000 + Math.random() * 8999999),
      started_at: started.toISOString(),
      ended_at: new Date(started.getTime() + durationSeconds * 1000).toISOString(),
      duration_seconds: durationSeconds,
      first_time_to_assistant_seconds: 3 + Math.random() * 5,
      last_note: "Demo call",
    };
  });

  const { data, error } = await supabase.from("voice_calls").insert(calls).select("id");
  if (error) {
    console.error("Failed to insert voice_calls", error);
    process.exit(1);
  }

  const callIds = data?.map((row) => row.id) ?? [];
  const followups = callIds.slice(0, 3).map((callId, index) => ({
    call_id: callId,
    scheduled_at: new Date(now.getTime() + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
    channel: "whatsapp",
    status: "pending",
    notes: "Automatic follow-up",
  }));

  const { error: followupsError } = await supabase.from("voice_followups").insert(followups);
  if (followupsError) {
    console.error("Failed to insert voice_followups", followupsError);
    process.exit(1);
  }

  console.log("Seeded", calls.length, "voice calls and", followups.length, "follow-ups");
}

seed();
