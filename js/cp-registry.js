(function (global) {
  "use strict";

  const LEGACY_DEFAULT_ORDER = ["lift", "aam", "debug"];
  const LEGACY_DEFAULT_ORDER_V2 = ["debug", "lift", "aam"];
  const DEFAULT_ORDER = [
    "subquiz",
    "preEquationNav",
    "equationTonomat",
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

  function ensurePrimaryPanelsFirst(order) {
    let next = order;
    if (panels.has("liftType")) {
      const rest = next.filter((id) => id !== "liftType");
      next = ["liftType", ...rest];
    }
    if (panels.has("subquiz")) {
      const rest = next.filter((id) => id !== "subquiz");
      next = ["subquiz", ...rest];
    }
    return next;
  }

  function getOrder() {
    const Config = global.LayoutConfig;
    let stored = Config && Config.get("cpOrder", null);
    if (Array.isArray(stored) && stored.length) {
      const migrated = normalizeStoredOrder(stored);
      if (migrated !== stored && Config) {
        Config.set("cpOrder", migrated);
        stored = migrated;
      }
      const known = stored.filter((id) => panels.has(id));
      panels.forEach((_v, id) => {
        if (!known.includes(id)) known.push(id);
      });
      const ordered = ensurePrimaryPanelsFirst(known);
      if (ordered.join("|") !== known.join("|") && Config) {
        Config.set("cpOrder", ordered);
      }
      return ordered;
    }
    return DEFAULT_ORDER.filter((id) => panels.has(id));
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
