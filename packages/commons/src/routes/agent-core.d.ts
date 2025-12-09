declare const agentCoreRouteDefinitions: Readonly<{
    readonly chat: {
        readonly basePath: "";
        readonly description: "Chat interface used by frontline agents";
        readonly endpoints: {
            readonly respond: {
                readonly method: "POST";
                readonly segment: "respond";
                readonly description: "Generate an agent reply";
            };
        };
    };
    readonly ai: {
        readonly basePath: "ai";
        readonly description: "AI workflows exposed for orchestrators";
        readonly endpoints: {
            readonly brokerOrchestrate: {
                readonly method: "POST";
                readonly segment: "broker/orchestrate";
                readonly description: "Kick off the broker orchestrator flow";
            };
            readonly settlement: {
                readonly method: "POST";
                readonly segment: "settlement/run";
            };
            readonly attribution: {
                readonly method: "POST";
                readonly segment: "attribution/run";
            };
            readonly reconciliation: {
                readonly method: "POST";
                readonly segment: "reconciliation/run";
            };
            readonly support: {
                readonly method: "POST";
                readonly segment: "support/run";
            };
            readonly farmerBrokerRun: {
                readonly method: "POST";
                readonly segment: "farmer-broker/run";
            };
            readonly soraGenerate: {
                readonly method: "POST";
                readonly segment: "sora/generate";
                readonly description: "Queue a governed Sora generation job";
            };
        };
    };
    readonly tasks: {
        readonly basePath: "ai/tasks";
        readonly description: "Task scheduler for deferred agent actions";
        readonly endpoints: {
            readonly schedule: {
                readonly method: "POST";
                readonly segment: "schedule";
            };
            readonly runDue: {
                readonly method: "POST";
                readonly segment: "run-due";
            };
        };
    };
    readonly admin: {
        readonly basePath: "admin/agents";
        readonly description: "Administrative endpoints for agent management";
        readonly endpoints: {
            readonly list: {
                readonly method: "GET";
                readonly segment: "";
            };
            readonly create: {
                readonly method: "POST";
                readonly segment: "";
            };
            readonly get: {
                readonly method: "GET";
                readonly segment: ":id";
            };
            readonly update: {
                readonly method: "PATCH";
                readonly segment: ":id";
            };
            readonly listRevisions: {
                readonly method: "GET";
                readonly segment: ":id/revisions";
            };
            readonly createRevision: {
                readonly method: "POST";
                readonly segment: ":id/revisions";
            };
            readonly publishRevision: {
                readonly method: "POST";
                readonly segment: ":id/publish";
            };
            readonly listDocuments: {
                readonly method: "GET";
                readonly segment: ":id/documents";
            };
            readonly createDocument: {
                readonly method: "POST";
                readonly segment: ":id/documents";
            };
            readonly listTasks: {
                readonly method: "GET";
                readonly segment: ":id/tasks";
            };
            readonly createTask: {
                readonly method: "POST";
                readonly segment: ":id/tasks";
            };
        };
    };
    readonly tools: {
        readonly basePath: "tools";
        readonly description: "Operational tooling for live agents";
        readonly endpoints: {
            readonly listLeads: {
                readonly method: "GET";
                readonly segment: "leads";
            };
            readonly fetchLead: {
                readonly method: "POST";
                readonly segment: "fetch-lead";
            };
            readonly logLead: {
                readonly method: "POST";
                readonly segment: "log-lead";
            };
            readonly createCall: {
                readonly method: "POST";
                readonly segment: "create-call";
            };
            readonly setDisposition: {
                readonly method: "POST";
                readonly segment: "set-disposition";
            };
            readonly registerOptOut: {
                readonly method: "POST";
                readonly segment: "register-opt-out";
            };
            readonly collectPayment: {
                readonly method: "POST";
                readonly segment: "collect-payment";
            };
            readonly warmTransfer: {
                readonly method: "POST";
                readonly segment: "warm-transfer";
            };
        };
    };
    readonly health: {
        readonly basePath: "health";
        readonly endpoints: {
            readonly status: {
                readonly method: "GET";
                readonly segment: "";
            };
        };
    };
}>;
export type AgentCoreRoutes = typeof agentCoreRouteDefinitions;
export type AgentCoreControllerKey = keyof AgentCoreRoutes;
export type AgentCoreEndpointKey<Controller extends AgentCoreControllerKey> = keyof AgentCoreRoutes[Controller]["endpoints"];
export type AgentCoreRouteKey = AgentCoreEndpointKey<"chat">;
export declare const agentCoreRoutes: Readonly<{
    readonly chat: {
        readonly basePath: "";
        readonly description: "Chat interface used by frontline agents";
        readonly endpoints: {
            readonly respond: {
                readonly method: "POST";
                readonly segment: "respond";
                readonly description: "Generate an agent reply";
            };
        };
    };
    readonly ai: {
        readonly basePath: "ai";
        readonly description: "AI workflows exposed for orchestrators";
        readonly endpoints: {
            readonly brokerOrchestrate: {
                readonly method: "POST";
                readonly segment: "broker/orchestrate";
                readonly description: "Kick off the broker orchestrator flow";
            };
            readonly settlement: {
                readonly method: "POST";
                readonly segment: "settlement/run";
            };
            readonly attribution: {
                readonly method: "POST";
                readonly segment: "attribution/run";
            };
            readonly reconciliation: {
                readonly method: "POST";
                readonly segment: "reconciliation/run";
            };
            readonly support: {
                readonly method: "POST";
                readonly segment: "support/run";
            };
            readonly farmerBrokerRun: {
                readonly method: "POST";
                readonly segment: "farmer-broker/run";
            };
            readonly soraGenerate: {
                readonly method: "POST";
                readonly segment: "sora/generate";
                readonly description: "Queue a governed Sora generation job";
            };
        };
    };
    readonly tasks: {
        readonly basePath: "ai/tasks";
        readonly description: "Task scheduler for deferred agent actions";
        readonly endpoints: {
            readonly schedule: {
                readonly method: "POST";
                readonly segment: "schedule";
            };
            readonly runDue: {
                readonly method: "POST";
                readonly segment: "run-due";
            };
        };
    };
    readonly admin: {
        readonly basePath: "admin/agents";
        readonly description: "Administrative endpoints for agent management";
        readonly endpoints: {
            readonly list: {
                readonly method: "GET";
                readonly segment: "";
            };
            readonly create: {
                readonly method: "POST";
                readonly segment: "";
            };
            readonly get: {
                readonly method: "GET";
                readonly segment: ":id";
            };
            readonly update: {
                readonly method: "PATCH";
                readonly segment: ":id";
            };
            readonly listRevisions: {
                readonly method: "GET";
                readonly segment: ":id/revisions";
            };
            readonly createRevision: {
                readonly method: "POST";
                readonly segment: ":id/revisions";
            };
            readonly publishRevision: {
                readonly method: "POST";
                readonly segment: ":id/publish";
            };
            readonly listDocuments: {
                readonly method: "GET";
                readonly segment: ":id/documents";
            };
            readonly createDocument: {
                readonly method: "POST";
                readonly segment: ":id/documents";
            };
            readonly listTasks: {
                readonly method: "GET";
                readonly segment: ":id/tasks";
            };
            readonly createTask: {
                readonly method: "POST";
                readonly segment: ":id/tasks";
            };
        };
    };
    readonly tools: {
        readonly basePath: "tools";
        readonly description: "Operational tooling for live agents";
        readonly endpoints: {
            readonly listLeads: {
                readonly method: "GET";
                readonly segment: "leads";
            };
            readonly fetchLead: {
                readonly method: "POST";
                readonly segment: "fetch-lead";
            };
            readonly logLead: {
                readonly method: "POST";
                readonly segment: "log-lead";
            };
            readonly createCall: {
                readonly method: "POST";
                readonly segment: "create-call";
            };
            readonly setDisposition: {
                readonly method: "POST";
                readonly segment: "set-disposition";
            };
            readonly registerOptOut: {
                readonly method: "POST";
                readonly segment: "register-opt-out";
            };
            readonly collectPayment: {
                readonly method: "POST";
                readonly segment: "collect-payment";
            };
            readonly warmTransfer: {
                readonly method: "POST";
                readonly segment: "warm-transfer";
            };
        };
    };
    readonly health: {
        readonly basePath: "health";
        readonly endpoints: {
            readonly status: {
                readonly method: "GET";
                readonly segment: "";
            };
        };
    };
}>;
export declare const getAgentCoreControllerBasePath: <Controller extends AgentCoreControllerKey>(controller: Controller) => "" | "ai" | "ai/tasks" | "admin/agents" | "tools" | "health";
export declare const getAgentCoreEndpointSegment: <Controller extends AgentCoreControllerKey, Endpoint extends AgentCoreEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export declare const getAgentCoreEndpointMethod: <Controller extends AgentCoreControllerKey, Endpoint extends AgentCoreEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => import("./utils").HttpMethod;
export declare const getAgentCoreEndpointPath: <Controller extends AgentCoreControllerKey, Endpoint extends AgentCoreEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export declare const getAgentCoreRouteServiceScopes: (key: string) => readonly string[];
export {};
//# sourceMappingURL=agent-core.d.ts.map