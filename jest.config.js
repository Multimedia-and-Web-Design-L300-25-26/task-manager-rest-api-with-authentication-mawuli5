export default {
  testEnvironment: 'node',
  transform: {},                         // no transform – use native ESM

  // Point Jest at our in-memory mongoose mock instead of the real package
  moduleNameMapper: {
    '^mongoose$': '<rootDir>/__mocks__/mongoose.js',
  },

  // Load env-vars before every test worker (must run before any module import)
  setupFiles: ['<rootDir>/tests/jest.setup.js'],

  // Prevent open handles from keeping the process alive
  forceExit: true,
  testTimeout: 15000,
};