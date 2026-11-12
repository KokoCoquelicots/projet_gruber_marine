const { DataTypes } = require('sequelize');
const fs = require('node:fs/promises');
const path = require('node:path');

function createModels(sequelize) {
  const Pollution = sequelize.define('Pollution', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    title: { type: DataTypes.STRING(120), allowNull: false },
    type: { type: DataTypes.STRING(40), allowNull: false, field: 'pollution_type' },
    description: { type: DataTypes.STRING(2000), allowNull: false },
    observedAt: { type: DataTypes.DATEONLY, allowNull: false, field: 'observed_at' },
    location: { type: DataTypes.STRING(200), allowNull: false },
    latitude: { type: DataTypes.DOUBLE, allowNull: false },
    longitude: { type: DataTypes.DOUBLE, allowNull: false },
    photoUrl: { type: DataTypes.STRING(2000), allowNull: false, field: 'photo_url' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' }
  }, {
    tableName: 'pollution',
    timestamps: false
  });

  const User = sequelize.define('User', {
    id: { type: DataTypes.TEXT, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(200), allowNull: false, field: 'password_hash' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' }
  }, {
    tableName: 'users',
    timestamps: false
  });

  return { Pollution, User };
}

async function initializeModels(sequelize, { User }) {
  const schema = await fs.readFile(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  await sequelize.query(schema);
  await User.sync();
}

module.exports = { createModels, initializeModels };
