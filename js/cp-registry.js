(function (global) {
  "use strict";

  const DEFAULT_ORDER = ["lift", "aam"];
  const panels = new Map();

  function register(def) {
    if (!def?.id) return;
    panels.set(def.id, {
      id: def.id,
      title: def.title || def.id,
      isEnabled: typeof def.isEnabled === "function" ? def.isEnabled : () => true,
    });
  }

  function getOrder() {
    const Config = global.LayoutConfig;
    const stored = Config && Config.get("cpOrder", null);
    if (Array.isArray(stored) && stored.length) {
      const known = stored.filter((id) => panels.has(id));
      panels.forEach((_v, id) => {
        if (!known.includes(id)) known.push(id);
      });
      return known;
    }
    return DEFAULT_ORDER.filter((id) => panels.has(id));
  }

  function list() {
    const order = getOrder();
    return order.map((id) => panels.get(id)).filter(Boolean);
  }

  const CpRegistry = {
    register,
    list,
    get: (id) => panels.get(id),
    getOrder,
  };

  global.CpRegistry = CpRegistry;
})(window);
