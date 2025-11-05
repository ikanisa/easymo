"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const commons_1 = require("@easymo/commons");
const DEFAULT_TENANT_ID = "a4a8cf2d-0a4f-446c-8bf2-28509641158f";
async function setupApp(overrides) {
    jest.resetModules();
    process.env.NODE_ENV = "test";
    process.env.FEATURE_WALLET_SERVICE = "1";
    process.env.SERVICE_JWT_KEYS = "test-secret";
    process.env.SERVICE_JWT_ISSUER = "test-issuer";
    process.env.SERVICE_NAME = "wallet-service";
    process.env.SERVICE_AUTH_AUDIENCE = "wallet-service";
    process.env.DEFAULT_TENANT_ID = DEFAULT_TENANT_ID;
    delete process.env.RATE_LIMIT_REDIS_URL;
    const prismaMock = {
        walletAccount: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: "wallet-1" }),
        },
    };
    const walletMock = {
        transfer: jest.fn().mockResolvedValue({
            transaction: { id: "txn-1" },
            entries: [],
            commissionAmount: 0,
        }),
        getAccountSummary: jest.fn().mockResolvedValue({ id: "wallet-1", balance: 0 }),
    };
    Object.assign(prismaMock, overrides?.prisma);
    Object.assign(walletMock, overrides?.wallet);
    const module = await Promise.resolve().then(() => __importStar(require("../src/server")));
    const app = module.buildApp({
        prisma: prismaMock,
        wallet: walletMock,
    });
    return { app, prismaMock, walletMock };
}
describe("wallet-service authentication", () => {
    it("rejects missing bearer token", async () => {
        const { app } = await setupApp();
        const response = await (0, supertest_1.default)(app)
            .post("/wallet/transfer")
            .send({
            tenantId: DEFAULT_TENANT_ID,
            sourceAccountId: "11111111-1111-1111-1111-111111111111",
            destinationAccountId: "22222222-2222-2222-2222-222222222222",
            amount: 10,
            currency: "USD",
        });
        expect(response.status).toBe(401);
        expect(response.body.error).toBe("missing_token");
    });
    it("rejects insufficient scope", async () => {
        const { app } = await setupApp();
        const token = await (0, commons_1.signServiceJwt)({ audience: "wallet-service", scope: ["wallet:accounts.read"] });
        const response = await (0, supertest_1.default)(app)
            .post("/wallet/transfer")
            .set("Authorization", `Bearer ${token}`)
            .send({
            tenantId: DEFAULT_TENANT_ID,
            sourceAccountId: "11111111-1111-1111-1111-111111111111",
            destinationAccountId: "22222222-2222-2222-2222-222222222222",
            amount: 10,
            currency: "USD",
        });
        expect(response.status).toBe(403);
        expect(response.body.error).toBe("invalid_scope");
    });
    it("allows valid scope", async () => {
        const transfer = jest.fn().mockResolvedValue({
            transaction: { id: "txn-1" },
            entries: [],
            commissionAmount: 5,
        });
        const { app, walletMock } = await setupApp({ wallet: { transfer } });
        const token = await (0, commons_1.signServiceJwt)({ audience: "wallet-service", scope: ["wallet:transfer.write"] });
        const response = await (0, supertest_1.default)(app)
            .post("/wallet/transfer")
            .set("Authorization", `Bearer ${token}`)
            .send({
            tenantId: DEFAULT_TENANT_ID,
            sourceAccountId: "11111111-1111-1111-1111-111111111111",
            destinationAccountId: "22222222-2222-2222-2222-222222222222",
            amount: 10,
            currency: "USD",
        });
        expect(response.status).toBe(201);
        expect(transfer).toHaveBeenCalledTimes(1);
        expect(walletMock.transfer).toHaveBeenCalledWith(expect.objectContaining({ amount: 10, currency: "USD" }));
    });
});
