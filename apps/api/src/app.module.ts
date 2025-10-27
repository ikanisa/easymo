import { Module } from '@nestjs/common';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { TwilioModule } from './modules/twilio/twilio.module';
import { TwiMLModule } from './modules/twiml/twiml.module';
import { WAModule } from './modules/wa/wa.module';
import { WaCallsModule } from './modules/wa-calls/wa-calls.module';
import { DriverModule } from './modules/driver/driver.module';
import { BrokerModule } from './modules/broker/broker.module';

@Module({
  imports: [SupabaseModule, RealtimeModule, TwilioModule, TwiMLModule, WAModule, WaCallsModule, DriverModule, BrokerModule],
})
export class AppModule {}
