(function (global) {
  "use strict";

  // ── Quiz „T*/ 11-20 v2" ────────────────────────────────────────────────────────
  // BUCATA 1 — DOAR mod „test anchors". Fără eff, fără mastery, fără avansare
  // nivel, fără faze 2–3. Reset la reload (fără persistență, fără progres vizual).
  //
  // Nivel L → factor fix A = 10 + L (nivel 1 = 11×, …, nivel 10 = 20×).
  // Anchor: B ∈ {2,3,4,5,15}, în equation forms (× și ÷), cu răspuns numeric.

  const MIN_LEVEL = 1;
  const MAX_LEVEL = 10;
  const ANCHORS = [2, 3, 4, 5, 15];
  const SUBQUIZ_ANCHORS = [1, 2, 3, 4, 5, 10, 15, 20];
  const NONANCHORS = [6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19];
  const START_STAGE_KEY = "yl:mul1120v2:startStage";
  const DEFAULT_START_STAGE = "anchorSumValuesOnly";
  const STAGES = {
    normal: { id: "normal", order: null, title: "Normal" },
    anchors: { id: "anchors", order: 1, title: "anchors" },
    intensiv: { id: "intensiv", order: 2, title: "intensiv" },
    anchorSumValues: { id: "anchorSumValues", order: 3, title: "valori ancore suma" },
  };
  const START_OPTIONS = {
    normal: { id: "normal", stage: "normal" },
    anchorsOnly: { id: "anchorsOnly", stage: "normal" },
    intensivOnly: { id: "intensivOnly", stage: "intensiv" },
    anchorSumValuesOnly: { id: "anchorSumValuesOnly", stage: "anchorSumValues" },
  };
  const HINT = "Alege răspunsul corect.";

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

  function readStartStage() {
    try {
      const stored = global.localStorage?.getItem?.(START_STAGE_KEY);
      if (stored === "anchorSumValues") return "anchorSumValuesOnly";
      if (stored && START_OPTIONS[stored]) return stored;
    } catch (err) {
      // localStorage can be unavailable in tests or privacy modes.
    }
    return DEFAULT_START_STAGE;
  }

  function writeStartStage(stageId) {
    try {
      global.localStorage?.setItem?.(START_STAGE_KEY, stageId);
    } catch (err) {
      // Ignore storage failures; the in-memory selection still applies.
    }
  }

  function formatMs(ms) {
    if (ms == null || !Number.isFinite(ms)) return "—";
    return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  }

  // Distractori cu aceeași ultimă cifră ca răspunsul corect (capcane).
  // Funcționează și pentru produse și pentru câturi.
  function sameLastDigitOptions(correctNum, shuffle) {
    const correct = Number(correctNum);
    const lastDigit = ((correct % 10) + 10) % 10;
    const used = new Set([correct]);
    const candidates = [];

    function tryAdd(v) {
      if (!Number.isFinite(v) || v <= 0) return;
      if (((v % 10) + 10) % 10 !== lastDigit) return;
      if (used.has(v)) return;
      used.add(v);
      candidates.push(v);
    }

    for (let k = 1; k <= 15; k++) {
      tryAdd(correct - 10 * k);
      tryAdd(correct + 10 * k);
    }
    // Pentru câturi mici (ex. 2,3,4) vecinii ±10 pot să nu existe → fallback ±1/±2.
    for (let d = 1; d <= 2; d++) {
      tryAdd(correct - d);
      tryAdd(correct + d);
    }

    candidates.sort((a, b) => Math.abs(a - correct) - Math.abs(b - correct));
    const distract = [];
    for (const v of candidates) {
      distract.push(v);
      if (distract.length >= 2) break;
    }
    while (distract.length < 2) {
      distract.push(correct + 10 * (distract.length + 1));
    }

    const options = shuffle([String(correct), String(distract[0]), String(distract[1])]);
    return { options, correctIndex: options.indexOf(String(correct)) };
  }

  function decomposeNonanchor(b) {
    if (b >= 16) return { big: 15, small: b - 15 };
    if (b >= 11) return { big: 10, small: b - 10 };
    return { big: 5, small: b - 5 };
  }

  function sameTableOptionsForFactor(tableFactor, correctAnchor, shuffle) {
    const used = new Set([correctAnchor]);
    const candidates = [];

    function tryAdd(anchor) {
      if (anchor < 1 || anchor > 20 || used.has(anchor)) return;
      used.add(anchor);
      candidates.push(anchor);
    }

    [1, 2, 3, -1, -2, -3].forEach((delta) => tryAdd(correctAnchor + delta));
    SUBQUIZ_ANCHORS.forEach(tryAdd);

    const picked = candidates.slice(0, 2).map((anchor) => String(tableFactor * anchor));
    while (picked.length < 2) {
      const fallbackAnchor = Math.min(20, correctAnchor + picked.length + 1);
      const value = String(tableFactor * fallbackAnchor);
      if (!picked.includes(value) && value !== String(tableFactor * correctAnchor)) {
        picked.push(value);
      } else {
        picked.push(String(tableFactor * Math.max(1, correctAnchor - picked.length - 1)));
      }
    }

    const correct = String(tableFactor * correctAnchor);
    const options = shuffle([correct, picked[0], picked[1]]);
    return { options, correctIndex: options.indexOf(correct) };
  }

  function createQuiz(config) {
    const quizId = config.quizId;
    const { randomInt, shuffle } = global.GameUtils;
    const QFG = global.QFGenerator;
    const Catalog = global.FactCatalog;

    const qfTypes = QFG.getActiveQFTypes(QF_PROFILE).filter((t) => t.answerType === "number");

    const QUESTIONS_PER_LEVEL = 21;
    const FAST_MS = 1500; // ≤ 1.5s → highlight
    const INTENSIV_QUESTIONS = 10; // întrebări per sesiune intensiv
    const INTENSIV_SESSIONS_PER_LEVEL = 2; // 2 sesiuni intensiv → nivel următor

    let level = MIN_LEVEL;
    let startStageSelection = readStartStage();
    let stage = START_OPTIONS[startStageSelection]?.stage ?? "normal";
    let mode = "anchor";      // "anchor" | "intensiv"
    let wrongFacts = [];      // facts ancoră greșite (distincte) în anchor test
    let factsLucrateIntensiv = []; // facts antrenate în (ultimul) intensiv, pt. panou
    let intensivFacts = [];   // cele 2 facts (B) lucrate în intensivul curent
    let intensivQueue = [];   // 10 B-uri (5+5), amestecate aleator
    let intensivCount = 0;    // câte întrebări intensive au fost rezolvate (0..10)
    let intensivSessionsDone = 0; // sesiuni intensiv încheiate în nivelul curent
    let lastCorrectByB = {};  // { [b]: responseMs } — timpul ultimului răspuns corect / fact
    let answeredCount = 0;    // răspunsuri anchor în nivelul curent (corecte sau greșite, spre 21)
    let anchorQueue = [];     // ancorele rămase în tura curentă (ordine mic → mare cu variație)
    let recentFactorFlags = [];
    let subquizQuestionCount = 0;
    let subquizCorrectStreak = 0;
    let current = null;

    function isDirectTestMode() {
      return startStageSelection !== "normal";
    }

    function isDirectTestModeFor(optionId) {
      return startStageSelection === optionId;
    }

    function stageForStartSelection() {
      return START_OPTIONS[startStageSelection]?.stage ?? "normal";
    }

    // ≤ 1 răspuns == A la fiecare 5 întrebări (plafon 11×).
    function factorCapHit() {
      return recentFactorFlags.slice(-4).filter(Boolean).length >= 1;
    }

    function noteFactorFlag(isFactor) {
      recentFactorFlags.push(Boolean(isFactor));
      if (recentFactorFlags.length > 5) recentFactorFlags.shift();
    }

    function makeFact(b) {
      return Catalog.createFact({
        operation: "mul",
        values: { a: factorForLevel(level), b },
      });
    }

    function factLabel(b) {
      return `${b}×${factorForLevel(level)}=?`;
    }

    // O „tură" trece prin TOATE ancorele exact o dată, în ordine ascendentă cu
    // o mică variație aleatoare (schimbăm uneori două vecine). Garantează că
    // toate {2,3,4,5,15} apar (inclusiv 15) și că nu rămânem blocați pe un B.
    function buildAnchorPass() {
      const order = [...ANCHORS].sort((a, b) => a - b);
      for (let i = 0; i < order.length - 1; i++) {
        if (randomInt(0, 1) === 0) {
          const tmp = order[i];
          order[i] = order[i + 1];
          order[i + 1] = tmp;
        }
      }
      return order;
    }

    function pickAnchorB() {
      if (!anchorQueue.length) anchorQueue = buildAnchorPass();
      return anchorQueue.shift();
    }

    // excludeFactor=true → nu punem niciodată întrebări al căror răspuns e chiar
    // factorul nivelului (ex. 11 la nivel 1 — banal). Folosit la modul intensiv.
    function buildQuestionForB(b, { excludeFactor = false } = {}) {
      const A = factorForLevel(level);
      const fact = makeFact(b);

      for (const t of shuffle(qfTypes)) {
        const r = QFG.renderQF(t, fact);
        if (!r || r.answerType !== "number") continue;
        const val = Number(r.correctAnswer);
        if (!Number.isFinite(val)) continue;
        if (val === A && (excludeFactor || factorCapHit())) continue;

        const opt = sameLastDigitOptions(val, shuffle);
        current = {
          factB: b,
          prompt: r.prompt,
          correct: val,
          options: opt.options,
          correctIndex: opt.correctIndex,
        };
        noteFactorFlag(val === A);
        return;
      }

      // Fallback dur: produsul direct.
      const val = A * b;
      const opt = sameLastDigitOptions(val, shuffle);
      current = {
        factB: b,
        prompt: `${A}*${b}=?`,
        correct: val,
        options: opt.options,
        correctIndex: opt.correctIndex,
      };
      noteFactorFlag(val === A);
    }

    function roundView(extra = {}) {
      return {
        prompt: current?.prompt ?? "—",
        options: current ? [...current.options] : ["—", "—", "—"],
        correctIndex: current?.correctIndex ?? 0,
        hintMessage: HINT,
        ...extra,
      };
    }

    function nextAnchorQuestion() {
      buildQuestionForB(pickAnchorB());
      return roundView();
    }

    // 5+5 pe cele 2 facts, apoi amestecate aleator.
    function buildIntensivQueue() {
      const [b1, b2] = intensivFacts;
      return shuffle([...Array(5).fill(b1), ...Array(5).fill(b2)]);
    }

    // Construiește întrebarea intensivă curentă din coada amestecată.
    function buildIntensivQuestion() {
      const b = intensivQueue[intensivCount];
      buildQuestionForB(b, { excludeFactor: true });
    }

    function startDirectIntensiv() {
      mode = "intensiv";
      intensivFacts = [2, 3];
      factsLucrateIntensiv = intensivFacts.map((b) => factLabel(b));
      wrongFacts = [];
      intensivCount = 0;
      intensivQueue = buildIntensivQueue();
    }

    function resetSubquizState() {
      subquizQuestionCount = 0;
      subquizCorrectStreak = 0;
    }

    function enterStage(nextStage) {
      stage = STAGES[nextStage] ? nextStage : "normal";
      resetSubquizState();
      current = null;
      if (stage === "intensiv") startDirectIntensiv();
      else if (stage === "normal") mode = "anchor";
      else mode = stage;
    }

    function pickNonanchorB() {
      return NONANCHORS[randomInt(0, NONANCHORS.length - 1)];
    }

    function buildAnchorSumQuestion() {
      const A = factorForLevel(level);
      const b = pickNonanchorB();
      const parts = decomposeNonanchor(b);
      const missingBig = randomInt(0, 1) === 0;
      const missingAnchor = missingBig ? parts.big : parts.small;
      const shownAnchor = missingBig ? parts.small : parts.big;
      const prompt = missingBig
        ? `${A}*${b}=?+${A}*${shownAnchor}`
        : `${A}*${b}=${A}*${shownAnchor}+?`;
      const opt = sameTableOptionsForFactor(A, missingAnchor, shuffle);

      current = {
        type: "anchorSumValues",
        factB: b,
        prompt,
        correct: A * missingAnchor,
        options: opt.options,
        correctIndex: opt.correctIndex,
        missingAnchor,
        shownAnchor,
      };
    }

    function nextAnchorSumQuestion() {
      buildAnchorSumQuestion();
      return roundView();
    }

    function resetLevelState() {
      stage = stageForStartSelection();
      mode = "anchor";
      wrongFacts = [];
      factsLucrateIntensiv = [];
      intensivFacts = [];
      intensivQueue = [];
      intensivCount = 0;
      intensivSessionsDone = 0;
      lastCorrectByB = {};
      answeredCount = 0;
      anchorQueue = [];
      recentFactorFlags = [];
      resetSubquizState();
      current = null;
      if (stage === "intensiv") startDirectIntensiv();
      else if (stage !== "normal") mode = stage;
    }

    function nextRoundForStage() {
      if (stage === "anchorSumValues") return nextAnchorSumQuestion();
      if (stage === "intensiv") {
        buildIntensivQuestion();
        return roundView();
      }
      return nextAnchorQuestion();
    }

    function completeNormal(via = "anchor") {
      if (isDirectTestMode()) return advanceLevel(via);
      enterStage("anchorSumValues");
      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        flash: "win",
        banner: `Subquiz 3 · ${STAGES.anchorSumValues.title}`,
        message: `Subquiz 3: ${STAGES.anchorSumValues.title}`,
        nextRound: nextAnchorSumQuestion(),
      };
    }

    function advanceLevel(via = "anchor") {
      const msg =
        via === "anchorSumValues"
          ? "ai terminat subquiz 3, next level"
          : via === "intensiv"
          ? "ai terminat 2 sesiuni intensiv, next level"
          : `ai raspuns la ${QUESTIONS_PER_LEVEL} de intrebari, next level`;
      global.alert?.(msg);
      level = Math.min(MAX_LEVEL, level + 1);
      resetLevelState();
      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        levelAdvanced: true,
        flash: "win",
        banner: `Nivel ${level} · ${factorForLevel(level)}×`,
        message: `Nivel ${level}`,
        nextRound: nextRoundForStage(),
      };
    }

    function onAnchorSumAnswer(isCorrect, chosen) {
      subquizQuestionCount++;
      if (isCorrect) subquizCorrectStreak++;
      else subquizCorrectStreak = 0;

      if (subquizQuestionCount >= 12 || subquizCorrectStreak >= 7) {
        return advanceLevel("anchorSumValues");
      }

      buildAnchorSumQuestion();
      return {
        outcome: isCorrect ? "step-correct" : "wrong-answer",
        correct: isCorrect,
        bounce: isCorrect,
        flash: isCorrect ? undefined : "wrong",
        message: isCorrect ? "Corect!" : `${chosen} nu e bun. Mai încearcă!`,
        ...roundView(),
      };
    }

    function onAnswer(index, meta = {}) {
      const cur = current;
      const chosen = cur.options[index];
      const isCorrect = Number(chosen) === Number(cur.correct);

      if (stage === "anchorSumValues") {
        return onAnchorSumAnswer(isCorrect, chosen);
      }

      // ── MOD INTENSIV ───────────────────────────────────────────────────────
      // Instrument de antrenament (NU mastery): 10 întrebări pe cele 2 facts
      // greșite (5+5, ordine aleatoare). Greșelile sunt IGNORATE — avansăm indiferent de
      // corect/greșit. La final revenim la anchor (sau nivel următor la 2 sesiuni).
      if (mode === "intensiv") {
        intensivCount++;
        if (intensivCount >= INTENSIV_QUESTIONS) {
          if (isDirectTestModeFor("intensivOnly")) return advanceLevel("intensiv");
          intensivSessionsDone++;
          mode = "anchor";
          if (intensivSessionsDone >= INTENSIV_SESSIONS_PER_LEVEL) {
            return completeNormal("intensiv");
          }
          return {
            outcome: "step-correct",
            correct: true,
            bounce: true,
            message: "Înapoi la test anchors.",
            ...nextAnchorQuestion(),
          };
        }
        buildIntensivQuestion();
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Intensiv ${intensivCount + 1}/${INTENSIV_QUESTIONS}`,
          ...roundView(),
        };
      }

      // ── ANCHOR TEST ────────────────────────────────────────────────────────
      answeredCount++;

      if (!isCorrect) {
        if (!wrongFacts.some((w) => w.b === cur.factB)) {
          wrongFacts.push({ b: cur.factB, label: factLabel(cur.factB) });
        }

        if (answeredCount >= QUESTIONS_PER_LEVEL) return completeNormal();

        // 2 facts distincte greșite → rămânem pe aceeași întrebare până la
        // răspuns corect; abia atunci intrăm în modul intensiv.
        return {
          outcome: "wrong-answer",
          correct: false,
          flash: "wrong",
          message: `${chosen} nu e bun. Mai încearcă!`,
          ...roundView(),
        };
      }

      lastCorrectByB[cur.factB] = meta.responseMs ?? null;

      // 2 facts DISTINCTE greșite + răspuns corect pe întrebarea curentă → intensiv.
      if (wrongFacts.length >= 2 && !isDirectTestModeFor("anchorsOnly")) {
        intensivFacts = wrongFacts.map((w) => w.b);
        factsLucrateIntensiv = wrongFacts.map((w) => w.label);
        wrongFacts = [];
        mode = "intensiv";
        intensivCount = 0;
        intensivQueue = buildIntensivQueue();
        buildIntensivQuestion();
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Mod intensiv: antrenament pe ${factsLucrateIntensiv.join(", ")}`,
          ...roundView(),
        };
      }

      if (answeredCount >= QUESTIONS_PER_LEVEL) return completeNormal();

      // Avans IMEDIAT la întrebarea următoare (fără finishRun/delay). Cronometrul
      // e corect: nextAnchorQuestion() face o întrebare nouă, iar renderRound îi
      // vede semnătura schimbată și resetează roundStartedAt.
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: "Corect!",
        ...nextAnchorQuestion(),
      };
    }

    // Bară cade / timeout → IGNORAT complet: reset bară, aceeași întrebare,
    // fără numărare greșeli.
    function onTimeout() {
      return {
        outcome: "round",
        resetFall: true,
        ...roundView(),
      };
    }

    return {
      getQuizId: () => quizId,
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getMinLevel: () => MIN_LEVEL,
      getLevelLabel: () =>
        stage === "anchorSumValues"
          ? `Nivel ${level} · Subquiz 3 · ${STAGES.anchorSumValues.title}`
          : stage === "intensiv"
          ? `Nivel ${level} · Subquiz 2 · ${STAGES.intensiv.title}`
          : `Nivel ${level} · ${factorForLevel(level)}× ancore`,
      getLevelButtonTitle: (lv) => `Nivel ${lv}: ${factorForLevel(lv)}× ancore`,
      isCompleted: () => false,

      getProgressDisplay: () => global.ProgressDisplay.hidden(),

      getInfo11_20() {
        const A = factorForLevel(level);
        return {
          visible: true,
          mode:
            stage === "anchorSumValues"
              ? `Subquiz 3: ${STAGES.anchorSumValues.title}`
              : stage === "intensiv"
              ? `Subquiz 2: ${STAGES.intensiv.title}`
              : mode === "intensiv"
              ? "intensiv"
              : "test anchors",
          wrongFactsText: wrongFacts.length
            ? wrongFacts.map((w) => w.label).join(", ")
            : "—",
          intensivText: factsLucrateIntensiv.length
            ? factsLucrateIntensiv.join(", ")
            : "—",
          answeredText:
            stage === "anchorSumValues"
              ? `${subquizQuestionCount} / 12 · streak ${subquizCorrectStreak} / 7`
              : stage === "intensiv"
              ? `${intensivCount} / ${INTENSIV_QUESTIONS}`
              : `${answeredCount} / ${QUESTIONS_PER_LEVEL}`,
          intensivSessionsText: `${intensivSessionsDone} / ${INTENSIV_SESSIONS_PER_LEVEL}`,
          facts: ANCHORS.map((b) => {
            const ms = b in lastCorrectByB ? lastCorrectByB[b] : null;
            return {
              label: `${b}×${A}`,
              timeText: b in lastCorrectByB ? formatMs(ms) : "-",
              fast: ms != null && ms <= FAST_MS,
            };
          }),
        };
      },

      switchLevel(nextLevel) {
        level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        resetLevelState();
        return null;
      },

      pickNextRound() {
        return nextRoundForStage();
      },

      beginRound(next) {
        return next ?? nextRoundForStage();
      },

      getSubquizStage: () => stage,

      getSubquizStartOption: () => startStageSelection,

      getSubquizStartOptions() {
        return [
          { id: "normal", label: "Normal" },
          { id: "anchorsOnly", label: "1 anchors" },
          { id: "intensivOnly", label: "2 intensiv" },
          {
            id: "anchorSumValuesOnly",
            label: `${STAGES.anchorSumValues.order} ${STAGES.anchorSumValues.title}`,
          },
          { id: "rapidAnchorAdditions", label: "4 adunari rapide cu ancore", disabled: true },
          { id: "effectiveAnchorAddition", label: "5 adunare efectiva ancore", disabled: true },
        ];
      },

      setSubquizStartOption(stageId) {
        if (!START_OPTIONS[stageId]) return false;
        startStageSelection = stageId;
        writeStartStage(stageId);
        resetLevelState();
        return true;
      },

      onAnswer,
      onTimeout,
    };
  }

  global.Mul1120V2Quiz = { create: createQuiz };

  global.QuizRegistry.register({
    id: "multiplication-1120-v2",
    title: "T*/ 11-20 v2",
    description: "Înmulțirea 11–20: BUCATA 1 — doar test ancore.",
    order: 2,
    gestionareGreseli: { activ: false },
    create(meta) {
      return global.Mul1120V2Quiz.create({ quizId: meta.id });
    },
  });
})(window);
