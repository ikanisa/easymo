import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { WAService } from './wa.service';
import { WhatsAppAgentService } from './wa-agent.service';
import { WhatsAppAgentController } from './wa-agent.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [WhatsAppAgentController],
  providers: [WAService, WhatsAppAgentService],
  exports: [WAService, WhatsAppAgentService],
})
export class WAModule {}
