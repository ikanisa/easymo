import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  preset: 'ts-jest',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: ['<rootDir>/src/**/*.{ts,js}'],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      lines: 70,
      functions: 70,
    },
  },
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@easymo/commons$': '<rootDir>/../../packages/commons/src',
    '^@easymo/commons/(.*)$': '<rootDir>/../../packages/commons/src/$1',
  },
};

export default config;
