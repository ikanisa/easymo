/**
 * Proactive Notifications System
 * Sends timely notifications to users based on agent insights
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface NotificationConfig {
  userId: string;
  agentType: string;
  notificationType: string;
  title: string;
  message: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  scheduledFor?: Date;
  metadata?: any;
}

/**
 * Proactive Notification Manager
 */
export class ProactiveNotifications {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Schedule a proactive notification
   */
  async scheduleNotification(config: NotificationConfig): Promise<string> {
    const { data, error } = await this.supabase
      .from('proactive_notifications')
      .insert({
        user_id: config.userId,
        agent_type: config.agentType,
        notification_type: config.notificationType,
        title: config.title,
        message: config.message,
        priority: config.priority || 'normal',
        scheduled_for: config.scheduledFor?.toISOString() || new Date().toISOString(),
        metadata: config.metadata || {},
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to schedule notification: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Send immediate notification
   */
  async sendImmediateNotification(config: NotificationConfig): Promise<void> {
    const notificationId = await this.scheduleNotification({
      ...config,
      scheduledFor: new Date()
    });

    await this.sendNotification(notificationId);
  }

  /**
   * Send a scheduled notification
   */
  private async sendNotification(notificationId: string): Promise<void> {
    // Get notification details
    const { data: notification, error } = await this.supabase
      .from('proactive_notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (error || !notification) {
      throw new Error('Notification not found');
    }

    try {
      // Send via WhatsApp (would integrate with WhatsApp Business API)
      console.log(`Sending notification to ${notification.user_id}:`, notification.message);

      // Update status
      await this.supabase
        .from('proactive_notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', notificationId);

    } catch (error) {
      await this.supabase
        .from('proactive_notifications')
        .update({
          status: 'failed',
          metadata: { error: error instanceof Error ? error.message : String(error) }
        })
        .eq('id', notificationId);

      throw error;
    }
  }

  /**
   * Get pending notifications for a user
   */
  async getPendingNotifications(userId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('proactive_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true });

    if (error) {
      throw new Error(`Failed to get notifications: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Example: Jobs Agent - New job matches your profile
   */
  async notifyNewJobMatch(userId: string, jobDetails: any) {
    await this.sendImmediateNotification({
      userId,
      agentType: 'jobs_agent',
      notificationType: 'new_job_match',
      title: 'New Job Match!',
      message: `We found a ${jobDetails.title} position at ${jobDetails.company} that matches your profile. Salary: ${jobDetails.salary} RWF. Reply "Jobs Agent" to learn more.`,
      priority: 'high',
      metadata: { jobId: jobDetails.id }
    });
  }

  /**
   * Example: Insurance Agent - Policy renewal reminder
   */
  async notifyPolicyRenewal(userId: string, policyDetails: any) {
    const renewalDate = new Date(policyDetails.endDate);
    renewalDate.setDate(renewalDate.getDate() - 7); // 7 days before

    await this.scheduleNotification({
      userId,
      agentType: 'insurance_agent',
      notificationType: 'policy_renewal',
      title: 'Policy Renewal Reminder',
      message: `Your ${policyDetails.type} insurance policy expires on ${policyDetails.endDate}. Reply "Insurance Agent" to renew.`,
      priority: 'normal',
      scheduledFor: renewalDate,
      metadata: { policyNumber: policyDetails.policyNumber }
    });
  }

  /**
   * Example: Waiter Agent - Table reservation reminder
   */
  async notifyReservationReminder(userId: string, reservationDetails: any) {
    const reminderTime = new Date(reservationDetails.dateTime);
    reminderTime.setHours(reminderTime.getHours() - 2); // 2 hours before

    await this.scheduleNotification({
      userId,
      agentType: 'waiter_agent',
      notificationType: 'reservation_reminder',
      title: 'Reservation Reminder',
      message: `Your table for ${reservationDetails.partySize} at ${reservationDetails.restaurant} is confirmed for ${reservationDetails.time}. See you soon!`,
      priority: 'normal',
      scheduledFor: reminderTime,
      metadata: { reservationId: reservationDetails.id }
    });
  }

  /**
   * Example: Rides Agent - Driver arriving soon
   */
  async notifyDriverArriving(userId: string, rideDetails: any) {
    await this.sendImmediateNotification({
      userId,
      agentType: 'rides_agent',
      notificationType: 'driver_arriving',
      title: 'Driver Arriving',
      message: `Your ${rideDetails.vehicleType} driver ${rideDetails.driverName} is 2 minutes away. Vehicle: ${rideDetails.vehiclePlate}`,
      priority: 'urgent',
      metadata: { rideId: rideDetails.id }
    });
  }

  /**
   * Example: Sales Agent - Follow-up reminder
   */
  async notifySalesFollowup(userId: string, leadDetails: any) {
    const followupDate = new Date(leadDetails.callbackDate);

    await this.scheduleNotification({
      userId: 'sales_team', // Internal notification
      agentType: 'sales_agent',
      notificationType: 'followup_reminder',
      title: 'Sales Follow-up',
      message: `Follow up with ${leadDetails.businessName} about easyMO. Last contact: ${leadDetails.lastContact}`,
      priority: 'normal',
      scheduledFor: followupDate,
      metadata: { leadId: leadDetails.id }
    });
  }
}
