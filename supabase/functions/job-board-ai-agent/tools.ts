// =====================================================
// JOB BOARD AI AGENT - Tool Definitions
// =====================================================

export const tools = [
  {
    type: "function",
    function: {
      name: "extract_job_metadata",
      description: "Extract structured metadata from a natural language job description. Use this when user describes a job they want to post.",
      parameters: {
        type: "object",
        properties: {
          user_input: {
            type: "string",
            description: "The user's natural language job description"
          }
        },
        required: ["user_input"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "post_job",
      description: "Create a new job listing with extracted metadata. Confirm with user before calling.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Job title" },
          description: { type: "string", description: "Full job description" },
          category: { type: "string", description: "Job category" },
          job_type: { 
            type: "string", 
            enum: ["gig", "part_time", "full_time", "contract", "temporary"] 
          },
          location: { type: "string", description: "Job location" },
          location_details: { type: "string", description: "Specific address or landmark" },
          pay_min: { type: "number", description: "Minimum pay" },
          pay_max: { type: "number", description: "Maximum pay" },
          pay_type: { 
            type: "string", 
            enum: ["hourly", "daily", "weekly", "monthly", "fixed", "commission", "negotiable"] 
          },
          duration: { type: "string", description: "Job duration (e.g., '1 day', 'permanent')" },
          start_date: { type: "string", description: "Start date (ISO or relative)" },
          flexible_hours: { type: "boolean" },
          required_skills: { 
            type: "array", 
            items: { type: "string" },
            description: "List of required skills"
          },
          experience_level: { 
            type: "string",
            enum: ["none", "beginner", "intermediate", "expert", "any"]
          },
          physical_demands: { type: "string" },
          tools_needed: { type: "array", items: { type: "string" } },
          transport_provided: { type: "boolean" },
          team_size: { type: "string" },
          weather_dependent: { type: "boolean" },
          expires_in_days: { type: "number", description: "Days until job expires (default 7 for gigs, 30 for others)" }
        },
        required: ["title", "description", "category", "job_type", "location"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_jobs",
      description: "Search for jobs matching a job seeker's skills and preferences. Returns ranked matches.",
      parameters: {
        type: "object",
        properties: {
          skills_query: { 
            type: "string", 
            description: "Natural language description of skills and preferences" 
          },
          job_types: {
            type: "array",
            items: { 
              type: "string",
              enum: ["gig", "part_time", "full_time", "contract", "temporary"]
            },
            description: "Filter by job types"
          },
          categories: {
            type: "array",
            items: { type: "string" },
            description: "Filter by categories"
          },
          locations: {
            type: "array",
            items: { type: "string" },
            description: "Preferred locations"
          },
          min_pay: { type: "number", description: "Minimum acceptable pay" },
          max_results: { type: "number", description: "Number of results to return (default 10)" }
        },
        required: ["skills_query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_seeker_profile",
      description: "Create or update a job seeker's profile with skills and preferences.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          bio: { type: "string", description: "Short bio" },
          skills: { 
            type: "array", 
            items: { type: "string" },
            description: "List of skills"
          },
          experience_years: { type: "number" },
          certifications: { type: "array", items: { type: "string" } },
          languages: { type: "array", items: { type: "string" } },
          preferred_job_types: { 
            type: "array", 
            items: { type: "string" } 
          },
          preferred_categories: { type: "array", items: { type: "string" } },
          preferred_locations: { type: "array", items: { type: "string" } },
          availability: {
            type: "object",
            properties: {
              immediate: { type: "boolean" },
              days: { type: "array", items: { type: "string" } },
              times: { type: "string" },
              start_date: { type: "string" }
            }
          },
          min_pay: { type: "number" },
          has_transportation: { type: "boolean" },
          transportation_type: { type: "string" }
        },
        required: ["skills"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "express_interest",
      description: "Express interest in a job on behalf of the seeker. Creates a match and notifies the poster.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "UUID of the job" },
          message: { type: "string", description: "Optional message to the employer" },
          proposed_rate: { type: "number", description: "Optional proposed rate if negotiable" }
        },
        required: ["job_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "view_applicants",
      description: "View applicants/interested seekers for a job. Only for job posters.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "UUID of the job" },
          min_match_score: { 
            type: "number", 
            description: "Minimum match score (0-1, default 0.7)" 
          }
        },
        required: ["job_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_my_jobs",
      description: "Get jobs posted by the current user.",
      parameters: {
        type: "object",
        properties: {
          status: { 
            type: "string",
            enum: ["open", "filled", "closed", "expired", "all"],
            description: "Filter by status (default 'open')"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_my_applications",
      description: "Get jobs the current seeker has applied to or expressed interest in.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["suggested", "viewed", "contacted", "hired", "rejected", "all"],
            description: "Filter by status (default 'all')"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_job_status",
      description: "Update the status of a job (e.g., mark as filled or closed). Only for job poster.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "UUID of the job" },
          status: {
            type: "string",
            enum: ["open", "filled", "closed", "paused"],
            description: "New status"
          }
        },
        required: ["job_id", "status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_job_details",
      description: "Get detailed information about a specific job.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "UUID of the job" }
        },
        required: ["job_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "google_search",
      description: "Perform a Google Search to find external job listings or information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          num_results: { type: "number", description: "Number of results (default 10)" },
          country: { type: "string", description: "Country code (e.g., 'mt')" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Perform a deep web search using OpenAI's browsing capabilities.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "google_search",
      description: "Perform a Google Search to find external job listings or information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          num_results: { type: "number", description: "Number of results (default 10)" },
          country: { type: "string", description: "Country code (e.g., 'mt')" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Perform a deep web search using OpenAI's browsing capabilities.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" }
        },
        required: ["query"]
      }
    }
  }
];
