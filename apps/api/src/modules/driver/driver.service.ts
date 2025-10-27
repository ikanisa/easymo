import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateParkingDto, UpdateParkingDto } from './dto/parking.dto';
import type { CreateAvailabilityDto, UpdateAvailabilityDto } from './dto/availability.dto';

@Injectable()
export class DriverService {
  constructor(private readonly supabase: SupabaseService) {}

  private getAuthenticatedUserId(): string {
    // In a real implementation, this would get the user ID from the request context
    // For now, we'll throw an error as auth is handled by RLS policies
    throw new UnauthorizedException('Authentication required');
  }

  // Parking CRUD
  async listParking(driverId: string) {
    return this.supabase.client
      .from('driver_parking')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });
  }

  async createParking(driverId: string, data: CreateParkingDto) {
    const geog = `POINT(${data.lng} ${data.lat})`;
    return this.supabase.client
      .from('driver_parking')
      .insert([
        {
          driver_id: driverId,
          label: data.label,
          geog,
          active: data.active ?? true,
        },
      ])
      .select()
      .single();
  }

  async updateParking(driverId: string, id: string, data: UpdateParkingDto) {
    const updateData: Record<string, unknown> = {};
    if (data.label !== undefined) updateData.label = data.label;
    if (data.active !== undefined) updateData.active = data.active;
    if (data.lat !== undefined && data.lng !== undefined) {
      updateData.geog = `POINT(${data.lng} ${data.lat})`;
    }

    return this.supabase.client
      .from('driver_parking')
      .update(updateData)
      .eq('id', id)
      .eq('driver_id', driverId)
      .select()
      .single();
  }

  async deleteParking(driverId: string, id: string) {
    return this.supabase.client
      .from('driver_parking')
      .delete()
      .eq('id', id)
      .eq('driver_id', driverId);
  }

  // Availability CRUD
  async listAvailability(driverId: string) {
    return this.supabase.client
      .from('driver_availability')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });
  }

  async createAvailability(driverId: string, data: CreateAvailabilityDto) {
    return this.supabase.client
      .from('driver_availability')
      .insert([
        {
          driver_id: driverId,
          parking_id: data.parking_id,
          days_of_week: data.days_of_week,
          start_time_local: data.start_time_local,
          end_time_local: data.end_time_local,
          timezone: data.timezone ?? 'Africa/Kigali',
          active: data.active ?? true,
        },
      ])
      .select()
      .single();
  }

  async updateAvailability(driverId: string, id: string, data: UpdateAvailabilityDto) {
    const updateData: Record<string, unknown> = {};
    if (data.parking_id !== undefined) updateData.parking_id = data.parking_id;
    if (data.days_of_week !== undefined) updateData.days_of_week = data.days_of_week;
    if (data.start_time_local !== undefined) updateData.start_time_local = data.start_time_local;
    if (data.end_time_local !== undefined) updateData.end_time_local = data.end_time_local;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.active !== undefined) updateData.active = data.active;

    return this.supabase.client
      .from('driver_availability')
      .update(updateData)
      .eq('id', id)
      .eq('driver_id', driverId)
      .select()
      .single();
  }

  async deleteAvailability(driverId: string, id: string) {
    return this.supabase.client
      .from('driver_availability')
      .delete()
      .eq('id', id)
      .eq('driver_id', driverId);
  }
}
