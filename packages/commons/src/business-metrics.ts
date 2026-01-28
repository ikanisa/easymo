import { Counter, Gauge, Histogram } from 'prom-client';

import { MetricsRegistry } from './metrics';
import { validatePaymentMethod } from './payment-methods';

/**
 * EasyMO-specific business metrics
 * These are standardized metrics across all services
 */
export class BusinessMetrics {

  // Ride Metrics
  public rideRequestsTotal: Counter;
  public rideRequestsAccepted: Counter;
  public rideRequestsRejected: Counter;
  public rideDuration: Histogram;
  public activeRides: Gauge;

  // Payment Metrics
  public paymentTransactionsTotal: Counter;
  public paymentAmount: Histogram;
  public paymentFailures: Counter;

  // WhatsApp Metrics
  public whatsappMessagesTotal: Counter;
  public whatsappDeliveryFailures: Counter;

  // Database Metrics
  public dbConnectionsActive: Gauge;
  public dbQueryDuration: Histogram;
  public dbErrors: Counter;

  // User Metrics
  public userSignups: Counter;
  public activeUsers: Gauge;
  public userSessions: Gauge;

  // Agent Metrics
  public agentOnlineCount: Gauge;
  public agentResponseTime: Histogram;

  constructor(metricsRegistry: MetricsRegistry) {
    const registry = metricsRegistry.getRegistry();

    // Ride Metrics
    this.rideRequestsTotal = new Counter({
      name: 'ride_requests_total',
      help: 'Total number of ride requests',
      labelNames: ['status', 'service_type'],
      registers: [registry],
    });

    this.rideRequestsAccepted = new Counter({
      name: 'ride_requests_accepted_total',
      help: 'Total number of accepted ride requests',
      labelNames: ['service_type'],
      registers: [registry],
    });

    this.rideRequestsRejected = new Counter({
      name: 'ride_requests_rejected_total',
      help: 'Total number of rejected ride requests',
      labelNames: ['service_type', 'reason'],
      registers: [registry],
    });

    this.rideDuration = new Histogram({
      name: 'ride_duration_seconds',
      help: 'Duration of completed rides',
      labelNames: ['service_type'],
      buckets: [60, 300, 600, 1200, 1800, 3600, 7200],
      registers: [registry],
    });

    this.activeRides = new Gauge({
      name: 'active_rides',
      help: 'Number of currently active rides',
      labelNames: ['service_type'],
      registers: [registry],
    });

    // Payment Metrics
    this.paymentTransactionsTotal = new Counter({
      name: 'payment_transactions_total',
      help: 'Total payment transactions',
      labelNames: ['status', 'payment_method'],
      registers: [registry],
    });

    this.paymentAmount = new Histogram({
      name: 'payment_amount_usd',
      help: 'Payment transaction amounts in USD',
      labelNames: ['payment_method'],
      buckets: [1, 5, 10, 20, 50, 100, 200, 500, 1000],
      registers: [registry],
    });

    this.paymentFailures = new Counter({
      name: 'payment_failures_total',
      help: 'Total payment failures',
      labelNames: ['payment_method', 'error_code'],
      registers: [registry],
    });

    // WhatsApp Metrics
    this.whatsappMessagesTotal = new Counter({
      name: 'whatsapp_messages_total',
      help: 'Total WhatsApp messages',
      labelNames: ['status', 'message_type'],
      registers: [registry],
    });

    this.whatsappDeliveryFailures = new Counter({
      name: 'whatsapp_delivery_failures_total',
      help: 'Total WhatsApp delivery failures',
      labelNames: ['error_code'],
      registers: [registry],
    });

    // Database Metrics
    this.dbConnectionsActive = new Gauge({
      name: 'db_connections_active',
      help: 'Active database connections',
      labelNames: ['database'],
      registers: [registry],
    });

    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Database query duration',
      labelNames: ['query_type', 'table'],
      buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [registry],
    });

    this.dbErrors = new Counter({
      name: 'db_errors_total',
      help: 'Total database errors',
      labelNames: ['error_type'],
      registers: [registry],
    });

    // User Metrics
    this.userSignups = new Counter({
      name: 'user_signups_total',
      help: 'Total user signups',
      labelNames: ['user_type'],
      registers: [registry],
    });

    this.activeUsers = new Gauge({
      name: 'active_users',
      help: 'Number of currently active users',
      labelNames: ['user_type'],
      registers: [registry],
    });

    this.userSessions = new Gauge({
      name: 'user_sessions',
      help: 'Number of active user sessions',
      labelNames: ['user_type'],
      registers: [registry],
    });

    // Agent Metrics
    this.agentOnlineCount = new Gauge({
      name: 'agents_online',
      help: 'Number of online AI agents',
      labelNames: ['agent_type'],
      registers: [registry],
    });

    this.agentResponseTime = new Histogram({
      name: 'agent_response_time_seconds',
      help: 'AI agent response time',
      labelNames: ['agent_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [registry],
    });
  }

  /**
   * Helper methods for common operations
   */

  trackRideRequest(serviceType: string, status: 'pending' | 'accepted' | 'rejected') {
    this.rideRequestsTotal.inc({ status, service_type: serviceType });
    if (status === 'pending') {
      this.activeRides.inc({ service_type: serviceType });
    }
  }

  trackRideAcceptance(serviceType: string) {
    this.rideRequestsAccepted.inc({ service_type: serviceType });
  }

  trackRideRejection(serviceType: string, reason: string) {
    this.rideRequestsRejected.inc({ service_type: serviceType, reason });
    this.activeRides.dec({ service_type: serviceType });
  }

  trackRideCompletion(serviceType: string, durationSeconds: number) {
    this.rideDuration.observe({ service_type: serviceType }, durationSeconds);
    this.activeRides.dec({ service_type: serviceType });
  }

  trackPayment(paymentMethod: string, amount: number, status: 'success' | 'failed', errorCode?: string) {
    // Validate payment method
    validatePaymentMethod(paymentMethod);

    this.paymentTransactionsTotal.inc({ status, payment_method: paymentMethod });

    if (status === 'success') {
      this.paymentAmount.observe({ payment_method: paymentMethod }, amount);
    } else if (errorCode) {
      this.paymentFailures.inc({ payment_method: paymentMethod, error_code: errorCode });
    }
  }

  trackWhatsAppMessage(messageType: string, status: 'sent' | 'delivered' | 'failed', errorCode?: string) {
    this.whatsappMessagesTotal.inc({ status, message_type: messageType });

    if (status === 'failed' && errorCode) {
      this.whatsappDeliveryFailures.inc({ error_code: errorCode });
    }
  }

  trackDatabaseQuery(queryType: string, table: string, durationSeconds: number, error?: boolean) {
    this.dbQueryDuration.observe({ query_type: queryType, table }, durationSeconds);

    if (error) {
      this.dbErrors.inc({ error_type: 'query_error' });
    }
  }

  trackUserSignup(userType: 'rider' | 'driver' | 'agent') {
    this.userSignups.inc({ user_type: userType });
  }

  setActiveUsers(userType: string, count: number) {
    this.activeUsers.set({ user_type: userType }, count);
  }

  setUserSessions(userType: string, count: number) {
    this.userSessions.set({ user_type: userType }, count);
  }

  setAgentsOnline(agentType: string, count: number) {
    this.agentOnlineCount.set({ agent_type: agentType }, count);
  }

  trackAgentResponse(agentType: string, durationSeconds: number) {
    this.agentResponseTime.observe({ agent_type: agentType }, durationSeconds);
  }
}

/**
 * Create business metrics for a service
 */
export function createBusinessMetrics(metricsRegistry: MetricsRegistry): BusinessMetrics {
  return new BusinessMetrics(metricsRegistry);
}
