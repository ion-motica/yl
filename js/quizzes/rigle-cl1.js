/**
 * Quiz „Cl. 1 - Rigle" — înregistrare + config + panou CP.
 *
 * Quiz cu motor propriu (`customEngine`): nu trece prin FallingEngine. app.js îl
 * detectează după `customEngine` și, în loc de `engine.startRound(...)`, apelează
 * `mountArena(...)` / `unmountArena()`. `isCompleted() → true` ține FallingEngine
 * în standby fără să-l modificăm (bucla lui de cădere e inertă când quizul e
 * „completat"). Vezi `documente de referinta/RIGLE-REFERENCE.md`.
 */
(function (global) {
  "use strict";

  const CONFIG_ETAPA1 = {
    obiect: "🍏",
    coloanaInitialaIndex: 1, // a doua coloană (mijloc); lățimile sunt aleatoare, deci
    // e un index, nu o lățime — vezi RigleFacte.
    vitezaCoborare: 34,
  };

  // CP — Grilă: persistă în LayoutConfig, ca celelalte bife simple din CP.
  const GRID_VERTICAL_KEY = "rigleGridVertical";
  const GRID_ORIZONTAL_KEY = "rigleGridOrizontal";
  const getGridVertical = () => global.LayoutConfig?.get(GRID_VERTICAL_KEY, true) !== false;
  const getGridOrizontal = () => global.LayoutConfig?.get(GRID_ORIZONTAL_KEY, false) === true;

  // CP — Poziție coloane: treime din spațiu (implicit) vs. proporțional (spațiu).
  const COL_TREIME_KEY = "rigleColoaneTreime";
  const getColoaneTreime = () => global.LayoutConfig?.get(COL_TREIME_KEY, true) !== false;

  // CP — Suma maxima: interval [min, max] pentru suma factului (a+b=suma).
  const SUMA_MIN_KEY = "rigleSumaMin";
  const SUMA_MAX_KEY = "rigleSumaMax";
  const SUMA_MIN_IMPLICIT = 2;
  const SUMA_MAX_IMPLICIT = 5;
  const getSumaMin = () => global.LayoutConfig?.get(SUMA_MIN_KEY, SUMA_MIN_IMPLICIT) ?? SUMA_MIN_IMPLICIT;
  const getSumaMax = () => global.LayoutConfig?.get(SUMA_MAX_KEY, SUMA_MAX_IMPLICIT) ?? SUMA_MAX_IMPLICIT;
  const clampSuma = (v) => Math.min(30, Math.max(1, v));

  // Dacă x>y, y e împins în sus ca să rămână x<=y (și simetric) — decizia 1c din plan.
  function seteazaSumaMin(valoare) {
    const min = clampSuma(valoare);
    const max = Math.max(getSumaMax(), min);
    global.LayoutConfig?.set(SUMA_MIN_KEY, min);
    global.LayoutConfig?.set(SUMA_MAX_KEY, max);
  }
  function seteazaSumaMax(valoare) {
    const max = clampSuma(valoare);
    const min = Math.min(getSumaMin(), max);
    global.LayoutConfig?.set(SUMA_MIN_KEY, min);
    global.LayoutConfig?.set(SUMA_MAX_KEY, max);
  }

  global.QuizRegistry.register({
    id: "rigle-cl1",
    title: "Cl. 1 - Rigle",
    description: "Măsoară suma de obiecte cu rigle (coloane). Facte a+b=? variabile.",
    order: 99, // ultimul în meniu; nu devine quiz implicit
    create() {
      let mounted = null;

      const urmatorulFact = () =>
        global.RigleFacte.genereazaFact({ sumaMin: getSumaMin(), sumaMax: getSumaMax() });

      return {
        customEngine: true,
        // Ține motorul 1 (FallingEngine) în standby cât timp Rigle e activ.
        isCompleted: () => true,

        mountArena(hosts) {
          if (mounted) mounted.destroy();
          const cfg = Object.assign({}, CONFIG_ETAPA1, {
            gridVertical: getGridVertical(),
            gridOrizontal: getGridOrizontal(),
            pozitieTreime: getColoaneTreime(),
            urmatorulFact,
          });
          mounted = global.RigleEngine.mount(hosts, cfg);
        },
        unmountArena() {
          if (mounted) mounted.destroy();
          mounted = null;
        },

        // CP — Rigle: Grilă (linii), Poziție coloane (treime/spațiu), Suma maxima.
        appendRigleControlPanel(mount) {
          if (!mount) return;
          mount.replaceChildren();

          const title = document.createElement("p");
          title.className = "control-panel-lift-title";
          title.textContent = "Grila";
          mount.appendChild(title);

          const addRow = (labelText, checked, onChange) => {
            const row = document.createElement("label");
            row.className = "control-panel-lift-row";
            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = checked;
            input.addEventListener("change", () => onChange(input.checked));
            const span = document.createElement("span");
            span.textContent = labelText;
            row.append(input, span);
            mount.appendChild(row);
          };

          addRow("Vertical", getGridVertical(), (checked) => {
            global.LayoutConfig?.set(GRID_VERTICAL_KEY, checked);
            mounted?.setGridLines({ vertical: checked });
          });
          addRow("Orizontal", getGridOrizontal(), (checked) => {
            global.LayoutConfig?.set(GRID_ORIZONTAL_KEY, checked);
            mounted?.setGridLines({ orizontal: checked });
          });

          const posTitle = document.createElement("p");
          posTitle.className = "control-panel-lift-title";
          posTitle.textContent = "Poziție coloane";
          mount.appendChild(posTitle);

          const addRadioRow = (labelText, value, currentValue, onChange) => {
            const row = document.createElement("label");
            row.className = "control-panel-lift-row";
            const input = document.createElement("input");
            input.type = "radio";
            input.name = "rigle-col-pozitie";
            input.checked = value === currentValue;
            input.addEventListener("change", onChange);
            const span = document.createElement("span");
            span.textContent = labelText;
            row.append(input, span);
            mount.appendChild(row);
          };

          const treimeAcum = getColoaneTreime();
          addRadioRow("Fiecare coloană are o treime din spațiu", true, treimeAcum, () => {
            global.LayoutConfig?.set(COL_TREIME_KEY, true);
            mounted?.setColumnLayout({ treime: true });
          });
          addRadioRow("În funcție de spațiu", false, treimeAcum, () => {
            global.LayoutConfig?.set(COL_TREIME_KEY, false);
            mounted?.setColumnLayout({ treime: false });
          });

          const sumaTitle = document.createElement("p");
          sumaTitle.className = "control-panel-lift-title";
          sumaTitle.textContent = "Suma maxima";
          mount.appendChild(sumaTitle);

          let minInput = null;
          let maxInput = null;

          const addStepper = (labelText, getValue, onApply) => {
            const field = document.createElement("div");
            field.className = "control-panel-lift-field pre-eq-stepper-field";
            const label = document.createElement("label");
            label.textContent = labelText;
            const controls = document.createElement("div");
            controls.className = "pre-eq-stepper";
            const minus = document.createElement("button");
            minus.type = "button";
            minus.textContent = "-";
            const input = document.createElement("input");
            input.type = "number";
            input.min = "1";
            input.max = "30";
            input.step = "1";
            input.value = String(getValue());
            const plus = document.createElement("button");
            plus.type = "button";
            plus.textContent = "+";

            const apply = (valoare) => {
              onApply(Number(valoare));
              minInput.value = String(getSumaMin());
              maxInput.value = String(getSumaMax());
              mounted?.reporneste();
            };

            minus.addEventListener("click", () => apply(Number(input.value) - 1));
            plus.addEventListener("click", () => apply(Number(input.value) + 1));
            input.addEventListener("change", () => apply(input.value));

            controls.append(minus, input, plus);
            field.append(label, controls);
            mount.appendChild(field);
            return input;
          };

          minInput = addStepper("Minim", getSumaMin, seteazaSumaMin);
          maxInput = addStepper("Maxim", getSumaMax, seteazaSumaMax);
        },

        // Stub-uri minime pentru orice apel neguardat din HUD.
        getLevel: () => 1,
        getMinLevel: () => 1,
        getMaxLevel: () => 1,
        getLevelLabel: () => "",
        getLevelButtonTitle: () => "",
        switchLevel: () => "",
        pickNextRound: () => null,
        beginRound: () => ({}),
        onAnswer() {},
        onTimeout() {},
      };
    },
  });
})(window);
