import { Module } from "@nestjs/common";
import { OrchestratorService } from "./orchestrator.service";
import { SessionManagerService } from "./session-manager.service";
import { QuoteAggregatorService } from "./quote-aggregator.service";

/**
 * Agent Orchestrator Module
 * 
 * Manages AI agent negotiation sessions with vendors/drivers.
 * Enforces 5-minute windows for quote collection and coordinates
 * multi-vendor communication.
 * 
 * @module OrchestratorModule
 */
@Module({
  providers: [
    OrchestratorService,
    SessionManagerService,
    QuoteAggregatorService,
  ],
  exports: [
    OrchestratorService,
    SessionManagerService,
    QuoteAggregatorService,
  ],
})
export class OrchestratorModule {}
