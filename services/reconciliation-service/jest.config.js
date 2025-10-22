export default {
  rootDir: "./",
  moduleFileExtensions: ["ts", "js", "json"],
  testRegex: "test/.*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "tsconfig.spec.json" }],
  },
  moduleNameMapper: {
    "^@easymo/commons$": "<rootDir>/../../packages/commons/src/index.ts",
    "^@easymo/messaging$": "<rootDir>/../../packages/messaging/src/index.ts",
    "^\\./(kafka|idempotency|retry|errors|contracts)\\.js$": "<rootDir>/../../packages/messaging/src/$1.ts",
    "^\\.\\/config\\.js$": "<rootDir>/src/config.ts",
    "^\\.\\/logger\\.js$": "<rootDir>/src/logger.ts",
    "^\\./(logger|request-context|feature-flags|types|service-auth)\\.js$": "<rootDir>/../../packages/commons/src/$1.ts",
    "^\\./(agent-core|api|attribution-service|reconciliation-service|sip-webhook|voice-bridge|http-utils)\\.js$": "<rootDir>/../../packages/commons/src/routes/$1.ts",
    "^\\./routes/(.*)\\.js$": "<rootDir>/../../packages/commons/src/routes/$1.ts",
  },
  testEnvironment: "node",
};
