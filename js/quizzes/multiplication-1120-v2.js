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
  const SUBQUIZ_ANCHORS = [1, 2, 3, 4, 5, 10, 15, 20];
  const NONANCHORS = [6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19];
  const START_STAGE_KEY = "yl:mul1120v2:startStage";
  const DEFAULT_START_STAGE = "nonAnchorProducts";
  const STAGES = {
    normal: { id: "normal", order: null, title: "Normal" },
    anchors: { id: "anchors", order: 1, title: "anchors" },
    intensiv: { id: "intensiv", order: 2, title: "intensiv" },
    anchorSumValues: { id: "anchorSumValues", order: 3, title: "valori ancore suma" },
    rapidAnchorAdditions: { id: "rapidAnchorAdditions", order: 4, title: "adunari rapide cu ancore" },
    effectiveAnchorAddition: { id: "effectiveAnchorAddition", order: 5, title: "adunare efectiva ancore" },
    nonAnchorProducts: { id: "nonAnchorProducts", order: 6, title: "inmultiri non-anchors" },
  };
  const START_OPTIONS = {
    normal: { id: "normal", stage: "normal" },
    anchorsOnly: { id: "anchorsOnly", stage: "normal" },
    intensivOnly: { id: "intensivOnly", stage: "intensiv" },
    anchorSumValuesOnly: { id: "anchorSumValuesOnly", stage: "anchorSumValues" },
    rapidAnchorAdditions: { id: "rapidAnchorAdditions", stage: "rapidAnchorAdditions" },
    effectiveAnchorAddition: { id: "effectiveAnchorAddition", stage: "effectiveAnchorAddition" },
    nonAnchorProducts: { id: "nonAnchorProducts", stage: "nonAnchorProducts" },
  };
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

  function readStartStage() {
    try {
      const stored = global.localStorage?.getItem?.(START_STAGE_KEY);
      if (stored === "anchorSumValues") return "anchorSumValuesOnly";
      if (stored && START_OPTIONS[stored]) return stored;
    } catch (err) {
      // localStorage can be unavailable in tests or privacy modes.
    }
    return DEFAULT_START_STAGE;
  }

  function writeStartStage(stageId) {
    try {
      global.localStorage?.setItem?.(START_STAGE_KEY, stageId);
    } catch (err) {
      // Ignore storage failures; the in-memory selection still applies.
    }
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

  function decomposeNonanchor(b) {
    if (b >= 16) return { big: 15, small: b - 15 };
    if (b >= 11) return { big: 10, small: b - 10 };
    return { big: 5, small: b - 5 };
  }

  function sameTableOptionsForFactor(tableFactor, correctAnchor, shuffle) {
    const used = new Set([correctAnchor]);
    const candidates = [];

    function tryAdd(anchor) {
      if (anchor < 1 || anchor > 20 || used.has(anchor)) return;
      used.add(anchor);
      candidates.push(anchor);
    }

    [1, 2, 3, -1, -2, -3].forEach((delta) => tryAdd(correctAnchor + delta));
    SUBQUIZ_ANCHORS.forEach(tryAdd);

    const picked = candidates.slice(0, 2).map((anchor) => String(tableFactor * anchor));
    while (picked.length < 2) {
      const fallbackAnchor = Math.min(20, correctAnchor + picked.length + 1);
      const value = String(tableFactor * fallbackAnchor);
      if (!picked.includes(value) && value !== String(tableFactor * correctAnchor)) {
        picked.push(value);
      } else {
        picked.push(String(tableFactor * Math.max(1, correctAnchor - picked.length - 1)));
      }
    }

    const correct = String(tableFactor * correctAnchor);
    const options = shuffle([correct, picked[0], picked[1]]);
    return { options, correctIndex: options.indexOf(correct) };
  }

  function nearbyNumberOptions(correctNum, shuffle) {
    const correct = Number(correctNum);
    const used = new Set([correct]);
    const candidates = [];

    function tryAdd(value) {
      if (!Number.isFinite(value) || value < 0 || used.has(value)) return;
      used.add(value);
      candidates.push(value);
    }

    [10, -10, 1, -1, 2, -2, 5, -5, 20, -20].forEach((delta) => tryAdd(correct + delta));
    while (candidates.length < 2) tryAdd(correct + candidates.length + 3);

    const options = shuffle([String(correct), String(candidates[0]), String(candidates[1])]);
    return { options, correctIndex: options.indexOf(String(correct)) };
  }

  function finalSumOptions(correctNum, shuffle) {
    const correct = Number(correctNum);
    const used = new Set([correct]);
    const candidates = [];

    function tryAdd(value) {
      if (!Number.isFinite(value) || value <= 0 || used.has(value)) return;
      used.add(value);
      candidates.push(value);
    }

    [-10, 10, 2, -2, 12, -12, 20, -20, 1, -1].forEach((delta) => tryAdd(correct + delta));
    while (candidates.length < 2) tryAdd(correct + candidates.length + 3);

    const options = shuffle([String(correct), String(candidates[0]), String(candidates[1])]);
    return { options, correctIndex: options.indexOf(String(correct)) };
  }

  function createQuiz(config) {
    const quizId = config.quizId;
    const { randomInt, shuffle } = global.GameUtils;
    const QFG = global.QFGenerator;
    const Catalog = global.FactCatalog;

    const qfTypes = QFG.getActiveQFTypes(QF_PROFILE).filter((t) => t.answerType === "number");

    const QUESTIONS_PER_LEVEL = 21;
    const FAST_MS = 1500; // ≤ 1.5s → highlight
    const INTENSIV_QUESTIONS = 10; // întrebări per sesiune intensiv
    const INTENSIV_SESSIONS_PER_LEVEL = 2; // 2 sesiuni intensiv → nivel următor

    let level = MIN_LEVEL;
    let startStageSelection = readStartStage();
    let stage = START_OPTIONS[startStageSelection]?.stage ?? "normal";
    let mode = "anchor";      // "anchor" | "intensiv"
    let wrongFacts = [];      // facts ancoră greșite (distincte) în anchor test
    let factsLucrateIntensiv = []; // facts antrenate în (ultimul) intensiv, pt. panou
    let intensivFacts = [];   // cele 2 facts (B) lucrate în intensivul curent
    let intensivQueue = [];   // 10 B-uri (5+5), amestecate aleator
    let intensivCount = 0;    // câte întrebări intensive au fost rezolvate (0..10)
    let intensivSessionsDone = 0; // sesiuni intensiv încheiate în nivelul curent
    let lastCorrectByB = {};  // { [b]: responseMs } — timpul ultimului răspuns corect / fact
    let answeredCount = 0;    // răspunsuri anchor în nivelul curent (corecte sau greșite, spre 21)
    let anchorQueue = [];     // ancorele rămase în tura curentă (ordine mic → mare cu variație)
    let recentFactorFlags = [];
    let subquizQuestionCount = 0;
    let subquizCorrectStreak = 0;
    let rapidCandidates = null;
    let rapidCandidateIndex = 0;
    let lastRapidPrompt = null;
    let effectiveCandidateIndex = 0;
    let lastEffectivePrompt = null;
    let lastEffectiveB = null;
    let effectiveTurnCount = 0;
    let effectiveErrorCounts = {};
    let effectiveProblemBs = [];
    let effectiveRetryQueue = [];
    let effectiveIntensiveQueue = [];
    let effectiveIntensiveCount = 0;
    let productQuestionCount = 0;
    let productCorrectStreak = 0;
    let productWrongBs = [];
    let productIntensiveQueue = [];
    let productIntensiveCount = 0;
    let productQueue = [];
    let completed = false;
    let current = null;
    let orchestrator = null;

    // Faza E, sectiunea 12: orice quiz trebuie construit intern prin
    // SubquizOrchestrator (vezi equations-e3-e6.js pt. explicatia completa a
    // tiparului). Spre deosebire de fisierele anterioare, aici NU exista un
    // singur punct de mutatie pt. `current` — sunt 9 situri separate (8 functii
    // `build*Question*`, unele cu 2 ramuri), fiindca fisierul are 6 „subquiz"-uri
    // interne informale (stage/mode), migrate direct la M3B in Faza D, NU la
    // SubquizOrchestrator real (push/pop). Fiecare sit cheama sincronizarea
    // explicit, imediat dupa ce seteaza `current`.
    function sincronizeazaOrchestratorul() {
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: current?.prompt ?? "—",
        options: current ? [...current.options] : ["—", "—", "—"],
        correctIndex: current?.correctIndex ?? 0,
      });
    }

    function isDirectTestMode() {
      return startStageSelection !== "normal";
    }

    function isDirectTestModeFor(optionId) {
      return startStageSelection === optionId;
    }

    function stageForStartSelection() {
      return START_OPTIONS[startStageSelection]?.stage ?? "normal";
    }

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
        sincronizeazaOrchestratorul();
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
      sincronizeazaOrchestratorul();
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

    // 5+5 pe cele 2 facts, apoi amestecate aleator.
    function buildIntensivQueue() {
      const [b1, b2] = intensivFacts;
      return shuffle([...Array(5).fill(b1), ...Array(5).fill(b2)]);
    }

    // Construiește întrebarea intensivă curentă din coada amestecată.
    function buildIntensivQuestion() {
      const b = intensivQueue[intensivCount];
      buildQuestionForB(b, { excludeFactor: true });
    }

    function startDirectIntensiv() {
      mode = "intensiv";
      intensivFacts = [2, 3];
      factsLucrateIntensiv = intensivFacts.map((b) => factLabel(b));
      wrongFacts = [];
      intensivCount = 0;
      intensivQueue = buildIntensivQueue();
    }

    function resetSubquizState() {
      subquizQuestionCount = 0;
      subquizCorrectStreak = 0;
      rapidCandidates = null;
      rapidCandidateIndex = 0;
      lastRapidPrompt = null;
      effectiveCandidateIndex = 0;
      lastEffectivePrompt = null;
      lastEffectiveB = null;
      effectiveTurnCount = 0;
      effectiveErrorCounts = {};
      effectiveProblemBs = [];
      effectiveRetryQueue = [];
      effectiveIntensiveQueue = [];
      effectiveIntensiveCount = 0;
      productQuestionCount = 0;
      productCorrectStreak = 0;
      productWrongBs = [];
      productIntensiveQueue = [];
      productIntensiveCount = 0;
      productQueue = [];
    }

    function enterStage(nextStage) {
      stage = STAGES[nextStage] ? nextStage : "normal";
      resetSubquizState();
      current = null;
      if (stage === "intensiv") startDirectIntensiv();
      else if (stage === "normal") mode = "anchor";
      else mode = stage;
    }

    function pickNonanchorB() {
      return NONANCHORS[randomInt(0, NONANCHORS.length - 1)];
    }

    function buildAnchorSumQuestion() {
      const A = factorForLevel(level);
      const b = pickNonanchorB();
      const parts = decomposeNonanchor(b);
      const missingBig = randomInt(0, 1) === 0;
      const missingAnchor = missingBig ? parts.big : parts.small;
      const shownAnchor = missingBig ? parts.small : parts.big;
      const prompt = missingBig
        ? `${A}*${b}=?+${A}*${shownAnchor}`
        : `${A}*${b}=${A}*${shownAnchor}+?`;
      const opt = sameTableOptionsForFactor(A, missingAnchor, shuffle);

      current = {
        type: "anchorSumValues",
        factB: b,
        prompt,
        correct: A * missingAnchor,
        options: opt.options,
        correctIndex: opt.correctIndex,
        missingAnchor,
        shownAnchor,
      };
      sincronizeazaOrchestratorul();
    }

    function nextAnchorSumQuestion() {
      buildAnchorSumQuestion();
      return roundView();
    }

    function crossesNextHundred(from, total) {
      return Math.floor(from / 100) < Math.floor(total / 100);
    }

    function hasColumnCarry(a, b) {
      return (a % 10) + (b % 10) >= 10;
    }

    function nextHundred(value) {
      return Math.ceil((value + 1) / 100) * 100;
    }

    function buildRapidCandidateForB(b) {
      const A = factorForLevel(level);
      const parts = decomposeNonanchor(b);
      const bigTerm = A * parts.big;
      const smallTerm = A * parts.small;
      const total = bigTerm + smallTerm;
      const crossesHundred = crossesNextHundred(bigTerm, total);
      const bothEndInFive = bigTerm % 10 === 5 && smallTerm % 10 === 5;
      const bigDivisibleByTen = bigTerm % 10 === 0;
      const smallDivisibleByTen = smallTerm % 10 === 0;
      const shouldRoundToHundred =
        crossesHundred &&
        (bothEndInFive ||
          (bigDivisibleByTen && !smallDivisibleByTen) ||
          nextHundred(bigTerm) - bigTerm <= 10);

      if (!hasColumnCarry(bigTerm, smallTerm) && !crossesHundred) return null;
      if (bothEndInFive && !crossesHundred) return null;
      if ((bigDivisibleByTen || smallDivisibleByTen) && !shouldRoundToHundred) return null;

      if (shouldRoundToHundred) {
        const rounded = nextHundred(bigTerm);
        return {
          b,
          prompt: `${bigTerm}+${smallTerm}=${rounded}+?`,
          correct: total - rounded,
          bigTerm,
          smallTerm,
          strategy: "roundBigToHundred",
        };
      }

      const lower = Math.floor(smallTerm / 10) * 10;
      const upper = Math.ceil(smallTerm / 10) * 10;
      if (smallTerm - lower <= upper - smallTerm) {
        return {
          b,
          prompt: `${bigTerm}+${smallTerm}=${bigTerm}+${lower}+?`,
          correct: smallTerm - lower,
          bigTerm,
          smallTerm,
          strategy: "splitSecond",
        };
      }

      return {
        b,
        prompt: `${bigTerm}+${smallTerm}=${bigTerm}+${upper}-?`,
        correct: upper - smallTerm,
        bigTerm,
        smallTerm,
        strategy: "roundSecondUp",
      };
    }

    function getRapidCandidates() {
      if (!rapidCandidates) {
        rapidCandidates = NONANCHORS.map(buildRapidCandidateForB).filter(Boolean);
      }
      return rapidCandidates;
    }

    function pickRapidCandidate() {
      const candidates = getRapidCandidates();
      if (!candidates.length) return null;
      if (candidates.length === 1) return candidates[0];

      let available = candidates.filter((candidate) => candidate.prompt !== lastRapidPrompt);
      if (!available.length) available = candidates;
      const picked = available[rapidCandidateIndex % available.length];
      rapidCandidateIndex += 1;
      return picked;
    }

    function buildNoRapidCandidatesQuestion() {
      current = {
        type: "rapidAnchorAdditionsNoCandidates",
        factB: null,
        prompt: "no candidates",
        correct: 0,
        options: ["0", "1", "2"],
        correctIndex: 0,
      };
      sincronizeazaOrchestratorul();
    }

    function buildRapidAnchorAdditionQuestion() {
      const candidate = pickRapidCandidate();
      if (!candidate) {
        buildNoRapidCandidatesQuestion();
        return;
      }

      const opt = nearbyNumberOptions(candidate.correct, shuffle);
      current = {
        type: "rapidAnchorAdditions",
        factB: candidate.b,
        prompt: candidate.prompt,
        correct: candidate.correct,
        options: opt.options,
        correctIndex: opt.correctIndex,
        strategy: candidate.strategy,
        bigTerm: candidate.bigTerm,
        smallTerm: candidate.smallTerm,
      };
      lastRapidPrompt = candidate.prompt;
      sincronizeazaOrchestratorul();
    }

    function nextRapidAnchorAdditionQuestion() {
      buildRapidAnchorAdditionQuestion();
      return roundView();
    }

    function buildEffectiveCandidateForB(b) {
      const A = factorForLevel(level);
      const parts = decomposeNonanchor(b);
      const bigTerm = A * parts.big;
      const smallTerm = A * parts.small;
      return {
        b,
        prompt: `${bigTerm}+${smallTerm}=?`,
        correct: bigTerm + smallTerm,
        bigTerm,
        smallTerm,
      };
    }

    function makeEffectiveFact(candidate) {
      return Catalog.createFact({
        operation: "add",
        values: { a: candidate.bigTerm, b: candidate.smallTerm },
      });
    }

    function buildEffectiveOptions(candidate) {
      const opt = finalSumOptions(candidate.correct, shuffle);
      return {
        prompt: candidate.prompt,
        correct: candidate.correct,
        options: opt.options,
        correctIndex: opt.correctIndex,
      };
    }

    function buildEffectiveEffOptions(candidate, qfType) {
      const fact = makeEffectiveFact(candidate);
      const built = QFG.buildOptions(qfType, fact, shuffle);
      if (!built || built.answerType !== "number") return null;
      return {
        prompt: built.prompt,
        correct: Number(built.options[built.correctIndex]),
        options: built.options,
        correctIndex: built.correctIndex,
      };
    }

    function dueEffectiveRetry() {
      const due = effectiveRetryQueue.filter((entry) => entry.dueTurn <= effectiveTurnCount);
      if (!due.length) return null;
      due.sort((a, b) => a.dueTurn - b.dueTurn);
      const picked = due[0];
      effectiveRetryQueue = effectiveRetryQueue.filter((entry) => entry !== picked);
      return buildEffectiveCandidateForB(picked.b);
    }

    function pickEffectiveCandidate() {
      const retry = dueEffectiveRetry();
      if (retry && retry.prompt !== lastEffectivePrompt) return retry;

      const candidates = NONANCHORS.map(buildEffectiveCandidateForB);
      let available = candidates.filter((candidate) => candidate.prompt !== lastEffectivePrompt);
      if (!available.length) available = candidates;

      if (lastEffectiveB != null && available.length > 1) {
        const nearby = available.filter((candidate) => Math.abs(candidate.b - lastEffectiveB) <= 3);
        if (nearby.length) {
          return nearby[randomInt(0, nearby.length - 1)];
        }
        const minDistance = Math.min(...available.map((candidate) => Math.abs(candidate.b - lastEffectiveB)));
        const closest = available.filter((candidate) => Math.abs(candidate.b - lastEffectiveB) === minDistance);
        return closest[randomInt(0, closest.length - 1)];
      }

      const picked = available[randomInt(0, available.length - 1)];
      effectiveCandidateIndex += 1;
      return picked;
    }

    function buildEffectiveAnchorAdditionQuestion() {
      const candidate = pickEffectiveCandidate();
      const built = buildEffectiveOptions(candidate);
      current = {
        type: "effectiveAnchorAddition",
        factB: candidate.b,
        prompt: built.prompt,
        correct: built.correct,
        options: built.options,
        correctIndex: built.correctIndex,
        bigTerm: candidate.bigTerm,
        smallTerm: candidate.smallTerm,
      };
      lastEffectivePrompt = candidate.prompt;
      lastEffectiveB = candidate.b;
      effectiveTurnCount++;
      sincronizeazaOrchestratorul();
    }

    function nextEffectiveAnchorAdditionQuestion() {
      buildEffectiveAnchorAdditionQuestion();
      return roundView();
    }

    function scheduleEffectiveRetry(b) {
      const dueTurn = effectiveTurnCount + randomInt(2, 5);
      effectiveRetryQueue = effectiveRetryQueue.filter((entry) => entry.b !== b);
      effectiveRetryQueue.push({ b, dueTurn });
    }

    function noteEffectiveMistake(b) {
      effectiveErrorCounts[b] = (effectiveErrorCounts[b] ?? 0) + 1;
      if (effectiveErrorCounts[b] >= 2 && !effectiveProblemBs.includes(b)) {
        effectiveProblemBs.push(b);
      }
      scheduleEffectiveRetry(b);
    }

    function buildEffectiveIntensiveQueue(problemBs) {
      const entries = [];
      problemBs.slice(0, 2).forEach((b) => {
        const candidate = buildEffectiveCandidateForB(b);
        const validTypes = qfTypes.filter((qfType) => {
          const built = buildEffectiveEffOptions(candidate, qfType);
          return built && Number.isFinite(Number(built.correct));
        });
        validTypes.slice(0, 5).forEach((qfType) => entries.push({ b, qfType }));
      });
      return shuffle(entries);
    }

    function startEffectiveIntensive() {
      const trainingBs = effectiveProblemBs.slice(0, 2);
      mode = "effectiveIntensiv";
      factsLucrateIntensiv = trainingBs.map((b) => buildEffectiveCandidateForB(b).prompt);
      effectiveIntensiveQueue = buildEffectiveIntensiveQueue(trainingBs);
      effectiveIntensiveCount = 0;
      trainingBs.forEach((b) => {
        effectiveErrorCounts[b] = 0;
      });
      effectiveProblemBs = effectiveProblemBs.filter((b) => !trainingBs.includes(b));
      effectiveRetryQueue = effectiveRetryQueue.filter((entry) => !trainingBs.includes(entry.b));
      buildEffectiveIntensiveQuestion();
    }

    function buildEffectiveIntensiveQuestion() {
      const entry = effectiveIntensiveQueue[effectiveIntensiveCount];
      if (!entry) {
        mode = "effectiveAnchorAddition";
        effectiveIntensiveQueue = [];
        effectiveIntensiveCount = 0;
        buildEffectiveAnchorAdditionQuestion();
        return;
      }
      const candidate = buildEffectiveCandidateForB(entry.b);
      const built = buildEffectiveEffOptions(candidate, entry.qfType) ?? buildEffectiveOptions(candidate);
      current = {
        type: "effectiveAnchorAdditionIntensive",
        factB: entry.b,
        prompt: built.prompt,
        correct: built.correct,
        options: built.options,
        correctIndex: built.correctIndex,
        bigTerm: candidate.bigTerm,
        smallTerm: candidate.smallTerm,
      };
      sincronizeazaOrchestratorul();
    }

    function buildProductPass() {
      return [...NONANCHORS];
    }

    function pickProductB() {
      if (!productQueue.length) productQueue = buildProductPass();
      return productQueue.shift();
    }

    function makeProductFact(b) {
      return Catalog.createFact({
        operation: "mul",
        values: { a: b, b: factorForLevel(level) },
      });
    }

    function buildProductQuestionForB(b) {
      const A = factorForLevel(level);
      const correct = b * A;
      const opt = sameLastDigitOptions(correct, shuffle);
      current = {
        type: "nonAnchorProducts",
        factB: b,
        prompt: `${b}*${A}=?`,
        correct,
        options: opt.options,
        correctIndex: opt.correctIndex,
      };
      sincronizeazaOrchestratorul();
    }

    function nextProductQuestion() {
      buildProductQuestionForB(pickProductB());
      return roundView();
    }

    function buildProductIntensiveQueue(problemBs) {
      const entries = [];
      problemBs.slice(0, 2).forEach((b) => {
        const fact = makeProductFact(b);
        const validTypes = qfTypes.filter((qfType) => {
          const built = QFG.buildOptions(qfType, fact, shuffle);
          return built && built.answerType === "number";
        });
        validTypes.slice(0, 5).forEach((qfType) => entries.push({ b, qfType }));
      });
      return shuffle(entries);
    }

    function buildProductIntensiveQuestion() {
      const entry = productIntensiveQueue[productIntensiveCount];
      if (!entry) {
        mode = "nonAnchorProducts";
        productIntensiveQueue = [];
        productIntensiveCount = 0;
        buildProductQuestionForB(pickProductB());
        return;
      }
      const fact = makeProductFact(entry.b);
      const built = QFG.buildOptions(entry.qfType, fact, shuffle);
      if (!built || built.answerType !== "number") {
        buildProductQuestionForB(entry.b);
        return;
      }
      current = {
        type: "nonAnchorProductsIntensive",
        factB: entry.b,
        prompt: built.prompt,
        correct: Number(built.options[built.correctIndex]),
        options: built.options,
        correctIndex: built.correctIndex,
      };
      sincronizeazaOrchestratorul();
    }

    function startProductIntensive() {
      const trainingBs = productWrongBs.slice(0, 2);
      mode = "nonAnchorProductsIntensiv";
      factsLucrateIntensiv = trainingBs.map((b) => `${b}*${factorForLevel(level)}=?`);
      productIntensiveQueue = buildProductIntensiveQueue(trainingBs);
      productIntensiveCount = 0;
      productWrongBs = productWrongBs.filter((b) => !trainingBs.includes(b));
      buildProductIntensiveQuestion();
    }

    function rapidProgressText() {
      const candidateCount = getRapidCandidates().length;
      if (candidateCount === 0) return "no candidates";
      if (candidateCount === 1) return `${subquizQuestionCount} · pana la primul corect`;
      return `${subquizQuestionCount} / ${Math.min(12, candidateCount * 3)}`;
    }

    function resetLevelState() {
      completed = false;
      stage = stageForStartSelection();
      mode = "anchor";
      wrongFacts = [];
      factsLucrateIntensiv = [];
      intensivFacts = [];
      intensivQueue = [];
      intensivCount = 0;
      intensivSessionsDone = 0;
      lastCorrectByB = {};
      answeredCount = 0;
      anchorQueue = [];
      recentFactorFlags = [];
      resetSubquizState();
      current = null;
      if (stage === "intensiv") startDirectIntensiv();
      else if (stage !== "normal") mode = stage;
    }

    function nextRoundForStage() {
      if (stage === "anchorSumValues") return nextAnchorSumQuestion();
      if (stage === "rapidAnchorAdditions") return nextRapidAnchorAdditionQuestion();
      if (stage === "effectiveAnchorAddition") return nextEffectiveAnchorAdditionQuestion();
      if (stage === "nonAnchorProducts") return nextProductQuestion();
      if (stage === "intensiv") {
        buildIntensivQuestion();
        return roundView();
      }
      return nextAnchorQuestion();
    }

    function completeNormal(via = "anchor") {
      if (isDirectTestMode()) return advanceLevel(via);
      enterStage("anchorSumValues");
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        flash: "win",
        message: `Subquiz 3: ${STAGES.anchorSumValues.title}`,
        ...nextAnchorSumQuestion(),
      };
    }

    function completeAnchorSum() {
      if (isDirectTestMode()) return advanceLevel("anchorSumValues");
      enterStage("rapidAnchorAdditions");
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        flash: "win",
        message: `Subquiz 4: ${STAGES.rapidAnchorAdditions.title}`,
        ...nextRapidAnchorAdditionQuestion(),
      };
    }

    function completeRapidAnchorAdditions(via = "rapidAnchorAdditions") {
      if (isDirectTestMode()) return advanceLevel(via);
      enterStage("effectiveAnchorAddition");
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        flash: "win",
        message: `Subquiz 5: ${STAGES.effectiveAnchorAddition.title}`,
        ...nextEffectiveAnchorAdditionQuestion(),
      };
    }

    function completeEffectiveAnchorAddition() {
      if (isDirectTestMode()) return advanceLevel("effectiveAnchorAddition");
      enterStage("nonAnchorProducts");
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        flash: "win",
        message: `Subquiz 6: ${STAGES.nonAnchorProducts.title}`,
        ...nextProductQuestion(),
      };
    }

    function advanceLevel(via = "anchor") {
      if (level >= MAX_LEVEL) {
        completed = true;
        const message = "Ai ajuns la final.";
        global.alert?.(message);
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          gameComplete: true,
          flash: "win",
          banner: message,
          message,
          prompt: "Final",
          options: ["", "", ""],
          correctIndex: 0,
        };
      }

      const msg =
        via === "rapidAnchorAdditionsNoCandidates"
          ? "no candidates, mai departe"
          : via === "effectiveAnchorAddition"
          ? "ai terminat subquiz 5, next level"
          : via === "nonAnchorProducts"
          ? "ai terminat subquiz 6, next level"
          : via === "rapidAnchorAdditions"
          ? "ai terminat subquiz 4, mai departe"
          : via === "anchorSumValues"
          ? "ai terminat subquiz 3, next level"
          : via === "intensiv"
          ? "ai terminat 2 sesiuni intensiv, next level"
          : `ai raspuns la ${QUESTIONS_PER_LEVEL} de intrebari, next level`;
      global.alert?.(msg);
      level = Math.min(MAX_LEVEL, level + 1);
      resetLevelState();
      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        levelAdvanced: true,
        runDelayMs: 0,
        flash: "win",
        banner: `Nivel ${level} · ${factorForLevel(level)}×`,
        message: `Nivel ${level}`,
        nextRound: nextRoundForStage(),
      };
    }

    // Motor 3 butoane (M3B) — vezi documente de referinta/PLAN-motor-comun-raspuns.md.
    //
    // CORECTIE INTENTIONATA majora (Categoriile 3, 4 si 6 din
    // FAZA-A-inventar-contract.md — cel mai mare numar de incalcari gasite
    // intr-un singur fisier pana acum):
    //   - `anchorSumValues`: pe gresit, sarea la o intrebare NOUA (Cat. 3/4) —
    //     acum ramane pe loc, ca peste tot.
    //   - modul „intensiv" (10 intrebari de antrenament) si sub-modurile lui
    //     surori (`effectiveIntensiv`, `nonAnchorProductsIntensiv`): comentariul
    //     original spunea explicit „Greșelile sunt IGNORATE — avansăm
    //     indiferent de corect/greșit" — asta incalca regula universala fara
    //     nicio exceptie posibila (user, verbatim: „indiferent de quiz sau
    //     subquiz"). Acum gresit ramane pe loc si aici, ca peste tot.
    //   - starea placeholder „fara candidati" la rapidAnchorAdditions avansa
    //     necondiționat la orice apasare; acum doar apasarea pe indexul
    //     „corect" al placeholder-ului avanseaza.
    //   - `productQuestionCount`/`subquizQuestionCount`/`answeredCount`/
    //     `intensivCount` numarau la FIECARE apasare, inclusiv gresite
    //     (Categoria 6) — acum numara doar la raspunsuri REZOLVATE (corecte),
    //     pragurile (12, 7, 21, 10, 3, 10) raman neschimbate ca numere.
    //   - `onProductAnswer` avansa nivelul (`advanceLevel`) direct pe un
    //     raspuns GRESIT daca `productQuestionCount>=21` — eliminat complet,
    //     acel prag se verifica azi doar dupa raspunsuri corecte.
    //
    // Fiecare functie `on...Correct()` de mai jos e versiunea CORECTATA a
    // fostei `on...Answer(isCorrect, chosen)`: ramura de „gresit" a disparut de
    // aici (M3B o gestioneaza implicit, prin `mesaje.gresit`), iar efectele ei
    // secundare (marcarea faptului gresit) traiesc acum in `dupaApasare`.

    function onAnchorSumCorrect() {
      subquizQuestionCount++;
      subquizCorrectStreak++;

      if (subquizQuestionCount >= 12 || subquizCorrectStreak >= 7) {
        return completeAnchorSum();
      }

      buildAnchorSumQuestion();
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: "Corect!",
        ...roundView(),
      };
    }

    function onRapidAnchorAdditionCorrect() {
      if (current?.type === "rapidAnchorAdditionsNoCandidates") {
        return completeRapidAnchorAdditions("rapidAnchorAdditionsNoCandidates");
      }

      subquizQuestionCount++;
      subquizCorrectStreak++;

      const candidateCount = getRapidCandidates().length;
      const multipleCandidateLimit = Math.min(12, candidateCount * 3);
      if (candidateCount > 1 && subquizQuestionCount >= multipleCandidateLimit) {
        return completeRapidAnchorAdditions("rapidAnchorAdditions");
      }

      if (candidateCount === 1) {
        return completeRapidAnchorAdditions("rapidAnchorAdditions");
      }

      buildRapidAnchorAdditionQuestion();
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: "Corect!",
        ...roundView(),
      };
    }

    function onEffectiveAnchorAdditionCorrect() {
      if (mode === "effectiveIntensiv") {
        effectiveIntensiveCount++;
        if (effectiveIntensiveCount >= effectiveIntensiveQueue.length) {
          mode = "effectiveAnchorAddition";
          effectiveIntensiveQueue = [];
          effectiveIntensiveCount = 0;
          buildEffectiveAnchorAdditionQuestion();
          return {
            outcome: "step-correct",
            correct: true,
            bounce: true,
            message: "Inapoi la subquiz 5.",
            ...roundView(),
          };
        }
        buildEffectiveIntensiveQuestion();
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Intensiv subquiz 5 ${effectiveIntensiveCount + 1}/10`,
          ...roundView(),
        };
      }

      subquizQuestionCount++;
      subquizCorrectStreak++;

      if (subquizQuestionCount >= 21 || subquizCorrectStreak >= 10) {
        return completeEffectiveAnchorAddition();
      }

      if (effectiveProblemBs.length >= 2) {
        startEffectiveIntensive();
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Mod intensiv subquiz 5: ${factsLucrateIntensiv.join(", ")}`,
          ...roundView(),
        };
      }

      buildEffectiveAnchorAdditionQuestion();
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: "Corect!",
        ...roundView(),
      };
    }

    function onProductCorrect() {
      if (mode === "nonAnchorProductsIntensiv") {
        productIntensiveCount++;
        if (productIntensiveCount >= productIntensiveQueue.length) {
          mode = "nonAnchorProducts";
          productIntensiveQueue = [];
          productIntensiveCount = 0;
          buildProductQuestionForB(pickProductB());
          return {
            outcome: "step-correct",
            correct: true,
            bounce: true,
            message: "Inapoi la subquiz 6.",
            ...roundView(),
          };
        }
        buildProductIntensiveQuestion();
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Intensiv subquiz 6 ${productIntensiveCount + 1}/10`,
          ...roundView(),
        };
      }

      productQuestionCount++;
      productCorrectStreak++;

      if (productWrongBs.length >= 2) {
        startProductIntensive();
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Mod intensiv subquiz 6: ${factsLucrateIntensiv.join(", ")}`,
          ...roundView(),
        };
      }

      if (productCorrectStreak >= NONANCHORS.length || productQuestionCount >= 21) {
        return advanceLevel("nonAnchorProducts");
      }

      buildProductQuestionForB(pickProductB());
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: "Corect!",
        ...roundView(),
      };
    }

    // ── MOD INTENSIV ───────────────────────────────────────────────────────
    // Instrument de antrenament (NU mastery): 10 întrebări pe cele 2 facts
    // greșite (5+5, ordine aleatoare). La final revenim la anchor (sau nivel
    // următor la 2 sesiuni).
    function onIntensivCorrect() {
      intensivCount++;
      if (intensivCount >= INTENSIV_QUESTIONS) {
        if (isDirectTestModeFor("intensivOnly")) return advanceLevel("intensiv");
        intensivSessionsDone++;
        mode = "anchor";
        if (intensivSessionsDone >= INTENSIV_SESSIONS_PER_LEVEL) {
          return completeNormal("intensiv");
        }
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
    function onAnchorCorrect(meta) {
      answeredCount++;
      lastCorrectByB[current.factB] = meta.responseMs ?? null;

      // 2 facts DISTINCTE greșite + răspuns corect pe întrebarea curentă → intensiv.
      if (wrongFacts.length >= 2 && !isDirectTestModeFor("anchorsOnly")) {
        intensivFacts = wrongFacts.map((w) => w.b);
        factsLucrateIntensiv = wrongFacts.map((w) => w.label);
        wrongFacts = [];
        mode = "intensiv";
        intensivCount = 0;
        intensivQueue = buildIntensivQueue();
        buildIntensivQuestion();
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Mod intensiv: antrenament pe ${factsLucrateIntensiv.join(", ")}`,
          ...roundView(),
        };
      }

      if (answeredCount >= QUESTIONS_PER_LEVEL) return completeNormal();

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

    // Faza E, sectiunea 12: invelit intr-un SubquizOrchestrator (o singura
    // bucata "baza"). `esteCorect`/`mesaje`/`actiuni` copiate identic din
    // vechiul M3B direct — cele 6 „subquiz"-uri interne raman ramificatii pe
    // `stage`/`mode` in interiorul ACELEIASI bucati, nu subquiz-uri reale cu
    // rutare (asa erau si inainte de aceasta lucrare, migrate la M3B in Faza D,
    // nu redesenate acum). `roundView()` = exact vederea generica
    // (prompt/options/correctIndex/hintMessage) — fara campuri proprii de
    // injectat, spre deosebire de fisierele cu `successionHistory`/`bondHistory`.
    // `options` sunt string-uri (`sameLastDigitOptions` etc. fac `.map(String)`),
    // `ctx.alesul` sigur de folosit in mesaj.
    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "base",
        title: "baza",
        hintMessage: HINT,
        esteCorect: (_item, index) => Number(current.options[index]) === Number(current.correct),
        generator: () => ({}),
        mesaje: {
          gresit: (ctx) => `${ctx.alesul} nu e bun. Mai încearcă!`,
        },
        actiuni: {
          dupaApasare: (ctx) => {
            if (ctx.corect) return {};

            if (mode === "intensiv" || mode === "effectiveIntensiv" || mode === "nonAnchorProductsIntensiv") {
              return {};
            }
            if (stage === "anchorSumValues") {
              subquizCorrectStreak = 0;
              return {};
            }
            if (stage === "rapidAnchorAdditions") {
              subquizCorrectStreak = 0;
              return {};
            }
            if (stage === "effectiveAnchorAddition") {
              subquizCorrectStreak = 0;
              noteEffectiveMistake(current.factB);
              return {};
            }
            if (stage === "nonAnchorProducts") {
              productCorrectStreak = 0;
              if (!productWrongBs.includes(current.factB)) productWrongBs.push(current.factB);
              return {};
            }

            // ── ANCHOR TEST (stage "normal", mode "anchor") ──────────────────
            if (!wrongFacts.some((w) => w.b === current.factB)) {
              wrongFacts.push({ b: current.factB, label: factLabel(current.factB) });
            }
            return {};
          },
          dupaRaspunsCorect: (ctx) => {
            let view;
            if (stage === "anchorSumValues") view = onAnchorSumCorrect();
            else if (stage === "rapidAnchorAdditions") view = onRapidAnchorAdditionCorrect();
            else if (stage === "effectiveAnchorAddition") view = onEffectiveAnchorAdditionCorrect();
            else if (stage === "nonAnchorProducts") view = onProductCorrect();
            else if (mode === "intensiv") view = onIntensivCorrect();
            else view = onAnchorCorrect(ctx.meta);
            return { action: "continue", view };
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

    // Migrat la Motor3Butoane (Faza D, lotul 3), invelit in SubquizOrchestrator
    // (Faza E, sectiunea 12) — vezi `baseDefinition`, mai sus.
    function onAnswer(index, meta = {}) {
      return orchestrator.onAnswer(index, meta);
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
      getLevelLabel: () =>
        mode === "nonAnchorProductsIntensiv"
          ? `Nivel ${level} · Subquiz 6 · intensiv`
          : mode === "effectiveIntensiv"
          ? `Nivel ${level} · Subquiz 5 · intensiv`
          : stage === "nonAnchorProducts"
          ? `Nivel ${level} · Subquiz 6 · ${STAGES.nonAnchorProducts.title}`
          : stage === "effectiveAnchorAddition"
          ? `Nivel ${level} · Subquiz 5 · ${STAGES.effectiveAnchorAddition.title}`
          : stage === "rapidAnchorAdditions"
          ? `Nivel ${level} · Subquiz 4 · ${STAGES.rapidAnchorAdditions.title}`
          : stage === "anchorSumValues"
          ? `Nivel ${level} · Subquiz 3 · ${STAGES.anchorSumValues.title}`
          : stage === "intensiv"
          ? `Nivel ${level} · Subquiz 2 · ${STAGES.intensiv.title}`
          : `Nivel ${level} · ${factorForLevel(level)}× ancore`,
      getLevelButtonTitle: (lv) => `Nivel ${lv}: ${factorForLevel(lv)}× ancore`,
      isCompleted: () => completed,

      getProgressDisplay: () => global.ProgressDisplay.hidden(),

      getInfo11_20() {
        const A = factorForLevel(level);
        return {
          visible: true,
          mode:
            mode === "nonAnchorProductsIntensiv"
              ? "Subquiz 6: intensiv"
              : mode === "effectiveIntensiv"
              ? "Subquiz 5: intensiv"
              : stage === "nonAnchorProducts"
              ? `Subquiz 6: ${STAGES.nonAnchorProducts.title}`
              : stage === "effectiveAnchorAddition"
              ? `Subquiz 5: ${STAGES.effectiveAnchorAddition.title}`
              : stage === "rapidAnchorAdditions"
              ? `Subquiz 4: ${STAGES.rapidAnchorAdditions.title}`
              : stage === "anchorSumValues"
              ? `Subquiz 3: ${STAGES.anchorSumValues.title}`
              : stage === "intensiv"
              ? `Subquiz 2: ${STAGES.intensiv.title}`
              : mode === "intensiv"
              ? "intensiv"
              : "test anchors",
          wrongFactsText: wrongFacts.length
            ? wrongFacts.map((w) => w.label).join(", ")
            : "—",
          intensivText: factsLucrateIntensiv.length
            ? factsLucrateIntensiv.join(", ")
            : "—",
          answeredText:
            mode === "nonAnchorProductsIntensiv"
              ? `${productIntensiveCount} / ${productIntensiveQueue.length || 10}`
              : mode === "effectiveIntensiv"
              ? `${effectiveIntensiveCount} / ${effectiveIntensiveQueue.length || 10}`
              : stage === "nonAnchorProducts"
              ? `${productQuestionCount} / 21 · perfect ${productCorrectStreak} / ${NONANCHORS.length}`
              : stage === "effectiveAnchorAddition"
              ? `${subquizQuestionCount} / 21 · streak ${subquizCorrectStreak} / 10`
              : stage === "rapidAnchorAdditions"
              ? rapidProgressText()
              : stage === "anchorSumValues"
              ? `${subquizQuestionCount} / 12 · streak ${subquizCorrectStreak} / 7`
              : stage === "intensiv"
              ? `${intensivCount} / ${INTENSIV_QUESTIONS}`
              : `${answeredCount} / ${QUESTIONS_PER_LEVEL}`,
          intensivSessionsText: `${intensivSessionsDone} / ${INTENSIV_SESSIONS_PER_LEVEL}`,
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
        return nextRoundForStage();
      },

      beginRound(next) {
        return next ?? nextRoundForStage();
      },

      getSubquizStage: () => stage,

      getSubquizStartOption: () => startStageSelection,

      getSubquizStartOptions() {
        return [
          { id: "normal", label: "Normal" },
          { id: "anchorsOnly", label: "1 anchors" },
          { id: "intensivOnly", label: "2 intensiv" },
          {
            id: "anchorSumValuesOnly",
            label: `${STAGES.anchorSumValues.order} ${STAGES.anchorSumValues.title}`,
          },
          {
            id: "rapidAnchorAdditions",
            label: `${STAGES.rapidAnchorAdditions.order} ${STAGES.rapidAnchorAdditions.title}`,
          },
          {
            id: "effectiveAnchorAddition",
            label: `${STAGES.effectiveAnchorAddition.order} ${STAGES.effectiveAnchorAddition.title}`,
          },
          {
            id: "nonAnchorProducts",
            label: `${STAGES.nonAnchorProducts.order} ${STAGES.nonAnchorProducts.title}`,
          },
        ];
      },

      setSubquizStartOption(stageId) {
        if (!START_OPTIONS[stageId]) return false;
        startStageSelection = stageId;
        writeStartStage(stageId);
        resetLevelState();
        return true;
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
