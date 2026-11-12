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

function createSequelizePollutionRepository(Pollution) {
  return {
    async initialize() {
      if (await Pollution.count() === 0) {
        await Pollution.bulkCreate(initialPollutions);
      }
    },
    async getAll() {
      return Pollution.findAll({ order: [['observedAt', 'DESC'], ['createdAt', 'DESC']] });
    },
    async getById(id) {
      return Pollution.findByPk(id);
    },
    async create(declaration) {
      return Pollution.create(declaration);
    },
    async update(id, declaration) {
      const pollution = await Pollution.findByPk(id);
      if (!pollution) return null;
      await pollution.update(declaration);
      return pollution;
    },
    async delete(id) {
      const pollution = await Pollution.findByPk(id);
      if (!pollution) return false;
      await pollution.destroy();
      return true;
    }
  };
}

module.exports = { createMemoryRepository, createSequelizePollutionRepository };
