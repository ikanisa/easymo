import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { DriverParkingController, DriverAvailabilityController } from './driver.controller';
import { DriverService } from './driver.service';

@Module({
  imports: [SupabaseModule],
  controllers: [DriverParkingController, DriverAvailabilityController],
  providers: [DriverService],
  exports: [DriverService],
})
export class DriverModule {}
