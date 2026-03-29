const { verifySession, jsonResponse, parseAuth } = require('./lib/zona-auth');
const {
  getClientById, getPlan, getNutrition, getProgress, addProgressEntry,
  getWorkoutLog, saveWorkoutLog, getOnboarding, saveOnboarding,
  getMessages, addMessage,
  getNutritionLog, saveNutritionLog,
  getCheckins, addCheckin,
  getSchedule,
  getPdfs,
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

    // Calculate current and next week keys for schedule
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diffToMonday);
    monday.setHours(0, 0, 0, 0);

    function calcWeekKey(mon) {
      const jan4 = new Date(mon.getFullYear(), 0, 4);
      const days = Math.round((mon - jan4) / 86400000);
      const weekNum = Math.ceil((days + jan4.getDay()) / 7);
      return `${mon.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    }

    const thisWeekKey = calcWeekKey(monday);
    const nextMonday = new Date(monday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    const nextWeekKey = calcWeekKey(nextMonday);

    const [plan, nutrition, progressEntries, todayLog, onboarding, messages, todayNutritionLog, checkins, thisWeekSessions, nextWeekSessions] = await Promise.all([
      getPlan(clientId),
      getNutrition(clientId),
      getProgress(clientId),
      getWorkoutLog(clientId, today),
      getOnboarding(clientId),
      getMessages(clientId),
      getNutritionLog(clientId, today),
      getCheckins(clientId),
      getSchedule(thisWeekKey),
      getSchedule(nextWeekKey),
    ]);

    // Filter schedule to this client's future sessions only
    const mySessions = [...thisWeekSessions, ...nextWeekSessions]
      .filter(s => s.clientId === clientId && s.date >= today)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

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
      schedule: mySessions,
    });
  }

  // --- Exercise history (progressive overload tracking) ---
  if (action === 'get-exercise-history') {
    const { exerciseName } = body;
    if (!exerciseName) {
      return jsonResponse(400, { error: 'exerciseName je povinné' });
    }

    const plan = await getPlan(clientId);
    const lookbackDays = 90;
    const history = [];
    const now = new Date();

    for (let i = 0; i < lookbackDays; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      try {
        const log = await getWorkoutLog(clientId, dateStr);
        if (log && log.exercises && log.day && plan?.days?.[log.day]) {
          const dayExercises = plan.days[log.day].exercises || [];
          log.exercises.forEach(le => {
            const planEx = dayExercises[le.index];
            if (planEx && planEx.name === exerciseName && le.done) {
              history.push({
                date: dateStr,
                actualWeight: le.actualWeight || '',
                actualSets: le.actualSets || '',
                actualReps: le.actualReps || '',
              });
            }
          });
        }
      } catch {}
    }

    return jsonResponse(200, { exerciseName, history: history.reverse() });
  }

  // --- Get my PDF documents (list without data) ---
  if (action === 'get-pdfs') {
    const pdfs = await getPdfs(clientId);
    const list = pdfs.map(({ data, ...rest }) => rest);
    return jsonResponse(200, { pdfs: list });
  }

  // --- Download specific PDF ---
  if (action === 'download-pdf') {
    const { pdfId } = body;
    if (!pdfId) return jsonResponse(400, { error: 'pdfId je povinné' });

    const pdfs = await getPdfs(clientId);
    const pdf = pdfs.find(p => p.id === pdfId);
    if (!pdf) return jsonResponse(404, { error: 'Dokument nenalezen' });

    return jsonResponse(200, { pdf });
  }

  return jsonResponse(400, { error: 'Neznámá akce' });
};
