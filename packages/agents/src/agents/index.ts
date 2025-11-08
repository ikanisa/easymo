/**
 * Agent Registry
 * 
 * Central registry of all available agents.
 */

// Original agents
export { BookingAgent, runBookingAgent } from './booking';
export { TriageAgent, runTriageAgent, analyzeIntent } from './triage';

// New enhanced agents
export { BaseAgent } from './base/agent.base';
export { NearbyDriversAgent } from './drivers/nearby-drivers.agent';
export { PharmacyAgent } from './pharmacy/pharmacy.agent';
export { WaiterAgent } from './waiter/waiter.agent';

// TODO: Export remaining agents when implemented
// export { PropertyRentalAgent } from './property/property-rental.agent';
// export { ScheduleTripAgent } from './schedule/schedule-trip.agent';
// export { QuincaillerieAgent } from './quincaillerie/quincaillerie.agent';
// export { ShopsAgent } from './shops/shops.agent';

