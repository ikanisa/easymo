import { buildEndpointPath, defineHttpControllers, } from "./utils";
const agentCoreRouteDefinitions = defineHttpControllers({
    chat: {
        basePath: "",
        description: "Chat interface used by frontline agents",
        endpoints: {
            respond: { method: "POST", segment: "respond", description: "Generate an agent reply" },
        },
    },
    ai: {
        basePath: "ai",
        description: "AI workflows exposed for orchestrators",
        endpoints: {
            brokerOrchestrate: {
                method: "POST",
                segment: "broker/orchestrate",
                description: "Kick off the broker orchestrator flow",
            },
            settlement: { method: "POST", segment: "settlement/run" },
            attribution: { method: "POST", segment: "attribution/run" },
            reconciliation: { method: "POST", segment: "reconciliation/run" },
            support: { method: "POST", segment: "support/run" },
            farmerBrokerRun: { method: "POST", segment: "farmer-broker/run" },
            soraGenerate: {
                method: "POST",
                segment: "sora/generate",
                description: "Queue a governed Sora generation job",
            },
        },
    },
    tasks: {
        basePath: "ai/tasks",
        description: "Task scheduler for deferred agent actions",
        endpoints: {
            schedule: { method: "POST", segment: "schedule" },
            runDue: { method: "POST", segment: "run-due" },
        },
    },
    admin: {
        basePath: "admin/agents",
        description: "Administrative endpoints for agent management",
        endpoints: {
            list: { method: "GET", segment: "" },
            create: { method: "POST", segment: "" },
            get: { method: "GET", segment: ":id" },
            update: { method: "PATCH", segment: ":id" },
            listRevisions: { method: "GET", segment: ":id/revisions" },
            createRevision: { method: "POST", segment: ":id/revisions" },
            publishRevision: { method: "POST", segment: ":id/publish" },
            listDocuments: { method: "GET", segment: ":id/documents" },
            createDocument: { method: "POST", segment: ":id/documents" },
            listTasks: { method: "GET", segment: ":id/tasks" },
            createTask: { method: "POST", segment: ":id/tasks" },
        },
    },
    tools: {
        basePath: "tools",
        description: "Operational tooling for live agents",
        endpoints: {
            listLeads: { method: "GET", segment: "leads" },
            fetchLead: { method: "POST", segment: "fetch-lead" },
            logLead: { method: "POST", segment: "log-lead" },
            createCall: { method: "POST", segment: "create-call" },
            setDisposition: { method: "POST", segment: "set-disposition" },
            registerOptOut: { method: "POST", segment: "register-opt-out" },
            collectPayment: { method: "POST", segment: "collect-payment" },
            warmTransfer: { method: "POST", segment: "warm-transfer" },
        },
    },
    health: {
        basePath: "health",
        endpoints: {
            status: { method: "GET", segment: "" },
        },
    },
});
export const agentCoreRoutes = agentCoreRouteDefinitions;
export const getAgentCoreControllerBasePath = (controller) => agentCoreRoutes[controller].basePath;
export const getAgentCoreEndpointSegment = (controller, endpoint) => {
    const controllerRoutes = agentCoreRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].segment;
};
export const getAgentCoreEndpointMethod = (controller, endpoint) => {
    const controllerRoutes = agentCoreRoutes[controller];
    const endpoints = controllerRoutes.endpoints;
    return endpoints[endpoint].method;
};
export const getAgentCoreEndpointPath = (controller, endpoint) => {
    const base = getAgentCoreControllerBasePath(controller);
    const segment = getAgentCoreEndpointSegment(controller, endpoint);
    return buildEndpointPath(base, segment);
};
const agentCoreServiceScopes = Object.freeze({
    aiBrokerOrchestrate: ["ai:broker.orchestrate"],
    aiSettlementRun: ["ai:settlement"],
    aiAttributionRun: ["ai:attribution"],
    aiReconciliationRun: ["ai:reconciliation"],
    aiSupportRun: ["ai:support"],
    aiFarmerBrokerRun: ["ai:farmer-broker"],
    aiSoraGenerate: ["ai:sora.generate"],
    aiTasksSchedule: ["tasks:schedule"],
    aiTasksRunDue: ["tasks:run"],
});
export const getAgentCoreRouteServiceScopes = (key) => agentCoreServiceScopes[key] ?? [];
