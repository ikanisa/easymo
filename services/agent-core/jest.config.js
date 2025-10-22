export default {
  rootDir: ".",
  moduleFileExtensions: ["js", "json", "ts"],
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": ["@swc/jest", {
      swcrc: false,
      jsc: {
        parser: {
          syntax: "typescript",
          tsx: false,
          decorators: true
        },
        transform: {
          decoratorMetadata: true
        },
        target: "es2022"
      },
      module: {
        type: "commonjs"
      }
    }],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@easymo/commons$": "<rootDir>/test/mocks/commons.ts",
    "^@easymo/db$": "<rootDir>/test/mocks/easymo-db.ts",
    "^@prisma/client$": "<rootDir>/test/mocks/prisma-client.ts",
  },
  collectCoverageFrom: ["src/**/*.ts"],
  coverageDirectory: "coverage",
  testEnvironment: "node"
};
