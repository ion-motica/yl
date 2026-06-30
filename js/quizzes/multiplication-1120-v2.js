(function (global) {
  "use strict";

  // ── Quiz „T*/ 11-20 v2" ────────────────────────────────────────────────────────
  // BUCATA 1 — DOAR mod „test anchors". Fără eff, fără mastery, fără avansare
  // nivel, fără faze 2–3. Reset la reload (fără persistență, fără progres vizual).
  //
  // Nivel L → factor fix A = 10 + L (nivel 1 = 11×, …, nivel 10 = 20×).
  // Anchor: B ∈ {2,3,4,5,15}, în equation forms (× și ÷), cu răspuns numeric.

  const MIN_LEVEL = 1;
  const MAX_LEVEL = 10;
  const ANCHORS = [2, 3, 4, 5, 15];
  const HINT = "Alege răspunsul corect.";

  const QF_PROFILE = {
    f1_initial: true,
    f1_comutat: true,
    f1_complementar: true,
    f1_complementar_comutat: true,
    doua_nr_in_STANGA: true,
    doua_nr_in_DREAPTA: true,
    trei_pozitii_pt_cate_un_numar: true,
    doua_pozitii_pt_cate_un_semn_operator_matematic: false,
  };

  function factorForLevel(level) {
    return 10 + level;
  }

  function formatMs(ms) {
    if (ms == null || !Number.isFinite(ms)) return "—";
    return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  }

  // Distractori cu aceeași ultimă cifră ca răspunsul corect (capcane).
  // Funcționează și pentru produse și pentru câturi.
  function sameLastDigitOptions(correctNum, shuffle) {
    const correct = Number(correctNum);
    const lastDigit = ((correct % 10) + 10) % 10;
    const used = new Set([correct]);
    const candidates = [];

    function tryAdd(v) {
      if (!Number.isFinite(v) || v <= 0) return;
      if (((v % 10) + 10) % 10 !== lastDigit) return;
      if (used.has(v)) return;
      used.add(v);
      candidates.push(v);
    }

    for (let k = 1; k <= 15; k++) {
      tryAdd(correct - 10 * k);
      tryAdd(correct + 10 * k);
    }
    // Pentru câturi mici (ex. 2,3,4) vecinii ±10 pot să nu existe → fallback ±1/±2.
    for (let d = 1; d <= 2; d++) {
      tryAdd(correct - d);
      tryAdd(correct + d);
    }

    candidates.sort((a, b) => Math.abs(a - correct) - Math.abs(b - correct));
    const distract = [];
    for (const v of candidates) {
      distract.push(v);
      if (distract.length >= 2) break;
    }
    while (distract.length < 2) {
      distract.push(correct + 10 * (distract.length + 1));
    }

    const options = shuffle([String(correct), String(distract[0]), String(distract[1])]);
    return { options, correctIndex: options.indexOf(String(correct)) };
  }

  function createQuiz(config) {
    const quizId = config.quizId;
    const { randomInt, shuffle } = global.GameUtils;
    const QFG = global.QFGenerator;
    const Catalog = global.FactCatalog;

    const qfTypes = QFG.getActiveQFTypes(QF_PROFILE).filter((t) => t.answerType === "number");

    const QUESTIONS_PER_LEVEL = 36;
    const FAST_MS = 1500; // ≤ 1.5s → highlight
    const INTENSIV_QUESTIONS = 10; // întrebări în modul intensiv, apoi revine la anchor

    let level = MIN_LEVEL;
    let mode = "anchor";      // "anchor" | "intensiv"
    let wrongFacts = [];      // facts ancoră greșite (distincte) în anchor test
    let factsLucrateIntensiv = []; // facts antrenate în (ultimul) intensiv, pt. panou
    let intensivFacts = [];   // cele 2 facts (B) lucrate în intensivul curent
    let intensivCount = 0;    // câte întrebări intensive au fost rezolvate (0..10)
    let lastCorrectByB = {};  // { [b]: responseMs } — timpul ultimului răspuns corect / fact
    let answeredCount = 0;    // răspunsuri corecte în nivelul curent (spre 36)
    let anchorQueue = [];     // ancorele rămase în tura curentă (ordine mic → mare cu variație)
    let recentFactorFlags = [];
    let current = null;

    // ≤ 1 răspuns == A la fiecare 5 întrebări (plafon 11×).
    function factorCapHit() {
      return recentFactorFlags.slice(-4).filter(Boolean).length >= 1;
    }

    function noteFactorFlag(isFactor) {
      recentFactorFlags.push(Boolean(isFactor));
      if (recentFactorFlags.length > 5) recentFactorFlags.shift();
    }

    function makeFact(b) {
      return Catalog.createFact({
        operation: "mul",
        values: { a: factorForLevel(level), b },
      });
    }

    function factLabel(b) {
      return `${b}×${factorForLevel(level)}=?`;
    }

    // O „tură" trece prin TOATE ancorele exact o dată, în ordine ascendentă cu
    // o mică variație aleatoare (schimbăm uneori două vecine). Garantează că
    // toate {2,3,4,5,15} apar (inclusiv 15) și că nu rămânem blocați pe un B.
    function buildAnchorPass() {
      const order = [...ANCHORS].sort((a, b) => a - b);
      for (let i = 0; i < order.length - 1; i++) {
        if (randomInt(0, 1) === 0) {
          const tmp = order[i];
          order[i] = order[i + 1];
          order[i + 1] = tmp;
        }
      }
      return order;
    }

    function pickAnchorB() {
      if (!anchorQueue.length) anchorQueue = buildAnchorPass();
      return anchorQueue.shift();
    }

    // excludeFactor=true → nu punem niciodată întrebări al căror răspuns e chiar
    // factorul nivelului (ex. 11 la nivel 1 — banal). Folosit la modul intensiv.
    function buildQuestionForB(b, { excludeFactor = false } = {}) {
      const A = factorForLevel(level);
      const fact = makeFact(b);

      for (const t of shuffle(qfTypes)) {
        const r = QFG.renderQF(t, fact);
        if (!r || r.answerType !== "number") continue;
        const val = Number(r.correctAnswer);
        if (!Number.isFinite(val)) continue;
        if (val === A && (excludeFactor || factorCapHit())) continue;

        const opt = sameLastDigitOptions(val, shuffle);
        current = {
          factB: b,
          prompt: r.prompt,
          correct: val,
          options: opt.options,
          correctIndex: opt.correctIndex,
        };
        noteFactorFlag(val === A);
        return;
      }

      // Fallback dur: produsul direct.
      const val = A * b;
      const opt = sameLastDigitOptions(val, shuffle);
      current = {
        factB: b,
        prompt: `${A}*${b}=?`,
        correct: val,
        options: opt.options,
        correctIndex: opt.correctIndex,
      };
      noteFactorFlag(val === A);
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

    function nextAnchorQuestion() {
      buildQuestionForB(pickAnchorB());
      return roundView();
    }

    // Construiește întrebarea intensivă curentă: alternăm cele 2 facts greșite,
    // forme cu răspuns numeric, fără răspunsul banal == factorul nivelului.
    function buildIntensivQuestion() {
      const b = intensivFacts[intensivCount % intensivFacts.length];
      buildQuestionForB(b, { excludeFactor: true });
    }

    function resetLevelState() {
      mode = "anchor";
      wrongFacts = [];
      factsLucrateIntensiv = [];
      intensivFacts = [];
      intensivCount = 0;
      lastCorrectByB = {};
      answeredCount = 0;
      anchorQueue = [];
      recentFactorFlags = [];
      current = null;
    }

    function advanceLevel() {
      global.alert?.("ai raspuns la 36 de intrebari, next level");
      level = Math.min(MAX_LEVEL, level + 1);
      resetLevelState();
      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        levelAdvanced: true,
        flash: "win",
        banner: `Nivel ${level} · ${factorForLevel(level)}×`,
        message: `Nivel ${level}`,
        nextRound: nextAnchorQuestion(),
      };
    }

    function onAnswer(index, meta = {}) {
      const cur = current;
      const chosen = cur.options[index];
      const isCorrect = Number(chosen) === Number(cur.correct);

      // ── MOD INTENSIV ───────────────────────────────────────────────────────
      // Instrument de antrenament (NU mastery): 10 întrebări pe cele 2 facts
      // greșite, alternate. Greșelile sunt IGNORATE — avansăm indiferent de
      // corect/greșit. La final revenim la anchor; contorul de 36 NU e atins.
      if (mode === "intensiv") {
        intensivCount++;
        if (intensivCount >= INTENSIV_QUESTIONS) {
          mode = "anchor";
          return {
            outcome: "step-correct",
            correct: true,
            bounce: true,
            message: "Înapoi la test anchors.",
            ...nextAnchorQuestion(),
          };
        }
        buildIntensivQuestion();
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Intensiv ${intensivCount + 1}/${INTENSIV_QUESTIONS}`,
          ...roundView(),
        };
      }

      // ── ANCHOR TEST ────────────────────────────────────────────────────────
      if (!isCorrect) {
        if (!wrongFacts.some((w) => w.b === cur.factB)) {
          wrongFacts.push({ b: cur.factB, label: factLabel(cur.factB) });
        }

        // 2 facts DISTINCTE greșite → intrăm efectiv în modul intensiv.
        if (wrongFacts.length >= 2) {
          intensivFacts = wrongFacts.map((w) => w.b);
          factsLucrateIntensiv = wrongFacts.map((w) => w.label);
          wrongFacts = [];
          mode = "intensiv";
          intensivCount = 0;
          buildIntensivQuestion(); // prima întrebare intensivă (fact #0)
          return {
            outcome: "step-correct",
            correct: true,
            bounce: true,
            flash: "wrong",
            message: `Mod intensiv: antrenament pe ${factsLucrateIntensiv.join(", ")}`,
            ...roundView(),
          };
        }

        // Aceeași întrebare, reîncearcă. NU reconstruim întrebarea: motorul nu
        // re-randează la greșeală (doar taie butonul greșit), deci o întrebare
        // nouă ar deveni vizibilă abia la următoarea randare (când cade bara),
        // dând impresia că „se schimbă întrebarea la timeout".
        return {
          outcome: "wrong-answer",
          correct: false,
          flash: "wrong",
          message: `${chosen} nu e bun. Mai încearcă!`,
          ...roundView(),
        };
      }

      lastCorrectByB[cur.factB] = meta.responseMs ?? null;
      answeredCount++;
      if (answeredCount >= QUESTIONS_PER_LEVEL) return advanceLevel();

      // Avans IMEDIAT la întrebarea următoare (fără finishRun/delay). Cronometrul
      // e corect: nextAnchorQuestion() face o întrebare nouă, iar renderRound îi
      // vede semnătura schimbată și resetează roundStartedAt.
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: "Corect!",
        ...nextAnchorQuestion(),
      };
    }

    // Bară cade / timeout → IGNORAT complet: reset bară, aceeași întrebare,
    // fără numărare greșeli.
    function onTimeout() {
      return {
        outcome: "round",
        resetFall: true,
        ...roundView(),
      };
    }

    return {
      getQuizId: () => quizId,
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getMinLevel: () => MIN_LEVEL,
      getLevelLabel: () => `Nivel ${level} · ${factorForLevel(level)}× ancore`,
      getLevelButtonTitle: (lv) => `Nivel ${lv}: ${factorForLevel(lv)}× ancore`,
      isCompleted: () => false,

      getProgressDisplay: () => global.ProgressDisplay.hidden(),

      getInfo11_20() {
        const A = factorForLevel(level);
        return {
          visible: true,
          mode: mode === "intensiv" ? "intensiv" : "test anchors",
          wrongFactsText: wrongFacts.length
            ? wrongFacts.map((w) => w.label).join(", ")
            : "—",
          intensivText: factsLucrateIntensiv.length
            ? factsLucrateIntensiv.join(", ")
            : "—",
          answeredText: `${answeredCount} / ${QUESTIONS_PER_LEVEL}`,
          facts: ANCHORS.map((b) => {
            const ms = b in lastCorrectByB ? lastCorrectByB[b] : null;
            return {
              label: `${b}×${A}`,
              timeText: b in lastCorrectByB ? formatMs(ms) : "-",
              fast: ms != null && ms <= FAST_MS,
            };
          }),
        };
      },

      switchLevel(nextLevel) {
        level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        resetLevelState();
        return null;
      },

      pickNextRound() {
        return nextAnchorQuestion();
      },

      beginRound(next) {
        return next ?? nextAnchorQuestion();
      },

      onAnswer,
      onTimeout,
    };
  }

  global.Mul1120V2Quiz = { create: createQuiz };

  global.QuizRegistry.register({
    id: "multiplication-1120-v2",
    title: "T*/ 11-20 v2",
    description: "Înmulțirea 11–20: BUCATA 1 — doar test ancore.",
    order: 2,
    gestionareGreseli: { activ: false },
    create(meta) {
      return global.Mul1120V2Quiz.create({ quizId: meta.id });
    },
  });
})(window);
