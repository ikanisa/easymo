module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json', diagnostics: false }] },
  moduleNameMapper: {
    '^@easymo/commons$': '<rootDir>/../../packages/commons/src/index.ts',
    '^@easymo/db$': '<rootDir>/../../packages/db/src/index.ts',
    '^\\./(logger|request-context|feature-flags|types|service-auth)\\.js$': '<rootDir>/../../packages/commons/src/$1.ts',
    '^\\./routes/(.*)\\.js$': '<rootDir>/../../packages/commons/src/routes/$1.ts',
    '^\\./(agent-core|api|attribution-service|reconciliation-service|sip-webhook|voice-bridge|http-utils)\\.js$': '<rootDir>/../../packages/commons/src/routes/$1.ts',
    '^\\./prisma.service\\.js$': '<rootDir>/../../packages/db/src/prisma.service.ts',
    '^\\./contracts/service-endpoints\\.js$': '<rootDir>/../../packages/db/src/contracts/service-endpoints.ts',
  },
};
