(function() {
  'use strict';

  const API = '/api';
  let sessionToken = localStorage.getItem('admin_token');
  let clients = [];
  let currentPlan = null;
  let selectedClientId = null;
  let currentDay = 'monday';
  let currentPlanWeekOffset = 0; // 0 = this week, -1 = last week, +1 = next week
  let currentPlanMode = 'week'; // 'week' or 'base'
  let basePlanCache = null; // cache of the base/template plan

  const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // ===== Week helpers =====
  function getMonday(offset) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now);
    monday.setDate(diffToMonday + (offset * 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  function calcWeekKey(monday) {
    const thu = new Date(monday);
    thu.setDate(thu.getDate() + 3);
    const jan4 = new Date(thu.getFullYear(), 0, 4);
    const days = Math.round((thu - jan4) / 86400000);
    const weekNum = Math.ceil((days + jan4.getDay()) / 7);
    return `${thu.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  function getWeekKeyForOffset(offset) {
    return calcWeekKey(getMonday(offset));
  }

  function formatWeekRange(offset) {
    const mon = getMonday(offset);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    const fmtDate = (d) => `${d.getDate()}.${d.getMonth() + 1}.`;
    return `${fmtDate(mon)} – ${fmtDate(sun)} ${sun.getFullYear()}`;
  }

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
  const tabWorkoutLogs = document.getElementById('tab-workout-logs');
  const tabSchedule = document.getElementById('tab-schedule');
  const tabPayments = document.getElementById('tab-payments');

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
  const tabEngagement = document.getElementById('tab-engagement');
  const allTabs = { overview: tabOverview, clients: tabClients, 'plan-editor': tabPlanEditor, 'nutrition-editor': tabNutritionEditor, 'workout-logs': tabWorkoutLogs, 'schedule': tabSchedule, 'payments': tabPayments, 'engagement': tabEngagement };

  // Tab scroll hint (fade on right when more tabs are hidden)
  const tabsScrollEl = document.getElementById('admin-tabs-scroll');
  const tabsWrap = document.getElementById('admin-tabs-wrap');
  function updateTabScrollHint() {
    if (!tabsScrollEl || !tabsWrap) return;
    var hasMore = tabsScrollEl.scrollWidth - tabsScrollEl.scrollLeft - tabsScrollEl.clientWidth > 4;
    tabsWrap.classList.toggle('has-scroll-right', hasMore);
  }
  if (tabsScrollEl) {
    tabsScrollEl.addEventListener('scroll', updateTabScrollHint);
    window.addEventListener('resize', updateTabScrollHint);
    setTimeout(updateTabScrollHint, 100);
  }

  function scrollTabIntoView(tabEl) {
    if (!tabEl || !tabsScrollEl) return;
    tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    setTimeout(updateTabScrollHint, 300);
  }

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      scrollTabIntoView(tab);

      const tabName = tab.dataset.tab;
      Object.keys(allTabs).forEach(k => { allTabs[k].hidden = k !== tabName; });

      // Lazy load engagement report
      if (tabName === 'engagement') loadEngagement();
    });
  });

  function switchTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
      if (t.dataset.tab === tabName) scrollTabIntoView(t);
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

      // Alerts — enhanced with priority categories
      const alertsList = document.getElementById('alerts-list');
      const alertItems = [];

      // Check-in alerts (>7 days)
      const checkinAlerts = metrics.filter(m => {
        if (!m.lastCheckinDate && !m.lastWorkoutDate) return false;
        const lastDate = m.lastCheckinDate || m.lastWorkoutDate;
        const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
        return days > 7;
      });
      checkinAlerts.forEach(c => {
        const lastDate = c.lastCheckinDate || c.lastWorkoutDate;
        const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
        alertItems.push({ priority: 'warning', icon: '\u26a0\ufe0f', name: c.name, id: c.id, text: `check-in v\xedce ne\u017e ${days} dn\xed`, sort: 1 });
      });

      // Payment expiry alerts (within 7 days) — use payments data if available
      try {
        const payAlertData = await api('zona-admin', { action: 'get-payments' });
        const payAlerts = payAlertData.payments || [];
        const nowTs = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const latestPay = {};
        payAlerts.forEach(p => {
          if (!latestPay[p.clientId] || new Date(p.paidUntil) > new Date(latestPay[p.clientId].paidUntil)) {
            latestPay[p.clientId] = p;
          }
        });
        Object.values(latestPay).forEach(p => {
          const paidUntilTs = new Date(p.paidUntil + 'T23:59:59').getTime();
          const remaining = paidUntilTs - nowTs;
          if (remaining > 0 && remaining <= sevenDaysMs) {
            const clientM = metrics.find(m => m.id === p.clientId);
            const clientName = clientM ? clientM.name : (clients.find(cc => cc.id === p.clientId)?.name || p.clientId);
            alertItems.push({ priority: 'urgent', icon: '\ud83d\udcb0', name: clientName, id: p.clientId, text: 'platba brzy vypr\u0161\xed', sort: 0 });
          }
        });
      } catch { /* payments not available */ }

      // New self-registered clients alerts
      const newClients = (data.clientMetrics || []).filter(m => m.selfRegistered);
      newClients.forEach(c => {
        alertItems.push({ priority: 'info', icon: '🆕', name: c.name, id: c.id, text: 'nová registrace z webu', sort: -1 });
      });

      // Inactive training alerts
      inactive.forEach(c => {
        const days = c.lastWorkoutDate
          ? Math.floor((Date.now() - new Date(c.lastWorkoutDate).getTime()) / (1000 * 60 * 60 * 24))
          : null;
        alertItems.push({ priority: days !== null && days >= 7 ? 'urgent' : 'warning', icon: '\ud83c\udfcb\ufe0f', name: c.name, id: c.id, text: days !== null ? `${days} dn\xed bez tr\xe9ninku` : 'Je\u0161t\u011b netr\xe9noval/a', sort: days !== null && days >= 7 ? 0 : 2 });
      });

      // Deduplicate by client id + text, sort by priority
      const seen = new Set();
      const uniqueAlerts = alertItems.filter(a => {
        const key = a.id + '|' + a.text;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => a.sort - b.sort);

      if (uniqueAlerts.length === 0) {
        alertsList.innerHTML = '<p style="color: #34d399; font-size: 0.9rem;">\u2713 V\u0161ichni klienti tr\xe9nuj\xed pravideln\u011b!</p>';
      } else {
        alertsList.innerHTML = uniqueAlerts.map(a => {
          const bgColor = a.priority === 'urgent' ? 'rgba(248,113,113,0.1)' : a.priority === 'info' ? 'rgba(86,200,224,0.1)' : 'rgba(251,191,36,0.1)';
          const borderColor = a.priority === 'urgent' ? 'rgba(248,113,113,0.3)' : a.priority === 'info' ? 'rgba(86,200,224,0.3)' : 'rgba(251,191,36,0.3)';
          const badgeColor = a.priority === 'urgent' ? '#f87171' : a.priority === 'info' ? '#56C8E0' : '#fbbf24';
          const badgeText = a.priority === 'urgent' ? 'Urgentní' : a.priority === 'info' ? 'Nový' : 'Pozor';
          return `
            <div class="alert-row" style="background:${bgColor};border:1px solid ${borderColor};border-radius:var(--radius-sm);padding:0.5rem 0.65rem;margin-bottom:0.35rem;">
              <span style="display:inline-block;font-size:0.65rem;font-weight:700;padding:0.1rem 0.4rem;border-radius:var(--radius-full);background:${badgeColor};color:#fff;margin-right:0.4rem;vertical-align:middle;">${badgeText}</span>
              <span class="alert-name">${a.icon} ${esc(a.name)}</span>
              <span class="alert-detail" style="color:var(--text-muted);font-size:0.82rem;margin-left:0.3rem;">\u2014 ${esc(a.text)}</span>
              <button class="btn-icon" onclick="openChatModal('${a.id}')" title="Napsat zpr\xe1vu" style="margin-left:auto;">\ud83d\udcac</button>
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
      // Revenue summary from payments
      try {
        const payData = await api('zona-admin', { action: 'get-payments' });
        const payments = payData.payments || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let totalRevenue = 0;
        let activeRevenue = 0;
        payments.forEach(p => {
          totalRevenue += p.amount || 0;
          const paidDate = new Date(p.paidUntil + 'T23:59:59');
          if (paidDate >= today) {
            activeRevenue += p.amount || 0;
          }
        });

        // Insert revenue stats card
        let revenueEl = document.getElementById('overview-revenue-stats');
        if (!revenueEl) {
          revenueEl = document.createElement('div');
          revenueEl.id = 'overview-revenue-stats';
          revenueEl.style.cssText = 'margin-top:1rem;padding:0.75rem 1rem;background:var(--bg-elevated);border-radius:var(--radius);border:1px solid var(--border);';
          const alertsSection = document.getElementById('alerts-list').parentElement;
          alertsSection.parentElement.insertBefore(revenueEl, alertsSection);
        }
        revenueEl.innerHTML = `
          <h4 style="margin:0 0 0.5rem 0;font-size:0.85rem;color:var(--text-muted);">💰 Přehled příjmů</h4>
          <div style="display:flex;gap:1.5rem;flex-wrap:wrap;">
            <div>
              <span style="font-size:1.3rem;font-weight:800;color:var(--accent);">${activeRevenue.toLocaleString('cs-CZ')} Kč</span>
              <span style="font-size:0.8rem;color:var(--text-muted);display:block;">aktivní platby</span>
            </div>
            <div>
              <span style="font-size:1.3rem;font-weight:800;color:var(--text);">${totalRevenue.toLocaleString('cs-CZ')} Kč</span>
              <span style="font-size:0.8rem;color:var(--text-muted);display:block;">celkové platby</span>
            </div>
            <div>
              <span style="font-size:1.3rem;font-weight:800;color:${payments.length > 0 ? 'var(--text)' : 'var(--text-muted)'};">${payments.length}</span>
              <span style="font-size:0.8rem;color:var(--text-muted);display:block;">záznamů plateb</span>
            </div>
          </div>
        `;
      } catch {
        // Payments not available, skip revenue stats
      }

    } catch (err) {
      document.getElementById('alerts-list').innerHTML = `<p style="color: #f87171;">${err.message}</p>`;
    }
  }

  // ===== Clients =====
  let clientFilter = 'all'; // 'all', 'active', 'inactive'

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

    // Filter bar
    const filterBarHtml = `
      <div class="client-filter-bar" style="display:flex;gap:0.4rem;margin-bottom:0.75rem;flex-wrap:wrap;align-items:center;">
        <button type="button" class="btn-filter${clientFilter === 'all' ? ' btn-filter-active' : ''}" onclick="setClientFilter('all')">Všichni (${clients.length})</button>
        <button type="button" class="btn-filter${clientFilter === 'active' ? ' btn-filter-active' : ''}" onclick="setClientFilter('active')">Aktivní</button>
        <button type="button" class="btn-filter${clientFilter === 'inactive' ? ' btn-filter-active' : ''}" onclick="setClientFilter('inactive')">Neaktivní</button>
        <button type="button" class="btn-filter" onclick="openBulkMessageModal()" style="margin-left:auto;background:var(--accent);color:#fff;border-color:var(--accent);">📨 Hromadná zpráva</button>
      </div>
      <style>
        .btn-filter { padding:0.3rem 0.7rem; border-radius:var(--radius-full); border:1px solid var(--border); background:var(--bg-elevated); color:var(--text-muted); font-size:0.8rem; cursor:pointer; transition:all 0.15s; }
        .btn-filter:hover { border-color:var(--accent); color:var(--accent); }
        .btn-filter-active { background:var(--accent); color:#fff; border-color:var(--accent); }
      </style>
    `;

    // Filter clients
    let filtered = clients;
    if (clientFilter === 'active') {
      filtered = clients.filter(c => c.phone || c.notes);
    } else if (clientFilter === 'inactive') {
      filtered = clients.filter(c => !c.phone && !c.notes);
    }

    clientsList.innerHTML = filterBarHtml + filtered.map(c => `
      <div class="client-row" data-id="${c.id}">
        <div class="client-info">
          <span class="client-name">${esc(c.name)}${c.selfRegistered ? ' <span style="font-size:0.65rem;background:var(--accent);color:#fff;padding:0.1rem 0.4rem;border-radius:var(--radius-full);font-weight:700;vertical-align:middle;margin-left:0.3rem;">z webu</span>' : ''}</span>
          <span class="client-email">${esc(c.email)}</span>
          ${c.phone ? `<span class="client-meta">📞 ${esc(c.phone)}</span>` : ''}
          ${c.stickyNote ? `<div class="client-sticky-note">${esc(c.stickyNote)}</div>` : ''}
        </div>
        <div class="client-actions">
          <button class="btn-icon" onclick="editPlan('${c.id}')" title="Tréninkový plán">📋</button>
          <button class="btn-icon" onclick="editNutrition('${c.id}')" title="Výživa">🥗</button>
          <button class="btn-icon" onclick="viewWorkoutLogs('${c.id}')" title="Tréninky (logy)">🏋️</button>
          <button class="btn-icon" onclick="showProgress('${c.id}')" title="Progres">📈</button>
          <button class="btn-icon" onclick="showOnboarding('${c.id}')" title="Dotazník">🎯</button>
          <button class="btn-icon" onclick="showCheckins('${c.id}')" title="Check-iny">📋</button>
          <button class="btn-icon" onclick="openChatModal('${c.id}')" title="Chat">💬</button>
          <button class="btn-icon" onclick="generateReport('${c.id}')" title="Měsíční report">📄</button>
          <button class="btn-icon" onclick="duplicateFrom('${c.id}')" title="Kopírovat plán od jiného klienta">📥</button>
          <button class="btn-icon" onclick="editStickyNote('${c.id}')" title="Poznámka">📌</button>
          <button class="btn-icon danger" onclick="deleteClient('${c.id}')" title="Smazat">🗑</button>
        </div>
      </div>
    `).join('');
  }

  window.setClientFilter = function(filter) {
    clientFilter = filter;
    renderClients();
  };

  function renderClientSelect() {
    const options = '<option value="">— Vyber klienta —</option>' +
      clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    planClientSelect.innerHTML = options;
    document.getElementById('nutr-client-select').innerHTML = options;
    document.getElementById('wlog-client-select').innerHTML = options;
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

  // ===== Duplicate plan + nutrition from another client =====
  window.duplicateFrom = async function(targetClientId) {
    const targetClient = clients.find(c => c.id === targetClientId);
    const otherClients = clients.filter(c => c.id !== targetClientId);
    if (otherClients.length === 0) return toast('Žádní další klienti k kopírování');

    const options = otherClients.map(c => c.name).join('\n');
    const chosen = prompt('Kopírovat plán a výživu od klienta:\n(napiš jméno)\n\n' + options);
    if (!chosen) return;

    const sourceClient = otherClients.find(c => c.name.toLowerCase().trim() === chosen.toLowerCase().trim());
    if (!sourceClient) return toast('Klient nenalezen: ' + chosen);

    if (!confirm(`Kopírovat plán a výživu od "${sourceClient.name}" do "${targetClient.name}"? Přepíše aktuální data.`)) return;

    try {
      // Get source plan
      let sourcePlan = null;
      try {
        const planData = await api('zona-admin', { action: 'get-plan', clientId: sourceClient.id });
        sourcePlan = planData.plan;
      } catch {}

      // Get source nutrition
      let sourceNutrition = null;
      try {
        const nutrData = await api('zona-admin', { action: 'get-nutrition', clientId: sourceClient.id });
        sourceNutrition = nutrData.nutrition;
      } catch {}

      if (sourcePlan) {
        await api('zona-admin', { action: 'save-plan', clientId: targetClientId, plan: sourcePlan });
      }
      if (sourceNutrition) {
        await api('zona-admin', { action: 'save-nutrition', clientId: targetClientId, nutrition: sourceNutrition });
      }

      toast('✅ Plán a výživa zkopírována od ' + sourceClient.name);
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
    currentPlanWeekOffset = 0;
    currentPlanMode = 'week';

    await loadPlanForWeek();
  }

  async function loadPlanForWeek() {
    if (!selectedClientId) return;
    planAutosavePaused = true;
    clearTimeout(planAutoSaveTimer);

    const weekKey = getWeekKeyForOffset(currentPlanWeekOffset);

    // Always load base plan for cache
    try {
      const baseData = await api('zona-admin', { action: 'get-plan', clientId: selectedClientId });
      basePlanCache = baseData.plan || createEmptyPlan();
    } catch {
      basePlanCache = createEmptyPlan();
    }

    if (currentPlanMode === 'base') {
      currentPlan = JSON.parse(JSON.stringify(basePlanCache));
    } else {
      // Try week-specific plan, fall back to base
      try {
        const weekData = await api('zona-admin', { action: 'get-week-plan', clientId: selectedClientId, weekKey });
        if (weekData.plan) {
          currentPlan = weekData.plan;
        } else {
          currentPlan = JSON.parse(JSON.stringify(basePlanCache));
        }
      } catch {
        currentPlan = JSON.parse(JSON.stringify(basePlanCache));
      }
    }

    planMessage.value = currentPlan.message || '';
    currentDay = 'monday';
    renderPlanDayTabs();
    renderDayEditor();
    updateWeekNavUI();

    planAutosavePaused = false;
  }

  function updateWeekNavUI() {
    const weekLabel = document.getElementById('plan-week-label');
    const weekBadge = document.getElementById('plan-week-type-badge');
    const deleteBtn = document.getElementById('delete-week-plan-btn');
    const copyBaseBtn = document.getElementById('copy-from-base-btn');
    const copyLastBtn = document.getElementById('copy-from-last-week-btn');
    const editBaseBtn = document.getElementById('edit-base-plan-btn');

    if (currentPlanMode === 'base') {
      weekLabel.textContent = '⚙️ Základní šablona (výchozí plán)';
      weekBadge.textContent = 'ŠABLONA';
      weekBadge.style.background = 'rgba(168, 85, 247, 0.15)';
      weekBadge.style.color = '#a855f7';
      deleteBtn.hidden = true;
      copyBaseBtn.hidden = true;
      copyLastBtn.hidden = true;
      editBaseBtn.textContent = '← Zpět na týden';
    } else {
      const weekKey = getWeekKeyForOffset(currentPlanWeekOffset);
      weekLabel.textContent = formatWeekRange(currentPlanWeekOffset) + ' (' + weekKey + ')';
      const isWeekSpecific = currentPlan.weekKey === weekKey;
      weekBadge.textContent = isWeekSpecific ? 'TÝDENNÍ PLÁN' : 'ZE ŠABLONY';
      weekBadge.style.background = isWeekSpecific ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 146, 60, 0.15)';
      weekBadge.style.color = isWeekSpecific ? '#34d399' : '#fb923c';
      deleteBtn.hidden = !isWeekSpecific;
      copyBaseBtn.hidden = false;
      copyLastBtn.hidden = false;
      editBaseBtn.textContent = '⚙️ Upravit šablonu';
    }
  }

  function createEmptyPlan() {
    const plan = { days: {}, message: '' };
    DAY_ORDER.forEach(d => {
      plan.days[d] = { name: '', rest: false, exercises: [] };
    });
    return plan;
  }

  // ===== Day tabs in plan editor =====
  const DAY_LABELS = { monday: 'Pondělí', tuesday: 'Úterý', wednesday: 'Středa', thursday: 'Čtvrtek', friday: 'Pátek', saturday: 'Sobota', sunday: 'Neděle' };

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

    // Copy day toolbar
    let copyToolbar = document.getElementById('copy-day-toolbar');
    if (!copyToolbar) {
      copyToolbar = document.createElement('div');
      copyToolbar.id = 'copy-day-toolbar';
      copyToolbar.style.cssText = 'display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap;';
      planDayTabs.parentNode.insertBefore(copyToolbar, planDayTabs.nextSibling);
    }
    const dayOptions = DAY_ORDER.map(d => `<option value="${d}">${esc(DAY_LABELS[d])}</option>`).join('');
    copyToolbar.innerHTML = `
      <span style="font-size:0.82rem;color:var(--text-muted);">📋 Kopírovat den →</span>
      <select id="copy-day-target" style="padding:0.3rem 0.5rem;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);font-size:0.82rem;">
        ${dayOptions}
      </select>
      <button type="button" class="btn-primary btn-sm" onclick="copyCurrentDay()" style="font-size:0.8rem;padding:0.3rem 0.7rem;">Vložit</button>
    `;
  }

  window.copyCurrentDay = function() {
    if (!currentPlan || !currentDay) return toast('Nejdřív načti plán');
    saveDayToModel();
    const targetDay = document.getElementById('copy-day-target').value;
    if (targetDay === currentDay) {
      toast('Nelze kopírovat den sám do sebe');
      return;
    }
    const sourceDayData = currentPlan.days[currentDay];
    currentPlan.days[targetDay] = JSON.parse(JSON.stringify(sourceDayData));
    toast('✅ Den zkopírován do ' + DAY_LABELS[targetDay]);
    renderPlanDayTabs();
    triggerPlanAutosave();
  };

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
      <div class="exercise-edit-card" data-index="${i}" draggable="true" style="transition:opacity 0.2s;">
        <div class="exercise-edit-header">
          <span class="drag-handle" style="cursor:grab;font-size:1.1rem;padding:0 0.3rem;color:var(--text-muted);user-select:none;" title="Přetáhni pro změnu pořadí">☰</span>
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
            <label>Váha (kg)</label>
            <input type="text" value="${escAttr(ex.weight || '')}" placeholder="60" data-field="weight">
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

    // Drag & drop reordering
    let dragSrcIndex = null;
    exercisesEditor.querySelectorAll('.exercise-edit-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        dragSrcIndex = parseInt(card.dataset.index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragSrcIndex);
        card.style.opacity = '0.4';
      });
      card.addEventListener('dragend', () => {
        card.style.opacity = '1';
        exercisesEditor.querySelectorAll('.exercise-edit-card').forEach(c => {
          c.style.borderTop = '';
          c.style.borderBottom = '';
        });
      });
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetIndex = parseInt(card.dataset.index);
        exercisesEditor.querySelectorAll('.exercise-edit-card').forEach(c => {
          c.style.borderTop = '';
          c.style.borderBottom = '';
        });
        if (targetIndex < dragSrcIndex) {
          card.style.borderTop = '2px solid var(--accent)';
        } else if (targetIndex > dragSrcIndex) {
          card.style.borderBottom = '2px solid var(--accent)';
        }
      });
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toIndex = parseInt(card.dataset.index);
        if (fromIndex === toIndex) return;
        saveDayToModel();
        const dayData = currentPlan.days[currentDay];
        const moved = dayData.exercises.splice(fromIndex, 1)[0];
        dayData.exercises.splice(toIndex, 0, moved);
        renderExercisesEditor(dayData.exercises);
        triggerPlanAutosave();
      });
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

  // ===== Save plan (manual + autosave) =====
  let planAutoSaveTimer = null;
  let planSaving = false;
  let planAutosavePaused = false;

  async function savePlan() {
    if (!selectedClientId || !currentPlan || planSaving || planAutosavePaused) return;
    saveDayToModel();
    currentPlan.message = planMessage.value.trim();
    currentPlan.messageDate = new Date().toISOString();

    planSaving = true;
    savePlanBtn.disabled = true;
    try {
      if (currentPlanMode === 'base') {
        await api('zona-admin', { action: 'save-plan', clientId: selectedClientId, plan: currentPlan });
      } else {
        const weekKey = getWeekKeyForOffset(currentPlanWeekOffset);
        await api('zona-admin', { action: 'save-week-plan', clientId: selectedClientId, weekKey, plan: currentPlan });
        currentPlan.weekKey = weekKey;
        updateWeekNavUI();
      }
      planStatus.textContent = '✓ Uloženo';
      planStatus.style.color = 'var(--accent)';
      planStatus.hidden = false;
      setTimeout(() => { planStatus.hidden = true; }, 2000);
    } catch (err) {
      toast('❌ ' + err.message);
    } finally {
      planSaving = false;
      savePlanBtn.disabled = false;
    }
  }

  function triggerPlanAutosave() {
    if (!selectedClientId || !currentPlan || planAutosavePaused) return;
    clearTimeout(planAutoSaveTimer);
    planStatus.textContent = 'Ukládám...';
    planStatus.style.color = 'var(--text-muted)';
    planStatus.hidden = false;
    planAutoSaveTimer = setTimeout(savePlan, 2000);
  }

  // Listen for changes in the plan editor area
  document.getElementById('tab-plan-editor').addEventListener('input', (e) => {
    if (e.target.closest('#plan-editor-section')) {
      triggerPlanAutosave();
    }
  });
  document.getElementById('tab-plan-editor').addEventListener('change', (e) => {
    if (e.target.closest('#plan-editor-section')) {
      triggerPlanAutosave();
    }
  });

  savePlanBtn.addEventListener('click', () => {
    clearTimeout(planAutoSaveTimer);
    savePlan();
  });

  // ===== Week plan navigation =====
  document.getElementById('plan-prev-week').addEventListener('click', () => {
    if (!selectedClientId || currentPlanMode === 'base') return;
    currentPlanWeekOffset--;
    loadPlanForWeek();
  });
  document.getElementById('plan-next-week').addEventListener('click', () => {
    if (!selectedClientId || currentPlanMode === 'base') return;
    currentPlanWeekOffset++;
    loadPlanForWeek();
  });
  document.getElementById('plan-this-week').addEventListener('click', () => {
    if (!selectedClientId) return;
    currentPlanMode = 'week';
    currentPlanWeekOffset = 0;
    loadPlanForWeek();
  });
  document.getElementById('edit-base-plan-btn').addEventListener('click', () => {
    if (!selectedClientId) return;
    if (currentPlanMode === 'base') {
      currentPlanMode = 'week';
    } else {
      currentPlanMode = 'base';
    }
    loadPlanForWeek();
  });
  document.getElementById('copy-from-base-btn').addEventListener('click', () => {
    if (!selectedClientId || !basePlanCache || currentPlanMode === 'base') return;
    currentPlan = JSON.parse(JSON.stringify(basePlanCache));
    planMessage.value = currentPlan.message || '';
    currentDay = 'monday';
    renderPlanDayTabs();
    renderDayEditor();
    toast('✅ Šablona zkopírována do tohoto týdne');
    triggerPlanAutosave();
  });
  document.getElementById('copy-from-last-week-btn').addEventListener('click', async () => {
    if (!selectedClientId || currentPlanMode === 'base') return;
    const lastWeekKey = getWeekKeyForOffset(currentPlanWeekOffset - 1);
    try {
      const data = await api('zona-admin', { action: 'get-week-plan', clientId: selectedClientId, weekKey: lastWeekKey });
      if (data.plan) {
        currentPlan = JSON.parse(JSON.stringify(data.plan));
        delete currentPlan.weekKey;
      } else {
        currentPlan = JSON.parse(JSON.stringify(basePlanCache));
      }
      planMessage.value = currentPlan.message || '';
      currentDay = 'monday';
      renderPlanDayTabs();
      renderDayEditor();
      toast('✅ Plán z minulého týdne zkopírován');
      triggerPlanAutosave();
    } catch (err) {
      toast('❌ ' + err.message);
    }
  });
  document.getElementById('delete-week-plan-btn').addEventListener('click', async () => {
    if (!selectedClientId || currentPlanMode === 'base') return;
    if (!confirm('Smazat týdenní plán? Klient uvidí základní šablonu.')) return;
    const weekKey = getWeekKeyForOffset(currentPlanWeekOffset);
    try {
      await api('zona-admin', { action: 'delete-week-plan', clientId: selectedClientId, weekKey });
      toast('✅ Týdenní plán smazán');
      await loadPlanForWeek();
    } catch (err) {
      toast('❌ ' + err.message);
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
            <button class="btn-primary btn-sm" onclick="bulkAssignTemplate('${t.id}')" style="background:var(--accent-hover);font-size:0.75rem;">Přiřadit více klientům</button>
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

  window.bulkAssignTemplate = function(templateId) {
    // Show a multi-select client picker modal
    let bulkModal = document.getElementById('bulk-assign-modal');
    if (!bulkModal) {
      bulkModal = document.createElement('div');
      bulkModal.id = 'bulk-assign-modal';
      bulkModal.className = 'modal-overlay';
      bulkModal.innerHTML = `
        <div class="modal" style="max-width:420px;">
          <div class="modal-header">
            <h3>Přiřadit šablonu klientům</h3>
            <button class="modal-close" onclick="document.getElementById('bulk-assign-modal').hidden=true;document.body.style.overflow='';">✕</button>
          </div>
          <div class="modal-body" id="bulk-assign-clients" style="max-height:350px;overflow-y:auto;"></div>
          <div class="modal-footer" style="display:flex;gap:0.5rem;justify-content:flex-end;padding:0.75rem 1rem;">
            <button type="button" class="btn-primary btn-sm" id="bulk-assign-select-all" style="font-size:0.8rem;">Vybrat vše</button>
            <button type="button" class="btn-primary" id="bulk-assign-confirm">Přiřadit</button>
          </div>
        </div>`;
      document.body.appendChild(bulkModal);

      document.getElementById('bulk-assign-select-all').addEventListener('click', () => {
        const checkboxes = bulkModal.querySelectorAll('input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => { cb.checked = !allChecked; });
      });
    }

    const clientsDiv = document.getElementById('bulk-assign-clients');
    clientsDiv.innerHTML = clients.map(c => `
      <label style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.5rem;cursor:pointer;border-radius:var(--radius-sm);" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background='transparent'">
        <input type="checkbox" value="${c.id}" style="accent-color:var(--accent);">
        <span>${esc(c.name)}</span>
      </label>
    `).join('');

    bulkModal.hidden = false;
    document.body.style.overflow = 'hidden';

    const confirmBtn = document.getElementById('bulk-assign-confirm');
    // Remove old listener by replacing
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);
    newBtn.addEventListener('click', async () => {
      const selected = Array.from(bulkModal.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
      if (selected.length === 0) return toast('Vyber alespoň jednoho klienta');

      newBtn.disabled = true;
      newBtn.textContent = 'Přiřazuji...';
      let successCount = 0;
      for (const clientId of selected) {
        try {
          await api('zona-admin', { action: 'apply-template', clientId, templateId });
          successCount++;
        } catch {}
      }
      newBtn.disabled = false;
      newBtn.textContent = 'Přiřadit';
      bulkModal.hidden = true;
      document.body.style.overflow = '';
      closeTemplateModal();
      toast(`✅ Šablona přiřazena ${successCount} klientům`);
    });
  };

  window.applyTemplate = async function(templateId) {
    try {
      planAutosavePaused = true;
      clearTimeout(planAutoSaveTimer);

      // Apply template on server
      await api('zona-admin', { action: 'apply-template', clientId: selectedClientId, templateId });

      // Reload plan fresh from server to ensure we have the latest data
      const freshData = await api('zona-admin', { action: 'get-plan', clientId: selectedClientId });
      currentPlan = freshData.plan || createEmptyPlan();

      // Re-render everything
      planMessage.value = currentPlan.message || '';
      renderPlanDayTabs();
      renderDayEditor();
      closeTemplateModal();
      toast('✅ Šablona aplikována!');
      setTimeout(() => { planAutosavePaused = false; }, 3000);
    } catch (err) {
      toast('❌ ' + err.message);
      planAutosavePaused = false;
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
    { name: 'Kokosový olej', cat: 'Tuky', per100: { cal: 862, p: 0, c: 0, f: 100 } },
    { name: 'Máslo', cat: 'Tuky', per100: { cal: 717, p: 0.9, c: 0.1, f: 81 } },
    { name: 'Mandle', cat: 'Ořechy', per100: { cal: 579, p: 21, c: 22, f: 50 } },
    { name: 'Vlašské ořechy', cat: 'Ořechy', per100: { cal: 654, p: 15, c: 14, f: 65 } },
    { name: 'Kešu', cat: 'Ořechy', per100: { cal: 553, p: 18, c: 30, f: 44 } },
    { name: 'Směs ořechů', cat: 'Ořechy', per100: { cal: 607, p: 20, c: 17, f: 54 } },
    // Mléčné doplněné
    { name: 'Řecký jogurt (plnotučný)', cat: 'Mléčné', per100: { cal: 97, p: 9, c: 3.6, f: 5 } },
    { name: 'Řecký jogurt s ovocem', cat: 'Mléčné', per100: { cal: 92, p: 7, c: 11, f: 2 } },
    { name: 'Mléko plnotučné', cat: 'Mléčné', per100: { cal: 64, p: 3.3, c: 4.8, f: 3.6 } },
    { name: 'Mléko polotučné', cat: 'Mléčné', per100: { cal: 46, p: 3.3, c: 4.8, f: 1.5 } },
    { name: 'Mozzarella', cat: 'Mléčné', per100: { cal: 280, p: 28, c: 3.1, f: 17 } },
    { name: 'Eidam 30%', cat: 'Mléčné', per100: { cal: 260, p: 30, c: 0, f: 15 } },
    { name: 'Proteínový puding', cat: 'Mléčné', per100: { cal: 80, p: 10, c: 8, f: 1.5 } },
    // Přílohy doplněné
    { name: 'Kuskus (vařený)', cat: 'Přílohy', per100: { cal: 112, p: 3.8, c: 23, f: 0.2 } },
    { name: 'Bulgur (vařený)', cat: 'Přílohy', per100: { cal: 83, p: 3.1, c: 19, f: 0.2 } },
    { name: 'Quinoa (vařená)', cat: 'Přílohy', per100: { cal: 120, p: 4.4, c: 21, f: 1.9 } },
    { name: 'Rýžové chlebíčky', cat: 'Přílohy', per100: { cal: 387, p: 7, c: 82, f: 2.8 } },
    { name: 'Rýžový chléb', cat: 'Přílohy', per100: { cal: 387, p: 7, c: 82, f: 2.8 } },
    { name: 'Tortilla wrap', cat: 'Přílohy', per100: { cal: 310, p: 8, c: 52, f: 8 } },
    // Maso doplněné
    { name: 'Kuřecí maso (obecně)', cat: 'Maso', per100: { cal: 150, p: 21, c: 0, f: 7 } },
    { name: 'Šunka (kuřecí)', cat: 'Maso', per100: { cal: 107, p: 17, c: 1.5, f: 3.5 } },
    { name: 'Slanina', cat: 'Maso', per100: { cal: 541, p: 37, c: 1.4, f: 42 } },
    // Ryby doplněné
    { name: 'Krevety', cat: 'Ryby', per100: { cal: 99, p: 24, c: 0.2, f: 0.3 } },
    { name: 'Sardinka', cat: 'Ryby', per100: { cal: 208, p: 25, c: 0, f: 11 } },
    // Zelenina doplněná
    { name: 'Okurka', cat: 'Zelenina', per100: { cal: 15, p: 0.7, c: 3.6, f: 0.1 } },
    { name: 'Paprika', cat: 'Zelenina', per100: { cal: 31, p: 1, c: 6, f: 0.3 } },
    { name: 'Mrkev', cat: 'Zelenina', per100: { cal: 41, p: 0.9, c: 10, f: 0.2 } },
    { name: 'Cuketa', cat: 'Zelenina', per100: { cal: 17, p: 1.2, c: 3.1, f: 0.3 } },
    { name: 'Zelený salát', cat: 'Zelenina', per100: { cal: 15, p: 1.4, c: 2.9, f: 0.2 } },
    { name: 'Květák', cat: 'Zelenina', per100: { cal: 25, p: 1.9, c: 5, f: 0.3 } },
    { name: 'Cibule', cat: 'Zelenina', per100: { cal: 40, p: 1.1, c: 9, f: 0.1 } },
    { name: 'Česnek', cat: 'Zelenina', per100: { cal: 149, p: 6.4, c: 33, f: 0.5 } },
    { name: 'Pečená zelenina (mix)', cat: 'Zelenina', per100: { cal: 55, p: 1.5, c: 8, f: 2 } },
    // Ovoce doplněné
    { name: 'Borůvky', cat: 'Ovoce', per100: { cal: 57, p: 0.7, c: 14, f: 0.3 } },
    { name: 'Maliny', cat: 'Ovoce', per100: { cal: 52, p: 1.2, c: 12, f: 0.7 } },
    { name: 'Pomeranč', cat: 'Ovoce', per100: { cal: 47, p: 0.9, c: 12, f: 0.1 } },
    { name: 'Hruška', cat: 'Ovoce', per100: { cal: 57, p: 0.4, c: 15, f: 0.1 } },
    { name: 'Kiwi', cat: 'Ovoce', per100: { cal: 61, p: 1.1, c: 15, f: 0.5 } },
    // Proteinové
    { name: 'Whey protein isolate (odměrka 30g)', cat: 'Proteiny', per100: { cal: 370, p: 85, c: 3, f: 1 } },
    { name: 'Casein protein (odměrka 30g)', cat: 'Proteiny', per100: { cal: 360, p: 75, c: 6, f: 4 } },
    { name: 'Proteinová tyčinka', cat: 'Proteiny', per100: { cal: 350, p: 30, c: 35, f: 12 } },
    // Luštěniny doplněné
    { name: 'Fazole (vařené)', cat: 'Luštěniny', per100: { cal: 127, p: 8.7, c: 23, f: 0.5 } },
    { name: 'Tofu', cat: 'Luštěniny', per100: { cal: 76, p: 8, c: 1.9, f: 4.8 } },
    // Ostatní
    { name: 'Med', cat: 'Ostatní', per100: { cal: 304, p: 0.3, c: 82, f: 0 } },
    { name: 'Džem', cat: 'Ostatní', per100: { cal: 250, p: 0.4, c: 63, f: 0.1 } },
    { name: 'Hořká čokoláda (70%)', cat: 'Ostatní', per100: { cal: 598, p: 8, c: 46, f: 43 } },
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
          const calEl = row.querySelector('.food-item-cal');
          const pEl = row.querySelector('.food-item-p');
          const cEl = row.querySelector('.food-item-c');
          const fEl = row.querySelector('.food-item-f');
          mealCal += parseFloat(calEl?.value ?? calEl?.textContent) || 0;
          mealP += parseFloat(pEl?.value ?? pEl?.textContent) || 0;
          mealCa += parseFloat(cEl?.value ?? cEl?.textContent) || 0;
          mealF += parseFloat(fEl?.value ?? fEl?.textContent) || 0;
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
    const isManual = !item.per100 || Object.keys(item.per100 || {}).length === 0;

    let dCal = 0, dP = 0, dC = 0, dF = 0;
    if (item.per100 && item.amount) {
      const mult = item.amount / 100;
      dCal = Math.round(item.per100.cal * mult); dP = (item.per100.p * mult).toFixed(1); dC = (item.per100.c * mult).toFixed(1); dF = (item.per100.f * mult).toFixed(1);
    } else if (item.manual || isManual) {
      dCal = item.cal || 0; dP = item.p || 0; dC = item.c || 0; dF = item.f || 0;
    }

    const macrosHtml = isManual ? `
      <div class="food-item-macros food-item-macros-manual">
        <input type="number" class="food-item-cal food-manual-input" value="${dCal}" placeholder="kcal" oninput="onManualMacroChange(this)">
        <span class="food-item-macro-label">kcal</span>
        <input type="number" class="food-item-p food-manual-input" value="${dP}" placeholder="B" step="0.1" oninput="onManualMacroChange(this)">
        <span class="food-item-macro-label">B</span>
        <input type="number" class="food-item-c food-manual-input" value="${dC}" placeholder="S" step="0.1" oninput="onManualMacroChange(this)">
        <span class="food-item-macro-label">S</span>
        <input type="number" class="food-item-f food-manual-input" value="${dF}" placeholder="T" step="0.1" oninput="onManualMacroChange(this)">
        <span class="food-item-macro-label">T</span>
      </div>` : `
      <div class="food-item-macros">
        <span class="food-item-cal">${dCal}</span>
        <span class="food-item-macro-label">kcal</span>
        <span class="food-item-p">${dP}</span>
        <span class="food-item-macro-label">B</span>
        <span class="food-item-c">${dC}</span>
        <span class="food-item-macro-label">S</span>
        <span class="food-item-f">${dF}</span>
        <span class="food-item-macro-label">T</span>
      </div>`;

    return `
    <div class="food-item-row${isManual ? ' food-item-manual' : ''}" data-item-index="${itemIdx}" data-per100='${per100.replace(/'/g, "&#39;")}'>
      <div class="food-item-name-wrap">
        <input type="text" value="${escAttr(item.food || '')}" placeholder="Hledej potravinu..." class="food-item-name">
        <span class="food-item-cat">${esc(item.cat || '')}</span>
      </div>
      <div class="food-item-amount-wrap">
        <input type="number" value="${amount}" placeholder="g" class="food-item-amount" oninput="onFoodAmountChange(this)">
        <span class="food-item-g">g</span>
      </div>
      ${macrosHtml}
      <button class="food-item-remove" onclick="removeFoodItem(${mealIdx}, ${itemIdx})" title="Odebrat">✕</button>
    </div>`;
  }

  window.onFoodAmountChange = function(input) { recalcFoodItemMacros(input.closest('.food-item-row')); };

  window.onManualMacroChange = function(input) {
    // Recalc meal totals when manual macros change
    const mealCard = input.closest('.meal-card-editor');
    if (mealCard) recalcMealTotals(mealCard);
    recalcAllTotals();
  };

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
          const calEl = row.querySelector('.food-item-cal');
          const pEl = row.querySelector('.food-item-p');
          const cEl = row.querySelector('.food-item-c');
          const fEl = row.querySelector('.food-item-f');
          item.cal = parseFloat(calEl?.value ?? calEl?.textContent) || 0;
          item.p = parseFloat(pEl?.value ?? pEl?.textContent) || 0;
          item.c = parseFloat(cEl?.value ?? cEl?.textContent) || 0;
          item.f = parseFloat(fEl?.value ?? fEl?.textContent) || 0;
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

  // ===== Day Templates (single day) =====
  document.getElementById('save-day-template-btn').addEventListener('click', async () => {
    if (!currentPlan || !currentDay) return toast('Nejdřív načti plán');
    saveDayToModel();

    const dayData = currentPlan.days[currentDay];
    if (!dayData || dayData.rest) return toast('Nelze uložit odpočinkový den jako šablonu');

    const name = prompt('Název denní šablony:', dayData.name || '');
    if (!name) return;

    try {
      const template = {
        name,
        day: JSON.parse(JSON.stringify(dayData)),
      };
      await api('zona-admin', { action: 'save-day-template', template });
      toast('✅ Denní šablona uložena!');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  });

  document.getElementById('load-day-template-btn').addEventListener('click', async () => {
    if (!selectedClientId || !currentDay) return toast('Nejdřív vyber klienta');
    openDayTemplateModal();
  });

  async function openDayTemplateModal() {
    const modal = document.getElementById('day-template-modal');
    const list = document.getElementById('day-template-list');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    list.innerHTML = '<p class="text-muted">Načítám...</p>';

    try {
      const data = await api('zona-admin', { action: 'list-day-templates' });
      const templates = data.templates || [];

      if (templates.length === 0) {
        list.innerHTML = '<p class="text-muted">Zatím žádné denní šablony. Ulož aktuální den jako šablonu.</p>';
        return;
      }

      list.innerHTML = templates.map(t => {
        const exCount = t.day?.exercises?.length || 0;
        return `
        <div class="template-row">
          <div class="template-info">
            <span class="template-name">${esc(t.name)}</span>
            <span class="template-date">${exCount} cviků · ${t.createdAt ? new Date(t.createdAt).toLocaleDateString('cs-CZ') : ''}</span>
          </div>
          <div class="template-actions">
            <button class="btn-primary btn-sm" onclick="applyDayTemplate('${t.id}')">Použít</button>
            <button class="btn-icon danger" onclick="deleteDayTemplate('${t.id}')">🗑</button>
          </div>
        </div>`;
      }).join('');
    } catch (err) {
      list.innerHTML = `<p style="color: #f87171;">${err.message}</p>`;
    }
  }

  window.closeDayTemplateModal = function() {
    document.getElementById('day-template-modal').hidden = true;
    document.body.style.overflow = '';
  };

  window.applyDayTemplate = function(templateId) {
    (async () => {
      try {
        planAutosavePaused = true;
        clearTimeout(planAutoSaveTimer);

        const data = await api('zona-admin', { action: 'list-day-templates' });
        const tpl = (data.templates || []).find(t => t.id === templateId);
        if (!tpl) return toast('Šablona nenalezena');

        // Apply to current day only
        currentPlan.days[currentDay] = JSON.parse(JSON.stringify(tpl.day));
        renderPlanDayTabs();
        renderDayEditor();
        closeDayTemplateModal();

        // Save to server
        await api('zona-admin', { action: 'save-plan', clientId: selectedClientId, plan: currentPlan });
        toast('✅ Denní šablona aplikována!');
        setTimeout(() => { planAutosavePaused = false; }, 3000);
      } catch (err) {
        toast('❌ ' + err.message);
        planAutosavePaused = false;
      }
    })();
  };

  window.deleteDayTemplate = async function(templateId) {
    try {
      await api('zona-admin', { action: 'delete-day-template', templateId });
      openDayTemplateModal();
      toast('Šablona smazána');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  // ===== Nutrition Templates =====
  document.getElementById('save-nutrition-template-btn').addEventListener('click', async () => {
    if (!currentNutrition) return toast('Nejdřív načti výživu');
    saveNutritionToModel();

    const name = prompt('Název šablony výživy:', '');
    if (!name) return;

    try {
      const template = {
        name,
        meals: JSON.parse(JSON.stringify(currentNutrition.meals || [])),
        supplements: JSON.parse(JSON.stringify(currentNutrition.supplements || [])),
        notes: currentNutrition.notes || '',
      };
      await api('zona-admin', { action: 'save-nutrition-template', template });
      toast('✅ Šablona výživy uložena!');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  });

  document.getElementById('load-nutrition-template-btn').addEventListener('click', async () => {
    if (!selectedNutrClientId) return toast('Nejdřív vyber klienta');
    openNutritionTemplateModal();
  });

  async function openNutritionTemplateModal() {
    const modal = document.getElementById('nutrition-template-modal');
    const list = document.getElementById('nutrition-template-list');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    list.innerHTML = '<p class="text-muted">Načítám...</p>';

    try {
      const data = await api('zona-admin', { action: 'list-nutrition-templates' });
      const templates = data.templates || [];

      if (templates.length === 0) {
        list.innerHTML = '<p class="text-muted">Zatím žádné šablony. Ulož aktuální výživu jako šablonu.</p>';
        return;
      }

      list.innerHTML = templates.map(t => `
        <div class="template-row">
          <div class="template-info">
            <span class="template-name">${esc(t.name)}</span>
            <span class="template-date">${t.createdAt ? new Date(t.createdAt).toLocaleDateString('cs-CZ') : ''}</span>
          </div>
          <div class="template-actions">
            <button class="btn-primary btn-sm" onclick="applyNutritionTemplate('${t.id}')">Použít</button>
            <button class="btn-icon danger" onclick="deleteNutritionTemplate('${t.id}')">🗑</button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      list.innerHTML = `<p style="color: #f87171;">${err.message}</p>`;
    }
  }

  window.closeNutritionTemplateModal = function() {
    document.getElementById('nutrition-template-modal').hidden = true;
    document.body.style.overflow = '';
  };

  window.applyNutritionTemplate = async function(templateId) {
    if (!confirm('Nahradit aktuální výživu šablonou?')) return;

    try {
      const data = await api('zona-admin', { action: 'apply-nutrition-template', clientId: selectedNutrClientId, templateId });
      currentNutrition = data.nutrition || createEmptyNutrition();
      nutrNotes.value = currentNutrition.notes || '';
      renderMealsEditor(currentNutrition.meals || []);
      renderSupplementsEditor(currentNutrition.supplements || []);
      recalcAllTotals();
      closeNutritionTemplateModal();
      toast('✅ Šablona výživy aplikována!');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

  window.deleteNutritionTemplate = async function(templateId) {
    if (!confirm('Smazat šablonu výživy?')) return;

    try {
      await api('zona-admin', { action: 'delete-nutrition-template', templateId });
      openNutritionTemplateModal();
      toast('Šablona smazána');
    } catch (err) {
      toast('❌ ' + err.message);
    }
  };

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

      // --- Measurements chart & table ---
      const M_KEYS = ['belly','waist','neck','chest','biceps','forearm','thigh','calf','glutes'];
      const M_LABELS = { belly:'Břicho', waist:'Pas', neck:'Krk', chest:'Hrudník', biceps:'Biceps', forearm:'Předloktí', thigh:'Stehna', calf:'Lýtka', glutes:'Zadek' };
      const M_COLORS = { belly:'#f87171', waist:'#fb923c', neck:'#a78bfa', chest:'#56C8E0', biceps:'#34d399', forearm:'#fbbf24', thigh:'#f472b6', calf:'#818cf8', glutes:'#22d3ee' };

      const measEntries = sorted.filter(e => e.measurements && Object.keys(e.measurements).length > 0);
      const activeKeys = M_KEYS.filter(k => measEntries.some(e => e.measurements[k] != null));

      if (activeKeys.length > 0 && measEntries.length >= 1) {
        // Start vs Latest comparison table
        const firstM = measEntries[0].measurements;
        const lastM = measEntries[measEntries.length - 1].measurements;
        const isMultiple = measEntries.length > 1;

        html += `<h4 style="margin:1.2rem 0 0.4rem;font-size:0.95rem;color:var(--text-primary);">Tělesné míry</h4>`;
        html += '<div style="overflow-x:auto;"><table style="width:100%;font-size:0.82rem;border-collapse:collapse;margin-bottom:0.75rem;">';
        html += `<tr style="border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:0.4rem 0.5rem;color:var(--text-muted);">Míra</th>
          <th style="text-align:center;padding:0.4rem 0.5rem;color:var(--text-muted);">Start</th>
          ${isMultiple ? '<th style="text-align:center;padding:0.4rem 0.5rem;color:var(--text-muted);">Aktuální</th><th style="text-align:center;padding:0.4rem 0.5rem;color:var(--text-muted);">Změna</th>' : ''}
        </tr>`;
        activeKeys.forEach(k => {
          const sv = firstM[k];
          const lv = lastM[k];
          let changeHtml = '';
          if (isMultiple && sv != null && lv != null) {
            const d = lv - sv;
            const sign = d > 0 ? '+' : '';
            const col = d < 0 ? '#34d399' : d > 0 ? '#fb923c' : 'var(--text-muted)';
            changeHtml = `<td style="text-align:center;padding:0.4rem 0.5rem;font-weight:600;color:${col};">${sign}${d.toFixed(1)}</td>`;
          }
          html += `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:0.4rem 0.5rem;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${M_COLORS[k]};margin-right:0.3rem;"></span>${M_LABELS[k]}</td>
            <td style="text-align:center;padding:0.4rem 0.5rem;">${sv != null ? sv + ' cm' : '—'}</td>
            ${isMultiple ? `<td style="text-align:center;padding:0.4rem 0.5rem;font-weight:600;">${lv != null ? lv + ' cm' : '—'}</td>${changeHtml}` : ''}
          </tr>`;
        });
        html += '</table></div>';

        // SVG Chart (if 2+ data points)
        if (measEntries.length >= 2) {
          const W = 560, H = 200, PL = 40, PR = 15, PT = 15, PB = 25;
          const pW = W - PL - PR, pH = H - PT - PB;
          let allV = [];
          measEntries.forEach(e => activeKeys.forEach(k => { if (e.measurements[k] != null) allV.push(e.measurements[k]); }));
          const mn = Math.min(...allV) - 2, mx = Math.max(...allV) + 2, rng = mx - mn || 1;
          const xp = (i) => PL + (i / (measEntries.length - 1)) * pW;
          const yp = (v) => PT + pH - ((v - mn) / rng) * pH;

          let svgC = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;margin:0.5rem 0;">`;
          // Grid
          for (let i = 0; i <= 3; i++) {
            const v = mn + rng * i / 3, yy = yp(v);
            svgC += `<line x1="${PL}" y1="${yy}" x2="${W-PR}" y2="${yy}" stroke="var(--border)" stroke-width="0.5"/>`;
            svgC += `<text x="${PL-4}" y="${yy+3}" text-anchor="end" fill="var(--text-muted)" font-size="9">${Math.round(v)}</text>`;
          }
          // Lines
          activeKeys.forEach(k => {
            const pts = [];
            measEntries.forEach((e, i) => { if (e.measurements[k] != null) pts.push({ x: xp(i), y: yp(e.measurements[k]) }); });
            if (pts.length < 2) return;
            svgC += `<path d="${pts.map((p, i) => `${i?'L':'M'}${p.x},${p.y}`).join(' ')}" fill="none" stroke="${M_COLORS[k]}" stroke-width="2" stroke-linecap="round"/>`;
            pts.forEach(p => { svgC += `<circle cx="${p.x}" cy="${p.y}" r="2.5" fill="${M_COLORS[k]}"/>`; });
          });
          // Date labels
          measEntries.forEach((e, i) => {
            if (i === 0 || i === measEntries.length - 1 || i % Math.max(1, Math.floor(measEntries.length / 4)) === 0) {
              const d = new Date(e.createdAt);
              svgC += `<text x="${xp(i)}" y="${H-4}" text-anchor="middle" fill="var(--text-muted)" font-size="8">${d.getDate()}.${d.getMonth()+1}.</text>`;
            }
          });
          svgC += '</svg>';
          html += svgC;

          // Legend
          html += '<div style="display:flex;flex-wrap:wrap;gap:0.3rem 0.7rem;font-size:0.72rem;margin-bottom:0.5rem;">';
          activeKeys.forEach(k => { html += `<span><span style="display:inline-block;width:10px;height:3px;background:${M_COLORS[k]};border-radius:2px;vertical-align:middle;margin-right:0.2rem;"></span>${M_LABELS[k]}</span>`; });
          html += '</div>';
        }
      }

      // --- Weight history entries ---
      html += '<div style="display: flex; flex-direction: column; gap: 0.35rem;">';
      [...sorted].reverse().forEach((entry) => {
        const date = new Date(entry.createdAt);
        const dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });

        let entryDiff = '';
        const idx = sorted.indexOf(entry);
        if (idx > 0 && entry.weight && sorted[idx - 1].weight) {
          const d = entry.weight - sorted[idx - 1].weight;
          if (d !== 0) {
            const s = d > 0 ? '+' : '';
            entryDiff = `<span style="font-size: 0.75rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: var(--radius-full); background: ${d < 0 ? 'rgba(52, 211, 153, 0.1)' : 'rgba(251, 146, 60, 0.1)'}; color: ${d < 0 ? '#34d399' : '#fb923c'};">${s}${d.toFixed(1)}</span>`;
          }
        }

        const measHtml = entry.measurements ? Object.entries(entry.measurements).map(([k, v]) => `<span style="font-size:0.7rem;color:var(--text-muted);">${M_LABELS[k] || k}: ${v}</span>`).join(' · ') : '';

        html += `
          <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; background: var(--bg-elevated); border-radius: var(--radius-sm); flex-wrap: wrap;">
            ${entry.weight ? `<span style="font-weight: 700; color: var(--accent); min-width: 60px;">${entry.weight} kg</span>` : ''}
            <span style="flex: 1; font-size: 0.8rem; color: var(--text-muted);">${dateStr}</span>
            ${entry.notes ? `<span style="font-size: 0.75rem; color: var(--text-faint);">${esc(entry.notes)}</span>` : ''}
            ${entryDiff}
            ${measHtml ? `<div style="width:100%;padding-top:0.2rem;">${measHtml}</div>` : ''}
          </div>`;
      });
      html += '</div>';

      // --- Strength / Progressive overload section ---
      html += `<h4 style="margin:1.5rem 0 0.6rem;font-size:1rem;color:var(--text-primary);">💪 Síla (Progressive Overload)</h4>`;
      html += `<div id="strength-charts-container"><p class="text-muted" style="font-size:0.85rem;">Načítám historii cviků...</p></div>`;

      modalContent.innerHTML = html;

      // Load strength data async
      loadStrengthCharts(clientId);

    } catch (err) {
      modalContent.innerHTML = `<p style="color: #f87171;">Chyba: ${err.message}</p>`;
    }
  };

  async function loadStrengthCharts(clientId) {
    const container = document.getElementById('strength-charts-container');
    if (!container) return;

    try {
      const data = await api('zona-admin', { action: 'get-strength-history', clientId, days: 60 });
      const exercises = data.exercises || {};
      const names = Object.keys(exercises);

      if (names.length === 0) {
        container.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">Zatím žádné záznamy vah.</p>';
        return;
      }

      const COLORS = ['#56C8E0', '#34d399', '#f87171', '#fb923c', '#a78bfa', '#fbbf24', '#f472b6', '#818cf8', '#22d3ee', '#4ade80'];

      let html = '';
      names.forEach((exName, ci) => {
        const entries = exercises[exName];
        if (entries.length < 1) return;

        // Extract max weight per session
        const dataPoints = entries.map(e => {
          const maxW = Math.max(...e.sets.map(s => parseFloat(s.weight) || 0));
          return { date: e.date, weight: maxW };
        }).filter(p => p.weight > 0);

        if (dataPoints.length === 0) return;

        const color = COLORS[ci % COLORS.length];
        const first = dataPoints[0];
        const last = dataPoints[dataPoints.length - 1];
        const diff = last.weight - first.weight;
        const diffSign = diff > 0 ? '+' : '';
        const diffColor = diff > 0 ? '#34d399' : diff < 0 ? '#f87171' : 'var(--text-muted)';

        html += `<div class="strength-card" style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:0.75rem;margin-bottom:0.5rem;">`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">`;
        html += `<span style="font-weight:700;font-size:0.88rem;">${esc(exName)}</span>`;
        html += `<span style="font-size:0.78rem;font-weight:600;color:${diffColor};">${last.weight}kg ${dataPoints.length > 1 ? `(${diffSign}${diff.toFixed(1)})` : ''}</span>`;
        html += `</div>`;

        // Mini chart if 2+ points
        if (dataPoints.length >= 2) {
          const W = 400, H = 60, PL = 5, PR = 5, PT = 5, PB = 5;
          const pW = W - PL - PR, pH = H - PT - PB;
          const vals = dataPoints.map(p => p.weight);
          const mn = Math.min(...vals) - 1, mx = Math.max(...vals) + 1, rng = mx - mn || 1;
          const xp = (i) => PL + (i / (dataPoints.length - 1)) * pW;
          const yp = (v) => PT + pH - ((v - mn) / rng) * pH;

          let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;">`;
          // Line
          const pts = dataPoints.map((p, i) => ({ x: xp(i), y: yp(p.weight) }));
          svg += `<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
          // Dots
          pts.forEach(p => { svg += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="${color}"/>`; });
          svg += '</svg>';
          html += svg;
        }

        // Per-session details
        html += '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.3rem;">';
        dataPoints.forEach(p => {
          const d = new Date(p.date + 'T00:00:00');
          html += `<span style="font-size:0.7rem;background:var(--bg-card);padding:0.15rem 0.4rem;border-radius:var(--radius-sm);color:var(--text-muted);">${d.getDate()}.${d.getMonth() + 1}. <strong style="color:${color};">${p.weight}kg</strong></span>`;
        });
        html += '</div></div>';
      });

      container.innerHTML = html || '<p class="text-muted" style="font-size:0.85rem;">Zatím žádné záznamy vah.</p>';
    } catch (err) {
      container.innerHTML = `<p style="color:#f87171;font-size:0.85rem;">Chyba: ${err.message}</p>`;
    }
  }

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

  // ===== Check-in viewer modal =====
  const ENERGY_LABELS = { low: '😴 Nízká', ok: '😐 OK', good: '😊 Dobrá', great: '🔥 Skvělá' };

  window.showCheckins = async function(clientId) {
    const client = clients.find(c => c.id === clientId);
    const modal = document.getElementById('checkin-modal');
    const modalName = document.getElementById('checkin-modal-name');
    const modalContent = document.getElementById('checkin-modal-content');

    modalName.textContent = client?.name || clientId;
    modalContent.innerHTML = '<p class="text-muted">Načítám...</p>';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    try {
      const [ciData, adhData] = await Promise.all([
        api('zona-admin', { action: 'get-checkins', clientId }),
        api('zona-admin', { action: 'get-adherence', clientId, days: 28 }),
      ]);
      const entries = ciData.entries || [];
      const adherence = adhData;

      if (entries.length === 0 && !adherence.adherencePercent) {
        modalContent.innerHTML = '<p class="text-muted" style="text-align:center;padding:2rem 0;">Zatím žádné check-iny.</p>';
        return;
      }

      let html = '';

      // Adherence summary
      if (adherence.adherencePercent != null) {
        const adhColor = adherence.adherencePercent >= 80 ? '#34d399' : adherence.adherencePercent >= 50 ? '#fbbf24' : '#f87171';
        html += `<div class="ci-adherence-bar" style="display:flex;align-items:center;gap:1rem;padding:0.75rem;background:var(--bg-elevated);border-radius:var(--radius-md);margin-bottom:1rem;flex-wrap:wrap;">`;
        html += `<div style="text-align:center;"><span style="font-size:1.8rem;font-weight:800;color:${adhColor};">${adherence.adherencePercent}%</span><br><span style="font-size:0.75rem;color:var(--text-muted);">dodržování plánu</span></div>`;
        html += `<div style="flex:1;font-size:0.82rem;color:var(--text-secondary);">`;
        html += `Plán: <strong>${adherence.plannedPerWeek}×</strong>/týden · `;
        html += `Splněno: <strong>${adherence.completedCount}</strong>/${adherence.totalPlanned} za 4 týdny`;
        if (adherence.partialCount > 0) html += ` · Rozpracováno: ${adherence.partialCount}`;
        html += `</div></div>`;

        // Weekly breakdown
        const weeks = Object.entries(adherence.weeks || {}).sort((a, b) => a[0].localeCompare(b[0]));
        if (weeks.length > 0) {
          html += '<div style="display:flex;gap:0.3rem;margin-bottom:1rem;flex-wrap:wrap;">';
          weeks.forEach(([wk, wd]) => {
            const pct = wd.planned > 0 ? Math.round((wd.completed / wd.planned) * 100) : 0;
            const bg = pct >= 80 ? 'rgba(52,211,153,0.15)' : pct >= 50 ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)';
            const col = pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171';
            html += `<div style="flex:1;min-width:60px;text-align:center;padding:0.4rem;background:${bg};border-radius:var(--radius-sm);">`;
            html += `<div style="font-size:0.7rem;color:var(--text-muted);">${wk.split('-')[1]}</div>`;
            html += `<div style="font-weight:700;color:${col};font-size:0.9rem;">${wd.completed}/${wd.planned}</div>`;
            html += `</div>`;
          });
          html += '</div>';
        }
      }

      // Check-in entries
      if (entries.length > 0) {
        html += '<h4 style="font-size:0.95rem;margin-bottom:0.5rem;">📋 Check-in historie</h4>';
        const sorted = [...entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        html += sorted.map(ci => {
          const date = new Date(ci.createdAt);
          const dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
          const stars = '★'.repeat(ci.trainingRating || 0) + '☆'.repeat(5 - (ci.trainingRating || 0));

          let inner = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem;">`;
          inner += `<span style="font-weight:700;font-size:0.88rem;">${dateStr}</span>`;
          inner += `</div>`;

          inner += `<div style="display:flex;flex-wrap:wrap;gap:0.5rem 1rem;font-size:0.82rem;">`;
          inner += `<span>Trénink: <span style="color:#fbbf24;letter-spacing:1px;">${stars}</span></span>`;
          inner += `<span>Dieta: <strong style="color:var(--accent);">${ci.dietAdherence || 0}%</strong></span>`;
          if (ci.weight) inner += `<span>Váha: <strong>${ci.weight} kg</strong></span>`;
          if (ci.energy) inner += `<span>Energie: ${ENERGY_LABELS[ci.energy] || ci.energy}</span>`;
          inner += `</div>`;

          if (ci.notes) {
            inner += `<div style="margin-top:0.3rem;font-size:0.82rem;color:var(--text-secondary);font-style:italic;">„${esc(ci.notes)}"</div>`;
          }

          // Measurements
          if (ci.measurements) {
            const M_LABELS = { belly:'Břicho', waist:'Pas', neck:'Krk', chest:'Hrudník', biceps:'Biceps', forearm:'Předloktí', thigh:'Stehna', calf:'Lýtka', glutes:'Zadek' };
            const measParts = Object.entries(ci.measurements).filter(([, v]) => v != null).map(([k, v]) => `${M_LABELS[k] || k}: ${v} cm`);
            if (measParts.length > 0) {
              inner += `<div style="margin-top:0.3rem;font-size:0.75rem;color:var(--text-muted);">📐 ${measParts.join(' · ')}</div>`;
            }
          }

          return `<div style="padding:0.65rem 0.75rem;background:var(--bg-elevated);border-radius:var(--radius-sm);margin-bottom:0.4rem;border-left:3px solid var(--accent);">${inner}</div>`;
        }).join('');
      }

      modalContent.innerHTML = html;
    } catch (err) {
      modalContent.innerHTML = `<p style="color:#f87171;">Chyba: ${err.message}</p>`;
    }
  };

  window.closeCheckinModal = function() {
    document.getElementById('checkin-modal').hidden = true;
    document.body.style.overflow = '';
  };

  // ===== Chat modal =====
  const MESSAGE_TEMPLATES = [
    "Skvělá práce! Jen tak dál 💪",
    "Nezapomeň na dnešní trénink 🏋️",
    "Jak se cítíš po včerejším tréninku?",
    "Posílám ti aktualizovaný plán, koukni do Zóny 📋",
    "Máš otázky k jídelníčku?",
    "Připomínám check-in tento týden 📊",
  ];

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

    // Render message template chips above input
    let tplWrap = document.getElementById('chat-templates-wrap');
    if (!tplWrap) {
      tplWrap = document.createElement('div');
      tplWrap.id = 'chat-templates-wrap';
      tplWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.35rem;padding:0.5rem 0.75rem;border-top:1px solid var(--border);';
      const inputRow = document.getElementById('chat-modal-input').parentElement;
      inputRow.parentElement.insertBefore(tplWrap, inputRow);
    }
    tplWrap.innerHTML = MESSAGE_TEMPLATES.map(t =>
      `<button type="button" class="chat-tpl-chip" style="font-size:0.75rem;padding:0.25rem 0.6rem;border-radius:var(--radius-full);border:1px solid var(--border);background:var(--bg-elevated);color:var(--text);cursor:pointer;white-space:nowrap;transition:background 0.15s;" onmouseover="this.style.background='var(--accent)';this.style.color='#fff'" onmouseout="this.style.background='var(--bg-elevated)';this.style.color='var(--text)'" onclick="document.getElementById('chat-modal-input').value=this.textContent;document.getElementById('chat-modal-input').focus();">${esc(t)}</button>`
    ).join('');
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
      if (typeof closeBulkMessageModal === 'function') closeBulkMessageModal();
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

  // ===== Engagement Report =====
  let engagementLoaded = false;

  async function loadEngagement() {
    const container = document.getElementById('engagement-clients');
    const summaryAvgAdherence = document.getElementById('eng-avg-adherence');
    const summaryAvgWorkouts = document.getElementById('eng-avg-workouts');
    const summaryMostActive = document.getElementById('eng-most-active');
    const summaryNeedsAttention = document.getElementById('eng-needs-attention');

    if (!container) return;

    if (!engagementLoaded) {
      container.innerHTML = '<div class="eng-loading"><div class="eng-skeleton"></div><div class="eng-skeleton"></div></div>';
    }

    try {
      const data = await api('zona-admin', { action: 'engagement-report' });
      engagementLoaded = true;

      const summary = data.summary || {};
      const clientMetrics = data.clients || [];

      summaryAvgAdherence.textContent = summary.avgAdherence != null ? summary.avgAdherence + '%' : '—';
      summaryAvgWorkouts.textContent = summary.avgWorkoutsPerWeek != null ? summary.avgWorkoutsPerWeek.toFixed(1) : '—';
      summaryMostActive.textContent = summary.mostActiveClient || '—';
      summaryMostActive.style.fontSize = summary.mostActiveClient && summary.mostActiveClient.length > 10 ? '0.85rem' : '';
      summaryNeedsAttention.textContent = summary.needsAttention != null ? summary.needsAttention : '—';

      if (clientMetrics.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align:center;">Zatím žádná data.</p>';
        return;
      }

      container.innerHTML = clientMetrics.map(c => {
        let statusClass, statusLabel, statusIcon;
        if (c.status === 'active') { statusClass = 'eng-active'; statusLabel = 'Aktivní'; statusIcon = '🟢'; }
        else if (c.status === 'declining') { statusClass = 'eng-declining'; statusLabel = 'Klesá'; statusIcon = '🟡'; }
        else { statusClass = 'eng-inactive'; statusLabel = 'Neaktivní'; statusIcon = '🔴'; }

        const daysSinceText = c.daysSinceLastActivity === 0 ? 'Dnes'
          : c.daysSinceLastActivity === 1 ? 'Včera'
          : c.daysSinceLastActivity != null ? c.daysSinceLastActivity + ' dní'
          : '—';

        const adherenceColor = c.dietAdherence >= 70 ? 'var(--accent)' : c.dietAdherence >= 40 ? '#fbbf24' : '#f87171';
        const adherenceWidth = Math.min(c.dietAdherence || 0, 100);

        return `
        <div class="eng-client-card">
          <div class="eng-client-header">
            <div class="eng-client-name">
              <span class="eng-status-dot ${statusClass}">${statusIcon}</span>
              <strong>${esc(c.name)}</strong>
            </div>
            <span class="eng-status-label ${statusClass}">${statusLabel}</span>
          </div>
          <div class="eng-client-metrics">
            <div class="eng-metric">
              <span class="eng-metric-value">${c.adherencePercent != null ? c.adherencePercent + '%' : '—'}</span>
              <span class="eng-metric-label">plnění plánu</span>
            </div>
            <div class="eng-metric">
              <span class="eng-metric-value">${c.workoutsPerWeek != null ? c.workoutsPerWeek.toFixed(1) + (c.plannedPerWeek ? '/' + c.plannedPerWeek : '') : '—'}</span>
              <span class="eng-metric-label">tréninky/týden</span>
            </div>
            <div class="eng-metric">
              <span class="eng-metric-value">${c.dietAdherence != null ? c.dietAdherence + '%' : '—'}</span>
              <span class="eng-metric-label">dieta</span>
            </div>
            <div class="eng-metric">
              <span class="eng-metric-value">${daysSinceText}</span>
              <span class="eng-metric-label">aktivita</span>
            </div>
          </div>
          ${c.adherencePercent != null ? `
          <div class="eng-progress-bar">
            <div class="eng-progress-fill" style="width: ${Math.min(c.adherencePercent, 100)}%; background: ${c.adherencePercent >= 80 ? 'var(--accent)' : c.adherencePercent >= 50 ? '#fbbf24' : '#f87171'};"></div>
          </div>` : ''}
        </div>`;
      }).join('');

    } catch (err) {
      container.innerHTML = `<p style="color: #f87171; text-align: center;">${err.message}</p>`;
    }
  }

  // Refresh button
  const refreshEngBtn = document.getElementById('refresh-engagement-btn');
  if (refreshEngBtn) {
    refreshEngBtn.addEventListener('click', () => {
      engagementLoaded = false;
      loadEngagement();
    });
  }

  // ===== SCHEDULE / CALENDAR =====
  (function scheduleModule() {
    let currentWeekStart = getMonday(new Date());
    let weekSessions = [];
    let editingSessionId = null;

    const HOURS_START = 6;
    const HOURS_END = 21;
    const DAY_NAMES_S = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
    const SESSION_COLORS = 8;

    function getMonday(d) {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      date.setDate(diff);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    function getWeekKey(monday) {
      const year = monday.getFullYear();
      const oneJan = new Date(year, 0, 1);
      const days = Math.floor((monday - oneJan) / 86400000);
      const weekNum = Math.ceil((days + oneJan.getDay() + 1) / 7);
      return `${year}-W${String(weekNum).padStart(2, '0')}`;
    }

    function fmtShort(date) {
      return `${date.getDate()}.${date.getMonth() + 1}.`;
    }

    function getWeekDates(monday) {
      const dates = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        dates.push(d);
      }
      return dates;
    }

    function getClientColor(clientId) {
      if (!clients.length) return 0;
      const idx = clients.findIndex(c => c.id === clientId);
      return idx >= 0 ? idx % SESSION_COLORS : 0;
    }

    function getClientNameS(clientId) {
      const c = clients.find(c => c.id === clientId);
      return c ? c.name : 'Neznámý';
    }

    function escHtml(str) {
      const d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    }

    async function loadWeek() {
      const weekKey = getWeekKey(currentWeekStart);
      const weekDates = getWeekDates(currentWeekStart);
      const label = document.getElementById('sched-week-label');
      label.textContent = `${fmtShort(weekDates[0])} – ${fmtShort(weekDates[6])} ${weekDates[6].getFullYear()}`;

      try {
        const data = await api('zona-admin', { action: 'get-schedule', weekKey });
        weekSessions = data.sessions || [];
      } catch {
        weekSessions = [];
      }

      renderGrid(weekDates);
    }

    function renderGrid(weekDates) {
      const grid = document.getElementById('schedule-grid');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let html = '<div class="sched-col-header sched-time-header">Čas</div>';
      weekDates.forEach((d, i) => {
        const isToday = d.getTime() === today.getTime();
        html += `<div class="sched-col-header${isToday ? ' sched-today' : ''}">${DAY_NAMES_S[i]}<br>${fmtShort(d)}</div>`;
      });

      for (let h = HOURS_START; h <= HOURS_END; h++) {
        html += `<div class="sched-time-label">${String(h).padStart(2, '0')}:00</div>`;
        weekDates.forEach((d) => {
          const dateStr = d.toISOString().split('T')[0];
          html += `<div class="sched-cell" data-date="${dateStr}" data-hour="${h}"></div>`;
        });
      }

      grid.innerHTML = html;

      // Render sessions as cards
      weekSessions.forEach(session => {
        const [sh, sm] = session.time.split(':').map(Number);
        const durationHours = (session.duration || 60) / 60;
        const heightPx = durationHours * 48;

        const cell = grid.querySelector(`.sched-cell[data-date="${session.date}"][data-hour="${sh}"]`);
        if (!cell) return;

        const colorIdx = getClientColor(session.clientId);
        const el = document.createElement('div');
        el.className = `sched-session sched-color-${colorIdx}`;
        el.style.top = `${(sm / 60) * 48}px`;
        el.style.height = `${Math.max(heightPx, 24)}px`;
        el.innerHTML = `<span class="sched-session-name">${escHtml(getClientNameS(session.clientId))}</span><span class="sched-session-time">${session.time} (${session.duration}min)</span>`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          openSessionModal(session);
        });
        cell.appendChild(el);
      });

      // Click empty cell to add
      grid.querySelectorAll('.sched-cell').forEach(cell => {
        cell.addEventListener('click', (e) => {
          if (e.target !== cell) return;
          openSessionModal(null, cell.dataset.date, cell.dataset.hour);
        });
      });
    }

    function openSessionModal(session, date, hour) {
      const modal = document.getElementById('schedule-modal');
      const title = document.getElementById('sched-modal-title');
      const clientSelect = document.getElementById('sched-client-select');
      const dateInput = document.getElementById('sched-date');
      const timeInput = document.getElementById('sched-time');
      const durationInput = document.getElementById('sched-duration');
      const notesInput = document.getElementById('sched-notes');
      const deleteBtn = document.getElementById('sched-delete-btn');

      clientSelect.innerHTML = '<option value="">— Vyber klienta —</option>';
      clients.forEach(c => {
        clientSelect.innerHTML += `<option value="${c.id}">${escHtml(c.name)}</option>`;
      });

      if (session) {
        title.textContent = '📅 Upravit trénink';
        editingSessionId = session.id;
        clientSelect.value = session.clientId;
        dateInput.value = session.date;
        timeInput.value = session.time;
        durationInput.value = session.duration || 60;
        notesInput.value = session.notes || '';
        deleteBtn.style.display = '';
      } else {
        title.textContent = '📅 Nový trénink';
        editingSessionId = null;
        clientSelect.value = '';
        dateInput.value = date || '';
        timeInput.value = hour ? `${String(hour).padStart(2, '0')}:00` : '';
        durationInput.value = 60;
        notesInput.value = '';
        deleteBtn.style.display = 'none';
      }

      modal.hidden = false;
    }

    window.closeScheduleModal = function() {
      document.getElementById('schedule-modal').hidden = true;
      editingSessionId = null;
    };

    document.getElementById('sched-session-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const clientId = document.getElementById('sched-client-select').value;
      const date = document.getElementById('sched-date').value;
      const time = document.getElementById('sched-time').value;
      const duration = parseInt(document.getElementById('sched-duration').value) || 60;
      const notes = document.getElementById('sched-notes').value;

      if (!clientId || !date || !time) return;

      const sessionDate = new Date(date + 'T00:00:00');
      const sessionMonday = getMonday(sessionDate);
      const weekKey = getWeekKey(sessionMonday);

      let sessions;
      try {
        const data = await api('zona-admin', { action: 'get-schedule', weekKey });
        sessions = data.sessions || [];
      } catch {
        sessions = [];
      }

      if (editingSessionId) {
        const idx = sessions.findIndex(s => s.id === editingSessionId);
        if (idx !== -1) {
          sessions[idx] = { ...sessions[idx], clientId, date, time, duration, notes };
        }
      } else {
        sessions.push({
          id: `ses-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          clientId, date, time, duration, notes,
        });
      }

      try {
        await api('zona-admin', { action: 'save-schedule', weekKey, sessions });
        window.closeScheduleModal();
        loadWeek();
        toast('Trénink uložen');
      } catch (err) {
        alert('Chyba: ' + err.message);
      }
    });

    document.getElementById('sched-delete-btn').addEventListener('click', async () => {
      if (!editingSessionId || !confirm('Smazat tento trénink?')) return;

      const weekKey = getWeekKey(currentWeekStart);
      let sessions;
      try {
        const data = await api('zona-admin', { action: 'get-schedule', weekKey });
        sessions = (data.sessions || []).filter(s => s.id !== editingSessionId);
      } catch {
        sessions = [];
      }

      try {
        await api('zona-admin', { action: 'save-schedule', weekKey, sessions });
        window.closeScheduleModal();
        loadWeek();
        toast('Trénink smazán');
      } catch (err) {
        alert('Chyba: ' + err.message);
      }
    });

    document.getElementById('sched-prev-week').addEventListener('click', () => {
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);
      loadWeek();
    });

    document.getElementById('sched-next-week').addEventListener('click', () => {
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      loadWeek();
    });

    document.getElementById('sched-today-btn').addEventListener('click', () => {
      currentWeekStart = getMonday(new Date());
      loadWeek();
    });

    // ICS Export
    document.getElementById('sched-export-ics').addEventListener('click', () => {
      if (!weekSessions.length) {
        toast('Žádné tréninky k exportu');
        return;
      }

      let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Adam Jirsa//Rozvrh//CS\r\nCALSCALE:GREGORIAN\r\n';

      weekSessions.forEach(s => {
        const [y, m, d] = s.date.split('-');
        const [hh, mm] = s.time.split(':');
        const startDt = `${y}${m}${d}T${hh}${mm}00`;
        const endDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm));
        endDate.setMinutes(endDate.getMinutes() + (s.duration || 60));
        const endDt = `${endDate.getFullYear()}${String(endDate.getMonth() + 1).padStart(2, '0')}${String(endDate.getDate()).padStart(2, '0')}T${String(endDate.getHours()).padStart(2, '0')}${String(endDate.getMinutes()).padStart(2, '0')}00`;

        ics += 'BEGIN:VEVENT\r\n';
        ics += `DTSTART:${startDt}\r\n`;
        ics += `DTEND:${endDt}\r\n`;
        ics += `SUMMARY:Trénink - ${getClientNameS(s.clientId)}\r\n`;
        if (s.notes) ics += `DESCRIPTION:${s.notes.replace(/\n/g, '\\n')}\r\n`;
        ics += `UID:${s.id}@adamjirsa\r\n`;
        ics += 'END:VEVENT\r\n';
      });

      ics += 'END:VCALENDAR\r\n';

      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rozvrh-${getWeekKey(currentWeekStart)}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Load schedule when tab is shown
    document.querySelector('[data-tab="schedule"]').addEventListener('click', () => {
      if (clients.length) loadWeek();
    });

    window._scheduleLoadWeek = loadWeek;
  })();

  // ===== PAYMENTS =====
  (function paymentsModule() {
    let allPayments = [];

    function escHtmlP(str) {
      const d = document.createElement('div');
      d.textContent = str;
      return d.innerHTML;
    }

    async function loadPayments() {
      try {
        const data = await api('zona-admin', { action: 'get-payments' });
        allPayments = data.payments || [];
      } catch {
        allPayments = [];
      }
      renderPayments();
    }

    function renderPayments() {
      const tbody = document.getElementById('payments-tbody');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysLater = new Date(today);
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

      // Latest payment per client
      const latestByClient = {};
      allPayments.forEach(p => {
        if (!latestByClient[p.clientId] || new Date(p.paidUntil) > new Date(latestByClient[p.clientId].paidUntil)) {
          latestByClient[p.clientId] = p;
        }
      });

      const rows = [];
      clients.forEach(c => {
        rows.push({ client: c, payment: latestByClient[c.id] || null });
      });

      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align:center;">Žádní klienti</td></tr>';
        updateSummary([]);
        return;
      }

      let html = '';
      rows.forEach(({ client, payment }) => {
        const amount = payment ? payment.amount : null;
        const paidUntil = payment ? payment.paidUntil : null;
        let statusClass = '';
        let statusText = 'Žádná platba';
        let statusIcon = '⚪';

        if (paidUntil) {
          const paidDate = new Date(paidUntil + 'T23:59:59');
          if (paidDate < today) {
            statusClass = 'pay-overdue';
            statusText = 'Nezaplaceno';
            statusIcon = '🔴';
          } else if (paidDate < sevenDaysLater) {
            statusClass = 'pay-warning';
            statusText = 'Brzy vyprší';
            statusIcon = '🟡';
          } else {
            statusClass = 'pay-ok';
            statusText = 'Zaplaceno';
            statusIcon = '🟢';
          }
        }

        const paidFmt = paidUntil ? formatCzDate(paidUntil) : '—';
        const amtFmt = amount != null ? amount.toLocaleString('cs-CZ') + ' Kč' : '—';

        html += `<tr>
          <td style="font-weight:600;">${escHtmlP(client.name)}</td>
          <td class="pay-amount">${amtFmt}</td>
          <td>${paidFmt}</td>
          <td><span class="pay-status ${statusClass}">${statusIcon} ${statusText}</span></td>
          <td><button class="btn-icon" data-client-id="${client.id}" data-action="add-pay" title="Přidat platbu">+</button></td>
        </tr>`;
      });

      tbody.innerHTML = html;

      tbody.querySelectorAll('[data-action="add-pay"]').forEach(btn => {
        btn.addEventListener('click', () => openPaymentModal(btn.dataset.clientId));
      });

      updateSummary(rows);
    }

    function updateSummary(rows) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let expected = 0;
      let received = 0;

      rows.forEach(({ payment }) => {
        if (payment) {
          expected += payment.amount || 0;
          const paidDate = new Date(payment.paidUntil + 'T23:59:59');
          if (paidDate >= today) {
            received += payment.amount || 0;
          }
        }
      });

      document.getElementById('pay-expected').textContent = expected.toLocaleString('cs-CZ') + ' Kč';
      document.getElementById('pay-received').textContent = received.toLocaleString('cs-CZ') + ' Kč';
      document.getElementById('pay-missing').textContent = (expected - received).toLocaleString('cs-CZ') + ' Kč';
    }

    function formatCzDate(dateStr) {
      const [y, m, d] = dateStr.split('-');
      return `${parseInt(d)}.${parseInt(m)}.${y}`;
    }

    function openPaymentModal(preselectedClientId) {
      const modal = document.getElementById('payment-modal');
      const clientSelect = document.getElementById('pay-client-select');
      const amountInput = document.getElementById('pay-amount');
      const paidUntilInput = document.getElementById('pay-paid-until');
      const notesInput = document.getElementById('pay-notes');

      clientSelect.innerHTML = '<option value="">— Vyber klienta —</option>';
      clients.forEach(c => {
        clientSelect.innerHTML += `<option value="${c.id}">${escHtmlP(c.name)}</option>`;
      });

      if (preselectedClientId) clientSelect.value = preselectedClientId;

      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      paidUntilInput.value = endOfMonth.toISOString().split('T')[0];
      amountInput.value = '';
      notesInput.value = '';

      modal.hidden = false;
    }

    window.closePaymentModal = function() {
      document.getElementById('payment-modal').hidden = true;
    };

    document.getElementById('add-payment-btn').addEventListener('click', () => openPaymentModal(null));

    document.getElementById('payment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const clientId = document.getElementById('pay-client-select').value;
      const amount = parseInt(document.getElementById('pay-amount').value) || 0;
      const paidUntil = document.getElementById('pay-paid-until').value;
      const notes = document.getElementById('pay-notes').value;

      if (!clientId || !amount || !paidUntil) return;

      try {
        await api('zona-admin', {
          action: 'save-payment',
          payment: { clientId, amount, paidUntil, notes },
        });
        window.closePaymentModal();
        loadPayments();
        toast('Platba uložena');
      } catch (err) {
        alert('Chyba: ' + err.message);
      }
    });

    // Load when tab is shown
    document.querySelector('[data-tab="payments"]').addEventListener('click', () => {
      if (clients.length) loadPayments();
    });

    window._paymentsLoadPayments = loadPayments;
  })();

  // ===== Bulk Messaging Modal =====
  window.openBulkMessageModal = function() {
    let modal = document.getElementById('bulk-message-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'bulk-message-modal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal" style="max-width:500px;">
          <div class="modal-header">
            <h3>\ud83d\udce8 Hromadn\xe1 zpr\xe1va</h3>
            <button class="modal-close" onclick="closeBulkMessageModal()">\u2715</button>
          </div>
          <div class="modal-body">
            <div style="margin-bottom:0.5rem;">
              <label style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;cursor:pointer;">
                <input type="checkbox" id="bulk-msg-select-all" style="accent-color:var(--accent);">
                <strong>Vybrat v\u0161e</strong>
              </label>
              <div id="bulk-msg-clients" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);padding:0.4rem;"></div>
            </div>
            <div style="margin-bottom:0.5rem;">
              <label style="font-size:0.85rem;color:var(--text-muted);display:block;margin-bottom:0.3rem;">Zpr\xe1va</label>
              <textarea id="bulk-msg-text" rows="4" style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-elevated);color:var(--text);font-size:0.9rem;resize:vertical;" placeholder="Napi\u0161 zpr\xe1vu pro v\u0161echny vybran\xe9 klienty..."></textarea>
            </div>
            <div id="bulk-msg-progress" hidden style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.5rem;"></div>
          </div>
          <div class="modal-footer" style="display:flex;gap:0.5rem;justify-content:flex-end;padding:0.75rem 1rem;">
            <button type="button" class="btn-primary" id="bulk-msg-send-btn">Odeslat v\u0161em</button>
          </div>
        </div>`;
      document.body.appendChild(modal);

      document.getElementById('bulk-msg-select-all').addEventListener('change', function() {
        const checked = this.checked;
        modal.querySelectorAll('#bulk-msg-clients input[type="checkbox"]').forEach(cb => { cb.checked = checked; });
      });

      document.getElementById('bulk-msg-send-btn').addEventListener('click', async function() {
        const selected = Array.from(modal.querySelectorAll('#bulk-msg-clients input[type="checkbox"]:checked')).map(cb => cb.value);
        const text = document.getElementById('bulk-msg-text').value.trim();
        if (selected.length === 0) return toast('Vyber alespo\u0148 jednoho klienta');
        if (!text) return toast('Napi\u0161 zpr\xe1vu');

        const btn = this;
        const progress = document.getElementById('bulk-msg-progress');
        btn.disabled = true;
        progress.hidden = false;

        let sent = 0;
        let failed = 0;
        for (const clientId of selected) {
          progress.textContent = `Odes\xedl\xe1m ${sent + failed + 1}/${selected.length}...`;
          try {
            await api('zona-admin', { action: 'send-message', clientId, text });
            sent++;
          } catch {
            failed++;
          }
        }

        btn.disabled = false;
        progress.textContent = `Hotovo: ${sent} odesl\xe1no` + (failed > 0 ? `, ${failed} se\u0161halo` : '');
        toast(`\u2705 Zpr\xe1va odesl\xe1na ${sent} klient\u016fm` + (failed > 0 ? ` (${failed} chyb)` : ''));
        if (failed === 0) {
          setTimeout(() => { closeBulkMessageModal(); }, 1500);
        }
      });
    }

    // Populate client list
    const clientsDiv = document.getElementById('bulk-msg-clients');
    clientsDiv.innerHTML = clients.map(c => `
      <label style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0.4rem;cursor:pointer;border-radius:var(--radius-sm);" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background='transparent'">
        <input type="checkbox" value="${c.id}" style="accent-color:var(--accent);">
        <span style="font-size:0.9rem;">${esc(c.name)}</span>
      </label>
    `).join('');

    document.getElementById('bulk-msg-select-all').checked = false;
    document.getElementById('bulk-msg-text').value = '';
    document.getElementById('bulk-msg-progress').hidden = true;
    document.getElementById('bulk-msg-send-btn').disabled = false;

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  };

  window.closeBulkMessageModal = function() {
    const modal = document.getElementById('bulk-message-modal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
  };

  // ===== PDF Report (Printable HTML) =====
  window.generateReport = async function(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return toast('Klient nenalezen');

    toast('Generuji report...');

    let progressEntries = [];
    let planData = null;
    let nutritionData = null;
    let checkinEntries = [];
    let strengthData = {};
    let adherenceData = null;

    try {
      const [pData, plData, nData, ciData, strData, adhData] = await Promise.all([
        api('zona-admin', { action: 'get-progress', clientId }),
        api('zona-admin', { action: 'get-plan', clientId }),
        api('zona-admin', { action: 'get-nutrition', clientId }),
        api('zona-admin', { action: 'get-checkins', clientId }),
        api('zona-admin', { action: 'get-strength-history', clientId, days: 30 }),
        api('zona-admin', { action: 'get-adherence', clientId, days: 30 }),
      ]);
      progressEntries = pData.entries || [];
      planData = plData.plan || null;
      nutritionData = nData.nutrition || null;
      checkinEntries = ciData.entries || [];
      strengthData = strData.exercises || {};
      adherenceData = adhData;
    } catch {}

    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentProgress = progressEntries.filter(e => new Date(e.createdAt).getTime() >= thirtyDaysAgo)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const recentCheckins = checkinEntries.filter(e => new Date(e.createdAt).getTime() >= thirtyDaysAgo)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const now = new Date();
    const dateFrom = new Date(thirtyDaysAgo).toLocaleDateString('cs-CZ');
    const dateTo = now.toLocaleDateString('cs-CZ');

    // === Adherence summary ===
    let adherenceHtml = '';
    if (adherenceData && adherenceData.adherencePercent != null) {
      const pct = adherenceData.adherencePercent;
      const col = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
      adherenceHtml = `
        <table style="width:100%;border-collapse:collapse;margin-bottom:0.5rem;">
          <tr><td style="padding:0.4rem;border:1px solid #ddd;">Plnění plánu</td><td style="padding:0.4rem;border:1px solid #ddd;font-weight:700;color:${col};">${pct}%</td></tr>
          <tr><td style="padding:0.4rem;border:1px solid #ddd;">Plánováno tréninků</td><td style="padding:0.4rem;border:1px solid #ddd;">${adherenceData.totalPlanned} (${adherenceData.plannedPerWeek}×/týden)</td></tr>
          <tr><td style="padding:0.4rem;border:1px solid #ddd;">Dokončeno</td><td style="padding:0.4rem;border:1px solid #ddd;font-weight:700;">${adherenceData.completedCount}</td></tr>
          ${adherenceData.partialCount > 0 ? `<tr><td style="padding:0.4rem;border:1px solid #ddd;">Rozpracováno</td><td style="padding:0.4rem;border:1px solid #ddd;">${adherenceData.partialCount}</td></tr>` : ''}
        </table>`;
    } else {
      adherenceHtml = '<p style="color:#888;">Žádná data o tréninku.</p>';
    }

    // === Weight progress ===
    let weightHtml = '<p style="color:#888;">Žádné záznamy váhy.</p>';
    if (recentProgress.length > 0) {
      const first = recentProgress[0];
      const last = recentProgress[recentProgress.length - 1];
      const diff = last.weight - first.weight;
      const diffSign = diff > 0 ? '+' : '';
      weightHtml = `
        <table style="width:100%;border-collapse:collapse;margin-bottom:0.5rem;">
          <tr><td style="padding:0.4rem;border:1px solid #ddd;">Počáteční</td><td style="padding:0.4rem;border:1px solid #ddd;font-weight:700;">${first.weight} kg</td></tr>
          <tr><td style="padding:0.4rem;border:1px solid #ddd;">Aktuální</td><td style="padding:0.4rem;border:1px solid #ddd;font-weight:700;">${last.weight} kg</td></tr>
          <tr><td style="padding:0.4rem;border:1px solid #ddd;">Změna</td><td style="padding:0.4rem;border:1px solid #ddd;font-weight:700;color:${diff <= 0 ? '#16a34a' : '#ea580c'};">${diffSign}${diff.toFixed(1)} kg</td></tr>
        </table>`;
    }

    // === Strength progress ===
    let strengthHtml = '';
    const exNames = Object.keys(strengthData);
    if (exNames.length > 0) {
      strengthHtml = '<table style="width:100%;border-collapse:collapse;font-size:0.85rem;"><thead><tr style="background:#f3f4f6;"><th style="padding:0.3rem 0.4rem;border:1px solid #ddd;text-align:left;">Cvik</th><th style="padding:0.3rem 0.4rem;border:1px solid #ddd;">První</th><th style="padding:0.3rem 0.4rem;border:1px solid #ddd;">Poslední</th><th style="padding:0.3rem 0.4rem;border:1px solid #ddd;">Změna</th></tr></thead><tbody>';
      exNames.forEach(name => {
        const entries = strengthData[name];
        if (entries.length < 1) return;
        const firstMax = Math.max(...entries[0].sets.map(s => parseFloat(s.weight) || 0));
        const lastMax = Math.max(...entries[entries.length - 1].sets.map(s => parseFloat(s.weight) || 0));
        const diff = lastMax - firstMax;
        const diffSign = diff > 0 ? '+' : '';
        const col = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#666';
        strengthHtml += `<tr><td style="padding:0.3rem 0.4rem;border:1px solid #ddd;">${esc(name)}</td><td style="padding:0.3rem 0.4rem;border:1px solid #ddd;text-align:center;">${firstMax}kg</td><td style="padding:0.3rem 0.4rem;border:1px solid #ddd;text-align:center;font-weight:700;">${lastMax}kg</td><td style="padding:0.3rem 0.4rem;border:1px solid #ddd;text-align:center;color:${col};font-weight:700;">${entries.length > 1 ? diffSign + diff.toFixed(1) + 'kg' : '—'}</td></tr>`;
      });
      strengthHtml += '</tbody></table>';
    } else {
      strengthHtml = '<p style="color:#888;">Žádné záznamy síly.</p>';
    }

    // === Check-in summary ===
    let checkinHtml = '';
    if (recentCheckins.length > 0) {
      const avgTraining = (recentCheckins.reduce((s, c) => s + (c.trainingRating || 0), 0) / recentCheckins.length).toFixed(1);
      const avgDiet = Math.round(recentCheckins.reduce((s, c) => s + (Number(c.dietAdherence) || 0), 0) / recentCheckins.length);
      checkinHtml = `
        <table style="width:100%;border-collapse:collapse;margin-bottom:0.5rem;">
          <tr><td style="padding:0.4rem;border:1px solid #ddd;">Počet check-inů</td><td style="padding:0.4rem;border:1px solid #ddd;font-weight:700;">${recentCheckins.length}</td></tr>
          <tr><td style="padding:0.4rem;border:1px solid #ddd;">Prům. hodnocení tréninku</td><td style="padding:0.4rem;border:1px solid #ddd;font-weight:700;">${avgTraining}/5</td></tr>
          <tr><td style="padding:0.4rem;border:1px solid #ddd;">Prům. dieta</td><td style="padding:0.4rem;border:1px solid #ddd;font-weight:700;">${avgDiet}%</td></tr>
        </table>`;
      checkinHtml += recentCheckins.map(ci => {
        const d = new Date(ci.createdAt).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
        const stars = '\u2605'.repeat(ci.trainingRating || 0) + '\u2606'.repeat(5 - (ci.trainingRating || 0));
        return `<div style="padding:0.3rem 0;font-size:0.85rem;border-bottom:1px solid #eee;"><strong>${d}</strong> — ${stars} — Dieta: ${ci.dietAdherence || 0}%${ci.notes ? ' — <em>' + esc(ci.notes) + '</em>' : ''}</div>`;
      }).join('');
    } else {
      checkinHtml = '<p style="color:#888;">Žádné check-iny.</p>';
    }

    // === Nutrition ===
    let nutritionHtml = '<p style="color:#888;">Žádný nutriční plán.</p>';
    if (nutritionData) {
      const cal = nutritionData.calories || 0;
      const p = nutritionData.protein || 0;
      const c = nutritionData.carbs || 0;
      const f = nutritionData.fat || 0;
      nutritionHtml = `
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:0.4rem;border:1px solid #ddd;">Kalorie</td><td style="padding:0.4rem;border:1px solid #ddd;font-weight:700;">${cal} kcal</td></tr>
          <tr><td style="padding:0.4rem;border:1px solid #ddd;">Bílkoviny</td><td style="padding:0.4rem;border:1px solid #ddd;font-weight:700;">${p} g</td></tr>
          <tr><td style="padding:0.4rem;border:1px solid #ddd;">Sacharidy</td><td style="padding:0.4rem;border:1px solid #ddd;font-weight:700;">${c} g</td></tr>
          <tr><td style="padding:0.4rem;border:1px solid #ddd;">Tuky</td><td style="padding:0.4rem;border:1px solid #ddd;font-weight:700;">${f} g</td></tr>
        </table>`;
    }

    const reportHtml = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <title>M\u011bs\xed\u010dn\xed report \u2014 ${esc(client.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem 1.5rem; color: #1a1a1a; }
    h1 { font-size: 1.6rem; border-bottom: 2px solid #10b981; padding-bottom: 0.5rem; }
    h2 { font-size: 1.15rem; color: #10b981; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    table { font-size: 0.9rem; }
    .report-meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
    .report-footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #ddd; text-align: center; color: #aaa; font-size: 0.8rem; }
    @media print { body { padding: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <h1>\ud83d\udcc4 M\u011bs\xed\u010dn\xed report \u2014 ${esc(client.name)}</h1>
  <div class="report-meta">Obdob\xed: ${dateFrom} \u2013 ${dateTo} &nbsp;|&nbsp; Vygenerov\xe1no: ${now.toLocaleDateString('cs-CZ')} ${now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</div>

  <h2>\ud83c\udfaf Pln\u011bn\xed pl\xe1nu</h2>
  ${adherenceHtml}

  <h2>\u2696\ufe0f V\xe1hov\xfd progres</h2>
  ${weightHtml}

  <h2>\ud83d\udcaa S\xedla (progressive overload)</h2>
  ${strengthHtml}

  <h2>\ud83d\udccb Check-iny &amp; zp\u011btn\xe1 vazba</h2>
  ${checkinHtml}

  <h2>\ud83e\udd57 V\xfd\u017eiva</h2>
  ${nutritionHtml}

  <div class="report-footer">Vygenerov\xe1no z administrace \u2014 Adam Jirsa Fitness</div>

  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`;

    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
      reportWindow.document.write(reportHtml);
      reportWindow.document.close();
    } else {
      toast('\u274c Prohl\xed\u017ee\u010d zablokoval vyskakovac\xed okno. Povol pop-up okna.');
    }
  };

  // =====================
  // PDF UPLOAD & EXPORT
  // =====================

  // --- PDF Upload (plan) ---
  const uploadPlanPdfBtn = document.getElementById('upload-plan-pdf-btn');
  const planPdfInput = document.getElementById('plan-pdf-input');
  const planPdfsList = document.getElementById('plan-pdfs-list');

  if (uploadPlanPdfBtn) {
    uploadPlanPdfBtn.addEventListener('click', () => {
      if (!selectedClientId) { toast('Nejdříve vyber klienta'); return; }
      planPdfInput.click();
    });
  }
  if (planPdfInput) {
    planPdfInput.addEventListener('change', async () => {
      const file = planPdfInput.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast('PDF je příliš velké (max 2 MB)'); planPdfInput.value = ''; return; }
      await uploadPdf(file, selectedClientId, 'plan');
      planPdfInput.value = '';
      loadPdfsList(selectedClientId, planPdfsList);
    });
  }

  // --- PDF Upload (nutrition) ---
  const uploadNutrPdfBtn = document.getElementById('upload-nutrition-pdf-btn');
  const nutrPdfInput = document.getElementById('nutrition-pdf-input');
  const nutrPdfsList = document.getElementById('nutrition-pdfs-list');

  if (uploadNutrPdfBtn) {
    uploadNutrPdfBtn.addEventListener('click', () => {
      if (!selectedNutrClientId) { toast('Nejdříve vyber klienta'); return; }
      nutrPdfInput.click();
    });
  }
  if (nutrPdfInput) {
    nutrPdfInput.addEventListener('change', async () => {
      const file = nutrPdfInput.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast('PDF je příliš velké (max 2 MB)'); nutrPdfInput.value = ''; return; }
      await uploadPdf(file, selectedNutrClientId, 'nutrition');
      nutrPdfInput.value = '';
      loadPdfsList(selectedNutrClientId, nutrPdfsList);
    });
  }

  async function uploadPdf(file, clientId, type) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          await api('zona-admin', { action: 'upload-pdf', clientId, pdfData: reader.result, pdfName: file.name, pdfType: type });
          toast('PDF nahráno!');
        } catch (err) {
          toast('Chyba: ' + err.message);
        }
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }

  async function loadPdfsList(clientId, container) {
    if (!container || !clientId) return;
    try {
      const data = await api('zona-admin', { action: 'get-pdfs', clientId });
      const pdfs = data.pdfs || [];
      if (pdfs.length === 0) { container.innerHTML = ''; return; }
      container.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.3rem;">Nahrané dokumenty:</p>' +
        pdfs.map(p => `
          <div style="display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0.5rem;background:var(--bg-elevated);border-radius:var(--radius-sm);margin-bottom:0.25rem;font-size:0.85rem;">
            <span style="flex:1;">${esc(p.name)}</span>
            <span style="color:var(--text-muted);font-size:0.75rem;">${new Date(p.uploadedAt).toLocaleDateString('cs')}</span>
            <button class="btn-icon" onclick="downloadAdminPdf('${clientId}','${p.id}','${esc(p.name)}')" title="Stáhnout">⬇</button>
            <button class="btn-icon danger" onclick="deleteAdminPdf('${clientId}','${p.id}','${container.id}')" title="Smazat">🗑</button>
          </div>
        `).join('');
    } catch { container.innerHTML = ''; }
  }

  window.downloadAdminPdf = async function(clientId, pdfId, name) {
    try {
      const data = await api('zona-admin', { action: 'download-pdf', clientId, pdfId });
      const link = document.createElement('a');
      link.href = data.pdf.data;
      link.download = name || 'dokument.pdf';
      link.click();
    } catch (err) { toast('Chyba: ' + err.message); }
  };

  window.deleteAdminPdf = async function(clientId, pdfId, containerId) {
    if (!confirm('Smazat tento dokument?')) return;
    try {
      await api('zona-admin', { action: 'delete-pdf', clientId, pdfId });
      toast('Dokument smazán');
      loadPdfsList(clientId, document.getElementById(containerId));
    } catch (err) { toast('Chyba: ' + err.message); }
  };

  // --- Auto-load PDFs when plan/nutrition client is selected ---
  const origLoadPlanBtn = document.getElementById('load-plan-btn');
  if (origLoadPlanBtn) {
    const origClick = origLoadPlanBtn.onclick;
    origLoadPlanBtn.addEventListener('click', () => {
      setTimeout(() => { if (selectedClientId) loadPdfsList(selectedClientId, planPdfsList); }, 500);
    });
  }

  // --- Export Plan as PDF (print view) ---
  const exportPlanPdfBtn = document.getElementById('export-plan-pdf-btn');
  if (exportPlanPdfBtn) {
    exportPlanPdfBtn.addEventListener('click', () => {
      if (!currentPlan || !selectedClientId) { toast('Nejdříve načti plán klienta'); return; }
      saveDayToModel();
      const clientName = clients.find(c => c.id === selectedClientId)?.name || '';
      const days = currentPlan.days || {};
      const dayNames = { monday: 'Pondělí', tuesday: 'Úterý', wednesday: 'Středa', thursday: 'Čtvrtek', friday: 'Pátek', saturday: 'Sobota', sunday: 'Neděle' };

      let html = `<html><head><title>Tréninkový plán — ${esc(clientName)}</title>
        <style>
          body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #222; }
          h1 { color: #56C8E0; font-size: 1.6rem; border-bottom: 2px solid #56C8E0; padding-bottom: 8px; }
          h2 { font-size: 1.1rem; margin: 1.2rem 0 0.4rem; color: #333; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 0.5rem; font-size: 0.9rem; }
          th, td { padding: 6px 10px; border: 1px solid #ddd; text-align: left; }
          th { background: #f5f5f5; font-weight: 600; }
          .rest { color: #999; font-style: italic; }
          .footer { margin-top: 2rem; font-size: 0.8rem; color: #999; border-top: 1px solid #eee; padding-top: 0.5rem; }
          @media print { body { padding: 0; } }
        </style></head><body>`;
      html += `<h1>Tréninkový plán — ${esc(clientName)}</h1>`;
      if (currentPlan.message) html += `<p><strong>Zpráva:</strong> ${esc(currentPlan.message)}</p>`;

      for (const [key, label] of Object.entries(dayNames)) {
        const day = days[key];
        if (!day) continue;
        html += `<h2>${label}: ${esc(day.name || '')}</h2>`;
        if (day.rest) { html += '<p class="rest">Odpočinkový den</p>'; continue; }
        if (!day.exercises || day.exercises.length === 0) { html += '<p class="rest">Žádné cviky</p>'; continue; }
        html += '<table><tr><th>Cvik</th><th>Série</th><th>Opakování</th><th>Pauza</th><th>Poznámky</th></tr>';
        day.exercises.forEach(ex => {
          html += `<tr><td>${esc(ex.name)}</td><td>${esc(ex.sets)}</td><td>${esc(ex.reps)}</td><td>${esc(ex.rest)}</td><td>${esc(ex.notes || '')}</td></tr>`;
        });
        html += '</table>';
      }
      html += `<div class="footer">Adam Jirsa Fitness | adamjirsa.cz | Vygenerováno ${new Date().toLocaleDateString('cs')}</div>`;
      html += '</body></html>';

      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); w.print(); }
      else { toast('Povol vyskakovací okna'); }
    });
  }

  // --- Export Nutrition as PDF (print view) ---
  const exportNutrPdfBtn = document.getElementById('export-nutrition-pdf-btn');
  if (exportNutrPdfBtn) {
    exportNutrPdfBtn.addEventListener('click', () => {
      if (!currentNutrition || !selectedNutrClientId) { toast('Nejdříve načti výživu klienta'); return; }
      saveNutritionToModel();
      const clientName = clients.find(c => c.id === selectedNutrClientId)?.name || '';

      let html = `<html><head><title>Výživový plán — ${esc(clientName)}</title>
        <style>
          body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #222; }
          h1 { color: #56C8E0; font-size: 1.6rem; border-bottom: 2px solid #56C8E0; padding-bottom: 8px; }
          h2 { font-size: 1.1rem; margin: 1.2rem 0 0.4rem; color: #333; }
          .macros { display: flex; gap: 1rem; margin: 0.75rem 0; }
          .macro { background: #f5f5f5; padding: 8px 16px; border-radius: 6px; text-align: center; }
          .macro strong { display: block; font-size: 1.2rem; color: #56C8E0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 0.5rem; font-size: 0.9rem; }
          th, td { padding: 6px 10px; border: 1px solid #ddd; text-align: left; }
          th { background: #f5f5f5; font-weight: 600; }
          .supp { background: #f9f9f9; padding: 6px 12px; border-radius: 4px; margin: 2px 0; font-size: 0.9rem; }
          .notes { background: #fff8e1; padding: 10px; border-radius: 6px; margin: 1rem 0; font-size: 0.9rem; }
          .footer { margin-top: 2rem; font-size: 0.8rem; color: #999; border-top: 1px solid #eee; padding-top: 0.5rem; }
          @media print { body { padding: 0; } }
        </style></head><body>`;
      html += `<h1>Výživový plán — ${esc(clientName)}</h1>`;
      html += '<div class="macros">';
      html += `<div class="macro"><strong>${currentNutrition.calories || 0}</strong>kcal</div>`;
      html += `<div class="macro"><strong>${currentNutrition.protein || 0}g</strong>bílkoviny</div>`;
      html += `<div class="macro"><strong>${currentNutrition.carbs || 0}g</strong>sacharidy</div>`;
      html += `<div class="macro"><strong>${currentNutrition.fat || 0}g</strong>tuky</div>`;
      html += '</div>';

      const meals = currentNutrition.meals || [];
      meals.forEach(meal => {
        html += `<h2>${esc(meal.name || 'Jídlo')}${meal.time ? ' (' + esc(meal.time) + ')' : ''}</h2>`;
        if (meal.items && meal.items.length > 0) {
          html += '<table><tr><th>Potravina</th><th>Množství</th><th>kcal</th><th>B</th><th>S</th><th>T</th></tr>';
          meal.items.forEach(item => {
            const cal = item.manual ? (item.cal || 0) : (item.per100 ? Math.round(item.per100.cal * item.amount / 100) : 0);
            const p = item.manual ? (item.p || 0) : (item.per100 ? Math.round(item.per100.p * item.amount / 100) : 0);
            const c = item.manual ? (item.c || 0) : (item.per100 ? Math.round(item.per100.c * item.amount / 100) : 0);
            const f = item.manual ? (item.f || 0) : (item.per100 ? Math.round(item.per100.f * item.amount / 100) : 0);
            html += `<tr><td>${esc(item.food)}</td><td>${item.amount}g</td><td>${cal}</td><td>${p}</td><td>${c}</td><td>${f}</td></tr>`;
          });
          html += '</table>';
        }
      });

      const supps = currentNutrition.supplements || [];
      if (supps.length > 0) {
        html += '<h2>Suplementace</h2>';
        supps.forEach(s => { html += `<div class="supp"><strong>${esc(s.name)}</strong> — ${esc(s.dosage || '')}</div>`; });
      }

      if (currentNutrition.notes) {
        html += `<div class="notes"><strong>Poznámky:</strong><br>${esc(currentNutrition.notes)}</div>`;
      }

      html += `<div class="footer">Adam Jirsa Fitness | adamjirsa.cz | Vygenerováno ${new Date().toLocaleDateString('cs')}</div>`;
      html += '</body></html>';

      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); w.print(); }
      else { toast('Povol vyskakovací okna'); }
    });
  }

  // ===== Sticky Notes =====
  window.editStickyNote = function(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const current = client.stickyNote || '';
    const note = prompt('Poznámka ke klientovi ' + client.name + ':', current);
    if (note === null) return; // cancelled

    // Update via API
    api('zona-admin', { action: 'update-client', clientId, stickyNote: note.trim() })
      .then(() => {
        client.stickyNote = note.trim();
        renderClients();
        toast('Poznámka uložena');
      })
      .catch(err => toast('Chyba: ' + err.message));
  };

  // ===== Workout Logs Viewer =====
  (function() {
    const wlogClientSelect = document.getElementById('wlog-client-select');
    const loadWlogsBtn = document.getElementById('load-wlogs-btn');
    const wlogSection = document.getElementById('wlog-section');
    const wlogClientName = document.getElementById('wlog-client-name');
    const wlogContent = document.getElementById('wlog-content');
    const wlogWeekLabel = document.getElementById('wlog-week-label');

    let wlogClientId = null;
    let wlogWeekOffset = 0;

    const DAY_CZ_SHORT = { monday: 'Po', tuesday: 'Út', wednesday: 'St', thursday: 'Čt', friday: 'Pá', saturday: 'So', sunday: 'Ne' };

    window.viewWorkoutLogs = function(clientId) {
      switchTab('workout-logs');
      wlogClientSelect.value = clientId;
      wlogClientId = clientId;
      wlogWeekOffset = 0;
      loadWorkoutLogs();
    };

    loadWlogsBtn.addEventListener('click', () => {
      const clientId = wlogClientSelect.value;
      if (!clientId) return toast('Vyber klienta');
      wlogClientId = clientId;
      wlogWeekOffset = 0;
      loadWorkoutLogs();
    });

    wlogClientSelect.addEventListener('change', () => {
      const clientId = wlogClientSelect.value;
      if (clientId) {
        wlogClientId = clientId;
        wlogWeekOffset = 0;
        loadWorkoutLogs();
      }
    });

    document.getElementById('wlog-prev-week').addEventListener('click', () => {
      if (!wlogClientId) return;
      wlogWeekOffset--;
      loadWorkoutLogs();
    });
    document.getElementById('wlog-next-week').addEventListener('click', () => {
      if (!wlogClientId) return;
      wlogWeekOffset++;
      loadWorkoutLogs();
    });

    async function loadWorkoutLogs() {
      if (!wlogClientId) return;
      const client = clients.find(c => c.id === wlogClientId);
      wlogClientName.textContent = client?.name || wlogClientId;
      wlogSection.hidden = false;
      wlogContent.innerHTML = '<p class="text-muted">Načítám...</p>';
      wlogWeekLabel.textContent = formatWeekRange(wlogWeekOffset);

      const mon = getMonday(wlogWeekOffset);
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      const dateFrom = mon.toISOString().split('T')[0];
      const dateTo = sun.toISOString().split('T')[0];

      try {
        const [logsData, planData] = await Promise.all([
          api('zona-admin', { action: 'get-workout-logs-range', clientId: wlogClientId, dateFrom, dateTo }),
          api('zona-admin', { action: 'get-plan', clientId: wlogClientId }),
        ]);

        const logs = logsData.logs || {};
        const plan = planData.plan;
        renderWorkoutLogs(logs, plan, mon);
      } catch (err) {
        wlogContent.innerHTML = `<p style="color:#f87171;">Chyba: ${esc(err.message)}</p>`;
      }
    }

    function renderWorkoutLogs(logs, plan, monday) {
      let html = '';
      const today = new Date().toISOString().split('T')[0];

      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayKey = DAY_ORDER[i];
        const dayCz = DAY_CZ_SHORT[dayKey];
        const dateLabel = `${dayCz} ${date.getDate()}.${date.getMonth() + 1}.`;
        const isToday = dateStr === today;

        const log = logs[dateStr];
        const dayPlan = plan?.days?.[dayKey];

        html += `<div class="wlog-day-card${isToday ? ' wlog-today' : ''}${log?.completedAt ? ' wlog-completed' : ''}" data-date="${dateStr}">`;
        html += `<div class="wlog-day-header">`;
        html += `<span class="wlog-day-label">${dateLabel}${isToday ? ' <span style="font-size:0.7rem;background:var(--accent);color:#fff;padding:0.1rem 0.4rem;border-radius:var(--radius-full);">dnes</span>' : ''}</span>`;

        if (log?.completedAt) {
          const t = new Date(log.completedAt);
          html += `<span style="font-size:0.75rem;color:#34d399;font-weight:600;">✅ Dokončeno ${t.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</span>`;
        } else if (log?.exercises?.length > 0) {
          const done = log.exercises.filter(e => e.done).length;
          const total = log.exercises.length;
          html += `<span style="font-size:0.75rem;color:#fb923c;font-weight:600;">⏳ ${done}/${total} cviků</span>`;
        } else if (dayPlan?.rest) {
          html += `<span style="font-size:0.75rem;color:var(--text-muted);">😴 Odpočinek</span>`;
        } else {
          html += `<span style="font-size:0.75rem;color:var(--text-muted);">— Bez záznamu</span>`;
        }

        if (dayPlan?.name) {
          html += `<span style="font-size:0.75rem;color:var(--text-muted);margin-left:auto;">${esc(dayPlan.name)}</span>`;
        }
        html += `</div>`;

        // Exercise details
        if (log?.exercises && log.exercises.length > 0) {
          const planExercises = dayPlan?.exercises || [];

          html += '<div class="wlog-exercises">';
          for (const entry of log.exercises) {
            const planEx = planExercises[entry.index];
            const exName = planEx?.name || `Cvik #${entry.index + 1}`;

            html += `<div class="wlog-exercise${entry.done ? ' wlog-ex-done' : ''}">`;
            html += `<div class="wlog-ex-header">`;
            html += `<span class="wlog-ex-check">${entry.done ? '✅' : '⬜'}</span>`;
            html += `<span class="wlog-ex-name">${esc(exName)}</span>`;
            if (planEx) {
              html += `<span class="wlog-ex-plan">${esc(planEx.sets || '')}×${esc(planEx.reps || '')}${planEx.weight ? ' @ ' + esc(planEx.weight) + 'kg' : ''}</span>`;
            }
            html += `</div>`;

            // Per-set data
            if (entry.sets && entry.sets.length > 0) {
              const filledSets = entry.sets.filter(s => s.weight || s.reps);
              if (filledSets.length > 0) {
                html += '<div class="wlog-sets">';
                entry.sets.forEach((s, si) => {
                  if (s.weight || s.reps) {
                    html += `<span class="wlog-set">${si + 1}. <strong>${s.weight || '?'}</strong>kg × <strong>${s.reps || '?'}</strong></span>`;
                  }
                });
                html += '</div>';
              }
            } else if (entry.actualWeight) {
              html += `<div class="wlog-sets"><span class="wlog-set">${esc(entry.actualWeight)}kg × ${esc(entry.actualReps || '?')}</span></div>`;
            }

            if (entry.notes) {
              html += `<div class="wlog-ex-note">📝 ${esc(entry.notes)}</div>`;
            }

            html += `</div>`;
          }
          html += '</div>';
        }

        // Comments section
        html += `<div class="wlog-comments" id="wlog-comments-${dateStr}">`;
        html += `<div class="wlog-comments-list" id="wlog-comments-list-${dateStr}"></div>`;
        html += `<div class="wlog-comment-form" style="display:flex;gap:0.4rem;margin-top:0.4rem;">`;
        html += `<input type="text" class="wlog-comment-input" id="wlog-ci-${dateStr}" placeholder="Napiš komentář k tréninku..." maxlength="500" style="flex:1;padding:0.4rem 0.6rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-input);color:var(--text);font-size:0.82rem;">`;
        html += `<button class="btn-primary btn-sm" onclick="submitWorkoutComment('${wlogClientId}','${dateStr}')" style="font-size:0.8rem;">💬</button>`;
        html += `</div></div>`;

        html += `</div>`;
      }

      wlogContent.innerHTML = html;

      // Load comments for all days
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        loadDayComments(wlogClientId, dateStr);
      }
    }

    async function loadDayComments(clientId, date) {
      const listEl = document.getElementById(`wlog-comments-list-${date}`);
      if (!listEl) return;
      try {
        const data = await api('zona-admin', { action: 'get-workout-comments', clientId, date });
        const comments = data.comments || [];
        if (comments.length === 0) {
          listEl.innerHTML = '';
          return;
        }
        listEl.innerHTML = comments.map(c => {
          const t = new Date(c.createdAt);
          const timeStr = t.toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
          return `<div class="wlog-comment">
            <span class="wlog-comment-text">${esc(c.text)}</span>
            <span class="wlog-comment-meta">${timeStr}</span>
            <button class="wlog-comment-del" onclick="deleteWorkoutComment('${clientId}','${date}','${c.id}')" title="Smazat">✕</button>
          </div>`;
        }).join('');
      } catch { }
    }

    window.submitWorkoutComment = async function(clientId, date) {
      const input = document.getElementById(`wlog-ci-${date}`);
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      input.disabled = true;
      try {
        await api('zona-admin', { action: 'save-workout-comment', clientId, date, text });
        input.value = '';
        await loadDayComments(clientId, date);
        toast('💬 Komentář uložen');
      } catch (err) {
        toast('❌ ' + err.message);
      } finally {
        input.disabled = false;
        input.focus();
      }
    };

    window.deleteWorkoutComment = async function(clientId, date, commentId) {
      try {
        await api('zona-admin', { action: 'delete-workout-comment', clientId, date, commentId });
        await loadDayComments(clientId, date);
      } catch (err) {
        toast('❌ ' + err.message);
      }
    };

    // Enter key to submit comment
    document.getElementById('tab-workout-logs').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.classList.contains('wlog-comment-input')) {
        const dateStr = e.target.id.replace('wlog-ci-', '');
        submitWorkoutComment(wlogClientId, dateStr);
      }
    });
  })();

  // ===== Start =====
  init();

})();
