(function (global) {
  "use strict";

  const {
    CONEXE_LEVEL,
    CONEXE_RANK,
    EXPANDED_POOL_TIERS,
    CONEXE_PICK_ORDER,
    DEFAULTS,
  } = global.ConexeTableQuizConstants;

  function createConexeTableQuiz(config) {
    const adapter = config.adapter;
    const quizId = config.quizId;
    const MIN_LEVEL = config.minLevel ?? DEFAULTS.MIN_LEVEL;
    const MAX_LEVEL = config.maxLevel ?? DEFAULTS.MAX_LEVEL;
    const MIN_POOL_SIZE = config.minPoolSize ?? DEFAULTS.MIN_POOL_SIZE;
    const MAX_QUESTIONS_PER_SERIES =
      config.maxQuestionsPerSeries ?? DEFAULTS.MAX_QUESTIONS_PER_SERIES;
    const CONEXE_FAST_MS = config.conexeFastMs ?? DEFAULTS.CONEXE_FAST_MS;
    const PERFORMANT_CONEXE_LIMIT =
      config.performantConexeLimit ?? DEFAULTS.PERFORMANT_CONEXE_LIMIT;
    const CONEXE_TYPES = adapter.conexeTypes;
    const LEVEL_TOO_LOW_MESSAGE =
      config.levelTooLowMessage ?? DEFAULTS.LEVEL_TOO_LOW_MESSAGE;
    const HINT_MESSAGE = config.hintMessage ?? DEFAULTS.HINT_MESSAGE;
    const TIMEOUT_MESSAGE = config.timeoutMessage ?? DEFAULTS.TIMEOUT_MESSAGE;
    const GAME_COMPLETE_BANNER =
      config.gameCompleteBanner ?? DEFAULTS.GAME_COMPLETE_BANNER;
    const LEVEL_ADVANCED_BANNER =
      config.levelAdvancedBanner ?? DEFAULTS.LEVEL_ADVANCED_BANNER;

    const { shuffle } = global.GameUtils;
    const { FactStore } = global;

    let level = MIN_LEVEL;
    let gameCompleted = false;

    let levelPool = [];
    let expandedFactPool = false;
    let sessionDoneIds = new Set();

    let blockMode = "m1";
    let cleanMacroSteps = 0;
    let currentBlockHadMistake = false;

    let m2UsedFormats = new Set();
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
    let orchestrator = null;

    // Faza E, sectiunea 12: orice quiz trebuie construit intern prin
    // SubquizOrchestrator (vezi equations-e3-e6.js pt. explicatia completa a
    // tiparului). `buildOptionsFor` e singurul loc care schimba
    // `options`/`correctIndex` (chemat mereu dupa ce `currentFact`/
    // `currentConexeType` sunt deja actualizate) — sincronizeaza neconditionat,
    // chiar acolo, la final.
    function sincronizeazaOrchestratorul() {
      const view = roundView();
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: view.prompt,
        options: [...options],
        correctIndex,
      });
    }

    function withResetFall(view) {
      return view && typeof view === "object" ? { resetFall: true, ...view } : view;
    }

    function levelFacts(targetLevel = level) {
      return adapter.listLevelFacts(targetLevel);
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
        expandedFactPool = false;
        return performant;
      }

      expandedFactPool = true;
      const pool = [...performant];
      const used = new Set(pool.map((fact) => fact.factId));

      for (const tier of EXPANDED_POOL_TIERS) {
        for (const item of ranked) {
          if (item.conexeLevel !== tier) continue;
          if (used.has(item.fact.factId)) continue;
          pool.push(item.fact);
          used.add(item.fact.factId);
        }
      }

      return pool;
    }

    function pickFactByConexePriority(candidates) {
      for (const tier of CONEXE_PICK_ORDER) {
        const tierFacts = candidates.filter((fact) => conexeLevelOf(fact) === tier);
        if (tierFacts.length) return shuffle(tierFacts)[0];
      }
      return shuffle(candidates)[0];
    }

    function sortFactsByConexePriority(facts) {
      return facts.slice().sort((left, right) => {
        const rankDiff = CONEXE_RANK[conexeLevelOf(right)] - CONEXE_RANK[conexeLevelOf(left)];
        if (rankDiff !== 0) return rankDiff;
        return deCatePerformantOf(left) - deCatePerformantOf(right);
      });
    }

    function pickM1Fact() {
      let candidates = levelPool.filter((fact) => !sessionDoneIds.has(fact.factId));
      if (!candidates.length) {
        sessionDoneIds = new Set();
        candidates = [...levelPool];
      }
      if (!candidates.length) return null;

      if (expandedFactPool) return pickFactByConexePriority(candidates);
      return sortFactsByConexePriority(candidates)[0];
    }

    function pickM2Format() {
      let remaining = CONEXE_TYPES.filter((type) => !m2UsedFormats.has(type));
      if (!remaining.length) {
        m2UsedFormats = new Set();
        remaining = [...CONEXE_TYPES];
      }
      const chosen = remaining[Math.floor(Math.random() * remaining.length)];
      m2UsedFormats.add(chosen);
      return chosen;
    }

    function buildOptionsFor(fact, conexeType) {
      const built = adapter.buildOptions(fact, conexeType, shuffle);
      options = built.options;
      correctIndex = built.correctIndex;
      sincronizeazaOrchestratorul();
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
          return withResetFall(beginCurrentStep());
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
      return adapter.buildRoundView({
        fact: currentFact,
        conexeType: currentConexeType,
        options,
        correctIndex,
        hintMessage: extra.hintMessage ?? HINT_MESSAGE,
        extra,
      });
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
          quizId,
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
          return withResetFall(beginRecoveryM1());
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
        return withResetFall(beginM2Block());
      }
      blockMode = "m1";
      return withResetFall(beginM1Block());
    }

    function advanceLevel() {
      if (level >= MAX_LEVEL) {
        gameCompleted = true;
        return {
          outcome: "serie-terminata",
          correct: true,
          serie_terminata: true,
          gameComplete: true,
          flash: "win",
          banner: GAME_COMPLETE_BANNER,
          message: GAME_COMPLETE_BANNER,
          ...roundView({ hintMessage: "" }),
        };
      }

      level += 1;
      resetSessionForLevel();
      cleanMacroSteps = 0;
      currentBlockHadMistake = false;
      blockMode = "m1";

      return {
        outcome: "serie-terminata",
        correct: true,
        serie_terminata: true,
        levelAdvanced: true,
        flash: "win",
        banner: LEVEL_ADVANCED_BANNER,
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

      const label = adapter.promptLabel(currentFact, currentConexeType);
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
        message: `La ${adapter.promptLabel(currentFact, currentConexeType)}, ${chosen ?? "?"} nu e corect. Încearcă din nou!`,
        ...roundView(),
      };
    }

    // Motor 3 butoane (M3B) — vezi documente de referinta/PLAN-motor-comun-raspuns.md.
    // Migrare pura: regula corect/gresit era deja conforma (gresit nu atinge
    // `currentFact`/`options`, ramane pe acelasi pas — `onStepWrong` doar
    // inregistreaza). `dupa_turn_apasare` preia efectele secundare ale lui
    // `onStepWrong` (fara sa mai construiasca ea insasi rezultatul — asta face
    // M3B, prin `mesaje.gresit`); `onStepWrong` ramane neatinsa, tot folosita
    // de `onTimeout`. `dupaRaspunsCorect` cheama direct `onStepCorrect`
    // existenta, care deja produce fie un pas intermediar (step-correct), fie
    // un rezultat complet de bloc/nivel (run-complete, prin `completeCurrentBlock`
    // -> `finishBlock` -> `advanceLevel`).
    //
    // Faza E, sectiunea 12: invelit intr-un SubquizOrchestrator (o singura
    // bucata "baza"). `roundView()` delega la `adapter.buildRoundView` — patru
    // adaptoare (adunare/scadere/inmultire/impartire), fiecare cu campuri
    // proprii, unele conditionate de `conexeType` (`questionFormat`/`targetSum`/
    // `bondKnownAddend`/`bondMissingSide` doar pt. tipurile "bond-*"). Prea
    // variabil ca sa injectezi campuri punctuale (ca `successionHistory` la
    // equations-e3-e6.js) — in loc, `dupa_turn_apasare` intoarce `roundView()`
    // INTREG, exact ca vechiul `onStepWrong` (`...roundView()`), valabil
    // pt. orice adaptor. Pe ramura corecta e oricum suprascris de rezultatul
    // complet din `onStepCorrect`, fara conflict.
    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "base",
        title: "baza",
        hintMessage: HINT_MESSAGE,
        esteCorect: (_item, index) => options[index] === adapter.correctAnswer(currentFact, currentConexeType),
        generator: () => ({}),
        mesaje: {
          gresit: (ctx) =>
            `La ${adapter.promptLabel(currentFact, currentConexeType)}, ${ctx.alesul ?? "?"} nu e corect. Încearcă din nou!`,
        },
        actiuni: {
          dupa_turn_apasare: (ctx) => {
            recordAttempt(ctx.corect, ctx.alesul, ctx.meta);
            if (!ctx.corect) {
              currentBlockHadMistake = true;
              trackM1Result(false, ctx.meta);
              pushWrongStep(stepItem(currentFact.factId, currentConexeType));
              if (blockMode === "m2") {
                m2WrongFactIds.add(currentFact.factId);
              }
            }
            return roundView();
          },
          dupaRaspunsCorect: (ctx) => {
            return { action: "continue", view: onStepCorrect(ctx.meta) };
          },
        },
      });
    }

    orchestrator = global.SubquizOrchestrator.create({
      definitions: [baseDefinition()],
      activeSubquizIds: ["base"],
      context: {},
    });
    orchestrator.startFirst();

    return {
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getMinLevel: () => MIN_LEVEL,
      getLevelLabel: () => adapter.getLevelLabel(level),
      getLevelButtonTitle: (targetLevel) => adapter.getLevelButtonTitle(targetLevel),

      getProgressDisplay: () => global.ProgressDisplay.hidden(),

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
          message = LEVEL_TOO_LOW_MESSAGE;
        } else {
          level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        }
        gameCompleted = false;
        resetAllState();
        return message;
      },

      placeholderRaspuns: global.PlaceholderRaspuns.creeaza("?"),
      laSchimbareDeNivel: global.SchimbareDeNivel.standard(),
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
          message: TIMEOUT_MESSAGE,
          resetFall: true,
          ...roundView({ hintMessage: "" }),
        };
      },

      // Migrat la Motor3Butoane (Faza D, lotul 3), invelit in SubquizOrchestrator
      // (Faza E, sectiunea 12) — vezi `baseDefinition`, mai sus.
      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },

      getFallSpeedFactor() {
        if (!currentFact || !adapter.getDifficultyPair) return 1.0;
        const [n1, n2] = adapter.getDifficultyPair(currentFact);
        return global.SpeedFactors?.factDifficultyFactor(n1, n2) ?? 1.0;
      },

      shouldBounceToTop() {
        if (!currentFact || !adapter.getDifficultyPair) return false;
        const [n1, n2] = adapter.getDifficultyPair(currentFact);
        return (global.SpeedFactors?.factDifficultyFactor(n1, n2) ?? 1.0) < 1.0;
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

  global.ConexeTableQuiz = {
    create: createConexeTableQuiz,
  };
})(window);
