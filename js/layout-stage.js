(function (global) {
  "use strict";

  // „Scena” de joc = arena în care curge liftul. Pasul 1 introduce doar un
  // control de RAPORT (test) + recalcul la redimensionare. Modul „nativ”
  // păstrează exact comportamentul de dinainte (înălțime din CSS, 420px).
  //
  // Rapoartele sunt exprimate ca multiplicator înălțime/lățime (portret):
  //   3:4  → înălțime = lățime × 4/3
  //   2:3  → înălțime = lățime × 3/2
  //   9:16 → înălțime = lățime × 16/9
  const RATIOS = {
    native: null,
    "3:4": 4 / 3,
    "2:3": 3 / 2,
    "9:16": 16 / 9,
  };

  function create(dom, opts) {
    const options = opts || {};
    const onChange = typeof options.onChange === "function" ? options.onChange : function () {};
    const Config = global.LayoutConfig;

    let ratio = (Config && Config.get("sceneRatio", "native")) || "native";
    if (!(ratio in RATIOS)) ratio = "native";
    let rafId = null;

    function viewportHeightCap() {
      const vh =
        (global.visualViewport && global.visualViewport.height) ||
        global.innerHeight ||
        0;
      // Nu lăsăm scena să depășească ecranul (ar produce scroll în modul joc).
      return vh > 0 ? Math.round(vh * 0.92) : Infinity;
    }

    function applyRatioToDom() {
      const arena = dom.arena;
      if (!arena) return;
      const mult = RATIOS[ratio];
      if (!mult) {
        // Mod nativ: redă controlul înălțimii către CSS (420px pe desktop).
        arena.style.removeProperty("height");
        return;
      }
      const width = arena.clientWidth || 0;
      if (width <= 0) return;
      const target = Math.min(Math.round(width * mult), viewportHeightCap());
      const current = Math.round(arena.getBoundingClientRect().height);
      if (Math.abs(current - target) > 1) {
        arena.style.height = target + "px";
      }
    }

    // Coalescăm mai multe evenimente într-un singur recalcul pe cadru.
    function schedule() {
      if (rafId) return;
      rafId = global.requestAnimationFrame(function () {
        rafId = null;
        applyRatioToDom();
        onChange();
      });
    }

    function setRatio(next) {
      ratio = next in RATIOS ? next : "native";
      if (Config) Config.set("sceneRatio", ratio);
      applyRatioToDom();
      onChange();
    }

    // Observăm LĂȚIMEA (prin părintele arenei) ca să nu reacționăm la propria
    // schimbare de înălțime și să intrăm în buclă.
    const widthHost = (dom.arena && dom.arena.parentElement) || dom.arena;
    if (widthHost && global.ResizeObserver) {
      let lastW = -1;
      const ro = new global.ResizeObserver(function (entries) {
        const w = Math.round(entries[0].contentRect.width);
        if (w !== lastW) {
          lastW = w;
          schedule();
        }
      });
      ro.observe(widthHost);
    }
    global.addEventListener("resize", schedule);
    if (global.visualViewport) {
      global.visualViewport.addEventListener("resize", schedule);
    }

    // Aplică raportul persistat la pornire.
    applyRatioToDom();

    function mountRatioControl(panelEl) {
      if (!panelEl) return;
      const field = document.createElement("div");
      field.className = "control-panel-lift-field";

      const label = document.createElement("label");
      label.textContent = "Raport arenă (test)";

      const select = document.createElement("select");
      Object.keys(RATIOS).forEach(function (key) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = key === "native" ? "nativ (ca acum)" : key;
        if (key === ratio) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener("change", function () {
        setRatio(select.value);
      });

      field.append(label, select);
      panelEl.appendChild(field);
    }

    return {
      setRatio: setRatio,
      getRatio: function () {
        return ratio;
      },
      mountRatioControl: mountRatioControl,
      refresh: schedule,
    };
  }

  global.LayoutStage = { create: create };
})(window);
