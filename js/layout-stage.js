(function (global) {
  "use strict";

  // Raportul scenei = lățime:înălțime al ECRANULUI de telefon (shell-ul
  // #divArena). Îl ținem fix, ca experiența să fie identică pe orice
  // dispozitiv; banda în plus devine letterbox. Măsurăm spațiul disponibil
  // O SINGURĂ DATĂ (cu barele browserului în starea de la încărcare) și
  // blocăm dimensiunile shell-ului în px — fără reajustări când barele
  // browserului apar/dispar la scroll.
  //
  // Rapoartele sunt exprimate ca multiplicator înălțime/lățime (portret):
  //   1:2  → înălțime = lățime × 2     (referința aleasă, ~mijloc între 9:16 și 9:20)
  //   9:16 → 16/9, 2:3 → 3/2, 3:4 → 4/3 (rămân ca opțiuni de test în CP)
  const RATIOS = {
    "1:2": 2,
    "9:16": 16 / 9,
    "2:3": 3 / 2,
    "3:4": 4 / 3,
  };
  const DEFAULT_RATIO = "1:2";
  // Cheie nouă: ignoră valorile vechi persistate ("native"/"3:4" programatic).
  const RATIO_KEY = "sceneRatio2";

  function create(dom, opts) {
    const options = opts || {};
    const onChange = typeof options.onChange === "function" ? options.onChange : function () {};
    const Config = global.LayoutConfig;
    const shell = dom.divArena;

    let ratio = (Config && Config.get(RATIO_KEY, DEFAULT_RATIO)) || DEFAULT_RATIO;
    if (!(ratio in RATIOS)) ratio = DEFAULT_RATIO;

    // Spațiul disponibil pentru shell, măsurat din părinte (celula tabelului
    // pe desktop sau #game pe mobil), cu barele browserului în starea curentă.
    function availableBox() {
      const host = (shell && shell.parentElement) || document.body;
      const rect = host.getBoundingClientRect();
      const vh =
        (global.visualViewport && global.visualViewport.height) || global.innerHeight || 0;
      const vw =
        (global.visualViewport && global.visualViewport.width) || global.innerWidth || 0;
      let w = Math.round(rect.width);
      let h = Math.round(rect.height);
      // Părintele poate fi auto-înalt (conținut) → nu depăși viewport-ul real.
      if (h <= 0 || (vh > 0 && h > vh)) h = Math.round(vh);
      if (w <= 0 || (vw > 0 && w > vw)) w = Math.round(vw);
      return { w, h };
    }

    // Calculează cutia maximă cu raportul cerut care încape în spațiul
    // disponibil și o blochează pe shell prin dimensiuni inline.
    function applyRatioToShell() {
      if (!shell) return;
      const mult = RATIOS[ratio] || RATIOS[DEFAULT_RATIO];
      const { w: availW, h: availH } = availableBox();
      if (availW <= 0 || availH <= 0) return;
      let boxW = availW;
      let boxH = Math.round(boxW * mult);
      if (boxH > availH) {
        boxH = availH;
        boxW = Math.round(boxH / mult);
      }
      shell.style.width = boxW + "px";
      shell.style.height = boxH + "px";
      shell.classList.add("shell-ratio");
    }

    function remeasure() {
      applyRatioToShell();
      onChange();
    }

    function setRatio(next) {
      ratio = next in RATIOS ? next : DEFAULT_RATIO;
      if (Config) Config.set(RATIO_KEY, ratio);
      remeasure();
    }

    // Măsurăm la pornire și DOAR la schimbări reale de layout (rotirea
    // ecranului). NU ascultăm resize/visualViewport: barele browserului care
    // apar/dispar nu trebuie să rescaleze scena (cerință explicită).
    applyRatioToShell();
    global.requestAnimationFrame(applyRatioToShell);
    global.addEventListener("orientationchange", function () {
      global.requestAnimationFrame(remeasure);
    });

    function mountRatioControl(panelEl) {
      if (!panelEl) return;
      const field = document.createElement("div");
      field.className = "control-panel-lift-field";

      const label = document.createElement("label");
      label.textContent = "Raport scenă (test)";

      const select = document.createElement("select");
      Object.keys(RATIOS).forEach(function (key) {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = key === DEFAULT_RATIO ? key + " (implicit)" : key;
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
      remeasure: remeasure,
      // Păstrat pentru compatibilitate cu apelurile existente: scena e blocată,
      // deci o cerere de „refresh" la modificări de chrome nu rescalează nimic.
      refresh: function () {},
    };
  }

  global.LayoutStage = { create: create };
})(window);
