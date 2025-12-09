import { Counter, Gauge, Histogram } from 'prom-client';
import { MetricsRegistry } from './metrics';
/**
 * EasyMO-specific business metrics
 * These are standardized metrics across all services
 */
export declare class BusinessMetrics {
    private metricsRegistry;
    rideRequestsTotal: Counter;
    rideRequestsAccepted: Counter;
    rideRequestsRejected: Counter;
    rideDuration: Histogram;
    activeRides: Gauge;
    paymentTransactionsTotal: Counter;
    paymentAmount: Histogram;
    paymentFailures: Counter;
    whatsappMessagesTotal: Counter;
    whatsappDeliveryFailures: Counter;
    dbConnectionsActive: Gauge;
    dbQueryDuration: Histogram;
    dbErrors: Counter;
    userSignups: Counter;
    activeUsers: Gauge;
    userSessions: Gauge;
    agentOnlineCount: Gauge;
    agentResponseTime: Histogram;
    constructor(metricsRegistry: MetricsRegistry);
    /**
     * Helper methods for common operations
     */
    trackRideRequest(serviceType: string, status: 'pending' | 'accepted' | 'rejected'): void;
    trackRideAcceptance(serviceType: string): void;
    trackRideRejection(serviceType: string, reason: string): void;
    trackRideCompletion(serviceType: string, durationSeconds: number): void;
    trackPayment(paymentMethod: string, amount: number, status: 'success' | 'failed', errorCode?: string): void;
    trackWhatsAppMessage(messageType: string, status: 'sent' | 'delivered' | 'failed', errorCode?: string): void;
    trackDatabaseQuery(queryType: string, table: string, durationSeconds: number, error?: boolean): void;
    trackUserSignup(userType: 'rider' | 'driver' | 'agent'): void;
    setActiveUsers(userType: string, count: number): void;
    setUserSessions(userType: string, count: number): void;
    setAgentsOnline(agentType: string, count: number): void;
    trackAgentResponse(agentType: string, durationSeconds: number): void;
}
/**
 * Create business metrics for a service
 */
export declare function createBusinessMetrics(metricsRegistry: MetricsRegistry): BusinessMetrics;
//# sourceMappingURL=business-metrics.d.ts.map