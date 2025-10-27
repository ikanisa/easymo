import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { SearchCandidatesDto } from './dto/search-candidates.dto';

@Injectable()
export class BrokerService {
  constructor(private readonly supabase: SupabaseService) {}

  async searchCandidates(query: SearchCandidatesDto) {
    const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, radius_km, when, limit } = query;

    // Convert when to timestamp if provided
    const timestamp = when ? new Date(when).toISOString() : undefined;

    const { data, error } = await this.supabase.client.rpc('search_driver_parking_candidates', {
      _pickup_lat: pickup_lat,
      _pickup_lng: pickup_lng,
      _dropoff_lat: dropoff_lat ?? null,
      _dropoff_lng: dropoff_lng ?? null,
      _radius_km: radius_km ?? 10,
      _when: timestamp ?? null,
      _limit: limit ?? 20,
    });

    if (error) {
      throw new BadRequestException(`Failed to search candidates: ${error.message}`);
    }

    return { data };
  }
}
