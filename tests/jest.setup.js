// Jest setup – runs before each test file in the worker process.
// Sets environment variables so dotenv.config() in app.js doesn't override them
// and so JWT signing/verification works without a real .env file.
process.env.NODE_ENV   = 'test';
process.env.JWT_SECRET = 'jest-test-secret-key-abc123';
process.env.MONGO_URI  = 'mongodb://localhost/taskmanager_test';
process.env.PORT       = '5001';
