# EasyMO Agent System Documentation

This directory contains comprehensive documentation for the EasyMO AI agent system.

## Documents

### [Global Conventions](./GLOBAL_CONVENTIONS.md)
Platform-wide conventions and specifications including:
- Surfaces & routing architecture
- Tool naming & contract standards
- Autonomy levels (auto/suggest/handoff)
- Localization & market scope
- PII, consent, and payment guardrails
- Compliance checklist

**Use this for**: Understanding platform-wide rules and requirements.

### [Tool Catalog](./TOOL_CATALOG.md)
Complete specification of all available tools across 8 categories:
- Messaging & Orchestration
- Commerce & Operations
- Maps & Mobility
- Insurance
- Payments
- Property & Legal
- Marketing & Analytics
- Sora-2 Video

**Use this for**: Understanding tool capabilities, parameters, and return types.

### [Agent Blueprints](./AGENT_BLUEPRINTS.md)
Detailed specifications for all 15 AI agents:
- Concierge Router
- Waiter AI
- Mobility Orchestrator
- Pharmacy
- Hardware
- Shop
- Insurance
- Payments
- Property
- Legal Intake
- Marketing & Sales
- Sora-2 Video
- Support & Handoff
- Locops (Localization)
- Analytics & Risk

**Use this for**: Understanding agent personas, tasks, tools, guardrails, and KPIs.

## Quick Reference

### For Developers

1. **Implementing a new tool?** 
   - See [Tool Catalog](./TOOL_CATALOG.md) for contract requirements
   - Use TypeScript types from `packages/agents/src/types/tool-contracts.types.ts`
   - Follow the standard `ToolResult<T>` return type

2. **Creating a new agent?**
   - See [Agent Blueprints](./AGENT_BLUEPRINTS.md) for template structure
   - Update `config/agent_configs.yaml` with agent definition
   - Ensure proper tool access restrictions in guardrails

3. **Integrating with WhatsApp?**
   - See [Global Conventions](./GLOBAL_CONVENTIONS.md) for template requirements
   - Check market scope and localization rules
   - Implement quiet hours and opt-in compliance

### For Product Managers

1. **Planning agent features?**
   - Review [Agent Blueprints](./AGENT_BLUEPRINTS.md) for capabilities
   - Check KPIs section for success metrics
   - Review end-to-end flows for user experience

2. **Launching in new markets?**
   - Review [Global Conventions](./GLOBAL_CONVENTIONS.md) localization section
   - Verify country-specific requirements
   - Check excluded markets list

3. **Compliance requirements?**
   - See [Global Conventions](./GLOBAL_CONVENTIONS.md) compliance checklist
   - Review PII, consent, and payment guardrails
   - Check RLS and data retention policies

## Related Files

- **Configuration**: `config/agent_configs.yaml` - Active agent configurations
- **Types**: `packages/agents/src/types/` - TypeScript type definitions
- **Tools**: `packages/agents/src/tools/` - Tool implementations
- **Ground Rules**: `docs/GROUND_RULES.md` - Development standards

## Maintenance

### Document Updates

Update these documents when:
- Adding/removing agents
- Adding/removing tools
- Changing tool contracts
- Updating guardrails
- Modifying autonomy levels
- Changing market scope
- Adding compliance requirements

### Review Schedule

- **Quarterly**: Full review of all documents
- **On Launch**: Review before any major feature launch
- **On Incident**: Review after any security or compliance incident

## Support

For questions or clarifications:
1. Check these docs first
2. Review related code in `packages/agents/`
3. Consult team lead or architecture owner
4. Update docs with answers for future reference

---

**Last Updated**: 2025-11-12  
**Version**: 1.0  
**Status**: Active Reference
