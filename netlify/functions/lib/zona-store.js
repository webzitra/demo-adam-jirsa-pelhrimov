const { getStore } = require('@netlify/blobs');

// Netlify Blobs store pro všechna data klientské zóny
// Keys:
//   clients              → { clients: [...] }
//   plan:{clientId}      → { plan object }
//   nutrition:{clientId} → { nutrition object }
//   progress:{clientId}  → { entries: [...] }

const STORE_NAME = 'zona-data';

async function getZonaStore() {
  // Explicit config needed for Functions v1 (manual deploys)
  const siteID = process.env.SITE_ID;
  const token = process.env.NETLIFY_TOKEN;

  if (siteID && token) {
    return getStore({ name: STORE_NAME, siteID, token });
  }
  // Fallback for deploy-triggered builds (auto-injected env)
  return getStore(STORE_NAME);
}

// --- Clients ---
async function getAllClients() {
  const store = await getZonaStore();
  try {
    const data = await store.get('clients', { type: 'json' });
    return data?.clients || [];
  } catch {
    return [];
  }
}

async function saveAllClients(clients) {
  const store = await getZonaStore();
  await store.setJSON('clients', { clients, updatedAt: new Date().toISOString() });
}

async function getClientByEmail(email) {
  const clients = await getAllClients();
  return clients.find(c => c.email.toLowerCase() === email.toLowerCase()) || null;
}

async function getClientById(id) {
  const clients = await getAllClients();
  return clients.find(c => c.id === id) || null;
}

// --- Training Plans ---
async function getPlan(clientId) {
  const store = await getZonaStore();
  try {
    return await store.get(`plan:${clientId}`, { type: 'json' });
  } catch {
    return null;
  }
}

async function savePlan(clientId, plan) {
  const store = await getZonaStore();
  await store.setJSON(`plan:${clientId}`, {
    ...plan,
    clientId,
    updatedAt: new Date().toISOString(),
  });
}

// --- Nutrition Plans ---
async function getNutrition(clientId) {
  const store = await getZonaStore();
  try {
    return await store.get(`nutrition:${clientId}`, { type: 'json' });
  } catch {
    return null;
  }
}

async function saveNutrition(clientId, nutrition) {
  const store = await getZonaStore();
  await store.setJSON(`nutrition:${clientId}`, {
    ...nutrition,
    clientId,
    updatedAt: new Date().toISOString(),
  });
}

// --- Progress ---
async function getProgress(clientId) {
  const store = await getZonaStore();
  try {
    const data = await store.get(`progress:${clientId}`, { type: 'json' });
    return data?.entries || [];
  } catch {
    return [];
  }
}

async function addProgressEntry(clientId, entry) {
  const entries = await getProgress(clientId);
  entries.push({
    ...entry,
    id: `prog-${Date.now()}`,
    createdAt: new Date().toISOString(),
  });
  const store = await getZonaStore();
  await store.setJSON(`progress:${clientId}`, { entries, updatedAt: new Date().toISOString() });
}

// --- Workout Logs ---
async function getWorkoutLog(clientId, date) {
  const store = await getZonaStore();
  try {
    return await store.get(`workout:${clientId}:${date}`, { type: 'json' });
  } catch {
    return null;
  }
}

async function saveWorkoutLog(clientId, date, log) {
  const store = await getZonaStore();
  await store.setJSON(`workout:${clientId}:${date}`, {
    ...log,
    clientId,
    date,
    updatedAt: new Date().toISOString(),
  });
}

