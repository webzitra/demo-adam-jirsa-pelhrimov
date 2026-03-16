const crypto = require('crypto');

const TOKEN_SECRET = process.env.ZONA_SECRET || 'dev-secret-change-me';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 dní

// --- Password hashing (scrypt) ---
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

// --- Session tokens (HMAC-SHA256) ---
function createSession(userId) {
  const payload = `${userId}.${Date.now()}`;
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

function verifySession(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [userId, timestamp, hmac] = parts;
  const payload = `${userId}.${timestamp}`;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))) {
    return null;
  }

  // Kontrola expirace
  if (Date.now() - parseInt(timestamp) > SESSION_DURATION) {
    return null;
  }

  return userId;
}

// --- Admin auth ---
function verifyAdmin(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [prefix, timestamp, hmac] = parts;
  if (prefix !== 'admin') return false;

  const payload = `admin.${timestamp}`;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'))) {
    return false;
  }

  if (Date.now() - parseInt(timestamp) > SESSION_DURATION) {
    return false;
  }

  return true;
}

function createAdminSession() {
  const payload = `admin.${Date.now()}`;
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

// --- Helpers ---
function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    body: JSON.stringify(body),
  };
}

function parseAuth(event) {
  const auth = event.headers.authorization || event.headers.Authorization || '';
  return auth.replace('Bearer ', '');
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  verifySession,
  verifyAdmin,
  createAdminSession,
  jsonResponse,
  parseAuth,
};
