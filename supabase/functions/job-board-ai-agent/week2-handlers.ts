// =====================================================
// Week 2 Tool Handlers - Saved Searches, Applications, Viewings
// =====================================================

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// =====================================================
// Saved Searches
// =====================================================

export async function handleSaveSearch(args: any, userId: string) {
  const { searchType, searchCriteria, notificationFrequency = 'daily' } = args;

  const { data, error } = await supabase
    .from('search_alerts')
    .insert({
      user_id: userId,
      search_type: searchType,
      search_criteria: searchCriteria,
      notification_frequency: notificationFrequency,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  const frequencyText = notificationFrequency === 'instant' ? 'hourly' : notificationFrequency;
  return {
    success: true,
    alertId: data.id,
    message: `✅ Search saved! You'll receive ${frequencyText} notifications when new ${searchType} listings match your criteria.`,
  };
}

export async function handleListSavedSearches(args: any, userId: string) {
  const { searchType = 'all' } = args;

  let query = supabase
    .from('search_alerts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (searchType && searchType !== 'all') {
    query = query.eq('search_type', searchType);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (!data || data.length === 0) {
    return {
      alerts: [],
      count: 0,
      message: 'You have no saved searches yet.',
    };
  }

  return {
    alerts: data,
    count: data.length,
    message: `You have ${data.length} saved search${data.length > 1 ? 'es' : ''}`,
  };
}

export async function handleDeleteSavedSearch(args: any, userId: string) {
  const { alertId } = args;

  const { error } = await supabase
    .from('search_alerts')
    .update({ is_active: false })
    .eq('id', alertId)
    .eq('user_id', userId);

  if (error) throw error;

  return {
    success: true,
    message: '✅ Search alert deleted successfully.',
  };
}

// =====================================================
// Application Tracking
// =====================================================

export async function handleTrackApplication(args: any, userId: string) {
  const { jobListingId, notes, followUpDays } = args;

  const followUpDate = followUpDays
    ? new Date(Date.now() + followUpDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : null;

  const { data, error } = await supabase
    .from('job_applications')
    .insert({
      user_id: userId,
      job_listing_id: jobListingId,
      notes,
      follow_up_date: followUpDate,
      status: 'applied',
    })
    .select('*, job_listings(*)')
    .single();

  if (error) throw error;

  let message = `✅ Application tracked for: ${data.job_listings?.title || 'this position'}`;
  if (followUpDate) {
    message += `\n📅 I'll remind you to follow up on ${new Date(followUpDate).toLocaleDateString()}`;
  }

  return {
    success: true,
    application: data,
    message,
  };
}

export async function handleUpdateApplicationStatus(args: any, userId: string) {
  const { applicationId, status, notes } = args;

  const { data, error } = await supabase
    .from('job_applications')
    .update({ status, notes })
    .eq('id', applicationId)
    .eq('user_id', userId)
    .select('*, job_listings(*)')
    .single();

  if (error) throw error;

  const statusEmojis: Record<string, string> = {
    applied: '📝',
    interviewing: '💼',
    offered: '🎉',
    rejected: '❌',
    accepted: '✅',
    withdrawn: '🚫',
  };

  const emoji = statusEmojis[status] || '📌';
  return {
    success: true,
    application: data,
    message: `${emoji} Status updated to: ${status}`,
  };
}

export async function handleListApplications(args: any, userId: string) {
  const { status = 'all' } = args;

  let query = supabase
    .from('job_applications')
    .select('*, job_listings(*)')
    .eq('user_id', userId)
    .order('applied_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (!data || data.length === 0) {
    return {
      applications: [],
      count: 0,
      message: 'You have no tracked applications yet.',
    };
  }

  return {
    applications: data,
    count: data.length,
    message: `You have ${data.length} tracked application${data.length > 1 ? 's' : ''}`,
  };
}

// =====================================================
// Property Viewings
// =====================================================

export async function handleScheduleViewing(args: any, userId: string) {
  const { propertyListingId, preferredDate, preferredTime = '10:00', notes } = args;

  const viewingDateTime = `${preferredDate}T${preferredTime}:00`;
  const viewingDate = new Date(viewingDateTime);

  const { data, error } = await supabase
    .from('property_viewings')
    .insert({
      property_id: propertyListingId,
      whatsapp_user_id: userId,
      viewing_date: viewingDate.toISOString(),
      notes,
      confirmation_status: 'pending',
    })
    .select('*, property_listings(*)')
    .single();

  if (error) throw error;

  const formattedDate = viewingDate.toLocaleDateString();
  const formattedTime = viewingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return {
    success: true,
    viewing: data,
    message: `✅ Viewing scheduled for ${formattedDate} at ${formattedTime}\n🏠 Property: ${data.property_listings?.title || 'Property'}\n📅 I'll send you a reminder 24 hours before.`,
  };
}

export async function handleListViewings(args: any, userId: string) {
  const { status = 'all' } = args;

  let query = supabase
    .from('property_viewings')
    .select('*, property_listings(*)')
    .eq('whatsapp_user_id', userId)
    .order('viewing_date', { ascending: true });

  if (status && status !== 'all') {
    query = query.eq('confirmation_status', status);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (!data || data.length === 0) {
    return {
      viewings: [],
      count: 0,
      message: 'You have no scheduled viewings.',
    };
  }

  return {
    viewings: data,
    count: data.length,
    message: `You have ${data.length} scheduled viewing${data.length > 1 ? 's' : ''}`,
  };
}

export async function handleCancelViewing(args: any, userId: string) {
  const { viewingId } = args;

  const { error } = await supabase
    .from('property_viewings')
    .update({ confirmation_status: 'cancelled' })
    .eq('id', viewingId)
    .eq('whatsapp_user_id', userId);

  if (error) throw error;

  return {
    success: true,
    message: '✅ Viewing cancelled successfully',
  };
}
