(function (global) {
  "use strict";

  const MAX_LEVEL = 10;
  const REPLAY_CHANCE = 0.65;
  const RUN_DELAY_MS = 500;

  function createAdditionTableQuiz(config = {}) {
    const { randomInt, shuffle } = global.GameUtils;
    const { FactCatalog, FactStore, FactStats } = global;

    let level = 1;
    let currentFact = null;
    let options = [];
    let correctIndex = 0;
    let activeComboTrap = null;
    let lastFactId = null;
    let gameCompleted = false;

    const mistakes = global.QuizMistakes.create(config, {
      comboTitle: (combo) => {
        const wrongLabel = combo.wrong === null ? "timp" : combo.wrong;
        return `${combo.values.a}+${combo.values.b} · ${wrongLabel} — ${combo.resolved}/${mistakes.comboNeeded}`;
      },
    });

    function levelFacts(targetLevel = level) {
      return FactCatalog.listTableFacts({
        operation: "add",
        promptForm: FactCatalog.PROMPT_FORMS.result,
        fixedA: targetLevel,
        minB: 1,
        maxB: 10,
      });
    }

    function progressOpts() {
      return { comboRelevant: (combo) => combo.level === level };
    }

    function formatOptionsForView(source = options) {
      return source.map((value) => (value == null ? "—" : String(value)));
    }

    function roundView(extra = {}) {
      return {
        prompt: currentFact?.prompt ?? "—",
        options: formatOptionsForView(),
        correctIndex,
        divisionHistory: [],
        hintMessage: extra.hintMessage ?? "Alege suma corectă.",
        ...extra,
      };
    }

    function getLevelLabel(targetLevel = level) {
      return `Nivel ${targetLevel} · ${targetLevel}+1..10`;
    }

    function getLevelButtonTitle(targetLevel) {
      return `Nivel ${targetLevel}: exerciții ${targetLevel}+1..10`;
    }

    function buildMistakePayload(fact, wrong) {
      return {
        factId: fact.factId,
        familyKey: fact.familyKey,
        operation: fact.operation,
        promptForm: fact.promptForm,
        questionId: fact.factId,
        questionLabel: fact.prompt,
        number: fact.values.result,
        level: fact.values.a,
        values: { ...fact.values },
        correct: fact.correctAnswer,
        wrong,
      };
    }

    function factFromCombo(combo) {
      return FactCatalog.createFact({
        factId: combo.factId,
        familyKey: combo.familyKey,
        operation: combo.operation,
        promptForm: combo.promptForm,
        values: combo.values,
      });
    }

    function pickWrongAnswers(correctAnswer, count, exclude = []) {
      const used = new Set([correctAnswer, ...exclude.filter((value) => value != null)]);
      const candidates = [];

      for (let offset = 1; offset <= 18; offset++) {
        const lower = correctAnswer - offset;
        const upper = correctAnswer + offset;
        if (lower >= 2 && !used.has(lower) && !candidates.includes(lower)) candidates.push(lower);
        if (upper <= 20 && !used.has(upper) && !candidates.includes(upper)) candidates.push(upper);
      }

      const picked = [];
      for (const value of shuffle(candidates)) {
        if (picked.length >= count) break;
        if (!used.has(value)) {
          picked.push(value);
          used.add(value);
        }
      }

      for (let value = 2; value <= 20 && picked.length < count; value++) {
        if (!used.has(value)) {
          picked.push(value);
          used.add(value);
        }
      }

      return picked.slice(0, count);
    }

    function applyOptionsTriple(correctAnswer, wrongList = []) {
      const wrong = pickWrongAnswers(correctAnswer, 2, wrongList);
      const triple = shuffle([correctAnswer, wrong[0], wrong[1]]);
      options = triple.map((value) => Number(value));
      correctIndex = options.indexOf(correctAnswer);
    }

    function buildOptionsForFact(fact, combo) {
      activeComboTrap = combo ?? null;
      const correctAnswer = fact.correctAnswer;

      if (combo && combo.wrong !== null && combo.wrong !== correctAnswer) {
        const extraWrong = pickWrongAnswers(correctAnswer, 1, [combo.wrong]);
        const triple = shuffle([correctAnswer, combo.wrong, extraWrong[0]]);
        options = triple.map((value) => Number(value));
        correctIndex = options.indexOf(correctAnswer);
        return;
      }

      applyOptionsTriple(correctAnswer);
    }

    function pickReplayCombo() {
      const pending = mistakes
        .pendingCombos(undefined, progressOpts())
        .filter((combo) => combo.factId !== lastFactId);

      if (!pending.length || Math.random() >= REPLAY_CHANCE) return null;
      return pending[randomInt(0, pending.length - 1)];
    }

    function allLevelFactsSeen(targetLevel = level) {
      return levelFacts(targetLevel).every((fact) => {
        const stored = FactStore.getFact(fact.factId, fact);
        return Boolean(stored?.totals?.attempts);
      });
    }

    function canAdvanceNow() {
      return mistakes.canAdvanceLevel(progressOpts()) && allLevelFactsSeen(level);
    }

    function pickFreshFact() {
      const facts = levelFacts().filter((fact, _, allFacts) => {
        if (allFacts.length <= 1) return true;
        return fact.factId !== lastFactId;
      });

      const unseen = [];
      const weak = [];
      const strong = [];

      facts.forEach((fact) => {
        const summary = FactStore.getFactSummary(fact.factId, fact);
        const bucket = summary?.practiceBucket ?? FactStats.getPracticeBucket(null);
        if (bucket === "unseen") unseen.push(fact);
        else if (bucket === "weak") weak.push(fact);
        else strong.push(fact);
      });

      const pool = unseen.length ? unseen : weak.length ? weak : strong.length ? strong : facts;
      return pool[randomInt(0, pool.length - 1)];
    }

    function pickRoundStart() {
      const combo = pickReplayCombo();
      if (combo) return { fact: factFromCombo(combo), combo };
      return { fact: pickFreshFact(), combo: null };
    }

    function beginFactRound(fact, combo) {
      currentFact = FactCatalog.createFact(fact);
      activeComboTrap = null;
      buildOptionsForFact(currentFact, combo);
      lastFactId = currentFact.factId;
      return roundView({
        hintMessage: combo ? "Exersează combinația greșită!" : "Alege suma corectă.",
      });
    }

    function isResolvedCombo(combo, fact, chosen) {
      return Boolean(combo && combo.factId === fact.factId && chosen === combo.correct);
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
          quizId: "addition-table",
        },
        currentFact
      );
    }

    function finishSolvedFact() {
      mistakes.noteRunFlawless();

      if (canAdvanceNow() && level >= MAX_LEVEL) {
        gameCompleted = true;
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          gameComplete: true,
          flash: "win",
          banner: "Felicitări! Ai terminat tabla adunării!",
          message: "Felicitări! Ai terminat tabla adunării!",
        };
      }

      if (canAdvanceNow()) {
        level++;
        mistakes.onLevelAdvanced();
        const next = pickRoundStart();
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          levelAdvanced: true,
          flash: "win",
          banner: "Felicitări! Next level!",
          message: `Corect! ${currentFact.values.a}+${currentFact.values.b}=${currentFact.correctAnswer}`,
          nextRound: this.beginRound(next),
        };
      }

      const next = pickRoundStart();
      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        runDelayMs: RUN_DELAY_MS,
        message: `Corect! ${currentFact.values.a}+${currentFact.values.b}=${currentFact.correctAnswer}`,
        nextRound: this.beginRound(next),
      };
    }

    return {
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getLevelLabel: () => getLevelLabel(level),
      getLevelButtonTitle,
      getProgress: () => mistakes.getProgressView(progressOpts()),
      isCompleted: () => gameCompleted,
      setCompleted: (value) => {
        gameCompleted = value;
      },

      resetLevelState() {
        mistakes.reset();
        currentFact = null;
        options = [];
        correctIndex = 0;
        activeComboTrap = null;
        lastFactId = null;
      },

      switchLevel(nextLevel) {
        level = nextLevel;
        gameCompleted = false;
        this.resetLevelState();
      },

      beginRound({ fact, combo } = pickRoundStart()) {
        mistakes.startRun();
        return beginFactRound(fact, combo);
      },

      onTimeout(meta = {}) {
        recordAttempt(false, null, { ...meta, timedOut: true });
        mistakes.recordMistake(buildMistakePayload(currentFact, null));
        return {
          outcome: "timeout",
          flash: "wrong",
          message: "Prea târziu! Alege suma corectă înainte să ajungă jos.",
          resetFall: true,
          ...roundView(),
        };
      },

      onAnswer(index, meta = {}) {
        const chosen = options[index];
        const correctAnswer = currentFact.correctAnswer;
        const isCorrect = chosen === correctAnswer;

        recordAttempt(isCorrect, chosen, meta);

        if (!isCorrect) {
          mistakes.recordMistake(buildMistakePayload(currentFact, chosen));
          return {
            outcome: "wrong-answer",
            correct: false,
            flash: "wrong",
            message: `${currentFact.prompt.replace("=?", "")} nu este ${chosen}. Încearcă din nou!`,
            ...roundView(),
          };
        }

        if (isResolvedCombo(activeComboTrap, currentFact, chosen)) {
          mistakes.resolveCombo(activeComboTrap);
        }

        return finishSolvedFact.call(this);
      },

      pickNextRound: () => pickRoundStart(),
    };
  }

  global.QuizRegistry.register({
    id: "addition-table",
    title: "Tabla adunarii - Clasic - 1_10+1_10",
    description: "Alege suma corectă pentru adunările din tabla 1..10.",
    order: -10,
    gestionareGreseli: { activ: true, nrRepetariPtRecuperare: 2 },
    create: createAdditionTableQuiz,
  });
})(window);
