const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })

module.exports = createJestConfig({
  testEnvironment: 'node',
  testPathIgnorePatterns: ['<rootDir>/tests/e2e/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
})
