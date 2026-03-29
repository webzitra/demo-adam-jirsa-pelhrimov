const crypto = require('crypto');
const {
  hashPassword, verifyPassword,
  createSession, verifySession,
  verifyAdmin, createAdminSession,
  jsonResponse, parseAuth,
} = require('./lib/zona-auth');
const { getClientByEmail, getClientById, getAllClients, saveAllClients } = require('./lib/zona-store');
const { notifyNewRegistration, sendWelcomeEmail } = require('./lib/email');

// --- In-memory rate limiting (per Netlify function instance) ---
const rateLimits = new Map();
const RATE_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_LOGIN_ATTEMPTS = 10;       // per IP
const MAX_REGISTER_ATTEMPTS = 3;     // per IP

function getRateKey(ip, action) {
  return `${ip}:${action}`;
}

function checkRateLimit(ip, action, max) {
  const key = getRateKey(ip, action);
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimits.set(key, { windowStart: now, count: 1 });
    return true;
  }

  if (entry.count >= max) {
    return false;
  }

  entry.count++;
  return true;
}

// Clean up old entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits) {
    if (now - entry.windowStart > RATE_WINDOW) {
      rateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

// --- Input sanitization ---
function sanitizeString(str, maxLen = 200) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen).replace(/[<>]/g, '');
}

function sanitizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.toLowerCase().trim().slice(0, 254);
}

function sanitizePhone(phone) {
  if (typeof phone !== 'string') return '';
  // Only allow digits, +, spaces, dashes, parentheses
  return phone.trim().slice(0, 20).replace(/[^\d+\s\-()]/g, '');
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, {});
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const clientIP = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || event.headers['client-ip']
    || 'unknown';

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const { action } = body;

  // --- Client login ---
  if (action === 'login') {
    if (!checkRateLimit(clientIP, 'login', MAX_LOGIN_ATTEMPTS)) {
      return jsonResponse(429, { error: 'Příliš mnoho pokusů. Zkus to za 15 minut.' });
    }

    const { email, password } = body;
    if (!email || !password) {
      return jsonResponse(400, { error: 'Email a heslo jsou povinné' });
    }

    const client = await getClientByEmail(sanitizeEmail(email));
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
    if (!checkRateLimit(clientIP, 'admin-login', 5)) {
      return jsonResponse(429, { error: 'Příliš mnoho pokusů. Zkus to za 15 minut.' });
    }

    const { password } = body;
    const adminPassword = process.env.ZONA_ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error('ZONA_ADMIN_PASSWORD is not set!');
      return jsonResponse(500, { error: 'Server configuration error' });
    }

    // Timing-safe comparison for admin password
    const passBuffer = Buffer.from(password || '');
    const adminBuffer = Buffer.from(adminPassword);
    if (passBuffer.length !== adminBuffer.length || !crypto.timingSafeEqual(passBuffer, adminBuffer)) {
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
    if (!checkRateLimit(clientIP, 'register', MAX_REGISTER_ATTEMPTS)) {
      return jsonResponse(429, { error: 'Příliš mnoho registrací. Zkus to za 15 minut.' });
    }

    // Honeypot check — if hidden field is filled, it's a bot
    if (body.website) {
      // Silently accept but don't create account
      return jsonResponse(201, { sessionToken: 'ok', client: { id: 'ok', name: 'ok' } });
    }

    const name = sanitizeString(body.name, 100);
    const email = sanitizeEmail(body.email);
    const password = body.password;
    const phone = sanitizePhone(body.phone || '');

    if (!name || !email || !password) {
      return jsonResponse(400, { error: 'Jméno, email a heslo jsou povinné' });
    }

    if (name.length < 2) {
      return jsonResponse(400, { error: 'Jméno musí mít alespoň 2 znaky' });
    }

    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return jsonResponse(400, { error: 'Heslo musí mít 6–128 znaků' });
    }

    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse(400, { error: 'Neplatný formát emailu' });
    }

    const existing = await getClientByEmail(email);
    if (existing) {
      return jsonResponse(409, { error: 'Účet s tímto emailem již existuje. Zkus se přihlásit.' });
    }

    // Limit total self-registered clients (anti-abuse)
    const clients = await getAllClients();
    const selfRegisteredCount = clients.filter(c => c.selfRegistered).length;
    if (selfRegisteredCount >= 100) {
      return jsonResponse(503, { error: 'Registrace je momentálně pozastavena. Kontaktuj trenéra přímo.' });
    }

    const newClient = {
      id: `klient-${crypto.randomBytes(4).toString('hex')}`,
      name,
      email,
      passwordHash: hashPassword(password),
      phone,
      notes: '',
      active: true,
      selfRegistered: true,
      registeredIP: clientIP,
      createdAt: new Date().toISOString(),
    };

    clients.push(newClient);
    await saveAllClients(clients);

    // Auto-login after registration
    const sessionToken = createSession(newClient.id);

    // Send emails (non-blocking — don't wait for delivery)
    const safeClient = sanitizeClient(newClient);
    // Welcome email disabled until domain verified in Resend
    Promise.allSettled([
      notifyNewRegistration(safeClient),
    ]).catch(() => {});

    return jsonResponse(201, {
      sessionToken,
      client: safeClient,
    });
  }

  return jsonResponse(400, { error: 'Neznámá akce' });
};

function sanitizeClient(client) {
  const { passwordHash, registeredIP, ...safe } = client;
  return safe;
}