// --- Plan Templates ---
function getDefaultTemplates() {
  const ex = (name, sets, reps, rest) => ({ name, sets, reps, rest, videoUrl: '', notes: '' });
  const restDay = { name: 'Volno', rest: true, exercises: [] };

  return [
    {
      id: 'default-ppl', name: 'PPL (Push/Pull/Legs)', description: '6denní split — klasika pro pokročilé',
      createdAt: '2025-01-01T00:00:00.000Z',
      days: {
        monday: { name: 'Push A', rest: false, exercises: [
          ex('Bench press (rovná lavice)','4','8-10','90s'), ex('Šikmý bench press (činky)','3','10-12','75s'),
          ex('Peck deck','3','12-15','60s'), ex('Military press (tyč)','4','8-10','90s'),
          ex('Upažování s jednoručkami','3','12-15','60s'), ex('Tricepsový stahák (lano)','3','12-15','60s'),
          ex('Francouzský tlak (EZ tyč)','3','10-12','75s')
        ]},
        tuesday: { name: 'Pull A', rest: false, exercises: [
          ex('Shyby nadhmatem','4','6-10','90s'), ex('Veslování v předklonu (tyč)','4','8-10','90s'),
          ex('Lat pulldown (široký)','3','10-12','75s'), ex('Seated row (kladka)','3','10-12','75s'),
          ex('Face pulls','3','15-20','60s'), ex('Bicepsový curl (EZ tyč)','3','10-12','60s'),
          ex('Hammer curl','3','12','60s')
        ]},
        wednesday: { name: 'Legs A', rest: false, exercises: [
          ex('Dřep s tyčí','4','8-10','120s'), ex('Leg press','3','12-15','75s'),
          ex('Bulharský dřep','3','10-12','75s'), ex('Leg curl','3','10-12','60s'),
          ex('Leg extension','3','12-15','60s'), ex('Hip thrust','3','10-12','75s'),
          ex('Lýtka vestoje','4','15-20','45s')
        ]},
        thursday: { name: 'Push B', rest: false, exercises: [
          ex('Šikmý bench press (velká)','4','8-10','90s'), ex('Bench press (činky)','3','10-12','75s'),
          ex('Kabelový crossover','3','12-15','60s'), ex('Tlak s jednoručkami (ramena)','3','10-12','75s'),
          ex('Reverse fly','3','12-15','60s'), ex('Close-grip bench press','3','8-10','90s'),
          ex('Overhead triceps extension','3','10-12','60s')
        ]},
        friday: { name: 'Pull B', rest: false, exercises: [
          ex('Mrtvý tah','4','6-8','120s'), ex('Veslování s jednoručkou','3','10-12','75s'),
          ex('Lat pulldown (úzký)','3','10-12','75s'), ex('T-bar row','3','8-10','90s'),
          ex('Hyperextenze','3','12-15','60s'), ex('Preacher curl','3','10-12','60s'),
          ex('Bicepsový curl na kladce','3','12-15','60s')
        ]},
        saturday: { name: 'Legs B', rest: false, exercises: [
          ex('Front squat','3','8-10','90s'), ex('Výpady chůzí','3','12-16','75s'),
          ex('Rumunský mrtvý tah','3','10-12','90s'), ex('Leg extension','3','12-15','60s'),
          ex('Leg curl','3','10-12','60s'), ex('Sumo dřep','3','10-12','90s'),
          ex('Lýtka vsedě','3','15-20','45s')
        ]},
        sunday: restDay
      }
    },
    {
      id: 'default-upper-lower', name: 'Upper / Lower split', description: '4denní split — ideální pro středně pokročilé',
      createdAt: '2025-01-01T00:00:00.000Z',
      days: {
        monday: { name: 'Upper A', rest: false, exercises: [
          ex('Bench press (rovná lavice)','4','8-10','90s'), ex('Veslování v předklonu (tyč)','4','8-10','90s'),
          ex('Military press (tyč)','3','10-12','75s'), ex('Lat pulldown (široký)','3','10-12','75s'),
          ex('Bicepsový curl (jednoručky)','3','10-12','60s'), ex('Tricepsové kliky na bradlech','3','8-12','75s')
        ]},
        tuesday: { name: 'Lower A', rest: false, exercises: [
          ex('Dřep s tyčí','4','8-10','120s'), ex('Rumunský mrtvý tah','3','10-12','90s'),
          ex('Leg press','3','12-15','75s'), ex('Leg curl','3','10-12','60s'),
          ex('Hip thrust','3','10-12','75s'), ex('Lýtka vestoje','4','15-20','45s')
        ]},
        wednesday: restDay,
        thursday: { name: 'Upper B', rest: false, exercises: [
          ex('Šikmý bench press (činky)','3','10-12','75s'), ex('Shyby nadhmatem','4','6-10','90s'),
          ex('Tlak s jednoručkami (ramena)','3','10-12','75s'), ex('Seated row (kladka)','3','10-12','75s'),
          ex('Hammer curl','3','12','60s'), ex('Tricepsový stahák (lano)','3','12-15','60s')
        ]},
        friday: { name: 'Lower B', rest: false, exercises: [
          ex('Mrtvý tah','4','6-8','120s'), ex('Bulharský dřep','3','10-12','75s'),
          ex('Leg extension','3','12-15','60s'), ex('Leg curl','3','10-12','60s'),
          ex('Výpady s činkami','3','10-12','75s'), ex('Lýtka vsedě','3','15-20','45s')
        ]},
        saturday: restDay,
        sunday: restDay
      }
    },
    {
      id: 'default-fullbody', name: 'Full body', description: '3denní celotělový trénink',
      createdAt: '2025-01-01T00:00:00.000Z',
      days: {
        monday: { name: 'Full body A', rest: false, exercises: [
          ex('Dřep s tyčí','4','8-10','120s'), ex('Bench press (rovná lavice)','4','8-10','90s'),
          ex('Veslování v předklonu (tyč)','4','8-10','90s'), ex('Military press (tyč)','3','10-12','75s'),
          ex('Bicepsový curl (EZ tyč)','3','10-12','60s'), ex('Plank','3','45-60s','45s')
        ]},
        tuesday: restDay,
        wednesday: { name: 'Full body B', rest: false, exercises: [
          ex('Mrtvý tah','4','6-8','120s'), ex('Šikmý bench press (činky)','3','10-12','75s'),
          ex('Lat pulldown (široký)','3','10-12','75s'), ex('Tlak s jednoručkami (ramena)','3','10-12','75s'),
          ex('Tricepsový stahák (lano)','3','12-15','60s'), ex('Hanging leg raise','3','10-15','60s')
        ]},
        thursday: restDay,
        friday: { name: 'Full body C', rest: false, exercises: [
          ex('Leg press','3','12-15','75s'), ex('Bench press (činky)','3','10-12','75s'),
          ex('Shyby nadhmatem','3','6-10','90s'), ex('Arnold press','3','10-12','75s'),
          ex('Hammer curl','3','12','60s'), ex('Russian twist','3','20','45s')
        ]},
        saturday: restDay,
        sunday: restDay
      }
    },
    {
      id: 'default-beginner', name: 'Začátečník', description: '3denní plán pro začínající — základní cviky',
      createdAt: '2025-01-01T00:00:00.000Z',
      days: {
        monday: { name: 'Trénink A', rest: false, exercises: [
          ex('Dřep s činkami','3','10-12','90s'), ex('Bench press (činky)','3','10-12','75s'),
          ex('Veslování s jednoručkou','3','10-12','75s'), ex('Kliky na zemi','3','15-20','60s'),
          ex('Plank','3','45-60s','45s'), ex('Lýtka vestoje','3','15-20','45s')
        ]},
        tuesday: restDay,
        wednesday: { name: 'Trénink B', rest: false, exercises: [
          ex('Leg press','3','12-15','75s'), ex('Lat pulldown (široký)','3','10-12','75s'),
          ex('Tlak s jednoručkami (ramena)','3','10-12','75s'), ex('Bicepsový curl (jednoručky)','3','10-12','60s'),
          ex('Crunches','3','15-20','45s')
        ]},
        thursday: restDay,
        friday: { name: 'Trénink C', rest: false, exercises: [
          ex('Výpady s činkami','3','10-12','75s'), ex('Bench press (rovná lavice)','3','10-12','90s'),
          ex('Seated row (kladka)','3','10-12','75s'), ex('Face pulls','3','15-20','60s'),
          ex('Dead bug','3','10-12','45s'), ex('Hyperextenze','3','12-15','60s')
        ]},
        saturday: restDay,
        sunday: restDay
      }
    },
    {
      id: 'default-women', name: 'Ženy — zpevnění', description: '4denní plán se zaměřením na nohy, glutes a core',
      createdAt: '2025-01-01T00:00:00.000Z',
      days: {
        monday: { name: 'Lower focus', rest: false, exercises: [
          ex('Hip thrust','3','10-12','75s'), ex('Bulharský dřep','3','10-12','75s'),
          ex('Leg press','3','12-15','75s'), ex('Leg curl','3','10-12','60s'),
          ex('Výpady chůzí','3','12-16','75s'), ex('Plank','3','45-60s','45s')
        ]},
        tuesday: { name: 'Upper', rest: false, exercises: [
          ex('Lat pulldown (široký)','3','10-12','75s'), ex('Bench press (činky)','3','10-12','75s'),
          ex('Veslování s jednoručkou','3','10-12','75s'), ex('Tlak s jednoručkami (ramena)','3','10-12','75s'),
          ex('Face pulls','3','15-20','60s'), ex('Tricepsový stahák (lano)','3','12-15','60s')
        ]},
        wednesday: restDay,
        thursday: { name: 'Glutes & Legs', rest: false, exercises: [
          ex('Sumo dřep','3','10-12','90s'), ex('Hip thrust','3','10-12','75s'),
          ex('Výpady s činkami','3','10-12','75s'), ex('Leg extension','3','12-15','60s'),
          ex('Leg curl','3','10-12','60s'), ex('Boční plank','3','30-45s','45s')
        ]},
        friday: { name: 'Full body + kondice', rest: false, exercises: [
          ex('Dřep s činkami','3','10-12','90s'), ex('Kliky na zemi','3','15-20','60s'),
          ex('Seated row (kladka)','3','10-12','75s'), ex('Kettlebell swing','3','15-20','60s'),
          ex('Russian twist','3','20','45s'), ex('Burpees','3','10','60s')
        ]},
        saturday: restDay,
        sunday: restDay
      }
    }
  ];
}

