/**
 * ULTRA-MINIMAL WhatsApp Mobility - Simulator Flow State Machine
 * Pure functions for WhatsApp UX flow simulation
 */

import type { VehicleType, SimLocation } from './types';
import { chatLink, momoTelLink } from './format';

export type FlowState = 
  | 'home' 
  | 'see_drivers_vehicle'
  | 'see_drivers_location' 
  | 'see_drivers_list'
  | 'see_passengers_vehicle'
  | 'see_passengers_location'
  | 'see_passengers_list' 
  | 'schedule_role'
  | 'schedule_passenger_vehicle'
  | 'schedule_passenger_location'
  | 'schedule_driver_vehicle' 
  | 'schedule_driver_location'
  | 'driver_onboarding_plate'
  | 'driver_onboarding_vehicle'
  | 'support'
  | 'cta_driver'
  | 'chat_link'
  | 'success';

export interface FlowData {
  state: FlowState;
  selectedVehicle: VehicleType | null;
  selectedLocation: SimLocation | null;
  chatUrl: string | null;
  successMessage: string | null;
  driverProfile: {
    vehiclePlate: string | null;
    vehicleType: VehicleType | null;
  };
  driverOnboardingTarget: 'see_passengers' | 'schedule_driver' | null;
}

export const INITIAL_FLOW_DATA: FlowData = {
  state: 'home',
  selectedVehicle: null,
  selectedLocation: null,
  chatUrl: null,
  successMessage: null,
  driverProfile: {
    vehiclePlate: null,
    vehicleType: null,
  },
  driverOnboardingTarget: null,
};

export const PRESET_LOCATIONS: SimLocation[] = [
  { name: "City Center", lat: -1.9441, lng: 30.0619 },
  { name: "Kimironko", lat: -1.9536, lng: 30.0606 },
  { name: "Kicukiro", lat: -1.9658, lng: 30.1038 },
  { name: "Nyamirambo", lat: -1.9706, lng: 30.0369 },
  { name: "Remera", lat: -1.9378, lng: 30.1096 }
];

export const VEHICLE_OPTIONS: Array<{type: VehicleType, label: string}> = [
  { type: 'moto', label: 'Moto Taxi' },
  { type: 'cab', label: 'Cab' },
  { type: 'lifan', label: 'Lifan' },
  { type: 'truck', label: 'Truck' },
  { type: 'others', label: 'Others' }
];

/**
 * Reset flow to home state
 */
export function resetFlow(): FlowData {
  return { ...INITIAL_FLOW_DATA };
}

/**
 * Start "See Nearby Drivers" flow
 */
export function startSeeDrivers(data: FlowData): FlowData {
  return { ...data, state: 'see_drivers_vehicle' };
}

/**
 * Start "See Nearby Passengers" flow
 */
export function startSeePassengers(data: FlowData): FlowData {
  // For simulator simplicity, always begin by selecting vehicle
  return { ...data, state: 'see_passengers_vehicle' };
}

/**
 * Start "Schedule Trip" flow
 */
export function startScheduleTrip(data: FlowData): FlowData {
  return { ...data, state: 'schedule_role' };
}

/**
 * Start "Support" flow
 */
export function startSupport(data: FlowData): FlowData {
  return { ...data, state: 'support' };
}

/**
 * Select vehicle type
 */
export function selectVehicle(data: FlowData, vehicle: VehicleType): FlowData {
  const newData = { ...data, selectedVehicle: vehicle };
  
  switch (data.state) {
    case 'see_drivers_vehicle':
      return { ...newData, state: 'see_drivers_location' };
    case 'see_passengers_vehicle':
      return { ...newData, state: 'see_passengers_location' };
    case 'schedule_passenger_vehicle':
      return { ...newData, state: 'schedule_passenger_location' };
    case 'schedule_driver_vehicle':
      return { ...newData, state: 'schedule_driver_location' };
    case 'driver_onboarding_vehicle': {
      const updated = {
        ...newData,
        driverProfile: {
          ...newData.driverProfile,
          vehicleType: vehicle,
        },
      };
      if (data.driverOnboardingTarget === 'see_passengers') {
        return {
          ...updated,
          state: 'see_passengers_location',
          driverOnboardingTarget: null,
        };
      }
      if (data.driverOnboardingTarget === 'schedule_driver') {
        return {
          ...updated,
          state: 'schedule_driver_location',
          driverOnboardingTarget: null,
        };
      }
      return updated;
    }
    default:
      return newData;
  }
}

/**
 * Select pickup location
 */
export function selectLocation(data: FlowData, location: SimLocation): FlowData {
  const newData = { ...data, selectedLocation: location };
  
  switch (data.state) {
    case 'see_drivers_location':
      return { ...newData, state: 'see_drivers_list' };
    case 'see_passengers_location':
      return { ...newData, state: 'see_passengers_list' };
    case 'schedule_passenger_location':
      return { 
        ...newData, 
        state: 'success',
        successMessage: '✅ Trip saved.'
      };
    case 'schedule_driver_location':
      return { 
        ...newData, 
        state: 'success',
        successMessage: '✅ Trip saved.'
      };
    default:
      return newData;
  }
}

/**
 * Handle passenger/driver list item selection
 */
export function selectListItem(data: FlowData, phoneE164: string, refCode: string): FlowData {
  const message = `Hi I'm Ref ${refCode} about a ride`;
  const url = chatLink(phoneE164, message);
  
  return {
    ...data,
    state: 'chat_link',
    chatUrl: url
  };
}

/**
 * Handle schedule role selection
 */
export function selectRole(data: FlowData, role: 'passenger' | 'driver'): FlowData {
  if (role === 'passenger') {
    return { ...data, state: 'schedule_passenger_vehicle' };
  } else {
    // For simulator simplicity, always begin by selecting vehicle
    return { ...data, state: 'schedule_driver_vehicle' };
  }
}

/**
 * Show driver access CTA (paywall)
 */
export function showDriverCTA(data: FlowData): FlowData {
  return { ...data, state: 'cta_driver' };
}

/**
 * Build support chat link
 */
export function buildSupportChatLink(supportPhone: string): string {
  return chatLink(supportPhone, 'Hello I need help');
}

export function submitDriverPlate(data: FlowData, plate: string): FlowData {
  const normalized = plate.trim().toUpperCase();
  return {
    ...data,
    driverProfile: {
      ...data.driverProfile,
      vehiclePlate: normalized || null,
    },
    state: 'driver_onboarding_vehicle',
  };
}

export function restartDriverVehicleSelection(
  data: FlowData,
  target: 'see_passengers' | 'schedule_driver',
): FlowData {
  return {
    ...data,
    driverOnboardingTarget: target,
    state: 'driver_onboarding_vehicle',
    selectedVehicle: null,
  };
}

/**
 * Build MoMo payment link
 */
export function buildMoMoLink(payeeNumber: string, price: number): string {
  return momoTelLink(payeeNumber, price);
}
