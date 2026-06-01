(function (global) {
  "use strict";

  // Registru de greșeli pentru quizurile T* EFF.
  // Cheie entry: quizId:level:factId
  // Mastery: correctCount >= 2 (se resetează la 0 la orice greșeală → 2 corecte
  // consecutive, dar pot fi în sesiuni diferite).

  const STORAGE_KEY = "eff-quiz:mistakes:v1";

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function persist(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function entryKey(quizId, level, factId) {
    return `${quizId}:${level}:${factId}`;
  }

  let data = load();

  global.EFFMistakeRegistry = {
    reload() {
      data = load();
    },

    addWrong(quizId, level, factId) {
      const k = entryKey(quizId, level, factId);
      if (!data[k]) data[k] = { wrongCount: 0, correctCount: 0 };
      data[k].wrongCount++;
      data[k].correctCount = 0;
      persist(data);
    },

    addCorrect(quizId, level, factId) {
      const k = entryKey(quizId, level, factId);
      if (!data[k]) return;
      data[k].correctCount = Math.min(2, (data[k].correctCount ?? 0) + 1);
      persist(data);
    },

    // Returnează factId-urile nemastered pentru un nivel
    getPending(quizId, level) {
      const prefix = `${quizId}:${level}:`;
      return Object.entries(data)
        .filter(([k, v]) => k.startsWith(prefix) && v.wrongCount > 0 && (v.correctCount ?? 0) < 2)
        .map(([k]) => k.slice(prefix.length));
    },

    allMastered(quizId, level) {
      return this.getPending(quizId, level).length === 0;
    },

    getEntry(quizId, level, factId) {
      return data[entryKey(quizId, level, factId)] ?? null;
    },
  };
})(window);