async function getTemplates() {
  const store = await getZonaStore();
  try {
    const data = await store.get('plan-templates', { type: 'json' });
    const templates = data?.templates || [];
    if (templates.length > 0) return templates;
  } catch {}
  return getDefaultTemplates();
}

async function saveTemplates(templates) {
  const store = await getZonaStore();
  await store.setJSON('plan-templates', { templates, updatedAt: new Date().toISOString() });
}

// --- Day Templates (single day training templates) ---
async function getDayTemplates() {
  const store = await getZonaStore();
  try {
    const data = await store.get('day-templates', { type: 'json' });
    return data?.templates || [];
  } catch {
    return [];
  }
}

async function saveDayTemplates(templates) {
  const store = await getZonaStore();
  await store.setJSON('day-templates', { templates, updatedAt: new Date().toISOString() });
}

// --- Nutrition Templates ---
async function getNutritionTemplates() {
  const store = await getZonaStore();
  try {
    const data = await store.get('nutrition-templates', { type: 'json' });
    return data?.templates || [];
  } catch {
    return [];
  }
}

async function saveNutritionTemplates(templates) {
  const store = await getZonaStore();
  await store.setJSON('nutrition-templates', { templates, updatedAt: new Date().toISOString() });
}

// --- Onboarding ---
async function getOnboarding(clientId) {
  const store = await getZonaStore();
  try {
    return await store.get(`onboarding:${clientId}`, { type: 'json' });
  } catch {
    return null;
  }
}

