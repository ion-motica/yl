(function (global) {
  "use strict";

  const QUIZ_ID = "addition-table-singapore";
  const MIN_LEVEL = 3;
  const MAX_LEVEL = 10;
  const MAX_PERFORMANT = 5;
  const MIN_POOL_SIZE = 2;
  const FAST_RESPONSE_MS = 2000;

  const FILL_TIERS = [
    global.FactStats.KNOWLEDGE_LEVEL.CORECT_DAR_LENT,
    global.FactStats.KNOWLEDGE_LEVEL.SLAB,
    global.FactStats.KNOWLEDGE_LEVEL.PRAF,
    global.FactStats.KNOWLEDGE_LEVEL.NOU,
  ];

  const FACT_STATS_CONFIG = {
    getFastResponseMs: () => FAST_RESPONSE_MS,
  };

  function createAdditionTableSingaporeQuiz() {
    const { randomInt, shuffle } = global.GameUtils;
    const { FactCatalog, FactStore, FactStats } = global;
    const { KNOWLEDGE_LEVEL } = FactStats;

    let level = MIN_LEVEL;
    let gameCompleted = false;

    let knownPool = [];
    let activeQueue = [];
    let wrongFactIds = [];
    let phase = "main";
    let historyLines = [];
    let hadMistakeThisTurn = false;

    let currentFact = null;
    let options = [];
    let correctIndex = 0;

    function decompositionLabel(fact) {
      const { a, b } = fact.values;
      return `${a}+${b}`;
    }

    function factsForSum(targetSum) {
      const facts = [];
      for (let a = 1; a < targetSum; a++) {
        const b = targetSum - a;
        if (b < 1) continue;
        facts.push(
          FactCatalog.createFact({
            operation: "add",
            promptForm: FactCatalog.PROMPT_FORMS.result,
            values: { a, b },
          })
        );
      }
      return facts;
    }

    function knowledgeLevelOf(fact) {
      const stored = FactStore.getFact(fact.factId, fact) ?? fact;
      return FactStats.getKnowledgeLevel(stored, FACT_STATS_CONFIG);
    }

    function selectPoolForLevel(targetSum = level) {
      const ranked = factsForSum(targetSum).map((fact) => ({
        fact,
        knowledgeLevel: knowledgeLevelOf(fact),
      }));

      const performant = ranked
        .filter((item) => item.knowledgeLevel === KNOWLEDGE_LEVEL.PERFORMANT)
        .map((item) => item.fact)
        .slice(0, MAX_PERFORMANT);

      if (performant.length >= MIN_POOL_SIZE) {
        return performant;
      }

      const pool = [...performant];
      const used = new Set(pool.map((fact) => fact.factId));

      for (const tier of FILL_TIERS) {
        if (pool.length >= MIN_POOL_SIZE) break;
        for (const item of ranked) {
          if (pool.length >= MIN_POOL_SIZE) break;
          if (item.knowledgeLevel !== tier) continue;
          if (used.has(item.fact.factId)) continue;
          pool.push(item.fact);
          used.add(item.fact.factId);
        }
      }

      return pool;
    }

    function pickWrongDecompositions(targetSum, correctFact, count, exclude = []) {
      const { a: ca, b: cb } = correctFact.values;
      const correctLabel = decompositionLabel(correctFact);
      const used = new Set([correctLabel, ...exclude.filter(Boolean)]);
      const candidates = [];

      function tryAdd(x, y) {
        if (x < 1 || y < 1) return;
        const label = `${x}+${y}`;
        if (label === correctLabel || used.has(label) || candidates.includes(label)) return;
        if (x + y !== targetSum) {
          candidates.push(label);
          used.add(label);
        }
      }

      for (let da = -3; da <= 3; da++) {
        for (let db = -3; db <= 3; db++) {
          if (da === 0 && db === 0) continue;
          tryAdd(ca + da, cb + db);
        }
      }

      for (const fact of knownPool) {
        if (fact.factId === correctFact.factId) continue;
        used.add(decompositionLabel(fact));
      }

      if (candidates.length < count) {
        for (let offset = 1; offset <= targetSum + 4 && candidates.length < count * 4; offset++) {
          tryAdd(ca + offset, cb);
          tryAdd(ca, cb + offset);
          tryAdd(ca - offset, cb);
          tryAdd(ca, cb - offset);
          tryAdd(ca + offset, cb + offset);
          tryAdd(ca - offset, cb - offset);
        }
      }

      const picked = [];
      for (const label of shuffle(candidates)) {
        if (picked.length >= count) break;
        picked.push(label);
      }
      return picked.slice(0, count);
    }

    function buildOptionsForFact(fact) {
      const correctLabel = decompositionLabel(fact);
      const wrong = pickWrongDecompositions(level, fact, 2);
      const triple = shuffle([correctLabel, wrong[0] ?? `${fact.values.a}+${fact.values.b + 1}`, wrong[1] ?? `${fact.values.a + 1}+${fact.values.b}`]);
      options = triple;
      correctIndex = options.indexOf(correctLabel);
    }

    function factById(factId) {
      return knownPool.find((fact) => fact.factId === factId) ?? null;
    }

    function addKnownVariants(needed) {
      let added = 0;
      const used = new Set(activeQueue);
      const tierOrder = [
        KNOWLEDGE_LEVEL.PERFORMANT,
        KNOWLEDGE_LEVEL.CORECT_DAR_LENT,
        KNOWLEDGE_LEVEL.SLAB,
        KNOWLEDGE_LEVEL.PRAF,
        KNOWLEDGE_LEVEL.NOU,
      ];

      for (const tier of tierOrder) {
        if (added >= needed) break;
        for (const fact of knownPool) {
          if (added >= needed) break;
          if (used.has(fact.factId)) continue;
          if (knowledgeLevelOf(fact) !== tier) continue;
          activeQueue.push(fact.factId);
          used.add(fact.factId);
          added++;
        }
      }
    }

    function startTurn() {
      knownPool = selectPoolForLevel(level);
      activeQueue = shuffle(knownPool.map((fact) => fact.factId));
      wrongFactIds = [];
      phase = "main";
      historyLines = [];
      hadMistakeThisTurn = false;
      return beginCurrentStep();
    }

    function beginRetryPhase() {
      phase = "retry";
      historyLines = [];
      activeQueue = [...wrongFactIds];
      wrongFactIds = [];

      if (activeQueue.length < MIN_POOL_SIZE) {
        addKnownVariants(MIN_POOL_SIZE - activeQueue.length);
      }

      activeQueue = shuffle(activeQueue);
      return beginCurrentStep();
    }

    function beginCurrentStep() {
      const nextId = activeQueue[0];
      if (!nextId) {
        return buildTurnCompleteStep(decompositionLabel(currentFact) || `${level}=?`);
      }

      currentFact = factById(nextId);
      if (!currentFact) {
        activeQueue.shift();
        return beginCurrentStep();
      }

      buildOptionsForFact(currentFact);
      return roundView();
    }

    function roundView(extra = {}) {
      return {
        questionFormat: "singapore-bond",
        targetSum: level,
        bondHistory: [...historyLines],
        prompt: `${level}=`,
        options: formatOptionsForView(),
        correctIndex,
        divisionHistory: [],
        hintMessage: extra.hintMessage ?? "Alege descompunerea corectă.",
        ...extra,
      };
    }

    function formatOptionsForView(source = options) {
      return source.map((value) => (value == null ? "—" : String(value)));
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

    function buildTurnCompleteStep(label) {
      const finishedLevel = level;
      const holdView = roundView({ hintMessage: "" });

      if (!hadMistakeThisTurn) {
        if (finishedLevel >= MAX_LEVEL) {
          gameCompleted = true;
          return {
            outcome: "step-correct",
            correct: true,
            bounce: true,
            promptHoldMs: 400,
            message: `Corect! ${finishedLevel}=${label}`,
            ...holdView,
            continueStep: {
              outcome: "run-complete",
              correct: true,
              runComplete: true,
              gameComplete: true,
              flash: "win",
              banner: "Felicitări! Ai terminat nivelul 10!",
              message: "Felicitări! Ai terminat nivelul 10!",
            },
          };
        }

        level++;
        const nextView = startTurn();
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          promptHoldMs: 400,
          message: `Corect! ${finishedLevel}=${label}`,
          ...holdView,
          continueStep: {
            outcome: "run-complete",
            correct: true,
            runComplete: true,
            levelAdvanced: true,
            flash: "win",
            banner: "Felicitări! Next level!",
            message: `Felicitări! Nivel ${level}`,
            nextRound: nextView,
          },
        };
      }

      const retryView = beginRetryPhase();
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        promptHoldMs: 400,
        message: `Corect! ${level}=${label}`,
        ...holdView,
        continueStep: {
          ...retryView,
          resetFall: true,
        },
      };
    }

    function onStepCorrect() {
      const label = decompositionLabel(currentFact);
      historyLines.push(`${level}=${label}`);
      activeQueue.shift();

      if (activeQueue.length) {
        const nextView = beginCurrentStep();
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Corect! ${level}=${label}`,
          ...nextView,
        };
      }

      if (phase === "retry") {
        hadMistakeThisTurn = false;
      }

      return buildTurnCompleteStep(label);
    }

    return {
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getMinLevel: () => MIN_LEVEL,
      getLevelLabel: () => `Nivel ${level} · numărul ${level}`,
      getLevelButtonTitle: (targetLevel) => `Nivel ${targetLevel}: numărul ${targetLevel}`,

      getProgressDisplay: () => ProgressDisplay.hidden(),

      isCompleted: () => gameCompleted,
      setCompleted: (value) => {
        gameCompleted = value;
      },

      resetLevelState() {
        knownPool = [];
        activeQueue = [];
        wrongFactIds = [];
        phase = "main";
        historyLines = [];
        hadMistakeThisTurn = false;
        currentFact = null;
        options = [];
        correctIndex = 0;
      },

      switchLevel(nextLevel) {
        let message = null;
        if (nextLevel < MIN_LEVEL) {
          level = MIN_LEVEL;
          message = "Prea ușor! trecem direct la nivelul 3!";
        } else {
          level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        }
        gameCompleted = false;
        this.resetLevelState();
        return message;
      },

      beginRound() {
        return startTurn();
      },

      onTimeout(meta = {}) {
        recordAttempt(false, null, { ...meta, timedOut: true });
        hadMistakeThisTurn = true;
        if (!wrongFactIds.includes(currentFact.factId)) {
          wrongFactIds.push(currentFact.factId);
        }
        return {
          outcome: "timeout",
          flash: "wrong",
          message: "Prea târziu! Alege descompunerea corectă.",
          resetFall: true,
          ...roundView({ hintMessage: "" }),
        };
      },

      onAnswer(index, meta = {}) {
        const chosen = options[index];
        const correctLabel = decompositionLabel(currentFact);
        const isCorrect = chosen === correctLabel;

        recordAttempt(isCorrect, chosen, meta);

        if (!isCorrect) {
          hadMistakeThisTurn = true;
          if (!wrongFactIds.includes(currentFact.factId)) {
            wrongFactIds.push(currentFact.factId);
          }
          return {
            outcome: "wrong-answer",
            correct: false,
            flash: "wrong",
            message: `La ${level}=?, ${chosen} nu e corect. Încearcă din nou!`,
            ...roundView(),
          };
        }

        return onStepCorrect();
      },

      pickNextRound: () => startTurn(),
    };
  }

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: "Tabla adunarii Singapore 6=3+3|3+4 - QUIZ NEFUNCTIONAL - IN REFACTORING",
    description:
      "Descompuneri pentru același număr (ex. 3=), cu reluare după greșeli. Nivel 3–10.",
    order: -8,
    gestionareGreseli: { activ: false },
    create: createAdditionTableSingaporeQuiz,
  });
})(window);
