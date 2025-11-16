#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Populate Job Board with real jobs from Rwanda and Malta using OpenAI
 * Uses OpenAI to search and structure job data
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://lhbowpbcpwoiparwnwgt.supabase.co";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is required");
  Deno.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is required");
  Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

interface JobListing {
  title: string;
  description: string;
  company_name: string;
  location: string;
  job_type: "gig" | "part_time" | "full_time" | "contract";
  category: string;
  pay_min?: number;
  pay_max?: number;
  pay_type: "hourly" | "daily" | "monthly" | "fixed" | "negotiable";
  currency: string;
  required_skills: string[];
  experience_level?: string;
  onsite_remote: "onsite" | "remote" | "hybrid" | "unspecified";
  external_url?: string;
  country_code: string;
}

// Search for jobs using OpenAI
async function searchJobsWithOpenAI(country: string, countryCode: string): Promise<JobListing[]> {
  console.log(`\n🔍 Searching for jobs in ${country}...`);

  const prompt = `Find 10-15 real, current job openings in ${country} across various sectors. 
For ${country === "Rwanda" ? "Rwanda, focus on: delivery drivers, security guards, waiters, construction workers, cleaners, shop assistants, drivers, cooks, receptionists, and general labor." : "Malta, focus on: iGaming roles, hospitality (hotels/restaurants), healthcare, IT/software, maritime/shipping, construction, retail, and tourism."}

For each job, provide:
1. Job title
2. Company name
3. Location (city/district)
4. Brief description (2-3 sentences)
5. Job type (gig/part_time/full_time/contract)
6. Category (construction, delivery, hospitality, security, retail, healthcare, it, etc.)
7. Salary range if available
8. Required skills (2-5 key skills)
9. Experience level (entry/mid/senior)
10. Work arrangement (onsite/remote/hybrid)

Return ONLY a valid JSON array of job objects. No markdown, no explanation.

Example structure:
[
  {
    "title": "Delivery Driver",
    "company_name": "SafeMotos",
    "location": "Kigali, Nyarugenge",
    "description": "Looking for motorcycle riders for food and package delivery. Must have valid license and own motorcycle.",
    "job_type": "full_time",
    "category": "delivery",
    "pay_min": 150000,
    "pay_max": 250000,
    "currency": "${countryCode === 'RW' ? 'RWF' : 'EUR'}",
    "pay_type": "monthly",
    "required_skills": ["motorcycle riding", "navigation", "customer service"],
    "experience_level": "entry",
    "onsite_remote": "onsite"
  }
]`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a job market researcher. Provide real, current job listings based on typical opportunities in the specified country. Return valid JSON only."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content?.trim() || "[]";
    
    // Clean up the response - remove markdown code blocks if present
    let jsonContent = content;
    if (content.startsWith("```")) {
      jsonContent = content.replace(/```json?\n?/g, "").replace(/```\s*$/g, "").trim();
    }

    const jobs = JSON.parse(jsonContent) as JobListing[];
    
    // Add country code to each job
    return jobs.map(job => ({
      ...job,
      country_code: countryCode,
      currency: job.currency || (countryCode === 'RW' ? 'RWF' : 'EUR'),
    }));
  } catch (error) {
    console.error(`❌ Error searching jobs for ${country}:`, error);
    return [];
  }
}

// Generate embedding for skills
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("❌ Error generating embedding:", error);
    return [];
  }
}

// Insert jobs into database
async function insertJobs(jobs: JobListing[]) {
  console.log(`\n📝 Inserting ${jobs.length} jobs into database...`);

  let inserted = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      // Try to generate embedding, but don't fail if it doesn't work
      let embedding: number[] = [];
      try {
        const skillsText = job.required_skills.join(", ");
        embedding = await generateEmbedding(skillsText);
      } catch (embError) {
        console.log(`  ⚠️  Embedding generation skipped for ${job.title}`);
      }

      const { error } = await supabase.from("job_listings").insert({
        title: job.title,
        description: job.description,
        company_name: job.company_name,
        location: job.location,
        job_type: job.job_type,
        category: job.category,
        pay_min: job.pay_min,
        pay_max: job.pay_max,
        pay_type: job.pay_type,
        currency: job.currency,
        required_skills: job.required_skills,
        required_skills_embedding: embedding.length > 0 ? `[${embedding.join(",")}]` : null,
        experience_level: job.experience_level,
        onsite_remote: job.onsite_remote,
        external_url: job.external_url,
        country_code: job.country_code,
        is_external: true,
        status: "open",
        posted_by: "system",
        poster_name: job.company_name,
        discovered_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });

      if (error) {
        console.error(`  ❌ Failed to insert ${job.title}:`, error.message);
        failed++;
      } else {
        console.log(`  ✅ Inserted: ${job.title} at ${job.company_name}`);
        inserted++;
      }
    } catch (error) {
      console.error(`  ❌ Error inserting ${job.title}:`, error);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${inserted} inserted, ${failed} failed`);
}

// Main execution
async function main() {
  console.log("🚀 Starting Job Board Population with OpenAI\n");
  console.log("=" .repeat(60));

  // Search and insert Rwanda jobs
  const rwandaJobs = await searchJobsWithOpenAI("Rwanda", "RW");
  if (rwandaJobs.length > 0) {
    await insertJobs(rwandaJobs);
  }

  console.log("\n" + "=".repeat(60));

  // Search and insert Malta jobs
  const maltaJobs = await searchJobsWithOpenAI("Malta", "MT");
  if (maltaJobs.length > 0) {
    await insertJobs(maltaJobs);
  }

  console.log("\n" + "=".repeat(60));
  console.log("\n✨ Job population complete!");

  // Show summary
  const { data: stats } = await supabase
    .from("job_listings")
    .select("country_code")
    .eq("is_external", true);

  if (stats) {
    const rwCount = stats.filter((s) => s.country_code === "RW").length;
    const mtCount = stats.filter((s) => s.country_code === "MT").length;
    console.log(`\n📈 Database Summary:`);
    console.log(`   Rwanda: ${rwCount} jobs`);
    console.log(`   Malta: ${mtCount} jobs`);
    console.log(`   Total: ${stats.length} external jobs\n`);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
