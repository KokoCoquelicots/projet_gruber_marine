const { createServer } = require('node:http');
const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');

const port = Number(process.env.PORT || 3000);
const allowedOrigins = new Set(['http://localhost:4200']);
const hashPassword = promisify(scrypt);
const registeredAccounts = new Map();

function sendJson(response, statusCode, payload) {
	response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
	response.end(JSON.stringify(payload));
}

const server = createServer((request, response) => {
	const origin = request.headers.origin;
	if (origin && allowedOrigins.has(origin)) {
		response.setHeader('Access-Control-Allow-Origin', origin);
		response.setHeader('Vary', 'Origin');
	}
	response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
	response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

	if (request.method === 'OPTIONS') {
		response.writeHead(204).end();
		return;
	}

	if (request.method !== 'POST' || request.url !== '/api/auth/signup') {
		sendJson(response, 404, { message: 'Route introuvable.' });
		return;
	}

	let body = '';
	request.on('data', (chunk) => {
		body += chunk;
		if (Buffer.byteLength(body) > 10_000) {
			sendJson(response, 413, { message: 'La requête est trop volumineuse.' });
			request.destroy();
		}
	});

	request.on('end', async () => {
		try {
			const signup = JSON.parse(body);
			const name = typeof signup.name === 'string' ? signup.name.trim() : '';
			const email = typeof signup.email === 'string' ? signup.email.trim().toLowerCase() : '';
			const password = typeof signup.password === 'string' ? signup.password : '';

			if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
				sendJson(response, 400, { message: 'Vérifiez le nom, l’adresse e-mail et le mot de passe.' });
				return;
			}

			if (registeredAccounts.has(email)) {
				sendJson(response, 409, { message: 'Un compte existe déjà avec cette adresse e-mail.' });
				return;
			}

			const salt = randomBytes(16);
			const passwordHash = await hashPassword(password, salt, 64);
			registeredAccounts.set(email, {
				name,
				email,
				salt: salt.toString('hex'),
				passwordHash: passwordHash.toString('hex')
			});

			console.info('Compte créé :', { name, email });
			sendJson(response, 201, { message: 'Compte créé. API de démonstration : les comptes ne sont pas conservés après l’arrêt du serveur.' });
		} catch {
			sendJson(response, 400, { message: 'Le corps de la requête doit être un JSON valide.' });
		}
	});
});

server.listen(port, '0.0.0.0', () => {
	console.log(`API de démonstration disponible sur http://localhost:${port}`);
});
