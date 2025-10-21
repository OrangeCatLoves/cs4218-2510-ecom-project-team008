module.exports = {
  // display name
  displayName: "backend integration",

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
