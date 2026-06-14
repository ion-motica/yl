(function (global) {
  "use strict";

  // Stocare unică pentru preferințele de LAYOUT (separată de datele de joc:
  // profil EFF, fact-store etc.). Versionată în cheie, ca să putem migra
  // schema pe viitor fără să stricăm preferințele vechi.
  const NS = "yl.layout.v1";

  function readAll() {
    try {
      return JSON.parse(global.localStorage.getItem(NS)) || {};
    } catch {
      return {};
    }
  }

  function writeAll(obj) {
    try {
      global.localStorage.setItem(NS, JSON.stringify(obj));
    } catch {
      /* localStorage indisponibil (mod privat, cote depășite) — ignorăm */
    }
  }

  const LayoutConfig = {
    get(key, fallback) {
      const all = readAll();
      return key in all ? all[key] : fallback;
    },
    set(key, value) {
      const all = readAll();
      all[key] = value;
      writeAll(all);
    },
  };

  global.LayoutConfig = LayoutConfig;
})(window);
