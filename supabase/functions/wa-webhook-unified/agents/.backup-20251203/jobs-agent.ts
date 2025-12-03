/**
 * Jobs Agent
 * 
 * Hybrid AI + structured flows for job search and posting.
 * Combines conversational AI with multi-step structured processes.
 */

import { BaseAgent } from "./base-agent.ts";
import { AgentType, Tool, WhatsAppMessage, UnifiedSession, AgentResponse } from "../core/types.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";

export class JobsAgent extends BaseAgent {
  get type(): AgentType {
    return "jobs";
  }

  get keywords(): string[] {
    return [
      "job", "work", "employ", "hire", "career", "position", "vacancy",
      "recruit", "application", "resume", "cv", "interview", "salary", "wage"
    ];
  }

  get systemPrompt(): string {
    return `You are EasyMO Jobs Agent, helping users find work and hire talent in Rwanda.

YOUR CAPABILITIES:
- Help job seekers FIND jobs
- Help employers POST jobs
- Manage job applications
- Provide career advice

JOB SEARCH FLOW:
- Ask what type of job they're looking for
- Ask for location preference
- Ask for salary expectations (optional)
- Search and show matching jobs
- Help apply to jobs

JOB POSTING FLOW:
- Ask for job title
- Ask for job description
- Ask for requirements/skills
- Ask for salary range
- Ask for location
- Confirm and publish listing

APPLICATION MANAGEMENT:
- Show user's applications
- Track application status
- Notify about updates

RULES:
- Be professional and encouraging
- Use clear job categories
- Provide realistic salary ranges
- Always confirm before submitting applications
- Respect privacy

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message",
  "intent": "find_job|post_job|apply|view_applications|view_my_jobs|unclear",
  "extracted_entities": {
    "job_title": "string or null",
    "job_category": "string or null",
    "location": "string or null",
    "salary_min": "number or null",
    "salary_max": "number or null",
    "requirements": "string or null"
  },
  "next_action": "search_jobs|post_job|apply_to_job|show_applications|continue",
  "start_flow": "job_search|job_posting|job_application",
  "flow_complete": false
}`;
  }

