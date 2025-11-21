
import { WaiterAgent } from './packages/agents/src/agents/waiter/waiter.agent';
import { FarmerAgent } from './packages/agents/src/agents/farmer/farmer.agent';
import { BusinessBrokerAgent } from './packages/agents/src/agents/general/business-broker.agent';
import { RealEstateAgent } from './packages/agents/src/agents/property/real-estate.agent';
import { JobsAgent } from './packages/agents/src/agents/jobs/jobs.agent';
import { SalesAgent } from './packages/agents/src/agents/sales/sales.agent';

async function verifyAgents() {
  console.log('Verifying Agents...');

  const agents = [
    new WaiterAgent(),
    new FarmerAgent(),
    new BusinessBrokerAgent(),
    new RealEstateAgent(),
    new JobsAgent(),
    new SalesAgent()
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
    } catch (e) {
        console.error(`Error executing ${agent.name}:`, e);
    }
  }
  
  console.log('\nVerification Complete.');
}

verifyAgents().catch(console.error);
