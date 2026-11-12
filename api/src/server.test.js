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

test('creates, lists, authenticates and deletes users without exposing passwords', async () => {
  const usersUrl = baseUrl.replace('/pollutions', '/users');
  const registration = {
    name: 'Marine',
    email: 'MARINE@example.com',
    password: 'motdepasse123'
  };
  const createdResponse = await fetch(usersUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registration)
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.email, 'marine@example.com');
  assert.equal('password' in created, false);
  assert.equal('passwordHash' in created, false);

  const usersResponse = await fetch(usersUrl);
  assert.equal(usersResponse.status, 200);
  assert.deepEqual(await usersResponse.json(), [created]);

  const invalidLogin = await fetch(`${usersUrl}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: registration.email, password: 'incorrect' })
  });
  assert.equal(invalidLogin.status, 401);

  const login = await fetch(`${usersUrl}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: registration.email, password: registration.password })
  });
  assert.equal(login.status, 200);
  assert.deepEqual(await login.json(), created);

  const deleted = await fetch(`${usersUrl}/${created.id}`, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { message: 'Utilisateur supprimé.' });
  assert.deepEqual(await (await fetch(usersUrl)).json(), []);
});

test('validates new users and rejects duplicate email addresses', async () => {
  const usersUrl = baseUrl.replace('/pollutions', '/users');
  const invalid = await fetch(usersUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Marine', email: 'not-an-email', password: 'short' })
  });
  assert.equal(invalid.status, 400);

  const registration = {
    name: 'Marine',
    email: 'marine@example.com',
    password: 'motdepasse123'
  };
  const first = await fetch(usersUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registration)
  });
  assert.equal(first.status, 201);

  const duplicate = await fetch(usersUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registration)
  });
  assert.equal(duplicate.status, 409);
});
