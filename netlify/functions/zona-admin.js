const crypto = require('crypto');
const { verifyAdmin, jsonResponse, parseAuth, hashPassword } = require('./lib/zona-auth');
const {
  getAllClients, saveAllClients,
  getPlan, savePlan,
  getNutrition, saveNutrition,
  getProgress,
  getTemplates, saveTemplates,
  getOnboarding,
  getMessages, addMessage,
  getWorkoutLog,
} = require('./lib/zona-store');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, {});
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  // Admin auth check
  const token = parseAuth(event);
  if (!verifyAdmin(token)) {
    return jsonResponse(401, { error: 'Neautorizovaný přístup' });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const { action } = body;

  // =====================
  // CLIENT MANAGEMENT
  // =====================

  // --- List all clients ---
  if (action === 'list-clients') {
    const clients = await getAllClients();
    return jsonResponse(200, {
      clients: clients.map(c => {
        const { passwordHash, ...safe } = c;
        return safe;
      }),
    });
  }

  // --- Create client ---
  if (action === 'create-client') {
    const { name, email, password, phone, notes } = body;
    if (!name || !email || !password) {
      return jsonResponse(400, { error: 'Jméno, email a heslo jsou povinné' });
    }

    const clients = await getAllClients();

    // Check duplicate email
    if (clients.find(c => c.email.toLowerCase() === email.toLowerCase())) {
      return jsonResponse(409, { error: 'Email již existuje' });
    }

    const newClient = {
      id: `klient-${crypto.randomBytes(4).toString('hex')}`,
      name,
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      phone: phone || '',
      notes: notes || '',
      active: true,
      createdAt: new Date().toISOString(),
    };

    clients.push(newClient);
    await saveAllClients(clients);

    const { passwordHash, ...safe } = newClient;
    return jsonResponse(201, { client: safe });
  }

  // --- Update client ---
  if (action === 'update-client') {
    const { clientId, name, email, phone, notes, active, password } = body;
    if (!clientId) {
      return jsonResponse(400, { error: 'clientId je povinné' });
    }

    const clients = await getAllClients();
    const idx = clients.findIndex(c => c.id === clientId);
    if (idx === -1) {
      return jsonResponse(404, { error: 'Klient nenalezen' });
    }

    if (name) clients[idx].name = name;
    if (email) clients[idx].email = email.toLowerCase();
    if (phone !== undefined) clients[idx].phone = phone;
    if (notes !== undefined) clients[idx].notes = notes;
    if (active !== undefined) clients[idx].active = active;
    if (password) clients[idx].passwordHash = hashPassword(password);
    clients[idx].updatedAt = new Date().toISOString();

    await saveAllClients(clients);

    const { passwordHash, ...safe } = clients[idx];
    return jsonResponse(200, { client: safe });
  }

  // --- Delete client ---
  if (action === 'delete-client') {
    const { clientId } = body;
    if (!clientId) {
      return jsonResponse(400, { error: 'clientId je povinné' });
    }

    let clients = await getAllClients();
    clients = clients.filter(c => c.id !== clientId);
    await saveAllClients(clients);

    return jsonResponse(200, { success: true });
  }

  // =====================
  // TRAINING PLANS
  // =====================

  // --- Get plan ---
  if (action === 'get-plan') {
    const { clientId } = body;
    if (!clientId) {
      return jsonResponse(400, { error: 'clientId je povinné' });
    }

    const plan = await getPlan(clientId);
    return jsonResponse(200, { plan });
  }

  // --- Save plan ---
  if (action === 'save-plan') {
    const { clientId, plan } = body;
    if (!clientId || !plan) {
      return jsonResponse(400, { error: 'clientId a plan jsou povinné' });
    }

    await savePlan(clientId, plan);
    return jsonResponse(200, { success: true });
  }

  // =====================
  // NUTRITION PLANS
  // =====================

  // --- Get nutrition ---
  if (action === 'get-nutrition') {
    const { clientId } = body;
    if (!clientId) {
      return jsonResponse(400, { error: 'clientId je povinné' });
    }

    const nutrition = await getNutrition(clientId);
    return jsonResponse(200, { nutrition });
  }

  // --- Save nutrition ---
  if (action === 'save-nutrition') {
    const { clientId, nutrition } = body;
    if (!clientId || !nutrition) {
      return jsonResponse(400, { error: 'clientId a nutrition jsou povinné' });
    }

    await saveNutrition(clientId, nutrition);
    return jsonResponse(200, { success: true });
  }

  // =====================
  // PROGRESS
  // =====================

  // --- Get progress ---
  if (action === 'get-progress') {
    const { clientId } = body;
    if (!clientId) {
      return jsonResponse(400, { error: 'clientId je povinné' });
    }

    const entries = await getProgress(clientId);
    return jsonResponse(200, { entries });
  }

  // =====================
  // PLAN TEMPLATES
  // =====================

  if (action === 'list-templates') {
    const templates = await getTemplates();
    return jsonResponse(200, { templates });
  }

  if (action === 'save-template') {
    const { template } = body;
    if (!template || !template.name) {
      return jsonResponse(400, { error: 'Šablona musí mít název' });
    }
    const templates = await getTemplates();
    template.id = `tpl-${Date.now()}`;
    template.createdAt = new Date().toISOString();
    templates.push(template);
    await saveTemplates(templates);
    return jsonResponse(201, { template });
  }

  if (action === 'delete-template') {
    const { templateId } = body;
    if (!templateId) {
      return jsonResponse(400, { error: 'templateId je povinné' });
    }
    let templates = await getTemplates();
    templates = templates.filter(t => t.id !== templateId);
    await saveTemplates(templates);
    return jsonResponse(200, { success: true });
  }

  if (action === 'apply-template') {
    const { clientId, templateId } = body;
    if (!clientId || !templateId) {
      return jsonResponse(400, { error: 'clientId a templateId jsou povinné' });
    }
    const templates = await getTemplates();
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) {
      return jsonResponse(404, { error: 'Šablona nenalezena' });
    }
    const existingPlan = await getPlan(clientId) || {};
    const newPlan = { ...existingPlan, days: JSON.parse(JSON.stringify(tpl.days)) };
    await savePlan(clientId, newPlan);
    return jsonResponse(200, { plan: newPlan });
  }

  // =====================
  // ONBOARDING
  // =====================

  if (action === 'get-onboarding') {
    const { clientId } = body;
    if (!clientId) {
      return jsonResponse(400, { error: 'clientId je povinné' });
    }
    const onboarding = await getOnboarding(clientId);
    return jsonResponse(200, { onboarding });
  }

  // =====================
  // CHAT (MESSAGES)
  // =====================

  if (action === 'get-messages') {
    const { clientId } = body;
    if (!clientId) {
      return jsonResponse(400, { error: 'clientId je povinné' });
    }
    const messages = await getMessages(clientId);
    return jsonResponse(200, { messages });
  }

  if (action === 'send-message') {
    const { clientId, text } = body;
    if (!clientId || !text || !text.trim()) {
      return jsonResponse(400, { error: 'clientId a text jsou povinné' });
    }
    const messages = await addMessage(clientId, { from: 'admin', text: text.trim() });
    return jsonResponse(200, { success: true, messages });
  }

  // =====================
  // WORKOUT LOGS (for dashboard metrics)
  // =====================

  if (action === 'get-workout-log') {
    const { clientId, date } = body;
    if (!clientId || !date) {
      return jsonResponse(400, { error: 'clientId a date jsou povinné' });
    }
    const log = await getWorkoutLog(clientId, date);
    return jsonResponse(200, { log });
  }

  // =====================
  // DASHBOARD METRICS
  // =====================

  if (action === 'dashboard-metrics') {
    const allClients = await getAllClients();
    const activeClients = allClients.filter(c => c.active);
    const today = new Date().toISOString().split('T')[0];

    // Get recent workout logs for all active clients (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const clientMetrics = [];
    for (const client of activeClients) {
      const { passwordHash, ...safe } = client;
      const progress = await getProgress(client.id);
      const latestProgress = progress.length > 0 ? progress[progress.length - 1] : null;

      // Check last 7 days for workout logs
      let lastWorkoutDate = null;
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const log = await getWorkoutLog(client.id, dateStr);
        if (log && log.completedAt) {
          lastWorkoutDate = dateStr;
          break;
        }
      }

      const onboarding = await getOnboarding(client.id);
      const unreadMessages = await getMessages(client.id);
      const clientMsgs = unreadMessages.filter(m => m.from === 'client');

      clientMetrics.push({
        ...safe,
        latestWeight: latestProgress?.weight || null,
        latestWeightDate: latestProgress?.createdAt || null,
        lastWorkoutDate,
        hasOnboarding: !!onboarding,
        unreadClientMessages: clientMsgs.length,
      });
    }

    return jsonResponse(200, {
      totalClients: allClients.length,
      activeClients: activeClients.length,
      clientMetrics,
    });
  }

  return jsonResponse(400, { error: 'Neznámá akce' });
};
