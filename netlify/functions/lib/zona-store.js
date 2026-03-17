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
async function getTemplates() {
  const store = await getZonaStore();
  try {
    const data = await store.get('plan-templates', { type: 'json' });
    return data?.templates || [];
  } catch {
    return [];
  }
}

async function saveTemplates(templates) {
  const store = await getZonaStore();
  await store.setJSON('plan-templates', { templates, updatedAt: new Date().toISOString() });
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
};
