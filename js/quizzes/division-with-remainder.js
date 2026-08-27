(function (global) {
  "use strict";

  const QUIZ_ID = "division-with-remainder";
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 9;
  const MIN_C = 2;
  const MAX_C = 10;
  const QUESTIONS_PER_LEVEL = 21;
  const CONSECUTIVE_NEEDED = 5;
  const HINT = "Alege răspunsul corect.";
  // Cât de des apare rest 0 (ex. 0.15 = ~15% din întrebări).
  const REST_ZERO_CHANCE = 0.15;

  const FORM_COLON = "colon";
  const FORM_STAR = "star";
  const FIELDS = ["d", "i", "c", "r"];

  function divisorForLevel(level) {
    return level + 1;
  }

  function isValidRemainder(r, i) {
    return Number.isInteger(r) && r >= 0 && r < i;
  }

  function isValidFact(fact) {
    return (
      fact.c >= MIN_C &&
      fact.c <= MAX_C &&
      isValidRemainder(fact.r, fact.i) &&
      fact.d === fact.i * fact.c + fact.r
    );
  }

  function pickRemainder(i, randomInt) {
    if (i <= 1) return 0;
    if (Math.random() < REST_ZERO_CHANCE) return 0;
    return randomInt(1, i - 1);
  }

  function generateFact(level) {
    const { randomInt } = global.GameUtils;
    const i = divisorForLevel(level);

    for (let attempt = 0; attempt < 50; attempt++) {
      const c = randomInt(MIN_C, MAX_C);
      const r = pickRemainder(i, randomInt);
      const d = i * c + r;
      const fact = { d, i, c, r };
      if (isValidFact(fact)) return fact;
    }

    return { d: i * MIN_C + 1, i, c: MIN_C, r: i > 1 ? 1 : 0 };
  }

  function showValue(field, name, value) {
    return name === field ? "?" : String(value);
  }

  function buildPrompt(fact, form, field) {
    const { d, i, c, r } = fact;

    if (form === FORM_COLON) {
      return (
        `${showValue(field, "d", d)}:${showValue(field, "i", i)}=` +
        `${showValue(field, "c", c)} r ${showValue(field, "r", r)}`
      );
    }

    return (
      `${showValue(field, "d", d)}=${showValue(field, "i", i)}*` +
      `${showValue(field, "c", c)}+${showValue(field, "r", r)}`
    );
  }

  function isValidTrap(value, field, fact) {
    if (!Number.isInteger(value)) return false;
    if (field === "d") return value >= 1;
    if (field === "i" || field === "c") return value >= MIN_C;
    if (field === "r") return value >= 0 && value < fact.i;
    return false;
  }

  function trapCandidates(correct, field, fact) {
    const list = [];

    if (field === "d") {
      for (let delta = 1; delta <= 15; delta++) {
        list.push(correct - delta, correct + delta);
      }
      for (let delta = 16; delta <= 40; delta++) {
        list.push(correct - delta, correct + delta);
      }
    } else if (field === "i" || field === "c") {
      for (let delta = 1; delta <= 3; delta++) {
        list.push(correct - delta, correct + delta);
      }
      for (let delta = 4; delta <= 12; delta++) {
        list.push(correct - delta, correct + delta);
      }
    } else {
      for (let value = 0; value < fact.i; value++) {
        if (value !== correct) list.push(value);
      }
    }

    list.sort((a, b) => Math.abs(a - correct) - Math.abs(b - correct));
    return list;
  }

  function pickTraps(correct, field, fact) {
    const used = new Set([correct]);
    const traps = [];

    function tryAdd(value) {
      if (used.has(value)) return;
      if (!isValidTrap(value, field, fact)) return;
      used.add(value);
      traps.push(value);
    }

    for (const value of trapCandidates(correct, field, fact)) {
      if (traps.length >= 2) break;
      tryAdd(value);
    }

    if (traps.length < 2) {
      const start = field === "d" ? 1 : field === "r" ? 0 : MIN_C;
      const end = field === "r" ? fact.i - 1 : 200;
      for (let value = start; value <= end; value++) {
        if (traps.length >= 2) break;
        tryAdd(value);
      }
    }

    return traps.slice(0, 2);
  }

  function buildQuestion(fact, form, field) {
    const { shuffle } = global.GameUtils;
    const correct = fact[field];
    const traps = pickTraps(correct, field, fact);
    const options = shuffle([String(correct), String(traps[0]), String(traps[1])]);

    return {
      fact,
      form,
      field,
      prompt: buildPrompt(fact, form, field),
      correct,
      options,
      correctIndex: options.indexOf(String(correct)),
    };
  }

  function createQuiz(config = {}) {
    const { randomInt, shuffle } = global.GameUtils;
    const ProgressDisplay = global.ProgressDisplay;

    let level = MIN_LEVEL;
    let questionCount = 0;
    let consecutiveCorrect = 0;
    let current = null;
    let gameCompleted = false;
    let orchestrator = null;

    // Faza E, sectiunea 12: orice quiz trebuie construit intern prin
    // SubquizOrchestrator (vezi bagare-sub-radical.js pt. explicatia completa
    // a tiparului — structura identica: `current` unificat, `pickNewQuestion()`
    // PURA). Fiecare punct care face `current = pickNewQuestion()` (mai jos:
    // `advanceLevel`, ramura din `dupaRaspunsCorect`, `beginRound`) cheama
    // sincronizarea explicit, imediat dupa.
    function sincronizeazaOrchestratorul() {
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: current?.prompt ?? "—",
        options: current ? [...current.options] : ["—", "—", "—"],
        correctIndex: current?.correctIndex ?? 0,
      });
    }

    function getLevelLabel(targetLevel = level) {
      return `Nivel ${targetLevel} · împărțitor ${divisorForLevel(targetLevel)}`;
    }

    function getLevelButtonTitle(targetLevel) {
      return `Nivel ${targetLevel}: împărțitor ${divisorForLevel(targetLevel)}`;
    }

    function resetLevelState() {
      questionCount = 0;
      consecutiveCorrect = 0;
      current = null;
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

    function pickNewQuestion() {
      const fact = generateFact(level);
      const form = randomInt(0, 1) === 0 ? FORM_COLON : FORM_STAR;
      const field = FIELDS[randomInt(0, FIELDS.length - 1)];
      return buildQuestion(fact, form, field);
    }

    function advanceLevel(via) {
      if (level >= MAX_LEVEL) {
        gameCompleted = true;
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          gameComplete: true,
          flash: "win",
          banner: "Felicitări! Ai terminat toate nivelele!",
          message: "Felicitări! Ai terminat toate nivelele!",
          ...roundView(),
        };
      }

      level += 1;
      resetLevelState();
      current = pickNewQuestion();
      sincronizeazaOrchestratorul();

      const message =
        via === "streak"
          ? "5 corecte consecutive! Next level!"
          : "21 întrebări! Next level!";

      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        levelAdvanced: true,
        flash: "win",
        banner: getLevelLabel(),
        message,
        nextRound: roundView(),
      };
    }

    // Motor 3 butoane (M3B) — vezi documente de referinta/PLAN-motor-comun-raspuns.md.
    // CORECTIE INTENTIONATA fata de comportamentul dinainte de migrare
    // (Categoria 4 din FAZA-A-inventar-contract.md, la fel ca la
    // bagare-sub-radical.js): inainte, un raspuns gresit sarea la o intrebare
    // noua (varianta "retry" cu forma opusa, apoi o intrebare complet noua) —
    // asta incalca regula universala. Acum gresit ramane pe ACEEASI intrebare
    // (comportamentul implicit din M3B), fara variante "retry" separate.
    // A doua corectie (Categoria 6): `questionCount` (pragul de 21) numara azi
    // la FIECARE apasare, inclusiv gresite — dupa migrare numara doar la
    // raspunsuri REZOLVATE (corecte), pragul de 21 ramane neschimbat.
    // Faza E, sectiunea 12: invelit intr-un SubquizOrchestrator (o singura
    // bucata "baza"). Spre deosebire de sub-sau-langa-radical.js/
    // bagare-sub-radical.js, `dupaRaspunsCorect` intorcea deja mereu comanda
    // explicita pe toate cele 3 ramuri — `intrebareUrmatoare` (`() => null`)
    // ramane cod mort neatins, ca la primele 4 fisiere.
    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "base",
        title: "baza",
        hintMessage: HINT,
        esteCorect: (_item, index) => Number(current.options[index]) === current.correct,
        generator: () => ({}),
        mesaje: {
          gresit: () => "Nu e corect. Mai încearcă!",
        },
        actiuni: {
          dupaApasare: (ctx) => {
            if (!ctx.corect) {
              consecutiveCorrect = 0;
            }
            return {};
          },
          dupaRaspunsCorect: () => {
            questionCount += 1;

            if (questionCount >= QUESTIONS_PER_LEVEL) {
              return { action: "continue", view: advanceLevel("count") };
            }

            consecutiveCorrect += 1;

            if (consecutiveCorrect >= CONSECUTIVE_NEEDED) {
              return { action: "continue", view: advanceLevel("streak") };
            }

            current = pickNewQuestion();
            sincronizeazaOrchestratorul();
            return {
              action: "continue",
              view: {
                outcome: "step-correct",
                correct: true,
                bounce: true,
                message: "Corect!",
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

    return {
      getQuizId: () => config.quizId ?? QUIZ_ID,
      getLevel: () => level,
      getMinLevel: () => MIN_LEVEL,
      getMaxLevel: () => MAX_LEVEL,
      getLevelLabel: () => getLevelLabel(level),
      getLevelButtonTitle,

      getProgressDisplay() {
        const percent = Math.round((questionCount / QUESTIONS_PER_LEVEL) * 100);
        return {
          green: ProgressDisplay.greenPercent(Math.min(100, percent)),
          red: ProgressDisplay.redNone(),
        };
      },

      isCompleted: () => gameCompleted,
      setCompleted: (value) => {
        gameCompleted = Boolean(value);
      },

      resetLevelState,

      switchLevel(nextLevel) {
        level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        gameCompleted = false;
        resetLevelState();
        return null;
      },

      pickNextRound() {
        return pickNewQuestion();
      },

      placeholderRaspuns: global.PlaceholderRaspuns.creeaza("?"),
      beginRound(next) {
        current = next ?? pickNewQuestion();
        sincronizeazaOrchestratorul();
        return roundView();
      },

      onTimeout() {
        return {
          outcome: "round",
          resetFall: true,
          ...roundView(),
        };
      },

      // Migrat la Motor3Butoane (Faza D, lotul 2) — vezi corectiile de
      // comportament (Categoria 4 si 6) la constructia lui `baseDefinition`,
      // mai sus. Invelit in SubquizOrchestrator (Faza E, sectiunea 12).
      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },
    };
  }

  global.DivisionWithRemainderQuiz = { create: createQuiz };

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: "Impartiri cu rest 1-10",
    description:
      "Împărțiri cu rest: d:i=c rest r și d=i*c+r. Niveluri 2–10, 21 răspunsuri sau 5 corecte la rând.",
    order: -4,
    gestionareGreseli: { activ: false },
    create(meta) {
      return global.DivisionWithRemainderQuiz.create({ quizId: meta.id });
    },
  });
})(window);
