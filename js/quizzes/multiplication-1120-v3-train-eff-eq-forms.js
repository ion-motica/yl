(function (global) {
  "use strict";

  const QUIZ_ID = "multiplication-1120-v3-train-eff-eq-forms";
  const QUIZ_TITLE = "T*/ 11-20 - v3 - train w eff si eq forms";
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 10;
  const QUESTIONS_PER_LEVEL = 12;
  const SQ2_TRIGGER_EVERY_BASE_ANSWERS = 5;
  const FACT_B_MIN = 2;
  const FACT_WINDOW_SIZE = 5;
  const LEVEL_FACTOR_ANSWER_WINDOW = 10;
  const LEVEL_FACTOR_ANSWER_MAX_IN_WINDOW = 1;
  const HINT = "Alege raspunsul corect.";
  const SQ2_FACT_COUNT_KEY = "yl:mul1120v3:sq2FactCount";
  const SQ2_EXIT_COUNT_KEY = "yl:mul1120v3:sq2ExitCount";
  const SQ2_EXIT_MODE_KEY = "yl:mul1120v3:sq2ExitMode";
  const SQ2_EQ_FORM_COUNT_KEY = "yl:mul1120v3:sq2EqFormCount:v2";
  const SQ2_INTENSIVE_MODE_KEY = "yl:mul1120v3:intensiveMode";
  const SQ2_SBS_ANSWER_FACTOR_KEY = "yl:mul1120v3:sbsAnswerFactor";
  const SQ2_SBS_ANSWER_PRODUCT_KEY = "yl:mul1120v3:sbsAnswerProduct";
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

    let level = MIN_LEVEL;
    let completed = false;
    let orchestrator = null;
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
      sq2State: null,
      sq2FactsText: [],
      levelFactorAnswerHistory: [],
    };
    let questionInstanceSequence = 0;

    function subquizName(subquizId) {
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

    function maxFactB() {
      return factorForLevel(level);
    }

    function getLevelFactBs() {
      return Array.from(
        { length: Math.max(0, maxFactB() - FACT_B_MIN + 1) },
        (_, index) => FACT_B_MIN + index
      );
    }

    function isLevelFactB(b) {
      const factB = Number(b);
      return Number.isFinite(factB) && factB >= FACT_B_MIN && factB <= maxFactB();
    }

    function validLevelFacts(bs) {
      return uniqueFacts(bs).filter(isLevelFactB);
    }

    function isIntensiveSubquiz(id) {
      return id === SQ2_VBS_ID || id === SQ2_SBS_ID;
    }

    function intensiveLabel(id) {
      return id === SQ2_SBS_ID ? "SBS" : "EFF VBS";
    }

    function intensiveTargetFactCount(id) {
      return id === SQ2_SBS_ID ? SQ2_SBS_FACT_COUNT : sq2FactCount;
    }

    function ensureSbsAnswerSource() {
      if (sbsAnswerFromFactor || sbsAnswerFromProduct) return;
      sbsAnswerFromFactor = true;
      writeSetting(SQ2_SBS_ANSWER_FACTOR_KEY, true);
    }

    function pickIntensiveTarget() {
      if (intensiveMode === "sbs") return SQ2_SBS_ID;
      if (intensiveMode === "alternate") {
        const target = nextAlternateIntensiveTarget;
        nextAlternateIntensiveTarget = target === SQ2_VBS_ID ? SQ2_SBS_ID : SQ2_VBS_ID;
        return target;
      }
      if (intensiveMode === "random") {
        return random() < 0.5 ? SQ2_VBS_ID : SQ2_SBS_ID;
      }
      return SQ2_VBS_ID;
    }

    function qfTypesForSubquiz(subquizId) {
      if (subquizId !== SQ2_VBS_ID) return qfTypes;
      return qfTypes.slice(0, sq2EqFormCount);
    }

    function createBaseFactSequencer() {
      return Sequencer.createSlidingWindow({
        min: FACT_B_MIN,
        max: maxFactB(),
        windowSize: FACT_WINDOW_SIZE,
        random,
      });
    }

    function buildBQueue(values = []) {
      const facts = validLevelFacts(values);
      const cycle = Sequencer.createCycle({ values: facts, random });
      return facts.map(() => cycle.next()).filter(isLevelFactB);
    }

    function pickB(state) {
      if (!state.factSequencer) state.factSequencer = createBaseFactSequencer();
      return state.factSequencer.next() ?? FACT_B_MIN;
    }

    function canUseLevelFactorAnswer(state) {
      const history = shared.levelFactorAnswerHistory || state?.levelFactorAnswerHistory || [];
      const recent = history.slice(-(LEVEL_FACTOR_ANSWER_WINDOW - 1));
      return (
        recent.filter(Boolean).length < LEVEL_FACTOR_ANSWER_MAX_IN_WINDOW
      );
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

    function buildBaseQuestion(state) {
      return buildQuestionForB(pickB(state), "base", state);
    }

    function factLabel(b) {
      return `${factorForLevel(level)}*${b}`;
    }

    function uniqueFacts(bs) {
      return [...new Set((bs || []).filter((b) => Number.isFinite(Number(b))).map(Number))];
    }

    function selectFactsForSq2(preferredBs = [], options = {}) {
      const state = shared.baseState;
      if (!state) return [];
      const targetCount = Math.max(1, Number(options.targetCount) || sq2FactCount);
      const picked = [];
      const recent = uniqueFacts(state.recentSq2Facts);

      function add(b, { allowRecent = false } = {}) {
        if (!Number.isFinite(Number(b))) return;
        const factB = Number(b);
        if (!isLevelFactB(factB) || picked.includes(factB)) return;
        if (!allowRecent && recent.includes(factB)) return;
        picked.push(factB);
      }

      uniqueFacts(preferredBs).forEach(add);
      uniqueFacts(state.wrongFacts).forEach(add);

      const slowFacts = Object.entries(state.responseTimesByB || {})
        .map(([b, ms]) => ({ b: Number(b), ms: Number(ms) }))
        .filter((entry) => Number.isFinite(entry.b) && Number.isFinite(entry.ms))
        .sort((a, b) => b.ms - a.ms);
      slowFacts.forEach((entry) => {
        if (picked.length < targetCount) add(entry.b);
      });

      const currentWindow = state.factSequencer?.currentWindow?.() || [];
      currentWindow.forEach((b) => {
        if (picked.length < targetCount) add(b);
      });
      getLevelFactBs().forEach((b) => {
        if (picked.length < targetCount) add(b);
      });

      if (picked.length < targetCount && recent.length) {
        uniqueFacts(preferredBs).forEach((b) => add(b, { allowRecent: true }));
        uniqueFacts(state.wrongFacts).forEach((b) => add(b, { allowRecent: true }));
        slowFacts.forEach((entry) => {
          if (picked.length < targetCount) add(entry.b, { allowRecent: true });
        });
        currentWindow.forEach((b) => {
          if (picked.length < targetCount) add(b, { allowRecent: true });
        });
        getLevelFactBs().forEach((b) => {
          if (picked.length < targetCount) add(b, { allowRecent: true });
        });
      }

      return picked.slice(0, targetCount);
    }

    function noteSq2SelectedFacts(selected) {
      const state = shared.baseState;
      if (!state) return;
      state.recentSq2Facts = uniqueFacts(selected);
      state.wrongFacts = uniqueFacts(state.wrongFacts).filter((b) => !state.recentSq2Facts.includes(b));
      state.recentSq2Facts.forEach((b) => {
        delete state.responseTimesByB[b];
      });
    }

    function startIntensiveWithFacts(facts, reason, view = {}, targetId = pickIntensiveTarget()) {
      const selected = validLevelFacts(facts).slice(0, intensiveTargetFactCount(targetId));
      if (!selected.length) return null;
      shared.sq2FactsText = selected.map(factLabel);
      return {
        action: "push",
        targetId,
        payload: { facts: selected, reason },
        view: {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Subquiz 2 ${intensiveLabel(targetId)}: ${shared.sq2FactsText.join(", ")}`,
          ...view,
        },
      };
    }

    function maybeEnterSq2FromBase(state, reason) {
      const targetId = pickIntensiveTarget();
      const facts = selectFactsForSq2([], { targetCount: intensiveTargetFactCount(targetId) });
      if (!facts.length) return null;
      return startIntensiveWithFacts(facts, reason, {}, targetId);
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
    // el — CUM raspunde nu mai e treaba fisierului asta. Fixul de "pop fara view" (necesar ca
    // `onResume`-ul lui `base` sa nu fie ingropat de view-ul minimal al M3B) e centralizat
    // acum in subquiz-definition.js, nu mai trebuie reimplementat aici.
    //
    // `esteCorect` pastrat identic cu vechiul cod (Number(...) === Number(...), fara fallback
    // pe string) — toate intrebarile de-aici sunt numerice, nicio schimbare de comportament.
    const esteCorectV3 = (it, idx) => Number(it.options[idx]) === Number(it.correctAnswer);
    const mesajeV3 = {
      corect: "Corect!",
      gresit: (ctx) => `${ctx.alesul} nu e bun.`,
    };

    // CORECTIE INTENTIONATA majora, mostenita din migrarea la Motor3Butoane (Categoria 2 din
    // FAZA-A-inventar-contract.md): toate cele 3 subquizuri (`base`, `sq2EffVbs`, `sq2EffSbs`)
    // apelau `runtime.nextItem()` NECONDITIONAT, indiferent de corect/gresit — asta era
    // singurul fisier din tot refactorul unde 100% din continut avansa mereu, fara nicio
    // verificare. Corectat: gresit ramane pe intrebare, garantat structural de Motor3Butoane.
    //
    // Descoperire utila la migrare: `sq2ExitMode` ("correct" vs "any") se mapeaza exact pe
    // distinctia `turCorect` a lui M3B (verdictul turului dat STRICT de prima apasare) —
    // "correct" numara doar turele rezolvate din prima incercare, "any" numara orice tura
    // rezolvata (oricate incercari a avut). Inainte de migrare, distinctia asta nu avea sens
    // curat (gresitul sarea la alta intrebare, deci "orice apasare" insemna altceva) — acum
    // capata exact sensul pt. care fusese gandit switch-ul din panoul de control.
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
        return {
          action: "pop",
          reason: "sq2Complete",
          payload: { sq2Completed: true },
        };
      }
      // altfel: ramane in acelasi subquiz — Motor3Butoane cere generator-ul automat
      // (mesajul "Corect!" vine din `mesajeV3.corect`, nu mai trebuie construit aici).
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
        esteCorect: esteCorectV3,
        mesaje: mesajeV3,
        initialState() {
          const state = {
            questionCount: 0,
            correctCount: 0,
            factSequencer: createBaseFactSequencer(),
            wrongFacts: [],
            responseTimesByB: {},
            currentFactB: null,
            levelFactorAnswerHistory: [],
          };
          shared.baseState = state;
          return state;
        },
        generator({ state }) {
          shared.baseState = state;
          const item = buildBaseQuestion(state);
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
            if (Number.isFinite(ctx.meta.responseMs)) state.responseTimesByB[factB] = ctx.meta.responseMs;

            if (state.wrongFacts.length >= 2) {
              const command = maybeEnterSq2FromBase(state, "twoWrongFacts");
              if (command) return command;
            }

            if (state.questionCount % SQ2_TRIGGER_EVERY_BASE_ANSWERS === 0) {
              const command = maybeEnterSq2FromBase(state, "baseFiveFacts");
              if (command) return command;
            }

            if (state.questionCount >= QUESTIONS_PER_LEVEL) {
              return {
                action: "exit",
                reason: "answeredCount",
                view: { flash: "win", message: "Subquiz 1 baza terminat, next level" },
              };
            }
            // altfel: ramane in "base" — Motor3Butoane cere generator-ul automat.
          },
        },
        onResume({ runtime }) {
          if (runtime?.getState) shared.baseState = runtime.getState();
          runtime.nextItem({ reason: "resumeFromSq2" });
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

    function sq2Definition() {
      return global.SubquizDefinition.define({
        id: SQ2_VBS_ID,
        title: "Intensiv cu eff VBS",
        hintMessage: HINT,
        esteCorect: esteCorectV3,
        mesaje: mesajeV3,
        initialState({ payload }) {
          const facts = validLevelFacts(payload?.facts).slice(0, 4);
          noteSq2SelectedFacts(facts);
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
          shared.sq2FactsText = state.facts.map(factLabel);
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
        esteCorect: esteCorectV3,
        mesaje: mesajeV3,
        initialState({ payload }) {
          const facts = validLevelFacts(payload?.facts).slice(0, SQ2_SBS_FACT_COUNT);
          noteSq2SelectedFacts(facts);
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
          shared.sq2FactsText = state.facts.map(factLabel);
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

    function createOrchestrator() {
      orchestrator = global.SubquizOrchestrator.create({
        definitions: [baseDefinition(), sq2Definition(), sq2SbsDefinition()],
        activeSubquizIds: ["base"],
        onRouteComplete: () => advanceLevel(),
        context: {
          quizId,
          getLevel: () => level,
          hintMessage: HINT,
        },
      });
    }

    function resetLevelState() {
      shared.baseState = null;
      shared.sq2State = null;
      shared.sq2FactsText = [];
      shared.levelFactorAnswerHistory = [];
      createOrchestrator();
    }

    function beginRoute() {
      if (!orchestrator) createOrchestrator();
      return orchestrator.startFirst();
    }

    // `advanceLevel` se cheama DOAR prin `onRouteComplete`, adica din interiorul
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

    resetLevelState();

    return {
      getQuizId: () => quizId,
      getContextJurnal,
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getMinLevel: () => MIN_LEVEL,
      getLevelLabel: () => {
        const currentId = orchestrator?.getCurrentId?.();
        if (currentId === SQ2_VBS_ID) {
          return `Nivel ${level} - Subquiz 2 - Intensiv cu eff VBS`;
        }
        if (currentId === SQ2_SBS_ID) {
          return `Nivel ${level} - Subquiz 2 - Intensiv SBS`;
        }
        return `Nivel ${level} - Subquiz 1 - baza (${factorForLevel(level)}x)`;
      },
      getLevelButtonTitle: (targetLevel) =>
        `Nivel ${targetLevel}: ${factorForLevel(targetLevel)}*${FACT_B_MIN}-${factorForLevel(targetLevel)}`,
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
        const sq2State = shared.sq2State;
        const currentId = orchestrator?.getCurrentId?.() ?? "base";
        const sq2Progress = sq2State
          ? sq2State.facts
              .map((b) => {
                const value =
                  sq2ExitMode === "any"
                    ? sq2State.countsByB[b] ?? 0
                    : sq2State.correctCountsByB[b] ?? 0;
                return `${factLabel(b)} ${value}/${sq2ExitCount}`;
              })
              .join(", ")
          : "-";
        return {
          visible: true,
          mode:
            currentId === SQ2_VBS_ID
              ? "Subquiz 2: Intensiv cu eff VBS"
              : currentId === SQ2_SBS_ID
                ? "Subquiz 2: Intensiv SBS"
                : "Subquiz 1: baza",
          theme: isIntensiveSubquiz(currentId) ? "sq2-eff-vbs" : "base",
          wrongFactsText: baseState?.wrongFacts?.length
            ? baseState.wrongFacts.map(factLabel).join(", ")
            : "-",
          intensivText: isIntensiveSubquiz(currentId) ? sq2Progress : shared.sq2FactsText.join(", ") || "-",
          answeredText:
            isIntensiveSubquiz(currentId)
              ? `${sq2State?.questionCount ?? 0} intrebari SQ2`
              : `${baseState?.questionCount ?? 0} / ${QUESTIONS_PER_LEVEL}`,
          intensivSessionsText: "-",
          facts: getLevelFactBs().map((b) => {
            return {
              label: `${A}*${b}`,
              timeText: "-",
              fast: false,
            };
          }),
        };
      },

      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },

      onTimeout(meta = {}) {
        return orchestrator.onTimeout(meta);
      },

      getArenaActions() {
        return [
          {
            id: "sendCurrentFactToSq2",
            label: "Baga factul curent in subquiz 2!",
            disabled: orchestrator?.getCurrentId?.() !== "base" || !shared.baseState?.currentFactB,
          },
        ];
      },

      runArenaAction(actionId) {
        if (actionId !== "sendCurrentFactToSq2") return null;
        return this.startCurrentFactSq2();
      },

      startCurrentFactSq2() {
        if (orchestrator?.getCurrentId?.() !== "base") return null;
        const factB = shared.baseState?.currentFactB;
        if (!factB) return null;
        const targetId = pickIntensiveTarget();
        const targetCount = targetId === SQ2_SBS_ID ? SQ2_SBS_FACT_COUNT : 1;
        const facts = validLevelFacts([factB, ...selectFactsForSq2([factB], { targetCount })]).slice(
          0,
          targetCount
        );
        const command = startIntensiveWithFacts(facts, "manualArenaButton", { flash: "win" }, targetId);
        if (!command) return null;
        return orchestrator.command(command);
      },

      appendSq2ControlPanel(mount, hooks = {}) {
        if (!mount) return;
        appendJurnalButtons(mount);
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
      },

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

  global.Mul1120V3TrainEffEqFormsQuiz = { create: createQuiz };
})(window);
