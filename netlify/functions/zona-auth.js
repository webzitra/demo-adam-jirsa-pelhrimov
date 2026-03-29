const crypto = require('crypto');
const {
  hashPassword, verifyPassword,
  createSession, verifySession,
  verifyAdmin, createAdminSession,
  jsonResponse, parseAuth,
} = require('./lib/zona-auth');
const { getClientByEmail, getClientById, getAllClients, saveAllClients } = require('./lib/zona-store');

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

  // --- Client self-registration ---
  if (action === 'register') {
    const { name, email, password, phone } = body;
    if (!name || !email || !password) {
      return jsonResponse(400, { error: 'Jméno, email a heslo jsou povinné' });
    }

    if (password.length < 6) {
      return jsonResponse(400, { error: 'Heslo musí mít alespoň 6 znaků' });
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse(400, { error: 'Neplatný formát emailu' });
    }

    const existing = await getClientByEmail(email);
    if (existing) {
      return jsonResponse(409, { error: 'Účet s tímto emailem již existuje. Zkus se přihlásit.' });
    }

    const clients = await getAllClients();
    const newClient = {
      id: `klient-${crypto.randomBytes(4).toString('hex')}`,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password),
      phone: phone || '',
      notes: '',
      active: true,
      selfRegistered: true,
      createdAt: new Date().toISOString(),
    };

    clients.push(newClient);
    await saveAllClients(clients);

    // Auto-login after registration
    const sessionToken = createSession(newClient.id);

    return jsonResponse(201, {
      sessionToken,
      client: sanitizeClient(newClient),
    });
  }

  return jsonResponse(400, { error: 'Neznámá akce' });
};

function sanitizeClient(client) {
  const { passwordHash, ...safe } = client;
  return safe;
}
