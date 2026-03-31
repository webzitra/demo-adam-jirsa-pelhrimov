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
  getSchedule, saveSchedule,
  getPayments, savePayments,
  getCheckins,
  getNutritionTemplates, saveNutritionTemplates,
  getDayTemplates, saveDayTemplates,
  getPdfs, savePdfs,
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
    const { clientId, name, email, phone, notes, active, password, stickyNote } = body;
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
    if (stickyNote !== undefined) clients[idx].stickyNote = stickyNote;
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
  // DAY TEMPLATES (single day)
  // =====================

  if (action === 'list-day-templates') {
    const templates = await getDayTemplates();
    return jsonResponse(200, { templates });
  }

  if (action === 'save-day-template') {
    const { template } = body;
    if (!template || !template.name) {
      return jsonResponse(400, { error: 'Šablona musí mít název' });
    }
    const templates = await getDayTemplates();
    template.id = `dtpl-${Date.now()}`;
    template.createdAt = new Date().toISOString();
    templates.push(template);
    await saveDayTemplates(templates);
    return jsonResponse(201, { template });
  }

  if (action === 'delete-day-template') {
    const { templateId } = body;
    if (!templateId) {
      return jsonResponse(400, { error: 'templateId je povinné' });
    }
    let templates = await getDayTemplates();
    templates = templates.filter(t => t.id !== templateId);
    await saveDayTemplates(templates);
    return jsonResponse(200, { success: true });
  }

  // =====================
  // NUTRITION TEMPLATES
  // =====================

  if (action === 'list-nutrition-templates') {
    const templates = await getNutritionTemplates();
    return jsonResponse(200, { templates });
  }

  if (action === 'save-nutrition-template') {
    const { template } = body;
    if (!template || !template.name) {
      return jsonResponse(400, { error: 'Šablona musí mít název' });
    }
    const templates = await getNutritionTemplates();
    template.id = `ntpl-${Date.now()}`;
    template.createdAt = new Date().toISOString();
    templates.push(template);
    await saveNutritionTemplates(templates);
    return jsonResponse(201, { template });
  }

  if (action === 'delete-nutrition-template') {
    const { templateId } = body;
    if (!templateId) {
      return jsonResponse(400, { error: 'templateId je povinné' });
    }
    let templates = await getNutritionTemplates();
    templates = templates.filter(t => t.id !== templateId);
    await saveNutritionTemplates(templates);
    return jsonResponse(200, { success: true });
  }

  if (action === 'apply-nutrition-template') {
    const { clientId, templateId } = body;
    if (!clientId || !templateId) {
      return jsonResponse(400, { error: 'clientId a templateId jsou povinné' });
    }
    const templates = await getNutritionTemplates();
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) {
      return jsonResponse(404, { error: 'Šablona nenalezena' });
    }
    const existing = await getNutrition(clientId) || {};
    const newNutrition = {
      ...existing,
      meals: JSON.parse(JSON.stringify(tpl.meals || [])),
      supplements: JSON.parse(JSON.stringify(tpl.supplements || [])),
      notes: tpl.notes || '',
    };
    await saveNutrition(clientId, newNutrition);
    return jsonResponse(200, { nutrition: newNutrition });
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

  // =====================
  // SCHEDULE (CALENDAR)
  // =====================

  if (action === 'get-schedule') {
    const { weekKey } = body;
    if (!weekKey) {
      return jsonResponse(400, { error: 'weekKey je povinné' });
    }
    const sessions = await getSchedule(weekKey);
    return jsonResponse(200, { sessions });
  }

  if (action === 'save-schedule') {
    const { weekKey, sessions } = body;
    if (!weekKey || !Array.isArray(sessions)) {
      return jsonResponse(400, { error: 'weekKey a sessions jsou povinné' });
    }
    await saveSchedule(weekKey, sessions);
    return jsonResponse(200, { success: true });
  }

  // =====================
  // PAYMENTS
  // =====================

  if (action === 'get-payments') {
    const payments = await getPayments();
    return jsonResponse(200, { payments });
  }

  if (action === 'save-payment') {
    const { payment } = body;
    if (!payment || !payment.clientId || !payment.amount || !payment.paidUntil) {
      return jsonResponse(400, { error: 'clientId, amount a paidUntil jsou povinné' });
    }
    const payments = await getPayments();
    if (payment.id) {
      // Update existing
      const idx = payments.findIndex(p => p.id === payment.id);
      if (idx !== -1) {
        payments[idx] = { ...payments[idx], ...payment, updatedAt: new Date().toISOString() };
      }
    } else {
      // Create new
      payment.id = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      payment.paidAt = new Date().toISOString();
      payments.push(payment);
    }
    await savePayments(payments);
    return jsonResponse(200, { success: true, payments });
  }

  if (action === 'delete-payment') {
    const { paymentId } = body;
    if (!paymentId) {
      return jsonResponse(400, { error: 'paymentId je povinné' });
    }
    let payments = await getPayments();
    payments = payments.filter(p => p.id !== paymentId);
    await savePayments(payments);
    return jsonResponse(200, { success: true });
  }

  // =====================
  // ENGAGEMENT REPORT
  // =====================

  if (action === 'engagement-report') {
    const allClients = await getAllClients();
    const activeClients = allClients.filter(c => c.active);
    const now = new Date();

    const clientResults = [];

    for (const client of activeClients) {
      // Get check-ins (last 4)
      const checkins = await getCheckins(client.id);
      const recentCheckins = checkins.slice(-4);

      // Diet adherence from check-ins (average of diet rating if available)
      let dietAdherence = null;
      if (recentCheckins.length > 0) {
        const dietValues = recentCheckins
          .map(ci => ci.dietAdherence || ci.dietRating || ci.diet)
          .filter(v => v != null && !isNaN(Number(v)));
        if (dietValues.length > 0) {
          dietAdherence = Math.round(dietValues.reduce((s, v) => s + Number(v), 0) / dietValues.length);
        }
      }

      // Response rate: how many check-ins in last 4 expected weeks
      const responseRate = Math.round((recentCheckins.length / 4) * 100);

      // Workout logs: count completed in last 14 days
      let workoutCount = 0;
      let daysSinceLastActivity = null;

      for (let i = 0; i < 14; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const log = await getWorkoutLog(client.id, dateStr);
        if (log && log.completedAt) {
          workoutCount++;
          if (daysSinceLastActivity === null) {
            daysSinceLastActivity = i;
          }
        }
      }

      // Also check check-in dates for last activity
      if (recentCheckins.length > 0) {
        const lastCheckin = recentCheckins[recentCheckins.length - 1];
        if (lastCheckin.createdAt) {
          const checkinDays = Math.floor((now - new Date(lastCheckin.createdAt)) / (1000 * 60 * 60 * 24));
          if (daysSinceLastActivity === null || checkinDays < daysSinceLastActivity) {
            daysSinceLastActivity = checkinDays;
          }
        }
      }

      // Also check progress entries for last activity
      const progress = await getProgress(client.id);
      if (progress.length > 0) {
        const lastProg = progress[progress.length - 1];
        if (lastProg.createdAt) {
          const progDays = Math.floor((now - new Date(lastProg.createdAt)) / (1000 * 60 * 60 * 24));
          if (daysSinceLastActivity === null || progDays < daysSinceLastActivity) {
            daysSinceLastActivity = progDays;
          }
        }
      }

      if (daysSinceLastActivity === null) daysSinceLastActivity = 99;

      const workoutsPerWeek = workoutCount / 2; // 14 days = 2 weeks

      // Engagement status
      let status;
      const trainedRecently = daysSinceLastActivity <= 3;
      const trainedSomewhat = daysSinceLastActivity <= 5;
      const hasRecentCheckin = recentCheckins.length > 0 && recentCheckins[recentCheckins.length - 1].createdAt &&
        Math.floor((now - new Date(recentCheckins[recentCheckins.length - 1].createdAt)) / (1000 * 60 * 60 * 24)) <= 7;

      if (trainedRecently && hasRecentCheckin) {
        status = 'active';
      } else if (trainedSomewhat || !hasRecentCheckin && trainedRecently) {
        status = 'declining';
      } else {
        status = 'inactive';
      }

      clientResults.push({
        id: client.id,
        name: client.name,
        workoutsPerWeek,
        dietAdherence,
        responseRate,
        daysSinceLastActivity,
        status,
      });
    }

    // Summary calculations
    const allAdherences = clientResults.filter(c => c.dietAdherence != null).map(c => c.dietAdherence);
    const avgAdherence = allAdherences.length > 0 ? Math.round(allAdherences.reduce((s, v) => s + v, 0) / allAdherences.length) : null;

    const allWorkouts = clientResults.map(c => c.workoutsPerWeek);
    const avgWorkoutsPerWeek = allWorkouts.length > 0 ? allWorkouts.reduce((s, v) => s + v, 0) / allWorkouts.length : null;

    // Most active: highest workouts/week
    let mostActiveClient = null;
    if (clientResults.length > 0) {
      const sorted = [...clientResults].sort((a, b) => b.workoutsPerWeek - a.workoutsPerWeek);
      mostActiveClient = sorted[0].name;
    }

    // Needs attention: inactive 3+ days
    const needsAttention = clientResults.filter(c => c.daysSinceLastActivity >= 3).length;

    return jsonResponse(200, {
      summary: {
        avgAdherence,
        avgWorkoutsPerWeek,
        mostActiveClient,
        needsAttention,
      },
      clients: clientResults,
    });
  }

  // =====================
  // PDF DOCUMENTS
  // =====================

  if (action === 'upload-pdf') {
    const { clientId, pdfData, pdfName, pdfType } = body;
    if (!clientId || !pdfData || !pdfName) {
      return jsonResponse(400, { error: 'clientId, pdfData a pdfName jsou povinné' });
    }
    if (typeof pdfData !== 'string' || !pdfData.startsWith('data:application/pdf')) {
      return jsonResponse(400, { error: 'Neplatný formát — pouze PDF soubory' });
    }
    // Max ~2MB base64
    if (pdfData.length > 2800000) {
      return jsonResponse(400, { error: 'PDF je příliš velké (max 2 MB)' });
    }

    const pdfs = await getPdfs(clientId);
    if (pdfs.length >= 10) {
      return jsonResponse(400, { error: 'Maximálně 10 dokumentů na klienta' });
    }

    pdfs.push({
      id: `pdf-${crypto.randomBytes(4).toString('hex')}`,
      name: pdfName.slice(0, 100),
      type: pdfType || 'other',
      data: pdfData,
      uploadedAt: new Date().toISOString(),
    });

    await savePdfs(clientId, pdfs);
    return jsonResponse(201, { success: true, count: pdfs.length });
  }

  if (action === 'get-pdfs') {
    const { clientId } = body;
    if (!clientId) return jsonResponse(400, { error: 'clientId je povinné' });

    const pdfs = await getPdfs(clientId);
    // Return list without data (too large)
    const list = pdfs.map(({ data, ...rest }) => rest);
    return jsonResponse(200, { pdfs: list });
  }

  if (action === 'download-pdf') {
    const { clientId, pdfId } = body;
    if (!clientId || !pdfId) return jsonResponse(400, { error: 'clientId a pdfId jsou povinné' });

    const pdfs = await getPdfs(clientId);
    const pdf = pdfs.find(p => p.id === pdfId);
    if (!pdf) return jsonResponse(404, { error: 'PDF nenalezeno' });

    return jsonResponse(200, { pdf });
  }

  if (action === 'delete-pdf') {
    const { clientId, pdfId } = body;
    if (!clientId || !pdfId) return jsonResponse(400, { error: 'clientId a pdfId jsou povinné' });

    let pdfs = await getPdfs(clientId);
    pdfs = pdfs.filter(p => p.id !== pdfId);
    await savePdfs(clientId, pdfs);

    return jsonResponse(200, { success: true });
  }

  return jsonResponse(400, { error: 'Neznámá akce' });
};
