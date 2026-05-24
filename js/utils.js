(function (global) {
  "use strict";

  global.GameUtils = {
    randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },

    levelRange(level) {
      const min = level === 1 ? 1 : (level - 1) * 10;
      return { min, max: level * 10 };
    },

    levelLabel(level) {
      const { min, max } = global.GameUtils.levelRange(level);
      return `Nivel ${level} · ${min}–${max}`;
    },
  };
})(window);
