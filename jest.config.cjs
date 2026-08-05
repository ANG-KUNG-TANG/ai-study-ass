const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import("jest").Config} */
const customJestConfig = {
  moduleDirectories: ["node_modules", "<rootDir>/"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testEnvironment: "node",
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
    "<rootDir>/.intelligence-upgrade-backup/",
    "<rootDir>/.route-slug-backup/",
    "<rootDir>/.deployment-fix-backup/",
    "<rootDir>/src/server/intelligence/pipeline/pipeline.test.ts",
    "<rootDir>/src/server/intelligence/ontology/ontolog.cache.test.ts",
  ],
};

module.exports = createJestConfig(customJestConfig);
