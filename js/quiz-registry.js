(function (global) {
  "use strict";

  const quizzes = new Map();
  let activeId = null;

  global.QuizRegistry = {
    register(meta) {
      quizzes.set(meta.id, meta);
    },

    list() {
      return [...quizzes.values()].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    },

    get(id) {
      return quizzes.get(id);
    },

    getActiveId() {
      return activeId;
    },

    setActive(id) {
      if (!quizzes.has(id)) return false;
      activeId = id;
      return true;
    },

    getDefaultId() {
      return this.list()[0]?.id ?? null;
    },

    createActive() {
      const meta = quizzes.get(activeId);
      return meta ? meta.create(meta) : null;
    },
  };
})(window);
