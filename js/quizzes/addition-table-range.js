(function (global) {
  "use strict";

  const QUIZ_ID = "addition-table-range";
  const MAX_LEVEL = 10;
  const RUN_DELAY_MS = 500;
  const CORRECT_PROMPT_HOLD_MS = 160;
  const RECENT_WINDOW = 4;

  function getAdditionFastResponseMs(fact) {
    const { a, b, result } = fact.values;
    const maxOperand = Math.max(a, b);
    return 1400 + result * 90 + maxOperand * 50;
  }

  const FACT_STATS_CONFIG = {
    getFastResponseMs: getAdditionFastResponseMs,
  };

  function levelBase(targetLevel) {
    return targetLevel + 2;
  }

  function createAdditionTableRangeQuiz(config = {}) {
    const { randomInt, shuffle } = global.GameUtils;
    const { FactCatalog, FactStore } = global;

    let level = 1;
    let currentFact = null;
    let options = [];
    let correctIndex = 0;
    let activeComboTrap = null;
    let lastFactId = null;
    let gameCompleted = false;
    const recentQuestionIds = [];
    const learnedByLevel = new Map();

    function learnedSetForLevel(targetLevel = level) {
      if (!learnedByLevel.has(targetLevel)) learnedByLevel.set(targetLevel, new Set());
      return learnedByLevel.get(targetLevel);
    }

    function resetLearnedForLevel(targetLevel = level) {
      learnedByLevel.set(targetLevel, new Set());
    }

    function levelFacts(targetLevel = level) {
      if (targetLevel === 1) {
        return FactCatalog.listTableFacts({
          operation: "add",
          promptForm: FactCatalog.PROMPT_FORMS.result,
          minA: 1,
          maxA: 3,
          minB: 1,
          maxB: 3,
        });
      }

      const base = levelBase(targetLevel);
      const facts = [];
      for (let x = 1; x <= base; x++) {
        facts.push(
          FactCatalog.createFact({
            operation: "add",
            promptForm: FactCatalog.PROMPT_FORMS.result,
            values: { a: base, b: x },
          })
        );
        if (x !== base) {
          facts.push(
            FactCatalog.createFact({
              operation: "add",
              promptForm: FactCatalog.PROMPT_FORMS.result,
              values: { a: x, b: base },
            })
          );
        }
      }
      return facts;
    }

    function factAnsweredCorrectly(fact, targetLevel = level) {
      return learnedSetForLevel(targetLevel).has(fact.factId);
    }

    function levelMasteryCount(targetLevel = level) {
      const facts = levelFacts(targetLevel);
      const mastered = facts.filter((fact) => factAnsweredCorrectly(fact, targetLevel)).length;
      return { mastered, total: facts.length, facts };
    }

    function canAdvanceNow() {
      const { mastered, total } = levelMasteryCount();
      return total > 0 && mastered >= total;
    }

    function pushRecent(list, value, limit = RECENT_WINDOW) {
      list.push(value);
      if (list.length > limit) {
        list.splice(0, list.length - limit);
      }
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
      if (targetLevel === 1) {
        return `Nivel ${targetLevel} · 1..3 + 1..3`;
      }
      const base = levelBase(targetLevel);
      return `Nivel ${targetLevel} · ${base}+x și x+${base} (1..${base})`;
    }

    function getLevelButtonTitle(targetLevel) {
      if (targetLevel === 1) {
        return `Nivel ${targetLevel}: adunări cu termeni 1..3`;
      }
      const base = levelBase(targetLevel);
      return `Nivel ${targetLevel}: ${base}+x și x+${base}, x=1..${base}`;
    }

    function getDifficultyScore(fact) {
      const { a, b, result } = fact.values;
      const maxOperand = Math.max(a, b);
      const minOperand = Math.min(a, b);
      return result * 100 + maxOperand * 10 + minOperand;
    }

    function compareFactsByDifficulty(left, right) {
      const delta = getDifficultyScore(left) - getDifficultyScore(right);
      if (delta !== 0) return delta;
      return String(left.factId).localeCompare(String(right.factId));
    }

    function getAnswerBounds() {
      const results = levelFacts().map((fact) => fact.values.result);
      const minResult = Math.min(...results);
      const maxResult = Math.max(...results);
      return {
        min: Math.max(2, minResult - 2),
        max: maxResult + 3,
      };
    }

    function pickWrongAnswers(correctAnswer, count, exclude = []) {
      const { min, max } = getAnswerBounds();
      const used = new Set([correctAnswer, ...exclude.filter((value) => value != null)]);
      const candidates = [];

      for (let offset = 1; offset <= max - min + 4; offset++) {
        const lower = correctAnswer - offset;
        const upper = correctAnswer + offset;
        if (lower >= min && !used.has(lower) && !candidates.includes(lower)) candidates.push(lower);
        if (upper <= max && !used.has(upper) && !candidates.includes(upper)) candidates.push(upper);
      }

      const picked = [];
      for (const value of shuffle(candidates)) {
        if (picked.length >= count) break;
        if (!used.has(value)) {
          picked.push(value);
          used.add(value);
        }
      }

      for (let value = min; value <= max && picked.length < count; value++) {
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

    function pickEasiestFact(candidates) {
      const sorted = [...candidates].sort(compareFactsByDifficulty);
      const blockedIds = new Set(recentQuestionIds);
      const fresh = sorted.filter((fact) => !blockedIds.has(fact.factId));
      const source = fresh.length ? fresh : sorted;
      if (!source.length) return null;

      // Random, but biased towards smaller/easier sums:
      // pick uniformly from the top-K easiest available.
      const TOP_K = 5;
      const pool = source.slice(0, Math.min(TOP_K, source.length));
      return pool[randomInt(0, pool.length - 1)];
    }

    function chooseNextQuestion() {
      const facts = levelFacts().filter((fact, _, allFacts) => {
        if (allFacts.length <= 1) return true;
        return fact.factId !== lastFactId;
      });
      const pending = facts.filter((fact) => !factAnsweredCorrectly(fact, level));
      const pool = pending.length ? pending : facts;
      const fact = pickEasiestFact(pool);

      return {
        fact: fact ?? facts.sort(compareFactsByDifficulty)[0],
        combo: null,
      };
    }

    function pickRoundStart() {
      return chooseNextQuestion();
    }

    function beginFactRound(fact, combo) {
      currentFact = FactCatalog.createFact(fact);
      activeComboTrap = null;
      buildOptionsForFact(currentFact, combo);
      lastFactId = currentFact.factId;
      pushRecent(recentQuestionIds, currentFact.factId);
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
          quizId: QUIZ_ID,
        },
        currentFact
      );
    }

    function finishSolvedFact() {
      if (canAdvanceNow() && level >= MAX_LEVEL) {
        gameCompleted = true;
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          gameComplete: true,
          flash: "win",
          banner: "Felicitări! Ai terminat tabla adunării!",
          message: "Felicitări! Ai terminat tabla adunării 1..n + 1..n!",
        };
      }

      if (canAdvanceNow()) {
        level++;
        resetLearnedForLevel(level);
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

      getProgressDisplay() {
        const { mastered, total } = levelMasteryCount();
        const percent = total > 0 ? Math.round((mastered / total) * 100) : 0;
        return {
          green: ProgressDisplay.greenPercent(percent),
          red: ProgressDisplay.redNone(),
        };
      },

      isCompleted: () => gameCompleted,
      setCompleted: (value) => {
        gameCompleted = value;
      },

      resetLevelState() {
        learnedByLevel.clear();
        resetLearnedForLevel(1);
        currentFact = null;
        options = [];
        correctIndex = 0;
        activeComboTrap = null;
        lastFactId = null;
        recentQuestionIds.length = 0;
      },

      switchLevel(nextLevel) {
        level = nextLevel;
        gameCompleted = false;
        resetLearnedForLevel(level);
        currentFact = null;
        options = [];
        correctIndex = 0;
        activeComboTrap = null;
        lastFactId = null;
        recentQuestionIds.length = 0;
      },

      beginRound({ fact, combo } = pickRoundStart()) {
        return beginFactRound(fact, combo);
      },

      onTimeout(meta = {}) {
        recordAttempt(false, null, { ...meta, timedOut: true });
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
          return {
            outcome: "wrong-answer",
            correct: false,
            flash: "wrong",
            message: `${currentFact.prompt.replace("=?", "")} nu este ${chosen}. Încearcă din nou!`,
            ...roundView(),
          };
        }

        learnedSetForLevel(level).add(currentFact.factId);

        const promptWithAnswerText = currentFact.prompt.includes("=?")
          ? currentFact.prompt.replace("=?", `=${correctAnswer}`)
          : currentFact.prompt.replace("?", String(correctAnswer));

        const promptWithAnswerHtml = currentFact.prompt.includes("=?")
          ? currentFact.prompt.replace(
              "=?",
              `=<span class="q-correct">${correctAnswer}</span>`
            )
          : currentFact.prompt.replace(
              "?",
              `<span class="q-correct">${correctAnswer}</span>`
            );

        const result = finishSolvedFact.call(this);
        result.prompt = promptWithAnswerText;
        result.promptHtml = promptWithAnswerHtml;
        // Ca FallingEngine să nu șteargă temporar opțiunile în fereastra scurtă dintre răspuns și nextRound.
        result.options = options;
        result.correctIndex = correctIndex;
        result.hintMessage = "";
        // În acest quiz vrem o pauză scurtă după răspuns corect, chiar dacă dă next level.
        result.levelAdvanced = false;
        result.runDelayMs = CORRECT_PROMPT_HOLD_MS;
        return result;
      },

      pickNextRound: () => pickRoundStart(),
    };
  }

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: "Tabla adunarii - 1..n + 1..n - QUIZ NEFUNCTIONAL - IN REFACTORING",
    description:
      "Nivel 1: adunări 1..3. Apoi 4+x și x+4, apoi 5+x, etc. Treci nivelul când ai răspuns corect la fiecare întrebare.",
    order: -9,
    gestionareGreseli: { activ: true, nrRepetariPtRecuperare: 2 },
    create: createAdditionTableRangeQuiz,
  });
})(window);
