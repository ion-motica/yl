/**
 * Quiz „Cl. 1 - Rigle" — înregistrare + config etapa 1.
 *
 * Quiz cu motor propriu (`customEngine`): nu trece prin FallingEngine. app.js îl
 * detectează după `customEngine` și, în loc de `engine.startRound(...)`, apelează
 * `mountArena(...)` / `unmountArena()`. `isCompleted() → true` ține FallingEngine
 * în standby fără să-l modificăm (bucla lui de cădere e inertă când quizul e
 * „completat"). Vezi `js/rigle/SPEC-etapa1.md`.
 */
(function (global) {
  "use strict";

  const CONFIG_ETAPA1 = {
    intrebare: "2+1=?",
    grupe: [
      { n: 2, fundal: "rosu" },
      { n: 1, fundal: "albastru" },
    ],
    obiect: "🍏",
    latimiColoane: [2, 3, 4],
    coloanaInitiala: 3,
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

  global.QuizRegistry.register({
    id: "rigle-cl1",
    title: "Cl. 1 - Rigle",
    description: "Măsoară suma de obiecte cu rigle (coloane). Etapa 1: doar mișcarea.",
    order: 99, // ultimul în meniu; nu devine quiz implicit
    create() {
      let mounted = null;
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
          });
          mounted = global.RigleEngine.mount(hosts, cfg);
        },
        unmountArena() {
          if (mounted) mounted.destroy();
          mounted = null;
        },

        // CP — Rigle: bife pentru liniile grilei (vertical/orizontal).
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
