import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [ '**/*.spec.ts' ],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleFileExtensions: [ 'ts', 'tsx', 'js', 'jsx', 'json', 'node' ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [ 'text', 'lcov' ],
  verbose: true
};

export default config;