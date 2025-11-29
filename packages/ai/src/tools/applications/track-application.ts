import { z } from 'zod';

import type { Tool } from '../../core/types';

export const trackApplicationTool: Tool = {
  name: 'track_job_application',
  description: 'Track a job application. Use this when a user says they applied for a job or wants to track an application.',
  parameters: z.object({
    jobListingId: z.string().uuid().describe('ID of the job listing'),
    notes: z.string().optional().describe('Optional notes about the application'),
    followUpDays: z.number().optional().describe('Number of days until follow-up reminder'),
  }),
  
  handler: async (params, context) => {
    const { supabase, userId } = context;
    
    if (!userId) {
      throw new Error('User must be authenticated');
    }

    const followUpDate = params.followUpDays
      ? new Date(Date.now() + params.followUpDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null;
    
    const { data, error } = await supabase
      .from('job_applications')
      .insert({
        user_id: userId,
        job_listing_id: params.jobListingId,
        notes: params.notes,
        follow_up_date: followUpDate,
        status: 'applied',
      })
      .select('*, job_listings(*)')
      .single();
    
    if (error) {
      console.error('Error tracking application:', error);
      throw new Error(`Failed to track application: ${error.message}`);
    }
    
    let message = `✅ Application tracked for: ${data.job_listings?.title || 'this position'}`;
    if (followUpDate) {
      message += `\n📅 I'll remind you to follow up on ${new Date(followUpDate).toLocaleDateString()}`;
    }
    
    return {
      success: true,
      application: data,
      message,
    };
  },
};

export const updateApplicationStatusTool: Tool = {
  name: 'update_application_status',
  description: 'Update the status of a job application. Use this when a user provides an update about their application (e.g., got an interview, received offer, rejected).',
  parameters: z.object({
    applicationId: z.string().uuid().describe('ID of the application to update'),
    status: z.enum(['applied', 'interviewing', 'offered', 'rejected', 'accepted', 'withdrawn']).describe('New status'),
    notes: z.string().optional().describe('Optional notes about the status change'),
  }),
  
  handler: async (params, context) => {
    const { supabase, userId } = context;
    
    if (!userId) {
      throw new Error('User must be authenticated');
    }

    const { data, error } = await supabase
      .from('job_applications')
      .update({
        status: params.status,
        notes: params.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.applicationId)
      .eq('user_id', userId)
      .select('*, job_listings(*)')
      .single();
    
    if (error) {
      console.error('Error updating application status:', error);
      throw new Error(`Failed to update status: ${error.message}`);
    }
    
    const statusEmojis: Record<string, string> = {
      applied: '📝',
      interviewing: '💼',
      offered: '🎉',
      rejected: '❌',
      accepted: '✅',
      withdrawn: '🚫',
    };
    
    const emoji = statusEmojis[params.status] || '📌';
    
    return {
      success: true,
      application: data,
      message: `${emoji} Status updated to: ${params.status.replace('_', ' ')}`,
    };
  },
};

export const listApplicationsTool: Tool = {
  name: 'list_job_applications',
  description: 'List all job applications for the user. Use this when a user asks to see their applications or application status.',
  parameters: z.object({
    status: z.enum(['applied', 'interviewing', 'offered', 'rejected', 'accepted', 'withdrawn', 'all']).optional().default('all').describe('Filter by status'),
  }),
  
  handler: async (params, context) => {
    const { supabase, userId } = context;
    
    if (!userId) {
      throw new Error('User must be authenticated');
    }

    let query = supabase
      .from('job_applications')
      .select('*, job_listings(*)')
      .eq('user_id', userId)
      .order('applied_at', { ascending: false });

    if (params.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching applications:', error);
      throw new Error(`Failed to fetch applications: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      return {
        applications: [],
        count: 0,
        message: 'You have no tracked applications yet.',
      };
    }

    const formattedApps = data.map((app, index) => ({
      number: index + 1,
      id: app.id,
      jobTitle: app.job_listings?.title || 'Unknown Position',
      company: app.job_listings?.posted_by || 'Unknown Company',
      status: app.status,
      appliedAt: app.applied_at,
      followUpDate: app.follow_up_date,
      notes: app.notes,
    }));
    
    return {
      applications: formattedApps,
      count: data.length,
      message: `You have ${data.length} tracked application${data.length > 1 ? 's' : ''}`,
    };
  },
};

export const setFollowUpReminderTool: Tool = {
  name: 'set_follow_up_reminder',
  description: 'Set or update a follow-up reminder for a job application',
  parameters: z.object({
    applicationId: z.string().uuid(),
    followUpDays: z.number().describe('Number of days from now'),
  }),
  
  handler: async (params, context) => {
    const { supabase, userId } = context;
    
    if (!userId) {
      throw new Error('User must be authenticated');
    }

    const followUpDate = new Date(Date.now() + params.followUpDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const { error } = await supabase
      .from('job_applications')
      .update({ 
        follow_up_date: followUpDate,
        reminder_sent: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.applicationId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error setting reminder:', error);
      throw new Error(`Failed to set reminder: ${error.message}`);
    }
    
    return {
      success: true,
      message: `📅 Follow-up reminder set for ${new Date(followUpDate).toLocaleDateString()}`,
    };
  },
};
