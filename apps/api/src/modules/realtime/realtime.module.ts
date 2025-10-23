import { Module } from '@nestjs/common';
import { RealtimeController } from './realtime.controller';
import { MemoryController } from '../memory/memory.controller';
import { SuggestionsController } from '../suggestions/suggestions.controller';
import { RealtimeService } from './realtime.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { WAModule } from '../wa/wa.module';
import { TwilioModule } from '../twilio/twilio.module';
import { AgentProfileResolver } from './agent-profile-resolver';

@Module({
  imports: [SupabaseModule, WAModule, TwilioModule],
  controllers: [RealtimeController, MemoryController, SuggestionsController],
  providers: [RealtimeService, AgentProfileResolver],
})
export class RealtimeModule {}
