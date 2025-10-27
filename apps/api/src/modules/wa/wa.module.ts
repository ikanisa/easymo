import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { DeeplinkModule } from '../deeplink/deeplink.module';
import { WAService } from './wa.service';
import { WhatsAppAgentService } from './wa-agent.service';
import { WhatsAppAgentController } from './wa-agent.controller';
import { FlowBootstrapController } from './flow-bootstrap.controller';

@Module({
  imports: [SupabaseModule, DeeplinkModule],
  controllers: [WhatsAppAgentController, FlowBootstrapController],
  providers: [WAService, WhatsAppAgentService],
  exports: [WAService, WhatsAppAgentService],
})
export class WAModule {}
