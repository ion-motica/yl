(function (global) {
  "use strict";

  // ── Quiz „T*/ 11-20" ──────────────────────────────────────────────────────────
  // Înmulțirea 11–20 × 1–20, 10 niveluri (nivel L → factorul A = 10 + L).
  //
  // În fiecare nivel, faze STRICT în ordine (până înmulțirile sunt solide):
  //   A1 — ancore A×{1,2,3,4,5,10,15,20}, în equation forms (×).
  //        Gate: toate ancorele răspunse corect (ideal din prima) → A2.
  //   A2 — „cele rămase" A×{6,7,8,9,11,12,13,14,16,17,18,19}, equation forms (×).
  //   B  — serii de descompunere: B×A = ? + r×A  și  B×A = m×A + ?  (doar „+").
  //   C  — adunări rapide cu compensare/„trecere peste sută": X+Y = target+?.
  //
  // Avansare nivel: 21 de răspunsuri corecte în total (cumulat peste toate fazele).
  //
  // Reguli faza A:
  //   - faptele se introduc tinzând de la mic la mare, vecini la ±3 între ele;
  //   - la nivelul cu 11×, răspunsul cerut = factorul (11) în cel mult 1 din 5;
  //   - la 3 greșeli pornește un DRILL: doar faptele greșite, în forme variate
  //     (× ȘI ÷), ~10–15 întrebări; corectele din drill contează la cele 21.
  //
  // Distractori (peste tot): 3 numere apropiate care se TERMINĂ cu aceeași cifră
  // ca răspunsul corect (corect ± 10/±20…), ca să nu se ghicească după unitate.
  //
  // Fără persistență (reset la reload) și fără progres vizual (deocamdată).

  const MIN_LEVEL = 1;
  const MAX_LEVEL = 10;
  const CORRECT_TO_ADVANCE = 21;
  const MISTAKES_FOR_DRILL = 3;
  const DRILL_MIN = 10;
  const DRILL_MAX = 15;

  const ANCHORS = [1, 2, 3, 4, 5, 10, 15, 20];
  const REMAINING = [6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19];

  const HINT = "Alege răspunsul corect.";
  const TIMEOUT_MSG = "Prea târziu! Mai încearcă.";
  const COMPLETE_BANNER = "Felicitări! Ai terminat nivelul 10 (20×)!";

  // Profiluri QF: doar forme cu răspuns NUMERIC (fără poziții de semn).
  const MUL_PROFILE = {
    f1_initial: true,
    f1_comutat: true,
    f1_complementar: false,
    f1_complementar_comutat: false,
    doua_nr_in_STANGA: true,
    doua_nr_in_DREAPTA: true,
    trei_pozitii_pt_cate_un_numar: true,
    doua_pozitii_pt_cate_un_semn_operator_matematic: false,
  };
  const MULDIV_PROFILE = {
    ...MUL_PROFILE,
    f1_complementar: true,
    f1_complementar_comutat: true,
  };

  function factorForLevel(level) {
    return 10 + level;
  }

  function createQuiz(config) {
    const quizId = config.quizId;
    const { randomInt, shuffle } = global.GameUtils;
    const QFG = global.QFGenerator;
    const Catalog = global.FactCatalog;

    const mulTypes = QFG.getActiveQFTypes(MUL_PROFILE).filter(
      (t) => t.answerType === "number"
    );
    const drillTypes = QFG.getActiveQFTypes(MULDIV_PROFILE).filter(
      (t) => t.answerType === "number"
    );

    // ── Stare ──────────────────────────────────────────────────────────────────
    let level = MIN_LEVEL;
    let gameCompleted = false;

    let correctCount = 0; // spre cele 21
    let mistakeCount = 0; // spre drill
    let wrongFacts = new Set(); // B-uri greșite (pentru drill)

    let phase = "A1"; // A1 | A2 | B | C
    let coveredA1 = new Set(); // ancore răspunse corect
    let coveredA2 = new Set(); // rămase răspunse corect
    let coveredB = new Set(); // rămase acoperite în faza B
    let attempted = new Set(); // B-uri deja încercate (pt. „din prima")
    let firstTry = new Set(); // B-uri corecte din prima

    let drillActive = false;
    let drillRemaining = 0;
    let drillPool = [];

    let lastB = 0; // pentru mersul mic→mare ±3
    let decompToggle = false; // alternanță forme faza B
    let recentFactorFlags = []; // ultimele întrebări: răspunsul == factorul A?

    let current = null; // { phase, factB, prompt, correct, options, correctIndex, isFirstAttempt }
    let history = [];

    // ── Helpers ──────────────────────────────────────────────────────────────────

    function makeFact(b) {
      return Catalog.createFact({
        operation: "mul",
        values: { a: factorForLevel(level), b },
      });
    }

    function factorCapHit() {
      // ≤ 1 răspuns == A la fiecare 5 întrebări.
      return recentFactorFlags.slice(-4).filter(Boolean).length >= 1;
    }

    function noteFactorFlag(isFactor) {
      recentFactorFlags.push(Boolean(isFactor));
      if (recentFactorFlags.length > 5) recentFactorFlags.shift();
    }

    function sameLastDigitOptions(correctNum) {
      const correct = Number(correctNum);
      const pool = [];
      for (let k = 1; k <= 12; k++) {
        const lo = correct - 10 * k;
        const hi = correct + 10 * k;
        if (lo > 0) pool.push(lo);
        pool.push(hi);
      }
      pool.sort((a, b) => Math.abs(a - correct) - Math.abs(b - correct));
      const distract = [];
      for (const v of pool) {
        if (v !== correct && !distract.includes(v)) distract.push(v);
        if (distract.length === 2) break;
      }
      while (distract.length < 2) distract.push(correct + 10 * (distract.length + 1));
      const opts = shuffle([correct, distract[0], distract[1]]).map(String);
      return { options: opts, correctIndex: opts.indexOf(String(correct)) };
    }

    // Mers de la mic la mare, vecini la ±3, prioritizând B-urile neacoperite.
    function pickWalkB(list, covered) {
      const uncovered = list.filter((b) => !covered.has(b));
      const pool = uncovered.length ? uncovered : list;
      let near = pool.filter((b) => b >= lastB && b - lastB <= 3);
      if (!near.length) near = pool.filter((b) => Math.abs(b - lastB) <= 3);
      if (!near.length) near = [Math.min(...pool)];
      const b = near[randomInt(0, near.length - 1)];
      lastB = b;
      return b;
    }

    function roundView(extra = {}) {
      return {
        prompt: current?.prompt ?? "—",
        options: current ? [...current.options] : ["—", "—", "—"],
        correctIndex: current?.correctIndex ?? 0,
        successionHistory: history.slice(-3),
        hintMessage: HINT,
        ...extra,
      };
    }

    // ── Construirea întrebărilor ───────────────────────────────────────────────

    function buildMulQuestion(list, phaseTag, covered, types) {
      const A = factorForLevel(level);
      const b = pickWalkB(list, covered);
      const fact = makeFact(b);

      let pick = null;
      for (const t of shuffle(types)) {
        const r = QFG.renderQF(t, fact);
        if (!r || r.answerType !== "number") continue;
        const val = Number(r.correctAnswer);
        if (!Number.isFinite(val)) continue;
        if (val === A && factorCapHit()) {
          if (!pick) pick = { r, val };
          continue;
        }
        pick = { r, val };
        break;
      }
      if (!pick) {
        // fallback dur: produsul direct
        const val = A * b;
        const opt = sameLastDigitOptions(val);
        current = {
          phase: phaseTag,
          factB: b,
          prompt: `${A}*${b}=?`,
          correct: val,
          options: opt.options,
          correctIndex: opt.correctIndex,
          isFirstAttempt: !attempted.has(b),
        };
        noteFactorFlag(val === A);
        return roundView();
      }

      const opt = sameLastDigitOptions(pick.val);
      current = {
        phase: phaseTag,
        factB: b,
        prompt: pick.r.prompt,
        correct: pick.val,
        options: opt.options,
        correctIndex: opt.correctIndex,
        isFirstAttempt: !attempted.has(b),
      };
      noteFactorFlag(pick.val === A);
      return roundView();
    }

    function buildDecompQuestion() {
      const A = factorForLevel(level);
      const b = pickWalkB(REMAINING, coveredB);
      let m = Math.floor(b / 5) * 5;
      if (m <= 0) m = 5;
      let r = b - m;
      if (r === 0) {
        m -= 5;
        r = b - m;
      }
      decompToggle = !decompToggle;
      let prompt;
      let correct;
      if (decompToggle) {
        prompt = `${b}*${A}=?+${r}*${A}`; // ? = m*A
        correct = m * A;
      } else {
        prompt = `${b}*${A}=${m}*${A}+?`; // ? = r*A
        correct = r * A;
      }
      const opt = sameLastDigitOptions(correct);
      current = {
        phase: "B",
        factB: b,
        prompt,
        correct,
        options: opt.options,
        correctIndex: opt.correctIndex,
        isFirstAttempt: false,
      };
      noteFactorFlag(false);
      return roundView();
    }

    function buildFastAddQuestion() {
      const A = factorForLevel(level);
      let X;
      let Y;
      let sum;
      let target;
      let answer;
      let guard = 0;
      do {
        const crossHundred = randomInt(0, 2) === 0;
        if (crossHundred) {
          const hundred = randomInt(2, Math.max(2, Math.floor((A * 19) / 100))) * 100;
          X = hundred - randomInt(1, 15);
          Y = randomInt(11, 30);
        } else {
          X = randomInt(A * 4, A * 19);
          Y = randomInt(11, 39);
        }
        sum = X + Y;
        if (Math.floor(X / 100) < Math.floor(sum / 100)) {
          target = Math.floor(sum / 100) * 100;
        } else {
          target = Math.round(X / 10) * 10;
        }
        answer = sum - target;
        guard++;
      } while ((answer <= 0 || answer >= 100) && guard < 20);
      if (answer <= 0) answer = sum - (Math.floor(X / 10) * 10);

      const opt = sameLastDigitOptions(answer);
      current = {
        phase: "C",
        factB: null,
        prompt: `${X}+${Y}=${target}+?`,
        correct: answer,
        options: opt.options,
        correctIndex: opt.correctIndex,
        isFirstAttempt: false,
      };
      noteFactorFlag(false);
      return roundView();
    }

    function buildDrillQuestion() {
      const A = factorForLevel(level);
      const pool = drillPool.length ? drillPool : [...wrongFacts];
      const b = pool.length ? pool[randomInt(0, pool.length - 1)] : pickWalkB(REMAINING, coveredA2);
      const fact = makeFact(b);

      let pick = null;
      for (const t of shuffle(drillTypes)) {
        const r = QFG.renderQF(t, fact);
        if (!r || r.answerType !== "number") continue;
        const val = Number(r.correctAnswer);
        if (Number.isFinite(val)) {
          pick = { r, val };
          break;
        }
      }
      if (!pick) {
        const val = A * b;
        pick = { r: { prompt: `${A}*${b}=?` }, val };
      }
      const opt = sameLastDigitOptions(pick.val);
      current = {
        phase: "drill",
        factB: b,
        prompt: pick.r.prompt,
        correct: pick.val,
        options: opt.options,
        correctIndex: opt.correctIndex,
        isFirstAttempt: false,
      };
      noteFactorFlag(pick.val === A);
      return roundView();
    }

    function syncPhase() {
      if (phase === "A1" && ANCHORS.every((b) => coveredA1.has(b))) {
        phase = "A2";
        lastB = 0;
      }
      if (phase === "A2" && REMAINING.every((b) => coveredA2.has(b))) {
        phase = "B";
        lastB = 0;
      }
      if (phase === "B" && REMAINING.every((b) => coveredB.has(b))) {
        phase = "C";
        lastB = 0;
      }
    }

    function endDrill() {
      drillActive = false;
      drillRemaining = 0;
      drillPool = [];
      mistakeCount = 0;
      wrongFacts = new Set();
    }

    function maybeEnterDrill() {
      if (drillActive) return;
      if (mistakeCount >= MISTAKES_FOR_DRILL && wrongFacts.size > 0) {
        drillActive = true;
        drillRemaining = randomInt(DRILL_MIN, DRILL_MAX);
        drillPool = [...wrongFacts];
      }
    }

    function nextQuestion() {
      if (drillActive && drillRemaining <= 0) endDrill();
      if (drillActive) return buildDrillQuestion();

      syncPhase();
      if (phase === "A1") return buildMulQuestion(ANCHORS, "A1", coveredA1, mulTypes);
      if (phase === "A2") return buildMulQuestion(REMAINING, "A2", coveredA2, mulTypes);
      if (phase === "B") return buildDecompQuestion();
      return buildFastAddQuestion();
    }

    function markCovered(cur) {
      if (cur.factB == null) return;
      if (cur.phase === "B") {
        coveredB.add(cur.factB);
        return;
      }
      // A1 / A2 / drill: acoperă în funcție de tipul lui B
      if (ANCHORS.includes(cur.factB)) coveredA1.add(cur.factB);
      else coveredA2.add(cur.factB);
    }

    function resetLevelState() {
      correctCount = 0;
      mistakeCount = 0;
      wrongFacts = new Set();
      phase = "A1";
      coveredA1 = new Set();
      coveredA2 = new Set();
      coveredB = new Set();
      attempted = new Set();
      firstTry = new Set();
      drillActive = false;
      drillRemaining = 0;
      drillPool = [];
      lastB = 0;
      decompToggle = false;
      recentFactorFlags = [];
      current = null;
      history = [];
    }

    function advanceLevel() {
      if (level >= MAX_LEVEL) {
        gameCompleted = true;
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          gameComplete: true,
          flash: "win",
          banner: COMPLETE_BANNER,
          message: COMPLETE_BANNER,
          ...roundView({ hintMessage: "" }),
        };
      }
      level++;
      resetLevelState();
      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        levelAdvanced: true,
        flash: "win",
        banner: `Nivel ${level} · ${factorForLevel(level)}×`,
        message: `Felicitări! Nivel ${level}`,
        nextRound: nextQuestion(),
      };
    }

    // ── Răspunsuri ─────────────────────────────────────────────────────────────

    function onAnswer(index) {
      const cur = current;
      const chosen = cur.options[index];
      const correct = index === cur.correctIndex;

      // „din prima" — doar la prima încercare a faptului în acest quiz.
      if (cur.factB != null && cur.isFirstAttempt) {
        attempted.add(cur.factB);
        if (correct) firstTry.add(cur.factB);
        cur.isFirstAttempt = false;
      }

      if (!correct) {
        if ((cur.phase === "A1" || cur.phase === "A2") && cur.factB != null) {
          mistakeCount++;
          wrongFacts.add(cur.factB);
        }
        return {
          outcome: "wrong-answer",
          correct: false,
          flash: "wrong",
          message: `${chosen} nu e bun. Mai încearcă!`,
          ...roundView(),
        };
      }

      correctCount++;
      history.push({ prompt: cur.prompt, answer: cur.correct });
      markCovered(cur);
      if (drillActive) drillRemaining--;

      if (correctCount >= CORRECT_TO_ADVANCE) return advanceLevel();

      maybeEnterDrill();
      const next = nextQuestion();
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: "Corect!",
        ...next,
      };
    }

    function onTimeout() {
      const cur = current;
      if (cur && (cur.phase === "A1" || cur.phase === "A2") && cur.factB != null) {
        mistakeCount++;
        wrongFacts.add(cur.factB);
      }
      if (cur && cur.isFirstAttempt && cur.factB != null) {
        attempted.add(cur.factB);
        cur.isFirstAttempt = false;
      }
      return {
        outcome: "timeout",
        correct: false,
        flash: "wrong",
        message: TIMEOUT_MSG,
        resetFall: true,
        ...roundView({ hintMessage: "" }),
      };
    }

    // ── API public ─────────────────────────────────────────────────────────────

    return {
      getQuizId: () => quizId,
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getMinLevel: () => MIN_LEVEL,
      getLevelLabel: () => `Nivel ${level} · ${factorForLevel(level)}×1..20`,
      getLevelButtonTitle: (lv) => `Nivel ${lv}: ${factorForLevel(lv)}×1..20`,
      isCompleted: () => gameCompleted,

      getProgressDisplay: () => global.ProgressDisplay.hidden(),

      getFallSpeedFactor() {
        if (!current || current.factB == null) return 1.0;
        return (
          global.SpeedFactors?.factDifficultyFactor(
            factorForLevel(level),
            current.factB
          ) ?? 1.0
        );
      },

      shouldBounceToTop() {
        if (!current || current.factB == null) return false;
        return (
          (global.SpeedFactors?.factDifficultyFactor(
            factorForLevel(level),
            current.factB
          ) ?? 1.0) < 1.0
        );
      },

      switchLevel(nextLevel) {
        level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        gameCompleted = false;
        resetLevelState();
        return null;
      },

      pickNextRound() {
        return nextQuestion();
      },

      beginRound(next) {
        return next ?? nextQuestion();
      },

      onAnswer,
      onTimeout,
    };
  }

  global.Mul1120Quiz = { create: createQuiz };

  global.QuizRegistry.register({
    id: "multiplication-1120",
    title: "T*/ 11-20",
    description:
      "Înmulțirea 11–20 × 1–20. 10 niveluri (11×…20×): ancore + equation forms, descompunere și adunări rapide. 21 corecte/nivel.",
    order: -199.5,
    gestionareGreseli: { activ: false },
    create(meta) {
      return global.Mul1120Quiz.create({ quizId: meta.id });
    },
  });
})(window);
