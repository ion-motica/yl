(function (global) {
  "use strict";

  const MAX_LEVEL = 10;
  const { isPrime, primeFactors, pickWrongPrimes, randomCompositeAtLeast } = global.QuizMath;

  function comboKey({ number, wrong }) {
    return `${number}:${wrong === null ? "t" : wrong}`;
  }

  function createPrimeDivisorsQuiz() {
    const { randomInt, shuffle, levelRange, levelLabel } = global.GameUtils;

    let level = 1;
    let currentNumber = 0;
    let options = [];
    let correctIndex = 0;
    let activeComboTrap = null;
    const divisionHistory = [];
    let lastRoundStartNum = null;
    let gameCompleted = false;

    const COMBO_NEEDED = 2;
    const progress = global.LevelProgress.create({
      comboNeeded: COMBO_NEEDED,
      comboKey,
      comboTitle: (c) => {
        const wrongLabel = c.wrong === null ? "timp" : c.wrong;
        return `${c.number} ÷ ${wrongLabel} — ${c.resolved}/${COMBO_NEEDED}`;
      },
    });

    function primeDivisorsOf(n) {
      const below = [...new Set(primeFactors(n))].filter((p) => p < n);
      return below.length ? below : [...new Set(primeFactors(n))];
    }

    function applyOptionsTriple(n, correctPrime, wrongList) {
      const exclude = [correctPrime, ...wrongList.filter((x) => x != null)];
      const wrong = pickWrongPrimes(n, correctPrime, 2, shuffle, exclude);
      const triple = shuffle([correctPrime, wrong[0], wrong[1]]);
      options = triple.map((x) => Number(x));
      correctIndex = options.indexOf(correctPrime);
    }

    function buildOptionsFromCombo(combo) {
      const { number, correct, wrong } = combo;
      let triple;
      if (wrong !== null && number % wrong !== 0) {
        const extra = pickWrongPrimes(number, correct, 1, shuffle, [correct, wrong]);
        triple = shuffle([correct, wrong, extra[0]]);
      } else {
        const extras = pickWrongPrimes(number, correct, 2, shuffle, [correct]);
        triple = shuffle([correct, extras[0], extras[1]]);
      }
      options = triple.map((x) => Number(x));
      correctIndex = triple.indexOf(correct);
      activeComboTrap = combo;
    }

    function buildOptions(n, preferredCorrect) {
      activeComboTrap = null;
      const trap = progress
        .pendingCombos(undefined, minQuestionForLevel(level))
        .find((c) => c.number === n);
      if (trap) {
        buildOptionsFromCombo(trap);
        return;
      }
      const factors = primeDivisorsOf(n);
      const correctPrime =
        preferredCorrect &&
        n % preferredCorrect === 0 &&
        isPrime(preferredCorrect) &&
        preferredCorrect < n
          ? preferredCorrect
          : factors[randomInt(0, factors.length - 1)];
      applyOptionsTriple(n, correctPrime, []);
    }

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

    function finishSeriesRun(reachedOne) {
      progress.noteRunFlawless();

      if (canAdvanceNow() && level >= MAX_LEVEL) {
        gameCompleted = true;
        return {
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
          correct: true,
          runComplete: true,
          levelAdvanced: true,
          flash: "win",
          banner: "Felicitări! Next level!",
          message: "",
          nextRound: this.beginRound(next),
        };
      }

      const next = pickRoundStart();
      const flawless = progress.isRunFlawless();
      return {
        correct: true,
        runComplete: true,
        flash: flawless ? "win" : undefined,
        message: flawless
          ? "Felicitări! Runde perfectă."
          : reachedOne
            ? "Felicitări! Ai ajuns la 1."
            : "",
        nextRound: this.beginRound(next),
      };
    }

    function pickCompositeStart(exclude) {
      const { min, max } = levelRange(level);
      const floor = minQuestionForLevel(level);
      return randomCompositeAtLeast(floor, min, max, exclude);
    }

    function pickRoundStart() {
      const floor = minQuestionForLevel(level);
      const pending = progress
        .pendingCombos(undefined, floor)
        .filter((c) => c.number !== lastRoundStartNum);
      if (pending.length && Math.random() < 0.65) {
        const combo = pending[randomInt(0, pending.length - 1)];
        return { startNum: combo.number, combo };
      }
      return {
        startNum: pickCompositeStart(lastRoundStartNum),
        combo: null,
      };
    }

    function formatOptionsForView() {
      return options.map((x) => {
        if (x == null || Number.isNaN(Number(x))) return "—";
        const s = String(x);
        return s === "undefined" ? "—" : s;
      });
    }

    function roundView(extra = {}) {
      return {
        prompt: String(currentNumber),
        options: formatOptionsForView(),
        correctIndex,
        divisionHistory: [...divisionHistory],
        hintMessage: extra.hintMessage ?? "Alege divizorul prim corect.",
        ...extra,
      };
    }

    return {
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      isCompleted: () => gameCompleted,
      setCompleted: (v) => {
        gameCompleted = v;
      },

      resetLevelState() {
        progress.reset();
        lastRoundStartNum = null;
        divisionHistory.length = 0;
        activeComboTrap = null;
      },

      switchLevel(lv) {
        level = lv;
        gameCompleted = false;
        this.resetLevelState();
      },

      getLevelLabel: () => levelLabel(level),
      getProgress: () => progress.getProgressView(progressOpts()),

      beginRound({ startNum, combo } = pickRoundStart()) {
        if (isBelowLevelFloor(startNum)) {
          return this.beginRound(pickRoundStart());
        }
        lastRoundStartNum = startNum;
        currentNumber = startNum;
        progress.startRun();
        divisionHistory.length = 0;
        activeComboTrap = null;
        if (combo) buildOptionsFromCombo(combo);
        else buildOptions(currentNumber);
        return roundView({
          hintMessage: combo ? "Exersează combinația greșită!" : undefined,
        });
      },

      onTimeout() {
        progress.recordMistake({
          number: currentNumber,
          correct: options[correctIndex],
          wrong: null,
        });
        return {
          flash: "wrong",
          message: "Prea târziu! Alege înainte să ajungă jos.",
          resetFall: true,
          ...roundView(),
        };
      },

      onAnswer(index) {
        const numberBefore = currentNumber;
        const chosen = options[index];
        const correct = options[correctIndex];

        if (numberBefore % chosen !== 0) {
          progress.recordMistake({
            number: numberBefore,
            correct,
            wrong: chosen,
          });
          return {
            correct: false,
            flash: "wrong",
            message: `${chosen} nu divide ${numberBefore}. Încearcă din nou!`,
            ...roundView(),
          };
        }

        if (
          activeComboTrap &&
          numberBefore === activeComboTrap.number &&
          chosen === activeComboTrap.correct
        ) {
          progress.resolveCombo(activeComboTrap);
        }

        const quotient = Math.floor(numberBefore / chosen);
        divisionHistory.push(`${numberBefore}:${chosen}=${quotient}`);
        currentNumber = quotient;

        if (currentNumber === 1) {
          return finishSeriesRun.call(this, true);
        }

        if (isBelowLevelFloor(currentNumber)) {
          return finishSeriesRun.call(this, false);
        }

        buildOptions(currentNumber);
        return {
          correct: true,
          bounce: true,
          message: `${chosen} divide! Noul număr: ${currentNumber}`,
          ...roundView(),
        };
      },

      pickNextRound: () => pickRoundStart(),
    };
  }

  global.QuizRegistry.register({
    id: "prime-divisors",
    title: "Găsire divizori primi",
    description: "Număr compus — alege divizorul prim care îl divide.",
    order: 0,
    create: createPrimeDivisorsQuiz,
  });
})(window);
