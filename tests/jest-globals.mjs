/**
 * jest-globals.mjs
 * Loaded via:  node --import ./tests/jest-globals.mjs
 *
 * Sets environment variables and exposes Jest-compatible globals.
 * (Mongoose interception is handled separately by --loader mongoose-mock-loader.mjs)
 */

// ── Environment variables ────────────────────────────────────────────────────
process.env.NODE_ENV   = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'jest-test-secret-key-abc123';
process.env.MONGO_URI  = process.env.MONGO_URI  || 'mongodb://localhost/taskmanager_test';
process.env.PORT       = '0';

// ── Jest-compatible globals ───────────────────────────────────────────────────
import {
  describe, it, test,
  before   as beforeAll,
  after    as afterAll,
  beforeEach, afterEach,
} from 'node:test';
import assert from 'node:assert/strict';

globalThis.describe   = describe;
globalThis.it         = it;
globalThis.test       = test;
globalThis.beforeAll  = beforeAll;
globalThis.afterAll   = afterAll;
globalThis.beforeEach = beforeEach;
globalThis.afterEach  = afterEach;

// ── expect() ─────────────────────────────────────────────────────────────────
const makeExpect = (actual) => {
  const pass = {
    toBe         : (exp) => assert.strictEqual(actual, exp),
    toEqual      : (exp) => assert.deepStrictEqual(actual, exp),
    toStrictEqual: (exp) => assert.deepStrictEqual(actual, exp),

    toBeTruthy   : ()    => assert.ok(actual),
    toBeFalsy    : ()    => assert.ok(!actual),
    toBeNull     : ()    => assert.strictEqual(actual, null),
    toBeUndefined: ()    => assert.strictEqual(actual, undefined),
    toBeDefined  : ()    => {
      if (actual === undefined || actual === null)
        throw new assert.AssertionError({ message: `Expected value to be defined, got ${actual}` });
    },

    toBeGreaterThan        : (n) => assert.ok(actual >  n, `Expected ${actual} > ${n}`),
    toBeGreaterThanOrEqual : (n) => assert.ok(actual >= n, `Expected ${actual} >= ${n}`),
    toBeLessThan           : (n) => assert.ok(actual <  n),
    toBeLessThanOrEqual    : (n) => assert.ok(actual <= n),

    toContain    : (item) => {
      if (typeof actual === 'string') assert.ok(actual.includes(item));
      else assert.ok(Array.isArray(actual) && actual.includes(item));
    },
    toHaveLength : (len) => assert.strictEqual(actual.length, len),

    toHaveProperty: (key, value) => {
      const keys = key.split('.');
      let obj = actual;
      for (const k of keys) {
        assert.ok(
          obj != null && Object.prototype.hasOwnProperty.call(obj, k),
          `Expected object to have property '${key}', got: ${JSON.stringify(actual)}`
        );
        obj = obj[k];
      }
      if (value !== undefined) assert.deepStrictEqual(obj, value);
    },

    toBeInstanceOf: (Cls) => assert.ok(actual instanceof Cls),
    toMatch       : (re)  => typeof re === 'string' ? assert.ok(actual.includes(re)) : assert.match(actual, re),
  };

  // .not. inverse
  const not = {};
  for (const [name, fn] of Object.entries(pass)) {
    not[name] = (...args) => {
      let threw = false;
      try { fn(...args); } catch { threw = true; }
      if (!threw)
        throw new assert.AssertionError({
          message: `Expected NOT .${name}(${args.map(String).join(', ')}) but it passed`,
        });
    };
  }

  return { ...pass, not };
};

globalThis.expect = makeExpect;
