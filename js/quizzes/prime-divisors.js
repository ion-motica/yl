(function (global) {
  "use strict";

  const MAX_LEVEL = 10;
  const REPLAY_CHANCE = 0.65;
  const { isPrime, primeFactors, pickWrongPrimes, randomCompositeAtLeast } = global.QuizMath;

  function createPrimeDivisorsQuiz(config = {}) {
    const { randomInt, shuffle, levelRange, levelLabel } = global.GameUtils;

    let level = 1;
    let currentNumber = 0;
    let options = [];
    let correctIndex = 0;
    let activeComboTrap = null;
    const divisionHistory = [];
    let lastRoundStartNum = null;
    let gameCompleted = false;
    let orchestrator = null;

    // Faza E, sectiunea 12: orice quiz trebuie construit intern prin
    // SubquizOrchestrator (vezi equations-e3-e6.js pt. explicatia completa).
    // Orchestratorul porneste O SINGURA DATA, la construirea quiz-ului, cu un
    // `generator` gol care nu se mai cheama niciodata dupa aia — de-acolo
    // incolo, un singur apel neconditionat tine sincronizat itemul lui cu
    // `currentNumber`/`options`.
    function sincronizeazaOrchestratorul() {
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: String(currentNumber),
        options: [...options],
        correctIndex,
      });
    }

    const mistakes = global.QuizMistakes.create(config, {
      comboTitle: (c) => {
        const wrongLabel = c.wrong === null ? "timp" : c.wrong;
        return `${c.number} ÷ ${wrongLabel} — ${c.resolved}/${mistakes.comboNeeded}`;
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
      const trap = findPendingComboForNumber(n);
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
      const floor = minQuestionForLevel(level);
      return { comboRelevant: (combo) => combo.number >= floor };
    }

    function buildMistakePayload(number, correct, wrong) {
      const questionText = String(number);
      return {
        questionId: questionText,
        questionLabel: questionText,
        number,
        correct,
        wrong,
      };
    }

    function findPendingComboForNumber(number) {
      return mistakes.pendingCombos(undefined, progressOpts()).find((combo) => combo.number === number);
    }

    function pickReplayStartCombo() {
      const pending = mistakes
        .pendingCombos(undefined, progressOpts())
        .filter((combo) => combo.number !== lastRoundStartNum);
      if (!pending.length || Math.random() >= REPLAY_CHANCE) return null;
      return pending[randomInt(0, pending.length - 1)];
    }

    function isResolvedCombo(combo, number, chosen) {
      return Boolean(combo && number === combo.number && chosen === combo.correct);
    }

    function canAdvanceNow() {
      return mistakes.canAdvanceLevel(progressOpts());
    }

    // Motor3Butoane apeleaza actiunile ca functii simple, fara `this` legat de
    // obiectul quizului — de-asta `finishSeriesRun` foloseste `quizApi` (setat
    // imediat dupa ce obiectul e construit, mai jos) in loc de
    // `this.beginRound(...)`, cum era in versiunea dinainte de migrare.
    function finishSeriesRun(reachedOne) {
      mistakes.noteRunFlawless();

      if (canAdvanceNow() && level >= MAX_LEVEL) {
        gameCompleted = true;
        return {
          outcome: "run-complete",
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
        mistakes.onLevelAdvanced();
        const next = pickRoundStart();
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          levelAdvanced: true,
          flash: "win",
          banner: "Felicitări! Next level!",
          message: "",
          nextRound: quizApi.beginRound(next),
        };
      }

      const next = pickRoundStart();
      const flawless = mistakes.isRunFlawless();
      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        flash: flawless ? "win" : undefined,
        message: flawless
          ? "Felicitări! Runde perfectă."
          : reachedOne
            ? "Felicitări! Ai ajuns la 1."
            : "",
        nextRound: quizApi.beginRound(next),
      };
    }

    // Motor 3 butoane (M3B) — vezi documente de referinta/PLAN-motor-comun-raspuns.md.
    // Aici exista un pas intermediar real: cat timp catul impartirii nu e 1 (si
    // nu a coborat sub pragul nivelului), raspunsul corect continua ACELASI
    // lant, nu incepe o intrebare noua independenta — de-asta mutatia de stare
    // (istoricul, noul numar curent) se face in `dupaRaspunsCorect`, care
    // decide si daca lantul s-a incheiat (intoarce rezultatul complet) sau
    // continua.
    //
    // Faza E, sectiunea 12: invelit intr-un SubquizOrchestrator (o singura
    // bucata "baza"). `options` proprii sunt NUMERE, dar motorul comun
    // normalizeaza la STRING-uri — `dupa_turn_apasare`/`dupaRaspunsCorect`/
    // `mesaje.gresit` citesc `options[ctx.index]` direct din closure, NU
    // `ctx.alesul`, ca la addition-table.js (acelasi tipar, aceeasi capcana —
    // aici `isResolvedCombo` ar fi picat tacut, comparatie stricta cu numar).
    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "base",
        title: "baza",
        hintMessage: "Alege divizorul prim corect.",
        esteCorect: (_item, index) => currentNumber % options[index] === 0,
        generator: () => ({}),
        mesaje: {
          gresit: (ctx) => `${options[ctx.index]} nu divide ${currentNumber}. Încearcă din nou!`,
        },
        actiuni: {
          dupa_turn_apasare: (ctx) => {
            if (!ctx.corect) {
              mistakes.recordMistake(buildMistakePayload(currentNumber, options[correctIndex], options[ctx.index]));
            }
            return { divisionHistory: [...divisionHistory] };
          },
          dupaRaspunsCorect: (ctx) => {
            const numberBefore = currentNumber;
            const chosen = options[ctx.index];

            if (isResolvedCombo(activeComboTrap, numberBefore, chosen)) {
              mistakes.resolveCombo(activeComboTrap);
            }

            const quotient = Math.floor(numberBefore / chosen);
            divisionHistory.push(`${numberBefore}:${chosen}=${quotient}`);
            currentNumber = quotient;

            if (currentNumber === 1) {
              return { action: "continue", view: finishSeriesRun(true) };
            }
            if (isBelowLevelFloor(currentNumber)) {
              return { action: "continue", view: finishSeriesRun(false) };
            }

            buildOptions(currentNumber);
            sincronizeazaOrchestratorul();
            return {
              action: "continue",
              view: {
                outcome: "step-correct",
                correct: true,
                bounce: true,
                message: `${chosen} divide! Noul număr: ${currentNumber}`,
                ...roundView(),
              },
            };
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

    function pickCompositeStart(exclude) {
      const { min, max } = levelRange(level);
      const floor = minQuestionForLevel(level);
      return randomCompositeAtLeast(floor, min, max, exclude);
    }

    function pickRoundStart() {
      const combo = pickReplayStartCombo();
      if (combo) {
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

    const quizApi = {
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      isCompleted: () => gameCompleted,
      setCompleted: (v) => {
        gameCompleted = v;
      },

      resetLevelState() {
        mistakes.reset();
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
      getProgress: () => mistakes.getProgressView(progressOpts()),

      getProgressDisplay() {
        return ProgressDisplay.fromMistakeProgress(mistakes.getProgressView(progressOpts()));
      },

      placeholderRaspuns: global.PlaceholderRaspuns.creeaza("?"),
      laSchimbareDeNivel: global.SchimbareDeNivel.standard(),
      beginRound({ startNum, combo } = pickRoundStart()) {
        if (isBelowLevelFloor(startNum)) {
          return this.beginRound(pickRoundStart());
        }
        lastRoundStartNum = startNum;
        currentNumber = startNum;
        mistakes.startRun();
        divisionHistory.length = 0;
        activeComboTrap = null;
        if (combo) buildOptionsFromCombo(combo);
        else buildOptions(currentNumber);
        sincronizeazaOrchestratorul();
        return roundView({
          hintMessage: combo ? "Exersează combinația greșită!" : undefined,
        });
      },

      onTimeout() {
        mistakes.recordMistake(buildMistakePayload(currentNumber, options[correctIndex], null));
        return {
          outcome: "timeout",
          flash: "wrong",
          message: "Prea târziu! Alege înainte să ajungă jos.",
          resetFall: true,
          ...roundView(),
        };
      },

      // Migrat la Motor3Butoane (Faza D), invelit in SubquizOrchestrator
      // (Faza E, sectiunea 12) — vezi `baseDefinition`, mai sus.
      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },

      pickNextRound: () => pickRoundStart(),
    };
    return quizApi;
  }

  global.QuizRegistry.register({
    id: "prime-divisors",
    title: "Găsire divizori primi",
    description: "Număr compus — alege divizorul prim care îl divide.",
    order: 0,
    gestionareGreseli: { activ: true, nrRepetariPtRecuperare: 2 },
    create: createPrimeDivisorsQuiz,
  });
})(window);
