module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }] },
  moduleNameMapper: {
    '^@easymo/commons$': '<rootDir>/../../packages/commons/src/index.ts',
    '^@easymo/db$': '<rootDir>/test/mocks/db.ts',
  },
};
