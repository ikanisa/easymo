import { describe, it, expect } from 'vitest';
import {
  resetFlow,
  startSeeDrivers,
  startSeePassengers,
  selectVehicle,
  selectLocation,
  selectRole,
  buildSupportChatLink,
  buildMoMoLink,
  INITIAL_FLOW_DATA,
  PRESET_LOCATIONS,
  type FlowData
} from './waSimFlows';

describe('Flow State Machine', () => {
  it('should reset to initial state', () => {
    const result = resetFlow();
    expect(result).toEqual(INITIAL_FLOW_DATA);
  });

  it('should start see drivers flow', () => {
    const result = startSeeDrivers(INITIAL_FLOW_DATA);
    expect(result.state).toBe('see_drivers_vehicle');
  });

  it('should start see passengers flow', () => {
    const result = startSeePassengers(INITIAL_FLOW_DATA);
    expect(result.state).toBe('see_passengers_vehicle');
  });

  it('should progress see drivers flow on vehicle selection', () => {
    const flowData: FlowData = { ...INITIAL_FLOW_DATA, state: 'see_drivers_vehicle' };
    const result = selectVehicle(flowData, 'moto');
    expect(result.state).toBe('see_drivers_location');
    expect(result.selectedVehicle).toBe('moto');
  });

  it('should complete see drivers flow on location selection', () => {
    const flowData: FlowData = { 
      ...INITIAL_FLOW_DATA, 
      state: 'see_drivers_location',
      selectedVehicle: 'moto'
    };
    const location = PRESET_LOCATIONS[0];
    const result = selectLocation(flowData, location);
    expect(result.state).toBe('see_drivers_list');
    expect(result.selectedLocation).toEqual(location);
  });

  it('should handle role selection for scheduling', () => {
    const flowData: FlowData = { ...INITIAL_FLOW_DATA, state: 'schedule_role' };
    const passengerResult = selectRole(flowData, 'passenger');
    expect(passengerResult.state).toBe('schedule_passenger_vehicle');

    const driverResult = selectRole(flowData, 'driver');
    expect(driverResult.state).toBe('schedule_driver_vehicle');
  });

  it('should complete scheduling with success message', () => {
    const flowData: FlowData = { 
      ...INITIAL_FLOW_DATA, 
      state: 'schedule_passenger_location',
      selectedVehicle: 'cab'
    };
    const location = PRESET_LOCATIONS[1];
    const result = selectLocation(flowData, location);
    expect(result.state).toBe('success');
    expect(result.successMessage).toBe('✅ Trip saved.');
  });
});

describe('Link Builders', () => {
  it('should build support chat link', () => {
    const result = buildSupportChatLink('+250788123456');
    expect(result).toBe('https://wa.me/250788123456?text=Hello%20I%20need%20help');
  });

  it('should build MoMo payment link', () => {
    const result = buildMoMoLink('0788123456', 5000);
    expect(result).toBe('tel:*182*1*0788123456*5000%23');
  });
});