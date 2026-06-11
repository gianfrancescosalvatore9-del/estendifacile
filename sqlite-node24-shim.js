// SQLite compatibility layer for Node.js 24+
// Replaces the native "sqlite3" npm package with the built-in node:sqlite module.
// This avoids node-gyp/Python build errors on Windows while keeping the callback API
// used by the existing server.js code: db.run, db.get and db.all.

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (error) {
  throw new Error(
    'Il modulo built-in node:sqlite non e disponibile. Usa Node.js 24+ oppure ripristina sqlite3.'
  );
}

function normalizeParams(params) {
  if (params === undefined || params === null) return [];
  if (Array.isArray(params)) return params;
  return params;
}

class StatementWrapper {
  constructor(stmt) {
    this.stmt = stmt;
  }

  run(params, cb) {
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }
    try {
      const result = Array.isArray(params)
        ? this.stmt.run(...params)
        : this.stmt.run(params || {});
      const context = {
        lastID: Number(result.lastInsertRowid || 0),
        changes: Number(result.changes || 0)
      };
      if (cb) cb.call(context, null);
      return context;
    } catch (error) {
      if (cb) cb(error);
      else throw error;
    }
  }

  get(params, cb) {
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }
    try {
      const row = Array.isArray(params)
        ? this.stmt.get(...params)
        : this.stmt.get(params || {});
      if (cb) cb(null, row);
      return row;
    } catch (error) {
      if (cb) cb(error);
      else throw error;
    }
  }

  all(params, cb) {
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }
    try {
      const rows = Array.isArray(params)
        ? this.stmt.all(...params)
        : this.stmt.all(params || {});
      if (cb) cb(null, rows);
      return rows;
    } catch (error) {
      if (cb) cb(error);
      else throw error;
    }
  }
}

class Database {
  constructor(filename, callback) {
    try {
      this.db = new DatabaseSync(filename);
      if (callback) callback(null);
    } catch (error) {
      if (callback) callback(error);
      else throw error;
    }
  }

  run(sql, params, cb) {
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }
    try {
      const stmt = this.db.prepare(sql);
      const normalized = normalizeParams(params);
      const result = Array.isArray(normalized)
        ? stmt.run(...normalized)
        : stmt.run(normalized || {});
      const context = {
        lastID: Number(result.lastInsertRowid || 0),
        changes: Number(result.changes || 0)
      };
      if (cb) cb.call(context, null);
      return context;
    } catch (error) {
      if (cb) cb(error);
      else throw error;
    }
  }

  get(sql, params, cb) {
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }
    try {
      const stmt = this.db.prepare(sql);
      const normalized = normalizeParams(params);
      const row = Array.isArray(normalized)
        ? stmt.get(...normalized)
        : stmt.get(normalized || {});
      if (cb) cb(null, row);
      return row;
    } catch (error) {
      if (cb) cb(error);
      else throw error;
    }
  }

  all(sql, params, cb) {
    if (typeof params === 'function') {
      cb = params;
      params = [];
    }
    try {
      const stmt = this.db.prepare(sql);
      const normalized = normalizeParams(params);
      const rows = Array.isArray(normalized)
        ? stmt.all(...normalized)
        : stmt.all(normalized || {});
      if (cb) cb(null, rows);
      return rows;
    } catch (error) {
      if (cb) cb(error);
      else throw error;
    }
  }

  prepare(sql) {
    return new StatementWrapper(this.db.prepare(sql));
  }

  exec(sql, cb) {
    try {
      const result = this.db.exec(sql);
      if (cb) cb(null);
      return result;
    } catch (error) {
      if (cb) cb(error);
      else throw error;
    }
  }

  serialize(fn) {
    if (typeof fn === 'function') fn();
  }

  close(cb) {
    try {
      this.db.close();
      if (cb) cb(null);
    } catch (error) {
      if (cb) cb(error);
      else throw error;
    }
  }
}

module.exports = {
  Database,
  verbose() {
    return module.exports;
  }
};
