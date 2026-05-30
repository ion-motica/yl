(function (global) {
  "use strict";

  // Registru de greșeli pentru quizurile succesive.
  // Cheie: `${level}:${a}` — adunarea exactă greșită (ex. 15+3).
  // Stocheaz cross-session în localStorage.

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

  function entryKey(level, a) {
    return `${level}:${a}`;
  }

  let data = load();

  global.SuccesiveMistakeRegistry = {
    reload() {
      data = load();
    },

    // Apelat o singură dată per pas greșit (prima greșeală la pasul curent).
    addWrong(level, a) {
      const k = entryKey(level, a);
      if (!data[k]) data[k] = { level, a, wrongCount: 0, correctCount: 0 };
      data[k].wrongCount += 1;
      persist(data);
    },

    // Apelat când un pas identificat ca restanță e răspuns corect.
    addCorrect(level, a) {
      const k = entryKey(level, a);
      if (!data[k]) return;
      if (data[k].correctCount < 2) {
        data[k].correctCount += 1;
        persist(data);
      }
    },

    // Returnează valorile `a` ale restanțelor nerezolvate pentru nivel,
    // sortate descrescător după nr. greșeli (cele mai dificile primele).
    getPrioritized(level, limit) {
      return Object.values(data)
        .filter((m) => m.level === level && m.correctCount < 2)
        .sort((x, y) => y.wrongCount - x.wrongCount)
        .slice(0, limit)
        .map((m) => m.a);
    },

    // Avansarea e permisă doar dacă toate restanțele nivelului au ≥2 corecte.
    allMasteredForLevel(level) {
      const forLevel = Object.values(data).filter((m) => m.level === level);
      if (forLevel.length === 0) return true;
      return forLevel.every((m) => m.correctCount >= 2);
    },
  };
})(window);