async function saveOnboarding(clientId, data) {
  const store = await getZonaStore();
  await store.setJSON(`onboarding:${clientId}`, {
    ...data,
    clientId,
    updatedAt: new Date().toISOString(),
  });
}

// --- Messages (Chat) ---
async function getMessages(clientId) {
  const store = await getZonaStore();
  try {
    const data = await store.get(`messages:${clientId}`, { type: 'json' });
    return data?.messages || [];
  } catch {
    return [];
  }
}

async function addMessage(clientId, message) {
  const messages = await getMessages(clientId);
  messages.push({
    ...message,
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  });
  const store = await getZonaStore();
  await store.setJSON(`messages:${clientId}`, { messages, updatedAt: new Date().toISOString() });
  return messages;
}

// --- Check-ins (weekly check-in history) ---
async function getCheckins(clientId) {
  const store = await getZonaStore();
  try {
    const data = await store.get(`checkins:${clientId}`, { type: 'json' });
    return data?.entries || [];
  } catch {
    return [];
  }
}

async function addCheckin(clientId, entry) {
  const entries = await getCheckins(clientId);
  entries.push({
    ...entry,
    id: `ci-${Date.now()}`,
    createdAt: new Date().toISOString(),
  });
  const store = await getZonaStore();
  await store.setJSON(`checkins:${clientId}`, { entries, updatedAt: new Date().toISOString() });
  return entries;
}

// --- Nutrition Log (daily tracking: meals eaten, supplements taken) ---
async function getNutritionLog(clientId, date) {
  const store = await getZonaStore();
  try {
    return await store.get(`nutlog:${clientId}:${date}`, { type: 'json' });
  } catch {
    return null;
  }
}

async function saveNutritionLog(clientId, date, log) {
  const store = await getZonaStore();
  await store.setJSON(`nutlog:${clientId}:${date}`, {
    ...log,
    clientId,
    date,
    updatedAt: new Date().toISOString(),
  });
}

// --- Schedule (weekly calendar) ---
async function getSchedule(weekKey) {
  const store = await getZonaStore();
  try {
    const data = await store.get(`schedule:${weekKey}`, { type: 'json' });
    return data?.sessions || [];
  } catch {
    return [];
  }
}

async function saveSchedule(weekKey, sessions) {
  const store = await getZonaStore();
  await store.setJSON(`schedule:${weekKey}`, { sessions, updatedAt: new Date().toISOString() });
}

// --- Payments ---
async function getPayments() {
  const store = await getZonaStore();
  try {
    const data = await store.get('payments', { type: 'json' });
    return data?.payments || [];
  } catch {
    return [];
  }
}

async function savePayments(payments) {
  const store = await getZonaStore();
  await store.setJSON('payments', { payments, updatedAt: new Date().toISOString() });
}

module.exports = {
  getAllClients,
  saveAllClients,
  getClientByEmail,
  getClientById,
  getPlan,
  savePlan,
  getNutrition,
  saveNutrition,
  getProgress,
  addProgressEntry,
  getWorkoutLog,
  saveWorkoutLog,
  getTemplates,
  saveTemplates,
  getOnboarding,
  saveOnboarding,
  getMessages,
  addMessage,
  getNutritionLog,
  saveNutritionLog,
  getCheckins,
  addCheckin,
  getSchedule,
  saveSchedule,
  getPayments,
  savePayments,
  getNutritionTemplates,
  saveNutritionTemplates,
  getDayTemplates,
  saveDayTemplates,
};
