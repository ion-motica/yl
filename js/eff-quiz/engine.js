(function (global) {
  "use strict";

  const DEFAULTS = {
    MIN_LEVEL: 1,
    MAX_LEVEL: 20,
    MAX_SERIES_LENGTH: 5,
    HINT_MESSAGE: "Alege răspunsul corect pentru ?.",
    TIMEOUT_MESSAGE: "Prea târziu! Încearcă din nou.",
    GAME_COMPLETE_BANNER: "Felicitări! Ai terminat nivelul 20!",
    LEVEL_ADVANCED_BANNER: "Felicitări! Nivel următor!",
  };

  function createEFFQuiz(config) {
    const quizId     = config.quizId;
    const adapter    = config.adapter;
    const minLevel   = config.minLevel   ?? DEFAULTS.MIN_LEVEL;
    const maxLevel   = config.maxLevel   ?? DEFAULTS.MAX_LEVEL;
    const MAX_SERIES = config.maxSeriesLength ?? DEFAULTS.MAX_SERIES_LENGTH;
    const HINT       = config.hintMessage    ?? DEFAULTS.HINT_MESSAGE;
    const TIMEOUT_MSG= config.timeoutMessage ?? DEFAULTS.TIMEOUT_MESSAGE;
    const COMPLETE_BNR=config.gameCompleteBanner  ?? DEFAULTS.GAME_COMPLETE_BANNER;
    const ADV_BNR    = config.levelAdvancedBanner ?? DEFAULTS.LEVEL_ADVANCED_BANNER;
    const getLayoutSwapped =
      config.getLayoutSwapped ?? (() => global.getLayoutSwapped?.() ?? false);

    const { shuffle } = global.GameUtils;
    const QFG = global.QFGenerator;
    const prof= global.EFFProfileStore;
    const reg = global.EFFMistakeRegistry;

    let level         = minLevel;
    let gameCompleted = false;

    let profile       = prof.getProfile(quizId);
    let activeQFTypes = QFG.getActiveQFTypes(profile);
    let usedQFTypeIds = new Set();

    // ── Series state ────────────────────────────────────────────────────────────

    let seriesType        = "A";   // "A" | "B"
    let currentQFType     = null;  // tipul QF fix în Seria A
    let activeQueue       = [];    // [{factId, qfTypeId}]
    let wrongQueue        = [];
    let phase             = "main"; // "main" | "retry"
    let seriesHadMistakes = false;

    let levelPerfectSeriesADone = false;

    let currentFact  = null;
    let currentBuilt = null;
    let options      = [];
    let correctIndex = 0;

    let seriesHistory = [];  // [{prompt, answer}] pt seria curentă

    let levelPool = [];
    let orchestrator = null;

    // Faza E, sectiunea 12: orice quiz trebuie construit intern prin
    // SubquizOrchestrator (vezi conexe-table-quiz/engine.js pt. explicatia
    // completa a tiparului — fisier-frate, aceeasi solutie). `beginCurrentStep()`
    // e singurul loc care schimba `currentFact`/`currentBuilt`/`options`/
    // `correctIndex` — sincronizeaza neconditionat, chiar acolo, inainte de
    // fiecare `return roundView()`.
    function sincronizeazaOrchestratorul() {
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: currentBuilt?.prompt ?? "—",
        options: [...options],
        correctIndex,
      });
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    function rebuildPool() {
      levelPool = adapter.listLevelFacts(level);
    }

    function factById(id) {
      return levelPool.find((f) => f.factId === id) ?? null;
    }

    function qfTypeById(id) {
      return activeQFTypes.find((qt) => qt.id === id) ?? null;
    }

    function withResetFall(view) {
      return view && typeof view === "object" ? { resetFall: true, ...view } : view;
    }

    function roundView(extra = {}) {
      return {
        prompt: currentBuilt?.prompt ?? "—",
        options,
        correctIndex,
        divisionHistory: [],
        bondHistory: [],
        questionFormat: null,
        hintMessage: HINT,
        successionHistory: [...seriesHistory],
        ...extra,
      };
    }

    function getAamIllustration(state) {
      const aam = config.aam;
      if (!aam?.enabled) return null;

      const equation = state?.prompt ?? currentBuilt?.prompt;
      if (!equation || equation === "—") return null;

      return { enabled: true, equation };
    }

    const SIGN_OPTION_RE = /^[+\-*:=×÷<>]$/;

    function layoutSwapped() {
      return Boolean(config.aam?.enabled && getLayoutSwapped());
    }

    function promptHasZeroOperand(prompt) {
      if (!global.parseAamEquation) return true;
      try {
        const model = global.parseAamEquation(prompt);
        return model.values.a === 0 || model.values.b === 0 || model.values.c === 0;
      } catch {
        return true;
      }
    }

    function isSwapCompatibleQF(qfType, fact) {
      if (!layoutSwapped()) return true;
      const rendered = QFG.renderQF(qfType, fact);
      if (!rendered) return false;
      if (rendered.answerType !== "number") return false;
      if (promptHasZeroOperand(rendered.prompt)) return false;
      const built = QFG.buildOptions(qfType, fact, shuffle);
      if (!built) return false;
      return !built.options.some((o) => SIGN_OPTION_RE.test(String(o).trim()));
    }

    function advanceIfSwapIncompatible() {
      if (!layoutSwapped() || !activeQueue.length) return null;
      const item = activeQueue[0];
      const fact = factById(item?.factId);
      const qfType = qfTypeById(item?.qfTypeId);
      if (!fact || !qfType || isSwapCompatibleQF(qfType, fact)) return null;
      activeQueue.shift();
      return withResetFall(beginCurrentStep());
    }

    // ── QF type rotation ─────────────────────────────────────────────────────────

    function pickQFType(pool = activeQFTypes) {
      let available = pool.filter((qt) => !usedQFTypeIds.has(qt.id));
      if (!available.length) {
        usedQFTypeIds = new Set();
        available = [...pool];
      }
      if (!available.length) return null;
      const picked = shuffle(available)[0];
      usedQFTypeIds.add(picked.id);
      return picked;
    }

    // ── Fact selection ────────────────────────────────────────────────────────────

    function pickSeriesAFacts(qfType) {
      const pendingIds = new Set(reg.getPending(quizId, level));
      const valid = (f) =>
        QFG.renderQF(qfType, f) !== null && isSwapCompatibleQF(qfType, f);

      const mistakeFacts = shuffle(levelPool.filter((f) => pendingIds.has(f.factId) && valid(f)));
      const otherFacts   = shuffle(levelPool.filter((f) => !pendingIds.has(f.factId) && valid(f)));

      const combined = [...mistakeFacts];
      for (const f of otherFacts) {
        if (combined.length >= MAX_SERIES) break;
        combined.push(f);
      }
      return combined.slice(0, MAX_SERIES);
    }

    // Tipurile QF eligibile pentru Seria A: excludem relation_op (răspuns "=")
    // deoarece același fapt cu "=" e mereu corect → nu are sens în {same QF, diff facts}.
    function seriesAEligible() {
      return activeQFTypes.filter((qt) => qt.answerType !== "relation_op");
    }

    // Returnează true dacă faptele selectate produc cel puțin 2 răspunsuri distincte
    // pentru tipul QF dat. Serii cu răspuns unic (ex. a*?=c la nivel 14 → mereu 14)
    // sunt excluse din Seria A.
    function hasVariedAnswers(qfType, facts) {
      if (facts.length <= 1) return true;
      const seen = new Set();
      for (const f of facts) {
        const r = QFG.renderQF(qfType, f);
        if (r) seen.add(String(r.correctAnswer));
        if (seen.size > 1) return true;
      }
      return false;
    }

    // ── Series A ─────────────────────────────────────────────────────────────────

    function beginSeriesA() {
      seriesType        = "A";
      seriesHadMistakes = false;
      currentQFType     = null;
      seriesHistory     = [];

      const eligibleTypes = seriesAEligible();

      if (!eligibleTypes.length) {
        return roundView({
          hintMessage: "Activează cel puțin un tip EFF non-relațional din configurare (butonul ⚙).",
        });
      }

      let qfType = null;
      let facts  = [];
      let attempts = 0;

      while (!facts.length && attempts < eligibleTypes.length) {
        qfType = pickQFType(eligibleTypes);
        facts  = qfType ? pickSeriesAFacts(qfType) : [];
        if (facts.length && !hasVariedAnswers(qfType, facts)) facts = [];
        attempts++;
      }

      if (!facts.length) {
        return roundView({ hintMessage: "Nu există fapte valide pentru tipurile EFF active." });
      }

      currentQFType = qfType;
      activeQueue   = facts.map((f) => ({ factId: f.factId, qfTypeId: qfType.id }));
      wrongQueue    = [];
      phase         = "main";

      return beginCurrentStep();
    }

    // ── Series B ─────────────────────────────────────────────────────────────────

    function beginSeriesB(factId) {
      seriesType        = "B";
      seriesHadMistakes = false;
      currentQFType     = null;
      seriesHistory     = [];

      const fact = factById(factId);
      if (!fact) return beginSeriesA();

      const validTypes = activeQFTypes.filter(
        (qt) => isSwapCompatibleQF(qt, fact)
      );
      const picked     = shuffle(validTypes).slice(0, MAX_SERIES);

      if (!picked.length) return beginSeriesA();

      activeQueue = picked.map((qt) => ({ factId, qfTypeId: qt.id }));
      wrongQueue  = [];
      phase       = "main";

      return beginCurrentStep();
    }

    // ── Step logic ───────────────────────────────────────────────────────────────

    function beginCurrentStep() {
      while (activeQueue.length) {
        const item = activeQueue[0];
        const fact = factById(item.factId);
        const qfType = qfTypeById(item.qfTypeId);

        if (!fact || !qfType) {
          activeQueue.shift();
          continue;
        }
        if (!isSwapCompatibleQF(qfType, fact)) {
          activeQueue.shift();
          continue;
        }

        const built = QFG.buildOptions(qfType, fact, shuffle);
        if (!built) {
          activeQueue.shift();
          continue;
        }

        currentFact = fact;
        currentBuilt = built;
        options = built.options;
        correctIndex = built.correctIndex;
        sincronizeazaOrchestratorul();
        return roundView();
      }

      if (phase === "main" && wrongQueue.length) {
        phase = "retry";
        activeQueue = [...wrongQueue];
        wrongQueue = [];
        return withResetFall(beginCurrentStep());
      }
      return completeSeries();
    }

    // ── Series completion ─────────────────────────────────────────────────────────

    function completeSeries() {
      if (seriesType === "A") {
        if (!seriesHadMistakes) {
          levelPerfectSeriesADone = true;
        }

        const pending = reg.getPending(quizId, level);
        if (pending.length > 0) {
          return withResetFall(beginSeriesB(pending[0]));
        }

        if (canAdvanceLevel()) return advanceLevel();
        return withResetFall(beginSeriesA());
      }

      // Seria B
      if (canAdvanceLevel()) return advanceLevel();
      return withResetFall(beginSeriesA());
    }

    function canAdvanceLevel() {
      return levelPerfectSeriesADone && reg.allMastered(quizId, level);
    }

    function advanceLevel() {
      if (level >= maxLevel) {
        gameCompleted = true;
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          gameComplete: true,
          flash: "win",
          banner: COMPLETE_BNR,
          message: COMPLETE_BNR,
          ...roundView({ hintMessage: "" }),
        };
      }

      level++;
      resetForLevel();

      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        levelAdvanced: true,
        flash: "win",
        banner: ADV_BNR,
        message: `Felicitări! Nivel ${level}`,
        nextRound: beginSeriesA(),
      };
    }

    function resetForLevel() {
      rebuildPool();
      levelPerfectSeriesADone = false;
      usedQFTypeIds   = new Set();
      activeQueue     = [];
      wrongQueue      = [];
      currentFact     = null;
      currentBuilt    = null;
      currentQFType   = null;
      phase           = "main";
      seriesType      = "A";
      seriesHadMistakes = false;
    }

    // ── Answer handling ────────────────────────────────────────────────────────────

    function onStepCorrect() {
      reg.addCorrect(quizId, level, currentFact.factId);

      const promptText    = currentBuilt.prompt;
      const correctAnswer = currentBuilt.options[currentBuilt.correctIndex];
      seriesHistory.push({ prompt: promptText, answer: correctAnswer });
      activeQueue.shift();

      let next;
      if (activeQueue.length) {
        next = beginCurrentStep();
      } else if (phase === "main" && wrongQueue.length) {
        phase       = "retry";
        activeQueue = [...wrongQueue];
        wrongQueue  = [];
        next        = beginCurrentStep();
      } else {
        next = completeSeries();
      }

      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: `Corect! ${promptText}`,
        ...next,
      };
    }

    // Motor 3 butoane (M3B) — vezi documente de referinta/PLAN-motor-comun-raspuns.md.
    // Migrare pura: regula corect/gresit era deja conforma (gresit nu atinge
    // `currentFact`/`options`, ramane pe acelasi pas). Fosta `onStepWrong` a
    // fost stearsa — nu mai avea niciun apelant (nici `onTimeout`, spre
    // deosebire de conexe-table-quiz/engine.js, nu o folosea); efectele ei
    // secundare traiesc acum in `dupaApasare`, iar rezultatul vizual il
    // construieste M3B, prin `mesaje.gresit`. `dupaRaspunsCorect` cheama
    // direct `onStepCorrect` existenta, neschimbata.
    //
    // Faza E, sectiunea 12: invelit intr-un SubquizOrchestrator (o singura
    // bucata "baza"). `roundView()` are campuri proprii (`divisionHistory`,
    // `bondHistory`, `questionFormat`, `successionHistory`) absente din vederea
    // generica — ca la conexe-table-quiz/engine.js, `dupaApasare` intoarce
    // `roundView()` INTREG (nu campuri punctuale), exact ce facea implicit
    // vechiul `construiesteVedere: (extra) => ({...roundView(), ...extra})`.
    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "base",
        title: "baza",
        hintMessage: HINT,
        esteCorect: (_item, index) => index === correctIndex,
        generator: () => ({}),
        mesaje: {
          gresit: (ctx) => `${ctx.alesul ?? "?"} nu e corect. Încearcă din nou!`,
        },
        actiuni: {
          dupaApasare: (ctx) => {
            if (!ctx.corect) {
              if (seriesType === "A") {
                seriesHadMistakes = true;
                reg.addWrong(quizId, level, currentFact.factId);
              }
              const item = activeQueue[0];
              const dup = wrongQueue.some(
                (w) => w.factId === item?.factId && w.qfTypeId === item?.qfTypeId
              );
              if (!dup && item) wrongQueue.push(item);
            }
            return roundView();
          },
          dupaRaspunsCorect: () => {
            return { action: "continue", view: onStepCorrect() };
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

    // ── Init ────────────────────────────────────────────────────────────────────

    rebuildPool();

    // ── Public API ───────────────────────────────────────────────────────────────

    return {
      isEFFQuiz: true,

      getQuizId:           () => quizId,
      getLevel:            () => level,
      getMaxLevel:         () => maxLevel,
      getMinLevel:         () => minLevel,
      getLevelLabel:       () => adapter.getLevelLabel(level),
      getLevelButtonTitle: (lv) => adapter.getLevelButtonTitle(lv),
      isCompleted:         () => gameCompleted,

      getProgressDisplay() {
        const pending = reg.getPending(quizId, level);
        return {
          green: global.ProgressDisplay.greenStreak(
            levelPerfectSeriesADone ? 1 : 0,
            1
          ),
          red: pending.length
            ? global.ProgressDisplay.redCombos(
                pending.slice(0, 5).map((fid) => {
                  const entry = reg.getEntry(quizId, level, fid);
                  return {
                    resolved: entry?.correctCount ?? 0,
                    needed: 2,
                    title: `Restanță: ${fid}`,
                  };
                })
              )
            : global.ProgressDisplay.redNone(),
        };
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

      refreshProfile() {
        profile       = prof.getProfile(quizId);
        activeQFTypes = QFG.getActiveQFTypes(profile);
        usedQFTypeIds = new Set();
      },

      switchLevel(nextLevel) {
        level         = Math.min(maxLevel, Math.max(minLevel, nextLevel));
        gameCompleted = false;
        resetForLevel();
        return null;
      },

      pickNextRound() {
        resetForLevel();
        return beginSeriesA();
      },

      placeholderRaspuns: global.PlaceholderRaspuns.creeaza("?"),
      laSchimbareDeNivel: global.SchimbareDeNivel.standard(),
      beginRound(next) {
        return next ?? beginSeriesA();
      },

      onTimeout(meta = {}) {
        if (currentFact && seriesType === "A") {
          seriesHadMistakes = true;
          reg.addWrong(quizId, level, currentFact.factId);
        }
        const item = activeQueue[0];
        const dup  = wrongQueue.some(
          (w) => w.factId === item?.factId && w.qfTypeId === item?.qfTypeId
        );
        if (!dup && item) wrongQueue.push(item);

        return {
          outcome: "timeout",
          correct: false,
          flash: "wrong",
          message: TIMEOUT_MSG,
          resetFall: true,
          ...roundView({ hintMessage: "" }),
        };
      },

      // Migrat la Motor3Butoane (Faza D, lotul 3), invelit in SubquizOrchestrator
      // (Faza E, sectiunea 12) — vezi `baseDefinition`, mai sus.
      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },

      getAamIllustration,
      advanceIfSwapIncompatible,
    };
  }

  global.EFFQuiz = { create: createEFFQuiz };
})(window);
