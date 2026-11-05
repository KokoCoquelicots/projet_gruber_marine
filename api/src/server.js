const http = require('node:http');
const { randomUUID } = require('node:crypto');
const { createDatabaseConnection } = require('./database');
const { createModels, initializeModels } = require('./models');
const { createMemoryRepository, createSequelizePollutionRepository } = require('./pollution-repository');
const { createMemoryUserRepository, createSequelizeUserRepository } = require('./user-repository');

const pollutionTypes = new Set(['Plastique', 'Chimique', 'Dépôt sauvage', 'Eau', 'Air', 'Autre']);

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function validateDeclaration(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'Le corps de la requête doit contenir un signalement.';
  }

  const requiredTextFields = ['title', 'description', 'observedAt', 'location'];
  for (const field of requiredTextFields) {
    if (typeof value[field] !== 'string' || !value[field].trim()) {
      return `Le champ « ${field} » est requis.`;
    }
  }
  if (value.title.length > 120) return 'Le titre ne peut pas dépasser 120 caractères.';
  if (value.description.length > 2000) return 'La description ne peut pas dépasser 2 000 caractères.';
  if (value.location.length > 200) return 'Le lieu ne peut pas dépasser 200 caractères.';
  if (!pollutionTypes.has(value.type)) return 'Le type de pollution est invalide.';

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.observedAt);
  if (!dateMatch) return 'La date de l’observation est invalide.';
  const [, year, month, day] = dateMatch;
  const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (parsedDate.getUTCFullYear() !== Number(year) ||
      parsedDate.getUTCMonth() !== Number(month) - 1 ||
      parsedDate.getUTCDate() !== Number(day)) {
    return 'La date de l’observation est invalide.';
  }

  if (!Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90) {
    return 'La latitude doit être comprise entre -90 et 90.';
  }
  if (!Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180) {
    return 'La longitude doit être comprise entre -180 et 180.';
  }
  if (typeof value.photoUrl !== 'string' || value.photoUrl.length > 2000) {
    return 'L’URL de la photo est invalide.';
  }
  if (value.photoUrl) {
    try {
      const photoUrl = new URL(value.photoUrl);
      if (!['http:', 'https:'].includes(photoUrl.protocol)) return 'L’URL de la photo doit utiliser http ou https.';
    } catch {
      return 'L’URL de la photo est invalide.';
    }
  }

  return null;
}

function validateUser(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return 'Le corps de la requête doit contenir un utilisateur.';
  }
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 100) {
    return 'Le nom est requis et ne peut pas dépasser 100 caractères.';
  }
  if (typeof value.email !== 'string' || value.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) {
    return 'Une adresse e-mail valide est requise.';
  }
  if (typeof value.password !== 'string' || value.password.length < 8 || value.password.length > 128) {
    return 'Le mot de passe doit contenir entre 8 et 128 caractères.';
  }
  return null;
}

