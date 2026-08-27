(function (global) {
  "use strict";

  const QUIZ_ID = "multiplication-1120-v4-intensiv-multipli-234";
  const QUIZ_TITLE = "T*/ 11-20 - v4 - bag toate in joc, intensiv multipli 2 3 4";
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 10;
  const HINT = "Alege raspunsul corect.";

  // Domeniul v4: b merge 1..20 la fiecare nivel, decuplat de factorul A.
  const B_MIN = 1;
  const B_MAX = 20;
  const TOTAL_FACTS_PER_LEVEL = B_MAX - B_MIN + 1;
  const K_BATCH = 4;

  const SQ3_ID = "sq3FactorGroup";
  const SQ3_TRIGGER_EVERY_BASE_ANSWERS = 5;
  const SQ3_MAX_PER_LEVEL = 3;
  const SQ3_EXIT_CORRECT_COUNT = 3;
  const SQ3_ROTATE_EVERY_MAX = 5;
  const SQ3_EQ_FORM_MIN = 1;
  const SQ3_EQ_FORM_MAX = 24;

  // fg [12,14,16,18] a fost eliminat explicit (decizie user, 29.07.2026 —
  // "nu ma ajuta"), dupa ce a produs coincidente gen "12*12=?" la nivelul 2
  // (b=12 din fg coincide cu A=12 al nivelului).
  // fg [12,15,18] a fost eliminat explicit (decizie user, 05.08.2026) — elementele
  // lui sunt deja acoperite impreuna de [3,6,12,18] (are 12, 18) si [5,15] (are 15).
  const FG_LIST = [
    [2, 4, 8, 16],
    [4, 8, 12, 16],
    [2, 4, 6, 8],
    [5, 15],
    [3, 6, 9],
    [7, 11, 13, 17, 19],
    [3, 6, 12, 18],
    [3, 9, 18],
  ];

  const LEVEL_FACTOR_ANSWER_WINDOW = 10;
  const LEVEL_FACTOR_ANSWER_MAX_IN_WINDOW = 1;

  const SQ3_SHOW_STACK_KEY = "yl:mul1120v4:sq3ShowStack";
  const SQ3_HIGHLIGHT_CURRENT_KEY = "yl:mul1120v4:sq3HighlightCurrent";
  const SQ3_DIM_UNTESTED_KEY = "yl:mul1120v4:sq3DimUntested";
  const SQ3_ROTATE_EVERY_KEY = "yl:mul1120v4:sq3RotateEvery";
  const SQ3_EQ_FORM_COUNT_KEY = "yl:mul1120v4:sq3EqFormCount";

  // --- Subquiz 2 (VBS/SBS): ramane in cod, dar nu se mai declanseaza automat
  // (decizie user, 29.07.2026). Constantele si cheile lui raman neatinse, ca
  // sa nu schimbe comportamentul pastrat.
  const FACT_B_MIN = 2;
  const SQ2_FACT_COUNT_KEY = "yl:mul1120v4:sq2FactCount";
  const SQ2_EXIT_COUNT_KEY = "yl:mul1120v4:sq2ExitCount";
  const SQ2_EXIT_MODE_KEY = "yl:mul1120v4:sq2ExitMode";
  const SQ2_EQ_FORM_COUNT_KEY = "yl:mul1120v4:sq2EqFormCount:v2";
  const SQ2_INTENSIVE_MODE_KEY = "yl:mul1120v4:intensiveMode";
  const SQ2_SBS_ANSWER_FACTOR_KEY = "yl:mul1120v4:sbsAnswerFactor";
  const SQ2_SBS_ANSWER_PRODUCT_KEY = "yl:mul1120v4:sbsAnswerProduct";
  const SQ2_EQ_FORM_MIN = 1;
  const SQ2_EQ_FORM_MAX = 24;
  const SQ2_SBS_FACT_COUNT = 3;
  const SQ2_INTENSIVE_MODES = ["vbs", "sbs", "alternate", "random"];
  const SQ2_VBS_ID = "sq2EffVbs";
  const SQ2_SBS_ID = "sq2EffSbs";

  // --- Subquiz 5 (Fluent party): genereaza fluenta deja castigata (de regula
  // pe 1-2 forme de ecuatie) catre toate cele 24 — vezi
  // documente de referinta/PLAN-v4-sq5-fluent-party.md.
  const SQ5_ID = "sq5FluentParty";
  const SQ5_MODE_KEY = "yl:mul1120v4:sq5Mode";
  const SQ5_ENTRY_KEY = "yl:mul1120v4:sq5Entry";
  const SQ5_TURNS_KEY = "yl:mul1120v4:sq5TurnsPerFact";
  const SQ5_EQ_FORM_COUNT_KEY = "yl:mul1120v4:sq5EqFormCount";
  const SQ5_EQ_FORM_LAST_DAY_KEY = "yl:mul1120v4:sq5EqFormLastDay";
  const SQ5_EQ_FORM_MANUAL_KEY = "yl:mul1120v4:sq5EqFormManual";
  const SQ5_SBS_PCT_KEY = "yl:mul1120v4:sq5SbsPct";
  const SQ5_BLOC_LEN_KEY = "yl:mul1120v4:sq5BlocLen";
  const SQ5_ROL_CONST_PCT_KEY = "yl:mul1120v4:sq5RolConstPct";

  const SQ5_MODES = ["A", "B"];
  const SQ5_ENTRIES = ["levelStart", "levelEnd", "random"];
  const SQ5_TURNS_MIN = 1;
  const SQ5_TURNS_MAX = 10;
  const SQ5_TURNS_DEFAULT = 3;
  const SQ5_EQ_FORM_MIN = 1;
  const SQ5_EQ_FORM_MAX = 24;
  const SQ5_EQ_FORM_DEFAULT = 4;
  const SQ5_PCT_MIN = 0;
  const SQ5_PCT_MAX = 100;
  const SQ5_PCT_STEP = 5;
  const SQ5_SBS_PCT_DEFAULT = 50;
  const SQ5_ROL_CONST_PCT_DEFAULT = 50;
  const SQ5_BLOC_LEN_MIN = 3;
  const SQ5_BLOC_LEN_MAX = 30;
  const SQ5_BLOC_LEN_DEFAULT = 12;
  // D14: best-of-10, nu "primul care trece" — masurat si validat cu userul
  // (PLAN §0): la N=4 eq forms (default), 53% din triplete reusesc oricum;
  // 10 incercari sunt suficiente ca sa gaseasca varianta cu cele mai variate
  // facte nesatisfacute, fara sa coste vizibil (sub 1ms/bloc).
  const SQ5_TRIPLET_ATTEMPTS = 10;

  const QF_PROFILE = {
    f1_initial: true,
    f1_comutat: true,
    f1_complementar: true,
    f1_complementar_comutat: true,
    doua_nr_in_STANGA: true,
    doua_nr_in_DREAPTA: true,
    trei_pozitii_pt_cate_un_numar: true,
    doua_pozitii_pt_cate_un_semn_operator_matematic: false,
  };

  function factorForLevel(level) {
    return 10 + level;
  }

  function clampChoice(value, allowed, fallback) {
    const num = Number(value);
    return allowed.includes(num) ? num : fallback;
  }

  function readNumberSetting(key, allowed, fallback) {
    try {
      return clampChoice(global.localStorage?.getItem?.(key), allowed, fallback);
    } catch (err) {
      return fallback;
    }
  }

  function rangeChoices(min, max, step = 1) {
    return Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, index) => min + index * step);
  }

  // `readNumberSetting` foloseste `Number(localStorage.getItem(key))` ca sa
  // decida daca valoarea salvata e "valida" — dar `Number(null) === 0`, deci
  // o cheie NICIODATA salvata pica pe 0, nu pe fallback, de fiecare data cand
  // 0 e chiar el o alegere valida (exact cazul procentelor, min=0). Sq3/sq2
  // nu au lovit asta (rangeChoices-urile lor pornesc de la valori diferite de
  // fallback-ul implicit), dar sq5SbsPct/sq5RolConstPct (default 50, min 0)
  // l-ar lovi direct — cheie nescrisa inca ar citi 0%, nu 50%. Citire proprie,
  // separata, ca sa nu schimbam comportamentul existent al lui readNumberSetting.
  function readPercentSetting(key, fallback) {
    let stored = null;
    try {
      stored = global.localStorage?.getItem?.(key) ?? null;
    } catch (err) {
      stored = null;
    }
    if (stored === null) return fallback;
    const num = Number(stored);
    if (!Number.isFinite(num)) return fallback;
    const pasificat = Math.round(num / SQ5_PCT_STEP) * SQ5_PCT_STEP;
    return Math.max(SQ5_PCT_MIN, Math.min(SQ5_PCT_MAX, pasificat));
  }

  function writeSetting(key, value) {
    try {
      global.localStorage?.setItem?.(key, String(value));
    } catch (err) {
      // Ignore storage failures.
    }
  }

  function readExitMode() {
    try {
      const stored = global.localStorage?.getItem?.(SQ2_EXIT_MODE_KEY);
      return stored === "any" ? "any" : "correct";
    } catch (err) {
      return "correct";
    }
  }

  function readChoiceSetting(key, allowed, fallback) {
    try {
      const stored = global.localStorage?.getItem?.(key);
      return allowed.includes(stored) ? stored : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function readBoolSetting(key, fallback) {
    try {
      const stored = global.localStorage?.getItem?.(key);
      if (stored === "true") return true;
      if (stored === "false") return false;
      return fallback;
    } catch (err) {
      return fallback;
    }
  }

  function buildMulDivEqFormOptions(correctNum, productNum, shuffle) {
    const correct = Number(correctNum);
    const product = Number(productNum);
    const wrong = [];

    function addWrong(value) {
      if (!Number.isFinite(value) || value < 0 || value === correct || wrong.includes(value)) {
        return;
      }
      wrong.push(value);
    }

    if (correct === product) {
      [10, 20, 30].forEach((delta) => {
        addWrong(correct - delta);
        addWrong(correct + delta);
      });
    } else {
      [1, 2, 3].forEach((delta) => {
        addWrong(correct - delta);
        addWrong(correct + delta);
      });
    }

    while (wrong.length < 2) addWrong(correct + wrong.length + 1);

    const options = shuffle([String(correct), String(wrong[0]), String(wrong[1])]);
    return { options, correctIndex: options.indexOf(String(correct)) };
  }

  function createQuiz(config = {}) {
    const quizId = config.quizId ?? QUIZ_ID;
    const quizName = config.quizName ?? QUIZ_TITLE;
    const jurnalIntrebariActiv = config.jurnalIntrebariActiv === true;
    const { shuffle } = global.GameUtils;
    const random = typeof config.random === "function" ? config.random : Math.random;
    const QFG = global.QFGenerator;
    const Catalog = global.FactCatalog;
    const Sequencer = global.FactWindowSequencer;
    const qfTypes = QFG.getActiveQFTypes(QF_PROFILE).filter(
      (type) => type.answerType === "number"
    );

    // Sq3 (grup de factori): doar cele 4 forme cu necunoscuta = produsul (c),
    // cu rocada a<->b, cerute explicit de user (03.08.2026):
    //   a*b=?  (f1_initial,  STANGA, pos4)
    //   ?=a*b  (f1_initial,  DREAPTA, pos0)
    //   b*a=?  (f1_comutat,  STANGA, pos4)
    //   ?=b*a  (f1_comutat,  DREAPTA, pos0)
    // Exclude explicit formele cu necunoscuta = un factor (ex. ?*b=c, a*?=c)
    // si formele de tip impartire din f1_complementar/f1_complementar_comutat
    // (ex. c:b=a). Nu afecteaza sq1 (baza) sau sq2, care raman pe qfTypes complet.
    const sq3QfTypes = qfTypes.filter(
      (type) =>
        (type.f1 === "f1_initial" || type.f1 === "f1_comutat") &&
        ((type.f2 === "doua_nr_in_STANGA" && type.pos === 4) ||
          (type.f2 === "doua_nr_in_DREAPTA" && type.pos === 0))
    );

    let level = MIN_LEVEL;
    let completed = false;
    let orchestrator = null;
    let sq3Count = 0;

    // Sursa de fluenta (snapshot din jurnal). Cusatura de test: config.fluentaSursa
    // injecteaza direct o sursa sincrona, ocolind IndexedDB si SnapshotFluenta in
    // intregime (R9 din plan). In productie, SnapshotFluenta.pregatesteOData()
    // porneste la INCARCAREA SCRIPTULUI (js/snapshot-fluenta.js), nu aici —
    // pana se rezolva, pickNextRound() intoarce runda "Se pregateste quizul...",
    // nu porneste orchestratorul pe o sursa goala (P1 din plan).
    const SURSA_FLUENTA_GOALA = { scorPtFact: () => 0, starePtFact: () => "netestat" };
    let mostratRundaIncarcare = false;
    let onFluentaReadyCallback = null;

    function getFluentaSursa() {
      return config.fluentaSursa ?? global.SnapshotFluenta?.iaSincron?.() ?? SURSA_FLUENTA_GOALA;
    }

    function fluentaEsteGata() {
      return Boolean(config.fluentaSursa) || Boolean(global.SnapshotFluenta?.iaSincron?.());
    }

    if (!config.fluentaSursa && global.SnapshotFluenta?.pregatesteOData) {
      global.SnapshotFluenta
        .pregatesteOData()
        .then(() => {
          // Repornim runda doar daca userul a apucat sa vada ecranul de
          // asteptare — altfel am intrerupe inutil o runda care oricum a
          // pornit deja pe date reale (criteriul 11 din plan).
          if (mostratRundaIncarcare) onFluentaReadyCallback?.();
        })
        .catch(() => {});
    }

    function loadingRound() {
      mostratRundaIncarcare = true;
      return {
        prompt: "Se pregătește quizul…",
        options: ["", "", ""],
        correctIndex: 0,
        metadata: { subquiz: null, loading: true },
        hintMessage: "",
      };
    }

    // CP SQ3 — setari persistate simplu (fara butoane "md", decizie user 29.07.2026).
    let sq3ShowStack = readBoolSetting(SQ3_SHOW_STACK_KEY, true);
    let sq3HighlightCurrent = readBoolSetting(SQ3_HIGHLIGHT_CURRENT_KEY, true);
    let sq3DimUntested = readBoolSetting(SQ3_DIM_UNTESTED_KEY, true);
    let sq3RotateEvery = readNumberSetting(SQ3_ROTATE_EVERY_KEY, rangeChoices(0, SQ3_ROTATE_EVERY_MAX), 1);
    let sq3EqFormCount = readNumberSetting(
      SQ3_EQ_FORM_COUNT_KEY,
      rangeChoices(SQ3_EQ_FORM_MIN, SQ3_EQ_FORM_MAX),
      4
    );

    // Subquiz 2 (VBS/SBS) — ramane in cod, dar nu se mai declanseaza automat.
    let sq2FactCount = readNumberSetting(SQ2_FACT_COUNT_KEY, [1, 2, 3, 4], 2);
    let sq2ExitCount = readNumberSetting(SQ2_EXIT_COUNT_KEY, [3, 4, 5], 3);
    let sq2ExitMode = readExitMode();
    let sq2EqFormCount = readNumberSetting(
      SQ2_EQ_FORM_COUNT_KEY,
      rangeChoices(SQ2_EQ_FORM_MIN, SQ2_EQ_FORM_MAX),
      SQ2_EQ_FORM_MIN
    );
    let intensiveMode = readChoiceSetting(SQ2_INTENSIVE_MODE_KEY, SQ2_INTENSIVE_MODES, "vbs");
    let nextAlternateIntensiveTarget = SQ2_VBS_ID;
    let sbsAnswerFromFactor = readBoolSetting(SQ2_SBS_ANSWER_FACTOR_KEY, true);
    let sbsAnswerFromProduct = readBoolSetting(SQ2_SBS_ANSWER_PRODUCT_KEY, false);
    ensureSbsAnswerSource();

    // CP SQ5 — setari persistate simplu (fara butoane "md", ca la sq3).
    let sq5Mode = readChoiceSetting(SQ5_MODE_KEY, SQ5_MODES, "A");
    let sq5Entry = readChoiceSetting(SQ5_ENTRY_KEY, SQ5_ENTRIES, "levelStart");
    let sq5TurnsPerFact = readNumberSetting(SQ5_TURNS_KEY, rangeChoices(SQ5_TURNS_MIN, SQ5_TURNS_MAX), SQ5_TURNS_DEFAULT);
    let sq5EqFormCount = readNumberSetting(
      SQ5_EQ_FORM_COUNT_KEY,
      rangeChoices(SQ5_EQ_FORM_MIN, SQ5_EQ_FORM_MAX),
      SQ5_EQ_FORM_DEFAULT
    );
    let sq5EqFormManual = readBoolSetting(SQ5_EQ_FORM_MANUAL_KEY, false);
    let sq5SbsPct = readPercentSetting(SQ5_SBS_PCT_KEY, SQ5_SBS_PCT_DEFAULT);
    let sq5BlocLen = readNumberSetting(SQ5_BLOC_LEN_KEY, rangeChoices(SQ5_BLOC_LEN_MIN, SQ5_BLOC_LEN_MAX), SQ5_BLOC_LEN_DEFAULT);
    let sq5RolConstPct = readPercentSetting(SQ5_ROL_CONST_PCT_KEY, SQ5_ROL_CONST_PCT_DEFAULT);

    // Level 0 (mod A) — traiesc IN AFARA lui `shared` si nu se ating de
    // `resetLevelState()`, ca sa supravietuiasca schimbarii de nivel (R7 din
    // plan): altfel fiecare click pe butoanele 1-10 ar reporni o runda de
    // ~150 de intrebari.
    let level0Done = false;
    let inLevel0 = false;

    // Declansatorul "random" al lui sq5 (mod B) — acelasi tipar ca sq3Count:
    // se reseteaza la fiecare nivel, in `resetLevelState()`.
    let sq5RandomFired = false;
    let sq5RandomTargetK = 1;
    let sq5RandomEligibleCount = 0;

    const shared = {
      baseState: null,
      sq3State: null,
      sq2State: null,
      sq5State: null,
      usedFgIndexes: new Set(),
      levelFactorAnswerHistory: [],
    };
    let questionInstanceSequence = 0;

    function allBs() {
      return Array.from({ length: TOTAL_FACTS_PER_LEVEL }, (_, index) => B_MIN + index);
    }

    function isValidB(b) {
      const num = Number(b);
      return Number.isFinite(num) && num >= B_MIN && num <= B_MAX;
    }

    function subquizName(subquizId) {
      if (subquizId === SQ3_ID) return "Subquiz 3: grup de factori";
      if (subquizId === SQ2_VBS_ID) return "Subquiz 2: Intensiv cu eff VBS";
      if (subquizId === SQ2_SBS_ID) return "Subquiz 2: Intensiv SBS";
      if (subquizId === SQ5_ID) return "Subquiz 5: Fluent party";
      return subquizId === "base" ? "Subquiz 1: baza" : null;
    }

    function getContextJurnal(state) {
      if (!jurnalIntrebariActiv) return null;
      const metadata = state?.metadata ?? {};
      return {
        quiz_name: quizName,
        subquiz_name: subquizName(metadata.subquiz),
        intrebare: state?.prompt == null ? null : String(state.prompt),
        fact: metadata.fact ?? null,
        quiz_id: quizId,
        subquiz_id: metadata.subquiz ?? null,
        fact_id: metadata.factId ?? null,
        eq_form: metadata.eqForm ?? null,
        hints_aratate_pt_raspuns: null,
        extra: {},
      };
    }

    function appendJurnalButtons(mount) {
      if (!jurnalIntrebariActiv) return;
      const row = document.createElement("div");
      row.className = "control-panel-lift-field";
      const buttonAfisareExistenta = document.createElement("button");
      buttonAfisareExistenta.type = "button";
      buttonAfisareExistenta.textContent = "Afisare log";
      buttonAfisareExistenta.addEventListener("click", () => {
        const url = global.location
          ? new URL("jurnal-intrebari.html", global.location.href).href
          : "jurnal-intrebari.html";
        global.open?.(url, "_blank");
      });

      const buttonTabulator = document.createElement("button");
      buttonTabulator.type = "button";
      buttonTabulator.textContent = "View logs in Tabulator";
      buttonTabulator.addEventListener("click", () => {
        global.deschideVizualizareLogs?.();
      });

      const buttonTabulatorTranspus = document.createElement("button");
      buttonTabulatorTranspus.type = "button";
      buttonTabulatorTranspus.textContent = "View logs in Tabulator - Transposed";
      buttonTabulatorTranspus.addEventListener("click", () => {
        global.deschideVizualizareLogsTranspuse?.();
      });

      row.append(buttonAfisareExistenta, buttonTabulator, buttonTabulatorTranspus);
      mount.appendChild(row);
    }

    function makeFact(b, a = factorForLevel(level)) {
      return Catalog.createFact({
        operation: "mul",
        values: { a, b },
      });
    }

    function canUseLevelFactorAnswer(state) {
      const history = shared.levelFactorAnswerHistory || state?.levelFactorAnswerHistory || [];
      const recent = history.slice(-(LEVEL_FACTOR_ANSWER_WINDOW - 1));
      return recent.filter(Boolean).length < LEVEL_FACTOR_ANSWER_MAX_IN_WINDOW;
    }

    function noteLevelFactorAnswer(state, isLevelFactorAnswer) {
      shared.levelFactorAnswerHistory = shared.levelFactorAnswerHistory || [];
      shared.levelFactorAnswerHistory.push(Boolean(isLevelFactorAnswer));
      if (shared.levelFactorAnswerHistory.length > LEVEL_FACTOR_ANSWER_WINDOW - 1) {
        shared.levelFactorAnswerHistory.shift();
      }
      if (state) {
        state.levelFactorAnswerHistory = [...shared.levelFactorAnswerHistory];
      }
    }

    // `opts.a` — factorul REAL al factului, cu default cel al nivelului curent.
    // Diferă doar in level 0 al lui sq5 (§4, problema P3 din plan): acolo o
    // intrebare poate fi despre o alta subtabla decat cea a nivelului curent
    // (care ramane pe 1 tot timpul level-ului 0), si `a` trebuie sa fie al
    // factului, nu al nivelului — altfel jurnalul scrie o celula gresita,
    // tacut (ex. "17*8" logat ca "11*8").
    // `opts.ignoreLevelFactorGuard` — dezactiveaza `canUseLevelFactorAnswer`
    // fara sa schimbe contractul pt. sq1/sq2/sq3: in level 0 nu exista un
    // "factor al nivelului" comun peste multe subtable diferite, deci regula
    // anti-ghicit n-are obiect (R8 din plan) — istoricul comun ramane
    // neatins, doar nu e consultat pt. aceste intrebari.
    function questionItem(prompt, correct, b, product, subquizId, extraMetadata = {}, opts = {}) {
      const a = opts.a ?? factorForLevel(level);
      const fact = makeFact(b, a);
      const opt = buildMulDivEqFormOptions(correct, product, shuffle);
      return {
        prompt,
        correctAnswer: correct,
        options: opt.options,
        correctIndex: opt.correctIndex,
        metadata: {
          questionInstanceId: `${quizId}:${++questionInstanceSequence}`,
          subquiz: subquizId,
          factA: a,
          factB: b,
          product,
          fact: `${a}*${b}=${product}`,
          factId: fact.factId,
          eqForm: prompt,
          ...extraMetadata,
        },
      };
    }

    function fallbackQuestionForB(b, subquizId, state, opts = {}) {
      const a = opts.a ?? factorForLevel(level);
      const product = a * b;
      const shouldAvoidLevelFactor = !opts.ignoreLevelFactorGuard && !canUseLevelFactorAnswer(state);

      if (shouldAvoidLevelFactor && product === a) {
        const correct = b;
        if (!opts.ignoreLevelFactorGuard) noteLevelFactorAnswer(state, correct === a);
        return questionItem(
          `${a}*?=${product}`,
          correct,
          b,
          product,
          subquizId,
          { fallback: true, avoidedLevelFactorAnswer: true },
          opts
        );
      }

      const correct = product;
      if (!opts.ignoreLevelFactorGuard) noteLevelFactorAnswer(state, correct === a);
      return questionItem(`${a}*${b}=?`, correct, b, product, subquizId, { fallback: true }, opts);
    }

    function qfTypesForSubquiz(subquizId) {
      if (subquizId === SQ2_VBS_ID) return qfTypes.slice(0, sq2EqFormCount);
      if (subquizId === SQ3_ID) return sq3QfTypes.slice(0, sq3EqFormCount);
      return qfTypes;
    }

    function buildQuestionForB(b, subquizId = "base", state = null, opts = {}) {
      const a = opts.a ?? factorForLevel(level);
      const product = a * b;
      const fact = makeFact(b, a);
      const allowLevelFactorAnswer = opts.ignoreLevelFactorGuard || canUseLevelFactorAnswer(state);

      for (const type of shuffle(qfTypesForSubquiz(subquizId))) {
        const rendered = QFG.renderQF(type, fact);
        if (!rendered || rendered.answerType !== "number") continue;
        const correct = Number(rendered.correctAnswer);
        if (!Number.isFinite(correct)) continue;
        if (correct === a && !allowLevelFactorAnswer) continue;
        if (!opts.ignoreLevelFactorGuard) noteLevelFactorAnswer(state, correct === a);
        return questionItem(rendered.prompt, correct, b, product, subquizId, { qfTypeId: type.id }, opts);
      }

      return fallbackQuestionForB(b, subquizId, state, opts);
    }

    function factLabel(b, a = factorForLevel(level)) {
      return `${a}*${b}`;
    }

    function roundViewFrom(runtime, extra = {}) {
      return runtime.view({
        hintMessage: HINT,
        ...extra,
      });
    }

    // Motor 3 butoane (M3B) — vezi documente de referinta/PLAN-motor-comun-raspuns.md, Faza E.
    // Fiecare subquiz de mai jos da doar date (esteCorect/generator/actiuni/mesaje);
    // subquiz-definition.js construieste UN SINGUR Motor3Butoane per subquiz activ (nu unul
    // nou la fiecare apasare, ca in tiparul dinainte de Faza E) si deleaga orice apasare la
    // el. Fixul de "pop fara view" (necesar ca `onResume` sa nu fie ingropat de view-ul
    // automat al M3B) e centralizat acum in subquiz-definition.js.
    //
    // `esteCorect` pastrat identic cu vechiul cod (Number(...) === Number(...), fara fallback
    // pe string). Mesajul de gresit ("${alesul} nu e bun.", FARA "Mai incearca!" — diferit de
    // v2-modular) pastrat identic.
    //
    // CORECTIE INTENTIONATA majora, mostenita din migrarea la Motor3Butoane (Faza D, Lotul 4)
    // — acest fisier e locul unde a trait bug-ul ORIGINAL sq3/sq5 care a pornit tot refactorul.
    // Politica de avans (nu doar eticheta) reparata atunci: toate declansatoarele numara doar
    // raspunsuri REZOLVATE, niciun exit/push/pop nu se declanseaza pe gresit, plasa de
    // siguranta la sq3 (`SQ3_EXIT_MAX_ATTEMPTS`) eliminata complet. Nu se re-repara acum.
    const esteCorectV4 = (it, idx) => Number(it.options[idx]) === Number(it.correctAnswer);
    const mesajeStandard = {
      corect: "Corect!",
      gresit: (ctx) => `${ctx.alesul} nu e bun.`,
    };

    // ---- Subquiz 1 (baza): acoperire, fara repetitii -----------------------

    function nextCoverageB(state) {
      // Un b din coada poate fi acoperit "din alta parte" intre timp (sq3
      // alege un fg care se poate suprapune cu ce mai era neconsumat in
      // batch-ul curent al lui sq1) — il scoatem inainte sa decidem daca mai
      // e nevoie de reumplere, altfel s-ar cere din nou un fact deja acoperit.
      state.queue = state.queue.filter((b) => !state.covered.has(b));
      if (!state.queue.length) {
        const remaining = allBs()
          .filter((b) => !state.covered.has(b))
          .slice(0, K_BATCH);
        state.queue = shuffle(remaining);
      }
      return state.queue.shift() ?? null;
    }

    function lexLess(x, y) {
      const n = Math.min(x.length, y.length);
      for (let i = 0; i < n; i += 1) {
        if (x[i] !== y[i]) return x[i] < y[i];
      }
      return x.length < y.length;
    }

    // ---- Subquiz 3: alegerea grupului de factori (fg) ----------------------

    function alegeFG() {
      const A = factorForLevel(level);
      const covered = shared.baseState?.covered ?? new Set();
      let best = null;

      FG_LIST.forEach((fg, index) => {
        if (shared.usedFgIndexes.has(index)) return;
        const scoruri = fg.map((b) => getFluentaSursa().scorPtFact(A, b));
        const medie = scoruri.reduce((sum, v) => sum + v, 0) / fg.length;
        const acoperiteNr = fg.filter((b) => covered.has(b)).length;
        const acoperire = acoperiteNr / fg.length;
        const scor = (medie + 1) * (acoperire + 2);

        if (
          !best ||
          scor < best.scor - 1e-9 ||
          (Math.abs(scor - best.scor) < 1e-9 && lexLess(fg, best.fg))
        ) {
          best = { index, fg, scor };
        }
      });

      return best;
    }

    function exitPolicyForB(A, b, covered) {
      const sursa = getFluentaSursa();
      const stare = sursa.starePtFact ? sursa.starePtFact(A, b) : "netestat";
      const fluent = stare === "fluent";
      if (!fluent) return "normal";
      return covered.has(b) ? "skip" : "once";
    }

    function maybeEnterSq3(state, reason) {
      if (sq3Count >= SQ3_MAX_PER_LEVEL) return null;
      const picked = alegeFG();
      if (!picked) return null;

      const A = factorForLevel(level);
      const covered = shared.baseState?.covered ?? new Set();
      const exitPolicyByB = {};
      picked.fg.forEach((b) => {
        exitPolicyByB[b] = exitPolicyForB(A, b, covered);
      });
      // Exceptie facte fluente (user, 05.08.2026): daca TOATE factele fg-ului
      // ales sunt deja fluente si acoperite in sesiunea curenta (nivelul
      // curent), nu mai e nimic de intrebat — nu intram deloc in sq3 pt.
      // acest declansator (fg-ul ramane neutilizat, poate fi reconsiderat).
      const totulSarit = picked.fg.every((b) => exitPolicyByB[b] === "skip");
      if (totulSarit) return null;

      shared.usedFgIndexes.add(picked.index);
      sq3Count += 1;
      state.wrongFacts = [];

      return {
        action: "push",
        targetId: SQ3_ID,
        payload: { bs: picked.fg, reason, exitPolicyByB },
        view: {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Subquiz 3: ${picked.fg.map((b) => `${factorForLevel(level)}*${b}`).join(", ")}`,
        },
      };
    }

    // ---- Subquiz 3: rulare, stack, rotatie de forme -------------------------

    // Prag de iesire per fact, cu exceptia facte fluente (user, 05.08.2026):
    //   "normal" — regula standard: >=3 corecte. CORECTAT: plasa de siguranta
    //              (>=5 incercari, indiferent de corectitudine) a fost
    //              ELIMINATA — decizie fermă a userului (Faza D, Lotul 4).
    //   "once"   — fact fluent, dar netestat inca in sesiunea curenta (nivelul
    //              curent): un singur raspuns CORECT e suficient (nu mai
    //              "corect sau gresit" — CORECTAT, acelasi motiv).
    //   "skip"   — fact fluent SI deja testat in sesiunea curenta: nu mai e
    //              rulat deloc (dar ramane vizibil in stack, bifat — vezi
    //              renderStackHtml).
    function factDone(state, b) {
      const policy = state.exitPolicyByB?.[b] ?? "normal";
      if (policy === "skip") return true;
      if (policy === "once") return (state.correctCountsByB[b] ?? 0) >= 1;
      return (state.correctCountsByB[b] ?? 0) >= SQ3_EXIT_CORRECT_COUNT;
    }

    function notDoneFacts(state) {
      return state.facts.filter((b) => !factDone(state, b));
    }

    function nextSq3B(state) {
      const pool = notDoneFacts(state);
      if (!pool.length) return state.facts[0];
      if (!state.queue.length) {
        const batch = shuffle(pool);
        if (batch.length > 1 && batch[0] === state.lastFactB) {
          const idx = batch.findIndex((b) => b !== state.lastFactB);
          if (idx > 0) {
            const tmp = batch[0];
            batch[0] = batch[idx];
            batch[idx] = tmp;
          }
        }
        state.queue = batch;
      }
      return state.queue.shift();
    }

    function isDegenerateFormForFg(type, A, fg) {
      return fg.some((b) => {
        const fact = makeFact(b);
        const rendered = QFG.renderQF(type, fact);
        return !rendered || rendered.answerType !== "number" || Number(rendered.correctAnswer) === A;
      });
    }

    function eligibleStackForms(A, fg) {
      const pool = sq3QfTypes.slice(0, sq3EqFormCount);
      return pool.filter((type) => !isDegenerateFormForFg(type, A, fg));
    }

    function effectiveRotateEvery(fgSize) {
      return Math.max(0, Math.min(sq3RotateEvery, fgSize));
    }

    function pickStackFormType(state, A, fg) {
      const poolKey = `${A}:${sq3EqFormCount}:${fg.join(",")}`;
      if (state.formPoolKey !== poolKey) {
        state.formPool = eligibleStackForms(A, fg);
        state.formPoolKey = poolKey;
        state.formIndex = 0;
        state.formStepCounter = 0;
      }
      if (!state.formPool.length) return null;

      const rotateEvery = effectiveRotateEvery(fg.length);
      if (rotateEvery > 0) {
        if (state.formStepCounter > 0 && state.formStepCounter % rotateEvery === 0) {
          state.formIndex = (state.formIndex + 1) % state.formPool.length;
        }
        state.formStepCounter += 1;
      }
      return state.formPool[state.formIndex % state.formPool.length];
    }

    function renderStackHtml(A, fg, type, currentB, state) {
      const rows = fg.map((b) => {
        const fact = makeFact(b);
        const rendered = QFG.renderQF(type, fact);
        const promptText = rendered?.prompt ?? `${A}*${b}=?`;
        const isCurrent = b === currentB;
        const isSarit = (state?.exitPolicyByB?.[b] ?? "normal") === "skip";
        const classes = ["fg-stack-row"];
        if (isSarit) {
          classes.push("fg-stack-row--sarit");
        } else {
          if (isCurrent && sq3HighlightCurrent) classes.push("fg-stack-row--curent");
          if (!isCurrent && sq3DimUntested) classes.push("fg-stack-row--netestat");
        }
        const text = isSarit ? `\u2713 ${promptText}` : promptText;
        return `<div class="${classes.join(" ")}">${text}</div>`;
      });
      return `<div class="fg-stack">${rows.join("")}</div>`;
    }

    function buildStackQuestion(b, state) {
      const A = factorForLevel(level);
      const fg = state.facts;
      const type = pickStackFormType(state, A, fg);
      if (!type) return buildQuestionForB(b, SQ3_ID, state);

      const fact = makeFact(b);
      const rendered = QFG.renderQF(type, fact);
      if (!rendered || rendered.answerType !== "number") {
        return buildQuestionForB(b, SQ3_ID, state);
      }

      const correct = Number(rendered.correctAnswer);
      const product = A * b;
      const opt = buildMulDivEqFormOptions(correct, product, shuffle);

      return {
        prompt: rendered.prompt,
        promptHtml: renderStackHtml(A, fg, type, b, state),
        questionFormat: "fg-stack",
        correctAnswer: correct,
        options: opt.options,
        correctIndex: opt.correctIndex,
        metadata: {
          questionInstanceId: `${quizId}:${++questionInstanceSequence}`,
          subquiz: SQ3_ID,
          factA: A,
          factB: b,
          product,
          fact: `${A}*${b}=${product}`,
          factId: fact.factId,
          eqForm: rendered.prompt,
          qfTypeId: type.id,
        },
      };
    }

    function handleIntensiveTimeout({ runtime }) {
      return {
        action: "stay",
        view: roundViewFrom(runtime, {
          outcome: "round",
          resetFall: true,
        }),
      };
    }

    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "base",
        title: "baza",
        hintMessage: HINT,
        esteCorect: esteCorectV4,
        mesaje: mesajeStandard,
        initialState() {
          const state = {
            covered: new Set(),
            queue: [],
            wrongFacts: [],
            questionCount: 0,
            correctCount: 0,
            currentFactB: null,
            levelFactorAnswerHistory: [],
          };
          shared.baseState = state;
          return state;
        },
        generator({ state }) {
          shared.baseState = state;
          const b = nextCoverageB(state) ?? B_MIN;
          const item = buildQuestionForB(b, "base", state);
          state.currentFactB = item.metadata.factB;
          return item;
        },
        actiuni: {
          dupaApasare(ctx) {
            if (!ctx.corect) {
              const factB = ctx.item.metadata.factB;
              if (!ctx.stare.wrongFacts.includes(factB)) ctx.stare.wrongFacts.push(factB);
            }
          },
          dupaRaspunsCorect(ctx) {
            const state = ctx.stare;
            const factB = ctx.item.metadata.factB;
            state.questionCount += 1;
            state.correctCount += 1;
            state.covered.add(factB);

            if (state.covered.size >= TOTAL_FACTS_PER_LEVEL) {
              return {
                action: "exit",
                reason: "levelCovered",
                view: { flash: "win", message: "Subquiz 1 baza terminat, next level" },
              };
            }

            if (state.wrongFacts.length >= 2) {
              const command = maybeEnterSq3(state, "twoWrongFacts");
              if (command) return command;
              const sq5Command = maybeEnterSq5Random(state);
              if (sq5Command) return sq5Command;
            }

            if (state.questionCount % SQ3_TRIGGER_EVERY_BASE_ANSWERS === 0) {
              const command = maybeEnterSq3(state, "baseFiveFacts");
              if (command) return command;
              const sq5Command = maybeEnterSq5Random(state);
              if (sq5Command) return sq5Command;
            }
            // altfel: ramane in "base" — Motor3Butoane cere generator-ul automat.
          },
        },
        onResume({ runtime }) {
          if (runtime?.getState) shared.baseState = runtime.getState();
          const state = shared.baseState;

          if (state && state.covered.size >= TOTAL_FACTS_PER_LEVEL) {
            return {
              action: "exit",
              reason: "levelCoveredAfterSq3",
              view: {
                outcome: "step-correct",
                correct: true,
                bounce: true,
                flash: "win",
                message: "Subquiz 1 baza terminat, next level",
              },
            };
          }

          runtime.nextItem({ reason: "resumeFromSq3" });
          return {
            action: "continue",
            view: roundViewFrom(runtime, {
              outcome: "step-correct",
              correct: true,
              bounce: true,
              message: "Inapoi la Subquiz 1 baza.",
            }),
          };
        },
        onTimeout({ runtime }) {
          return {
            action: "stay",
            view: roundViewFrom(runtime, {
              outcome: "round",
              resetFall: true,
            }),
          };
        },
      });
    }

    function sq3Definition() {
      return global.SubquizDefinition.define({
        id: SQ3_ID,
        title: "Intensiv grup de factori",
        hintMessage: HINT,
        esteCorect: esteCorectV4,
        mesaje: mesajeStandard,
        initialState({ payload }) {
          const bs = [...new Set((payload?.bs ?? []).map(Number))].filter(isValidB).sort((a, b) => a - b);
          const facts = bs.length ? bs : [B_MIN];
          const state = {
            facts,
            correctCountsByB: {},
            exitPolicyByB: { ...(payload?.exitPolicyByB ?? {}) },
            queue: [],
            lastFactB: null,
            currentFactB: null,
            questionCount: 0,
            formPool: null,
            formPoolKey: null,
            formIndex: 0,
            formStepCounter: 0,
            reason: payload?.reason ?? "manual",
          };
          facts.forEach((b) => {
            state.correctCountsByB[b] = 0;
            if (!(b in state.exitPolicyByB)) state.exitPolicyByB[b] = "normal";
          });
          shared.sq3State = state;
          return state;
        },
        generator({ state }) {
          shared.sq3State = state;
          const b = nextSq3B(state);
          state.currentFactB = b;
          state.lastFactB = b;
          return sq3ShowStack ? buildStackQuestion(b, state) : buildQuestionForB(b, SQ3_ID, state);
        },
        actiuni: {
          dupaRaspunsCorect(ctx) {
            const state = ctx.stare;
            const factB = ctx.item.metadata.factB;
            state.questionCount += 1;
            state.correctCountsByB[factB] = (state.correctCountsByB[factB] ?? 0) + 1;

            const thisFactJustDone = factDone(state, factB);
            if (thisFactJustDone && shared.baseState) {
              shared.baseState.covered.add(factB);
            }

            const complete = state.facts.every((b) => factDone(state, b));
            if (complete) {
              if (shared.baseState) {
                state.facts.forEach((b) => shared.baseState.covered.add(b));
              }
              return { action: "pop", reason: "sq3Complete", payload: { sq3Completed: true } };
            }
            // altfel: ramane in sq3 — Motor3Butoane cere generator-ul automat.
          },
        },
        onTimeout: handleIntensiveTimeout,
      });
    }

    // ---- Subquiz 2 (VBS/SBS): pastrat, dar niciodata declansat automat -----

    function isLevelFactB(b) {
      const factB = Number(b);
      return Number.isFinite(factB) && factB >= FACT_B_MIN && factB <= factorForLevel(level);
    }

    function uniqueFacts(bs) {
      return [...new Set((bs || []).filter((b) => Number.isFinite(Number(b))).map(Number))];
    }

    function validLevelFacts(bs) {
      return uniqueFacts(bs).filter(isLevelFactB);
    }

    function getLevelFactBs() {
      const max = factorForLevel(level);
      return Array.from({ length: Math.max(0, max - FACT_B_MIN + 1) }, (_, index) => FACT_B_MIN + index);
    }

    function isIntensiveSubquiz(id) {
      return id === SQ2_VBS_ID || id === SQ2_SBS_ID;
    }

    function intensiveLabel(id) {
      return id === SQ2_SBS_ID ? "SBS" : "EFF VBS";
    }

    function ensureSbsAnswerSource() {
      if (sbsAnswerFromFactor || sbsAnswerFromProduct) return;
      sbsAnswerFromFactor = true;
      writeSetting(SQ2_SBS_ANSWER_FACTOR_KEY, true);
    }

    function buildBQueue(values = []) {
      const facts = validLevelFacts(values);
      const cycle = Sequencer.createCycle({ values: facts, random });
      return facts.map(() => cycle.next()).filter(isLevelFactB);
    }

    function pickSbsAnswerKind(index) {
      ensureSbsAnswerSource();
      if (sbsAnswerFromFactor && sbsAnswerFromProduct) {
        return index === 0 ? "factor" : "product";
      }
      return sbsAnswerFromProduct ? "product" : "factor";
    }

    function buildSbsEntries(facts) {
      const A = factorForLevel(level);
      return validLevelFacts(facts)
        .slice(0, SQ2_SBS_FACT_COUNT)
        .map((b, index) => {
          const answerKind = pickSbsAnswerKind(index);
          const product = A * b;
          return {
            b,
            product,
            answerKind,
            answerValue: answerKind === "product" ? product : b,
          };
        });
    }

    function buildSbsButtonOptions(entries) {
      return entries
        .map((entry) => Number(entry.answerValue))
        .sort((a, b) => a - b)
        .map(String);
    }

    function sbsQuestionItem(rendered, entry, state, extraMetadata = {}) {
      const options = state.options.map(String);
      const correct = Number(entry.answerValue);
      const correctIndex = options.indexOf(String(correct));
      const qfTypeId = extraMetadata.qfTypeId;
      const fact = makeFact(entry.b);
      return {
        prompt: rendered.prompt,
        correctAnswer: correct,
        options,
        correctIndex,
        metadata: {
          questionInstanceId: `${quizId}:${++questionInstanceSequence}`,
          subquiz: SQ2_SBS_ID,
          factA: factorForLevel(level),
          factB: entry.b,
          product: entry.product,
          fact: `${factorForLevel(level)}*${entry.b}=${entry.product}`,
          factId: fact.factId,
          eqForm: rendered.prompt,
          answerKind: entry.answerKind,
          sameButtonSet: true,
          ...(qfTypeId ? { qfTypeId } : {}),
          ...extraMetadata,
        },
      };
    }

    function getSbsEligibleForms(entry) {
      const fact = makeFact(entry.b);
      return qfTypes
        .map((type) => {
          const rendered = QFG.renderQF(type, fact);
          if (!rendered || rendered.answerType !== "number") return null;
          if (Number(rendered.correctAnswer) !== Number(entry.answerValue)) return null;
          return { type, rendered };
        })
        .filter(Boolean)
        .slice(0, sq2EqFormCount);
    }

    function nextSbsForm(entry, state) {
      state.qfQueuesByKey = state.qfQueuesByKey || {};
      const key = `${entry.b}:${entry.answerKind}`;
      if (!state.qfQueuesByKey[key]?.length) {
        state.qfQueuesByKey[key] = shuffle(getSbsEligibleForms(entry));
      }
      return state.qfQueuesByKey[key].shift() ?? null;
    }

    function buildSbsFallbackQuestion(entry, state) {
      const A = factorForLevel(level);
      const prompt =
        entry.answerKind === "product" ? `${A}*${entry.b}=?` : `${A}*?=${entry.product}`;
      return sbsQuestionItem({ prompt }, entry, state, { fallback: true });
    }

    function buildSbsQuestionForEntry(entry, state, options = {}) {
      const A = factorForLevel(level);
      const isLevelFactorAnswer = Number(entry.answerValue) === A;
      if (!options.ignoreLevelFactorCap && isLevelFactorAnswer && !canUseLevelFactorAnswer(state)) {
        return null;
      }

      const form = nextSbsForm(entry, state);
      noteLevelFactorAnswer(state, isLevelFactorAnswer);
      if (form) {
        return sbsQuestionItem(form.rendered, entry, state, { qfTypeId: form.type.id });
      }
      return buildSbsFallbackQuestion(entry, state);
    }

    // Descoperire mostenita de la migrarea v3 (aceeasi forma exacta aici): `sq2ExitMode`
    // ("correct" vs "any") se mapeaza pe `turCorect` din M3B — vezi comentariul din
    // multiplication-1120-v3-train-eff-eq-forms.js. Sq2/sq2Sbs raman nedeclansate automat
    // in acest fisier (decizie user, 29.07.2026) — migrarea nu schimba asta.
    function intensiveDupaRaspunsCorect(ctx) {
      const state = ctx.stare;
      const factB = ctx.item.metadata.factB;
      state.questionCount += 1;
      state.countsByB[factB] = (state.countsByB[factB] ?? 0) + 1;
      if (ctx.turCorect) {
        state.correctCountsByB[factB] = (state.correctCountsByB[factB] ?? 0) + 1;
      }

      const complete = state.facts.every((b) => {
        const value =
          sq2ExitMode === "any" ? state.countsByB[b] ?? 0 : state.correctCountsByB[b] ?? 0;
        return value >= sq2ExitCount;
      });

      if (complete) {
        return { action: "pop", reason: "sq2Complete", payload: { sq2Completed: true } };
      }
      // altfel: ramane — Motor3Butoane cere generator-ul automat.
    }

    function sq2Definition() {
      return global.SubquizDefinition.define({
        id: SQ2_VBS_ID,
        title: "Intensiv cu eff VBS",
        hintMessage: HINT,
        esteCorect: esteCorectV4,
        mesaje: mesajeStandard,
        initialState({ payload }) {
          const facts = validLevelFacts(payload?.facts).slice(0, 4);
          const state = {
            facts: facts.length ? facts : [FACT_B_MIN],
            countsByB: {},
            correctCountsByB: {},
            questionCount: 0,
            queue: [],
            lastFactB: null,
            reason: payload?.reason ?? "manual",
            levelFactorAnswerHistory: [],
          };
          state.facts.forEach((b) => {
            state.countsByB[b] = 0;
            state.correctCountsByB[b] = 0;
          });
          shared.sq2State = state;
          return state;
        },
        generator({ state }) {
          shared.sq2State = state;
          if (!state.queue.length) state.queue = buildBQueue(state.facts);
          if (state.facts.length > 1 && state.queue[0] === state.lastFactB) {
            state.queue.push(state.queue.shift());
          }
          const b = state.queue.shift() ?? state.facts[0];
          state.lastFactB = b;
          return buildQuestionForB(b, SQ2_VBS_ID, state);
        },
        actiuni: { dupaRaspunsCorect: intensiveDupaRaspunsCorect },
        onTimeout: handleIntensiveTimeout,
      });
    }

    function sq2SbsDefinition() {
      return global.SubquizDefinition.define({
        id: SQ2_SBS_ID,
        title: "Intensiv SBS",
        hintMessage: HINT,
        esteCorect: esteCorectV4,
        mesaje: mesajeStandard,
        initialState({ payload }) {
          const facts = validLevelFacts(payload?.facts).slice(0, SQ2_SBS_FACT_COUNT);
          const entries = buildSbsEntries(facts.length ? facts : getLevelFactBs().slice(0, SQ2_SBS_FACT_COUNT));
          const state = {
            facts: entries.map((entry) => entry.b),
            entries,
            options: buildSbsButtonOptions(entries),
            countsByB: {},
            correctCountsByB: {},
            questionCount: 0,
            queue: [],
            qfQueuesByKey: {},
            lastFactB: null,
            reason: payload?.reason ?? "manual",
            levelFactorAnswerHistory: [],
          };
          state.facts.forEach((b) => {
            state.countsByB[b] = 0;
            state.correctCountsByB[b] = 0;
          });
          shared.sq2State = state;
          return state;
        },
        generator({ state }) {
          shared.sq2State = state;
          if (!state.queue.length) state.queue = buildBQueue(state.facts);
          if (state.facts.length > 1 && state.queue[0] === state.lastFactB) {
            state.queue.push(state.queue.shift());
          }

          const attempts = state.queue.length ? [...state.queue] : [...state.facts];
          for (let index = 0; index < attempts.length; index += 1) {
            const b = state.queue.shift() ?? attempts[index];
            const entry = state.entries.find((item) => item.b === b);
            if (!entry) continue;
            const item = buildSbsQuestionForEntry(entry, state);
            if (!item) {
              state.queue.push(b);
              continue;
            }
            state.lastFactB = b;
            return item;
          }

          const fallbackB = state.queue.shift() ?? state.facts[0];
          const fallbackEntry = state.entries.find((entry) => entry.b === fallbackB) ?? state.entries[0];
          state.lastFactB = fallbackEntry.b;
          return buildSbsQuestionForEntry(fallbackEntry, state, { ignoreLevelFactorCap: true });
        },
        actiuni: { dupaRaspunsCorect: intensiveDupaRaspunsCorect },
        onTimeout: handleIntensiveTimeout,
      });
    }

    // ---- Subquiz 5 (Fluent party): fluenta deja castigata -> toate 24 forme -

    function toateSubtabelele() {
      return Array.from({ length: MAX_LEVEL }, (_, index) => factorForLevel(index + 1));
    }

    function esteFluent(a, b) {
      const sursa = getFluentaSursa();
      return (sursa.starePtFact ? sursa.starePtFact(a, b) : "netestat") === "fluent";
    }

    function facteFluenteDomeniu(subtabele) {
      const facte = [];
      subtabele.forEach((a) => {
        for (let b = B_MIN; b <= B_MAX; b += 1) {
          if (esteFluent(a, b)) facte.push({ a, b });
        }
      });
      return facte;
    }

    // D15: doua roluri, prin echivalenta matematica — nu 5 (factor / produs /
    // deimpartit / impartitor / cat). Fiecare rol contine si forme cu "*", si
    // forme cu ":" (rol1: 8+8; rol2: 4+4), deci un bloc cu rol constant nu
    // fixeaza si operatia — cerinta explicita a userului (17.08.2026).
    function rolRaspuns(raspuns, a, b) {
      return Number(raspuns) === a * b ? "rol2" : "rol1";
    }

    function perechiSq5(facts, qfTypesActive) {
      const perechi = [];
      facts.forEach((f) => {
        const fact = makeFact(f.b, f.a);
        qfTypesActive.forEach((type) => {
          const rendered = QFG.renderQF(type, fact);
          if (!rendered || rendered.answerType !== "number") return;
          const raspuns = Number(rendered.correctAnswer);
          if (!Number.isFinite(raspuns)) return;
          perechi.push({
            a: f.a,
            b: f.b,
            key: `${f.a}*${f.b}`,
            prompt: rendered.prompt,
            raspuns,
            qfTypeId: type.id,
            rol: rolRaspuns(raspuns, f.a, f.b),
          });
        });
      });
      return perechi;
    }

    // D14: best-of-10 — 10 triplete random, se pastreaza cel cu cele mai
    // variate facte nesatisfacute atinse si cu deficitul cel mai mare de
    // turns. Un triplet extras din `spectru` (constrans la facte
    // nesatisfacute) atinge garantat >=1 fact nesatisfacut, deci `best` nu
    // ramane niciodata null cand spectrul are >=3 valori (masurat, PLAN §0).
    function alegeTripletSq5(perechiSursa, nesatKeys, turnsByKey, turnsTarget) {
      const spectru = [...new Set(perechiSursa.filter((p) => nesatKeys.has(p.key)).map((p) => p.raspuns))];
      if (spectru.length < 3) return null;

      let best = null;
      for (let incercare = 0; incercare < SQ5_TRIPLET_ATTEMPTS; incercare += 1) {
        const rest = [...spectru];
        const trio = [];
        for (let i = 0; i < 3; i += 1) {
          trio.push(...rest.splice(Math.floor(random() * rest.length), 1));
        }
        const trioSet = new Set(trio);
        const pool = perechiSursa.filter((p) => trioSet.has(p.raspuns));
        const facteAtinse = new Set(pool.filter((p) => nesatKeys.has(p.key)).map((p) => p.key));
        const deficit = [...facteAtinse].reduce(
          (suma, key) => suma + Math.max(0, turnsTarget - (turnsByKey[key] ?? 0)),
          0
        );
        const scor = facteAtinse.size * 1000 + deficit;
        if (!best || scor > best.scor) best = { pool, trio, scor };
      }
      return best && best.pool.length ? best : null;
    }

    // Un bloc SBS "cu rol constant" (D15) se formeaza doar daca rolul ales
    // are >=2 valori distincte de raspuns — garda anti-forma-unica (D16):
    // "niciodata un bloc SBS cu o singura formă de ecuatie, decat daca
    // userul o cere explicit". Altfel cade pe SBS liber (fara rol constant).
    // Si daca nu se gaseste niciun triplet valid (P2 — prea putine forme
    // active), blocul cade pe VBS.
    function alegeBlocSq5(state) {
      const perechiToate = perechiSq5(state.facts, state.qfTypesActive);
      const esteSbs = random() < state.sbsPct / 100;
      if (!esteSbs) return { tip: "vbs", pool: perechiToate, butoane: null };

      const nesatKeys = new Set(
        state.facts
          .filter((f) => (state.turnsByKey[`${f.a}*${f.b}`] ?? 0) < state.turnsTarget)
          .map((f) => `${f.a}*${f.b}`)
      );

      let sursaTriplet = perechiToate;
      if (random() < state.rolConstPct / 100) {
        const rolAles = random() < 0.5 ? "rol1" : "rol2";
        const dinRol = perechiToate.filter((p) => p.rol === rolAles);
        if (new Set(dinRol.map((p) => p.raspuns)).size >= 2) sursaTriplet = dinRol;
      }

      const rezultat = alegeTripletSq5(sursaTriplet, nesatKeys, state.turnsByKey, state.turnsTarget);
      if (!rezultat) return { tip: "vbs", pool: perechiToate, butoane: null };

      return {
        tip: "sbs",
        pool: rezultat.pool,
        butoane: rezultat.trio.map(String).sort((x, y) => Number(x) - Number(y)),
      };
    }

    // D1: repetitia e ok, "preferabil diferita" — mai intai facte inca
    // nesatisfacute, apoi (in cadrul lor, sau al intregului pool daca toate
    // sunt deja satisfacute — "blocul inceput se duce pana la capat", §3.4)
    // forme inca nefolosite pt. factul respectiv.
    function trageSq5(pool, state) {
      const nesatisfacute = pool.filter((p) => (state.turnsByKey[p.key] ?? 0) < state.turnsTarget);
      const candidati = nesatisfacute.length ? nesatisfacute : pool;
      const formeNoi = candidati.filter((p) => !state.formsUsedByKey[p.key]?.has(p.prompt));
      const sursa = formeNoi.length ? formeNoi : candidati;
      return sursa[Math.floor(random() * sursa.length)];
    }

    function sq5TermIsComplete(state) {
      return state.facts.every((f) => (state.turnsByKey[`${f.a}*${f.b}`] ?? 0) >= state.turnsTarget);
    }

    function sq5QuestionItem(pereche, state) {
      const product = pereche.a * pereche.b;
      const fact = makeFact(pereche.b, pereche.a);
      const bloc = state.currentBloc;
      let options;
      let correctIndex;
      if (bloc?.tip === "sbs" && bloc.butoane) {
        options = bloc.butoane;
        correctIndex = options.indexOf(String(pereche.raspuns));
      } else {
        const opt = buildMulDivEqFormOptions(pereche.raspuns, product, shuffle);
        options = opt.options;
        correctIndex = opt.correctIndex;
      }
      return {
        prompt: pereche.prompt,
        correctAnswer: pereche.raspuns,
        options,
        correctIndex,
        metadata: {
          questionInstanceId: `${quizId}:${++questionInstanceSequence}`,
          subquiz: SQ5_ID,
          factA: pereche.a,
          factB: pereche.b,
          product,
          fact: `${pereche.a}*${pereche.b}=${product}`,
          factId: fact.factId,
          eqForm: pereche.prompt,
          qfTypeId: pereche.qfTypeId,
          rol: pereche.rol,
          sameButtonSet: bloc?.tip === "sbs" || undefined,
        },
      };
    }

    function ziCurentaLocala() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    // +1/zi de utilizare a lui sq5 (§3.5), in ora LOCALA (nu UTC — altfel
    // ziua s-ar muta seara si ar da un +1 fantoma). Prima zi de folosire nu
    // incrementeaza. Se opreste definitiv daca userul a mutat manual
    // sliderul ("ramane acolo" — flag separat in localStorage).
    function aplicaCrestereZilnicaEqForms() {
      if (sq5EqFormManual) return;
      const azi = ziCurentaLocala();
      let ultimaZi = null;
      try {
        ultimaZi = global.localStorage?.getItem?.(SQ5_EQ_FORM_LAST_DAY_KEY) ?? null;
      } catch (err) {
        ultimaZi = null;
      }
      if (ultimaZi === null) {
        writeSetting(SQ5_EQ_FORM_LAST_DAY_KEY, azi);
        return;
      }
      if (ultimaZi === azi) return;
      sq5EqFormCount = Math.min(SQ5_EQ_FORM_MAX, sq5EqFormCount + 1);
      writeSetting(SQ5_EQ_FORM_COUNT_KEY, sq5EqFormCount);
      writeSetting(SQ5_EQ_FORM_LAST_DAY_KEY, azi);
    }

    function sq5Definition() {
      return global.SubquizDefinition.define({
        id: SQ5_ID,
        title: "Fluent party",
        hintMessage: HINT,
        esteCorect: esteCorectV4,
        mesaje: mesajeStandard,
        initialState({ payload }) {
          aplicaCrestereZilnicaEqForms();
          const facts =
            payload?.facts ?? facteFluenteDomeniu(inLevel0 ? toateSubtabelele() : [factorForLevel(level)]);
          const state = {
            facts,
            turnsByKey: {},
            formsUsedByKey: {},
            qfTypesActive: shuffle([...qfTypes]).slice(0, sq5EqFormCount),
            turnsTarget: sq5TurnsPerFact,
            blocLen: sq5BlocLen,
            sbsPct: sq5SbsPct,
            rolConstPct: sq5RolConstPct,
            entryMode: payload?.entryMode ?? "list",
            currentBloc: null,
            blocQuestionsLeft: 0,
            currentPereche: null,
            questionCount: 0,
          };
          facts.forEach((f) => {
            const key = `${f.a}*${f.b}`;
            state.turnsByKey[key] = 0;
            state.formsUsedByKey[key] = new Set();
          });
          shared.sq5State = state;
          return state;
        },
        generator({ state }) {
          shared.sq5State = state;
          if (state.blocQuestionsLeft <= 0) {
            state.currentBloc = alegeBlocSq5(state);
            state.blocQuestionsLeft = state.blocLen;
          }
          const pereche = trageSq5(state.currentBloc.pool, state);
          state.blocQuestionsLeft -= 1;
          state.currentPereche = pereche;
          return sq5QuestionItem(pereche, state);
        },
        // CORECTAT (Categoria 3/6) — bug-ul ORIGINAL care a pornit tot
        // refactorul: inainte, un raspuns gresit avansa itemul in tacere
        // (nextItem apelat necondiționat) si eticheta rezultatul "step-correct"
        // chiar pe gresit, cu `answerRevealed:true` ca sa ascunda desincronizarea
        // — ecranul ramanea pe intrebarea veche in timp ce starea reala a
        // quizului deja avansase (exact simptomul din raportul initial de bug,
        // la sq5). Design-ul original spunea explicit "sq5 numara turns
        // corecte sau nu, nu cere reusita" — dar regula userului nu are
        // exceptie pt. niciun subquiz. Acum gresit ramane pe aceeasi pereche
        // pana la raspunsul corect; `turnsByKey`/`formsUsedByKey` numara doar
        // la rezolvare (Categoria 6), `answerRevealed` nu mai e nevoie
        // (nu mai exista reveal pe gresit, motorul comun ramane pe intrebare).
        actiuni: {
          dupaRaspunsCorect(ctx) {
            const state = ctx.stare;
            const pereche = state.currentPereche;
            const key = pereche.key;

            state.questionCount += 1;
            state.turnsByKey[key] = (state.turnsByKey[key] ?? 0) + 1;
            if (!state.formsUsedByKey[key]) state.formsUsedByKey[key] = new Set();
            state.formsUsedByKey[key].add(pereche.prompt);

            if (state.blocQuestionsLeft <= 0 && sq5TermIsComplete(state)) {
              // Fara `view` propriu in codul vechi. Cand entryMode !== "push" (mod B,
              // ruta statica — ex. sq5Entry="levelStart", ruta [SQ5_ID,"base"]), exit-ul
              // e urmat de "base" in ACEEASI ruta — un `message` implicit ar supravietui
              // pe prima lui intrebare. Pastram exact ce se vedea inainte (nimic), pt.
              // ambele ramuri (pop isi sterge view-ul central oricum, deci suprascrierea
              // e sigura si acolo).
              const iesire = {
                reason: "sq5Complete",
                payload: { sq5Completed: true },
                view: { message: undefined },
              };
              return state.entryMode === "push" ? { action: "pop", ...iesire } : { action: "exit", ...iesire };
            }
            // altfel: ramane in sq5 — Motor3Butoane cere generator-ul automat.
          },
        },
        onTimeout: handleIntensiveTimeout,
      });
    }

    // Declansatorul "random" (§3.3): aceleasi doua puncte ca sq3
    // (twoWrongFacts / baseFiveFacts, in baseDefinition().onAnswer), incercat
    // DOAR daca sq3 nu s-a declansat la acelasi punct ("random are prioritate
    // mai mica decat regula determinata"). O singura data per nivel, la a
    // k-a verificare eligibila (k ales uniform din {1,2,3} in resetLevelState,
    // ca pozitia sa fie random dar aparitia garantata).
    function maybeEnterSq5Random(state) {
      if (sq5Mode !== "B" || sq5Entry !== "random" || sq5RandomFired) return null;
      const A = factorForLevel(level);
      const facts = facteFluenteDomeniu([A]);
      if (!facts.length) return null;

      sq5RandomEligibleCount += 1;
      if (sq5RandomEligibleCount < sq5RandomTargetK) return null;

      sq5RandomFired = true;
      return {
        action: "push",
        targetId: SQ5_ID,
        payload: { facts, entryMode: "push" },
        view: {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: "Subquiz 5: Fluent party",
        },
      };
    }

    // Panoul CP al lui sq2 ramane definit (cod pastrat), dar nu mai e expus pe
    // obiectul quizului -> CpRegistry il considera dezactivat, deci nu se
    // afiseaza. Decizie user, 29.07.2026 ("ramane ascuns integral").
    function appendSq2ControlPanelUnused(mount, hooks = {}) {
      if (!mount) return;
      const intensiveModeRow = document.createElement("div");
      intensiveModeRow.className = "control-panel-lift-field sq2-eff-vbs-field";
      const intensiveModeText = document.createElement("span");
      intensiveModeText.textContent = "Mod Intensiv:";
      intensiveModeRow.appendChild(intensiveModeText);
      [
        ["vbs", "subq1"],
        ["sbs", "subq2"],
        ["alternate", "alternate"],
        ["random", "random order"],
      ].forEach(([mode, labelText]) => {
        const label = document.createElement("label");
        label.className = "control-panel-lift-row sq2-eff-vbs-radio";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "sq2-intensive-mode";
        input.value = mode;
        input.checked = intensiveMode === mode;
        input.addEventListener("change", () => {
          intensiveMode = mode;
          if (mode === "alternate") nextAlternateIntensiveTarget = SQ2_VBS_ID;
          writeSetting(SQ2_INTENSIVE_MODE_KEY, mode);
          hooks.onChange?.();
        });
        label.append(input, document.createTextNode(labelText));
        intensiveModeRow.appendChild(label);
      });

      const sbsAnswerRow = document.createElement("div");
      sbsAnswerRow.className = "control-panel-lift-field sq2-eff-vbs-field";
      const sbsAnswerText = document.createElement("span");
      sbsAnswerText.textContent = "Raspunsuri din:";
      sbsAnswerRow.appendChild(sbsAnswerText);
      const factorInput = document.createElement("input");
      const productInput = document.createElement("input");
      function syncSbsAnswerSources() {
        sbsAnswerFromFactor = factorInput.checked;
        sbsAnswerFromProduct = productInput.checked;
        if (!sbsAnswerFromFactor && !sbsAnswerFromProduct) {
          sbsAnswerFromFactor = true;
          factorInput.checked = true;
        }
        writeSetting(SQ2_SBS_ANSWER_FACTOR_KEY, sbsAnswerFromFactor);
        writeSetting(SQ2_SBS_ANSWER_PRODUCT_KEY, sbsAnswerFromProduct);
        hooks.onChange?.();
      }
      [
        [factorInput, "factor", sbsAnswerFromFactor],
        [productInput, "produs", sbsAnswerFromProduct],
      ].forEach(([input, labelText, checked]) => {
        const label = document.createElement("label");
        label.className = "control-panel-lift-row sq2-eff-vbs-radio";
        input.type = "checkbox";
        input.checked = checked;
        input.addEventListener("change", syncSbsAnswerSources);
        label.append(input, document.createTextNode(labelText));
        sbsAnswerRow.appendChild(label);
      });

      const factRow = document.createElement("div");
      factRow.className = "control-panel-lift-field sq2-eff-vbs-field";
      const factLabelEl = document.createElement("span");
      factLabelEl.textContent = "Nr facts de intarit simultan in Sq2 EFF VBS:";
      factRow.appendChild(factLabelEl);
      [1, 2, 3, 4].forEach((count) => {
        const label = document.createElement("label");
        label.className = "control-panel-lift-row sq2-eff-vbs-radio";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "sq2-eff-vbs-fact-count";
        input.value = String(count);
        input.checked = sq2FactCount === count;
        input.addEventListener("change", () => {
          sq2FactCount = count;
          writeSetting(SQ2_FACT_COUNT_KEY, count);
          hooks.onChange?.();
        });
        label.append(input, document.createTextNode(String(count)));
        factRow.appendChild(label);
      });

      const eqFormRow = document.createElement("div");
      eqFormRow.className = "control-panel-lift-field sq2-eff-vbs-slider-field";
      const eqFormHead = document.createElement("div");
      eqFormHead.className = "sq2-eff-vbs-slider-head";
      const eqFormLabel = document.createElement("label");
      eqFormLabel.textContent = "Nr. eq forms in sq2:";
      const eqFormOut = document.createElement("span");
      eqFormOut.className = "control-panel-lift-slider-out";
      eqFormOut.textContent = String(sq2EqFormCount);
      const eqFormSlider = document.createElement("input");
      eqFormSlider.type = "range";
      eqFormSlider.min = String(SQ2_EQ_FORM_MIN);
      eqFormSlider.max = String(SQ2_EQ_FORM_MAX);
      eqFormSlider.step = "1";
      eqFormSlider.value = String(sq2EqFormCount);
      eqFormSlider.className = "sq2-eff-vbs-slider";
      eqFormSlider.addEventListener("input", () => {
        sq2EqFormCount = clampChoice(
          eqFormSlider.value,
          rangeChoices(SQ2_EQ_FORM_MIN, SQ2_EQ_FORM_MAX),
          SQ2_EQ_FORM_MAX
        );
        eqFormOut.textContent = String(sq2EqFormCount);
        writeSetting(SQ2_EQ_FORM_COUNT_KEY, sq2EqFormCount);
      });
      eqFormHead.append(eqFormLabel, eqFormOut);
      eqFormRow.append(eqFormHead, eqFormSlider);

      const exitRow = document.createElement("div");
      exitRow.className = "control-panel-lift-field sq2-eff-vbs-field";
      const exitText = document.createElement("span");
      exitText.textContent = "Se iese din SQ2 dupa ce fiecare fact are:";
      exitRow.appendChild(exitText);
      [3, 4, 5].forEach((count) => {
        const label = document.createElement("label");
        label.className = "control-panel-lift-row sq2-eff-vbs-radio";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "sq2-eff-vbs-exit-count";
        input.value = String(count);
        input.checked = sq2ExitCount === count;
        input.addEventListener("change", () => {
          sq2ExitCount = count;
          writeSetting(SQ2_EXIT_COUNT_KEY, count);
          hooks.onChange?.();
        });
        label.append(input, document.createTextNode(String(count)));
        exitRow.appendChild(label);
      });

      const exitModeRow = document.createElement("div");
      exitModeRow.className = "control-panel-lift-field sq2-eff-vbs-field";
      ["correct", "any"].forEach((mode) => {
        const label = document.createElement("label");
        label.className = "control-panel-lift-row sq2-eff-vbs-radio";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "sq2-eff-vbs-exit-mode";
        input.value = mode;
        input.checked = sq2ExitMode === mode;
        input.addEventListener("change", () => {
          sq2ExitMode = mode;
          writeSetting(SQ2_EXIT_MODE_KEY, mode);
          hooks.onChange?.();
        });
        label.append(input, document.createTextNode(mode === "correct" ? "corect" : "corect sau incorect"));
        exitModeRow.appendChild(label);
      });

      mount.append(intensiveModeRow, sbsAnswerRow, factRow, eqFormRow, exitRow, exitModeRow);
    }

    // ---- CP SQ3 --------------------------------------------------------------

    function appendSq3ControlPanel(mount, hooks = {}) {
      if (!mount) return;
      appendJurnalButtons(mount);

      function bifaRow(labelText, checked, onToggle) {
        const row = document.createElement("div");
        row.className = "control-panel-lift-field sq3-field";
        const label = document.createElement("label");
        label.className = "control-panel-lift-row";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = checked;
        input.addEventListener("change", () => {
          onToggle(input.checked);
          hooks.onChange?.();
        });
        label.append(input, document.createTextNode(labelText));
        row.appendChild(label);
        return row;
      }

      const stackRow = bifaRow("Afiseaza grupul de factori impreuna", sq3ShowStack, (checked) => {
        sq3ShowStack = checked;
        writeSetting(SQ3_SHOW_STACK_KEY, sq3ShowStack);
      });
      const highlightRow = bifaRow("Evidentiaza factul testat curent", sq3HighlightCurrent, (checked) => {
        sq3HighlightCurrent = checked;
        writeSetting(SQ3_HIGHLIGHT_CURRENT_KEY, sq3HighlightCurrent);
      });
      const dimRow = bifaRow(
        "Dez-evidentiaza factele netestate in turul curent",
        sq3DimUntested,
        (checked) => {
          sq3DimUntested = checked;
          writeSetting(SQ3_DIM_UNTESTED_KEY, sq3DimUntested);
        }
      );

      const rotateRow = document.createElement("div");
      rotateRow.className = "control-panel-lift-field sq3-slider-field";
      const rotateHead = document.createElement("div");
      rotateHead.className = "sq3-slider-head";
      const rotateLabel = document.createElement("label");
      rotateLabel.textContent = "Rotire forme la fiecare (0 = deloc):";
      const rotateOut = document.createElement("span");
      rotateOut.className = "control-panel-lift-slider-out";
      rotateOut.textContent = String(sq3RotateEvery);
      const rotateSlider = document.createElement("input");
      rotateSlider.type = "range";
      rotateSlider.min = "0";
      rotateSlider.max = String(SQ3_ROTATE_EVERY_MAX);
      rotateSlider.step = "1";
      rotateSlider.value = String(sq3RotateEvery);
      rotateSlider.className = "sq3-slider";
      rotateSlider.addEventListener("input", () => {
        sq3RotateEvery = clampChoice(rotateSlider.value, rangeChoices(0, SQ3_ROTATE_EVERY_MAX), 1);
        rotateOut.textContent = String(sq3RotateEvery);
        writeSetting(SQ3_ROTATE_EVERY_KEY, sq3RotateEvery);
      });
      rotateHead.append(rotateLabel, rotateOut);
      rotateRow.append(rotateHead, rotateSlider);

      const eqFormRow = document.createElement("div");
      eqFormRow.className = "control-panel-lift-field sq3-slider-field";
      const eqFormHead = document.createElement("div");
      eqFormHead.className = "sq3-slider-head";
      const eqFormLabel = document.createElement("label");
      eqFormLabel.textContent = "Nr. forme de ecuatie in sq3:";
      const eqFormOut = document.createElement("span");
      eqFormOut.className = "control-panel-lift-slider-out";
      eqFormOut.textContent = String(sq3EqFormCount);
      const eqFormSlider = document.createElement("input");
      eqFormSlider.type = "range";
      eqFormSlider.min = String(SQ3_EQ_FORM_MIN);
      eqFormSlider.max = String(SQ3_EQ_FORM_MAX);
      eqFormSlider.step = "1";
      eqFormSlider.value = String(sq3EqFormCount);
      eqFormSlider.className = "sq3-slider";
      eqFormSlider.addEventListener("input", () => {
        sq3EqFormCount = clampChoice(
          eqFormSlider.value,
          rangeChoices(SQ3_EQ_FORM_MIN, SQ3_EQ_FORM_MAX),
          4
        );
        eqFormOut.textContent = String(sq3EqFormCount);
        writeSetting(SQ3_EQ_FORM_COUNT_KEY, sq3EqFormCount);
      });
      eqFormHead.append(eqFormLabel, eqFormOut);
      eqFormRow.append(eqFormHead, eqFormSlider);

      mount.append(stackRow, highlightRow, dimRow, rotateRow, eqFormRow);
    }

    // ---- CP SQ5 (Fluent party) -----------------------------------------------

    function sq5SliderRow(labelText, getValue, min, max, onInput) {
      const row = document.createElement("div");
      row.className = "control-panel-lift-field sq3-slider-field";
      const head = document.createElement("div");
      head.className = "sq3-slider-head";
      const label = document.createElement("label");
      label.textContent = labelText;
      const out = document.createElement("span");
      out.className = "control-panel-lift-slider-out";
      out.textContent = String(getValue());
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = String(min);
      slider.max = String(max);
      slider.step = "1";
      slider.value = String(getValue());
      slider.className = "sq3-slider";
      slider.addEventListener("input", () => {
        const value = clampChoice(slider.value, rangeChoices(min, max), getValue());
        onInput(value);
        out.textContent = String(value);
      });
      head.append(label, out);
      row.append(head, slider);
      return row;
    }

    // Steppere cu sageti -/+ (D13) — tiparul "pre-eq-stepper" exista deja in
    // proiect (js/quizzes/rigle-cl1.js), refolosit ca atare, fara CSS nou.
    function sq5StepperRow(labelText, getValue, { min, max, step = 1 }, onApply) {
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
      input.step = String(step);
      input.value = String(getValue());
      const plus = document.createElement("button");
      plus.type = "button";
      plus.textContent = "+";

      const apply = (raw) => {
        const num = Math.round(Number(raw) / step) * step;
        const clamped = Number.isFinite(num) ? Math.max(min, Math.min(max, num)) : getValue();
        onApply(clamped);
        input.value = String(getValue());
      };

      minus.addEventListener("click", () => apply(getValue() - step));
      plus.addEventListener("click", () => apply(getValue() + step));
      input.addEventListener("change", () => apply(input.value));

      controls.append(minus, input, plus);
      field.append(label, controls);
      return field;
    }

    function appendSq5ControlPanel(mount, hooks = {}) {
      if (!mount) return;
      appendJurnalButtons(mount);

      const modeRow = document.createElement("div");
      modeRow.className = "control-panel-lift-field sq3-field";
      const modeLabel = document.createElement("span");
      modeLabel.textContent = "Ruleaza sq5 Fluent party:";
      modeRow.appendChild(modeLabel);
      [
        ["A", "Level 0, inaintea tuturor nivelurilor, cu toate subtablele"],
        ["B", "in interiorul fiecarui nivel"],
      ].forEach(([mode, text]) => {
        const label = document.createElement("label");
        label.className = "control-panel-lift-row";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "sq5-mode";
        input.value = mode;
        input.checked = sq5Mode === mode;
        input.addEventListener("change", () => {
          sq5Mode = mode;
          writeSetting(SQ5_MODE_KEY, sq5Mode);
          entryRow.style.display = sq5Mode === "B" ? "" : "none";
          // Mod A/B decide CE se ruleaza (structural), spre deosebire de
          // sliderele de mai jos care doar regleaza cum ruleaza sq5 odata
          // intrat — de-aia foloseste onRouteChange (repornire), nu
          // onChange (doar re-randare CP), altfel bifa n-are efect vizibil
          // pana la urmatoarea schimbare naturala de nivel.
          (hooks.onRouteChange ?? hooks.onChange)?.();
        });
        label.append(input, document.createTextNode(text));
        modeRow.appendChild(label);
      });

      const entryRow = document.createElement("div");
      entryRow.className = "control-panel-lift-field sq3-field";
      const entryLabel = document.createElement("span");
      entryLabel.textContent = "Intrare in sq5 (doar mod B):";
      entryRow.appendChild(entryLabel);
      [
        ["levelStart", "La inceputul nivelului"],
        ["random", "Random intre alte subquizuri"],
        ["levelEnd", "La finalul nivelului"],
      ].forEach(([entry, text]) => {
        const label = document.createElement("label");
        label.className = "control-panel-lift-row";
        const input = document.createElement("input");
        input.type = "radio";
        input.name = "sq5-entry";
        input.value = entry;
        input.checked = sq5Entry === entry;
        input.addEventListener("change", () => {
          sq5Entry = entry;
          writeSetting(SQ5_ENTRY_KEY, sq5Entry);
          (hooks.onRouteChange ?? hooks.onChange)?.();
        });
        label.append(input, document.createTextNode(text));
        entryRow.appendChild(label);
      });
      entryRow.style.display = sq5Mode === "B" ? "" : "none";

      const turnsRow = sq5SliderRow(
        "Nr. de turns per fact:",
        () => sq5TurnsPerFact,
        SQ5_TURNS_MIN,
        SQ5_TURNS_MAX,
        (value) => {
          sq5TurnsPerFact = value;
          writeSetting(SQ5_TURNS_KEY, sq5TurnsPerFact);
        }
      );

      const eqFormRow = sq5SliderRow(
        "Nr. de eq forms (creste +1 la fiecare zi noua de folosire; se opreste daca muti manual sliderul):",
        () => sq5EqFormCount,
        SQ5_EQ_FORM_MIN,
        SQ5_EQ_FORM_MAX,
        (value) => {
          sq5EqFormCount = value;
          sq5EqFormManual = true;
          writeSetting(SQ5_EQ_FORM_COUNT_KEY, sq5EqFormCount);
          writeSetting(SQ5_EQ_FORM_MANUAL_KEY, true);
        }
      );

      const sbsPctRow = sq5StepperRow(
        "SBS % (aproximativ — restul intrebarilor sunt o intrebare pe rand, buton diferit de fiecare data):",
        () => sq5SbsPct,
        { min: SQ5_PCT_MIN, max: SQ5_PCT_MAX, step: SQ5_PCT_STEP },
        (value) => {
          sq5SbsPct = value;
          writeSetting(SQ5_SBS_PCT_KEY, sq5SbsPct);
          hooks.onChange?.();
        }
      );

      const blocLenRow = sq5StepperRow(
        "Lungime sir (guverneaza si blocurile SBS, si cele fara SBS — ca procentul de mai sus sa fie corect):",
        () => sq5BlocLen,
        { min: SQ5_BLOC_LEN_MIN, max: SQ5_BLOC_LEN_MAX, step: 1 },
        (value) => {
          sq5BlocLen = value;
          writeSetting(SQ5_BLOC_LEN_KEY, sq5BlocLen);
          hooks.onChange?.();
        }
      );

      const rolConstRow = sq5StepperRow(
        "Din blocurile SBS, cate cu rol constant % (rol1 = factor/impartitor/cat; rol2 = produs/deimpartit):",
        () => sq5RolConstPct,
        { min: SQ5_PCT_MIN, max: SQ5_PCT_MAX, step: SQ5_PCT_STEP },
        (value) => {
          sq5RolConstPct = value;
          writeSetting(SQ5_ROL_CONST_PCT_KEY, sq5RolConstPct);
          hooks.onChange?.();
        }
      );

      mount.append(modeRow, entryRow, turnsRow, eqFormRow, sbsPctRow, blocLenRow, rolConstRow);
    }

    // ---- orchestrare + nivele --------------------------------------------

    // Mod B: unde intra sq5 in lista ordonata a orchestratorului (§3.3).
    // "random" nu apare in lista — intra prin push/pop din baseDefinition,
    // ca sq3 (maybeEnterSq5Random). Daca nivelul curent n-are niciun fact
    // fluent, sq5 nu intra deloc in lista (echivalent cu "nu porneste").
    function normalActiveIds() {
      if (sq5Mode !== "B") return ["base"];
      if (sq5Entry === "random") return ["base"];
      const A = factorForLevel(level);
      if (!facteFluenteDomeniu([A]).length) return ["base"];
      return sq5Entry === "levelEnd" ? ["base", SQ5_ID] : [SQ5_ID, "base"];
    }

    // Level 0 (mod A): o singura data, inainte de nivelul 1, cu facte din
    // toate subtablele — vezi beginLevel1AfterLevel0(). Daca n-are niciun
    // fact fluent (cont nou), se marcheaza direct "facut" si nu se afiseaza
    // niciun ecran — criteriul 10 din plan.
    function createOrchestrator() {
      // Decizia despre level 0 se ia DEFINITIV (inclusiv marcarea level0Done
      // la domeniu gol) doar cu sursa de fluenta gata (fluentaEsteGata()).
      // createOrchestrator() se cheama si eager, la construirea quizului
      // (mai jos), inainte sa se stie daca IndexedDB a raspuns — fara garda
      // asta, o citire inca nerezolvata s-ar vedea ca "0 facte fluente" si
      // ar bloca level 0 PERMANENT pentru tot restul sesiunii, chiar si dupa
      // ce datele reale devin disponibile (bug real, gasit dupa implementare
      // — vezi nota din plan). Cand sursa nu e gata, nu se decide nimic acum:
      // inLevel0 ramane fals pt. constructia asta (oricum aruncata — beginRoute()
      // reconstruieste mereu, iar pickNextRound() nu porneste o runda reala
      // pana sursa nu e gata), dar level0Done nu se atinge, deci se
      // re-evalueaza corect la urmatoarea reconstructie.
      let domeniuLevel0 = [];
      if (sq5Mode === "A" && !level0Done && fluentaEsteGata()) {
        domeniuLevel0 = facteFluenteDomeniu(toateSubtabelele());
        if (domeniuLevel0.length === 0) level0Done = true;
      }
      inLevel0 = sq5Mode === "A" && !level0Done && domeniuLevel0.length > 0;

      const activeIds = inLevel0 ? [SQ5_ID] : normalActiveIds();

      orchestrator = global.SubquizOrchestrator.create({
        definitions: [baseDefinition(), sq3Definition(), sq2Definition(), sq2SbsDefinition(), sq5Definition()],
        activeSubquizIds: activeIds,
        onRouteComplete: laRutaCompleta,
        context: {
          quizId,
          getLevel: () => level,
          hintMessage: HINT,
        },
      });
    }

    function resetLevelState() {
      shared.baseState = null;
      shared.sq3State = null;
      shared.sq2State = null;
      shared.sq5State = null;
      shared.usedFgIndexes = new Set();
      shared.levelFactorAnswerHistory = [];
      sq3Count = 0;
      sq5RandomFired = false;
      sq5RandomTargetK = 1 + Math.floor(random() * 3);
      sq5RandomEligibleCount = 0;
      createOrchestrator();
    }

    // Reconstruieste orchestratorul chiar inainte de a porni o ruta — nu doar
    // daca lipseste. E ieftin (fara I/O) si elimina o cursa reala: la crearea
    // quizului, resetLevelState() ruleaza inainte sa se stie daca sursa de
    // fluenta e gata (pickNextRound() garanteaza asta abia mai tarziu), deci
    // orchestratorul construit atunci ar putea decide gresit "level 0 gol".
    function beginRoute() {
      createOrchestrator();
      return orchestrator.startFirst();
    }

    // Level 0 s-a terminat -> nivelul 1 normal, FARA sa incrementeze `level`
    // (spre deosebire de advanceLevel(), care e pt. sfarsitul unui nivel
    // obisnuit). Daca userul a schimbat manual nivelul cat timp level 0 inca
    // rula, ramane pe nivelul ales — nu se forteaza inapoi pe nivelul 1.
    function beginLevel1AfterLevel0() {
      level0Done = true;
      resetLevelState();
      return beginRoute();
    }

    // `advanceLevel` se cheama DOAR din `laRutaCompleta`, adica din interiorul
    // orchestratorului (vezi routeComplete in js/subquiz/subquiz-orchestrator.js).
    // De-aia nu-si mai pune singura nici semnatura M3B, nici `subquizEvent`:
    // le pune orchestratorul, ca la orice alt eveniment de rutare.
    function advanceLevel() {
      if (level >= MAX_LEVEL) {
        completed = true;
        const message = "Ai ajuns la final.";
        global.alert?.(message);
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          gameComplete: true,
          flash: "win",
          banner: message,
          message,
          prompt: "Final",
          options: ["", "", ""],
          correctIndex: 0,
        };
      }

      global.alert?.("Subquiz 1 baza terminat, next level");
      level = Math.min(MAX_LEVEL, level + 1);
      resetLevelState();
      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        levelAdvanced: true,
        runDelayMs: 0,
        flash: "win",
        banner: `Nivel ${level} - ${factorForLevel(level)}x`,
        message: `Nivel ${level}`,
        nextRound: beginRoute(),
      };
    }

    // CE urmeaza dupa ce ruta s-a terminat. Orchestratorul o cheama si tot el
    // pune marcajele pe rezultat — quizul nu mai construieste rezultate de top.
    function laRutaCompleta() {
      if (inLevel0) {
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          runDelayMs: 0,
          flash: "win",
          banner: "Fluent party terminat — Nivel 1",
          message: `Nivel ${level}`,
          nextRound: beginLevel1AfterLevel0(),
        };
      }
      return advanceLevel();
    }

    resetLevelState();

    return {
      getQuizId: () => quizId,
      getContextJurnal,
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getMinLevel: () => MIN_LEVEL,
      getLevelLabel: () => {
        const currentId = orchestrator?.getCurrentId?.();
        if (inLevel0) return "Nivel 0 - Subquiz 5 - Fluent party";
        if (currentId === SQ3_ID) {
          return `Nivel ${level} - Subquiz 3 - grup de factori`;
        }
        if (currentId === SQ5_ID) {
          return `Nivel ${level} - Subquiz 5 - Fluent party`;
        }
        return `Nivel ${level} - Subquiz 1 - baza (${factorForLevel(level)}x)`;
      },
      getLevelButtonTitle: (targetLevel) => `Nivel ${targetLevel}: ${factorForLevel(targetLevel)}*1-20`,
      isCompleted: () => completed,
      getProgressDisplay: () => global.ProgressDisplay.hidden(),

      switchLevel(nextLevel) {
        level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        completed = false;
        // Alegere manuala de nivel = renuntare la level 0, daca nu rulase
        // deja (nu doar "nu se reia dupa" — R7 din plan — ci nici nu incepe
        // acum): userul a cerut explicit un nivel anume, nu turul de
        // deschidere prin toate subtablele.
        level0Done = true;
        resetLevelState();
        return null;
      },

      pickNextRound() {
        if (!fluentaEsteGata()) return loadingRound();
        return beginRoute();
      },

      setOnFluentaReady(callback) {
        onFluentaReadyCallback = typeof callback === "function" ? callback : null;
      },

      placeholderRaspuns: global.PlaceholderRaspuns.creeaza("?"),
      beginRound(next) {
        return next ?? beginRoute();
      },

      getSubquizStage: () => orchestrator?.getCurrentId?.() ?? "base",
      getSubquizStartOption: () => "base",
      getSubquizStartOptions() {
        return [{ id: "base", label: "1 baza" }];
      },
      setSubquizStartOption(stageId) {
        return stageId === "base";
      },

      getInfo11_20() {
        const A = factorForLevel(level);
        const baseState = shared.baseState;
        const sq3State = shared.sq3State;
        const sq5State = shared.sq5State;
        const currentId = orchestrator?.getCurrentId?.() ?? "base";
        const coveredCount = baseState?.covered?.size ?? 0;
        const sq3Progress = sq3State
          ? sq3State.facts
              .map((b) => `${A}*${b} ${sq3State.correctCountsByB[b] ?? 0}/${SQ3_EXIT_CORRECT_COUNT}`)
              .join(", ")
          : "-";

        if (currentId === SQ5_ID) {
          const gata = sq5State
            ? sq5State.facts.filter((f) => (sq5State.turnsByKey[`${f.a}*${f.b}`] ?? 0) >= sq5State.turnsTarget)
                .length
            : 0;
          const total = sq5State?.facts.length ?? 0;
          return {
            visible: true,
            mode: inLevel0 ? "Nivel 0: Fluent party" : "Subquiz 5: Fluent party",
            theme: "sq2-eff-vbs",
            wrongFactsText: "-",
            intensivText: `${gata} / ${total} facte gata`,
            answeredText: `${sq5State?.questionCount ?? 0} intrebari SQ5`,
            intensivSessionsText: "-",
            facts: (sq5State?.facts ?? []).map((f) => ({
              label: `${f.a}*${f.b}`,
              timeText: "-",
              fast: false,
            })),
          };
        }

        return {
          visible: true,
          mode: currentId === SQ3_ID ? "Subquiz 3: grup de factori" : "Subquiz 1: baza",
          theme: currentId === SQ3_ID ? "sq2-eff-vbs" : "base",
          wrongFactsText: baseState?.wrongFacts?.length
            ? baseState.wrongFacts.map((b) => `${A}*${b}`).join(", ")
            : "-",
          intensivText: currentId === SQ3_ID ? sq3Progress : "-",
          answeredText:
            currentId === SQ3_ID
              ? `${sq3State?.questionCount ?? 0} intrebari SQ3`
              : `${coveredCount} / ${TOTAL_FACTS_PER_LEVEL} acoperite`,
          intensivSessionsText: `${sq3Count} / ${SQ3_MAX_PER_LEVEL} sq3`,
          facts: allBs().map((b) => ({
            label: `${A}*${b}`,
            timeText: "-",
            fast: false,
          })),
        };
      },

      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },

      onTimeout(meta = {}) {
        return orchestrator.onTimeout(meta);
      },

      appendSq3ControlPanel,
      appendSq5ControlPanel,

      // Bug reparat (vezi documente de referinta/RAPORT-motor-comun-raspuns.md,
      // "Bug-uri gasite, NEreparate" #1): inainte, un camp cu o valoare invalida
      // era ignorat tacit, fara nicio urma — apelantul nu avea cum sa afle ca
      // cererea lui a fost respinsa. Acum fiecare camp CERUT (prezent in
      // `config`) dar respins e adaugat la `rejected`, in loc sa dispara tacut.
      // Comportamentul PE FIECARE camp ramane identic (aceleasi multimi valide,
      // acelasi no-op pe valoare invalida) — doar raspunsul functiei spune
      // adevarul, in loc sa intoarca mereu `true` necondiționat.
      setSq2Config(config = {}) {
        const rejected = [];
        if (config.intensiveMode !== undefined) {
          if (SQ2_INTENSIVE_MODES.includes(config.intensiveMode)) {
            intensiveMode = config.intensiveMode;
            if (intensiveMode === "alternate") nextAlternateIntensiveTarget = SQ2_VBS_ID;
            writeSetting(SQ2_INTENSIVE_MODE_KEY, intensiveMode);
          } else {
            rejected.push("intensiveMode");
          }
        }
        if (config.sbsAnswerFactor !== undefined) {
          if (typeof config.sbsAnswerFactor === "boolean") {
            sbsAnswerFromFactor = config.sbsAnswerFactor;
            writeSetting(SQ2_SBS_ANSWER_FACTOR_KEY, sbsAnswerFromFactor);
          } else {
            rejected.push("sbsAnswerFactor");
          }
        }
        if (config.sbsAnswerProduct !== undefined) {
          if (typeof config.sbsAnswerProduct === "boolean") {
            sbsAnswerFromProduct = config.sbsAnswerProduct;
            writeSetting(SQ2_SBS_ANSWER_PRODUCT_KEY, sbsAnswerFromProduct);
          } else {
            rejected.push("sbsAnswerProduct");
          }
        }
        ensureSbsAnswerSource();
        if (config.factCount !== undefined) {
          if ([1, 2, 3, 4].includes(Number(config.factCount))) {
            sq2FactCount = Number(config.factCount);
            writeSetting(SQ2_FACT_COUNT_KEY, sq2FactCount);
          } else {
            rejected.push("factCount");
          }
        }
        if (config.exitCount !== undefined) {
          if ([3, 4, 5].includes(Number(config.exitCount))) {
            sq2ExitCount = Number(config.exitCount);
            writeSetting(SQ2_EXIT_COUNT_KEY, sq2ExitCount);
          } else {
            rejected.push("exitCount");
          }
        }
        if (config.exitMode !== undefined) {
          if (config.exitMode === "correct" || config.exitMode === "any") {
            sq2ExitMode = config.exitMode;
            writeSetting(SQ2_EXIT_MODE_KEY, sq2ExitMode);
          } else {
            rejected.push("exitMode");
          }
        }
        if (config.eqFormCount !== undefined) {
          if (rangeChoices(SQ2_EQ_FORM_MIN, SQ2_EQ_FORM_MAX).includes(Number(config.eqFormCount))) {
            sq2EqFormCount = Number(config.eqFormCount);
            writeSetting(SQ2_EQ_FORM_COUNT_KEY, sq2EqFormCount);
          } else {
            rejected.push("eqFormCount");
          }
        }
        return { ok: rejected.length === 0, rejected };
      },
    };
  }

  global.Mul1120V4IntensivMultipli234Quiz = { create: createQuiz };

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: QUIZ_TITLE,
    description: "Clona v4 de la v3: subquiz 1 pe acoperire completa (1-20), subquiz 3 intensiv pe grupuri de factori, jurnalizare activa din start.",
    order: 2.3,
    gestionareGreseli: { activ: false },
    create(meta = {}) {
      return global.Mul1120V4IntensivMultipli234Quiz.create({
        ...meta,
        quizId: meta.id ?? QUIZ_ID,
        jurnalIntrebariActiv: true,
      });
    },
  });
})(window);
