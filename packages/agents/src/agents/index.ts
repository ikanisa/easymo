/**
 * Agent Registry
 * 
 * Central registry of all available agents.
 */

// Original agents
export { BookingAgent, runBookingAgent } from './booking';
export { TriageAgent, runTriageAgent, analyzeIntent } from './triage';

// New enhanced agents - ALL COMPLETE ✅
export { BaseAgent } from './base/agent.base';
export { NearbyDriversAgent } from './drivers/nearby-drivers.agent';
export { FarmerAgent } from './farmer/farmer.agent';
export { JobsAgent } from './jobs/jobs.agent';
export { PharmacyAgent } from './pharmacy/pharmacy.agent';
export { PropertyRentalAgent } from './property/property-rental.agent';
export { QuincaillerieAgent } from './quincaillerie/quincaillerie.agent';
export { SalesAgent } from './sales/sales.agent';
export { ScheduleTripAgent } from './schedule/schedule-trip.agent';
export { ShopsAgent } from './shops/shops.agent';
export { SupportAgent } from './support/support.agent';

