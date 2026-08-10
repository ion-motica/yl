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
  const SQ3_EXIT_MAX_ATTEMPTS = 5;
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

  function rangeChoices(min, max) {
    return Array.from({ length: max - min + 1 }, (_, index) => min + index);
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
    // injecteaza direct o sursa sincrona, ocolind IndexedDB. In productie, se
    // calculeaza o singura data, la pornirea quizului, pentru toate nivelele
    // (SnapshotFluenta.pregateste e asincron; pana se rezolva, sursa goala ->
    // medie = 0 peste tot, decizia ramane pe acoperire).
    let fluentaSursa =
      config.fluentaSursa ??
      (global.SnapshotFluenta ? global.SnapshotFluenta.sursaGoala() : { scorPtFact: () => 0 });
    if (!config.fluentaSursa && global.SnapshotFluenta?.pregateste) {
      global.SnapshotFluenta
        .pregateste()
        .then((sursa) => {
          fluentaSursa = sursa;
        })
        .catch(() => {});
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

    const shared = {
      baseState: null,
      sq3State: null,
      sq2State: null,
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

    function makeFact(b) {
      return Catalog.createFact({
        operation: "mul",
        values: { a: factorForLevel(level), b },
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

    function questionItem(prompt, correct, b, product, subquizId, extraMetadata = {}) {
      const A = factorForLevel(level);
      const fact = makeFact(b);
      const opt = buildMulDivEqFormOptions(correct, product, shuffle);
      return {
        prompt,
        correctAnswer: correct,
        options: opt.options,
        correctIndex: opt.correctIndex,
        metadata: {
          questionInstanceId: `${quizId}:${++questionInstanceSequence}`,
          subquiz: subquizId,
          factA: A,
          factB: b,
          product,
          fact: `${A}*${b}=${product}`,
          factId: fact.factId,
          eqForm: prompt,
          ...extraMetadata,
        },
      };
    }

    function fallbackQuestionForB(b, subquizId, state) {
      const A = factorForLevel(level);
      const product = A * b;
      const shouldAvoidLevelFactor = !canUseLevelFactorAnswer(state);

      if (shouldAvoidLevelFactor && product === A) {
        const correct = b;
        noteLevelFactorAnswer(state, correct === A);
        return questionItem(`${A}*?=${product}`, correct, b, product, subquizId, {
          fallback: true,
          avoidedLevelFactorAnswer: true,
        });
      }

      const correct = product;
      noteLevelFactorAnswer(state, correct === A);
      return questionItem(`${A}*${b}=?`, correct, b, product, subquizId, {
        fallback: true,
      });
    }

    function qfTypesForSubquiz(subquizId) {
      if (subquizId === SQ2_VBS_ID) return qfTypes.slice(0, sq2EqFormCount);
      if (subquizId === SQ3_ID) return sq3QfTypes.slice(0, sq3EqFormCount);
      return qfTypes;
    }

    function buildQuestionForB(b, subquizId = "base", state = null) {
      const A = factorForLevel(level);
      const product = A * b;
      const fact = makeFact(b);
      const allowLevelFactorAnswer = canUseLevelFactorAnswer(state);

      for (const type of shuffle(qfTypesForSubquiz(subquizId))) {
        const rendered = QFG.renderQF(type, fact);
        if (!rendered || rendered.answerType !== "number") continue;
        const correct = Number(rendered.correctAnswer);
        if (!Number.isFinite(correct)) continue;
        if (correct === A && !allowLevelFactorAnswer) continue;
        noteLevelFactorAnswer(state, correct === A);
        return questionItem(rendered.prompt, correct, b, product, subquizId, {
          qfTypeId: type.id,
        });
      }

      return fallbackQuestionForB(b, subquizId, state);
    }

    function factLabel(b) {
      return `${factorForLevel(level)}*${b}`;
    }

    function roundViewFrom(runtime, extra = {}) {
      return runtime.view({
        hintMessage: HINT,
        ...extra,
      });
    }

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
        const scoruri = fg.map((b) => fluentaSursa.scorPtFact(A, b));
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
      const stare = fluentaSursa.starePtFact ? fluentaSursa.starePtFact(A, b) : "netestat";
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
    //   "normal" — regula standard: >=3 corecte SAU >=5 incercari (plasa).
    //   "once"   — fact fluent, dar netestat inca in sesiunea curenta (nivelul
    //              curent): o singura incercare, corect sau gresit, e suficienta.
    //   "skip"   — fact fluent SI deja testat in sesiunea curenta: nu mai e
    //              rulat deloc (dar ramane vizibil in stack, bifat — vezi
    //              renderStackHtml).
    function factDone(state, b) {
      const policy = state.exitPolicyByB?.[b] ?? "normal";
      if (policy === "skip") return true;
      if (policy === "once") return (state.attemptsByB[b] ?? 0) >= 1;
      return (
        (state.correctCountsByB[b] ?? 0) >= SQ3_EXIT_CORRECT_COUNT ||
        (state.attemptsByB[b] ?? 0) >= SQ3_EXIT_MAX_ATTEMPTS
      );
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
        onAnswer(event) {
          const { item, index, state, runtime } = event;
          shared.baseState = state;
          const chosen = item.options[index];
          const isCorrect = Number(chosen) === Number(item.correctAnswer);
          const factB = item.metadata.factB;

          state.questionCount += 1;
          if (isCorrect) state.correctCount += 1;
          else if (!state.wrongFacts.includes(factB)) state.wrongFacts.push(factB);
          state.covered.add(factB);

          // Din acest punct: motorul comun (blockWrongTransition, in
          // subquiz-definition.js) anuleaza automat orice tranzitie (push/exit)
          // intoarsa dintr-un raspuns gresit, cu exceptia celor marcate explicit
          // `allowOnWrong: true` — altfel declansatorul "2 facte gresite" sau
          // finalul de nivel pe un raspuns gresit ar fi ignorate silentios.
          if (state.covered.size >= TOTAL_FACTS_PER_LEVEL) {
            return {
              action: "exit",
              reason: "levelCovered",
              allowOnWrong: true,
              view: {
                outcome: "step-correct",
                correct: true,
                bounce: true,
                flash: "win",
                message: "Subquiz 1 baza terminat, next level",
              },
            };
          }

          if (state.wrongFacts.length >= 2) {
            const command = maybeEnterSq3(state, "twoWrongFacts");
            if (command) return { ...command, allowOnWrong: true };
          }

          if (state.questionCount % SQ3_TRIGGER_EVERY_BASE_ANSWERS === 0) {
            const command = maybeEnterSq3(state, "baseFiveFacts");
            if (command) return { ...command, allowOnWrong: true };
          }

          if (!isCorrect) {
            // Raspuns gresit, fara declansator: motorul reia automat aceeasi
            // intrebare (blockWrongTransition). NU chemam nextItem() aici —
            // altfel am avansa in tacere coada de acoperire pe un fact care
            // nu ajunge niciodata sa fie afisat.
            return {
              action: "continue",
              view: roundViewFrom(runtime, {
                outcome: "wrong-answer",
                correct: false,
                flash: "wrong",
                message: `${chosen} nu e bun.`,
              }),
            };
          }

          runtime.nextItem({ reason: "afterAnswer" });
          return {
            action: "continue",
            view: roundViewFrom(runtime, {
              outcome: "step-correct",
              correct: true,
              bounce: true,
              message: "Corect!",
            }),
          };
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
        initialState({ payload }) {
          const bs = [...new Set((payload?.bs ?? []).map(Number))].filter(isValidB).sort((a, b) => a - b);
          const facts = bs.length ? bs : [B_MIN];
          const state = {
            facts,
            correctCountsByB: {},
            attemptsByB: {},
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
            state.attemptsByB[b] = 0;
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
        onAnswer(event) {
          const { item, index, state, runtime } = event;
          shared.sq3State = state;
          const chosen = item.options[index];
          const isCorrect = Number(chosen) === Number(item.correctAnswer);
          const factB = item.metadata.factB;

          state.questionCount += 1;
          state.attemptsByB[factB] = (state.attemptsByB[factB] ?? 0) + 1;
          if (isCorrect) state.correctCountsByB[factB] = (state.correctCountsByB[factB] ?? 0) + 1;

          const thisFactJustDone = factDone(state, factB);
          if (thisFactJustDone && shared.baseState) {
            shared.baseState.covered.add(factB);
          }

          const complete = state.facts.every((b) => factDone(state, b));
          if (complete) {
            if (shared.baseState) {
              state.facts.forEach((b) => shared.baseState.covered.add(b));
            }
            // allowOnWrong: plasa de siguranta (5 incercari) se declanseaza
            // adesea chiar pe raspunsul gresit — fara flag, blockWrongTransition
            // ar anula "pop"-ul si sq3 nu ar iesi niciodata.
            return { action: "pop", reason: "sq3Complete", allowOnWrong: true, payload: { sq3Completed: true } };
          }

          if (!isCorrect && !thisFactJustDone) {
            // Raspuns gresit, fact-ul inca nu e "gata" — motorul reia automat
            // aceeasi intrebare (blockWrongTransition). NU chemam nextItem()
            // aici, altfel am avansa in tacere coada de facte ale fg-ului pe
            // unul care nu ajunge niciodata sa fie afisat.
            return {
              action: "continue",
              view: roundViewFrom(runtime, {
                outcome: "wrong-answer",
                correct: false,
                flash: "wrong",
                message: `${chosen} nu e bun.`,
              }),
            };
          }

          // Fie a raspuns corect, fie fact-ul tocmai a atins plasa de siguranta
          // (5 incercari, fara 3 corecte) — in ambele cazuri trecem mai departe,
          // ca sa nu tina ostatic tot subquiz-ul pe un fact la care userul e
          // blocat (allowOnWrong: cazul al doilea e un "continue" pe raspuns
          // gresit, altfel blocat de blockWrongTransition).
          runtime.nextItem({ reason: "sq3Next" });
          return {
            action: "continue",
            allowOnWrong: true,
            view: roundViewFrom(runtime, {
              outcome: isCorrect ? "step-correct" : "wrong-answer",
              correct: isCorrect,
              bounce: isCorrect,
              flash: isCorrect ? undefined : "wrong",
              message: isCorrect ? "Corect!" : `${chosen} nu e bun. Trecem mai departe.`,
            }),
          };
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

    function handleIntensiveAnswer(event) {
      const { item, index, state, runtime } = event;
      shared.sq2State = state;
      const chosen = item.options[index];
      const isCorrect = Number(chosen) === Number(item.correctAnswer);
      const factB = item.metadata.factB;

      state.questionCount += 1;
      state.countsByB[factB] = (state.countsByB[factB] ?? 0) + 1;
      if (isCorrect) state.correctCountsByB[factB] = (state.correctCountsByB[factB] ?? 0) + 1;

      const complete = state.facts.every((b) => {
        const value =
          sq2ExitMode === "any" ? state.countsByB[b] ?? 0 : state.correctCountsByB[b] ?? 0;
        return value >= sq2ExitCount;
      });

      if (complete) {
        return {
          action: "pop",
          reason: "sq2Complete",
          payload: { sq2Completed: true },
        };
      }

      runtime.nextItem({ reason: "sq2Next" });
      return {
        action: "continue",
        view: roundViewFrom(runtime, {
          outcome: "step-correct",
          correct: isCorrect,
          bounce: isCorrect,
          flash: isCorrect ? undefined : "wrong",
          message: isCorrect ? "Corect!" : `${chosen} nu e bun.`,
        }),
      };
    }

    function sq2Definition() {
      return global.SubquizDefinition.define({
        id: SQ2_VBS_ID,
        title: "Intensiv cu eff VBS",
        hintMessage: HINT,
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
        onAnswer: handleIntensiveAnswer,
        onTimeout: handleIntensiveTimeout,
      });
    }

    function sq2SbsDefinition() {
      return global.SubquizDefinition.define({
        id: SQ2_SBS_ID,
        title: "Intensiv SBS",
        hintMessage: HINT,
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
        onAnswer: handleIntensiveAnswer,
        onTimeout: handleIntensiveTimeout,
      });
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

    // ---- orchestrare + nivele --------------------------------------------

    function createOrchestrator() {
      orchestrator = global.SubquizOrchestrator.create({
        definitions: [baseDefinition(), sq3Definition(), sq2Definition(), sq2SbsDefinition()],
        activeSubquizIds: ["base"],
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
      shared.usedFgIndexes = new Set();
      shared.levelFactorAnswerHistory = [];
      sq3Count = 0;
      createOrchestrator();
    }

    function beginRoute() {
      if (!orchestrator) createOrchestrator();
      return orchestrator.startFirst();
    }

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

    function handleOrchestratorResult(result) {
      if (result?.subquizEvent?.routeComplete) return advanceLevel();
      return result;
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
        if (currentId === SQ3_ID) {
          return `Nivel ${level} - Subquiz 3 - grup de factori`;
        }
        return `Nivel ${level} - Subquiz 1 - baza (${factorForLevel(level)}x)`;
      },
      getLevelButtonTitle: (targetLevel) => `Nivel ${targetLevel}: ${factorForLevel(targetLevel)}*1-20`,
      isCompleted: () => completed,
      getProgressDisplay: () => global.ProgressDisplay.hidden(),

      switchLevel(nextLevel) {
        level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        completed = false;
        resetLevelState();
        return null;
      },

      pickNextRound() {
        return beginRoute();
      },

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
        const currentId = orchestrator?.getCurrentId?.() ?? "base";
        const coveredCount = baseState?.covered?.size ?? 0;
        const sq3Progress = sq3State
          ? sq3State.facts
              .map((b) => `${A}*${b} ${sq3State.correctCountsByB[b] ?? 0}/${SQ3_EXIT_CORRECT_COUNT}`)
              .join(", ")
          : "-";
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
        return handleOrchestratorResult(orchestrator.onAnswer(index, meta));
      },

      onTimeout(meta = {}) {
        return handleOrchestratorResult(orchestrator.onTimeout(meta));
      },

      appendSq3ControlPanel,

      setSq2Config(config = {}) {
        if (SQ2_INTENSIVE_MODES.includes(config.intensiveMode)) {
          intensiveMode = config.intensiveMode;
          if (intensiveMode === "alternate") nextAlternateIntensiveTarget = SQ2_VBS_ID;
          writeSetting(SQ2_INTENSIVE_MODE_KEY, intensiveMode);
        }
        if (typeof config.sbsAnswerFactor === "boolean") {
          sbsAnswerFromFactor = config.sbsAnswerFactor;
          writeSetting(SQ2_SBS_ANSWER_FACTOR_KEY, sbsAnswerFromFactor);
        }
        if (typeof config.sbsAnswerProduct === "boolean") {
          sbsAnswerFromProduct = config.sbsAnswerProduct;
          writeSetting(SQ2_SBS_ANSWER_PRODUCT_KEY, sbsAnswerFromProduct);
        }
        ensureSbsAnswerSource();
        if ([1, 2, 3, 4].includes(Number(config.factCount))) {
          sq2FactCount = Number(config.factCount);
          writeSetting(SQ2_FACT_COUNT_KEY, sq2FactCount);
        }
        if ([3, 4, 5].includes(Number(config.exitCount))) {
          sq2ExitCount = Number(config.exitCount);
          writeSetting(SQ2_EXIT_COUNT_KEY, sq2ExitCount);
        }
        if (config.exitMode === "correct" || config.exitMode === "any") {
          sq2ExitMode = config.exitMode;
          writeSetting(SQ2_EXIT_MODE_KEY, sq2ExitMode);
        }
        if (rangeChoices(SQ2_EQ_FORM_MIN, SQ2_EQ_FORM_MAX).includes(Number(config.eqFormCount))) {
          sq2EqFormCount = Number(config.eqFormCount);
          writeSetting(SQ2_EQ_FORM_COUNT_KEY, sq2EqFormCount);
        }
        return true;
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
