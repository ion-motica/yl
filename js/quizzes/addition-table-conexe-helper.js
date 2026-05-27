(function (global) {
  "use strict";

  const QUIZ_ID = "addition-table-conexe-helper";
  const MIN_LEVEL = 2;
  const MAX_LEVEL = 10;
  const MIN_POOL_SIZE = 3;
  const MAX_QUESTIONS_PER_SERIES = 3;
  const CONEXE_FAST_MS = 2000;
  const PERFORMANT_CONEXE_LIMIT = 3;
  const OPTION_MIN = 1;
  const OPTION_MAX = 12;

  const CONEXE_TYPES = ["missing-left", "missing-right", "bond-left", "bond-right"];

  const CONEXE_LEVEL = {
    PERFORMANT: "performant",
    CORECT_DAR_LENT: "corect_dar_lent",
    SLAB: "slab",
    PRAF: "praf",
    NOU: "nou",
  };

  const CONEXE_RANK = {
    [CONEXE_LEVEL.PERFORMANT]: 5,
    [CONEXE_LEVEL.CORECT_DAR_LENT]: 4,
    [CONEXE_LEVEL.SLAB]: 3,
    [CONEXE_LEVEL.PRAF]: 2,
    [CONEXE_LEVEL.NOU]: 1,
  };

  const FILL_TIERS = [
    CONEXE_LEVEL.CORECT_DAR_LENT,
    CONEXE_LEVEL.SLAB,
    CONEXE_LEVEL.PRAF,
    CONEXE_LEVEL.NOU,
  ];

  function createAdditionTableConexeHelperQuiz() {
    const { shuffle } = global.GameUtils;
    const { FactCatalog, FactStore } = global;

    let level = MIN_LEVEL;
    let gameCompleted = false;

    let levelPool = [];
    let sessionDoneIds = new Set();

    let blockMode = "m1";
    let cleanMacroSteps = 0;
    let currentBlockHadMistake = false;

    let m2UsedFormats = new Set();
    let currentM2Format = null;
    let recoveryFactIds = [];

    let activeQueue = [];
    let wrongQueue = [];
    let phase = "main";

    let currentFact = null;
    let currentConexeType = null;
    let options = [];
    let correctIndex = 0;

    let m1GradeResults = [];
    let m1GradingFactId = null;
    let m1PendingConexeTypes = new Set();
    let m1FactRunOrigin = "m1";
    let m2WrongFactIds = new Set();

    function levelFacts(targetLevel = level) {
      return FactCatalog.listTableFacts({
        operation: "add",
        promptForm: FactCatalog.PROMPT_FORMS.result,
        fixedA: targetLevel,
        minB: 1,
        maxB: 10,
      });
    }

    function storedFact(fact) {
      return FactStore.getFact(fact.factId, fact) ?? fact;
    }

    function conexeLevelOf(fact) {
      return storedFact(fact).performantaLaConexeFact ?? CONEXE_LEVEL.NOU;
    }

    function deCatePerformantOf(fact) {
      return storedFact(fact).deCateOriAavutPerformantLaConexe ?? 0;
    }

    function eligibleLevelFacts() {
      const all = levelFacts();
      const overTrained = all.filter((fact) => deCatePerformantOf(fact) > PERFORMANT_CONEXE_LIMIT);
      if (overTrained.length === all.length) {
        return [...all].sort((left, right) => deCatePerformantOf(left) - deCatePerformantOf(right));
      }
      return all.filter((fact) => deCatePerformantOf(fact) <= PERFORMANT_CONEXE_LIMIT);
    }

    function buildLevelPool() {
      const ranked = eligibleLevelFacts().map((fact) => ({
        fact,
        conexeLevel: conexeLevelOf(fact),
      }));

      const performant = ranked
        .filter((item) => item.conexeLevel === CONEXE_LEVEL.PERFORMANT)
        .map((item) => item.fact);

      if (performant.length >= MIN_POOL_SIZE) {
        return performant;
      }

      const pool = [...performant];
      const used = new Set(pool.map((fact) => fact.factId));

      for (const tier of FILL_TIERS) {
        if (pool.length >= MIN_POOL_SIZE) break;
        for (const item of ranked) {
          if (pool.length >= MIN_POOL_SIZE) break;
          if (item.conexeLevel !== tier) continue;
          if (used.has(item.fact.factId)) continue;
          pool.push(item.fact);
          used.add(item.fact.factId);
        }
      }

      return pool;
    }

    function pickM1Fact() {
      const candidates = levelPool
        .filter((fact) => !sessionDoneIds.has(fact.factId))
        .sort((left, right) => {
          const rankDiff = CONEXE_RANK[conexeLevelOf(right)] - CONEXE_RANK[conexeLevelOf(left)];
          if (rankDiff !== 0) return rankDiff;
          return deCatePerformantOf(left) - deCatePerformantOf(right);
        });

      if (candidates.length) return candidates[0];
      sessionDoneIds = new Set();
      return levelPool
        .slice()
        .sort((left, right) => {
          const rankDiff = CONEXE_RANK[conexeLevelOf(right)] - CONEXE_RANK[conexeLevelOf(left)];
          if (rankDiff !== 0) return rankDiff;
          return deCatePerformantOf(left) - deCatePerformantOf(right);
        })[0];
    }

    function pickM2Format() {
      let remaining = CONEXE_TYPES.filter((type) => !m2UsedFormats.has(type));
      if (!remaining.length) {
        m2UsedFormats = new Set();
        remaining = [...CONEXE_TYPES];
      }
      const chosen = remaining[Math.floor(Math.random() * remaining.length)];
      m2UsedFormats.add(chosen);
      currentM2Format = chosen;
      return chosen;
    }

    function correctAnswerFor(fact, conexeType) {
      const { a, b } = fact.values;
      if (conexeType === "missing-left" || conexeType === "bond-left") return String(a);
      return String(b);
    }

    function promptLabelFor(fact, conexeType) {
      const { a, b, result: c } = fact.values;
      switch (conexeType) {
        case "missing-left":
          return `?+${b}=${c}`;
        case "missing-right":
          return `${a}+?=${c}`;
        case "bond-left":
          return `${c}=?+${b}`;
        case "bond-right":
          return `${c}=${a}+?`;
        default:
          return "—";
      }
    }

    function pickNearWrongAnswers(correct, count) {
      const correctNum = Number(correct);
      const used = new Set([correct]);
      const candidates = [];

      for (let delta = 1; delta <= OPTION_MAX - OPTION_MIN; delta++) {
        for (const value of [correctNum - delta, correctNum + delta]) {
          if (value < OPTION_MIN || value > OPTION_MAX) continue;
          const label = String(value);
          if (used.has(label)) continue;
          candidates.push(label);
          used.add(label);
        }
      }

      const picked = [];
      for (const label of shuffle(candidates)) {
        if (picked.length >= count) break;
        picked.push(label);
      }
      return picked;
    }

    function buildOptionsFor(fact, conexeType) {
      const correctLabel = correctAnswerFor(fact, conexeType);
      const wrong = pickNearWrongAnswers(correctLabel, 2);
      const fallback = (offset) =>
        String(Math.min(OPTION_MAX, Math.max(OPTION_MIN, Number(correctLabel) + offset)));

      options = shuffle([correctLabel, wrong[0] ?? fallback(-1), wrong[1] ?? fallback(1)]);
      correctIndex = options.indexOf(correctLabel);
    }

    function stepItem(factId, conexeType) {
      return { factId, conexeType };
    }

    function factById(factId) {
      return levelPool.find((fact) => fact.factId === factId) ?? null;
    }

    function pushWrongStep(item) {
      const exists = wrongQueue.some(
        (entry) => entry.factId === item.factId && entry.conexeType === item.conexeType
      );
      if (!exists) wrongQueue.push(item);
    }

    function beginM1ForFact(factId) {
      m1GradingFactId = factId;
      m1GradeResults = [];
      m1PendingConexeTypes = new Set(CONEXE_TYPES);
      activeQueue = shuffle([...m1PendingConexeTypes])
        .map((conexeType) => stepItem(factId, conexeType))
        .slice(0, MAX_QUESTIONS_PER_SERIES);
      wrongQueue = [];
      phase = "main";
      return beginCurrentStep();
    }

    function beginM1ResumePending() {
      activeQueue = shuffle([...m1PendingConexeTypes])
        .map((conexeType) => stepItem(m1GradingFactId, conexeType))
        .slice(0, MAX_QUESTIONS_PER_SERIES);
      wrongQueue = [];
      phase = "main";
      return beginCurrentStep();
    }

    function beginM1Block() {
      if (m1GradingFactId && m1PendingConexeTypes.size > 0) {
        blockMode = m1FactRunOrigin;
        return beginM1ResumePending();
      }

      blockMode = "m1";
      m1FactRunOrigin = "m1";
      const fact = pickM1Fact();
      if (!fact) return beginRound();
      return beginM1ForFact(fact.factId);
    }

    function beginM2Block() {
      blockMode = "m2";
      recoveryFactIds = [];
      m2WrongFactIds = new Set();
      const format = pickM2Format();
      const facts = shuffle(levelPool).slice(0, MAX_QUESTIONS_PER_SERIES);
      activeQueue = facts.map((fact) => stepItem(fact.factId, format));
      wrongQueue = [];
      phase = "main";
      return beginCurrentStep();
    }

    function beginRecoveryM1() {
      blockMode = "m1-recovery";
      const factId = recoveryFactIds.shift();
      if (!factId) return finishBlock();
      m1FactRunOrigin = "m1-recovery";
      return beginM1ForFact(factId);
    }

    function beginCurrentStep() {
      const nextItem = activeQueue[0];
      if (!nextItem) {
        if (phase === "main" && wrongQueue.length) {
          phase = "retry";
          activeQueue = [...wrongQueue];
          wrongQueue = [];
          return beginCurrentStep();
        }
        return completeCurrentBlock();
      }

      currentFact = factById(nextItem.factId);
      currentConexeType = nextItem.conexeType;
      if (!currentFact) {
        activeQueue.shift();
        return beginCurrentStep();
      }

      buildOptionsFor(currentFact, currentConexeType);
      return roundView();
    }

    function roundView(extra = {}) {
      const { a, b, result: c } = currentFact.values;
      const base = {
        bondHistory: [],
        options: options.map((value) => String(value)),
        correctIndex,
        divisionHistory: [],
        hintMessage: extra.hintMessage ?? "Alege numărul corect pentru ?.",
        ...extra,
      };

      if (currentConexeType === "bond-left" || currentConexeType === "bond-right") {
        return {
          ...base,
          questionFormat: "singapore-bond",
          targetSum: c,
          bondKnownAddend: currentConexeType === "bond-left" ? b : a,
          bondMissingSide: currentConexeType === "bond-left" ? "left" : "right",
          prompt: promptLabelFor(currentFact, currentConexeType),
        };
      }

      return {
        ...base,
        questionFormat: null,
        prompt: promptLabelFor(currentFact, currentConexeType),
      };
    }

    function recordAttempt(correct, chosenAnswer, meta = {}) {
      FactStore.recordAttempt(
        currentFact.factId,
        {
          at: meta.at,
          correct,
          responseMs: meta.responseMs,
          answer: chosenAnswer,
          timedOut: Boolean(meta.timedOut),
          quizId: QUIZ_ID,
        },
        currentFact
      );
    }

    function computeConexeGrade(results) {
      const correctCount = results.filter((entry) => entry.firstAttemptCorrect).length;
      if (correctCount <= 1) return CONEXE_LEVEL.PRAF;
      if (correctCount <= 3) return CONEXE_LEVEL.SLAB;
      if (
        results.every(
          (entry) =>
            entry.firstAttemptCorrect &&
            Number.isFinite(entry.responseMs) &&
            entry.responseMs < CONEXE_FAST_MS
        )
      ) {
        return CONEXE_LEVEL.PERFORMANT;
      }
      return CONEXE_LEVEL.CORECT_DAR_LENT;
    }

    function maybeGradeM1Fact(factId) {
      const record = FactStore.getFact(factId, factById(factId));
      if (!record) return;
      const today = new Date().toISOString().slice(0, 10);
      if (record.conexeM1GradedDay === today) return;

      const grade = computeConexeGrade(m1GradeResults);
      record.performantaLaConexeFact = grade;
      if (grade === CONEXE_LEVEL.PERFORMANT) {
        record.deCateOriAavutPerformantLaConexe =
          (record.deCateOriAavutPerformantLaConexe ?? 0) + 1;
      }
      record.conexeM1GradedDay = today;
      FactStore.saveFact(record);
    }

    function completeM1ForFact(factId) {
      maybeGradeM1Fact(factId);
      sessionDoneIds.add(factId);
      m1GradingFactId = null;
      m1GradeResults = [];
      m1PendingConexeTypes = new Set();
      m1FactRunOrigin = "m1";

      if (blockMode === "m1-recovery") {
        if (recoveryFactIds.length) return beginRecoveryM1();
        return finishBlock();
      }

      return finishBlock();
    }

    function trackM1Result(correct, meta = {}) {
      if (!m1GradingFactId || currentFact?.factId !== m1GradingFactId) return;
      if (blockMode !== "m1" && blockMode !== "m1-recovery") return;

      const existing = m1GradeResults.find((entry) => entry.conexeType === currentConexeType);
      if (existing) {
        if (correct) {
          existing.responseMs = meta.responseMs ?? existing.responseMs;
        }
        return;
      }

      m1GradeResults.push({
        conexeType: currentConexeType,
        firstAttemptCorrect: correct,
        responseMs: meta.responseMs ?? null,
      });
    }

    function completeCurrentBlock() {
      if (blockMode === "m2") {
        if (m2WrongFactIds.size) {
          recoveryFactIds = [...m2WrongFactIds];
          m2WrongFactIds = new Set();
          return beginRecoveryM1();
        }
        return finishBlock();
      }

      if ((blockMode === "m1" || blockMode === "m1-recovery") && m1GradingFactId) {
        if (m1PendingConexeTypes.size === 0) {
          return completeM1ForFact(m1GradingFactId);
        }
        return finishBlock();
      }

      return finishBlock();
    }

    function finishBlock() {
      if (!currentBlockHadMistake) {
        cleanMacroSteps += 1;
        if (cleanMacroSteps >= 4) {
          return advanceLevel();
        }
      } else {
        cleanMacroSteps = 0;
      }

      currentBlockHadMistake = false;
      if (blockMode === "m1" || blockMode === "m1-recovery") {
        blockMode = "m2";
        return beginM2Block();
      }
      blockMode = "m1";
      return beginM1Block();
    }

    function advanceLevel() {
      if (level >= MAX_LEVEL) {
        gameCompleted = true;
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          gameComplete: true,
          flash: "win",
          banner: "Felicitări! Ai terminat nivelul 10!",
          message: "Felicitări! Ai terminat nivelul 10!",
          ...roundView({ hintMessage: "" }),
        };
      }

      level += 1;
      resetSessionForLevel();
      cleanMacroSteps = 0;
      currentBlockHadMistake = false;
      blockMode = "m1";

      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        levelAdvanced: true,
        flash: "win",
        banner: "Felicitări! Next level!",
        message: `Felicitări! Nivel ${level}`,
        nextRound: beginM1Block(),
      };
    }

    function resetSessionForLevel() {
      levelPool = buildLevelPool();
      sessionDoneIds = new Set();
      m2UsedFormats = new Set();
      recoveryFactIds = [];
      activeQueue = [];
      wrongQueue = [];
      phase = "main";
      m1GradeResults = [];
      m1GradingFactId = null;
      m1PendingConexeTypes = new Set();
      m1FactRunOrigin = "m1";
      m2WrongFactIds = new Set();
    }

    function resetAllState() {
      levelPool = buildLevelPool();
      sessionDoneIds = new Set();
      blockMode = "m1";
      cleanMacroSteps = 0;
      currentBlockHadMistake = false;
      m2UsedFormats = new Set();
      currentM2Format = null;
      recoveryFactIds = [];
      activeQueue = [];
      wrongQueue = [];
      phase = "main";
      currentFact = null;
      currentConexeType = null;
      options = [];
      correctIndex = 0;
      m1GradeResults = [];
      m1GradingFactId = null;
      m1PendingConexeTypes = new Set();
      m1FactRunOrigin = "m1";
      m2WrongFactIds = new Set();
    }

    function onStepCorrect(meta) {
      trackM1Result(true, meta);

      const label = promptLabelFor(currentFact, currentConexeType);
      activeQueue.shift();
      if (blockMode === "m1" || blockMode === "m1-recovery") {
        m1PendingConexeTypes.delete(currentConexeType);
      }

      if (activeQueue.length) {
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Corect! ${label}`,
          ...beginCurrentStep(),
        };
      }

      if (phase === "main" && wrongQueue.length) {
        phase = "retry";
        activeQueue = [...wrongQueue];
        wrongQueue = [];
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Corect! ${label}`,
          ...beginCurrentStep(),
        };
      }

      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: `Corect! ${label}`,
        ...completeCurrentBlock(),
      };
    }

    function onStepWrong(chosen, meta) {
      currentBlockHadMistake = true;
      trackM1Result(false, meta);

      pushWrongStep(stepItem(currentFact.factId, currentConexeType));

      if (blockMode === "m2") {
        m2WrongFactIds.add(currentFact.factId);
      }

      return {
        outcome: "wrong-answer",
        correct: false,
        flash: "wrong",
        message: `La ${promptLabelFor(currentFact, currentConexeType)}, ${chosen ?? "?"} nu e corect. Încearcă din nou!`,
        ...roundView(),
      };
    }

    return {
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getMinLevel: () => MIN_LEVEL,
      getLevelLabel: () => `Nivel ${level} · ${level}+1..10`,
      getLevelButtonTitle: (targetLevel) => `Nivel ${targetLevel}: ${targetLevel}+1..10`,

      getProgressDisplay: () => ProgressDisplay.hidden(),

      isCompleted: () => gameCompleted,
      setCompleted: (value) => {
        gameCompleted = value;
      },

      resetLevelState() {
        resetAllState();
      },

      switchLevel(nextLevel) {
        let message = null;
        if (nextLevel < MIN_LEVEL) {
          level = MIN_LEVEL;
          message = "Prea ușor. trecem la nivelul 2";
        } else {
          level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        }
        gameCompleted = false;
        resetAllState();
        return message;
      },

      beginRound() {
        resetSessionForLevel();
        blockMode = "m1";
        cleanMacroSteps = 0;
        currentBlockHadMistake = false;
        return beginM1Block();
      },

      onTimeout(meta = {}) {
        recordAttempt(false, null, { ...meta, timedOut: true });
        return {
          ...onStepWrong(null, meta),
          outcome: "timeout",
          flash: "wrong",
          message: "Prea târziu! Alege numărul corect pentru ?.",
          resetFall: true,
          ...roundView({ hintMessage: "" }),
        };
      },

      onAnswer(index, meta = {}) {
        const chosen = options[index];
        const correctLabel = correctAnswerFor(currentFact, currentConexeType);
        const isCorrect = chosen === correctLabel;

        recordAttempt(isCorrect, chosen, meta);

        if (!isCorrect) return onStepWrong(chosen, meta);
        return onStepCorrect(meta);
      },

      pickNextRound() {
        resetSessionForLevel();
        blockMode = "m1";
        cleanMacroSteps = 0;
        currentBlockHadMistake = false;
        return beginM1Block();
      },
    };
  }

  global.QuizRegistry.register({
    id: "addition-table-conexe-helper",
    title: "Tabla adunarii - intrebari ajutatoare 3+?=5",
    description:
      "Conexe pentru tabla adunarii (?+b, a+?, c=?+b, c=a+?). Alternanță M1/M2, nivel 2–10.",
    order: -6,
    gestionareGreseli: { activ: false },
    create: createAdditionTableConexeHelperQuiz,
  });
})(window);
