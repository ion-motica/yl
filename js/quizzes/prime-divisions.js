(function (global) {
  "use strict";

  const MAX_LEVEL = 10;
  const { primeFactors, randomCompositeAtLeast } = global.QuizMath;

  function createPrimeDivisionsQuiz() {
    const { randomInt, shuffle, levelRange, levelLabel } = global.GameUtils;

    let level = 1;
    let roundStartNumber = 0;
    let currentDividend = 0;
    let currentDivisor = 0;
    let currentQuotient = 0;
    let options = [];
    let correctIndex = 0;
    let lastRoundStartNum = null;
    let gameCompleted = false;
    const solvedFactors = [];
    const divisionHistory = [];

    const progress = global.LevelProgress.create({
      comboKey: (payload) => `${payload.number}:${payload.kind ?? "division"}`,
      comboTitle: (payload) => `Împărțire ${payload.number}`,
    });

    function minQuestionForLevel(lv) {
      if (lv >= 5) return 20;
      if (lv >= 3) return 10;
      return 1;
    }

    function isBelowLevelFloor(n) {
      return n > 1 && n < minQuestionForLevel(level);
    }

    function progressOpts() {
      return { minComboNumber: minQuestionForLevel(level) };
    }

    function canAdvanceNow() {
      return progress.canAdvanceLevel(progressOpts());
    }

    function uniquePrimeDivisorsOf(n) {
      return [...new Set(primeFactors(n))];
    }

    function pickPrimeDivisor(n) {
      const divisors = uniquePrimeDivisorsOf(n);
      if (!divisors.length) return n;
      return divisors[randomInt(0, divisors.length - 1)];
    }

    function pickWrongQuotients(dividend, correctQuotient, count) {
      const picked = [];
      const used = new Set([correctQuotient]);
      const half = Math.floor(dividend / 2);

      function tryAdd(value) {
        if (picked.length >= count) return;
        if (!Number.isInteger(value) || value < 1 || used.has(value)) return;
        picked.push(value);
        used.add(value);
      }

      const preferred = [];
      for (let value = 1; value <= half; value++) {
        if (value !== correctQuotient) preferred.push(value);
      }
      for (const value of shuffle(preferred)) tryAdd(value);

      if (picked.length < count) {
        const fallback = [];
        const fallbackMax = Math.max(dividend, correctQuotient + 4, 6);
        for (let value = half + 1; value <= fallbackMax; value++) {
          if (value !== correctQuotient) fallback.push(value);
        }
        for (const value of shuffle(fallback)) tryAdd(value);
      }

      for (let value = Math.max(dividend + 1, 7); picked.length < count; value++) {
        tryAdd(value);
      }

      return picked.slice(0, count);
    }

    function buildFactorizationLine(quotient) {
      const parts = [...solvedFactors];
      if (quotient > 1) parts.push(quotient);
      return `${roundStartNumber}=${parts.join("*")}`;
    }

    function formatOptionsForView(source = options) {
      return source.map((x) => {
        if (x == null || Number.isNaN(Number(x))) return "—";
        const s = String(x);
        return s === "undefined" ? "—" : s;
      });
    }

    function currentPrompt() {
      return `${currentDividend}/${currentDivisor}`;
    }

    function roundView(extra = {}) {
      return {
        prompt: currentPrompt(),
        options: formatOptionsForView(),
        correctIndex,
        divisionHistory: [...divisionHistory],
        hintMessage: extra.hintMessage ?? "Alege câtul corect.",
        ...extra,
      };
    }

    function solvedStepView(dividend, divisor) {
      return {
        prompt: `${dividend}/${divisor}`,
        options: formatOptionsForView(),
        correctIndex,
        divisionHistory: [...divisionHistory],
        hintMessage: "",
      };
    }

    function buildStep(dividend) {
      currentDividend = dividend;
      currentDivisor = pickPrimeDivisor(dividend);
      currentQuotient = Math.floor(currentDividend / currentDivisor);

      const wrong = pickWrongQuotients(currentDividend, currentQuotient, 2);
      const triple = shuffle([currentQuotient, wrong[0], wrong[1]]);
      options = triple.map((value) => Number(value));
      correctIndex = options.indexOf(currentQuotient);
    }

    function finishSeriesRun(reachedOne, finalView) {
      const snapshot = { ...finalView, divisionHistory: [...finalView.divisionHistory] };
      progress.noteRunFlawless();

      if (canAdvanceNow() && level >= MAX_LEVEL) {
        gameCompleted = true;
        return {
          ...snapshot,
          correct: true,
          runComplete: true,
          gameComplete: true,
          flash: "win",
          banner: "Felicitări! Ai terminat toate nivelele!",
          message: "Felicitări! Ai terminat toate nivelele!",
        };
      }

      if (canAdvanceNow()) {
        level++;
        progress.onLevelAdvanced();
        const next = pickRoundStart();
        return {
          ...snapshot,
          correct: true,
          runComplete: true,
          levelAdvanced: true,
          flash: "win",
          banner: "Felicitări! Next level!",
          message: reachedOne ? "Felicitări! Ai ajuns la 1." : "Rundă completă.",
          nextRound: this.beginRound(next),
        };
      }

      const next = pickRoundStart();
      const flawless = progress.isRunFlawless();
      return {
        ...snapshot,
        correct: true,
        runComplete: true,
        flash: flawless ? "win" : undefined,
        message: flawless
          ? "Felicitări! Rundă perfectă."
          : reachedOne
            ? "Felicitări! Ai ajuns la 1."
            : "Rundă completă.",
        nextRound: this.beginRound(next),
      };
    }

    function pickCompositeStart(exclude) {
      const { min, max } = levelRange(level);
      const floor = minQuestionForLevel(level);
      return randomCompositeAtLeast(floor, min, max, exclude);
    }

    function pickRoundStart() {
      return { startNum: pickCompositeStart(lastRoundStartNum) };
    }

    return {
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      isCompleted: () => gameCompleted,
      setCompleted: (value) => {
        gameCompleted = value;
      },

      resetLevelState() {
        progress.reset();
        lastRoundStartNum = null;
        roundStartNumber = 0;
        currentDividend = 0;
        currentDivisor = 0;
        currentQuotient = 0;
        options = [];
        correctIndex = 0;
        solvedFactors.length = 0;
        divisionHistory.length = 0;
      },

      switchLevel(lv) {
        level = lv;
        gameCompleted = false;
        this.resetLevelState();
      },

      getLevelLabel: () => levelLabel(level),
      getProgress: () => progress.getProgressView(progressOpts()),

      beginRound({ startNum } = pickRoundStart()) {
        if (isBelowLevelFloor(startNum)) {
          return this.beginRound(pickRoundStart());
        }

        lastRoundStartNum = startNum;
        roundStartNumber = startNum;
        solvedFactors.length = 0;
        divisionHistory.length = 0;
        progress.startRun();
        buildStep(startNum);

        return roundView({
          hintMessage: "Rezolvă împărțirea și continuă cu câtul obținut.",
        });
      },

      onTimeout() {
        progress.markRunImperfect();
        return {
          flash: "wrong",
          message: "Prea târziu! Alege câtul corect înainte să ajungă jos.",
          resetFall: true,
          ...roundView({ hintMessage: "" }),
        };
      },

      onAnswer(index) {
        const dividendBefore = currentDividend;
        const divisorBefore = currentDivisor;
        const quotientBefore = currentQuotient;
        const chosen = options[index];

        if (chosen !== quotientBefore) {
          progress.markRunImperfect();
          return {
            correct: false,
            flash: "wrong",
            message: `${dividendBefore}/${divisorBefore} nu este ${chosen}. Încearcă din nou!`,
            ...roundView(),
          };
        }

        solvedFactors.push(divisorBefore);
        divisionHistory.push(buildFactorizationLine(quotientBefore));

        if (quotientBefore === 1) {
          return finishSeriesRun.call(this, true, solvedStepView(dividendBefore, divisorBefore));
        }

        if (isBelowLevelFloor(quotientBefore)) {
          return finishSeriesRun.call(this, false, solvedStepView(dividendBefore, divisorBefore));
        }

        buildStep(quotientBefore);
        return {
          correct: true,
          bounce: true,
          message: `Corect! ${dividendBefore}/${divisorBefore}=${quotientBefore}`,
          ...roundView({ hintMessage: "" }),
        };
      },

      pickNextRound: () => pickRoundStart(),
    };
  }

  global.QuizRegistry.register({
    id: "prime-divisions",
    title: "Împărțiri la numere prime",
    description: "Alege câtul corect pentru împărțiri succesive cu divizori primi.",
    order: 1,
    create: createPrimeDivisionsQuiz,
  });
})(window);
