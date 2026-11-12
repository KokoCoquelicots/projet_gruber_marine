const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');

const deriveKey = promisify(scrypt);
const keyLength = 64;

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, keyLength);
  return `${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, passwordHash) {
  const [salt, storedKey] = passwordHash.split(':');
  if (!salt || !storedKey || !/^[a-f\d]+$/i.test(storedKey)) return false;

  const key = await deriveKey(password, salt, keyLength);
  const expected = Buffer.from(storedKey, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key);
}

module.exports = { hashPassword, verifyPassword };