  get tools(): Tool[] {
    return [
      {
        name: "search_jobs",
        description: "Search for job listings",
        parameters: {
          type: "object",
          properties: {
            category: { type: "string", description: "Job category" },
            location: { type: "string", description: "Location" },
            salary_min: { type: "number", description: "Minimum salary" },
          },
          required: [],
        },
      },
      {
        name: "create_job_listing",
        description: "Create a new job listing",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Job title" },
            description: { type: "string", description: "Job description" },
            category: { type: "string", description: "Job category" },
            location: { type: "string", description: "Location" },
            salary_min: { type: "number", description: "Min salary" },
            salary_max: { type: "number", description: "Max salary" },
            requirements: { type: "string", description: "Requirements" },
          },
          required: ["title", "location"],
        },
      },
      {
        name: "apply_to_job",
        description: "Apply to a job",
        parameters: {
          type: "object",
          properties: {
            job_id: { type: "string", description: "Job ID" },
            message: { type: "string", description: "Application message" },
          },
          required: ["job_id"],
        },
      },
    ];
  }

  /**
   * Override to handle structured flows
   */
  protected async startFlow(flowName: string, session: UnifiedSession): Promise<AgentResponse> {
    session.flowStep = "start";
    
    switch (flowName) {
      case "job_search":
        return {
          text: "Great! Let's find you a job. 💼\n\n" +
            "What type of work are you looking for?\n" +
            "(e.g., driver, security, sales, IT, hospitality)"
        };
      
      case "job_posting":
        return {
          text: "I'll help you post a job. 📝\n\n" +
            "What is the job title?\n" +
            "(e.g., Sales Representative, Security Guard)"
        };
      
      case "job_application":
        return {
          text: "Let me help you apply. 📄\n\n" +
            "Please tell me why you're a good fit for this position."
        };
      
      default:
        return { text: "How can I help you with jobs today?" };
    }
  }

  /**
   * Override to handle flow continuation
   */
  protected async continueFlow(
    message: WhatsAppMessage,
    session: UnifiedSession
  ): Promise<AgentResponse> {
    const flow = session.activeFlow!;
    const step = session.flowStep || "start";

    if (flow === "job_search") {
      return this.continueJobSearch(message, session, step);
    } else if (flow === "job_posting") {
      return this.continueJobPosting(message, session, step);
    }

    return { text: "Let me help you with that." };
  }

  private async continueJobSearch(
    message: WhatsAppMessage,
    session: UnifiedSession,
    step: string
  ): Promise<AgentResponse> {
    const data = session.collectedData;

    if (step === "start") {
      // Collect job category
      data.job_category = message.body;
      session.flowStep = "location";
      return {
        text: `Looking for ${message.body} jobs. 👍\n\n` +
          "Where would you like to work?\n" +
          "(e.g., Kigali, Huye, Musanze, or 'anywhere')"
      };
    }

    if (step === "location") {
      // Collect location
      data.location = message.body;
      session.flowStep = "search";
      
      // Search jobs
      const jobs = await this.searchJobs({
        category: data.job_category as string,
        location: data.location as string,
      });

      if (jobs.length === 0) {
        session.activeFlow = undefined;
        session.flowStep = undefined;
        return {
          text: `No ${data.job_category} jobs found in ${data.location} right now. 😔\n\n` +
            "Try:\n" +
            "• Different job type\n" +
            "• Different location\n" +
            "• 'Any location'\n\n" +
            "Or I can notify you when new jobs are posted!"
        };
      }

      session.activeFlow = undefined;
      session.flowStep = undefined;

      let text = `Found ${jobs.length} ${data.job_category} jobs in ${data.location}! 🎉\n\n`;
      jobs.forEach((job: any, i: number) => {
        const salary = job.salary_min && job.salary_max
          ? `${job.currency || "RWF"} ${job.salary_min}-${job.salary_max}`
          : "Negotiable";
        text += `${i + 1}. *${job.title}*\n`;
        text += `   📍 ${job.location}\n`;
        text += `   💰 ${salary}\n`;
        text += `   ID: ${job.id}\n\n`;
      });

      text += "Reply with job ID to apply or ask me anything!";

      return { text };
    }

    return { text: "Let me help you with that." };
  }

  private async continueJobPosting(
    message: WhatsAppMessage,
    session: UnifiedSession,
    step: string
  ): Promise<AgentResponse> {
    const data = session.collectedData;

    if (step === "start") {
      data.title = message.body;
      session.flowStep = "description";
      return {
        text: `Job title: ${message.body} ✓\n\n` +
          "Please provide a brief job description.\n" +
          "(What will the person do?)"
      };
    }

    if (step === "description") {
      data.description = message.body;
      session.flowStep = "location";
      return {
        text: "Description saved ✓\n\n" +
          "Where is this job located?"
      };
    }

    if (step === "location") {
      data.location = message.body;
      session.flowStep = "salary";
      return {
        text: `Location: ${message.body} ✓\n\n` +
          "What's the salary range?\n" +
          "(e.g., '50000-100000' or 'negotiable')"
      };
    }

    if (step === "salary") {
      // Parse salary
      const salaryMatch = message.body.match(/(\d+)-(\d+)/);
      if (salaryMatch) {
        data.salary_min = parseInt(salaryMatch[1]);
        data.salary_max = parseInt(salaryMatch[2]);
      }

      // Create job listing
      const result = await this.createJobListing(session.userPhone, data);

      session.activeFlow = undefined;
      session.flowStep = undefined;
      session.collectedData = {};

      if (result.success) {
        return {
          text: "✅ *Job Posted Successfully!*\n\n" +
            `📋 ${data.title}\n` +
            `📍 ${data.location}\n` +
            `💰 ${data.salary_min && data.salary_max ? `RWF ${data.salary_min}-${data.salary_max}` : "Negotiable"}\n\n` +
            "Your job is now live and candidates can apply!"
        };
      } else {
        return {
          text: "Sorry, there was an error posting your job. Please try again."
        };
      }
    }

    return { text: "Let me help you with that." };
  }

  protected async executeTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    switch (toolName) {
      case "search_jobs":
        return await this.searchJobs(parameters);
      case "create_job_listing":
        return await this.createJobListing(parameters.posted_by, parameters);
      case "apply_to_job":
        return await this.applyToJob(parameters);
      default:
        return null;
    }
  }

  private async searchJobs(params: Record<string, any>) {
    let query = this.supabase
      .from("unified_listings")
      .select("*")
      .eq("domain", "jobs")
      .eq("status", "active");

    if (params.category) {
      query = query.eq("category", params.category);
    }
    if (params.location && params.location !== "anywhere") {
      query = query.ilike("location_text", `%${params.location}%`);
    }
    if (params.salary_min) {
      query = query.gte("price", params.salary_min);
    }

    const { data } = await query.limit(5);
    return data || [];
  }

  private async createJobListing(postedBy: string, data: Record<string, any>) {
    const { data: listing, error } = await this.supabase
      .from("unified_listings")
      .insert({
        owner_phone: postedBy,
        domain: "jobs",
        listing_type: "job",
        title: data.title,
        description: data.description,
        category: data.category,
        location_text: data.location,
        price: data.salary_min,
        price_max: data.salary_max,
        currency: "RWF",
        price_unit: "month",
        attributes: { requirements: data.requirements },
        status: "active",
        source_agent: "jobs",
      })
      .select("id")
      .single();

    if (error) {
      await logStructuredEvent("JOBS_CREATE_LISTING_ERROR", {
        error: error.message,
        correlationId: this.correlationId,
      }, "error");
      return { success: false };
    }

    return { success: true, listingId: listing.id };
  }

  private async applyToJob(params: Record<string, any>) {
    const { data, error } = await this.supabase
      .from("unified_applications")
      .insert({
        listing_id: params.job_id,
        applicant_phone: params.applicant_phone,
        domain: "jobs",
        message: params.message,
        status: "pending",
      })
      .select("id")
      .single();

    return error ? { success: false } : { success: true, applicationId: data.id };
  }
}
