declare const rankingServiceRouteDefinitions: Readonly<{
    readonly ranking: {
        readonly basePath: "ranking";
        readonly endpoints: {
            readonly vendors: {
                readonly method: "GET";
                readonly segment: "vendors";
                readonly notes: "Feature flag marketplace.ranking";
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
export type RankingServiceRoutes = typeof rankingServiceRouteDefinitions;
export type RankingServiceControllerKey = keyof RankingServiceRoutes;
export type RankingServiceEndpointKey<Controller extends RankingServiceControllerKey> = keyof RankingServiceRoutes[Controller]["endpoints"];
export declare const rankingServiceRoutes: Readonly<{
    readonly ranking: {
        readonly basePath: "ranking";
        readonly endpoints: {
            readonly vendors: {
                readonly method: "GET";
                readonly segment: "vendors";
                readonly notes: "Feature flag marketplace.ranking";
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
export declare const getRankingServiceControllerBasePath: <Controller extends RankingServiceControllerKey>(controller: Controller) => "health" | "ranking";
export declare const getRankingServiceEndpointSegment: <Controller extends RankingServiceControllerKey, Endpoint extends RankingServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export declare const getRankingServiceEndpointMethod: <Controller extends RankingServiceControllerKey, Endpoint extends RankingServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => import("./utils").HttpMethod;
export declare const getRankingServiceEndpointPath: <Controller extends RankingServiceControllerKey, Endpoint extends RankingServiceEndpointKey<Controller>>(controller: Controller, endpoint: Endpoint) => string;
export {};
//# sourceMappingURL=ranking-service.d.ts.map