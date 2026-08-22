(function (global) {
  "use strict";

  const LEGACY_DEFAULT_ORDER = ["lift", "aam", "debug"];
  const LEGACY_DEFAULT_ORDER_V2 = ["debug", "lift", "aam"];
  const DEFAULT_ORDER = [
    "general",
    "subquiz",
    "sq2EffVbs",
    "sq3FactorGroups",
    "sq5FluentParty",
    "preEquationNav",
    "equationTonomat",
    "rigle",
    "liftType",
    "debug",
    "lift",
    "aam",
  ];
  const panels = new Map();

  function register(def) {
    if (!def?.id) return;
    panels.set(def.id, {
      id: def.id,
      title: def.title || def.id,
      isEnabled: typeof def.isEnabled === "function" ? def.isEnabled : () => true,
      quizSpecific: def.quizSpecific === true,
    });
  }

  function normalizeStoredOrder(stored) {
    if (
      Array.isArray(stored) &&
      stored.length === LEGACY_DEFAULT_ORDER.length &&
      LEGACY_DEFAULT_ORDER.every((id, i) => stored[i] === id)
    ) {
      return DEFAULT_ORDER.slice();
    }
    if (
      Array.isArray(stored) &&
      stored.length === LEGACY_DEFAULT_ORDER_V2.length &&
      LEGACY_DEFAULT_ORDER_V2.every((id, i) => stored[i] === id)
    ) {
      return DEFAULT_ORDER.slice();
    }
    return stored;
  }

  // Ordinea salvata de utilizator e singura autoritate, iar getOrder() e strict
  // citire: nu scrie in config si nu re-fixeaza niciun panou in fata. (Exact o
  // astfel de "re-fixare" la fiecare citire anula orice reordonare manuala a
  // panourilor general/subquiz/sq2EffVbs/liftType — si o si suprascria in
  // localStorage, deci se pierdea si dupa refresh.) Panourile aparute intre timp,
  // necunoscute ordinii salvate, se adauga la final; de acolo pot fi trase oriunde.
  function getOrder() {
    const Config = global.LayoutConfig;
    const stored = normalizeStoredOrder(Config && Config.get("cpOrder", null));
    if (!Array.isArray(stored) || !stored.length) {
      return DEFAULT_ORDER.filter((id) => panels.has(id));
    }
    const order = stored.filter((id) => panels.has(id));
    panels.forEach((_v, id) => {
      if (!order.includes(id)) order.push(id);
    });
    return order;
  }

  function list() {
    const order = getOrder();
    return order.map((id) => panels.get(id)).filter(Boolean);
  }

  function setOrder(order) {
    const valid = [];
    if (Array.isArray(order)) {
      order.forEach((id) => {
        if (panels.has(id) && !valid.includes(id)) valid.push(id);
      });
    }
    panels.forEach((_v, id) => {
      if (!valid.includes(id)) valid.push(id);
    });
    const Config = global.LayoutConfig;
    if (Config) Config.set("cpOrder", valid);
    return valid;
  }

  function move(id, delta) {
    const order = getOrder();
    const i = order.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return order;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return setOrder(next);
  }

  const CpRegistry = {
    register,
    list,
    get: (id) => panels.get(id),
    getOrder,
    setOrder,
    move,
  };

  global.CpRegistry = CpRegistry;
})(window);
