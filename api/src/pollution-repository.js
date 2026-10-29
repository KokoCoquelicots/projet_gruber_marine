const fs = require('node:fs/promises');
const path = require('node:path');

const initialPollutions = [
  {
    id: 'pollution-001',
    title: 'Déchets plastiques sur la berge',
    type: 'Plastique',
    description: 'Plusieurs bouteilles et emballages sont accumulés au bord de la Loire.',
    observedAt: '2026-10-05',
    location: 'Quai de la Loire, Nantes',
    latitude: 47.2184,
    longitude: -1.5536,
    photoUrl: '',
    createdAt: '2026-10-05T10:00:00.000Z'
  },
  {
    id: 'pollution-002',
    title: 'Dépôt sauvage près du chemin',
    type: 'Dépôt sauvage',
    description: 'Des sacs et encombrants ont été déposés en bordure du chemin.',
    observedAt: '2026-10-12',
    location: 'Parc de Procé, Nantes',
    latitude: 47.2288,
    longitude: -1.5824,
    photoUrl: '',
    createdAt: '2026-10-12T09:30:00.000Z'
  }
];

const selectFields = `
  id,
  title,
  pollution_type AS type,
  description,
  to_char(observed_at, 'YYYY-MM-DD') AS "observedAt",
  location,
  latitude::double precision AS latitude,
  longitude::double precision AS longitude,
  photo_url AS "photoUrl",
  created_at AS "createdAt"
`;

function createMemoryRepository() {
  const pollutions = initialPollutions.map((pollution) => ({ ...pollution }));

  return {
    async getAll() {
      return [...pollutions].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
    },
    async getById(id) {
      return pollutions.find((pollution) => pollution.id === id) || null;
    },
    async create(pollution) {
      pollutions.push(pollution);
      return pollution;
    },
    async update(id, declaration) {
      const index = pollutions.findIndex((pollution) => pollution.id === id);
      if (index === -1) return null;
      pollutions[index] = {
        ...declaration,
        id,
        createdAt: pollutions[index].createdAt
      };
      return pollutions[index];
    },
    async delete(id) {
      const index = pollutions.findIndex((pollution) => pollution.id === id);
      if (index === -1) return false;
      pollutions.splice(index, 1);
      return true;
    }
  };
}

function createPostgresRepository(pool) {
  return {
    async initialize() {
      const schema = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(schema);
        const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM pollution');
        if (rows[0].count === 0) {
          for (const pollution of initialPollutions) {
            await insertPollution(client, pollution);
          }
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async getAll() {
      const { rows } = await pool.query(
        `SELECT ${selectFields} FROM pollution ORDER BY observed_at DESC, created_at DESC`
      );
      return rows;
    },
    async getById(id) {
      const { rows } = await pool.query(
        `SELECT ${selectFields} FROM pollution WHERE id = $1`,
        [id]
      );
      return rows[0] || null;
    },
    async create(pollution) {
      return insertPollution(pool, pollution);
    },
    async update(id, declaration) {
      const { rows } = await pool.query(
        `UPDATE pollution
         SET title = $2,
             pollution_type = $3,
             description = $4,
             observed_at = $5,
             location = $6,
             latitude = $7,
             longitude = $8,
             photo_url = $9
         WHERE id = $1
         RETURNING ${selectFields}`,
        [
          id,
          declaration.title,
          declaration.type,
          declaration.description,
          declaration.observedAt,
          declaration.location,
          declaration.latitude,
          declaration.longitude,
          declaration.photoUrl
        ]
      );
      return rows[0] || null;
    },
    async delete(id) {
      const { rowCount } = await pool.query('DELETE FROM pollution WHERE id = $1', [id]);
      return rowCount > 0;
    }
  };
}

async function insertPollution(clientOrPool, pollution) {
  const { rows } = await clientOrPool.query(
    `INSERT INTO pollution (
       id, title, pollution_type, description, observed_at, location,
       latitude, longitude, photo_url, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${selectFields}`,
    [
      pollution.id,
      pollution.title,
      pollution.type,
      pollution.description,
      pollution.observedAt,
      pollution.location,
      pollution.latitude,
      pollution.longitude,
      pollution.photoUrl,
      pollution.createdAt
    ]
  );
  return rows[0];
}

module.exports = { createMemoryRepository, createPostgresRepository };
