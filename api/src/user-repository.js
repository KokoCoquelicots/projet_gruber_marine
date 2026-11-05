const { hashPassword, verifyPassword } = require('./utils/password');

function publicUser(user) {
  if (!user) return null;
  const value = typeof user.get === 'function' ? user.get({ plain: true }) : user;
  return {
    id: value.id,
    name: value.name,
    email: value.email,
    createdAt: value.createdAt
  };
}

function conflictError() {
  return Object.assign(new Error('Cette adresse e-mail est déjà utilisée.'), { status: 409 });
}

function createMemoryUserRepository() {
  const users = [];

  return {
    async getAll() {
      return users.map(publicUser).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    },
    async create(user) {
      if (users.some((existing) => existing.email === user.email)) throw conflictError();
      const savedUser = {
        ...user,
        passwordHash: await hashPassword(user.password),
        createdAt: new Date().toISOString()
      };
      delete savedUser.password;
      users.push(savedUser);
      return publicUser(savedUser);
    },
    async authenticate(email, password) {
      const user = users.find((candidate) => candidate.email === email);
      if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
      return publicUser(user);
    },
    async delete(id) {
      const index = users.findIndex((user) => user.id === id);
      if (index === -1) return false;
      users.splice(index, 1);
      return true;
    }
  };
}

function createSequelizeUserRepository(User) {
  return {
    async getAll() {
      const users = await User.findAll({
        attributes: ['id', 'name', 'email', 'createdAt'],
        order: [['name', 'ASC']]
      });
      return users.map(publicUser);
    },
    async create(user) {
      try {
        const savedUser = await User.create({
          id: user.id,
          name: user.name,
          email: user.email,
          passwordHash: await hashPassword(user.password),
          createdAt: new Date()
        });
        return publicUser(savedUser);
      } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') throw conflictError();
        throw error;
      }
    },
    async authenticate(email, password) {
      const user = await User.findOne({ where: { email } });
      if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
      return publicUser(user);
    },
    async delete(id) {
      return (await User.destroy({ where: { id } })) > 0;
    }
  };
}

module.exports = { createMemoryUserRepository, createSequelizeUserRepository };
