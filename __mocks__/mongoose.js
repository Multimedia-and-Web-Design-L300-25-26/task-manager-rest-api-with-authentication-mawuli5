/**
 * In-memory Mongoose mock for Jest tests.
 * Provides full Schema/model/document API without a real MongoDB connection.
 */

// ── In-memory store ───────────────────────────────────────────────────────────
const collections = {};   // { ModelName: [ {...docData}, ... ] }
const registry    = {};   // { ModelName: ModelClass }
let _idSeq = 1;

const newId = () => String(_idSeq++).padStart(24, '0');

// ── Schema ────────────────────────────────────────────────────────────────────
class Schema {
  constructor(definition, options = {}) {
    this.definition  = definition;
    this.options     = options;
    this._preHooks   = {};
    this.methods     = {};
    this.statics     = {};
  }

  pre(event, fn) {
    if (!this._preHooks[event]) this._preHooks[event] = [];
    this._preHooks[event].push(fn);
  }
}

Schema.Types = { ObjectId: 'ObjectId' };

// ── Query wrappers ────────────────────────────────────────────────────────────
// Wraps a Promise and adds Mongoose chainable helpers (.select, .sort)

class Query {
  constructor(promise) {
    this._promise = promise;
  }

  /** Exclude / include fields. Supports '-field1 -field2' syntax. */
  select(projection) {
    const next = this._promise.then(result => {
      if (!result) return null;

      const docs = Array.isArray(result) ? result : [result];

      const excludes = String(projection)
        .split(/\s+/)
        .filter(f => f.startsWith('-'))
        .map(f => f.slice(1));

      const includes = String(projection)
        .split(/\s+/)
        .filter(f => !f.startsWith('-') && f.length > 0);

      docs.forEach(doc => {
        if (excludes.length) excludes.forEach(f => { delete doc[f]; });
        else if (includes.length) {
          Object.keys(doc).forEach(k => {
            if (!includes.includes(k) && k !== '_id') delete doc[k];
          });
        }
      });

      return Array.isArray(result) ? docs : docs[0];
    });

    return new Query(next);
  }

  /** Sort result array. */
  sort(spec) {
    const next = this._promise.then(docs => {
      if (!Array.isArray(docs)) return docs;
      const entries = Object.entries(spec);
      return [...docs].sort((a, b) => {
        for (const [field, dir] of entries) {
          const av = a[field] ?? 0;
          const bv = b[field] ?? 0;
          if (av < bv) return dir === -1 ? 1  : -1;
          if (av > bv) return dir === -1 ? -1 : 1;
        }
        return 0;
      });
    });
    return new Query(next);
  }

  then(onFulfilled, onRejected) {
    return this._promise.then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this._promise.catch(onRejected);
  }
}

// ── Document factory ──────────────────────────────────────────────────────────
function createDocumentClass(modelName, schema) {

  class Document {
    constructor(raw, isNew = true) {
      this.__modelName      = modelName;
      this.__schema         = schema;
      this.__isNew          = isNew;
      // Track which fields were set on construction (for isModified)
      this.__dirtyFields    = isNew ? new Set(Object.keys(raw)) : new Set();

      Object.assign(this, raw);

      if (!this._id) this._id = newId();

      if (schema.options.timestamps) {
        if (!this.createdAt) this.createdAt = new Date();
        this.updatedAt = new Date();
      }
    }

    isModified(field) {
      return field ? this.__dirtyFields.has(field) : this.__dirtyFields.size > 0;
    }

    async save() {
      // Run pre-save hooks
      const hooks = schema._preHooks['save'] || [];
      for (const hook of hooks) {
        await new Promise((resolve, reject) => {
          hook.call(this, err => (err ? reject(err) : resolve()));
        });
      }

      if (!collections[modelName]) collections[modelName] = [];

      // Serialise document to a plain object
      const snapshot = {};
      for (const [k, v] of Object.entries(this)) {
        if (!k.startsWith('__')) snapshot[k] = v;
      }
      snapshot._id        = this._id;
      snapshot.createdAt  = this.createdAt;
      snapshot.updatedAt  = this.updatedAt;

      const idx = collections[modelName].findIndex(
        d => String(d._id) === String(this._id)
      );
      if (idx === -1) {
        collections[modelName].push({ ...snapshot });
      } else {
        collections[modelName][idx] = { ...snapshot };
      }

      this.__isNew      = false;
      this.__dirtyFields = new Set();
      return this;
    }

    async deleteOne() {
      if (!collections[modelName]) return;
      collections[modelName] = collections[modelName].filter(
        d => String(d._id) !== String(this._id)
      );
    }

    toString() { return String(this._id); }

    toJSON() {
      const obj = {};
      for (const [k, v] of Object.entries(this)) {
        if (!k.startsWith('__')) obj[k] = v;
      }
      obj._id = this._id;
      return obj;
    }
  }

  // Attach schema instance methods
  Object.assign(Document.prototype, schema.methods);

  return Document;
}

// ── Model factory ─────────────────────────────────────────────────────────────
function model(modelName, schema) {
  // Return cached model if already created
  if (registry[modelName]) return registry[modelName];

  const DocumentClass = createDocumentClass(modelName, schema);

  /** Check whether a stored plain doc matches a query object. */
  const matches = (doc, query) =>
    Object.entries(query).every(([k, v]) => String(doc[k]) === String(v));

  /** Hydrate a stored plain doc into a Document instance. */
  const hydrate = raw => Object.assign(new DocumentClass({}, false), raw);

  class Model {
    // ── Static CRUD ───────────────────────────────────────────────────────────

    static async create(data) {
      const doc = new DocumentClass(data, true);
      await doc.save();
      return doc;
    }

    static findOne(query) {
      const promise = Promise.resolve().then(() => {
        const store = collections[modelName] || [];
        const raw   = store.find(d => matches(d, query));
        return raw ? hydrate({ ...raw }) : null;
      });
      return new Query(promise);
    }

    static find(query) {
      const promise = Promise.resolve().then(() => {
        const store = collections[modelName] || [];
        return store
          .filter(d => matches(d, query))
          .map(d => hydrate({ ...d }));
      });
      return new Query(promise);
    }

    static findById(id) {
      const promise = Promise.resolve().then(() => {
        const store = collections[modelName] || [];
        const raw   = store.find(d => String(d._id) === String(id));
        return raw ? hydrate({ ...raw }) : null;
      });
      return new Query(promise);
    }

    // ── Statics from schema ───────────────────────────────────────────────────
  }

  // Attach schema statics
  Object.assign(Model, schema.statics);

  registry[modelName] = Model;
  return Model;
}

// ── Top-level mongoose API ────────────────────────────────────────────────────
const mongoose = {
  Schema,
  model,

  connect: async () => { /* no-op */ },

  connection: {
    db: {
      dropDatabase: async () => {
        // Wipe all stored documents
        for (const key of Object.keys(collections)) {
          collections[key] = [];
        }
        // Reset model registry so schemas are re-applied on next import cycle
        for (const key of Object.keys(registry)) {
          delete registry[key];
        }
      },
    },
    close: async () => { /* no-op */ },
  },
};

export default mongoose;
