import { Module } from '@nestjs/common';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { TwilioModule } from './modules/twilio/twilio.module';
import { TwiMLModule } from './modules/twiml/twiml.module';
import { WAModule } from './modules/wa/wa.module';

@Module({
  imports: [SupabaseModule, RealtimeModule, TwilioModule, TwiMLModule, WAModule],
})
export class AppModule {}
