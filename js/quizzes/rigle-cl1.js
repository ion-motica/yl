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

  // CP — Numerotează rânduri din coloane: "dezactivat" | "toate" | "animat".
  const NUMEROTARE_KEY = "rigleNumerotare";
  const RANDURI_SUS_KEY = "rigleRanduriInSus";
  const RANDURI_JOS_KEY = "rigleRanduriInJos";
  const RANDURI_IMPLICIT = 10;
  const getNumerotare = () => global.LayoutConfig?.get(NUMEROTARE_KEY, "dezactivat") ?? "dezactivat";
  const getRanduriInSus = () => global.LayoutConfig?.get(RANDURI_SUS_KEY, RANDURI_IMPLICIT) ?? RANDURI_IMPLICIT;
  const getRanduriInJos = () => global.LayoutConfig?.get(RANDURI_JOS_KEY, RANDURI_IMPLICIT) ?? RANDURI_IMPLICIT;
  function seteazaRanduriInSus(valoare) {
    const v = Math.max(1, Math.min(50, Math.round(valoare)));
    global.LayoutConfig?.set(RANDURI_SUS_KEY, v);
  }
  function seteazaRanduriInJos(valoare) {
    const v = Math.max(1, Math.min(50, Math.round(valoare)));
    global.LayoutConfig?.set(RANDURI_JOS_KEY, v);
  }

  // CP — Lift: transparență fundal alb + afișare margine.
  const LIFT_TRANSPARENTA_KEY = "rigleLiftTransparentaFundal";
  const LIFT_MARGINE_KEY = "rigleLiftMargine";
  const LIFT_TRANSPARENTA_IMPLICIT = 50;
  const getLiftTransparenta = () =>
    global.LayoutConfig?.get(LIFT_TRANSPARENTA_KEY, LIFT_TRANSPARENTA_IMPLICIT) ?? LIFT_TRANSPARENTA_IMPLICIT;
  const getLiftMargine = () => global.LayoutConfig?.get(LIFT_MARGINE_KEY, true) !== false;
  function seteazaLiftTransparenta(valoare) {
    const v = Math.max(0, Math.min(100, Math.round(valoare)));
    global.LayoutConfig?.set(LIFT_TRANSPARENTA_KEY, v);
  }

  // CP — Etichete (FOV Feedback Oranj Verde): pe buton / pe lift / animație pt. corect.
  const FOV_BUTON_KEY = "rigleFovButon";
  const FOV_LIFT_KEY = "rigleFovLift";
  const FOV_LIFT_CORECT_KEY = "rigleFovLiftAnimatieCorect";
  const getFovButon = () => global.LayoutConfig?.get(FOV_BUTON_KEY, true) !== false;
  const getFovLift = () => global.LayoutConfig?.get(FOV_LIFT_KEY, true) !== false;
  const getFovLiftCorect = () => global.LayoutConfig?.get(FOV_LIFT_CORECT_KEY, true) !== false;

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
            numerotareRanduri: getNumerotare(),
            randuriInSus: getRanduriInSus(),
            randuriInJos: getRanduriInJos(),
            liftFundalTransparenta: getLiftTransparenta(),
            liftMargine: getLiftMargine(),
            fovButon: getFovButon(),
            fovLift: getFovLift(),
            fovLiftAnimatieCorect: getFovLiftCorect(),
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

          const addRadioRow = (labelText, value, currentValue, groupName, onChange) => {
            const row = document.createElement("label");
            row.className = "control-panel-lift-row";
            const input = document.createElement("input");
            input.type = "radio";
            input.name = groupName;
            input.checked = value === currentValue;
            input.addEventListener("change", onChange);
            const span = document.createElement("span");
            span.textContent = labelText;
            row.append(input, span);
            mount.appendChild(row);
          };

          const treimeAcum = getColoaneTreime();
          addRadioRow("Fiecare coloană are o treime din spațiu", true, treimeAcum, "rigle-col-pozitie", () => {
            global.LayoutConfig?.set(COL_TREIME_KEY, true);
            mounted?.setColumnLayout({ treime: true });
          });
          addRadioRow("În funcție de spațiu", false, treimeAcum, "rigle-col-pozitie", () => {
            global.LayoutConfig?.set(COL_TREIME_KEY, false);
            mounted?.setColumnLayout({ treime: false });
          });

          const sumaTitle = document.createElement("p");
          sumaTitle.className = "control-panel-lift-title";
          sumaTitle.textContent = "Suma maxima";
          mount.appendChild(sumaTitle);

          let minInput = null;
          let maxInput = null;

          const addStepper = (labelText, getValue, onApply, min, max, dupaAplicare) => {
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
            input.min = String(min);
            input.max = String(max);
            input.step = "1";
            input.value = String(getValue());
            const plus = document.createElement("button");
            plus.type = "button";
            plus.textContent = "+";

            const apply = (valoare) => {
              onApply(Number(valoare));
              input.value = String(getValue());
              dupaAplicare?.();
            };

            minus.addEventListener("click", () => apply(Number(input.value) - 1));
            plus.addEventListener("click", () => apply(Number(input.value) + 1));
            input.addEventListener("change", () => apply(input.value));

            controls.append(minus, input, plus);
            field.append(label, controls);
            mount.appendChild(field);
            return input;
          };

          minInput = addStepper("Minim", getSumaMin, seteazaSumaMin, 1, 30, () => {
            maxInput.value = String(getSumaMax());
            mounted?.reporneste();
          });
          maxInput = addStepper("Maxim", getSumaMax, seteazaSumaMax, 1, 30, () => {
            minInput.value = String(getSumaMin());
            mounted?.reporneste();
          });

          const numTitle = document.createElement("p");
          numTitle.className = "control-panel-lift-title";
          numTitle.textContent = "Numerotează rânduri din coloane";
          mount.appendChild(numTitle);

          const numerotareAcum = getNumerotare();
          addRadioRow("Dezactivat", "dezactivat", numerotareAcum, "rigle-numerotare", () => {
            global.LayoutConfig?.set(NUMEROTARE_KEY, "dezactivat");
            mounted?.setNumerotareRanduri({ mod: "dezactivat" });
          });
          addRadioRow("Pe toate rândurile", "toate", numerotareAcum, "rigle-numerotare", () => {
            global.LayoutConfig?.set(NUMEROTARE_KEY, "toate");
            mounted?.setNumerotareRanduri({ mod: "toate" });
          });
          addRadioRow("Animat fade-in pe coloana curentă", "animat", numerotareAcum, "rigle-numerotare", () => {
            global.LayoutConfig?.set(NUMEROTARE_KEY, "animat");
            mounted?.setNumerotareRanduri({ mod: "animat" });
          });

          addStepper("Câte rânduri în sus", getRanduriInSus, seteazaRanduriInSus, 1, 50, () => {
            mounted?.setNumerotareRanduri({ randuriInSus: getRanduriInSus() });
          });
          addStepper("Câte rânduri în jos", getRanduriInJos, seteazaRanduriInJos, 1, 50, () => {
            mounted?.setNumerotareRanduri({ randuriInJos: getRanduriInJos() });
          });

          const liftTitle = document.createElement("p");
          liftTitle.className = "control-panel-lift-title";
          liftTitle.textContent = "Lift";
          mount.appendChild(liftTitle);

          addStepper("Transparență fundal alb lift", getLiftTransparenta, seteazaLiftTransparenta, 0, 100, () => {
            mounted?.setLift({ transparentaFundal: getLiftTransparenta() });
          });
          addRow("Afișează marginea liftului", getLiftMargine(), (checked) => {
            global.LayoutConfig?.set(LIFT_MARGINE_KEY, checked);
            mounted?.setLift({ margine: checked });
          });

          const fovTitle = document.createElement("p");
          fovTitle.className = "control-panel-lift-title";
          fovTitle.textContent = "Etichete (FOV Feedback Oranj Verde)";
          mount.appendChild(fovTitle);

          addRow("Pe buton", getFovButon(), (checked) => {
            global.LayoutConfig?.set(FOV_BUTON_KEY, checked);
            mounted?.setFov({ buton: checked });
          });
          addRow("Pe lift", getFovLift(), (checked) => {
            global.LayoutConfig?.set(FOV_LIFT_KEY, checked);
            mounted?.setFov({ lift: checked });
          });
          addRow("Cu animație pt. corect", getFovLiftCorect(), (checked) => {
            global.LayoutConfig?.set(FOV_LIFT_CORECT_KEY, checked);
            mounted?.setFov({ animatieCorect: checked });
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
