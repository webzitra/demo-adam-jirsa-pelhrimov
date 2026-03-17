(function() {
  'use strict';

  const API = '/api';
  let sessionToken = localStorage.getItem('admin_token');
  let clients = [];
  let currentPlan = null;
  let selectedClientId = null;
  let currentDay = 'monday';

  const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // ===== Theme toggle =====
  const allThemeToggles = document.querySelectorAll('#theme-toggle, #login-theme-toggle');
  function updateThemeIcons() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    allThemeToggles.forEach(btn => { btn.textContent = isLight ? '☀️' : '🌙'; });
  }
  updateThemeIcons();
  function toggleTheme() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('zona_theme');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('zona_theme', 'light');
    }
    updateThemeIcons();
  }
  allThemeToggles.forEach(btn => btn.addEventListener('click', toggleTheme));

  // ===== Exercise database pro autocomplete =====
  const EXERCISE_DB = [
    // Hrudník
    { name: 'Bench press (rovná lavice)', category: 'Hrudník', defaults: { sets: '4', reps: '8-10', rest: '90s' } },
    { name: 'Bench press (činky)', category: 'Hrudník', defaults: { sets: '3', reps: '10-12', rest: '75s' } },
    { name: 'Šikmý bench press (činky)', category: 'Hrudník', defaults: { sets: '3', reps: '10-12', rest: '75s' } },
    { name: 'Šikmý bench press (velká)', category: 'Hrudník', defaults: { sets: '4', reps: '8-10', rest: '90s' } },
    { name: 'Peck deck', category: 'Hrudník', defaults: { sets: '3', reps: '12-15', rest: '60s' } },
    { name: 'Rozpažky s činkami', category: 'Hrudník', defaults: { sets: '3', reps: '12-15', rest: '60s' } },
    { name: 'Kabelový crossover', category: 'Hrudník', defaults: { sets: '3', reps: '12-15', rest: '60s' } },
    { name: 'Kliky na zemi', category: 'Hrudník', defaults: { sets: '3', reps: '15-20', rest: '60s' } },
    // Záda
    { name: 'Shyby nadhmatem', category: 'Záda', defaults: { sets: '4', reps: '6-10', rest: '90s' } },
    { name: 'Shyby podhmatem', category: 'Záda', defaults: { sets: '3', reps: '8-12', rest: '90s' } },
    { name: 'Veslování s jednoručkou', category: 'Záda', defaults: { sets: '3', reps: '10-12', rest: '75s' } },
    { name: 'Veslování v předklonu (tyč)', category: 'Záda', defaults: { sets: '4', reps: '8-10', rest: '90s' } },
    { name: 'Lat pulldown (široký)', category: 'Záda', defaults: { sets: '3', reps: '10-12', rest: '75s' } },
    { name: 'Lat pulldown (úzký)', category: 'Záda', defaults: { sets: '3', reps: '10-12', rest: '75s' } },
    { name: 'Seated row (kladka)', category: 'Záda', defaults: { sets: '3', reps: '10-12', rest: '75s' } },
    { name: 'T-bar row', category: 'Záda', defaults: { sets: '3', reps: '8-10', rest: '90s' } },
    { name: 'Mrtvý tah', category: 'Záda', defaults: { sets: '4', reps: '6-8', rest: '120s' } },
    { name: 'Rumunský mrtvý tah', category: 'Záda', defaults: { sets: '3', reps: '10-12', rest: '90s' } },
    { name: 'Face pulls', category: 'Záda', defaults: { sets: '3', reps: '15-20', rest: '60s' } },
    { name: 'Hyperextenze', category: 'Záda', defaults: { sets: '3', reps: '12-15', rest: '60s' } },
    // Ramena
    { name: 'Tlak s jednoručkami (ramena)', category: 'Ramena', defaults: { sets: '3', reps: '10-12', rest: '75s' } },
    { name: 'Tlak za hlavou (Smith)', category: 'Ramena', defaults: { sets: '3', reps: '10-12', rest: '75s' } },
    { name: 'Military press (tyč)', category: 'Ramena', defaults: { sets: '4', reps: '8-10', rest: '90s' } },
    { name: 'Upažování s jednoručkami', category: 'Ramena', defaults: { sets: '3', reps: '12-15', rest: '60s' } },
    { name: 'Předpažování s jednoručkami', category: 'Ramena', defaults: { sets: '3', reps: '12-15', rest: '60s' } },
    { name: 'Reverse fly', category: 'Ramena', defaults: { sets: '3', reps: '12-15', rest: '60s' } },
    { name: 'Arnold press', category: 'Ramena', defaults: { sets: '3', reps: '10-12', rest: '75s' } },
    { name: 'Upažování na kladce', category: 'Ramena', defaults: { sets: '3', reps: '12-15', rest: '60s' } },
    // Biceps
    { name: 'Bicepsový curl (EZ tyč)', category: 'Biceps', defaults: { sets: '3', reps: '10-12', rest: '60s' } },
    { name: 'Bicepsový curl (jednoručky)', category: 'Biceps', defaults: { sets: '3', reps: '10-12', rest: '60s' } },
    { name: 'Hammer curl', category: 'Biceps', defaults: { sets: '3', reps: '12', rest: '60s' } },
    { name: 'Concentration curl', category: 'Biceps', defaults: { sets: '3', reps: '10-12', rest: '60s' } },
    { name: 'Bicepsový curl na kladce', category: 'Biceps', defaults: { sets: '3', reps: '12-15', rest: '60s' } },
    { name: 'Preacher curl', category: 'Biceps', defaults: { sets: '3', reps: '10-12', rest: '60s' } },
    // Triceps
    { name: 'Tricepsové kliky na bradlech', category: 'Triceps', defaults: { sets: '3', reps: '8-12', rest: '75s' } },
    { name: 'Tricepsový stahák (lano)', category: 'Triceps', defaults: { sets: '3', reps: '12-15', rest: '60s' } },
    { name: 'Tricepsový stahák (tyč)', category: 'Triceps', defaults: { sets: '3', reps: '10-12', rest: '60s' } },
    { name: 'Francouzský tlak (EZ tyč)', category: 'Triceps', defaults: { sets: '3', reps: '10-12', rest: '75s' } },
    { name: 'Kickbacky', category: 'Triceps', defaults: { sets: '3', reps: '12-15', rest: '60s' } },
    { name: 'Overhead triceps extension', category: 'Triceps', defaults: { sets: '3', reps: '10-12', rest: '60s' } },
    { name: 'Close-grip bench press', category: 'Triceps', defaults: { sets: '3', reps: '8-10', rest: '90s' } },
    // Nohy
    { name: 'Dřep s tyčí', category: 'Nohy', defaults: { sets: '4', reps: '8-10', rest: '120s' } },
    { name: 'Dřep s činkami', category: 'Nohy', defaults: { sets: '3', reps: '10-12', rest: '90s' } },
    { name: 'Front squat', category: 'Nohy', defaults: { sets: '3', reps: '8-10', rest: '90s' } },
    { name: 'Bulharský dřep', category: 'Nohy', defaults: { sets: '3', reps: '10-12', rest: '75s' } },
    { name: 'Leg press', category: 'Nohy', defaults: { sets: '3', reps: '12-15', rest: '75s' } },
    { name: 'Leg extension', category: 'Nohy', defaults: { sets: '3', reps: '12-15', rest: '60s' } },
    { name: 'Leg curl', category: 'Nohy', defaults: { sets: '3', reps: '10-12', rest: '60s' } },
    { name: 'Výpady s činkami', category: 'Nohy', defaults: { sets: '3', reps: '10-12', rest: '75s' } },
    { name: 'Výpady chůzí', category: 'Nohy', defaults: { sets: '3', reps: '12-16', rest: '75s' } },
    { name: 'Hip thrust', category: 'Nohy', defaults: { sets: '3', reps: '10-12', rest: '75s' } },
    { name: 'Lýtka vestoje', category: 'Nohy', defaults: { sets: '4', reps: '15-20', rest: '45s' } },
    { name: 'Lýtka vsedě', category: 'Nohy', defaults: { sets: '3', reps: '15-20', rest: '45s' } },
    { name: 'Sumo dřep', category: 'Nohy', defaults: { sets: '3', reps: '10-12', rest: '90s' } },
    // Core
    { name: 'Plank', category: 'Core', defaults: { sets: '3', reps: '45-60s', rest: '45s' } },
    { name: 'Boční plank', category: 'Core', defaults: { sets: '3', reps: '30-45s', rest: '45s' } },
    { name: 'Crunches', category: 'Core', defaults: { sets: '3', reps: '15-20', rest: '45s' } },
    { name: 'Hanging leg raise', category: 'Core', defaults: { sets: '3', reps: '10-15', rest: '60s' } },
    { name: 'Cable crunch', category: 'Core', defaults: { sets: '3', reps: '12-15', rest: '60s' } },
    { name: 'Russian twist', category: 'Core', defaults: { sets: '3', reps: '20', rest: '45s' } },
    { name: 'Ab wheel rollout', category: 'Core', defaults: { sets: '3', reps: '10-12', rest: '60s' } },
    { name: 'Dead bug', category: 'Core', defaults: { sets: '3', reps: '10-12', rest: '45s' } },
    // Kardio / Kondice
    { name: 'Burpees', category: 'Kondice', defaults: { sets: '3', reps: '10', rest: '60s' } },
    { name: 'Kettlebell swing', category: 'Kondice', defaults: { sets: '3', reps: '15-20', rest: '60s' } },
    { name: 'Box jumps', category: 'Kondice', defaults: { sets: '3', reps: '10', rest: '60s' } },
    { name: 'Battle ropes', category: 'Kondice', defaults: { sets: '3', reps: '30s', rest: '45s' } },
    { name: 'Farmers walk', category: 'Kondice', defaults: { sets: '3', reps: '40m', rest: '60s' } },
  ];

  // ===== DOM =====
  const loginScreen = document.getElementById('login-screen');
  const adminScreen = document.getElementById('admin-screen');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');

  const tabOverview = document.getElementById('tab-overview');
  const tabClients = document.getElementById('tab-clients');
  const tabPlanEditor = document.getElementById('tab-plan-editor');
  const tabNutritionEditor = document.getElementById('tab-nutrition-editor');
  const tabMyWebsite = document.getElementById('tab-my-website');

  const clientsList = document.getElementById('clients-list');
  const addClientForm = document.getElementById('add-client-form');

  const planClientSelect = document.getElementById('plan-client-select');
  const loadPlanBtn = document.getElementById('load-plan-btn');
  const planEditorSection = document.getElementById('plan-editor-section');
  const planClientName = document.getElementById('plan-client-name');
  const planMessage = document.getElementById('plan-message');
  const planDayTabs = document.getElementById('plan-day-tabs');
  const dayNameInput = document.getElementById('day-name');
  const dayRestCheckbox = document.getElementById('day-rest');
  const exercisesEditor = document.getElementById('exercises-editor');
  const addExerciseBtn = document.getElementById('add-exercise-btn');
  const savePlanBtn = document.getElementById('save-plan-btn');
  const planStatus = document.getElementById('plan-status');

  // ===== Init =====
  async function init() {
    if (sessionToken) {
      await tryAutoLogin();
    } else {
      showScreen('login');
    }
  }

  // ===== API =====
  async function api(endpoint, body) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`,
    };
    const res = await fetch(`${API}/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Chyba');
    return data;
  }

  function showScreen(name) {
    loginScreen.classList.toggle('active', name === 'login');
    adminScreen.classList.toggle('active', name === 'admin');
  }

  // ===== Auth =====
  async function tryAutoLogin() {
    try {
      await api('zona-auth', { action: 'admin-verify', sessionToken });
      showScreen('admin');
      // Load clients and overview in parallel for faster startup
      Promise.all([loadClients(), loadOverview()]);
    } catch {
      localStorage.removeItem('admin_token');
      sessionToken = null;
      showScreen('login');
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;

    const password = document.getElementById('admin-password').value;
    try {
      const data = await api('zona-auth', { action: 'admin-login', password });
      sessionToken = data.sessionToken;
      localStorage.setItem('admin_token', sessionToken);
      showScreen('admin');
      Promise.all([loadClients(), loadOverview()]);
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    }
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    sessionToken = null;
    showScreen('login');
  });

  // ===== Tabs =====
  const allTabs = { overview: tabOverview, clients: tabClients, 'plan-editor': tabPlanEditor, 'nutrition-editor': tabNutritionEditor, 'my-website': tabMyWebsite };

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabName = tab.dataset.tab;
      Object.keys(allTabs).forEach(k => { allTabs[k].hidden = k !== tabName; });
    });
  });

  function switchTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });
    Object.keys(allTabs).forEach(k => { allTabs[k].hidden = k !== tabName; });
  }

  // ===== Overview / Dashboard Metrics =====
  async function loadOverview() {
    try {
      const data = await api('zona-admin', { action: 'dashboard-metrics' });

      document.getElementById('stat-total').textContent = data.totalClients;
      document.getElementById('stat-active').textContent = data.activeClients;

      const metrics = data.clientMetrics || [];
      const onboarded = metrics.filter(m => m.hasOnboarding).length;
      document.getElementById('stat-onboarded').textContent = onboarded;

      // Inactive: no workout in 3+ days
      const inactive = metrics.filter(m => {
        if (!m.lastWorkoutDate) return true; // never trained
        const days = Math.floor((Date.now() - new Date(m.lastWorkoutDate).getTime()) / (1000 * 60 * 60 * 24));
        return days >= 3;
      });
      document.getElementById('stat-inactive').textContent = inactive.length;

      // Alerts
      const alertsList = document.getElementById('alerts-list');
      if (inactive.length === 0) {
        alertsList.innerHTML = '<p style="color: #34d399; font-size: 0.9rem;">✓ Všichni klienti trénují pravidelně!</p>';
      } else {
        alertsList.innerHTML = inactive.map(c => {
          const days = c.lastWorkoutDate
            ? Math.floor((Date.now() - new Date(c.lastWorkoutDate).getTime()) / (1000 * 60 * 60 * 24))
            : null;
          return `
            <div class="alert-row">
              <span class="alert-name">${esc(c.name)}</span>
              <span class="alert-detail">${days !== null ? `${days} dní bez tréninku` : 'Ještě netrénoval/a'}</span>
              <button class="btn-icon" onclick="openChatModal('${c.id}')" title="Napsat zprávu">💬</button>
            </div>`;
        }).join('');
      }

      // Latest weights
      const weightsList = document.getElementById('weights-list');
      const withWeights = metrics.filter(m => m.latestWeight);
      if (withWeights.length === 0) {
        weightsList.innerHTML = '<p class="text-muted">Žádné záznamy váhy.</p>';
      } else {
        weightsList.innerHTML = withWeights
          .sort((a, b) => new Date(b.latestWeightDate) - new Date(a.latestWeightDate))
          .map(c => {
            const date = new Date(c.latestWeightDate);
            const dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
            return `
              <div class="weight-row">
                <span class="weight-name">${esc(c.name)}</span>
                <span class="weight-value">${c.latestWeight} kg</span>
                <span class="weight-date">${dateStr}</span>
              </div>`;
          }).join('');
      }
    } catch (err) {
      document.getElementById('alerts-list').innerHTML = `<p style="color: #f87171;">${err.message}</p>`;
    }
  }

  // ===== Clients =====
  async function loadClients() {
    try {
      const data = await api('zona-admin', { action: 'list-clients' });
      clients = data.clients || [];
      renderClients();
      renderClientSelect();
    } catch (err) {
      clientsList.innerHTML = `<p style="color: #f87171;">${err.message}</p>`;
    }
  }

  function renderClients() {
    if (clients.length === 0) {
      clientsList.innerHTML = '<p class="text-muted">Zatím žádní klienti.</p>';
      return;
    }

    clientsList.innerHTML = clients.map(c => `
      <div class="client-row" data-id="${c.id}">
        <div class="client-info">
          <span class="client-name">${esc(c.name)}</span>
          <span class="client-email">${esc(c.email)}</span>
          ${c.phone ? `<span class="client-meta">📞 ${esc(c.phone)}</span>` : ''}
          ${c.notes ? `<span class="client-meta">${esc(c.notes)}</span>` : ''}
        </div>
        <div class="client-actions">
          <button class="btn-icon" onclick="editPlan('${c.id}')" title="Tréninkový plán">📋</button>
          <button class="btn-icon" onclick="editNutrition('${c.id}')" title="Výživa">🥗</button>
          <button class="btn-icon" onclick="showProgress('${c.id}')" title="Progres">📈</button>
          <button class="btn-icon" onclick="showOnboarding('${c.id}')" title="Dotazník">🎯</button>
          <button class="btn-icon" onclick="openChatModal('${c.id}')" title="Chat">💬</button>
          <button class="btn-icon danger" onclick="deleteClient('${c.id}')" title="Smazat">🗑</button>
        </div>
      </div>
    `).join('');
  }

  function renderClientSelect() {
    const options = '<option value="">— Vyber klienta —</option>' +
      clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    planClientSelect.innerHTML = options;
    document.getElementById('nutr-client-select').innerHTML = options;
  }

  // ===== Add client =====
  addClientForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('new-name').value.trim();
    const email = document.getElementById('new-email').value.trim();
    const password = document.getElementById('new-password').value.trim();
    const phone = document.getElementById('new-phone').value.trim();
    const notes = document.getElementById('new-notes').value.trim();

    try {
      await api('zona-admin', { action: 'create-client', name, email, password, phone, notes });
      addClientForm.reset();
      toast('✅ Klient vytvořen');
      await loadClients();
    } catch (err) {
      toast('❌ ' + err.message);
    }
  });

  // ===== Delete client =====
  window.deleteClient = async function(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!confirm(`Opravdu smazat klienta ${client?.name}?`)) return;

    try {
      await api('zona-admin', { action: 'delete-client', clientId });
      toast('Klient smazán');
      await loadClients();
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  // ===== Plan editor =====
  window.editPlan = function(clientId) {
    switchTab('plan-editor');
    planClientSelect.value = clientId;
    loadPlanForClient(clientId);
  };

  // Auto-load on client select change
  planClientSelect.addEventListener('change', () => {
    const clientId = planClientSelect.value;
    if (clientId) loadPlanForClient(clientId);
  });

  loadPlanBtn.addEventListener('click', () => {
    const clientId = planClientSelect.value;
    if (!clientId) return toast('Vyber klienta');
    loadPlanForClient(clientId);
  });

  async function loadPlanForClient(clientId) {
    selectedClientId = clientId;
    const client = clients.find(c => c.id === clientId);
    planClientName.textContent = client?.name || clientId;
    planEditorSection.hidden = false;

    try {
      const data = await api('zona-admin', { action: 'get-plan', clientId });
      currentPlan = data.plan || createEmptyPlan();
    } catch {
      currentPlan = createEmptyPlan();
    }

    planMessage.value = currentPlan.message || '';
    currentDay = 'monday';
    renderPlanDayTabs();
    renderDayEditor();
  }

  function createEmptyPlan() {
    const plan = { days: {}, message: '' };
    DAY_ORDER.forEach(d => {
      plan.days[d] = { name: '', rest: false, exercises: [] };
    });
    return plan;
  }

  // ===== Day tabs in plan editor =====
  function renderPlanDayTabs() {
    planDayTabs.querySelectorAll('.day-tab').forEach(tab => {
      const day = tab.dataset.day;
      tab.classList.toggle('active', day === currentDay);

      const dayData = currentPlan.days[day];
      tab.classList.toggle('rest', dayData?.rest || false);

      tab.onclick = () => {
        saveDayToModel();
        currentDay = day;
        renderPlanDayTabs();
        renderDayEditor();
      };
    });
  }

  // ===== Day editor =====
  function renderDayEditor() {
    const dayData = currentPlan.days[currentDay] || { name: '', rest: false, exercises: [] };

    dayNameInput.value = dayData.name || '';
    dayRestCheckbox.checked = dayData.rest || false;

    renderExercisesEditor(dayData.exercises || []);
    toggleExercisesVisibility();
  }

  dayRestCheckbox.addEventListener('change', toggleExercisesVisibility);

  function toggleExercisesVisibility() {
    const hidden = dayRestCheckbox.checked;
    exercisesEditor.style.display = hidden ? 'none' : '';
    addExerciseBtn.style.display = hidden ? 'none' : '';
    dayNameInput.disabled = hidden;
  }

  function renderExercisesEditor(exercises) {
    exercisesEditor.innerHTML = exercises.map((ex, i) => `
      <div class="exercise-edit-card" data-index="${i}">
        <div class="exercise-edit-header">
          <span class="exercise-edit-number">${i + 1}</span>
          <div class="exercise-edit-name" style="position: relative;">
            <input type="text" value="${escAttr(ex.name)}" placeholder="Začni psát název cviku..." data-field="name" autocomplete="off" data-ac-index="${i}">
            <div class="ac-dropdown" id="ac-dropdown-${i}" hidden></div>
          </div>
          <button class="exercise-edit-remove" onclick="removeExercise(${i})" title="Odebrat">✕</button>
        </div>
        <div class="exercise-edit-fields">
          <div class="exercise-field-group">
            <label>Série</label>
            <input type="text" value="${escAttr(ex.sets)}" placeholder="4" data-field="sets">
          </div>
          <div class="exercise-field-group">
            <label>Opakování</label>
            <input type="text" value="${escAttr(ex.reps)}" placeholder="10-12" data-field="reps">
          </div>
          <div class="exercise-field-group">
            <label>Odpočinek</label>
            <input type="text" value="${escAttr(ex.rest)}" placeholder="90s" data-field="rest">
          </div>
          <div class="exercise-field-group full-width">
            <label>YouTube odkaz (video ukázka)</label>
            <input type="url" value="${escAttr(ex.videoUrl)}" placeholder="https://youtube.com/watch?v=..." data-field="videoUrl">
          </div>
          <div class="exercise-field-group full-width">
            <label>Poznámky / technika</label>
            <textarea data-field="notes" placeholder="Kontroluj lopatky, drž core...">${esc(ex.notes || '')}</textarea>
          </div>
        </div>
      </div>
    `).join('');

    exercisesEditor.querySelectorAll('[data-field="name"]').forEach(input => {
      setupExerciseAutocomplete(input);
    });
  }

  // ===== Exercise autocomplete =====
  function setupExerciseAutocomplete(input) {
    const idx = input.dataset.acIndex;
    const dropdown = document.getElementById(`ac-dropdown-${idx}`);
    let selectedAcIdx = -1;

    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      if (query.length < 2) { dropdown.hidden = true; return; }

      const words = query.split(/\s+/);
      const matches = EXERCISE_DB.filter(ex => {
        const name = ex.name.toLowerCase();
        const cat = ex.category.toLowerCase();
        return words.every(w => name.includes(w) || cat.includes(w));
      }).slice(0, 8);

      if (matches.length === 0) { dropdown.hidden = true; return; }

      selectedAcIdx = -1;
      dropdown.innerHTML = matches.map((m, mi) => `
        <div class="ac-item" data-ac-mi="${mi}">
          <span class="ac-name">${highlightMatch(m.name, words)}</span>
          <span class="ac-cat">${esc(m.category)}</span>
        </div>
      `).join('');
      dropdown.hidden = false;

      dropdown.querySelectorAll('.ac-item').forEach((item, mi) => {
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectAutocompleteItem(input, matches[mi], dropdown);
        });
      });
    });

    input.addEventListener('keydown', (e) => {
      if (dropdown.hidden) return;
      const items = dropdown.querySelectorAll('.ac-item');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedAcIdx = Math.min(selectedAcIdx + 1, items.length - 1);
        updateAcHighlight(items, selectedAcIdx);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedAcIdx = Math.max(selectedAcIdx - 1, 0);
        updateAcHighlight(items, selectedAcIdx);
      } else if (e.key === 'Enter' && selectedAcIdx >= 0) {
        e.preventDefault();
        const matches = getMatchesForInput(input);
        if (matches[selectedAcIdx]) {
          selectAutocompleteItem(input, matches[selectedAcIdx], dropdown);
        }
      } else if (e.key === 'Escape') {
        dropdown.hidden = true;
      }
    });

    input.addEventListener('blur', () => { setTimeout(() => { dropdown.hidden = true; }, 200); });
    input.addEventListener('focus', () => { if (input.value.trim().length >= 2) input.dispatchEvent(new Event('input')); });
  }

  function getMatchesForInput(input) {
    const query = input.value.trim().toLowerCase();
    const words = query.split(/\s+/);
    return EXERCISE_DB.filter(ex => {
      const name = ex.name.toLowerCase();
      const cat = ex.category.toLowerCase();
      return words.every(w => name.includes(w) || cat.includes(w));
    }).slice(0, 8);
  }

  function selectAutocompleteItem(input, match, dropdown) {
    input.value = match.name;
    dropdown.hidden = true;

    const card = input.closest('.exercise-edit-card');
    if (card && match.defaults) {
      const setsInput = card.querySelector('[data-field="sets"]');
      const repsInput = card.querySelector('[data-field="reps"]');
      const restInput = card.querySelector('[data-field="rest"]');

      if (setsInput && !setsInput.value) setsInput.value = match.defaults.sets || '';
      if (repsInput && !repsInput.value) repsInput.value = match.defaults.reps || '';
      if (restInput && !restInput.value) restInput.value = match.defaults.rest || '';
    }
  }

  function updateAcHighlight(items, idx) {
    items.forEach((item, i) => { item.classList.toggle('ac-active', i === idx); });
  }

  function highlightMatch(text, words) {
    let result = esc(text);
    words.forEach(w => {
      if (w.length < 2) return;
      const regex = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      result = result.replace(regex, '<strong>$1</strong>');
    });
    return result;
  }

  // ===== Add / Remove exercise =====
  addExerciseBtn.addEventListener('click', () => {
    saveDayToModel();
    const dayData = currentPlan.days[currentDay];
    dayData.exercises.push({ name: '', sets: '', reps: '', rest: '', videoUrl: '', notes: '' });
    renderExercisesEditor(dayData.exercises);
  });

  window.removeExercise = function(index) {
    saveDayToModel();
    const dayData = currentPlan.days[currentDay];
    dayData.exercises.splice(index, 1);
    renderExercisesEditor(dayData.exercises);
  };

  // ===== Save day data from form to model =====
  function saveDayToModel() {
    if (!currentPlan || !currentDay) return;

    currentPlan.days[currentDay] = currentPlan.days[currentDay] || {};
    currentPlan.days[currentDay].name = dayNameInput.value.trim();
    currentPlan.days[currentDay].rest = dayRestCheckbox.checked;

    const cards = exercisesEditor.querySelectorAll('.exercise-edit-card');
    const exercises = [];
    cards.forEach(card => {
      const ex = {};
      card.querySelectorAll('[data-field]').forEach(input => {
        const field = input.dataset.field;
        ex[field] = input.tagName === 'TEXTAREA' ? input.value : input.value.trim();
      });
      exercises.push(ex);
    });
    currentPlan.days[currentDay].exercises = exercises;
  }

  // ===== Save plan =====
  savePlanBtn.addEventListener('click', async () => {
    saveDayToModel();
    currentPlan.message = planMessage.value.trim();
    currentPlan.messageDate = new Date().toISOString();

    savePlanBtn.disabled = true;
    try {
      await api('zona-admin', { action: 'save-plan', clientId: selectedClientId, plan: currentPlan });
      toast('✅ Plán uložen!');
      planStatus.textContent = 'Plán uložen!';
      planStatus.hidden = false;
      setTimeout(() => { planStatus.hidden = true; }, 3000);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      savePlanBtn.disabled = false;
    }
  });

  // ===== Plan Templates =====
  document.getElementById('save-as-template-btn').addEventListener('click', async () => {
    if (!currentPlan) return toast('Nejdřív načti plán');
    saveDayToModel();

    const name = prompt('Název šablony:', '');
    if (!name) return;

    try {
      const template = {
        name,
        description: '',
        days: JSON.parse(JSON.stringify(currentPlan.days)),
      };
      await api('zona-admin', { action: 'save-template', template });
      toast('✅ Šablona uložena!');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  });

  document.getElementById('load-template-btn').addEventListener('click', async () => {
    if (!selectedClientId) return toast('Nejdřív vyber klienta');
    openTemplateModal();
  });

  async function openTemplateModal() {
    const modal = document.getElementById('template-modal');
    const list = document.getElementById('template-list');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    list.innerHTML = '<p class="text-muted">Načítám...</p>';

    try {
      const data = await api('zona-admin', { action: 'list-templates' });
      const templates = data.templates || [];

      if (templates.length === 0) {
        list.innerHTML = '<p class="text-muted">Zatím žádné šablony. Ulož aktuální plán jako šablonu.</p>';
        return;
      }

      list.innerHTML = templates.map(t => `
        <div class="template-row">
          <div class="template-info">
            <span class="template-name">${esc(t.name)}</span>
            <span class="template-date">${t.createdAt ? new Date(t.createdAt).toLocaleDateString('cs-CZ') : ''}</span>
          </div>
          <div class="template-actions">
            <button class="btn-primary btn-sm" onclick="applyTemplate('${t.id}')">Použít</button>
            <button class="btn-icon danger" onclick="deleteTemplate('${t.id}')">🗑</button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      list.innerHTML = `<p style="color: #f87171;">${err.message}</p>`;
    }
  }

  window.closeTemplateModal = function() {
    document.getElementById('template-modal').hidden = true;
    document.body.style.overflow = '';
  };

  window.applyTemplate = async function(templateId) {
    if (!confirm('Nahradit aktuální plán šablonou?')) return;

    try {
      const data = await api('zona-admin', { action: 'apply-template', clientId: selectedClientId, templateId });
      currentPlan = data.plan || createEmptyPlan();
      currentDay = 'monday';
      renderPlanDayTabs();
      renderDayEditor();
      closeTemplateModal();
      toast('✅ Šablona aplikována!');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  window.deleteTemplate = async function(templateId) {
    if (!confirm('Smazat šablonu?')) return;

    try {
      await api('zona-admin', { action: 'delete-template', templateId });
      openTemplateModal(); // reload
      toast('Šablona smazána');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  // =============================================
  // NUTRITION + SUPPLEMENTS EDITOR
  // =============================================

  // ===== Food database (per 100g) =====
  const FOOD_DB = [
    { name: 'Kuřecí prsa', cat: 'Maso', per100: { cal: 110, p: 23.1, c: 0, f: 1.2 } },
    { name: 'Kuřecí stehna', cat: 'Maso', per100: { cal: 177, p: 18, c: 0, f: 11.4 } },
    { name: 'Hovězí mleté (10% tuk)', cat: 'Maso', per100: { cal: 176, p: 20, c: 0, f: 10 } },
    { name: 'Hovězí svíčková', cat: 'Maso', per100: { cal: 150, p: 22, c: 0, f: 7 } },
    { name: 'Vepřová panenka', cat: 'Maso', per100: { cal: 143, p: 21, c: 0, f: 6.3 } },
    { name: 'Vepřové maso (krkovice)', cat: 'Maso', per100: { cal: 253, p: 17, c: 0, f: 20.7 } },
    { name: 'Krůtí prsa', cat: 'Maso', per100: { cal: 104, p: 24.6, c: 0, f: 0.7 } },
    { name: 'Losos', cat: 'Ryby', per100: { cal: 208, p: 20, c: 0, f: 13 } },
    { name: 'Tuňák v vlastní šťávě', cat: 'Ryby', per100: { cal: 108, p: 25.5, c: 0, f: 0.6 } },
    { name: 'Treska', cat: 'Ryby', per100: { cal: 82, p: 18, c: 0, f: 0.7 } },
    { name: 'Vejce celé (1ks ~60g)', cat: 'Vejce', per100: { cal: 155, p: 13, c: 1.1, f: 11 } },
    { name: 'Cottage cheese', cat: 'Mléčné', per100: { cal: 98, p: 11, c: 3.4, f: 4.3 } },
    { name: 'Řecký jogurt (0%)', cat: 'Mléčné', per100: { cal: 54, p: 10, c: 3.6, f: 0.2 } },
    { name: 'Skyr', cat: 'Mléčné', per100: { cal: 63, p: 11, c: 4, f: 0.2 } },
    { name: 'Tvaroh polotučný', cat: 'Mléčné', per100: { cal: 134, p: 12.5, c: 3.5, f: 8 } },
    { name: 'Whey protein (1 odměrka ~30g)', cat: 'Mléčné', per100: { cal: 375, p: 78, c: 6, f: 5 } },
    { name: 'Rýže bílá (vařená)', cat: 'Přílohy', per100: { cal: 130, p: 2.7, c: 28, f: 0.3 } },
    { name: 'Rýže basmati (vařená)', cat: 'Přílohy', per100: { cal: 121, p: 3.5, c: 25, f: 0.4 } },
    { name: 'Těstoviny (vařené)', cat: 'Přílohy', per100: { cal: 131, p: 5, c: 25, f: 1.1 } },
    { name: 'Brambory (vařené)', cat: 'Přílohy', per100: { cal: 87, p: 1.9, c: 20, f: 0.1 } },
    { name: 'Batáty (vařené)', cat: 'Přílohy', per100: { cal: 86, p: 1.6, c: 20, f: 0.1 } },
    { name: 'Ovesné vločky', cat: 'Přílohy', per100: { cal: 379, p: 13.2, c: 67, f: 6.5 } },
    { name: 'Chléb celozrnný', cat: 'Přílohy', per100: { cal: 247, p: 13, c: 41, f: 3.4 } },
    { name: 'Čočka (vařená)', cat: 'Luštěniny', per100: { cal: 116, p: 9, c: 20, f: 0.4 } },
    { name: 'Cizrna (vařená)', cat: 'Luštěniny', per100: { cal: 164, p: 8.9, c: 27, f: 2.6 } },
    { name: 'Brokolice', cat: 'Zelenina', per100: { cal: 34, p: 2.8, c: 7, f: 0.4 } },
    { name: 'Špenát', cat: 'Zelenina', per100: { cal: 23, p: 2.9, c: 3.6, f: 0.4 } },
    { name: 'Rajčata', cat: 'Zelenina', per100: { cal: 18, p: 0.9, c: 3.9, f: 0.2 } },
    { name: 'Avokádo', cat: 'Zelenina', per100: { cal: 160, p: 2, c: 8.5, f: 14.7 } },
    { name: 'Banán', cat: 'Ovoce', per100: { cal: 89, p: 1.1, c: 23, f: 0.3 } },
    { name: 'Jablko', cat: 'Ovoce', per100: { cal: 52, p: 0.3, c: 14, f: 0.2 } },
    { name: 'Jahody', cat: 'Ovoce', per100: { cal: 32, p: 0.7, c: 7.7, f: 0.3 } },
    { name: 'Olivový olej', cat: 'Tuky', per100: { cal: 884, p: 0, c: 0, f: 100 } },
    { name: 'Arašídové máslo', cat: 'Tuky', per100: { cal: 588, p: 25, c: 20, f: 50 } },
    { name: 'Mandle', cat: 'Ořechy', per100: { cal: 579, p: 21, c: 22, f: 50 } },
  ];

  let currentNutrition = null;
  let selectedNutrClientId = null;

  const nutrClientSelect = document.getElementById('nutr-client-select');
  const loadNutritionBtn = document.getElementById('load-nutrition-btn');
  const nutritionEditorSection = document.getElementById('nutrition-editor-section');
  const nutrClientName = document.getElementById('nutr-client-name');
  const nutrCalories = document.getElementById('nutr-calories');
  const nutrProtein = document.getElementById('nutr-protein');
  const nutrCarbs = document.getElementById('nutr-carbs');
  const nutrFat = document.getElementById('nutr-fat');
  const mealsEditor = document.getElementById('meals-editor');
  const supplementsEditor = document.getElementById('supplements-editor');
  const addMealBtn = document.getElementById('add-meal-btn');
  const addSupplementBtn = document.getElementById('add-supplement-btn');
  const nutrNotes = document.getElementById('nutr-notes');
  const saveNutritionBtn = document.getElementById('save-nutrition-btn');
  const nutritionStatus = document.getElementById('nutrition-status');

  window.editNutrition = function(clientId) {
    switchTab('nutrition-editor');
    nutrClientSelect.value = clientId;
    loadNutritionForClient(clientId);
  };

  loadNutritionBtn.addEventListener('click', () => {
    const clientId = nutrClientSelect.value;
    if (!clientId) return toast('Vyber klienta');
    loadNutritionForClient(clientId);
  });

  nutrClientSelect.addEventListener('change', () => {
    const clientId = nutrClientSelect.value;
    if (clientId) loadNutritionForClient(clientId);
  });

  async function loadNutritionForClient(clientId) {
    selectedNutrClientId = clientId;
    const client = clients.find(c => c.id === clientId);
    nutrClientName.textContent = client?.name || clientId;
    nutritionEditorSection.hidden = false;

    try {
      const data = await api('zona-admin', { action: 'get-nutrition', clientId });
      currentNutrition = data.nutrition || createEmptyNutrition();
    } catch {
      currentNutrition = createEmptyNutrition();
    }

    if (currentNutrition.meals) {
      currentNutrition.meals = currentNutrition.meals.map(m => {
        if (!m.items) {
          return {
            name: m.name || '',
            time: m.time || '',
            items: m.detail ? [{ food: m.detail, amount: '', cal: m.calories || 0, p: m.protein || 0, c: m.carbs || 0, f: m.fat || 0, manual: true }] : []
          };
        }
        return m;
      });
    }

    nutrNotes.value = currentNutrition.notes || '';
    renderMealsEditor(currentNutrition.meals || []);
    renderSupplementsEditor(currentNutrition.supplements || []);
    recalcAllTotals();
  }

  function createEmptyNutrition() {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, meals: [], supplements: [], notes: '' };
  }

  // Food autocomplete
  function getFoodMatches(query) {
    const words = query.toLowerCase().split(/\s+/);
    return FOOD_DB.filter(f => {
      const name = f.name.toLowerCase();
      const cat = f.cat.toLowerCase();
      return words.every(w => name.includes(w) || cat.includes(w));
    }).slice(0, 8);
  }

  function setupFoodAutocomplete(input, mealIdx, itemIdx) {
    const wrapper = input.closest('.food-item-name-wrap');
    let dropdown = wrapper.querySelector('.food-ac-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'food-ac-dropdown ac-dropdown';
      dropdown.hidden = true;
      wrapper.appendChild(dropdown);
    }
    let selIdx = -1;

    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (q.length < 2) { dropdown.hidden = true; return; }
      const matches = getFoodMatches(q);
      if (matches.length === 0) { dropdown.hidden = true; return; }
      selIdx = -1;
      const words = q.toLowerCase().split(/\s+/);
      dropdown.innerHTML = matches.map((f, i) => `
        <div class="ac-item" data-idx="${i}">
          <span class="ac-name">${highlightMatch(f.name, words)}</span>
          <span class="ac-cat">${esc(f.cat)}</span>
          <span class="food-ac-macros">${f.per100.cal} kcal</span>
        </div>
      `).join('');
      dropdown.hidden = false;

      dropdown.querySelectorAll('.ac-item').forEach((el, i) => {
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          selectFoodItem(input, matches[i], mealIdx, itemIdx, dropdown);
        });
      });
    });

    input.addEventListener('keydown', (e) => {
      if (dropdown.hidden) return;
      const items = dropdown.querySelectorAll('.ac-item');
      if (e.key === 'ArrowDown') { e.preventDefault(); selIdx = Math.min(selIdx + 1, items.length - 1); updateAcHighlight(items, selIdx); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selIdx = Math.max(selIdx - 1, 0); updateAcHighlight(items, selIdx); }
      else if (e.key === 'Enter' && selIdx >= 0) { e.preventDefault(); const matches = getFoodMatches(input.value.trim()); if (matches[selIdx]) selectFoodItem(input, matches[selIdx], mealIdx, itemIdx, dropdown); }
      else if (e.key === 'Escape') { dropdown.hidden = true; }
    });

    input.addEventListener('blur', () => { setTimeout(() => { dropdown.hidden = true; }, 200); });
    input.addEventListener('focus', () => { if (input.value.trim().length >= 2) input.dispatchEvent(new Event('input')); });
  }

  function selectFoodItem(input, match, mealIdx, itemIdx, dropdown) {
    input.value = match.name;
    dropdown.hidden = true;

    const row = input.closest('.food-item-row');
    if (row) {
      row.dataset.per100 = JSON.stringify(match.per100);
      row.querySelector('.food-item-cat').textContent = match.cat;
      const amountInput = row.querySelector('.food-item-amount');
      if (!amountInput.value) amountInput.value = '100';
      recalcFoodItemMacros(row);
    }
  }

  function recalcFoodItemMacros(row) {
    const per100str = row.dataset.per100;
    if (!per100str || per100str === '{}') { recalcAllTotals(); return; }
    const per100 = JSON.parse(per100str);
    const amount = parseFloat(row.querySelector('.food-item-amount')?.value) || 0;
    const mult = amount / 100;

    row.querySelector('.food-item-cal').textContent = Math.round(per100.cal * mult);
    row.querySelector('.food-item-p').textContent = (per100.p * mult).toFixed(1);
    row.querySelector('.food-item-c').textContent = (per100.c * mult).toFixed(1);
    row.querySelector('.food-item-f').textContent = (per100.f * mult).toFixed(1);
    recalcAllTotals();
  }

  function recalcAllTotals() {
    let dayC = 0, dayP = 0, dayCa = 0, dayF = 0;

    mealsEditor.querySelectorAll('.meal-card-editor').forEach(mealCard => {
      let mealCal = 0, mealP = 0, mealCa = 0, mealF = 0;

      mealCard.querySelectorAll('.food-item-row').forEach(row => {
        const per100str = row.dataset.per100;
        if (per100str && per100str !== '{}') {
          const per100 = JSON.parse(per100str);
          const amount = parseFloat(row.querySelector('.food-item-amount')?.value) || 0;
          const mult = amount / 100;
          mealCal += per100.cal * mult; mealP += per100.p * mult; mealCa += per100.c * mult; mealF += per100.f * mult;
        } else {
          mealCal += parseFloat(row.querySelector('.food-item-cal')?.textContent) || 0;
          mealP += parseFloat(row.querySelector('.food-item-p')?.textContent) || 0;
          mealCa += parseFloat(row.querySelector('.food-item-c')?.textContent) || 0;
          mealF += parseFloat(row.querySelector('.food-item-f')?.textContent) || 0;
        }
      });

      const sub = mealCard.querySelector('.meal-subtotal');
      if (sub) {
        sub.querySelector('.ms-cal').textContent = Math.round(mealCal);
        sub.querySelector('.ms-p').textContent = mealP.toFixed(1);
        sub.querySelector('.ms-c').textContent = mealCa.toFixed(1);
        sub.querySelector('.ms-f').textContent = mealF.toFixed(1);
      }

      dayC += mealCal; dayP += mealP; dayCa += mealCa; dayF += mealF;
    });

    nutrCalories.value = Math.round(dayC) || '';
    nutrProtein.value = Math.round(dayP) || '';
    nutrCarbs.value = Math.round(dayCa) || '';
    nutrFat.value = Math.round(dayF) || '';
  }
  window.recalcNutritionTotals = recalcAllTotals;

  function renderMealsEditor(meals) {
    mealsEditor.innerHTML = meals.map((m, mealIdx) => {
      const items = (m.items || []);
      return `
      <div class="meal-card-editor" data-meal-index="${mealIdx}">
        <div class="meal-card-header">
          <span class="exercise-edit-number">${mealIdx + 1}</span>
          <input type="text" value="${escAttr(m.name)}" placeholder="Název jídla (Snídaně, Oběd...)" class="meal-name-input" data-meal-field="name">
          <input type="text" value="${escAttr(m.time || '')}" placeholder="7:00" class="meal-time-input" data-meal-field="time">
          <button class="exercise-edit-remove" onclick="removeMeal(${mealIdx})" title="Odebrat jídlo">✕</button>
        </div>
        <div class="food-items-list" data-meal-items="${mealIdx}">
          ${items.map((item, itemIdx) => renderFoodItemRow(item, mealIdx, itemIdx)).join('')}
        </div>
        <button class="btn-add-food" onclick="addFoodItem(${mealIdx})">+ Přidat potravinu</button>
        <div class="meal-subtotal">
          <span class="ms-label">Celkem:</span>
          <span class="ms-cal">0</span> kcal ·
          <span class="ms-p">0</span>g B ·
          <span class="ms-c">0</span>g S ·
          <span class="ms-f">0</span>g T
        </div>
      </div>`;
    }).join('');

    mealsEditor.querySelectorAll('.food-item-name').forEach(input => {
      const row = input.closest('.food-item-row');
      const mealIdx = parseInt(row.closest('.meal-card-editor').dataset.mealIndex);
      const itemIdx = parseInt(row.dataset.itemIndex);
      setupFoodAutocomplete(input, mealIdx, itemIdx);
    });

    recalcAllTotals();
  }

  function renderFoodItemRow(item, mealIdx, itemIdx) {
    const per100 = item.per100 ? JSON.stringify(item.per100) : '{}';
    const amount = item.amount || '';

    let dCal = 0, dP = 0, dC = 0, dF = 0;
    if (item.per100 && item.amount) {
      const mult = item.amount / 100;
      dCal = Math.round(item.per100.cal * mult); dP = (item.per100.p * mult).toFixed(1); dC = (item.per100.c * mult).toFixed(1); dF = (item.per100.f * mult).toFixed(1);
    } else if (item.manual) {
      dCal = item.cal || 0; dP = item.p || 0; dC = item.c || 0; dF = item.f || 0;
    }

    return `
    <div class="food-item-row" data-item-index="${itemIdx}" data-per100='${per100.replace(/'/g, "&#39;")}'>
      <div class="food-item-name-wrap">
        <input type="text" value="${escAttr(item.food || '')}" placeholder="Hledej potravinu..." class="food-item-name">
        <span class="food-item-cat">${esc(item.cat || '')}</span>
      </div>
      <div class="food-item-amount-wrap">
        <input type="number" value="${amount}" placeholder="g" class="food-item-amount" oninput="onFoodAmountChange(this)">
        <span class="food-item-g">g</span>
      </div>
      <div class="food-item-macros">
        <span class="food-item-cal">${dCal}</span>
        <span class="food-item-macro-label">kcal</span>
        <span class="food-item-p">${dP}</span>
        <span class="food-item-macro-label">B</span>
        <span class="food-item-c">${dC}</span>
        <span class="food-item-macro-label">S</span>
        <span class="food-item-f">${dF}</span>
        <span class="food-item-macro-label">T</span>
      </div>
      <button class="food-item-remove" onclick="removeFoodItem(${mealIdx}, ${itemIdx})" title="Odebrat">✕</button>
    </div>`;
  }

  window.onFoodAmountChange = function(input) { recalcFoodItemMacros(input.closest('.food-item-row')); };

  window.addFoodItem = function(mealIdx) {
    saveNutritionToModel();
    if (!currentNutrition.meals[mealIdx].items) currentNutrition.meals[mealIdx].items = [];
    currentNutrition.meals[mealIdx].items.push({ food: '', amount: '', per100: null });
    renderMealsEditor(currentNutrition.meals);
    const lastInput = mealsEditor.querySelectorAll(`.meal-card-editor[data-meal-index="${mealIdx}"] .food-item-name`);
    if (lastInput.length) lastInput[lastInput.length - 1].focus();
  };

  window.removeFoodItem = function(mealIdx, itemIdx) {
    saveNutritionToModel();
    currentNutrition.meals[mealIdx].items.splice(itemIdx, 1);
    renderMealsEditor(currentNutrition.meals);
  };

  addMealBtn.addEventListener('click', () => {
    saveNutritionToModel();
    currentNutrition.meals.push({ name: '', time: '', items: [] });
    renderMealsEditor(currentNutrition.meals);
  });

  window.removeMeal = function(index) {
    saveNutritionToModel();
    currentNutrition.meals.splice(index, 1);
    renderMealsEditor(currentNutrition.meals);
  };

  // Supplements editor
  function renderSupplementsEditor(supplements) {
    supplementsEditor.innerHTML = supplements.map((s, i) => `
      <div class="exercise-edit-card" data-sup-index="${i}">
        <div class="exercise-edit-header">
          <span class="exercise-edit-number" style="background: rgba(168, 85, 247, 0.1); color: #a855f7;">${i + 1}</span>
          <div class="exercise-edit-name">
            <input type="text" value="${escAttr(s.name)}" placeholder="Název suplementu" data-sup="name">
          </div>
          <button class="exercise-edit-remove" onclick="removeSupplement(${i})" title="Odebrat">✕</button>
        </div>
        <div class="exercise-edit-fields">
          <div class="exercise-field-group">
            <label>Dávkování</label>
            <input type="text" value="${escAttr(s.dosage)}" placeholder="5g" data-sup="dosage">
          </div>
          <div class="exercise-field-group">
            <label>Kdy</label>
            <input type="text" value="${escAttr(s.timing)}" placeholder="Po tréninku" data-sup="timing">
          </div>
          <div class="exercise-field-group">
            <label>Ikona</label>
            <input type="text" value="${escAttr(s.icon)}" placeholder="💊" data-sup="icon" style="max-width: 60px;">
          </div>
        </div>
      </div>
    `).join('');
  }

  addSupplementBtn.addEventListener('click', () => {
    saveNutritionToModel();
    currentNutrition.supplements.push({ name: '', dosage: '', timing: '', icon: '💊' });
    renderSupplementsEditor(currentNutrition.supplements);
  });

  window.removeSupplement = function(index) {
    saveNutritionToModel();
    currentNutrition.supplements.splice(index, 1);
    renderSupplementsEditor(currentNutrition.supplements);
  };

  function saveNutritionToModel() {
    if (!currentNutrition) return;

    currentNutrition.calories = nutrCalories.value ? parseInt(nutrCalories.value) : 0;
    currentNutrition.protein = nutrProtein.value ? parseInt(nutrProtein.value) : 0;
    currentNutrition.carbs = nutrCarbs.value ? parseInt(nutrCarbs.value) : 0;
    currentNutrition.fat = nutrFat.value ? parseInt(nutrFat.value) : 0;
    currentNutrition.notes = nutrNotes.value.trim();

    const mealCards = mealsEditor.querySelectorAll('.meal-card-editor');
    currentNutrition.meals = [];
    mealCards.forEach(mealCard => {
      const meal = {
        name: mealCard.querySelector('[data-meal-field="name"]')?.value.trim() || '',
        time: mealCard.querySelector('[data-meal-field="time"]')?.value.trim() || '',
        items: []
      };

      mealCard.querySelectorAll('.food-item-row').forEach(row => {
        const foodName = row.querySelector('.food-item-name')?.value.trim() || '';
        const amount = parseFloat(row.querySelector('.food-item-amount')?.value) || '';
        const per100str = row.dataset.per100;
        let per100 = null;
        try { per100 = per100str && per100str !== '{}' ? JSON.parse(per100str) : null; } catch {}

        const item = { food: foodName, amount, cat: row.querySelector('.food-item-cat')?.textContent.trim() || '' };

        if (per100) {
          item.per100 = per100;
        } else {
          item.manual = true;
          item.cal = parseFloat(row.querySelector('.food-item-cal')?.textContent) || 0;
          item.p = parseFloat(row.querySelector('.food-item-p')?.textContent) || 0;
          item.c = parseFloat(row.querySelector('.food-item-c')?.textContent) || 0;
          item.f = parseFloat(row.querySelector('.food-item-f')?.textContent) || 0;
        }

        meal.items.push(item);
      });

      let mealCal = 0, mealP = 0, mealC = 0, mealF = 0;
      meal.items.forEach(item => {
        if (item.per100 && item.amount) {
          const mult = item.amount / 100;
          mealCal += item.per100.cal * mult; mealP += item.per100.p * mult; mealC += item.per100.c * mult; mealF += item.per100.f * mult;
        } else if (item.manual) {
          mealCal += item.cal || 0; mealP += item.p || 0; mealC += item.c || 0; mealF += item.f || 0;
        }
      });
      meal.calories = Math.round(mealCal); meal.protein = Math.round(mealP); meal.carbs = Math.round(mealC); meal.fat = Math.round(mealF);

      currentNutrition.meals.push(meal);
    });

    const supCards = supplementsEditor.querySelectorAll('[data-sup-index]');
    currentNutrition.supplements = [];
    supCards.forEach(card => {
      const sup = {};
      card.querySelectorAll('[data-sup]').forEach(input => { sup[input.dataset.sup] = input.value.trim(); });
      currentNutrition.supplements.push(sup);
    });
  }

  saveNutritionBtn.addEventListener('click', async () => {
    saveNutritionToModel();
    saveNutritionBtn.disabled = true;

    try {
      await api('zona-admin', { action: 'save-nutrition', clientId: selectedNutrClientId, nutrition: currentNutrition });
      toast('✅ Výživa uložena!');
      nutritionStatus.textContent = 'Uloženo!';
      nutritionStatus.hidden = false;
      setTimeout(() => { nutritionStatus.hidden = true; }, 3000);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      saveNutritionBtn.disabled = false;
    }
  });

  // ===== Progress modal =====
  window.showProgress = async function(clientId) {
    const client = clients.find(c => c.id === clientId);
    const modal = document.getElementById('progress-modal');
    const modalName = document.getElementById('progress-modal-name');
    const modalContent = document.getElementById('progress-modal-content');

    modalName.textContent = client?.name || clientId;
    modalContent.innerHTML = '<p class="text-muted">Načítám...</p>';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    try {
      const data = await api('zona-admin', { action: 'get-progress', clientId });
      const entries = data.entries || [];

      if (entries.length === 0) {
        modalContent.innerHTML = '<p class="text-muted" style="text-align: center; padding: 2rem 0;">Klient zatím nemá žádné záznamy.</p>';
        return;
      }

      const sorted = [...entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const latest = sorted[sorted.length - 1];
      const first = sorted[0];
      const diff = latest.weight - first.weight;
      const diffSign = diff > 0 ? '+' : '';
      const diffClass = diff < 0 ? 'down' : diff > 0 ? 'up' : 'neutral';

      let html = `
        <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 1rem;">
          <div>
            <span style="font-size: 2rem; font-weight: 800; color: var(--accent);">${latest.weight}</span>
            <span style="color: var(--text-muted); font-size: 0.85rem;"> kg (aktuální)</span>
          </div>
          ${sorted.length > 1 ? `<span class="chart-change ${diffClass}" style="font-size: 0.85rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: var(--radius-full);">${diffSign}${diff.toFixed(1)} kg celkem</span>` : ''}
        </div>
      `;

      html += '<div style="display: flex; flex-direction: column; gap: 0.35rem;">';
      [...sorted].reverse().forEach((entry) => {
        const date = new Date(entry.createdAt);
        const dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });

        let entryDiff = '';
        const idx = sorted.indexOf(entry);
        if (idx > 0) {
          const d = entry.weight - sorted[idx - 1].weight;
          if (d !== 0) {
            const s = d > 0 ? '+' : '';
            entryDiff = `<span style="font-size: 0.75rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: var(--radius-full); background: ${d < 0 ? 'rgba(52, 211, 153, 0.1)' : 'rgba(251, 146, 60, 0.1)'}; color: ${d < 0 ? '#34d399' : '#fb923c'};">${s}${d.toFixed(1)}</span>`;
          }
        }

        html += `
          <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; background: var(--bg-elevated); border-radius: var(--radius-sm);">
            <span style="font-weight: 700; color: var(--accent); min-width: 60px;">${entry.weight} kg</span>
            <span style="flex: 1; font-size: 0.8rem; color: var(--text-muted);">${dateStr}</span>
            ${entry.notes ? `<span style="font-size: 0.75rem; color: var(--text-faint);">${esc(entry.notes)}</span>` : ''}
            ${entryDiff}
          </div>`;
      });
      html += '</div>';

      modalContent.innerHTML = html;
    } catch (err) {
      modalContent.innerHTML = `<p style="color: #f87171;">Chyba: ${err.message}</p>`;
    }
  };

  window.closeProgressModal = function() {
    document.getElementById('progress-modal').hidden = true;
    document.body.style.overflow = '';
  };

  // ===== Onboarding modal =====
  window.showOnboarding = async function(clientId) {
    const client = clients.find(c => c.id === clientId);
    const modal = document.getElementById('onboarding-modal');
    const modalName = document.getElementById('onboarding-modal-name');
    const modalContent = document.getElementById('onboarding-modal-content');

    modalName.textContent = client?.name || clientId;
    modalContent.innerHTML = '<p class="text-muted">Načítám...</p>';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    try {
      const data = await api('zona-admin', { action: 'get-onboarding', clientId });
      const ob = data.onboarding;

      if (!ob) {
        modalContent.innerHTML = '<p class="text-muted" style="text-align: center; padding: 2rem 0;">Klient ještě nevyplnil dotazník.</p>';
        return;
      }

      const GOAL_LABELS = { 'hubnutí': '🔥 Hubnutí', 'nabírání': '💪 Nabírání svalů', 'síla': '🏋️ Síla', 'výkon': '⚡ Sportovní výkon', 'zdraví': '❤️ Zdraví' };
      const LOC_LABELS = { 'gym': '🏢 Posilovna', 'doma': '🏠 Doma', 'obojí': '🔄 Obojí' };

      modalContent.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div class="ob-field"><span class="ob-label">Cíl</span><span class="ob-value">${esc(GOAL_LABELS[ob.goal] || ob.goal)}</span></div>
          <div class="ob-field"><span class="ob-label">Váha</span><span class="ob-value">${esc(ob.weight)} kg</span></div>
          <div class="ob-field"><span class="ob-label">Výška</span><span class="ob-value">${esc(ob.height)} cm</span></div>
          <div class="ob-field"><span class="ob-label">Věk</span><span class="ob-value">${esc(ob.age)}</span></div>
          <div class="ob-field"><span class="ob-label">Frekvence</span><span class="ob-value">${esc(ob.frequency)}× týdně</span></div>
          <div class="ob-field"><span class="ob-label">Kde cvičí</span><span class="ob-value">${esc(LOC_LABELS[ob.location] || ob.location)}</span></div>
          <div class="ob-field"><span class="ob-label">Zkušenosti</span><span class="ob-value">${esc(ob.experience)}</span></div>
          ${ob.injuries ? `<div class="ob-field"><span class="ob-label">Zranění</span><span class="ob-value">${esc(ob.injuries)}</span></div>` : ''}
          ${ob.allergies ? `<div class="ob-field"><span class="ob-label">Alergie/diety</span><span class="ob-value">${esc(ob.allergies)}</span></div>` : ''}
          ${ob.motivation ? `<div class="ob-field"><span class="ob-label">Motivace</span><span class="ob-value">${esc(ob.motivation)}</span></div>` : ''}
          ${ob.deadline ? `<div class="ob-field"><span class="ob-label">Deadline</span><span class="ob-value">${esc(ob.deadline)}</span></div>` : ''}
        </div>
      `;
    } catch (err) {
      modalContent.innerHTML = `<p style="color: #f87171;">Chyba: ${err.message}</p>`;
    }
  };

  window.closeOnboardingModal = function() {
    document.getElementById('onboarding-modal').hidden = true;
    document.body.style.overflow = '';
  };

  // ===== Chat modal =====
  let chatClientId = null;

  window.openChatModal = async function(clientId) {
    chatClientId = clientId;
    const client = clients.find(c => c.id === clientId);
    const modal = document.getElementById('chat-modal');
    const modalName = document.getElementById('chat-modal-name');
    const msgContainer = document.getElementById('chat-modal-messages');

    modalName.textContent = client?.name || clientId;
    msgContainer.innerHTML = '<p class="text-muted">Načítám...</p>';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    try {
      const data = await api('zona-admin', { action: 'get-messages', clientId });
      renderAdminChat(data.messages || []);
    } catch (err) {
      msgContainer.innerHTML = `<p style="color: #f87171;">${err.message}</p>`;
    }
  };

  function renderAdminChat(messages) {
    const msgContainer = document.getElementById('chat-modal-messages');

    if (messages.length === 0) {
      msgContainer.innerHTML = '<div style="text-align: center; color: var(--text-faint); padding: 2rem; font-size: 0.85rem;">Zatím žádné zprávy.</div>';
      return;
    }

    msgContainer.innerHTML = messages.map(msg => {
      const isAdmin = msg.from === 'admin';
      const date = new Date(msg.createdAt);
      const timeStr = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });

      return `
        <div class="chat-bubble ${isAdmin ? 'chat-bubble-client' : 'chat-bubble-admin'}">
          <div class="chat-bubble-text">${esc(msg.text)}</div>
          <div class="chat-bubble-time">${dateStr} ${timeStr}</div>
        </div>`;
    }).join('');

    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  document.getElementById('chat-modal-send').addEventListener('click', sendAdminMessage);
  document.getElementById('chat-modal-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendAdminMessage(); }
  });

  async function sendAdminMessage() {
    const input = document.getElementById('chat-modal-input');
    const text = input.value.trim();
    if (!text || !chatClientId) return;

    const btn = document.getElementById('chat-modal-send');
    btn.disabled = true;
    input.disabled = true;

    try {
      const data = await api('zona-admin', { action: 'send-message', clientId: chatClientId, text });
      input.value = '';
      renderAdminChat(data.messages || []);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      btn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  window.closeChatModal = function() {
    document.getElementById('chat-modal').hidden = true;
    document.body.style.overflow = '';
    chatClientId = null;
  };

  // Close modals with Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProgressModal();
      closeOnboardingModal();
      closeChatModal();
      closeTemplateModal();
    }
  });

  // ===== Toast =====
  function toast(msg) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
  }

  // ===== Helpers =====
  function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // ===== WEBSITE PREVIEW CONTROLS =====
  (function initWebsitePreview() {
    var deviceBtns = document.querySelectorAll('.website-device-btn');
    var previewWrap = document.getElementById('website-preview-wrap');
    var refreshBtn = document.getElementById('refresh-preview-btn');
    var previewFrame = document.getElementById('website-preview-frame');

    deviceBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        deviceBtns.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        if (previewWrap) previewWrap.style.maxWidth = btn.dataset.width;
      });
    });

    if (refreshBtn && previewFrame) {
      refreshBtn.addEventListener('click', function() {
        previewFrame.src = previewFrame.src;
      });
    }
  })();

  // ===== NOTIFICATION BUTTON — recent messages =====
  (function initNotifications() {
    var notifBtn = document.getElementById('notif-btn');
    var notifBadge = document.getElementById('notif-badge');
    if (!notifBtn) return;

    // Create dropdown
    var dropdown = document.createElement('div');
    dropdown.className = 'notif-dropdown';
    dropdown.id = 'notif-dropdown';
    dropdown.hidden = true;
    dropdown.innerHTML = '<div class="notif-dropdown-header"><h4>Poslední zprávy</h4></div><div class="notif-dropdown-body" id="notif-messages-list"><p class="text-muted">Načítám...</p></div>';
    notifBtn.parentElement.style.position = 'relative';
    notifBtn.parentElement.appendChild(dropdown);

    var isOpen = false;
    notifBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      isOpen = !isOpen;
      dropdown.hidden = !isOpen;
      if (isOpen) loadRecentMessages();
    });

    document.addEventListener('click', function(e) {
      if (!dropdown.contains(e.target) && e.target !== notifBtn) {
        isOpen = false;
        dropdown.hidden = true;
      }
    });

    async function loadRecentMessages() {
      var list = document.getElementById('notif-messages-list');
      if (!list) return;
      list.innerHTML = '<p class="text-muted">Načítám...</p>';

      try {
        var data = await api('zona-admin', { action: 'list-clients' });
        var clients = data.clients || [];
        var allMessages = [];

        // Fetch messages from each client (parallel, max 10)
        var promises = clients.slice(0, 10).map(async function(client) {
          try {
            var msgData = await api('zona-admin', { action: 'get-messages', clientId: client.id });
            var msgs = msgData.messages || [];
            msgs.forEach(function(m) {
              if (m.from === 'client') {
                allMessages.push({ clientName: client.name, clientId: client.id, text: m.text, timestamp: m.timestamp });
              }
            });
          } catch(e) { /* skip */ }
        });

        await Promise.all(promises);

        // Sort by timestamp desc, take last 10
        allMessages.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
        var recent = allMessages.slice(0, 10);

        if (recent.length === 0) {
          list.innerHTML = '<p class="text-muted" style="padding: 1rem; text-align: center;">Žádné nové zprávy</p>';
          if (notifBadge) { notifBadge.hidden = true; }
          return;
        }

        list.innerHTML = recent.map(function(m) {
          var time = m.timestamp ? new Date(m.timestamp).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
          var shortText = m.text && m.text.length > 60 ? m.text.substring(0, 60) + '…' : (m.text || '');
          return '<div class="notif-message-item" data-client-id="' + esc(m.clientId) + '">' +
            '<div class="notif-msg-header"><strong>' + esc(m.clientName) + '</strong><span class="notif-msg-time">' + time + '</span></div>' +
            '<p class="notif-msg-text">' + esc(shortText) + '</p>' +
          '</div>';
        }).join('');

        // Update badge count
        if (notifBadge) {
          notifBadge.textContent = recent.length;
          notifBadge.hidden = recent.length === 0;
        }

        // Click on message → open chat modal
        list.querySelectorAll('.notif-message-item').forEach(function(item) {
          item.addEventListener('click', function() {
            var clientId = this.dataset.clientId;
            if (clientId && typeof openChatModal === 'function') {
              openChatModal(clientId);
              isOpen = false;
              dropdown.hidden = true;
            }
          });
        });

      } catch(e) {
        list.innerHTML = '<p class="text-muted" style="padding: 1rem; text-align: center;">Nepodařilo se načíst zprávy</p>';
      }
    }

    // Load on page load (after small delay)
    setTimeout(loadRecentMessages, 1500);
  })();

  // ===== Start =====
  init();

})();
