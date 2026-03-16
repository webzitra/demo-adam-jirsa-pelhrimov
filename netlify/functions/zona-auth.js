const {
  hashPassword, verifyPassword,
  createSession, verifySession,
  verifyAdmin, createAdminSession,
  jsonResponse, parseAuth,
} = require('./lib/zona-auth');
const { getClientByEmail, getClientById } = require('./lib/zona-store');

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, {});
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const { action } = body;

  // --- Client login ---
  if (action === 'login') {
    const { email, password } = body;
    if (!email || !password) {
      return jsonResponse(400, { error: 'Email a heslo jsou povinné' });
    }

    const client = await getClientByEmail(email);
    if (!client || !client.passwordHash) {
      // Timing-safe: always compute
      hashPassword('dummy');
      return jsonResponse(401, { error: 'Nesprávný email nebo heslo' });
    }

    if (!client.active) {
      return jsonResponse(403, { error: 'Účet je deaktivovaný' });
    }

    try {
      const valid = verifyPassword(password, client.passwordHash);
      if (!valid) {
        return jsonResponse(401, { error: 'Nesprávný email nebo heslo' });
      }
    } catch {
      return jsonResponse(401, { error: 'Nesprávný email nebo heslo' });
    }

    const sessionToken = createSession(client.id);

    return jsonResponse(200, {
      sessionToken,
      client: sanitizeClient(client),
    });
  }

  // --- Session verify ---
  if (action === 'verify') {
    const token = body.sessionToken || parseAuth(event);
    const clientId = verifySession(token);
    if (!clientId) {
      return jsonResponse(401, { error: 'Neplatná session' });
    }

    const client = await getClientById(clientId);
    if (!client || !client.active) {
      return jsonResponse(401, { error: 'Účet nenalezen' });
    }

    return jsonResponse(200, {
      client: sanitizeClient(client),
    });
  }

  // --- Admin login ---
  if (action === 'admin-login') {
    const { password } = body;
    const adminPassword = process.env.ZONA_ADMIN_PASSWORD || 'admin123';

    if (password !== adminPassword) {
      return jsonResponse(401, { error: 'Nesprávné heslo' });
    }

    const sessionToken = createAdminSession();
    return jsonResponse(200, { sessionToken });
  }

  // --- Admin session verify ---
  if (action === 'admin-verify') {
    const token = body.sessionToken || parseAuth(event);
    if (!verifyAdmin(token)) {
      return jsonResponse(401, { error: 'Neplatná admin session' });
    }
    return jsonResponse(200, { valid: true });
  }

  return jsonResponse(400, { error: 'Neznámá akce' });
};

function sanitizeClient(client) {
  const { passwordHash, ...safe } = client;
  return safe;
}
