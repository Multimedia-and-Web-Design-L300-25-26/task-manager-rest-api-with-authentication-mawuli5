/**
 * mongoose-mock-loader.mjs
 * Used via:  node --loader ./tests/mongoose-mock-loader.mjs
 *
 * This intercepts EVERY import of 'mongoose' (including from node_modules)
 * and silently replaces it with the in-memory mock.
 * --loader is set up synchronously before any test files load — unlike
 * module.register() which is async and can miss early imports.
 */

const MOCK_URL = new URL('../__mocks__/mongoose.js', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'mongoose') {
    return { shortCircuit: true, url: MOCK_URL };
  }
  return nextResolve(specifier, context);
}
