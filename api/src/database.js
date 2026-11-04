$env:DATABASE_URL = "COLLE_ICI_L_URL_EXTERNE"
$env:DATABASE_SSL = "true"
npm startconst { Sequelize } = require('sequelize');

function createDatabaseConnection() {
  if (!process.env.DATABASE_URL) {
    throw new Error('La variable DATABASE_URL est requise pour démarrer l’API avec PostgreSQL.');
  }

  const dialectOptions = process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined;

  return new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: dialectOptions ? { ssl: dialectOptions } : undefined,
    logging: false,
    retry: { max: 2 },
    pool: { acquire: 10_000 }
  });
}

module.exports = { createDatabaseConnection };
