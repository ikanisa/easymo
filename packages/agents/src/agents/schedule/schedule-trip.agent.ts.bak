/**
 * Schedule Trip Agent
 * 
 * Handles trip scheduling with pattern learning capabilities.
 * Supports one-time and recurring trips, learns user travel patterns,
 * and provides proactive trip suggestions.
 * 
 * Features:
 * - One-time and recurring trip scheduling
 * - Travel pattern learning and prediction
 * - Proactive trip suggestions
 * - Background driver matching (NO 5-minute SLA)
 * - Notification system for matched drivers
 * - Recurrence patterns (daily, weekdays, weekends, weekly, custom)
 */

import { BaseAgent } from '../base/agent.base';
import {
  AgentContext,
  AgentInput,
  AgentResult,
  Tool,
} from '../../types/agent.types';

/**
 * Trip schedule parameters
 */
interface TripScheduleParams {
  pickupLocation: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  dropoffLocation: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  scheduledTime: Date;
  vehicleType: 'Moto' | 'Cab' | 'Liffan' | 'Truck' | 'Others';
  recurrence?: RecurrencePattern;
  maxPrice?: number;
  preferredDrivers?: string[];
  notes?: string;
}

/**
 * Recurrence patterns
 */
interface RecurrencePattern {
  type: 'once' | 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'custom';
  daysOfWeek?: number[]; // 0-6, Sunday-Saturday
  endDate?: Date;
  exceptions?: Date[]; // Dates to skip
}

/**
 * Travel pattern for ML
 */
interface TravelPattern {
  userId: string;
  pickupLocation: { latitude: number; longitude: number };
  dropoffLocation: { latitude: number; longitude: number };
  dayOfWeek: number;
  hour: number;
  vehicleType: string;
  timestamp: Date;
  completed: boolean;
}

/**
 * Pattern prediction result
 */
interface PatternPrediction {
  confidence: number;
  suggestedTime: Date;
  suggestedVehicle: string;
  suggestedRoute: {
    pickup: { latitude: number; longitude: number; address: string };
    dropoff: { latitude: number; longitude: number; address: string };
  };
  frequency: number; // How often this pattern occurs
}

/**
 * Scheduled trip record
 */
interface ScheduledTrip {
  id: string;
  userId: string;
  scheduleParams: TripScheduleParams;
  status: 'pending' | 'matched' | 'confirmed' | 'completed' | 'cancelled';
  matchedDriverId?: string;
  createdAt: Date;
  lastProcessedAt?: Date;
  nextProcessAt?: Date;
}

export class ScheduleTripAgent extends BaseAgent {
  private patterns: Map<string, TravelPattern[]> = new Map();
  private scheduledTrips: Map<string, ScheduledTrip> = new Map();

  constructor() {
    // NO SLA enforcement for schedule agent - background processing
    super('schedule_trip', 0); // 0 = no timeout
  }

