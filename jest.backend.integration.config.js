module.exports = {
  // display name
  displayName: "integration",

  // when testing backend
  testEnvironment: "node",

  // which test to run
  testMatch: [
    "<rootDir>/integration-tests/*.test.js",
    "<rootDir>/client/src/integration-tests/*.test.js"
  ],

  // jest code coverage
  collectCoverage: true,
  collectCoverageFrom: ["integration-tests/*.test.js", "client/src/integration-tests/*.test.js"],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
    },
  },
};
