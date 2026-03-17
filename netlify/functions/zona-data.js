const { verifySession, jsonResponse, parseAuth } = require('./lib/zona-auth');
const {
  getClientById, getPlan, getNutrition, getProgress, addProgressEntry,
  getWorkoutLog, saveWorkoutLog, getOnboarding, saveOnboarding,
  getMessages, addMessage,
  getNutritionLog, saveNutritionLog,
  getCheckins, addCheckin,
} = require('./lib/zona-store');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return jsonResponse(200, {});
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  // Client auth check
  const token = parseAuth(event);
  const clientId = verifySession(token);
  if (!clientId) {
    return jsonResponse(401, { error: 'Nepřihlášen' });
  }

  const client = await getClientById(clientId);
  if (!client || !client.active) {
    return jsonResponse(401, { error: 'Účet nenalezen' });
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  const { action } = body;

  // --- Get my training plan ---
  if (action === 'get-plan') {
    const plan = await getPlan(clientId);
    return jsonResponse(200, { plan });
  }

  // --- Get my nutrition plan ---
  if (action === 'get-nutrition') {
    const nutrition = await getNutrition(clientId);
    return jsonResponse(200, { nutrition });
  }

  // --- Get my progress ---
  if (action === 'get-progress') {
    const entries = await getProgress(clientId);
    return jsonResponse(200, { entries });
  }

  // --- Add progress entry ---
  if (action === 'add-progress') {
    const { weight, notes, photo } = body;
    if (!weight) {
      return jsonResponse(400, { error: 'Váha je povinná' });
    }

    const entry = {
      weight: parseFloat(weight),
      notes: notes || '',
    };

    // Photo: accept base64 JPEG, max ~500KB
    if (photo && typeof photo === 'string' && photo.startsWith('data:image/')) {
      // Rough size check (~500KB base64)
      if (photo.length > 700000) {
        return jsonResponse(400, { error: 'Fotka je příliš velká (max 500 KB)' });
      }
      entry.photo = photo;
    }

    await addProgressEntry(clientId, entry);

    return jsonResponse(200, { success: true });
  }

  // --- Save workout log ---
  if (action === 'save-workout-log') {
    const { date, log } = body;
    if (!date || !log) {
      return jsonResponse(400, { error: 'Datum a log jsou povinné' });
    }
    await saveWorkoutLog(clientId, date, log);
    return jsonResponse(200, { success: true });
  }

  // --- Get workout log ---
  if (action === 'get-workout-log') {
    const { date } = body;
    if (!date) {
      return jsonResponse(400, { error: 'Datum je povinné' });
    }
    const log = await getWorkoutLog(clientId, date);
    return jsonResponse(200, { log });
  }

  // --- Save onboarding ---
  if (action === 'save-onboarding') {
    const { data } = body;
    if (!data) {
      return jsonResponse(400, { error: 'Data jsou povinná' });
    }
    await saveOnboarding(clientId, data);
    return jsonResponse(200, { success: true });
  }

  // --- Get messages ---
  if (action === 'get-messages') {
    const messages = await getMessages(clientId);
    return jsonResponse(200, { messages });
  }

  // --- Send message (from client) ---
  if (action === 'send-message') {
    const { text } = body;
    if (!text || !text.trim()) {
      return jsonResponse(400, { error: 'Zpráva je povinná' });
    }
    const messages = await addMessage(clientId, { from: 'client', text: text.trim() });
    return jsonResponse(200, { success: true, messages });
  }

  // --- Submit weekly check-in ---
  if (action === 'submit-checkin') {
    const { trainingRating, dietAdherence, weight, energy, notes, photo } = body;

    const entry = {
      trainingRating: parseInt(trainingRating) || 0,
      dietAdherence: parseInt(dietAdherence) || 0,
      weight: weight ? parseFloat(weight) : null,
      energy: energy || null,
      notes: notes || '',
    };

    if (photo && typeof photo === 'string' && photo.startsWith('data:image/')) {
      if (photo.length > 700000) {
        return jsonResponse(400, { error: 'Fotka je příliš velká (max 500 KB)' });
      }
      entry.photo = photo;
    }

    const entries = await addCheckin(clientId, entry);
    return jsonResponse(200, { success: true, entries });
  }

  // --- Get check-in history ---
  if (action === 'get-checkins') {
    const entries = await getCheckins(clientId);
    return jsonResponse(200, { entries });
  }

  // --- Save nutrition log (meals eaten, supplements taken) ---
  if (action === 'save-nutrition-log') {
    const { date, log } = body;
    if (!date || !log) {
      return jsonResponse(400, { error: 'Datum a log jsou povinné' });
    }
    await saveNutritionLog(clientId, date, log);
    return jsonResponse(200, { success: true });
  }

  // --- Get nutrition log ---
  if (action === 'get-nutrition-log') {
    const { date } = body;
    if (!date) {
      return jsonResponse(400, { error: 'Datum je povinné' });
    }
    const log = await getNutritionLog(clientId, date);
    return jsonResponse(200, { log });
  }

  // --- Get dashboard (all data at once) ---
  if (action === 'dashboard') {
    const today = new Date().toISOString().split('T')[0];
    const [plan, nutrition, progressEntries, todayLog, onboarding, messages, todayNutritionLog, checkins] = await Promise.all([
      getPlan(clientId),
      getNutrition(clientId),
      getProgress(clientId),
      getWorkoutLog(clientId, today),
      getOnboarding(clientId),
      getMessages(clientId),
      getNutritionLog(clientId, today),
      getCheckins(clientId),
    ]);

    const { passwordHash, ...safeClient } = client;

    return jsonResponse(200, {
      client: safeClient,
      plan,
      nutrition,
      progress: progressEntries.slice(-30),
      todayLog,
      todayNutritionLog,
      onboarding,
      messages: messages.slice(-50),
      checkins: checkins.slice(-20),
    });
  }

  return jsonResponse(400, { error: 'Neznámá akce' });
};
