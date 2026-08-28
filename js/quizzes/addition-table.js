(function (global) {
  "use strict";

  const MAX_LEVEL = 10;
  const REPLAY_CHANCE = 0.65;
  const RUN_DELAY_MS = 500;
  const CORRECT_PROMPT_HOLD_MS = 160;
  const MIX_CONFIG = {
    unknown: 1,
    weak: 1,
    fragile: 2,
    strong: 1,
  };
  const BUCKET_ORDER = ["unknown", "weak", "fragile", "strong"];
  const RECENT_WINDOW = 4;
  const ACTIVE_POOL_SIZE = Object.values(MIX_CONFIG).reduce((sum, count) => sum + count, 0);

  function getAdditionFastResponseMs(fact) {
    const { a, b, result } = fact.values;
    const maxOperand = Math.max(a, b);
    return 1400 + result * 90 + maxOperand * 50;
  }

  const FACT_STATS_CONFIG = {
    getFastResponseMs: getAdditionFastResponseMs,
  };

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
    let orchestrator = null;
    const recentQuestionIds = [];
    const recentChosenBuckets = [];

    // Faza E, sectiunea 12: orice quiz trebuie construit intern prin
    // SubquizOrchestrator, chiar unul "simplu" ca asta. `beginFactRound`
    // gestioneaza `currentFact`/`options` direct (tiparul stabilit deja) —
    // orchestratorul e pornit O SINGURA DATA, la construirea quiz-ului (mai
    // jos), cu un `generator` gol care nu se mai cheama niciodata dupa aia
    // (`dupaRaspunsCorect` intoarce mereu o comanda explicita). De-aici incolo,
    // `currentFact`/`options` si itemul orchestratorului sunt tinute sincron
    // printr-un singur apel neconditionat, ori de cate ori se schimba.
    function sincronizeazaOrchestratorul() {
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: currentFact?.prompt ?? "—",
        options: [...options],
        correctIndex,
      });
    }

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

    function pushRecent(list, value, limit = ACTIVE_POOL_SIZE) {
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

    function getFactSummaryMap(facts) {
      const map = new Map();
      facts.forEach((fact) => {
        map.set(
          fact.factId,
          FactStats.getFactSummary(FactStore.getFact(fact.factId, fact) ?? fact, FACT_STATS_CONFIG)
        );
      });
      return map;
    }

    function getFactBucket(fact, summary) {
      if (!summary || summary.knowledgeLevel === FactStats.KNOWLEDGE_LEVEL.NOU) {
        return "unknown";
      }
      if (
        summary.knowledgeLevel === FactStats.KNOWLEDGE_LEVEL.PRAF ||
        summary.knowledgeLevel === FactStats.KNOWLEDGE_LEVEL.SLAB
      ) {
        return "weak";
      }
      if (summary.knowledgeLevel === FactStats.KNOWLEDGE_LEVEL.CORECT_DAR_LENT) {
        return "fragile";
      }
      return "strong";
    }

    function addBucketFacts(pool, grouped, bucket, count) {
      const source = grouped[bucket] || [];
      let added = 0;
      for (const fact of source) {
        if (added >= count) break;
        if (!pool.some((item) => item.factId === fact.factId)) {
          pool.push(fact);
          added++;
        }
      }
    }

    function fillRemainingPool(pool, grouped) {
      for (const bucket of BUCKET_ORDER) {
        for (const fact of grouped[bucket]) {
          if (pool.length >= ACTIVE_POOL_SIZE) return;
          if (!pool.some((item) => item.factId === fact.factId)) {
            pool.push(fact);
          }
        }
      }
    }

    function groupFactsByBucket(facts, summaryMap) {
      const grouped = {
        unknown: [],
        weak: [],
        fragile: [],
        strong: [],
      };

      facts.forEach((fact) => {
        const bucket = getFactBucket(fact, summaryMap.get(fact.factId));
        grouped[bucket].push(fact);
      });

      BUCKET_ORDER.forEach((bucket) => {
        grouped[bucket].sort(compareFactsByDifficulty);
      });

      return grouped;
    }

    function buildActivePool(facts, summaryMap) {
      const grouped = groupFactsByBucket(facts, summaryMap);
      const pool = [];

      addBucketFacts(pool, grouped, "unknown", MIX_CONFIG.unknown);
      addBucketFacts(pool, grouped, "weak", MIX_CONFIG.weak);
      addBucketFacts(pool, grouped, "fragile", MIX_CONFIG.fragile);
      addBucketFacts(pool, grouped, "strong", MIX_CONFIG.strong);
      fillRemainingPool(pool, grouped);

      return pool.slice(0, ACTIVE_POOL_SIZE);
    }

    function countRecentBuckets() {
      const counts = {
        unknown: 0,
        weak: 0,
        fragile: 0,
        strong: 0,
      };

      recentChosenBuckets.slice(-ACTIVE_POOL_SIZE).forEach((bucket) => {
        if (counts[bucket] != null) counts[bucket]++;
      });

      return counts;
    }

    function chooseBucket(grouped) {
      const counts = countRecentBuckets();
      const candidates = [];

      BUCKET_ORDER.forEach((bucket) => {
        if (!grouped[bucket].length) return;
        const need = MIX_CONFIG[bucket] - counts[bucket];
        if (need > 0) {
          candidates.push({
            bucket,
            need,
            fact: grouped[bucket][0],
          });
        }
      });

      if (!candidates.length) {
        BUCKET_ORDER.forEach((bucket) => {
          if (!grouped[bucket].length) return;
          candidates.push({
            bucket,
            need: 0,
            fact: grouped[bucket][0],
          });
        });
      }

      candidates.sort((left, right) => {
        const difficultyDelta = compareFactsByDifficulty(left.fact, right.fact);
        if (difficultyDelta !== 0) return difficultyDelta;
        return BUCKET_ORDER.indexOf(left.bucket) - BUCKET_ORDER.indexOf(right.bucket);
      });

      return candidates[0]?.bucket ?? "strong";
    }

    function pickEasiestFact(bucketFacts) {
      const sorted = [...bucketFacts].sort(compareFactsByDifficulty);
      const blockedIds = new Set(recentQuestionIds.slice(-RECENT_WINDOW));
      const fresh = sorted.filter((fact) => !blockedIds.has(fact.factId));
      const source = fresh.length ? fresh : sorted;
      if (!source.length) return null;

      const TOP_K = 5;
      const pool = source.slice(0, Math.min(TOP_K, source.length));
      return pool[randomInt(0, pool.length - 1)];
    }

    function chooseNextQuestion() {
      const facts = levelFacts().filter((fact, _, allFacts) => {
        if (allFacts.length <= 1) return true;
        return fact.factId !== lastFactId;
      });
      const summaryMap = getFactSummaryMap(facts);
      const activePool = buildActivePool(facts, summaryMap);
      const grouped = groupFactsByBucket(activePool, summaryMap);
      const seenCount = levelFacts().filter((fact) => {
        const stored = FactStore.getFact(fact.factId, fact);
        return Boolean(stored?.totals?.attempts);
      }).length;
      const minSeenForMix = Math.min(ACTIVE_POOL_SIZE, levelFacts().length);

      if (seenCount < minSeenForMix && grouped.unknown.length) {
        const fact = pickEasiestFact(grouped.unknown);
        return {
          fact,
          combo: null,
          bucket: "unknown",
          difficultyScore: fact ? getDifficultyScore(fact) : null,
        };
      }

      const bucket = chooseBucket(grouped);
      const fact = pickEasiestFact(grouped[bucket] || []);

      if (fact) {
        return {
          fact,
          combo: null,
          bucket,
          difficultyScore: getDifficultyScore(fact),
        };
      }

      const fallback = pickEasiestFact(facts);
      return {
        fact: fallback ?? facts.sort(compareFactsByDifficulty)[0],
        combo: null,
        bucket: "strong",
        difficultyScore: fallback ? getDifficultyScore(fallback) : null,
      };
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

    function canAdvanceNow() {
      return mistakes.canAdvanceLevel(progressOpts());
    }

    function pickRoundStart() {
      const combo = pickReplayCombo();
      if (combo) return { fact: factFromCombo(combo), combo };
      return chooseNextQuestion();
    }

    function beginFactRound(fact, combo, bucket) {
      currentFact = FactCatalog.createFact(fact);
      activeComboTrap = null;
      buildOptionsForFact(currentFact, combo);
      lastFactId = currentFact.factId;
      pushRecent(recentQuestionIds, currentFact.factId, RECENT_WINDOW);
      if (bucket) pushRecent(recentChosenBuckets, bucket, ACTIVE_POOL_SIZE);
      else {
        const summary = FactStats.getFactSummary(
          FactStore.getFact(currentFact.factId, currentFact) ?? currentFact,
          FACT_STATS_CONFIG
        );
        pushRecent(recentChosenBuckets, getFactBucket(currentFact, summary), ACTIVE_POOL_SIZE);
      }
      sincronizeazaOrchestratorul();
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

    // Motor3Butoane apeleaza actiunile ca functii simple, fara `this` legat de
    // obiectul quizului — de-asta `finishSolvedFact` foloseste `quizApi`
    // (setat imediat dupa ce obiectul e construit, mai jos) in loc de
    // `this.beginRound(...)`, cum era in versiunea dinainte de migrare.
    function finishSolvedFact() {
      mistakes.noteRunFlawless();

      if (canAdvanceNow() && level >= MAX_LEVEL) {
        gameCompleted = true;
        return {
          outcome: "serie-terminata",
          correct: true,
          serie_terminata: true,
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
          outcome: "serie-terminata",
          correct: true,
          serie_terminata: true,
          levelAdvanced: true,
          flash: "win",
          banner: "Felicitări! Next level!",
          message: `Corect! ${currentFact.values.a}+${currentFact.values.b}=${currentFact.correctAnswer}`,
          nextRound: quizApi.beginRound(next),
        };
      }

      const next = pickRoundStart();
      return {
        outcome: "serie-terminata",
        correct: true,
        serie_terminata: true,
        pauza_intre_serii_ms: RUN_DELAY_MS,
        message: `Corect! ${currentFact.values.a}+${currentFact.values.b}=${currentFact.correctAnswer}`,
        nextRound: quizApi.beginRound(next),
      };
    }

    // Motor 3 butoane (M3B) — vezi documente de referinta/PLAN-motor-comun-raspuns.md.
    // Regula unica: corect avanseaza, gresit ramane pe aceeasi intrebare, fara
    // limita de incercari. Fapt important pt acest quiz: fiecare fapt rezolvat
    // e propriul lui "run" (outcome mereu "serie-terminata", niciodata simplul
    // "step-correct") — de-asta rezultatul complet vine din `dupaRaspunsCorect`,
    // nu din `intrebareUrmatoare` (neatinsa aici, nu se cheama niciodata).
    //
    // Faza E, sectiunea 12: invelit intr-un SubquizOrchestrator (o singura
    // bucata "baza", push/pop/exit nu se folosesc). Motorul comun normalizeaza
    // `options` la STRING-uri (`ItemGenerator.normalizeItem`) — dar `options`
    // proprii ale quiz-ului raman NUMERE (`applyOptionsTriple` face `.map(Number)`)
    // si `isResolvedCombo`/`combo.correct` compara strict (`===`) cu un numar.
    // De-asta `dupa_turn_apasare`/`dupaRaspunsCorect` citesc `options[ctx.index]`
    // direct din closure (numarul original), NU `ctx.alesul` (ar fi string-ul
    // normalizat de motor) — altfel comparatia stricta ar pica mereu tacut.
    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "base",
        title: "baza",
        hintMessage: "Alege suma corectă.",
        esteCorect: (_item, index) => options[index] === currentFact.correctAnswer,
        // Nu se cheama niciodata dupa pornirea initiala (vezi mai sus) —
        // `currentFact`/`options` sunt gestionate direct de `beginFactRound`,
        // sincronizate separat.
        generator: () => ({}),
        mesaje: {
          gresit: (ctx) =>
            `${currentFact.prompt.replace("=?", "")} nu este ${options[ctx.index]}. Încearcă din nou!`,
        },
        actiuni: {
          dupa_turn_apasare: (ctx) => {
            const alesul = options[ctx.index];
            recordAttempt(ctx.corect, alesul, ctx.meta);
            if (!ctx.corect) {
              mistakes.recordMistake(buildMistakePayload(currentFact, alesul));
            }
            return { divisionHistory: [] };
          },
          dupaRaspunsCorect: (ctx) => {
            const alesul = options[ctx.index];
            if (isResolvedCombo(activeComboTrap, currentFact, alesul)) {
              mistakes.resolveCombo(activeComboTrap);
            }

            const correctAnswer = currentFact.correctAnswer;
            const promptWithAnswerText = currentFact.prompt.includes("=?")
              ? currentFact.prompt.replace("=?", `=${correctAnswer}`)
              : currentFact.prompt.replace("?", String(correctAnswer));
            const promptWithAnswerHtml = currentFact.prompt.includes("=?")
              ? currentFact.prompt.replace("=?", `=<span class="q-correct">${correctAnswer}</span>`)
              : currentFact.prompt.replace("?", `<span class="q-correct">${correctAnswer}</span>`);

            const rezultat = finishSolvedFact();
            rezultat.prompt = promptWithAnswerText;
            rezultat.promptHtml = promptWithAnswerHtml;
            rezultat.options = options;
            rezultat.correctIndex = correctIndex;
            rezultat.hintMessage = "";
            rezultat.levelAdvanced = false;
            rezultat.pauza_intre_serii_ms = CORRECT_PROMPT_HOLD_MS;

            return { action: "continue", view: rezultat };
          },
        },
      });
    }

    orchestrator = global.SubquizOrchestrator.create({
      definitions: [baseDefinition()],
      activeSubquizIds: ["base"],
      context: { quizId: "addition-table" },
    });
    orchestrator.startFirst();

    const quizApi = {
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getLevelLabel: () => getLevelLabel(level),
      getLevelButtonTitle,
      getProgress: () => mistakes.getProgressView(progressOpts()),

      getProgressDisplay() {
        return ProgressDisplay.fromMistakeProgress(mistakes.getProgressView(progressOpts()));
      },
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
        recentQuestionIds.length = 0;
        recentChosenBuckets.length = 0;
      },

      switchLevel(nextLevel) {
        level = nextLevel;
        gameCompleted = false;
        this.resetLevelState();
      },

      placeholderRaspuns: global.PlaceholderRaspuns.creeaza("?"),
      laSchimbareDeNivel: global.SchimbareDeNivel.standard(),
      beginRound({ fact, combo, bucket } = pickRoundStart()) {
        mistakes.startRun();
        return beginFactRound(fact, combo, bucket);
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
    id: "addition-table",
    title: "Tabla adunarii - Clasic - 1_10+1_10",
    description: "Alege suma corectă pentru adunările din tabla 1..10.",
    order: -10,
    gestionareGreseli: { activ: true, nrRepetariPtRecuperare: 2 },
    create: createAdditionTableQuiz,
  });
})(window);
