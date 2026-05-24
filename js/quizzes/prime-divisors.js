(function (global) {
  "use strict";

  const MAX_LEVEL = 10;
  const { isPrime, primeFactors, pickWrongPrimes, randomComposite } = global.QuizMath;

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

    const progress = global.LevelProgress.create({
      comboKey,
      comboTitle: (c) => {
        const wrongLabel = c.wrong === null ? "timp" : c.wrong;
        return `${c.number} ÷ ${wrongLabel} — ${c.resolved}/3`;
      },
    });

    function buildOptionsFromCombo(combo) {
      const { number, correct, wrong } = combo;
      let triple;
      if (wrong !== null && number % wrong !== 0) {
        triple = shuffle([
          correct,
          wrong,
          pickWrongPrimes(number, correct, 1, shuffle)[0],
        ]);
      } else {
        const extras = pickWrongPrimes(number, correct, 2, shuffle);
        triple = shuffle([correct, extras[0], extras[1]]);
      }
      correctIndex = triple.indexOf(correct);
      activeComboTrap = combo;
      options = triple;
    }

    function buildOptions(n, preferredCorrect) {
      activeComboTrap = null;
      const trap = progress.pendingCombos().find((c) => c.number === n);
      if (trap) {
        buildOptionsFromCombo(trap);
        return;
      }
      const factors = [...new Set(primeFactors(n))];
      const correctPrime =
        preferredCorrect && n % preferredCorrect === 0 && isPrime(preferredCorrect)
          ? preferredCorrect
          : factors[randomInt(0, factors.length - 1)];
      const wrong = pickWrongPrimes(n, correctPrime, 2, shuffle);
      const triple = shuffle([correctPrime, wrong[0], wrong[1]]);
      correctIndex = triple.indexOf(correctPrime);
      options = triple;
    }

    function pickRoundStart() {
      const pending = progress.pendingCombos().filter((c) => c.number !== lastRoundStartNum);
      if (pending.length && Math.random() < 0.65) {
        const combo = pending[randomInt(0, pending.length - 1)];
        return { startNum: combo.number, combo };
      }
      const { min, max } = levelRange(level);
      return {
        startNum: randomComposite(min, max, lastRoundStartNum),
        combo: null,
      };
    }

    function roundView(extra = {}) {
      return {
        prompt: String(currentNumber),
        options: options.map(String),
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
      getProgress: () => progress.getProgressView(),

      beginRound({ startNum, combo } = pickRoundStart()) {
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
          progress.noteRunFlawless();
          const canAdvance = progress.canAdvanceLevel();

          if (canAdvance && level >= MAX_LEVEL) {
            gameCompleted = true;
            return {
              correct: true,
              runComplete: true,
              gameComplete: true,
              flash: "win",
              banner: "Felicitări! Ai terminat toate nivelele!",
              message: "Felicitări! Ai terminat toate nivelele!",
              prompt: "1",
              options: options.map(String),
              divisionHistory: [...divisionHistory],
            };
          }

          if (canAdvance) {
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
          return {
            correct: true,
            runComplete: true,
            flash: "win",
            message: progress.isRunFlawless()
              ? "Felicitări! Runde perfectă."
              : "Felicitări! Ai ajuns la 1.",
            nextRound: this.beginRound(next),
            prompt: "1",
            divisionHistory: [...divisionHistory],
          };
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