  /**
   * Define scheduling tools
   */
  protected defineTools(): Tool[] {
    return [
      {
        name: 'schedule_trip',
        description: 'Schedule a trip for a future time',
        parameters: {
          type: 'object',
          properties: {
            pickupLocation: { type: 'object' },
            dropoffLocation: { type: 'object' },
            scheduledTime: { type: 'string', format: 'date-time' },
            vehicleType: {
              type: 'string',
              enum: ['Moto', 'Cab', 'Liffan', 'Truck', 'Others'],
            },
            recurrence: { type: 'object' },
            maxPrice: { type: 'number' },
          },
          required: ['pickupLocation', 'dropoffLocation', 'scheduledTime', 'vehicleType'],
        },
        execute: this.scheduleTrip.bind(this),
      },
      {
        name: 'analyze_travel_patterns',
        description: 'Analyze user travel patterns and predict future trips',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            daysToAnalyze: {
              type: 'number',
              default: 30,
              description: 'Number of days of history to analyze',
            },
          },
          required: ['userId'],
        },
        execute: this.analyzeTravelPatterns.bind(this),
      },
      {
        name: 'suggest_trip',
        description: 'Suggest a trip based on learned patterns',
        parameters: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            time: {
              type: 'string',
              format: 'date-time',
              description: 'Time to predict for',
            },
          },
          required: ['userId'],
        },
        execute: this.suggestTrip.bind(this),
      },
      {
        name: 'update_schedule',
        description: 'Update or cancel a scheduled trip',
        parameters: {
          type: 'object',
          properties: {
            tripId: { type: 'string' },
            action: {
              type: 'string',
              enum: ['update', 'cancel', 'pause', 'resume'],
            },
            updates: { type: 'object' },
          },
          required: ['tripId', 'action'],
        },
        execute: this.updateSchedule.bind(this),
      },
      {
        name: 'find_drivers_for_scheduled_trip',
        description: 'Find available drivers for a scheduled trip',
        parameters: {
          type: 'object',
          properties: {
            tripId: { type: 'string' },
            searchRadius: { type: 'number', default: 10 },
          },
          required: ['tripId'],
        },
        execute: this.findDriversForScheduledTrip.bind(this),
      },
    ];
  }

  /**
   * Process scheduling request
   */
  async process(input: AgentInput, context: AgentContext): Promise<AgentResult> {
    const { message, intent } = input;

    // Determine action based on intent
    if (intent === 'analyze_patterns') {
      return this.handlePatternAnalysis(input, context);
    } else if (intent === 'suggest_trip') {
      return this.handleTripSuggestion(input, context);
    } else if (intent === 'update_schedule') {
      return this.handleScheduleUpdate(input, context);
    } else {
      return this.handleScheduleCreation(input, context);
    }
  }

  /**
   * Handle trip scheduling creation
   */
  private async handleScheduleCreation(
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentResult> {
    try {
      // Extract schedule parameters
      const params = await this.extractScheduleParams(input);

      // Validate scheduling time (must be future)
      if (params.scheduledTime <= new Date()) {
        return {
          success: false,
          message:
            '❌ Scheduled time must be in the future.\n\n' +
            'Please specify a time using:\n' +
            '• "in 1 hour"\n' +
            '• "tomorrow at 7am"\n' +
            '• "next Monday at 9:00"',
          status: 'error',
        };
      }

      // Create scheduled trip
      const scheduledTrip = await this.scheduleTrip(params, context);

      // Learn from this pattern
      await this.learnPattern(context.userId, params);

      // Format confirmation message
      const message = this.formatScheduleConfirmation(scheduledTrip, params);

      return {
        success: true,
        sessionId: scheduledTrip.id,
        message,
        data: scheduledTrip,
        status: 'completed',
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Failed to schedule trip. Please check your details and try again.',
        error: (error as Error).message,
        status: 'error',
      };
    }
  }

  /**
   * Handle travel pattern analysis
   */
  private async handlePatternAnalysis(
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentResult> {
    try {
      const analysis = await this.analyzeTravelPatterns(
        { userId: context.userId, daysToAnalyze: 30 },
        context
      );

      const message = this.formatPatternAnalysis(analysis);

      return {
        success: true,
        message,
        data: analysis,
        status: 'completed',
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Not enough travel history to analyze patterns yet.',
        status: 'error',
      };
    }
  }

  /**
   * Handle trip suggestion
   */
  private async handleTripSuggestion(
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentResult> {
    try {
      const suggestion = await this.suggestTrip(
        { userId: context.userId, time: new Date().toISOString() },
        context
      );

      if (!suggestion || suggestion.confidence < 0.5) {
        return {
          success: false,
          message:
            'ℹ️ No trip predictions available yet.\n\n' +
            'Use the app more to help me learn your travel patterns!',
          status: 'completed',
        };
      }

      const message = this.formatTripSuggestion(suggestion);

      return {
        success: true,
        message,
        data: suggestion,
        status: 'completed',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Unable to generate trip suggestions at this time.',
        status: 'error',
      };
    }
  }

  /**
   * Handle schedule update
   */
  private async handleScheduleUpdate(
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentResult> {
    try {
      const { tripId, action, updates } = input.metadata || {};

      if (!tripId) {
        throw new Error('Trip ID is required');
      }

      const result = await this.updateSchedule({ tripId, action, updates }, context);

      return {
        success: true,
        message: `✅ Trip schedule ${action}d successfully!`,
        data: result,
        status: 'completed',
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Failed to update schedule.',
        error: (error as Error).message,
        status: 'error',
      };
    }
  }

  /**
   * Schedule a trip
   */
  private async scheduleTrip(
    params: TripScheduleParams,
    context: AgentContext
  ): Promise<ScheduledTrip> {
    const trip: ScheduledTrip = {
      id: `trip_${Date.now()}_${context.userId}`,
      userId: context.userId,
      scheduleParams: params,
      status: 'pending',
      createdAt: new Date(),
      nextProcessAt: this.calculateNextProcessTime(params.scheduledTime),
    };

    // Store trip
    this.scheduledTrips.set(trip.id, trip);

    // TODO: Persist to database
    console.log('Scheduled trip created:', trip);

    // Set up background processing
    this.scheduleBackgroundProcessing(trip);

    return trip;
  }

  /**
   * Analyze travel patterns using ML
   */
  private async analyzeTravelPatterns(
    params: { userId: string; daysToAnalyze: number },
    context: AgentContext
  ): Promise<any> {
    // Get user's travel history
    const patterns = this.patterns.get(params.userId) || [];

    if (patterns.length < 5) {
      throw new Error('Not enough travel history');
    }

    // Analyze patterns by day of week
    const dayPatterns = this.groupByDayOfWeek(patterns);

    // Analyze patterns by time of day
    const timePatterns = this.groupByTimeOfDay(patterns);

    // Find frequent routes
    const frequentRoutes = this.findFrequentRoutes(patterns);

    // Calculate pattern confidence scores
    const predictions = this.generatePredictions(patterns);

    return {
      totalTrips: patterns.length,
      analysisWindow: params.daysToAnalyze,
      dayPatterns,
      timePatterns,
      frequentRoutes,
      predictions,
    };
  }

  /**
   * Suggest trip based on learned patterns
   */
  private async suggestTrip(
    params: { userId: string; time: string },
    context: AgentContext
  ): Promise<PatternPrediction | null> {
    const patterns = this.patterns.get(params.userId) || [];

    if (patterns.length < 5) {
      return null;
    }

    const targetTime = new Date(params.time);
    const targetDay = targetTime.getDay();
    const targetHour = targetTime.getHours();

    // Find similar patterns
    const similarPatterns = patterns.filter((p) => {
      const hourDiff = Math.abs(p.hour - targetHour);
      return p.dayOfWeek === targetDay && hourDiff <= 1;
    });

    if (similarPatterns.length === 0) {
      return null;
    }

    // Calculate confidence based on frequency
    const confidence = Math.min(similarPatterns.length / 10, 1);

    // Find most common route
    const routeCounts = new Map<string, number>();
    similarPatterns.forEach((p) => {
      const routeKey = `${p.pickupLocation.latitude},${p.pickupLocation.longitude}_${p.dropoffLocation.latitude},${p.dropoffLocation.longitude}`;
      routeCounts.set(routeKey, (routeCounts.get(routeKey) || 0) + 1);
    });

    const mostCommonRoute = Array.from(routeCounts.entries()).sort((a, b) => b[1] - a[1])[0];

    if (!mostCommonRoute) {
      return null;
    }

    // Parse route
    const [pickup, dropoff] = mostCommonRoute[0].split('_');
    const [pickupLat, pickupLng] = pickup.split(',').map(Number);
    const [dropoffLat, dropoffLng] = dropoff.split(',').map(Number);

    // Find most common vehicle type
    const vehicleCounts = new Map<string, number>();
    similarPatterns.forEach((p) => {
      vehicleCounts.set(p.vehicleType, (vehicleCounts.get(p.vehicleType) || 0) + 1);
    });
    const suggestedVehicle =
      Array.from(vehicleCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Moto';

    return {
      confidence,
      suggestedTime: targetTime,
      suggestedVehicle,
      suggestedRoute: {
        pickup: {
          latitude: pickupLat,
          longitude: pickupLng,
          address: 'Your usual pickup location',
        },
        dropoff: {
          latitude: dropoffLat,
          longitude: dropoffLng,
          address: 'Your usual destination',
        },
      },
      frequency: mostCommonRoute[1],
    };
  }

  /**
   * Update scheduled trip
   */
  private async updateSchedule(
    params: { tripId: string; action: string; updates?: any },
    context: AgentContext
  ): Promise<any> {
    const trip = this.scheduledTrips.get(params.tripId);

    if (!trip) {
      throw new Error('Scheduled trip not found');
    }

    if (trip.userId !== context.userId) {
      throw new Error('Unauthorized');
    }

    switch (params.action) {
      case 'cancel':
        trip.status = 'cancelled';
        break;
      case 'update':
        if (params.updates) {
          Object.assign(trip.scheduleParams, params.updates);
        }
        break;
      case 'pause':
        // Pause recurring trips
        trip.status = 'pending';
        break;
      case 'resume':
        trip.status = 'pending';
        break;
    }

    this.scheduledTrips.set(params.tripId, trip);

    // TODO: Persist to database
    console.log('Trip updated:', trip);

    return trip;
  }

  /**
   * Find drivers for scheduled trip
   */
  private async findDriversForScheduledTrip(
    params: { tripId: string; searchRadius?: number },
    context: AgentContext
  ): Promise<any> {
    const trip = this.scheduledTrips.get(params.tripId);

    if (!trip) {
      throw new Error('Scheduled trip not found');
    }

    // TODO: Implement actual driver search
    // This would query the database for drivers near the pickup location
    // and check their availability at the scheduled time

    console.log('Finding drivers for scheduled trip:', trip);

    return {
      tripId: trip.id,
      drivers: [],
      searchRadius: params.searchRadius || 10,
      message: 'Driver search will begin 30 minutes before scheduled time',
    };
  }

  /**
   * Learn from trip pattern
   */
  private async learnPattern(userId: string, params: TripScheduleParams): Promise<void> {
    const pattern: TravelPattern = {
      userId,
      pickupLocation: params.pickupLocation,
      dropoffLocation: params.dropoffLocation,
      dayOfWeek: params.scheduledTime.getDay(),
      hour: params.scheduledTime.getHours(),
      vehicleType: params.vehicleType,
      timestamp: new Date(),
      completed: false,
    };

    const userPatterns = this.patterns.get(userId) || [];
    userPatterns.push(pattern);
    this.patterns.set(userId, userPatterns);

    // TODO: Persist to database for ML training
    console.log('Pattern learned:', pattern);
  }

  /**
   * Group patterns by day of week
   */
  private groupByDayOfWeek(patterns: TravelPattern[]): any {
    const groups = new Map<number, TravelPattern[]>();

    patterns.forEach((p) => {
      const day = p.dayOfWeek;
      if (!groups.has(day)) {
        groups.set(day, []);
      }
      groups.get(day)!.push(p);
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return Array.from(groups.entries()).map(([day, trips]) => ({
      day: dayNames[day],
      tripCount: trips.length,
      avgHour: Math.round(trips.reduce((sum, t) => sum + t.hour, 0) / trips.length),
    }));
  }

  /**
   * Group patterns by time of day
   */
  private groupByTimeOfDay(patterns: TravelPattern[]): any {
    const timeSlots = {
      morning: patterns.filter((p) => p.hour >= 6 && p.hour < 12).length,
      afternoon: patterns.filter((p) => p.hour >= 12 && p.hour < 17).length,
      evening: patterns.filter((p) => p.hour >= 17 && p.hour < 21).length,
      night: patterns.filter((p) => p.hour >= 21 || p.hour < 6).length,
    };

    return timeSlots;
  }

  /**
   * Find frequent routes
   */
  private findFrequentRoutes(patterns: TravelPattern[]): any[] {
    const routeCounts = new Map<string, number>();

    patterns.forEach((p) => {
      const routeKey = `${p.pickupLocation.latitude.toFixed(3)},${p.pickupLocation.longitude.toFixed(3)}_${p.dropoffLocation.latitude.toFixed(3)},${p.dropoffLocation.longitude.toFixed(3)}`;
      routeCounts.set(routeKey, (routeCounts.get(routeKey) || 0) + 1);
    });

    return Array.from(routeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([route, count]) => ({
        route,
        frequency: count,
        percentage: ((count / patterns.length) * 100).toFixed(1),
      }));
  }

  /**
   * Generate pattern predictions
   */
  private generatePredictions(patterns: TravelPattern[]): PatternPrediction[] {
    // Simple prediction: predict next 3 days based on patterns
    const predictions: PatternPrediction[] = [];
    const now = new Date();

    for (let i = 1; i <= 3; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + i);

      const prediction = this.suggestTrip(
        { userId: patterns[0].userId, time: targetDate.toISOString() },
        { userId: patterns[0].userId } as AgentContext
      );

      if (prediction) {
        predictions.push(prediction as PatternPrediction);
      }
    }

    return predictions;
  }

  /**
   * Calculate next processing time
   */
  private calculateNextProcessTime(scheduledTime: Date): Date {
    // Start searching for drivers 30 minutes before scheduled time
    const processTime = new Date(scheduledTime);
    processTime.setMinutes(processTime.getMinutes() - 30);
    return processTime;
  }

  /**
   * Schedule background processing for trip
   */
  private scheduleBackgroundProcessing(trip: ScheduledTrip): void {
    if (!trip.nextProcessAt) return;

    const delay = trip.nextProcessAt.getTime() - Date.now();

    if (delay > 0) {
      setTimeout(() => {
        this.processScheduledTrip(trip.id);
      }, delay);
    }
  }

  /**
   * Process scheduled trip (background job)
   */
  private async processScheduledTrip(tripId: string): Promise<void> {
    const trip = this.scheduledTrips.get(tripId);

    if (!trip || trip.status !== 'pending') {
      return;
    }

    console.log('Processing scheduled trip:', tripId);

    try {
      // Find available drivers
      const drivers = await this.findDriversForScheduledTrip(
        { tripId, searchRadius: 10 },
        { userId: trip.userId } as AgentContext
      );

      // TODO: Notify user with driver options
      // This would integrate with the notification system

      trip.lastProcessedAt = new Date();
      this.scheduledTrips.set(tripId, trip);
    } catch (error) {
      console.error('Error processing scheduled trip:', error);
    }
  }

  /**
   * Format schedule confirmation message
   */
  private formatScheduleConfirmation(
    trip: ScheduledTrip,
    params: TripScheduleParams
  ): string {
    const recurrenceText = params.recurrence
      ? this.formatRecurrence(params.recurrence)
      : 'One-time trip';

    let message = '✅ *Trip Scheduled Successfully!*\n\n';
    message += `📅 ${recurrenceText}\n`;
    message += `⏰ ${params.scheduledTime.toLocaleString()}\n`;
    message += `📍 From: ${params.pickupLocation.address || 'Your location'}\n`;
    message += `📍 To: ${params.dropoffLocation.address || 'Destination'}\n`;
    message += `🚗 Vehicle: ${params.vehicleType}\n`;

    if (params.maxPrice) {
      message += `💰 Max budget: ${params.maxPrice.toLocaleString()} RWF\n`;
    }

    message += `\n🔍 I'll start looking for drivers 30 minutes before your trip.`;
    message += `\n📱 You'll get a notification when I find options!`;

    if (params.recurrence && params.recurrence.type !== 'once') {
      message += `\n\n💡 *Tip:* I'm learning your travel patterns to help you even better!`;
    }

    return message;
  }

  /**
   * Format pattern analysis message
   */
  private formatPatternAnalysis(analysis: any): string {
    let message = '📊 *Your Travel Pattern Analysis*\n\n';

    message += `🗓️ *Weekly Patterns:*\n`;
    analysis.dayPatterns.forEach((dp: any) => {
      message += `• ${dp.day}: ${dp.tripCount} trips (avg ${dp.avgHour}:00)\n`;
    });

    message += `\n⏰ *Time Preferences:*\n`;
    message += `• Morning (6-12): ${analysis.timePatterns.morning} trips\n`;
    message += `• Afternoon (12-17): ${analysis.timePatterns.afternoon} trips\n`;
    message += `• Evening (17-21): ${analysis.timePatterns.evening} trips\n`;
    message += `• Night (21-6): ${analysis.timePatterns.night} trips\n`;

    if (analysis.frequentRoutes.length > 0) {
      message += `\n🛣️ *Frequent Routes:*\n`;
      analysis.frequentRoutes.forEach((r: any, i: number) => {
        message += `${i + 1}. Used ${r.frequency} times (${r.percentage}%)\n`;
      });
    }

    if (analysis.predictions.length > 0) {
      message += `\n🔮 *Predicted Upcoming Trips:*\n`;
      analysis.predictions.forEach((p: any) => {
        if (p.confidence > 0.5) {
          message += `• ${p.suggestedTime.toLocaleDateString()} - ${(p.confidence * 100).toFixed(0)}% likely\n`;
        }
      });
    }

    return message;
  }

  /**
   * Format trip suggestion message
   */
  private formatTripSuggestion(suggestion: PatternPrediction): string {
    let message = '💡 *Trip Suggestion Based on Your Patterns*\n\n';

    message += `🎯 Confidence: ${(suggestion.confidence * 100).toFixed(0)}%\n`;
    message += `⏰ Suggested time: ${suggestion.suggestedTime.toLocaleTimeString()}\n`;
    message += `🚗 Vehicle: ${suggestion.suggestedVehicle}\n`;
    message += `📍 Route: Your usual route\n`;
    message += `📊 You've taken this trip ${suggestion.frequency} times before\n\n`;

    message += `Would you like me to schedule this trip for you? Reply 'yes' to confirm!`;

    return message;
  }

  /**
   * Format recurrence pattern
   */
  private formatRecurrence(recurrence: RecurrencePattern): string {
    switch (recurrence.type) {
      case 'daily':
        return 'Daily';
      case 'weekdays':
        return 'Every weekday (Mon-Fri)';
      case 'weekends':
        return 'Every weekend (Sat-Sun)';
      case 'weekly':
        return 'Weekly';
      case 'custom':
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const selectedDays = recurrence.daysOfWeek?.map((d) => days[d]).join(', ') || '';
        return `Custom: ${selectedDays}`;
      default:
        return 'One-time';
    }
  }

  /**
   * Extract schedule parameters from input
   */
  private async extractScheduleParams(input: AgentInput): Promise<TripScheduleParams> {
    const { metadata } = input;

    if (!metadata?.scheduleParams) {
      throw new Error('Schedule parameters are required');
    }

    const params = metadata.scheduleParams as any;

    return {
      pickupLocation: params.pickupLocation,
      dropoffLocation: params.dropoffLocation,
      scheduledTime: new Date(params.scheduledTime),
      vehicleType: params.vehicleType || 'Moto',
      recurrence: params.recurrence,
      maxPrice: params.maxPrice,
      preferredDrivers: params.preferredDrivers,
      notes: params.notes,
    };
  }
}
