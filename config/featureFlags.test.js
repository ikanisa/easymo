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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const originalEnv = { ...process.env };
async function importFlags() {
    return Promise.resolve().then(() => __importStar(require('./featureFlags.ts')));
}
(0, vitest_1.afterEach)(() => {
    process.env = { ...originalEnv };
    vitest_1.vi.resetModules();
    vitest_1.vi.restoreAllMocks();
});
(0, vitest_1.describe)('feature flags', () => {
    (0, vitest_1.it)('treats missing flags as disabled by default', async () => {
        const { AgentFeatureFlags, getEnabledFeatures } = await importFlags();
        (0, vitest_1.expect)(AgentFeatureFlags.ENABLE_AGENT_CHAT).toBe(false);
        (0, vitest_1.expect)(getEnabledFeatures()).toEqual([]);
    });
    (0, vitest_1.it)('detects enabled flags across supported truthy values', async () => {
        process.env = {
            ...originalEnv,
            FEATURE_AGENT_CHAT: 'true',
            FEATURE_AGENT_VOICE: '1',
        };
        const { AgentFeatureFlags, isFeatureEnabled, getEnabledFeatures } = await importFlags();
        (0, vitest_1.expect)(AgentFeatureFlags.ENABLE_AGENT_CHAT).toBe(true);
        (0, vitest_1.expect)(isFeatureEnabled('ENABLE_AGENT_VOICE')).toBe(true);
        (0, vitest_1.expect)(getEnabledFeatures()).toEqual(vitest_1.expect.arrayContaining([
            'ENABLE_AGENT_CHAT',
            'ENABLE_AGENT_VOICE',
        ]));
    });
    (0, vitest_1.it)('logs current status when requested', async () => {
        const consoleSpy = vitest_1.vi.spyOn(console, 'log').mockImplementation(() => undefined);
        process.env = {
            ...originalEnv,
            FEATURE_AGENT_CHAT: 'true',
        };
        const { logFeatureFlags } = await importFlags();
        logFeatureFlags();
        (0, vitest_1.expect)(consoleSpy).toHaveBeenCalledWith('Feature flags status:', {
            enabled: vitest_1.expect.arrayContaining(['ENABLE_AGENT_CHAT']),
            all: vitest_1.expect.any(Object),
        });
    });
});
