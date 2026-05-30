(function (global) {
  "use strict";

  // Registru de greșeli pentru quizurile succesive.
  // Cheie: `${level}:${a}` — adunarea exactă greșită (ex. 15+3).
  // Stochează cross-session în localStorage.
  //
  // Mastery: consecutiveCorrect >= 2 (ultimele 2 apariții ale restanței, ambele corecte).
  //   addWrong  → consecutiveCorrect = 0
  //   addCorrect → consecutiveCorrect++ (indiferent de SDP)
  //
  // Afișare verticală (coloană) doar dacă lastWrongDate === today (isFromToday).
  // SDP per zi = !currentStepWrongRecorded && !isFromToday (calculat în engine).

  const STORAGE_KEY = "succesive-quiz:mistakes:v1";

  function getStorage() {
    try {
      if (global.localStorage) return global.localStorage;
    } catch (e) {}
    if (!getStorage._mem) {
      const d = {};
      getStorage._mem = {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null),
        setItem: (k, v) => { d[k] = v; },
      };
    }
    return getStorage._mem;
  }

  function load() {
    try {
      const raw = getStorage().getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function persist(data) {
    try {
      getStorage().setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function entryKey(level, a) {
    return `${level}:${a}`;
  }

  let data = load();

  global.SuccesiveMistakeRegistry = {
    reload() {
      data = load();
    },

    // Prima greșeală pe un pas: înregistrează a-ul greșit, data și resetează streak-ul.
    addWrong(level, a) {
      const k = entryKey(level, a);
      if (!data[k]) data[k] = { level, a, wrongCount: 0, consecutiveCorrect: 0, lastWrongDate: null };
      data[k].wrongCount += 1;
      data[k].consecutiveCorrect = 0;
      data[k].lastWrongDate = today();
      persist(data);
    },

    // Apariție corectă (indiferent de SDP) → consecutiveCorrect++.
    addCorrect(level, a) {
      const k = entryKey(level, a);
      if (!data[k]) return;
      data[k].consecutiveCorrect = (data[k].consecutiveCorrect ?? 0) + 1;
      persist(data);
    },

    // Restanțe nerezolvate pentru nivel, ordonate după nr. greșeli desc.
    getPrioritized(level, limit) {
      return Object.values(data)
        .filter((m) => m.level === level && (m.consecutiveCorrect ?? 0) < 2)
        .sort((x, y) => y.wrongCount - x.wrongCount)
        .slice(0, limit)
        .map((m) => m.a);
    },

    allMasteredForLevel(level) {
      const forLevel = Object.values(data).filter((m) => m.level === level);
      if (forLevel.length === 0) return true;
      return forLevel.every((m) => (m.consecutiveCorrect ?? 0) >= 2);
    },

    // Verifică dacă greșeala a fost făcută ASTĂZI (→ afișare verticală + viteză redusă).
    isFromToday(level, a) {
      const k = entryKey(level, a);
      const entry = data[k];
      return Boolean(entry && entry.lastWrongDate === today());
    },
  };
})(window);
