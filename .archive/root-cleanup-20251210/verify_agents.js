"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const waiter_agent_1 = require("./packages/agents/src/agents/waiter/waiter.agent");
const farmer_agent_1 = require("./packages/agents/src/agents/farmer/farmer.agent");
const business_broker_agent_1 = require("./packages/agents/src/agents/general/business-broker.agent");
const real_estate_agent_1 = require("./packages/agents/src/agents/property/real-estate.agent");
const jobs_agent_1 = require("./packages/agents/src/agents/jobs/jobs.agent");
const sales_agent_1 = require("./packages/agents/src/agents/sales/sales.agent");
async function verifyAgents() {
    console.log('Verifying Agents...');
    const agents = [
        new waiter_agent_1.WaiterAgent(),
        new farmer_agent_1.FarmerAgent(),
        new business_broker_agent_1.BusinessBrokerAgent(),
        new real_estate_agent_1.RealEstateAgent(),
        new jobs_agent_1.JobsAgent(),
        new sales_agent_1.SalesAgent()
    ];
    for (const agent of agents) {
        console.log(`\n--------------------------------------------------`);
        console.log(`Verifying ${agent.name}...`);
        console.log(`Instructions length: ${agent.instructions.length}`);
        console.log(`Tools count: ${agent.tools.length}`);
        try {
            const result = await agent.execute({
                userId: 'test-user',
                query: 'Hello',
                context: { userId: 'test-user' }
            });
            console.log(`Execute result success: ${result.success}`);
            if (!result.success) {
                console.error(`Execute failed: ${result.error}`);
            }
        }
        catch (e) {
            console.error(`Error executing ${agent.name}:`, e);
        }
    }
    console.log('\nVerification Complete.');
}
verifyAgents().catch(console.error);
