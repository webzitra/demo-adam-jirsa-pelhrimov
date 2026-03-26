(function() {
  'use strict';

  const API = '/api';
  let sessionToken = localStorage.getItem('zona_token');
  let clientData = null;
  let planData = null;
  let nutritionData = null;
  let selectedDay = null;
  let progressData = [];
  let checkinData = [];
  let onboardingData = null;
  let messagesData = [];
  let todayWorkoutLog = {};
  let workoutDirty = false;
  let todayNutritionLog = {};
  let nutritionDirty = false;

  // ===== DOM refs =====
  const loginScreen = document.getElementById('login-screen');
  const dashScreen = document.getElementById('dashboard-screen');
  const onboardingScreen = document.getElementById('onboarding-screen');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const dashUserName = document.getElementById('dash-user-name');
  const greetingText = document.getElementById('greeting-text');
  const greetingSub = document.getElementById('greeting-sub');
  const todayBadge = document.getElementById('today-badge');
  const todayContent = document.getElementById('today-content');
  const todayEmpty = document.getElementById('today-empty');
  const sectionWeek = document.getElementById('section-week');
  const dayTabs = document.getElementById('day-tabs');
  const dayExercises = document.getElementById('day-exercises');
  const sectionNutrition = document.getElementById('section-nutrition');
  const nutritionContent = document.getElementById('nutrition-content');
  const sectionSupplements = document.getElementById('section-supplements');
  const supplementsContent = document.getElementById('supplements-content');
  const progressChart = document.getElementById('progress-chart');
  const progressHistory = document.getElementById('progress-history');
  const progressFormWrap = document.getElementById('progress-form-wrap');
  const progressForm = document.getElementById('progress-form');
  const toggleProgressBtn = document.getElementById('toggle-progress-form');
  const videoModal = document.getElementById('video-modal');
  const videoContainer = document.getElementById('video-container');
  const modalClose = document.getElementById('modal-close');
  const workoutSaveBar = document.getElementById('workout-save-bar');
  const workoutProgressText = document.getElementById('workout-progress-text');
  const workoutSaveBtn = document.getElementById('workout-save-btn');
  const comparePhotosBtn = document.getElementById('compare-photos-btn');

  // ===== Theme toggle =====
  const allThemeToggles = document.querySelectorAll('#login-theme-toggle, #onboarding-theme-toggle, #profile-theme-toggle');
  const profileThemeIcon = document.getElementById('profile-theme-icon');
  function updateThemeIcons() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    allThemeToggles.forEach(btn => { btn.textContent = isLight ? '☀️' : '🌙'; });
    if (profileThemeIcon) profileThemeIcon.textContent = isLight ? '☀️' : '🌙';
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

  // ===== Profile menu =====
  const profileTrigger = document.getElementById('profile-trigger');
  const profileDropdown = document.getElementById('profile-dropdown');
  const profileMenuWrap = profileTrigger ? profileTrigger.closest('.profile-menu-wrap') : null;

  if (profileTrigger && profileDropdown) {
    profileTrigger.addEventListener('click', () => {
      const isOpen = !profileDropdown.hidden;
      profileDropdown.hidden = isOpen;
      profileMenuWrap.classList.toggle('open', !isOpen);
    });
    document.addEventListener('click', (e) => {
      if (!profileMenuWrap.contains(e.target)) {
        profileDropdown.hidden = true;
        profileMenuWrap.classList.remove('open');
      }
    });
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }

  function populateProfile() {
    if (!clientData) return;
    const initials = getInitials(clientData.name);
    const avatarEl = document.getElementById('profile-avatar');
    const dropdownAvatar = document.getElementById('profile-dropdown-avatar');
    const dropdownName = document.getElementById('profile-dropdown-name');
    const dropdownEmail = document.getElementById('profile-dropdown-email');
    const sinceValue = document.getElementById('profile-since-value');
    const goalValue = document.getElementById('profile-goal-value');
    const freqValue = document.getElementById('profile-freq-value');

    if (avatarEl) avatarEl.textContent = initials;
    if (dropdownAvatar) dropdownAvatar.textContent = initials;
    if (dropdownName) dropdownName.textContent = clientData.name;
    if (dropdownEmail) dropdownEmail.textContent = clientData.email || '';

    if (sinceValue && clientData.createdAt) {
      const d = new Date(clientData.createdAt);
      const months = ['ledna','února','března','dubna','května','června','července','srpna','září','října','listopadu','prosince'];
      sinceValue.textContent = d.getDate() + '. ' + months[d.getMonth()] + ' ' + d.getFullYear();
    }

    if (onboardingData) {
      const goalMap = { hubnutí: 'Hubnutí', nabírání: 'Nabírání svalů', síla: 'Síla', výkon: 'Sport. výkon', zdraví: 'Zdraví' };
      if (goalValue && onboardingData.goal) goalValue.textContent = goalMap[onboardingData.goal] || onboardingData.goal;
      if (freqValue && onboardingData.frequency) freqValue.textContent = onboardingData.frequency + '× týdně';
    }
  }

  // ===== Day names =====
  const DAY_NAMES = {
    monday: 'Pondělí', tuesday: 'Úterý', wednesday: 'Středa',
    thursday: 'Čtvrtek', friday: 'Pátek', saturday: 'Sobota', sunday: 'Neděle'
  };

  const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // ===== Init =====
  async function init() {
    if (sessionToken) {
      await tryAutoLogin();
    } else {
      showScreen('login');
    }
  }

  // ===== API helper =====
  async function api(endpoint, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API}/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Chyba serveru');
    return data;
  }

  // ===== Screen management =====
  function showScreen(name) {
    loginScreen.classList.toggle('active', name === 'login');
    dashScreen.classList.toggle('active', name === 'dashboard');
    onboardingScreen.classList.toggle('active', name === 'onboarding');
  }

  // ===== Auto-login =====
  async function tryAutoLogin() {
    try {
      const data = await api('zona-auth', { action: 'verify', sessionToken });
      clientData = data.client;
      await loadDashboard();
    } catch {
      localStorage.removeItem('zona_token');
      sessionToken = null;
      showScreen('login');
    }
  }

  // ===== Login =====
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    loginBtn.disabled = true;

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
      const data = await api('zona-auth', { action: 'login', email, password });
      sessionToken = data.sessionToken;
      localStorage.setItem('zona_token', sessionToken);
      clientData = data.client;
      await loadDashboard();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    } finally {
      loginBtn.disabled = false;
    }
  });

  // ===== Logout =====
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('zona_token');
    localStorage.removeItem('zona_dashboard_cache');
    sessionToken = null;
    clientData = null;
    planData = null;
    nutritionData = null;
    messagesData = [];
    showScreen('login');
  });

  // ===== Load Dashboard =====
  const dashLoading = document.getElementById('dash-loading');
  const dashGreeting = document.getElementById('dash-greeting');
  const sectionToday = document.getElementById('section-today');

  function applyDashboardData(data) {
    planData = data.plan;
    nutritionData = data.nutrition;
    progressData = data.progress || [];
    checkinData = data.checkins || [];
    onboardingData = data.onboarding;
    messagesData = data.messages || [];
    todayWorkoutLog = data.todayLog || {};
    todayNutritionLog = data.todayNutritionLog || {};
  }

  function cacheDashboard(data) {
    try {
      const toCache = { ...data, _cachedAt: Date.now() };
      // Don't cache progress photos (too large for localStorage)
      if (toCache.progress) {
        toCache.progress = toCache.progress.map(p => {
          const { photo, ...rest } = p;
          return rest;
        });
      }
      localStorage.setItem('zona_dashboard_cache', JSON.stringify(toCache));
    } catch { /* localStorage full — ignore */ }
  }

  function getCachedDashboard() {
    try {
      const raw = localStorage.getItem('zona_dashboard_cache');
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Cache valid for 1 hour
      if (Date.now() - (data._cachedAt || 0) > 3600000) return null;
      return data;
    } catch { return null; }
  }

  async function loadDashboard() {
    showScreen('dashboard');
    dashUserName.textContent = clientData.name;
    populateProfile();

    // Greeting
    const hour = new Date().getHours();
    let greet = 'Dobré ráno';
    if (hour >= 12 && hour < 18) greet = 'Dobré odpoledne';
    else if (hour >= 18) greet = 'Dobrý večer';

    const firstName = clientData.name.split(' ')[0];
    greetingText.textContent = `${greet}, ${vocative(firstName)} 👋`;

    // Stale-while-revalidate: show cached data instantly, refresh in background
    const cached = getCachedDashboard();
    if (cached && cached.onboarding) {
      applyDashboardData(cached);
      if (dashLoading) dashLoading.hidden = true;
      if (dashGreeting) dashGreeting.hidden = false;
      if (sectionToday) sectionToday.hidden = false;
      renderDashboard();
    } else {
      if (dashLoading) dashLoading.hidden = false;
      if (dashGreeting) dashGreeting.hidden = true;
      if (sectionToday) sectionToday.hidden = true;
    }

    // Fetch fresh data
    try {
      const data = await api('zona-data', { action: 'dashboard' }, sessionToken);
      applyDashboardData(data);
      cacheDashboard(data);

      // Check if onboarding needed
      if (!onboardingData) {
        showScreen('onboarding');
        if (dashLoading) dashLoading.hidden = true;
        return;
      }

      if (dashLoading) dashLoading.hidden = true;
      if (dashGreeting) dashGreeting.hidden = false;
      if (sectionToday) sectionToday.hidden = false;

      populateProfile();
      renderDashboard();
    } catch (err) {
      // If we had cached data, keep showing it
      if (!cached) {
        if (dashLoading) dashLoading.hidden = true;
        if (dashGreeting) dashGreeting.hidden = false;
        greetingSub.textContent = 'Nepodařilo se načíst data. Zkus to znovu.';
      }
      console.error('Dashboard load error:', err);
    }
  }

  // ===== Onboarding =====
  let obStep = 1;
  const obSteps = document.querySelectorAll('.onboarding-step');
  const obProgressBar = document.getElementById('onboarding-progress-bar');
  const obStepLabel = document.getElementById('onboarding-step-label');
  const obPrevBtn = document.getElementById('ob-prev');
  const obNextBtn = document.getElementById('ob-next');

  function updateOnboardingUI() {
    obSteps.forEach(s => { s.hidden = parseInt(s.dataset.step) !== obStep; });
    obProgressBar.style.width = `${(obStep / 5) * 100}%`;
    obStepLabel.textContent = `Krok ${obStep} z 5`;
    obPrevBtn.hidden = obStep === 1;
    obNextBtn.textContent = obStep === 5 ? 'Dokončit ✓' : 'Další →';
  }

  obPrevBtn.addEventListener('click', () => {
    if (obStep > 1) { obStep--; updateOnboardingUI(); }
  });

  obNextBtn.addEventListener('click', async () => {
    if (obStep < 5) {
      obStep++;
      updateOnboardingUI();
    } else {
      // Submit onboarding
      const goal = document.querySelector('[name="goal"]:checked')?.value || '';
      const location = document.querySelector('[name="location"]:checked')?.value || '';

      const obData = {
        goal,
        weight: document.getElementById('ob-weight')?.value || '',
        height: document.getElementById('ob-height')?.value || '',
        age: document.getElementById('ob-age')?.value || '',
        frequency: document.getElementById('ob-frequency')?.value || '',
        location,
        experience: document.getElementById('ob-experience')?.value || '',
        injuries: document.getElementById('ob-injuries')?.value?.trim() || '',
        allergies: document.getElementById('ob-allergies')?.value?.trim() || '',
        motivation: document.getElementById('ob-motivation')?.value?.trim() || '',
        deadline: document.getElementById('ob-deadline')?.value?.trim() || '',
      };

      obNextBtn.disabled = true;
      obNextBtn.textContent = 'Ukládám...';

      try {
        await api('zona-data', { action: 'save-onboarding', data: obData }, sessionToken);
        onboardingData = obData;
        showScreen('dashboard');
        if (dashLoading) dashLoading.hidden = true;
        if (dashGreeting) dashGreeting.hidden = false;
        if (sectionToday) sectionToday.hidden = false;
        renderDashboard();
      } catch (err) {
        alert('Chyba: ' + err.message);
      } finally {
        obNextBtn.disabled = false;
        obNextBtn.textContent = 'Dokončit ✓';
      }
    }
  });

  // ===== Render Dashboard =====
  function renderDashboard() {
    const today = getTodayKey();

    if (planData && planData.days && planData.days[today]) {
      const dayData = planData.days[today];

      if (dayData.rest) {
        todayContent.innerHTML = `
          <div class="rest-day-card">
            <span class="rest-icon">😴</span>
            <h4>Dnes odpočíváš</h4>
            <p>Regenerace je součást tréninku. Dej si pauzu, zasloužíš si to.</p>
          </div>`;
        todayBadge.textContent = 'Volno';
        todayBadge.style.background = 'rgba(255, 255, 255, 0.05)';
        todayBadge.style.color = 'var(--text-muted)';
      } else {
        const name = dayData.name || DAY_NAMES[today];
        todayBadge.textContent = name;
        renderExercises(todayContent, dayData.exercises || [], today);
      }

      greetingSub.textContent = dayData.rest
        ? 'Dnes máš volno — odpočívej a regeneruj.'
        : `Dnes tě čeká: ${dayData.name || 'trénink'}. Jdeme na to! 💪`;
    } else if (planData) {
      greetingSub.textContent = 'Na dnešek nemáš naplánovaný trénink.';
      todayEmpty.querySelector('p').textContent = 'Na dnešek nemáš trénink.';
    } else {
      greetingSub.textContent = 'Tvůj tréninkový plán se připravuje.';
    }

    // Week view
    if (planData && planData.days) {
      sectionWeek.hidden = false;
      setupDayTabs();
    }

    // Nutrition
    if (nutritionData) {
      sectionNutrition.hidden = false;
      renderNutrition();
    }

    // Supplements
    if (nutritionData && nutritionData.supplements && nutritionData.supplements.length > 0) {
      sectionSupplements.hidden = false;
      renderSupplements();
    }

    // Stats overview + progress
    renderStats();
    renderProgress();
    renderCheckinHistory();

    // Chat
    renderChat();

    // Message from Adam (legacy — now we have chat)
    // Keep for backwards compat: if plan has message, show it as first chat message
  }

  // ===== Render exercises with workout logging =====
  function renderExercises(container, exercises, dayKey) {
    if (!exercises || exercises.length === 0) {
      container.innerHTML = `
        <div class="rest-day-card">
          <span class="rest-icon">📋</span>
          <h4>Žádné cviky</h4>
          <p>Pro tento den ještě nejsou cviky přidané.</p>
        </div>`;
      return;
    }

    const isToday = dayKey === getTodayKey();
    const logExercises = todayWorkoutLog.exercises || [];

    container.innerHTML = exercises.map((ex, i) => {
      const logEntry = isToday ? logExercises.find(le => le.index === i) : null;
      const isDone = logEntry?.done || false;

      return `
      <div class="exercise-card ${isDone ? 'completed' : ''}" data-exercise-index="${i}" style="animation-delay: ${i * 0.04}s">
        <div class="exercise-card-inner">
          ${isToday ? `
          <div class="exercise-check-bar ${isDone ? 'checked' : ''}">
            <label class="exercise-check-label">
              <input type="checkbox" class="exercise-check" data-index="${i}" ${isDone ? 'checked' : ''}>
              <span class="exercise-check-icon">${isDone ? '✓' : ''}</span>
            </label>
          </div>` : `
          <div class="exercise-number-bar">
            <span class="exercise-number">${i + 1}</span>
          </div>`}
          <div class="exercise-body">
            <div class="exercise-header">
              <div class="exercise-name">${escapeHtml(ex.name)}</div>
            </div>
            <div class="exercise-meta">
              ${ex.sets ? `<span class="exercise-meta-tag sets-tag">${escapeHtml(ex.sets)}${ex.reps ? ' × ' + escapeHtml(ex.reps) : ''}</span>` : ''}
              ${ex.rest ? `<span class="exercise-meta-tag rest-tag" data-rest="${escapeAttr(ex.rest)}" title="Spustit odpočinkový časovač">⏱ ${escapeHtml(ex.rest)}</span>` : ''}
              ${ex.weight ? `<span class="exercise-meta-tag">🏋 ${escapeHtml(ex.weight)}</span>` : ''}
            </div>
            ${isToday ? `
            <div class="exercise-actual-row">
              <div class="exercise-actual-field">
                <label>Váha</label>
                <input type="text" class="exercise-actual-input" data-actual="weight" data-index="${i}" value="${escapeAttr(logEntry?.actualWeight || '')}" placeholder="${ex.weight || 'kg'}">
              </div>
              <div class="exercise-actual-field">
                <label>Série</label>
                <input type="text" class="exercise-actual-input" data-actual="sets" data-index="${i}" value="${escapeAttr(logEntry?.actualSets || '')}" placeholder="${ex.sets || ''}">
              </div>
              <div class="exercise-actual-field">
                <label>Opak.</label>
                <input type="text" class="exercise-actual-input" data-actual="reps" data-index="${i}" value="${escapeAttr(logEntry?.actualReps || '')}" placeholder="${ex.reps || ''}">
              </div>
            </div>` : ''}
            ${ex.notes ? `<div class="exercise-notes">${escapeHtml(ex.notes)}</div>` : ''}
            ${ex.videoUrl ? `<button class="exercise-video-btn" data-video="${escapeAttr(ex.videoUrl)}">▶ Ukázka cviku</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

    // Event listeners
    container.querySelectorAll('.exercise-video-btn').forEach(btn => {
      btn.addEventListener('click', () => openVideo(btn.dataset.video));
    });

    // Rest timer integration
    container.querySelectorAll('.rest-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const restStr = tag.dataset.rest;
        if (restStr && window.startRestTimer) {
          const secs = parseRestSeconds(restStr);
          if (secs > 0) window.startRestTimer(secs);
        }
      });
    });

    if (isToday) {
      // Checkbox listeners
      container.querySelectorAll('.exercise-check').forEach(cb => {
        cb.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.index);
          const card = e.target.closest('.exercise-card');
          const checkBar = e.target.closest('.exercise-check-bar');
          const icon = e.target.nextElementSibling;

          if (e.target.checked) {
            card.classList.add('completed');
            checkBar.classList.add('checked');
            icon.textContent = '✓';
          } else {
            card.classList.remove('completed');
            checkBar.classList.remove('checked');
            icon.textContent = '';
          }

          updateWorkoutLogLocal(idx, 'done', e.target.checked);
          updateWorkoutSaveBar(exercises.length);
        });
      });

      // Actual input listeners
      container.querySelectorAll('.exercise-actual-input').forEach(input => {
        input.addEventListener('input', () => {
          const idx = parseInt(input.dataset.index);
          const field = input.dataset.actual;
          const fieldMap = { weight: 'actualWeight', sets: 'actualSets', reps: 'actualReps' };
          updateWorkoutLogLocal(idx, fieldMap[field], input.value);
        });
      });

      updateWorkoutSaveBar(exercises.length);
    }
  }

  function updateWorkoutLogLocal(exerciseIndex, field, value) {
    if (!todayWorkoutLog.exercises) todayWorkoutLog.exercises = [];
    let entry = todayWorkoutLog.exercises.find(e => e.index === exerciseIndex);
    if (!entry) {
      entry = { index: exerciseIndex, done: false, actualSets: '', actualReps: '', actualWeight: '', notes: '' };
      todayWorkoutLog.exercises.push(entry);
    }
    entry[field] = value;
    workoutDirty = true;
  }

  function updateWorkoutSaveBar(totalExercises) {
    const checked = document.querySelectorAll('#today-content .exercise-check:checked').length;
    workoutProgressText.textContent = `${checked}/${totalExercises} cviků hotovo`;
    workoutSaveBar.hidden = !workoutDirty;
  }

  workoutSaveBtn.addEventListener('click', async () => {
    const today = new Date().toISOString().split('T')[0];
    const todayKey = getTodayKey();
    const dayData = planData?.days?.[todayKey];

    todayWorkoutLog.date = today;
    todayWorkoutLog.day = todayKey;

    const checked = document.querySelectorAll('#today-content .exercise-check:checked').length;
    const total = dayData?.exercises?.length || 0;
    if (checked === total && total > 0) {
      todayWorkoutLog.completedAt = new Date().toISOString();
    }

    workoutSaveBtn.disabled = true;
    workoutSaveBtn.textContent = 'Ukládám...';

    try {
      await api('zona-data', { action: 'save-workout-log', date: today, log: todayWorkoutLog }, sessionToken);
      workoutDirty = false;
      workoutSaveBtn.textContent = '✓ Uloženo!';
      setTimeout(() => {
        workoutSaveBtn.textContent = '💾 Uložit trénink';
        workoutSaveBtn.disabled = false;
        // Hide bar after saving — will reappear on next interaction
        workoutSaveBar.hidden = true;
      }, 1200);
    } catch (err) {
      alert('Chyba: ' + err.message);
      workoutSaveBtn.textContent = '💾 Uložit trénink';
      workoutSaveBtn.disabled = false;
    }
  });

  // ===== Day tabs =====
  function setupDayTabs() {
    const today = getTodayKey();

    dayTabs.querySelectorAll('.day-tab').forEach(tab => {
      const day = tab.dataset.day;
      const dayData = planData.days[day];

      if (day === today) tab.classList.add('today');
      if (dayData && dayData.rest) tab.classList.add('rest');

      tab.addEventListener('click', () => selectDay(day));
    });

    selectDay(today);
  }

  function selectDay(day) {
    selectedDay = day;

    dayTabs.querySelectorAll('.day-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.day === day);
    });

    const dayData = planData.days[day];

    if (!dayData) {
      dayExercises.innerHTML = `
        <div class="rest-day-card">
          <span class="rest-icon">📋</span>
          <h4>${DAY_NAMES[day]}</h4>
          <p>Pro tento den není naplánovaný trénink.</p>
        </div>`;
      return;
    }

    if (dayData.rest) {
      dayExercises.innerHTML = `
        <div class="rest-day-card">
          <span class="rest-icon">😴</span>
          <h4>Odpočinkový den</h4>
          <p>${dayData.notes ? escapeHtml(dayData.notes) : 'Regeneruj, protahuj se, odpočívej.'}</p>
        </div>`;
      return;
    }

    const header = dayData.name ? `<p style="color: var(--accent); font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.75rem;">${escapeHtml(dayData.name)}</p>` : '';

    dayExercises.innerHTML = header;
    const exerciseContainer = document.createElement('div');
    exerciseContainer.className = 'exercises-list';
    dayExercises.appendChild(exerciseContainer);
    renderExercises(exerciseContainer, dayData.exercises || [], day);
  }

  // ===== Nutrition =====
  function getMealCalories(meal) {
    if (meal.calories) return parseInt(meal.calories) || 0;
    const items = meal.items || [];
    let total = 0;
    items.forEach(it => {
      if (it.per100 && it.amount) total += Math.round(it.per100.cal * it.amount / 100);
      else if (it.cal) total += it.cal;
    });
    return total;
  }

  function renderNutrition() {
    const checkedMeals = todayNutritionLog.meals || [];
    const totalMeals = nutritionData.meals?.length || 0;
    const eatenCount = checkedMeals.filter(Boolean).length;

    // Calculate eaten vs total calories
    let totalCal = 0, eatenCal = 0;
    let totalProt = 0, eatenProt = 0;
    let totalCarb = 0, eatenCarb = 0;
    let totalFatVal = 0, eatenFatVal = 0;

    if (nutritionData.meals) {
      nutritionData.meals.forEach((meal, i) => {
        const cal = getMealCalories(meal);
        const prot = parseInt(meal.protein) || 0;
        const carb = parseInt(meal.carbs) || 0;
        const fat = parseInt(meal.fat) || 0;
        totalCal += cal;
        totalProt += prot;
        totalCarb += carb;
        totalFatVal += fat;
        if (checkedMeals[i]) {
          eatenCal += cal;
          eatenProt += prot;
          eatenCarb += carb;
          eatenFatVal += fat;
        }
      });
    }

    // Use plan macros as target if available, otherwise sum from meals
    const targetCal = parseInt(nutritionData.calories) || totalCal || 1;
    const targetProt = parseInt(nutritionData.protein) || totalProt;
    const targetCarb = parseInt(nutritionData.carbs) || totalCarb;
    const targetFat = parseInt(nutritionData.fat) || totalFatVal;

    const calPct = Math.min(100, Math.round((eatenCal / targetCal) * 100));

    let html = '';

    // Daily progress ring + macros consumed
    if (totalMeals > 0) {
      const circumference = 2 * Math.PI * 40;
      const dashOffset = circumference - (calPct / 100) * circumference;

      html += `
      <div class="nutrition-daily-progress">
        <div class="nutrition-ring-wrap">
          <svg class="nutrition-ring" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" stroke-width="6"/>
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--accent)" stroke-width="6"
              stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
              transform="rotate(-90 50 50)" style="transition: stroke-dashoffset 0.6s ease;"/>
          </svg>
          <div class="nutrition-ring-center">
            <span class="nutrition-ring-pct">${calPct}%</span>
            <span class="nutrition-ring-label">snězeno</span>
          </div>
        </div>
        <div class="nutrition-daily-stats">
          <div class="nutrition-daily-stat">
            <span class="nds-value">${eatenCal}</span>
            <span class="nds-sep">/</span>
            <span class="nds-total">${targetCal}</span>
            <span class="nds-label">kcal</span>
          </div>
          <div class="nutrition-daily-stat">
            <span class="nds-value">${eatenProt}</span>
            <span class="nds-sep">/</span>
            <span class="nds-total">${targetProt}g</span>
            <span class="nds-label">bílkoviny</span>
          </div>
          <div class="nutrition-daily-stat">
            <span class="nds-value">${eatenCarb}</span>
            <span class="nds-sep">/</span>
            <span class="nds-total">${targetCarb}g</span>
            <span class="nds-label">sacharidy</span>
          </div>
          <div class="nutrition-daily-stat">
            <span class="nds-value">${eatenFatVal}</span>
            <span class="nds-sep">/</span>
            <span class="nds-total">${targetFat}g</span>
            <span class="nds-label">tuky</span>
          </div>
          <div class="nutrition-daily-meals-count">${eatenCount}/${totalMeals} jídel snězeno</div>
        </div>
      </div>`;
    }

    if (nutritionData.meals && nutritionData.meals.length > 0) {
      html += nutritionData.meals.map((meal, mealIdx) => {
        const hasMacros = meal.calories || meal.protein || meal.carbs || meal.fat;
        const items = meal.items || [];
        const isEaten = !!checkedMeals[mealIdx];

        let itemsHtml = '';
        if (items.length > 0) {
          itemsHtml = '<div class="meal-items-list">' + items.filter(it => it.food).map(it => {
            let itCal = 0;
            if (it.per100 && it.amount) {
              itCal = Math.round(it.per100.cal * it.amount / 100);
            } else if (it.cal) {
              itCal = it.cal;
            }
            return `<div class="meal-item-line">
              <span class="meal-item-food">${escapeHtml(it.food)}</span>
              ${it.amount ? `<span class="meal-item-amount">${it.amount}g</span>` : ''}
              ${itCal ? `<span class="meal-item-cal">${itCal} kcal</span>` : ''}
            </div>`;
          }).join('') + '</div>';
        }

        const detailHtml = meal.detail ? `<div class="meal-detail">${escapeHtml(meal.detail)}</div>` : '';

        return `
        <div class="meal-card ${isEaten ? 'meal-eaten' : ''}" data-meal-index="${mealIdx}">
          <div class="meal-header-row">
            <label class="meal-check-label">
              <input type="checkbox" class="meal-check" data-meal-index="${mealIdx}" ${isEaten ? 'checked' : ''}>
              <span class="meal-check-icon">${isEaten ? '✓' : ''}</span>
            </label>
            <div class="meal-time">${escapeHtml(meal.time || '')}</div>
            ${hasMacros ? `<div class="meal-macros-badge">${meal.calories || 0} kcal</div>` : ''}
          </div>
          <div class="meal-name">${escapeHtml(meal.name || '')}</div>
          ${hasMacros ? `<div class="meal-macros-detail">🥩 ${meal.protein || 0}g · 🍚 ${meal.carbs || 0}g · 🧈 ${meal.fat || 0}g</div>` : ''}
          ${itemsHtml}
          ${detailHtml}
        </div>`;
      }).join('');
    }

    if (nutritionData.notes) {
      html += `<div class="exercise-notes" style="margin-top: 0.75rem;">${escapeHtml(nutritionData.notes)}</div>`;
    }

    nutritionContent.innerHTML = html;

    // Bind meal checkboxes
    nutritionContent.querySelectorAll('.meal-check').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.mealIndex);
        const card = e.target.closest('.meal-card');
        const icon = e.target.nextElementSibling;

        if (!todayNutritionLog.meals) todayNutritionLog.meals = [];
        todayNutritionLog.meals[idx] = e.target.checked;

        if (e.target.checked) {
          card.classList.add('meal-eaten');
          icon.textContent = '✓';
        } else {
          card.classList.remove('meal-eaten');
          icon.textContent = '';
        }

        nutritionDirty = true;
        saveNutritionLogDebounced();
        // Re-render to update the progress ring
        renderNutrition();
      });
    });
  }

  // ===== Supplements =====
  function renderSupplements() {
    const checkedSupps = todayNutritionLog.supplements || [];
    const totalSupps = nutritionData.supplements.length;
    const takenCount = checkedSupps.filter(Boolean).length;

    let headerHtml = `<div class="supplement-progress-badge">${takenCount}/${totalSupps} užito</div>`;

    supplementsContent.innerHTML = headerHtml + nutritionData.supplements.map((sup, i) => {
      const isTaken = !!checkedSupps[i];
      return `
      <div class="supplement-item ${isTaken ? 'supplement-taken' : ''}" data-supp-index="${i}">
        <label class="supp-check-label">
          <input type="checkbox" class="supp-check" data-supp-index="${i}" ${isTaken ? 'checked' : ''}>
          <span class="supp-check-icon">${isTaken ? '✓' : ''}</span>
        </label>
        <span class="supplement-icon">${sup.icon || '💊'}</span>
        <div class="supplement-info">
          <h4>${escapeHtml(sup.name)}</h4>
          <p>${escapeHtml(sup.dosage || '')}${sup.timing ? ' — ' + escapeHtml(sup.timing) : ''}</p>
        </div>
      </div>`;
    }).join('');

    // Bind supplement checkboxes
    supplementsContent.querySelectorAll('.supp-check').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.suppIndex);
        const card = e.target.closest('.supplement-item');
        const icon = e.target.nextElementSibling;

        if (!todayNutritionLog.supplements) todayNutritionLog.supplements = [];
        todayNutritionLog.supplements[idx] = e.target.checked;

        if (e.target.checked) {
          card.classList.add('supplement-taken');
          icon.textContent = '✓';
        } else {
          card.classList.remove('supplement-taken');
          icon.textContent = '';
        }

        nutritionDirty = true;
        saveNutritionLogDebounced();
        // Update the badge
        renderSupplements();
      });
    });
  }

  // ===== Auto-save nutrition log (debounced) =====
  let nutritionSaveTimer = null;
  function saveNutritionLogDebounced() {
    if (nutritionSaveTimer) clearTimeout(nutritionSaveTimer);
    nutritionSaveTimer = setTimeout(saveNutritionLogNow, 1500);
  }

  async function saveNutritionLogNow() {
    if (!nutritionDirty) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      await api('zona-data', { action: 'save-nutrition-log', date: today, log: todayNutritionLog }, sessionToken);
      nutritionDirty = false;
    } catch (err) {
      console.error('Nutrition log save error:', err);
    }
  }

  // ===== Progress tracking =====
  let pendingPhotoBase64 = null;

  toggleProgressBtn.addEventListener('click', () => {
    const showing = !progressFormWrap.hidden;
    progressFormWrap.hidden = showing;
    toggleProgressBtn.textContent = showing ? '+ Zaznamenat' : '✕ Zavřít';
  });

  // Photo upload handling
  const photoInput = document.getElementById('progress-photo');
  const photoTrigger = document.getElementById('photo-upload-trigger');
  const photoPreview = document.getElementById('photo-preview');
  const photoPreviewImg = document.getElementById('photo-preview-img');
  const photoRemove = document.getElementById('photo-remove');

  photoTrigger.addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      pendingPhotoBase64 = await compressImage(file, 800, 0.7);
      photoPreviewImg.src = pendingPhotoBase64;
      photoPreview.classList.add('visible');
      photoTrigger.style.display = 'none';
    } catch (err) {
      console.error('Image compression failed:', err);
      alert('Nepodařilo se zpracovat fotku');
    }
  });

  photoRemove.addEventListener('click', () => {
    pendingPhotoBase64 = null;
    photoInput.value = '';
    photoPreview.classList.remove('visible');
    photoTrigger.style.display = '';
  });

  function compressImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;

          if (w > maxSize || h > maxSize) {
            if (w > h) {
              h = Math.round((h * maxSize) / w);
              w = maxSize;
            } else {
              w = Math.round((w * maxSize) / h);
              h = maxSize;
            }
          }

          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  progressForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const weight = document.getElementById('progress-weight').value;
    const notes = document.getElementById('progress-notes').value.trim();

    const btn = document.getElementById('progress-submit-btn');
    btn.disabled = true;
    btn.textContent = pendingPhotoBase64 ? 'Nahrávám fotku...' : 'Ukládám...';

    try {
      const payload = { action: 'add-progress', weight, notes };
      if (pendingPhotoBase64) {
        payload.photo = pendingPhotoBase64;
      }

      await api('zona-data', payload, sessionToken);

      progressData.push({
        weight: parseFloat(weight),
        notes,
        photo: pendingPhotoBase64 || null,
        createdAt: new Date().toISOString(),
      });

      progressForm.reset();
      pendingPhotoBase64 = null;
      photoPreview.classList.remove('visible');
      photoTrigger.style.display = '';
      progressFormWrap.hidden = true;
      toggleProgressBtn.textContent = '+ Zaznamenat';
      renderProgress();
    } catch (err) {
      alert('Chyba: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Uložit záznam';
    }
  });

  // ===== Stats overview =====
  function renderStats() {
    const statsEl = document.getElementById('stats-overview');
    if (!statsEl) return;

    const entries = [...progressData].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const hasProgress = entries.length > 0;
    const hasCheckins = checkinData.length > 0;

    if (!hasProgress && !hasCheckins) {
      statsEl.hidden = true;
      return;
    }

    statsEl.hidden = false;

    // Current weight
    if (hasProgress) {
      const latest = entries[entries.length - 1];
      document.getElementById('stat-weight-value').textContent = latest.weight + ' kg';

      // Total change
      if (entries.length > 1) {
        const first = entries[0];
        const diff = latest.weight - first.weight;
        const sign = diff > 0 ? '+' : '';
        const changeEl = document.getElementById('stat-change-value');
        changeEl.textContent = sign + diff.toFixed(1) + ' kg';
        changeEl.className = 'stat-value ' + (diff < 0 ? 'stat-down' : diff > 0 ? 'stat-up' : '');
        document.getElementById('stat-change').querySelector('.stat-icon').textContent = diff <= 0 ? '📉' : '📈';
      }
    }

    // Weekly streak (consecutive weeks with at least one check-in)
    if (hasCheckins) {
      const sorted = [...checkinData].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      let streak = 0;
      const now = new Date();
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;

      // Count backwards from current week
      for (let w = 0; w < 52; w++) {
        const weekStart = new Date(now.getTime() - (w + 1) * msPerWeek);
        const weekEnd = new Date(now.getTime() - w * msPerWeek);
        const hasEntry = sorted.some(c => {
          const d = new Date(c.createdAt);
          return d >= weekStart && d < weekEnd;
        });
        if (hasEntry) streak++;
        else if (w > 0) break; // Allow current week to be empty
      }
      document.getElementById('stat-streak-value').textContent = streak;
    }

    // Total check-ins
    document.getElementById('stat-checkins-value').textContent = checkinData.length;

    // Badges
    renderBadges(entries);
  }

  function renderBadges(entries) {
    const row = document.getElementById('badges-row');
    if (!row) return;

    const badges = [];
    const totalCheckins = checkinData.length;
    const totalProgress = entries.length;

    // Progress milestones
    if (totalProgress >= 1) badges.push({ icon: '⚖️', label: 'První záznam', active: true });
    if (totalProgress >= 5) badges.push({ icon: '📊', label: '5 záznamů', active: true });
    if (totalProgress >= 10) badges.push({ icon: '🏆', label: '10 záznamů', active: true });
    if (totalProgress >= 25) badges.push({ icon: '💎', label: '25 záznamů', active: true });

    // Check-in milestones
    if (totalCheckins >= 1) badges.push({ icon: '✅', label: 'První check-in', active: true });
    if (totalCheckins >= 4) badges.push({ icon: '🔥', label: '4 týdny', active: true });
    if (totalCheckins >= 12) badges.push({ icon: '⭐', label: '3 měsíce', active: true });

    // Weight change milestones
    if (entries.length >= 2) {
      const diff = Math.abs(entries[entries.length - 1].weight - entries[0].weight);
      if (diff >= 2) badges.push({ icon: '💪', label: '-2 kg', active: true });
      if (diff >= 5) badges.push({ icon: '🎯', label: '-5 kg', active: true });
      if (diff >= 10) badges.push({ icon: '👑', label: '-10 kg', active: true });
    }

    // Next unlockable badge
    if (totalProgress < 5 && totalProgress >= 1) {
      badges.push({ icon: '📊', label: '5 záznamů', active: false, progress: totalProgress + '/5' });
    } else if (totalProgress < 10 && totalProgress >= 5) {
      badges.push({ icon: '🏆', label: '10 záznamů', active: false, progress: totalProgress + '/10' });
    }

    if (totalCheckins < 4 && totalCheckins >= 1) {
      badges.push({ icon: '🔥', label: '4 týdny', active: false, progress: totalCheckins + '/4' });
    }

    if (badges.length === 0) {
      row.hidden = true;
      return;
    }

    row.hidden = false;
    row.innerHTML = badges.map(b =>
      `<div class="badge-item${b.active ? ' earned' : ' locked'}">
        <span class="badge-icon">${b.icon}</span>
        <span class="badge-label">${b.label}</span>
        ${b.progress ? `<span class="badge-progress">${b.progress}</span>` : ''}
      </div>`
    ).join('');
  }

  // ===== SVG line chart =====
  function renderProgress() {
    const hasPhotos = progressData.some(e => e.photo);
    comparePhotosBtn.hidden = !hasPhotos;

    if (!progressData || progressData.length === 0) {
      progressChart.innerHTML = `
        <div class="chart-empty">
          <p>📊 Zatím žádné záznamy. Klikni na "Zaznamenat" a začni sledovat svůj progres!</p>
        </div>`;
      progressHistory.innerHTML = '';
      return;
    }

    const entries = [...progressData].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const latest = entries[entries.length - 1];
    const first = entries[0];
    const diff = latest.weight - first.weight;
    const diffSign = diff > 0 ? '+' : '';
    const diffClass = diff < 0 ? 'down' : diff > 0 ? 'up' : 'neutral';

    // Chart header
    let headerHtml = `<div class="chart-header">
      <div class="chart-current">${latest.weight}<small>kg</small></div>
      ${entries.length > 1 ? `<span class="chart-change ${diffClass}">${diffSign}${diff.toFixed(1)} kg</span>` : ''}
    </div>`;

    // SVG line chart
    const chartEntries = entries.slice(-15);
    const W = 600, H = 180, PAD_X = 10, PAD_Y = 20, PAD_BOTTOM = 30;
    const plotH = H - PAD_Y - PAD_BOTTOM;
    const plotW = W - PAD_X * 2;
    const weights = chartEntries.map(e => e.weight);
    const minW = Math.min(...weights) - 0.5;
    const maxW = Math.max(...weights) + 0.5;
    const range = maxW - minW || 1;

    const points = chartEntries.map((e, i) => {
      const x = PAD_X + (chartEntries.length === 1 ? plotW / 2 : (i / (chartEntries.length - 1)) * plotW);
      const y = PAD_Y + plotH - ((e.weight - minW) / range) * plotH;
      return { x, y, entry: e };
    });

    const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    const areaPath = linePath + ` L${points[points.length - 1].x.toFixed(1)},${H - PAD_BOTTOM} L${points[0].x.toFixed(1)},${H - PAD_BOTTOM} Z`;

    let svgContent = `
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02"/>
        </linearGradient>
      </defs>`;

    // Grid lines
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = PAD_Y + (i / gridLines) * plotH;
      const val = (maxW - (i / gridLines) * range).toFixed(1);
      svgContent += `<line x1="${PAD_X}" y1="${y}" x2="${W - PAD_X}" y2="${y}" stroke="var(--border)" stroke-width="0.5"/>`;
      svgContent += `<text x="${W - PAD_X + 4}" y="${y + 4}" fill="var(--text-faint)" font-size="10" font-family="Inter,sans-serif">${val}</text>`;
    }

    // Area fill + line
    svgContent += `<path d="${areaPath}" fill="url(#chartGrad)"/>`;
    svgContent += `<path d="${linePath}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

    // Data points + date labels
    points.forEach((p, i) => {
      const isLatest = i === points.length - 1;
      const r = isLatest ? 5 : 3.5;
      svgContent += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${isLatest ? 'var(--accent)' : 'var(--bg-card)'}" stroke="var(--accent)" stroke-width="2"/>`;

      // Date label (show every other + always last)
      if (i % 2 === 0 || isLatest || chartEntries.length <= 6) {
        const d = new Date(p.entry.createdAt);
        const label = d.getDate() + '.' + (d.getMonth() + 1) + '.';
        svgContent += `<text x="${p.x.toFixed(1)}" y="${H - 8}" fill="var(--text-faint)" font-size="10" font-family="Inter,sans-serif" text-anchor="middle">${label}</text>`;
      }
    });

    progressChart.innerHTML = headerHtml + `<svg class="weight-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${svgContent}</svg>`;

    // History
    const historyEntries = [...entries].reverse().slice(0, 5);
    let historyHtml = '';

    historyEntries.forEach((entry, i) => {
      const date = new Date(entry.createdAt);
      const dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });

      let diffHtml = '';
      const idx = entries.indexOf(entry);
      if (idx > 0) {
        const prevWeight = entries[idx - 1].weight;
        const d = entry.weight - prevWeight;
        if (d !== 0) {
          const cls = d < 0 ? 'down' : 'up';
          const sign = d > 0 ? '+' : '';
          diffHtml = `<span class="progress-entry-diff ${cls}">${sign}${d.toFixed(1)}</span>`;
        }
      }

      historyHtml += `
        <div class="progress-entry" style="animation: fadeIn 0.3s ease ${i * 0.05}s both;">
          ${entry.photo ? `<img src="${entry.photo}" class="progress-entry-photo" data-photo-index="${i}" alt="Progress foto">` : ''}
          <div class="progress-entry-weight">${entry.weight}<small>kg</small></div>
          <div class="progress-entry-info">
            <div class="progress-entry-date">${dateStr}</div>
            ${entry.notes ? `<div class="progress-entry-notes">${escapeHtml(entry.notes)}</div>` : ''}
          </div>
          ${diffHtml}
        </div>`;
    });

    progressHistory.innerHTML = historyHtml;

    progressHistory.querySelectorAll('.progress-entry-photo').forEach(img => {
      img.addEventListener('click', () => {
        openPhotoModal(img.src, img.closest('.progress-entry').querySelector('.progress-entry-date')?.textContent || '');
      });
    });
  }

  // ===== Check-in history =====
  function renderCheckinHistory() {
    const titleEl = document.getElementById('checkin-history-title');
    const listEl = document.getElementById('checkin-history-list');
    if (!titleEl || !listEl) return;

    if (!checkinData || checkinData.length === 0) {
      titleEl.hidden = true;
      listEl.innerHTML = '';
      return;
    }

    titleEl.hidden = false;
    const sorted = [...checkinData].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

    const energyLabels = { low: '😴 Nízká', ok: '😐 OK', good: '💪 Dobrá', great: '🔥 Skvělá' };

    listEl.innerHTML = sorted.map((ci, i) => {
      const date = new Date(ci.createdAt);
      const dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
      const stars = '★'.repeat(ci.trainingRating || 0) + '☆'.repeat(5 - (ci.trainingRating || 0));

      return `
        <div class="checkin-history-entry" style="animation: fadeIn 0.3s ease ${i * 0.05}s both;">
          <div class="ci-date">${dateStr}</div>
          <div class="ci-details">
            <div class="ci-row">
              <span class="ci-stars">${stars}</span>
              <span class="ci-diet">${ci.dietAdherence || 0}% jídelníček</span>
            </div>
            <div class="ci-row">
              ${ci.weight ? `<span class="ci-weight">${ci.weight} kg</span>` : ''}
              ${ci.energy ? `<span class="ci-energy">${energyLabels[ci.energy] || ci.energy}</span>` : ''}
            </div>
            ${ci.notes ? `<div class="ci-notes">${escapeHtml(ci.notes)}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  // ===== Photo compare modal =====
  let compareSlot = null; // 'before' or 'after'

  comparePhotosBtn.addEventListener('click', openCompareModal);

  function openCompareModal() {
    const modal = document.getElementById('compare-modal');
    const picker = document.getElementById('compare-picker');

    // Reset slots
    document.getElementById('compare-before-photo').innerHTML = '<span class="compare-slot-empty">Vyber fotku</span>';
    document.getElementById('compare-after-photo').innerHTML = '<span class="compare-slot-empty">Vyber fotku</span>';
    document.getElementById('compare-before-info').textContent = '';
    document.getElementById('compare-after-info').textContent = '';

    // Build photo picker
    const photosWithDates = progressData
      .filter(e => e.photo)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    picker.innerHTML = photosWithDates.map((entry, i) => {
      const date = new Date(entry.createdAt);
      const dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });
      return `
        <div class="compare-picker-item" data-picker-index="${i}">
          <img src="${entry.photo}" alt="Progress ${dateStr}">
          <span class="compare-picker-date">${dateStr}</span>
          <span class="compare-picker-weight">${entry.weight} kg</span>
        </div>`;
    }).join('');

    // Click handlers
    picker.querySelectorAll('.compare-picker-item').forEach((item, i) => {
      item.addEventListener('click', () => {
        const entry = photosWithDates[i];
        const date = new Date(entry.createdAt);
        const dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });

        if (!compareSlot || compareSlot === 'after') {
          compareSlot = 'before';
          document.getElementById('compare-before-photo').innerHTML = `<img src="${entry.photo}" alt="Před">`;
          document.getElementById('compare-before-info').textContent = `${dateStr} · ${entry.weight} kg`;
        } else {
          compareSlot = 'after';
          document.getElementById('compare-after-photo').innerHTML = `<img src="${entry.photo}" alt="Po">`;
          document.getElementById('compare-after-info').textContent = `${dateStr} · ${entry.weight} kg`;
        }
      });
    });

    compareSlot = null;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  document.getElementById('compare-modal-close').addEventListener('click', () => {
    document.getElementById('compare-modal').hidden = true;
    document.body.style.overflow = '';
  });
  document.getElementById('compare-modal-backdrop').addEventListener('click', () => {
    document.getElementById('compare-modal').hidden = true;
    document.body.style.overflow = '';
  });

  // ===== Chat =====
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');

  function renderChat() {
    if (!messagesData || messagesData.length === 0) {
      chatMessages.innerHTML = '<div class="chat-empty">Zatím žádné zprávy. Napiš mi!</div>';
      return;
    }

    chatMessages.innerHTML = messagesData.map(msg => {
      const isClient = msg.from === 'client';
      const date = new Date(msg.createdAt);
      const timeStr = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
      const dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' });

      return `
        <div class="chat-bubble ${isClient ? 'chat-bubble-client' : 'chat-bubble-admin'}">
          <div class="chat-bubble-text">${escapeHtml(msg.text)}</div>
          <div class="chat-bubble-time">${dateStr} ${timeStr}</div>
        </div>`;
    }).join('');

    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  chatSendBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatSendBtn.disabled = true;
    chatInput.disabled = true;

    try {
      const data = await api('zona-data', { action: 'send-message', text }, sessionToken);
      messagesData = data.messages || [];
      chatInput.value = '';
      renderChat();
    } catch (err) {
      alert('Chyba: ' + err.message);
    } finally {
      chatSendBtn.disabled = false;
      chatInput.disabled = false;
      chatInput.focus();
    }
  }

  // ===== Photo modal =====
  const photoModal = document.getElementById('photo-modal');
  const photoModalImg = document.getElementById('photo-modal-img');
  const photoModalInfo = document.getElementById('photo-modal-info');

  function openPhotoModal(src, info) {
    photoModalImg.src = src;
    photoModalInfo.textContent = info;
    photoModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closePhotoModal() {
    photoModal.hidden = true;
    document.body.style.overflow = '';
  }

  document.getElementById('photo-modal-close').addEventListener('click', closePhotoModal);
  document.getElementById('photo-modal-backdrop').addEventListener('click', closePhotoModal);

  // ===== Video modal =====
  function openVideo(url) {
    const videoId = extractYouTubeId(url);
    if (videoId) {
      videoContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    } else {
      videoContainer.innerHTML = `<video src="${escapeAttr(url)}" controls autoplay style="width:100%; height:100%; position:absolute; inset:0; object-fit:contain;"></video>`;
    }
    videoModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeVideo() {
    videoContainer.innerHTML = '';
    videoModal.hidden = true;
    document.body.style.overflow = '';
  }

  modalClose.addEventListener('click', closeVideo);
  document.querySelector('#video-modal .modal-backdrop').addEventListener('click', closeVideo);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeVideo();
      closePhotoModal();
      document.getElementById('compare-modal').hidden = true;
      document.body.style.overflow = '';
    }
  });

  // ===== Helpers =====
  function getTodayKey() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  }

  function extractYouTubeId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
  }

  function vocative(name) {
    if (!name) return name;
    const n = name.trim();
    const lower = n.toLowerCase();

    const exceptions = {
      'jan': 'Jane', 'honza': 'Honzo', 'petr': 'Petře', 'pavel': 'Pavle',
      'tomáš': 'Tomáši', 'tomas': 'Tomáši', 'lukáš': 'Lukáši', 'lukas': 'Lukáši',
      'martin': 'Martine', 'adam': 'Adame', 'david': 'Davide', 'jakub': 'Jakube',
      'ondřej': 'Ondřeji', 'ondrej': 'Ondřeji', 'marek': 'Marku', 'michal': 'Michale',
      'jiří': 'Jiří', 'jiri': 'Jiří', 'filip': 'Filipe', 'daniel': 'Danieli',
      'matěj': 'Matěji', 'matej': 'Matěji', 'václav': 'Václave', 'vaclav': 'Václave',
      'radek': 'Radku', 'zdeněk': 'Zdeňku', 'zdenek': 'Zdeňku', 'karel': 'Karle',
      'josef': 'Josefe', 'milan': 'Milane', 'roman': 'Romane', 'robert': 'Roberte',
      'aleš': 'Aleši', 'ales': 'Aleši', 'dominik': 'Dominiku', 'vojtěch': 'Vojtěchu',
      'vojtech': 'Vojtěchu', 'štěpán': 'Štěpáne', 'stepan': 'Štěpáne',
      'jana': 'Jano', 'petra': 'Petro', 'eva': 'Evo', 'lucie': 'Lucie',
      'anna': 'Anno', 'marie': 'Marie', 'tereza': 'Terezo', 'lenka': 'Lenko',
      'martina': 'Martino', 'kateřina': 'Kateřino', 'katerina': 'Kateřino',
      'monika': 'Moniko', 'veronika': 'Veroniko', 'michaela': 'Michaelo',
      'klára': 'Kláro', 'klara': 'Kláro', 'nikola': 'Nikolo', 'barbora': 'Barboro',
      'simona': 'Simono', 'andrea': 'Andreo', 'denisa': 'Deniso', 'markéta': 'Markéto',
    };

    if (exceptions[lower]) return exceptions[lower];

    if (lower.endsWith('a')) return n.slice(0, -1) + 'o';
    if (lower.endsWith('ka')) return n.slice(0, -2) + 'ko';
    if (lower.endsWith('ek')) return n.slice(0, -2) + 'ku';
    if (lower.endsWith('eš') || lower.endsWith('áš')) return n + 'i';
    if (lower.endsWith('el')) return n.slice(0, -2) + 'le';
    if (lower.endsWith('ie') || lower.endsWith('rie')) return n;

    return n + 'e';
  }

  function formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  // ===== Check-in =====
  (function initCheckin() {
    const stars = document.querySelectorAll('#checkin-stars .star-btn');
    const ratingInput = document.getElementById('checkin-training-rating');
    const dietRange = document.getElementById('checkin-diet');
    const dietValue = document.getElementById('checkin-diet-value');
    const pills = document.querySelectorAll('#checkin-energy .checkin-pill');
    const energyInput = document.getElementById('checkin-energy-value');
    const checkinForm = document.getElementById('checkin-form');
    const checkinSubmitBtn = document.getElementById('checkin-submit-btn');
    const checkinPhotoTrigger = document.getElementById('checkin-photo-trigger');
    const checkinPhotoInput = document.getElementById('checkin-photo');
    const checkinPhotoPreview = document.getElementById('checkin-photo-preview');
    const checkinPhotoPreviewImg = document.getElementById('checkin-photo-preview-img');
    const checkinPhotoRemove = document.getElementById('checkin-photo-remove');

    if (!stars.length) return;

    // Stars
    stars.forEach(star => {
      star.addEventListener('click', () => {
        const val = parseInt(star.dataset.value);
        ratingInput.value = val;
        stars.forEach(s => {
          s.classList.toggle('active', parseInt(s.dataset.value) <= val);
        });
      });
    });

    // Diet range
    if (dietRange) {
      dietRange.addEventListener('input', () => {
        dietValue.textContent = dietRange.value + ' %';
      });
    }

    // Energy pills
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        energyInput.value = pill.dataset.value;
      });
    });

    // Photo upload
    if (checkinPhotoTrigger && checkinPhotoInput) {
      checkinPhotoTrigger.addEventListener('click', () => checkinPhotoInput.click());
      checkinPhotoInput.addEventListener('change', () => {
        const file = checkinPhotoInput.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = e => {
            checkinPhotoPreviewImg.src = e.target.result;
            checkinPhotoPreview.classList.add('visible');
          };
          reader.readAsDataURL(file);
        }
      });
      if (checkinPhotoRemove) {
        checkinPhotoRemove.addEventListener('click', () => {
          checkinPhotoInput.value = '';
          checkinPhotoPreview.classList.remove('visible');
          checkinPhotoPreviewImg.src = '';
        });
      }
    }

    // Submit
    if (checkinForm) {
      checkinForm.addEventListener('submit', async e => {
        e.preventDefault();
        checkinSubmitBtn.disabled = true;
        checkinSubmitBtn.textContent = 'Odesílám...';

        const formData = {
          action: 'submit-checkin',
          trainingRating: parseInt(ratingInput.value) || 0,
          dietAdherence: parseInt(dietRange.value) || 0,
          weight: parseFloat(document.getElementById('checkin-weight').value) || null,
          energy: energyInput.value || null,
          notes: document.getElementById('checkin-notes').value.trim() || null,
        };

        // Photo as base64
        if (checkinPhotoInput.files[0]) {
          formData.photo = checkinPhotoPreviewImg.src;
        }

        try {
          const result = await api('zona-data', formData, sessionToken);
          if (result.entries) checkinData = result.entries;
          else checkinData.push({ ...formData, createdAt: new Date().toISOString() });
          renderCheckinHistory();
          renderStats();
          checkinForm.reset();
          stars.forEach(s => s.classList.remove('active'));
          pills.forEach(p => p.classList.remove('active'));
          ratingInput.value = '';
          energyInput.value = '';
          dietValue.textContent = '75 %';
          if (checkinPhotoPreview) checkinPhotoPreview.classList.remove('visible');

          checkinSubmitBtn.textContent = '✅ Odesláno!';
          setTimeout(() => {
            checkinSubmitBtn.textContent = 'Odeslat check-in ✓';
            checkinSubmitBtn.disabled = false;
          }, 2000);
        } catch (err) {
          alert('Chyba: ' + err.message);
          checkinSubmitBtn.textContent = 'Odeslat check-in ✓';
          checkinSubmitBtn.disabled = false;
        }
      });
    }
  })();

  // ===== Collapsible sections =====
  (function initCollapsible() {
    const STORAGE_KEY = 'zona_collapsed';
    let collapsed = null;
    try { collapsed = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(e) {}
    const isFirstVisit = collapsed === null;
    if (isFirstVisit) collapsed = {};

    document.querySelectorAll('.dash-section').forEach(section => {
      const id = section.id;
      if (!id) return;

      // First visit: collapse everything so user discovers the toggle
      if (isFirstVisit || collapsed[id]) section.classList.add('collapsed');

      const header = section.querySelector('.section-header');
      if (!header) return;

      header.addEventListener('click', (e) => {
        // Don't collapse when clicking buttons inside header
        if (e.target.closest('button, a, .section-header-actions')) return;

        section.classList.toggle('collapsed');
        collapsed[id] = section.classList.contains('collapsed');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
      });
    });
  })();

  // ===== Range slider fill =====
  (function initRangeFill() {
    function updateRangeFill(range) {
      const pct = ((range.value - range.min) / (range.max - range.min)) * 100;
      range.style.background = 'linear-gradient(to right, var(--accent) 0%, var(--accent) ' + pct + '%, var(--bg-elevated) ' + pct + '%, var(--bg-elevated) 100%)';
    }
    document.querySelectorAll('.checkin-range').forEach(range => {
      updateRangeFill(range);
      range.addEventListener('input', () => updateRangeFill(range));
    });
  })();

  // ===== CUSTOMIZE SECTIONS =====
  (function initCustomize() {
    var customizeBtn = document.getElementById('customize-btn');
    var customizePanel = document.getElementById('customize-panel');
    var customizeBackdrop = document.getElementById('customize-backdrop');
    var customizeClose = document.getElementById('customize-close');
    var customizeReset = document.getElementById('customize-reset');
    var toggles = document.querySelectorAll('#customize-toggles input[data-section]');
    var STORAGE_KEY = 'zona_hidden_sections';

    function getHiddenSections() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch(e) { return []; }
    }

    function saveHiddenSections(arr) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    }

    function applyVisibility() {
      var hidden = getHiddenSections();
      toggles.forEach(function(toggle) {
        var sectionId = toggle.getAttribute('data-section');
        var el = document.getElementById(sectionId);
        if (!el) return;
        var isHidden = hidden.indexOf(sectionId) !== -1;
        toggle.checked = !isHidden;
        if (isHidden) {
          el.classList.add('user-hidden');
        } else {
          el.classList.remove('user-hidden');
        }
      });
    }

    function openPanel() {
      if (customizePanel) customizePanel.hidden = false;
    }

    function closePanel() {
      if (customizePanel) customizePanel.hidden = true;
    }

    if (customizeBtn) customizeBtn.addEventListener('click', openPanel);
    if (customizeBackdrop) customizeBackdrop.addEventListener('click', closePanel);
    if (customizeClose) customizeClose.addEventListener('click', closePanel);

    toggles.forEach(function(toggle) {
      toggle.addEventListener('change', function() {
        var sectionId = this.getAttribute('data-section');
        var hidden = getHiddenSections();
        if (this.checked) {
          hidden = hidden.filter(function(id) { return id !== sectionId; });
        } else {
          if (hidden.indexOf(sectionId) === -1) hidden.push(sectionId);
        }
        saveHiddenSections(hidden);
        applyVisibility();
      });
    });

    if (customizeReset) {
      customizeReset.addEventListener('click', function() {
        localStorage.removeItem(STORAGE_KEY);
        applyVisibility();
      });
    }

    // Apply on load
    applyVisibility();
  })();

  // ===== PARSE REST TIME STRING =====
  function parseRestSeconds(str) {
    if (!str) return 0;
    str = str.trim().toLowerCase();
    // "90s", "90 s", "90", "1:30", "1m30s", "2m", "2 min"
    var match;
    if ((match = str.match(/^(\d+)\s*(?:s|sec|sekund)?$/))) return parseInt(match[1]);
    if ((match = str.match(/^(\d+)\s*(?:m|min)/))) {
      var mins = parseInt(match[1]);
      var secMatch = str.match(/(\d+)\s*(?:s|sec|sekund)/);
      return mins * 60 + (secMatch ? parseInt(secMatch[1]) : 0);
    }
    if ((match = str.match(/^(\d+):(\d+)$/))) return parseInt(match[1]) * 60 + parseInt(match[2]);
    var num = parseInt(str);
    return isNaN(num) ? 0 : (num > 10 ? num : num * 60); // >10 assume seconds, else minutes
  }

  // ===== REST TIMER =====
  (function initRestTimer() {
    var fab = document.getElementById('rest-timer-fab');
    var fabIcon = document.getElementById('rest-timer-fab-icon');
    var fabCountdown = document.getElementById('rest-timer-fab-countdown');
    var panel = document.getElementById('rest-timer-panel');
    var closeBtn = document.getElementById('rest-timer-panel-close');
    var display = document.getElementById('rest-timer-display');
    var ringProgress = document.getElementById('rest-timer-ring-progress');
    var playBtn = document.getElementById('rest-timer-play');
    var resetBtn = document.getElementById('rest-timer-reset');
    var presetBtns = document.querySelectorAll('.rest-timer-preset');

    if (!fab || !panel) return;

    var CIRCUMFERENCE = 2 * Math.PI * 50; // r=50
    var timerInterval = null;
    var totalSeconds = 0;
    var remainingMs = 0;
    var isRunning = false;
    var panelOpen = false;
    var audioCtx = null;

    function formatTime(ms) {
      var secs = Math.ceil(ms / 1000);
      if (secs < 0) secs = 0;
      if (secs >= 60) {
        var m = Math.floor(secs / 60);
        var s = secs % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
      }
      return secs + 's';
    }

    function updateDisplay() {
      var secs = Math.ceil(remainingMs / 1000);
      if (secs < 0) secs = 0;
      display.textContent = formatTime(remainingMs);

      // Ring progress
      var fraction = totalSeconds > 0 ? (1 - remainingMs / (totalSeconds * 1000)) : 0;
      var offset = CIRCUMFERENCE * fraction;
      ringProgress.setAttribute('stroke-dasharray', CIRCUMFERENCE.toFixed(2));
      ringProgress.setAttribute('stroke-dashoffset', (-offset).toFixed(2));

      // FAB countdown
      if (isRunning || remainingMs > 0) {
        fabIcon.hidden = true;
        fabCountdown.hidden = false;
        fabCountdown.textContent = formatTime(remainingMs);
        fab.classList.add('active');
      } else {
        fabIcon.hidden = false;
        fabCountdown.hidden = true;
        fab.classList.remove('active');
      }

      playBtn.textContent = isRunning ? '⏸' : '▶';
    }

    function startTimer() {
      if (remainingMs <= 0 || isRunning) return;
      isRunning = true;
      var lastTick = Date.now();
      timerInterval = setInterval(function() {
        var now = Date.now();
        remainingMs -= (now - lastTick);
        lastTick = now;
        if (remainingMs <= 0) {
          remainingMs = 0;
          isRunning = false;
          clearInterval(timerInterval);
          timerInterval = null;
          onTimerComplete();
        }
        updateDisplay();
      }, 100);
      updateDisplay();
    }

    function pauseTimer() {
      isRunning = false;
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      updateDisplay();
    }

    function resetTimer() {
      pauseTimer();
      remainingMs = totalSeconds * 1000;
      updateDisplay();
    }

    function setTimer(seconds) {
      pauseTimer();
      totalSeconds = seconds;
      remainingMs = seconds * 1000;
      updateDisplay();
      // Highlight active preset
      presetBtns.forEach(function(btn) {
        btn.classList.toggle('active', parseInt(btn.dataset.seconds) === seconds);
      });
      startTimer();
    }

    function onTimerComplete() {
      // Vibrate
      if (navigator.vibrate) {
        try { navigator.vibrate([200, 100, 200]); } catch(e) {}
      }
      // Beep sound (Web Audio API)
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.value = 0.3;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.stop(audioCtx.currentTime + 0.5);
        // Second beep
        setTimeout(function() {
          var osc2 = audioCtx.createOscillator();
          var gain2 = audioCtx.createGain();
          osc2.connect(gain2);
          gain2.connect(audioCtx.destination);
          osc2.frequency.value = 1100;
          osc2.type = 'sine';
          gain2.gain.value = 0.3;
          osc2.start();
          gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
          osc2.stop(audioCtx.currentTime + 0.5);
        }, 300);
      } catch(e) {}
      updateDisplay();
    }

    // Toggle panel
    fab.addEventListener('click', function() {
      panelOpen = !panelOpen;
      panel.hidden = !panelOpen;
    });

    closeBtn.addEventListener('click', function() {
      panelOpen = false;
      panel.hidden = true;
    });

    // Play/Pause
    playBtn.addEventListener('click', function() {
      if (isRunning) { pauseTimer(); }
      else if (remainingMs > 0) { startTimer(); }
      else if (totalSeconds > 0) { remainingMs = totalSeconds * 1000; startTimer(); }
    });

    // Reset
    resetBtn.addEventListener('click', resetTimer);

    // Preset buttons
    presetBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        setTimer(parseInt(btn.dataset.seconds));
      });
    });

    // Close panel when clicking outside
    document.addEventListener('click', function(e) {
      if (panelOpen && !panel.contains(e.target) && !fab.contains(e.target)) {
        panelOpen = false;
        panel.hidden = true;
      }
    });

    // Expose globally so exercise cards can trigger it
    window.startRestTimer = function(seconds) {
      panelOpen = true;
      panel.hidden = false;
      setTimer(seconds);
    };

    updateDisplay();
  })();

  // ===== PROGRESS GALLERY =====
  (function initProgressGallery() {
    var toggle = document.getElementById('progress-view-toggle');
    var chartEl = document.getElementById('progress-chart');
    var historyEl = document.getElementById('progress-history');
    var galleryEl = document.getElementById('progress-gallery');
    var btns = toggle ? toggle.querySelectorAll('.progress-view-btn') : [];

    if (!toggle || !galleryEl) return;

    var currentView = 'chart';

    function switchView(view) {
      currentView = view;
      btns.forEach(function(b) { b.classList.toggle('active', b.dataset.view === view); });

      if (view === 'chart') {
        if (chartEl) chartEl.hidden = false;
        if (historyEl) historyEl.hidden = false;
        galleryEl.hidden = true;
      } else {
        if (chartEl) chartEl.hidden = true;
        if (historyEl) historyEl.hidden = true;
        galleryEl.hidden = false;
        renderGallery();
      }
    }

    function renderGallery() {
      var photos = progressData
        .filter(function(e) { return e.photo; })
        .sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

      if (photos.length === 0) {
        galleryEl.innerHTML = '<div class="progress-gallery-empty">📸 Zatím žádné progress fotky. Přidej fotku přes "Zaznamenat" nebo týdenní check-in!</div>';
        return;
      }

      galleryEl.innerHTML = photos.map(function(entry, i) {
        var date = new Date(entry.createdAt);
        var dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
        return '<div class="progress-gallery-item" data-gallery-index="' + i + '" style="animation-delay:' + (i * 0.04) + 's">' +
          '<img src="' + entry.photo + '" alt="Progress ' + dateStr + '" loading="lazy">' +
          '<div class="progress-gallery-info">' +
            '<div class="progress-gallery-date">' + dateStr + '</div>' +
            '<div class="progress-gallery-weight">' + entry.weight + ' kg</div>' +
            (entry.notes ? '<div class="progress-gallery-note">' + escapeHtml(entry.notes) + '</div>' : '') +
          '</div>' +
        '</div>';
      }).join('');

      // Click to open photo modal
      galleryEl.querySelectorAll('.progress-gallery-item').forEach(function(item, i) {
        item.addEventListener('click', function() {
          var entry = photos[i];
          var date = new Date(entry.createdAt);
          var dateStr = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
          openPhotoModal(entry.photo, dateStr + ' — ' + entry.weight + ' kg');
        });
      });
    }

    btns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        switchView(btn.dataset.view);
      });
    });

    // Show toggle when there are photos (called after renderProgress)
    var origRenderProgress = renderProgress;
    renderProgress = function() {
      origRenderProgress();
      var hasPhotos = progressData.some(function(e) { return e.photo; });
      toggle.hidden = !hasPhotos;
      if (currentView === 'gallery') renderGallery();
    };
  })();

  // ===== Start =====
  init();

})();
