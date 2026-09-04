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

  // CP — Bara cu mere: poziție față de numerotare (sub implicit/deasupra) + transparență.
  const MERE_SUB_NUMEROTARE_KEY = "rigleMereSubNumerotare";
  const MERE_TRANSPARENTA_KEY = "rigleMereTransparenta";
  const MERE_TRANSPARENTA_IMPLICIT = 50;
  const getMereSubNumerotare = () => global.LayoutConfig?.get(MERE_SUB_NUMEROTARE_KEY, true) !== false;
  const getMereTransparenta = () =>
    global.LayoutConfig?.get(MERE_TRANSPARENTA_KEY, MERE_TRANSPARENTA_IMPLICIT) ?? MERE_TRANSPARENTA_IMPLICIT;
  function seteazaMereTransparenta(valoare) {
    const v = Math.max(0, Math.min(100, Math.round(valoare)));
    global.LayoutConfig?.set(MERE_TRANSPARENTA_KEY, v);
  }
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
  const FOV_LIFT_VITEZA_KEY = "rigleFovLiftDivizorViteza";
  const FOV_LIFT_VITEZA_IMPLICIT = 1; // 1 = viteza actuală, 10 = de 10x mai încet
  const getFovButon = () => global.LayoutConfig?.get(FOV_BUTON_KEY, true) !== false;
  const getFovLift = () => global.LayoutConfig?.get(FOV_LIFT_KEY, true) !== false;
  const getFovLiftCorect = () => global.LayoutConfig?.get(FOV_LIFT_CORECT_KEY, true) !== false;
  const getFovLiftViteza = () =>
    global.LayoutConfig?.get(FOV_LIFT_VITEZA_KEY, FOV_LIFT_VITEZA_IMPLICIT) ?? FOV_LIFT_VITEZA_IMPLICIT;

  // CP — Dara glorioasă: Lungime (0-10, cât de sus ajunge frontul de sus) / Desime
  // (0-100, cât de dese sunt dreptunghiurile — 100 = cadru lângă cadru).
  const DARA_LUNGIME_KEY = "rigleDaraLungime";
  const DARA_DESIME_KEY = "rigleDaraDesime";
  const DARA_LUNGIME_IMPLICIT = 10;
  const DARA_DESIME_IMPLICIT = 50;
  const getDaraLungime = () => global.LayoutConfig?.get(DARA_LUNGIME_KEY, DARA_LUNGIME_IMPLICIT) ?? DARA_LUNGIME_IMPLICIT;
  const getDaraDesime = () => global.LayoutConfig?.get(DARA_DESIME_KEY, DARA_DESIME_IMPLICIT) ?? DARA_DESIME_IMPLICIT;

  global.QuizRegistry.register({
    id: "rigle-cl1",
    title: "Adunari cu coloane verticale",
    description: "Măsoară suma de obiecte cu rigle (coloane). Facte a+b=? variabile.",
    order: 99, // ultimul în meniu; nu devine quiz implicit
    create() {
      let mounted = null;

      const urmatorulFact = () =>
        global.RigleFacte.genereazaFact({ sumaMin: getSumaMin(), sumaMax: getSumaMax() });

      // Tabelul declarativ de optiuni CP (documente de referinta/
      // standard-optiuni-cp.md). `rerandeaza`: doar Minim/Maxim (Suma
      // maxima) il folosesc — schimband unul, celalalt se re-clampeaza
      // (vezi seteazaSumaMin/seteazaSumaMax mai sus), deci trebuie
      // re-desenat tot panoul ca sa arate valoarea proaspata a amandurora
      // (acelasi tipar ca la campul "mutareColoane" din
      // tabla-inmultirii-tabel.js).
      function campurileCP(rerandeaza) {
        return [
          { cheie: "gridVertical", tip: "bifa", eticheta: "Vertical", grup: "Grila",
            get: getGridVertical,
            set: (v) => { global.LayoutConfig?.set(GRID_VERTICAL_KEY, v); mounted?.setGridLines({ vertical: v }); } },
          { cheie: "gridOrizontal", tip: "bifa", eticheta: "Orizontal",
            get: getGridOrizontal,
            set: (v) => { global.LayoutConfig?.set(GRID_ORIZONTAL_KEY, v); mounted?.setGridLines({ orizontal: v }); } },

          { cheie: "coloaneTreime", tip: "enum", stilAfisare: "radio", grup: "Poziție coloane",
            optiuni: [
              { valoare: true, text: "Fiecare coloană are o treime din spațiu" },
              { valoare: false, text: "În funcție de spațiu" },
            ],
            get: getColoaneTreime,
            set: (v) => { global.LayoutConfig?.set(COL_TREIME_KEY, v); mounted?.setColumnLayout({ treime: v }); } },

          { cheie: "sumaMin", tip: "numar", eticheta: "Minim", grup: "Suma maxima",
            min: 1, max: 30, get: getSumaMin, set: seteazaSumaMin,
            dupaSchimbare: () => { rerandeaza(); mounted?.reporneste(); } },
          { cheie: "sumaMax", tip: "numar", eticheta: "Maxim",
            min: 1, max: 30, get: getSumaMax, set: seteazaSumaMax,
            dupaSchimbare: () => { rerandeaza(); mounted?.reporneste(); } },

          { cheie: "numerotare", tip: "enum", stilAfisare: "radio", grup: "Numerotează rânduri din coloane",
            optiuni: [
              { valoare: "dezactivat", text: "Dezactivat" },
              { valoare: "toate", text: "Pe toate rândurile" },
              { valoare: "animat", text: "Animat fade-in pe coloana curentă" },
            ],
            get: getNumerotare,
            set: (v) => { global.LayoutConfig?.set(NUMEROTARE_KEY, v); mounted?.setNumerotareRanduri({ mod: v }); } },
          { cheie: "randuriInSus", tip: "numar", eticheta: "Câte rânduri în sus",
            min: 1, max: 50, get: getRanduriInSus, set: seteazaRanduriInSus,
            dupaSchimbare: () => mounted?.setNumerotareRanduri({ randuriInSus: getRanduriInSus() }) },
          { cheie: "randuriInJos", tip: "numar", eticheta: "Câte rânduri în jos",
            min: 1, max: 50, get: getRanduriInJos, set: seteazaRanduriInJos,
            dupaSchimbare: () => mounted?.setNumerotareRanduri({ randuriInJos: getRanduriInJos() }) },

          { cheie: "mereSubNumerotare", tip: "enum", stilAfisare: "radio", grup: "Bara cu mere",
            optiuni: [
              { valoare: true, text: "Sub numerotarea rândurilor" },
              { valoare: false, text: "Deasupra numerotării rândurilor" },
            ],
            get: getMereSubNumerotare,
            set: (v) => { global.LayoutConfig?.set(MERE_SUB_NUMEROTARE_KEY, v); mounted?.setPozitieMere({ subNumerotare: v }); } },
          { cheie: "mereTransparenta", tip: "numar", eticheta: "Transparență bară mere",
            min: 0, max: 100, get: getMereTransparenta, set: seteazaMereTransparenta,
            dupaSchimbare: () => mounted?.setPozitieMere({ transparenta: getMereTransparenta() }) },

          { cheie: "liftTransparenta", tip: "numar", eticheta: "Transparență fundal alb lift", grup: "Lift",
            min: 0, max: 100, get: getLiftTransparenta, set: seteazaLiftTransparenta,
            dupaSchimbare: () => mounted?.setLift({ transparentaFundal: getLiftTransparenta() }) },
          { cheie: "liftMargine", tip: "bifa", eticheta: "Afișează marginea liftului",
            get: getLiftMargine,
            set: (v) => { global.LayoutConfig?.set(LIFT_MARGINE_KEY, v); mounted?.setLift({ margine: v }); } },

          { cheie: "fovButon", tip: "bifa", eticheta: "Pe buton", grup: "Etichete (FOV Feedback Oranj Verde)",
            get: getFovButon,
            set: (v) => { global.LayoutConfig?.set(FOV_BUTON_KEY, v); mounted?.setFov({ buton: v }); } },
          { cheie: "fovLift", tip: "bifa", eticheta: "Pe lift",
            get: getFovLift,
            set: (v) => { global.LayoutConfig?.set(FOV_LIFT_KEY, v); mounted?.setFov({ lift: v }); } },
          { cheie: "fovLiftCorect", tip: "bifa", eticheta: "Cu animație pt. corect",
            get: getFovLiftCorect,
            set: (v) => { global.LayoutConfig?.set(FOV_LIFT_CORECT_KEY, v); mounted?.setFov({ animatieCorect: v }); } },
          { cheie: "fovLiftViteza", tip: "numar", eticheta: "Viteza pătrățelului", stilAfisare: "slider",
            min: 1, max: 10,
            formateazaAfisare: (v) => (Number(v) <= 1 ? "viteza actuală" : `de ${v}× mai încet`),
            get: getFovLiftViteza,
            set: (v) => { global.LayoutConfig?.set(FOV_LIFT_VITEZA_KEY, v); mounted?.setFov({ divizorViteza: v }); } },

          { cheie: "daraLungime", tip: "numar", eticheta: "Lungime dara", stilAfisare: "slider", grup: "Dara glorioasă",
            min: 0, max: 10, get: getDaraLungime,
            set: (v) => { global.LayoutConfig?.set(DARA_LUNGIME_KEY, v); mounted?.setDaraGlorioasa({ lungime: v }); } },
          { cheie: "daraDesime", tip: "numar", eticheta: "Desime dara", stilAfisare: "slider",
            min: 0, max: 100, get: getDaraDesime,
            set: (v) => { global.LayoutConfig?.set(DARA_DESIME_KEY, v); mounted?.setDaraGlorioasa({ desime: v }); } },
        ];
      }

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
            mereSubNumerotare: getMereSubNumerotare(),
            mereTransparenta: getMereTransparenta(),
            liftFundalTransparenta: getLiftTransparenta(),
            liftMargine: getLiftMargine(),
            fovButon: getFovButon(),
            fovLift: getFovLift(),
            fovLiftAnimatieCorect: getFovLiftCorect(),
            fovLiftDivizorViteza: getFovLiftViteza(),
            daraLungime: getDaraLungime(),
            daraDesime: getDaraDesime(),
            urmatorulFact,
          });
          mounted = global.RigleEngine.mount(hosts, cfg);
        },
        unmountArena() {
          if (mounted) mounted.destroy();
          mounted = null;
        },

        // CP — Rigle: Grilă (linii), Poziție coloane (treime/spațiu), Suma maxima,
        // Numerotează rânduri, Bara cu mere (poziție/transparență), Lift, Etichete, Dara glorioasă.
        appendRigleControlPanel(mount) {
          if (!mount) return;
          const rerandeaza = () => this.appendRigleControlPanel(mount);
          global.MotorOptiuniControlPanel.construiesteDOM(mount, campurileCP(rerandeaza));
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

        // Structura CP declarativă, raportată o singură dată către motorul
        // central (cerere user, 04.09.2026) — aceeași campurileCP() ca
        // panoul CP propriu. Fără QUIZ_ID in acest fișier (nu exista deja o
        // constantă) — literalul e identic cu id-ul din register() de mai jos.
        get controlPanel() {
          return { sectiuni: [{ id: "rigle-cl1", campuri: campurileCP(() => {}) }] };
        },
      };
    },
  });
})(window);
