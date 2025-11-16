// =====================================================
// Jobs Domain Utilities
// =====================================================

import { JobIntent } from "./types.ts";

export function detectJobIntent(message: string): JobIntent {
  const lower = message.toLowerCase();
  
  // Keywords for posting jobs
  const postKeywords = [
    "need", "hire", "looking for", "hiring", "need someone", "want to hire",
    "job available", "position open", "seeking", "recruiting", "need help with"
  ];
  
  // Keywords for finding jobs
  const findKeywords = [
    "looking for work", "need work", "need job", "find job", "available for",
    "can work", "want to work", "seeking employment", "job search", "hire me"
  ];
  
  // Keywords for viewing own content
  const viewKeywords = [
    "my jobs", "my posts", "my listings", "jobs i posted", "show my jobs",
    "my applications", "jobs i applied", "where did i apply"
  ];
  
  // Calculate scores
  const postScore = postKeywords.filter(k => lower.includes(k)).length;
  const findScore = findKeywords.filter(k => lower.includes(k)).length;
  const viewScore = viewKeywords.filter(k => lower.includes(k)).length;
  
  // Determine intent
  if (viewScore > 0) {
    return {
      type: lower.includes("application") ? "view_applications" : "view_jobs",
      confidence: 0.9,
      keywords: viewKeywords.filter(k => lower.includes(k))
    };
  }
  
  if (postScore > findScore) {
    return {
      type: "post_job",
      confidence: Math.min(0.9, 0.6 + postScore * 0.15),
      keywords: postKeywords.filter(k => lower.includes(k))
    };
  }
  
  if (findScore > 0) {
    return {
      type: "find_job",
      confidence: Math.min(0.9, 0.6 + findScore * 0.15),
      keywords: findKeywords.filter(k => lower.includes(k))
    };
  }
  
  // Default to help if unclear
  return {
    type: "help",
    confidence: 0.5,
    keywords: []
  };
}

export function shouldRouteToJobAgent(message: string): boolean {
  const intent = detectJobIntent(message);
  return intent.confidence > 0.6 || intent.type !== "help";
}

export function formatJobsForWhatsApp(jobs: any[]): string {
  if (jobs.length === 0) {
    return "No matching jobs found at the moment. Try adjusting your search or check back later!";
  }
  
  let response = `📋 *Found ${jobs.length} matching jobs:*\n\n`;
  
  jobs.slice(0, 5).forEach((job, index) => {
    const payInfo = job.pay_min && job.pay_max
      ? `${job.pay_min}-${job.pay_max} RWF`
      : job.pay_min
      ? `${job.pay_min}+ RWF`
      : "Negotiable";
    
    response += `${index + 1}. *${job.title}*\n`;
    response += `   📍 ${job.location}\n`;
    response += `   💰 ${payInfo} (${job.pay_type})\n`;
    response += `   🏷️ ${job.category}\n`;
    if (job.similarity_score) {
      response += `   ✨ ${Math.round(job.similarity_score * 100)}% match\n`;
    }
    response += `   _ID: ${job.id}_\n\n`;
  });
  
  if (jobs.length > 5) {
    response += `\n_...and ${jobs.length - 5} more jobs available_\n`;
  }
  
  response += `\nReply with the job number or ID to learn more!`;
  
  return response;
}

export function formatApplicantsForWhatsApp(applicants: any[]): string {
  if (applicants.length === 0) {
    return "No applicants yet. I'll notify you when someone expresses interest!";
  }
  
  let response = `👥 *${applicants.length} Applicants:*\n\n`;
  
  applicants.slice(0, 10).forEach((match, index) => {
    const seeker = match.job_seekers;
    const matchPercent = Math.round(match.similarity_score * 100);
    
    response += `${index + 1}. *${seeker.name || "Job Seeker"}*\n`;
    response += `   📱 ${seeker.phone_number}\n`;
    response += `   💪 ${seeker.skills?.slice(0, 3).join(", ") || "Various skills"}\n`;
    if (seeker.experience_years) {
      response += `   📅 ${seeker.experience_years} years experience\n`;
    }
    if (seeker.rating) {
      response += `   ⭐ ${seeker.rating}/5.0 (${seeker.total_jobs_completed} jobs)\n`;
    }
    response += `   ✨ ${matchPercent}% match\n`;
    if (match.seeker_message) {
      response += `   💬 "${match.seeker_message}"\n`;
    }
    response += `\n`;
  });
  
  response += `\nReply with a number to view full profile or contact directly!`;
  
  return response;
}
