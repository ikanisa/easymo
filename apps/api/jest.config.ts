import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  preset: 'ts-jest',
  setupFiles: ['<rootDir>/jest.setup.ts'],
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
