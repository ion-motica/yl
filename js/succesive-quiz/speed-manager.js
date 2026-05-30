(function (global) {
  "use strict";

  // Gestionează viteza de cădere a liftului și comportamentul bounce, per nivel.
  //
  // Factor nivel (persistent, localStorage):
  //   - Scade cu ×0.85 la fiecare 3 răspunsuri greșite consecutive (după primul prag de 4).
  //   - Crește cu ÷0.85 (≤1.0) la fiecare răspuns corect rapid (<2s) pe o restanță.
  //   - Minim 40% din viteza normală.
  //
  // Factor pas (per valoare 'a', persistent):
  //   - Fiecare răspuns greșit consecutiv pe aceeași întrebare: ×0.85.
  //   - Răspuns corect rapid: ÷0.85 (≤1.0).
  //
  // Bounce la vârf: activat când levelFactor < 1.0 (liftul a acumulat greșeli).

  const STORAGE_KEY = "succesive-quiz:speed:v1";
  const PENALTY = 0.85;
  const SPEED_FLOOR = 0.40;
  const FAST_MS = 2000;
  const LEVEL_WRONG_THRESHOLD = 4; // prima penalizare la nivel se aplică de la wrongCount = 4

  // Câte penalizări de nivel ar trebui aplicate conform wrongCount.
  function expectedPenalties(wrongCount) {
    if (wrongCount < LEVEL_WRONG_THRESHOLD) return 0;
    return Math.floor((wrongCount - 1) / 3); // 4→1, 7→2, 10→3, ...
  }

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

  function levelKey(quizId, level) {
    return `${quizId}::${level}`;
  }

  function getOrCreate(data, quizId, level) {
    const k = levelKey(quizId, level);
    if (!data[k]) {
      data[k] = {
        wrongCount: 0,       // total greșeli la nivel (nu scade niciodată)
        penaltiesApplied: 0, // câte penalizări ×0.85 s-au aplicat efectiv
        levelFactor: 1.0,    // factor de viteză la nivel (poate crește prin recuperare)
        steps: {},           // { [a]: stepFactor } — factor per valoare adunată
      };
    }
    return data[k];
  }

  let data = load();

  global.SpeedManager = {
    reload() {
      data = load();
    },

    // Apelat la FIECARE răspuns greșit (inclusiv al doilea, al treilea pe același pas).
    recordWrong(quizId, level, a) {
      const entry = getOrCreate(data, quizId, level);

      entry.wrongCount++;

      // Penalizare la nivel: aplică dacă se atinge un nou prag.
      const needed = expectedPenalties(entry.wrongCount);
      if (needed > entry.penaltiesApplied) {
        entry.penaltiesApplied = needed;
        entry.levelFactor = Math.max(SPEED_FLOOR, entry.levelFactor * PENALTY);
      }

      // Penalizare la pas.
      const aKey = String(a);
      entry.steps[aKey] = Math.max(SPEED_FLOOR, (entry.steps[aKey] ?? 1.0) * PENALTY);

      persist(data);
    },

    // Apelat la răspuns corect.
    // isRestanta: true dacă întrebarea era o restanță activă (activeMistakeAs).
    recordCorrect(quizId, level, a, responseMs, isRestanta) {
      const entry = getOrCreate(data, quizId, level);
      const isFast = Number.isFinite(responseMs) && responseMs < FAST_MS;

      if (!isFast) return;

      // Recuperare factor pas (pentru orice răspuns corect rapid pe un pas cu penalizare).
      const aKey = String(a);
      if (entry.steps[aKey] !== undefined && entry.steps[aKey] < 1.0) {
        entry.steps[aKey] = Math.min(1.0, entry.steps[aKey] / PENALTY);
      }

      // Recuperare factor nivel numai pentru restanțe răspunse rapid.
      if (isRestanta && entry.levelFactor < 1.0) {
        entry.levelFactor = Math.min(1.0, entry.levelFactor / PENALTY);
      }

      persist(data);
    },

    // Factor efectiv de viteză pentru întrebarea curentă: level × step (≥ SPEED_FLOOR).
    getEffectiveFactor(quizId, level, a) {
      const entry = getOrCreate(data, quizId, level);
      const stepFactor = entry.steps[String(a)] ?? 1.0;
      return Math.max(SPEED_FLOOR, entry.levelFactor * stepFactor);
    },

    getLevelFactor(quizId, level) {
      return getOrCreate(data, quizId, level).levelFactor;
    },

    // Bounce la vârf dacă nivelul are acumulat măcar o penalizare.
    shouldBounceToTop(quizId, level) {
      return getOrCreate(data, quizId, level).levelFactor < 1.0;
    },
  };
})(window);
