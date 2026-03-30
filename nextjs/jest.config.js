const nextJest = require('next/jest')
const createJestConfig = nextJest({ dir: './' })

module.exports = createJestConfig({
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.[jt]s?(x)'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/e2e/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
})
