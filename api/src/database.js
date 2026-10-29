const { Pool } = require('pg');

function createDatabasePool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('La variable DATABASE_URL est requise pour démarrer l’API avec PostgreSQL.');
  }

  const ssl = process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined;

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
    connectionTimeoutMillis: 10_000
  });
}

module.exports = { createDatabasePool };