function validateCredentials(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      typeof value.email !== 'string' || !value.email.trim() ||
      typeof value.password !== 'string' || !value.password) {
    return 'Une adresse e-mail et un mot de passe sont requis.';
  }
  return null;
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(Object.assign(new Error('La requête est trop volumineuse.'), { status: 413 }));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error('Le corps de la requête doit être un JSON valide.'), { status: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function sendError(response, error) {
  if (response.destroyed) return;

  if ([400, 409, 413].includes(error.status)) {
    sendJson(response, error.status, { message: error.message });
    return;
  }

  console.error('Erreur lors du traitement de la requête API :', error);
  sendJson(response, 500, { message: 'Une erreur interne est survenue.' });
}

function createServer({
  repository = createMemoryRepository(),
  userRepository = createMemoryUserRepository()
} = {}) {
  const allowedOrigin = process.env.FRONTEND_ORIGIN || '*';

  return http.createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Cache-Control', 'no-store');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    let segments;
    try {
      segments = new URL(request.url, 'http://localhost').pathname
        .split('/')
        .filter(Boolean)
        .map(decodeURIComponent);
    } catch {
      sendJson(response, 400, { message: 'URL de requête invalide.' });
      return;
    }

    if (segments[0] !== 'api' || !['pollution', 'pollutions', 'users'].includes(segments[1]) || segments.length > 3) {
      sendJson(response, 404, { message: 'Route introuvable.' });
      return;
    }

    const id = segments[2];

    if (segments[1] === 'users') {
      if (request.method === 'POST' && id === 'authenticate') {
        try {
          const credentials = await parseBody(request);
          const validationError = validateCredentials(credentials);
          if (validationError) {
            sendJson(response, 400, { message: validationError });
            return;
          }
          const user = await userRepository.authenticate(credentials.email.trim().toLowerCase(), credentials.password);
          if (!user) {
            sendJson(response, 401, { message: 'Adresse e-mail ou mot de passe incorrect.' });
            return;
          }
          sendJson(response, 200, user);
        } catch (error) {
          sendError(response, error);
        }
        return;
      }

      if (request.method === 'GET' && !id) {
        try {
          sendJson(response, 200, await userRepository.getAll());
        } catch (error) {
          sendError(response, error);
        }
        return;
      }

      if (request.method === 'POST' && !id) {
        try {
          const value = await parseBody(request);
          const validationError = validateUser(value);
          if (validationError) {
            sendJson(response, 400, { message: validationError });
            return;
          }
          const user = await userRepository.create({
            id: randomUUID(),
            name: value.name.trim(),
            email: value.email.trim().toLowerCase(),
            password: value.password
          });
          sendJson(response, 201, user);
        } catch (error) {
          sendError(response, error);
        }
        return;
      }

      if (request.method === 'DELETE' && id) {
        try {
          if (!(await userRepository.delete(id))) {
            sendJson(response, 404, { message: 'Utilisateur introuvable.' });
            return;
          }
          sendJson(response, 200, { message: 'Utilisateur supprimé.' });
        } catch (error) {
          sendError(response, error);
        }
        return;
      }

      sendJson(response, 405, { message: 'Méthode non autorisée.' });
      return;
    }

    if (request.method === 'GET' && !id) {
      try {
        sendJson(response, 200, await repository.getAll());
      } catch (error) {
        sendError(response, error);
      }
      return;
    }

    if (request.method === 'GET' && id) {
      try {
        const pollution = await repository.getById(id);
        if (!pollution) {
          sendJson(response, 404, { message: 'Signalement introuvable.' });
          return;
        }
        sendJson(response, 200, pollution);
      } catch (error) {
        sendError(response, error);
      }
      return;
    }

    if (request.method === 'POST' && !id) {
      try {
        const declaration = await parseBody(request);
        const validationError = validateDeclaration(declaration);
        if (validationError) {
          sendJson(response, 400, { message: validationError });
          return;
        }
        const pollution = {
          ...declaration,
          id: randomUUID(),
          createdAt: new Date().toISOString()
        };
        sendJson(response, 201, await repository.create(pollution));
      } catch (error) {
        sendError(response, error);
      }
      return;
    }

    if (request.method === 'PUT' && id) {
      try {
        const declaration = await parseBody(request);
        const validationError = validateDeclaration(declaration);
        if (validationError) {
          sendJson(response, 400, { message: validationError });
          return;
        }
        const pollution = await repository.update(id, declaration);
        if (!pollution) {
          sendJson(response, 404, { message: 'Signalement introuvable.' });
          return;
        }
        sendJson(response, 200, pollution);
      } catch (error) {
        sendError(response, error);
      }
      return;
    }

    if (request.method === 'DELETE' && id) {
      try {
        const deleted = await repository.delete(id);
        if (!deleted) {
          sendJson(response, 404, { message: 'Signalement introuvable.' });
          return;
        }
        sendJson(response, 200, { message: 'Signalement supprimé.' });
      } catch (error) {
        sendError(response, error);
      }
      return;
    }

    sendJson(response, 405, { message: 'Méthode non autorisée.' });
  });
}

if (require.main === module) {
  async function start() {
    const sequelize = createDatabaseConnection();
    const models = createModels(sequelize);
    const repository = createSequelizePollutionRepository(models.Pollution);
    const userRepository = createSequelizeUserRepository(models.User);
    try {
      await sequelize.authenticate();
      await initializeModels(sequelize, models);
      await repository.initialize();
      const port = Number(process.env.PORT || 3000);
      createServer({ repository, userRepository }).listen(port, '0.0.0.0', () => {
        console.log(`API Vigie disponible sur le port ${port}`);
      });
    } catch (error) {
      await sequelize.close();
      throw error;
    }
  }

  start().catch((error) => {
    console.error('Impossible de démarrer l’API Vigie :', error);
    process.exitCode = 1;
  });
}

module.exports = { createServer };
