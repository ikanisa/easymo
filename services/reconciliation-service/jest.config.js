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
    "^\\.\\/config\\.js$": "<rootDir>/src/config.ts",
    "^\\.\\/logger\\.js$": "<rootDir>/src/logger.ts",
  },
  testEnvironment: "node",
};
