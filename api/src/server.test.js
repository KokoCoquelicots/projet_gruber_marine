const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('./server');

const server = createServer();
let baseUrl;

before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/pollutions`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

const declaration = {
  title: 'Pollution test',
  type: 'Plastique',
  description: 'Déchets dans la rivière.',
  observedAt: '2026-10-15',
  location: 'Nantes',
  latitude: 47.2,
  longitude: -1.55,
  photoUrl: ''
};

test('provides seeded records and a not-found response', async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).length, 2);

  const singularRoute = await fetch(baseUrl.replace('/pollutions', '/pollution'));
  assert.equal(singularRoute.status, 200);
  assert.equal((await singularRoute.json()).length, 2);

  const missing = await fetch(`${baseUrl}/unknown`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { message: 'Signalement introuvable.' });
});

test('creates, reads, updates and deletes a pollution', async () => {
  const createdResponse = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(declaration)
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.title, declaration.title);
  assert.ok(created.id);

  const read = await fetch(`${baseUrl}/${created.id}`);
  assert.equal((await read.json()).id, created.id);

  const updatedResponse = await fetch(`${baseUrl}/${created.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...declaration, title: 'Pollution modifiée' })
  });
  assert.equal(updatedResponse.status, 200);
  assert.equal((await updatedResponse.json()).title, 'Pollution modifiée');

  const deletedResponse = await fetch(`${baseUrl}/${created.id}`, { method: 'DELETE' });
  assert.equal(deletedResponse.status, 200);
  assert.equal((await fetch(`${baseUrl}/${created.id}`)).status, 404);
});

test('rejects invalid declarations', async () => {
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...declaration, latitude: 91 })
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /latitude/);
});
