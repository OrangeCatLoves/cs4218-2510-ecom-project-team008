module.exports = {
  // display name
  displayName: "integration",

  // when testing backend
  testEnvironment: "node",

  // which test to run
  testMatch: [
    "<rootDir>/integration-tests/*.integration.test.js",
  ],

  // jest code coverage
  collectCoverage: true,
  collectCoverageFrom: ["integration-tests/**"],
  coverageThreshold: {
    global: {
      lines: 0,
      functions: 0,
    },
  },
};
