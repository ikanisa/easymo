// =====================================================
// Jobs Domain Types
// =====================================================

export interface JobIntent {
  type: "post_job" | "find_job" | "view_jobs" | "view_applications" | "help";
  confidence: number;
  keywords: string[];
}

export interface JobHandlerContext {
  phoneNumber: string;
  message: string;
  messageType: string;
  conversationHistory?: any[];
}

export interface JobHandlerResponse {
  success: boolean;
  reply: string;
  nextAction?: string;
  data?: any;
}
