module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.spec.json", diagnostics: false }],
  },
  moduleNameMapper: {
    "^@easymo/commons$": "<rootDir>/../../packages/commons/src/index.ts",
    "^@easymo/commons/(.*?)(?:\\.js)?$": "<rootDir>/../../packages/commons/src/$1.ts",
    "^@easymo/db$": "<rootDir>/../../packages/db/src/index.ts",
    "^@easymo/db/(.*?)(?:\\.js)?$": "<rootDir>/../../packages/db/src/$1.ts",
    "^\\./routes/(.*?)(?:\\.js)?$": "<rootDir>/../../packages/commons/src/routes/$1.ts",
  },
};
