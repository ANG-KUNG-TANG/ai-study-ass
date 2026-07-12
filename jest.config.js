const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Path to your Next.js app, so next/jest can load next.config.js and .env files
  dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
  moduleDirectories: ['node_modules', '<rootDir>/'],
  moduleNameMapper: {
    // Matches your tsconfig.json's "@/*" path alias — adjust if yours differs
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  // Your intelligence engine tests are pure Node logic (no DOM) — see the
  // per-file override below for React component tests if you add them later.
  testEnvironment: 'node',
};

// createJestConfig is exported this way so next/jest can load Next's config,
// which is async
module.exports = createJestConfig(customJestConfig);