export default {
  rootDir: "./",
  moduleFileExtensions: ["js", "json", "ts"],
  testRegex: "test/.*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "tsconfig.spec.json", diagnostics: false }],
  },
  testEnvironment: "node",
  moduleNameMapper: {
    "^@easymo/commons$": "<rootDir>/../../packages/commons/src/index.ts",
    "^@easymo/commons/(.*?)(?:\\.js)?$": "<rootDir>/../../packages/commons/src/$1.ts",
    "^@easymo/db$": "<rootDir>/../../packages/db/src/index.ts",
    "^@easymo/db/(.*?)(?:\\.js)?$": "<rootDir>/../../packages/db/src/$1.ts",
    "^\\./routes/(.*?)(?:\\.js)?$": "<rootDir>/../../packages/commons/src/routes/$1.ts",
  },
};
