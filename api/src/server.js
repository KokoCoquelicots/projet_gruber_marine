const http = require('node:http');
const { randomUUID } = require('node:crypto');

const pollutionTypes = new Set(['Plastique', 'Chimique', 'Dépôt sauvage', 'Eau', 'Air', 'Autre']);

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

function createServer() {
  const pollutions = initialPollutions.map((pollution) => ({ ...pollution }));
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

    if (segments[0] !== 'api' || segments[1] !== 'pollutions' || segments.length > 3) {
      sendJson(response, 404, { message: 'Route introuvable.' });
      return;
    }

    const id = segments[2];
    if (request.method === 'GET' && !id) {
      sendJson(response, 200, [...pollutions].sort((a, b) => b.observedAt.localeCompare(a.observedAt)));
      return;
    }

    if (request.method === 'GET' && id) {
      const pollution = pollutions.find((item) => item.id === id);
      if (!pollution) {
        sendJson(response, 404, { message: 'Signalement introuvable.' });
        return;
      }
      sendJson(response, 200, pollution);
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
        const pollution = { ...declaration, id: randomUUID(), createdAt: new Date().toISOString() };
        pollutions.push(pollution);
        sendJson(response, 201, pollution);
      } catch (error) {
        if (!response.destroyed) sendJson(response, error.status || 400, { message: error.message });
      }
      return;
    }

    if (request.method === 'PUT' && id) {
      const index = pollutions.findIndex((item) => item.id === id);
      if (index === -1) {
        sendJson(response, 404, { message: 'Signalement introuvable.' });
        return;
      }
      try {
        const declaration = await parseBody(request);
        const validationError = validateDeclaration(declaration);
        if (validationError) {
          sendJson(response, 400, { message: validationError });
          return;
        }
        pollutions[index] = { ...declaration, id, createdAt: pollutions[index].createdAt };
        sendJson(response, 200, pollutions[index]);
      } catch (error) {
        if (!response.destroyed) sendJson(response, error.status || 400, { message: error.message });
      }
      return;
    }

    if (request.method === 'DELETE' && id) {
      const index = pollutions.findIndex((item) => item.id === id);
      if (index === -1) {
        sendJson(response, 404, { message: 'Signalement introuvable.' });
        return;
      }
      pollutions.splice(index, 1);
      sendJson(response, 200, { message: 'Signalement supprimé.' });
      return;
    }

    sendJson(response, 405, { message: 'Méthode non autorisée.' });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => console.log(`API Vigie disponible sur le port ${port}`));
}

module.exports = { createServer };
