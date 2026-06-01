(function (global) {
  "use strict";

  function profileKey(quizId) {
    return `eff-quiz:${quizId}:profile:v1`;
  }

  function getProfile(quizId) {
    try {
      const raw = localStorage.getItem(profileKey(quizId));
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge with defaults so new keys added later get true by default
        const defaults = global.QFGenerator.defaultProfile();
        return { ...defaults, ...parsed };
      }
    } catch (_) {}
    return global.QFGenerator.defaultProfile();
  }

  function saveProfile(quizId, profile) {
    try {
      localStorage.setItem(profileKey(quizId), JSON.stringify(profile));
    } catch (_) {}
  }

  global.EFFProfileStore = { getProfile, saveProfile };
})(window);
