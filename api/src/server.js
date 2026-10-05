import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const pollutionTypes = new Set(['Plastique', 'Chimique', 'Dépôt sauvage', 'Eau', 'Air', 'Autre']);
const declarations = [];

app.use(cors({ origin: process.env.FRONT_ORIGIN ?? 'http://localhost:4200' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.post('/api/pollutions', (request, response) => {
  const declaration = request.body;
  const requiredFields = ['title', 'type', 'description', 'observedAt', 'location', 'latitude', 'longitude'];
  const hasMissingField = requiredFields.some((field) => {
    const value = declaration?.[field];
    return value === undefined || value === null || value === '';
  });

  if (hasMissingField) {
    return response.status(400).json({ message: 'Tous les champs obligatoires doivent être renseignés.' });
  }

  if (!pollutionTypes.has(declaration.type)) {
    return response.status(400).json({ message: 'Le type de pollution est invalide.' });
  }

  const latitude = Number(declaration.latitude);
  const longitude = Number(declaration.longitude);
  const observedAt = new Date(`${declaration.observedAt}T00:00:00Z`);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return response.status(400).json({ message: 'La latitude doit être comprise entre -90 et 90.' });
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return response.status(400).json({ message: 'La longitude doit être comprise entre -180 et 180.' });
  }

  if (Number.isNaN(observedAt.getTime()) || observedAt.toISOString().slice(0, 10) !== declaration.observedAt) {
    return response.status(400).json({ message: 'La date de l’observation est invalide.' });
  }

  const savedDeclaration = {
    id: randomUUID(),
    ...declaration,
    latitude,
    longitude,
    createdAt: new Date().toISOString()
  };

  declarations.push(savedDeclaration);
  return response.status(201).json({ data: savedDeclaration });
});

app.listen(port, () => {
  console.log(`API disponible sur http://localhost:${port}`);
});