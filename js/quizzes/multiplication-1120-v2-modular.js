(function (global) {
  "use strict";

  const QUIZ_ID = "multiplication-1120-v2-modular";
  const QUIZ_TITLE = "T*/ 11-20 v2 - Clonat - Modular";
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 10;
  const ANCHORS = [2, 3, 4, 5, 15];
  const SUBQUIZ_ANCHORS = [1, 2, 3, 4, 5, 10, 15, 20];
  const NONANCHORS = [6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19];
  const START_STAGE_KEY = "yl:mul1120v2mod:startStage";
  const DEFAULT_START_STAGE = "normal";
  const HINT = "Alege raspunsul corect.";
  const QUESTIONS_PER_LEVEL = 21;
  const INTENSIVE_QUESTIONS = 10;
  const INTENSIVE_SESSIONS_PER_LEVEL = 2;
  const ANCHOR_SUM_MAX_QUESTIONS = 12;
  const ANCHOR_SUM_STREAK_TO_EXIT = 7;
  const RAPID_MAX_QUESTIONS = 12;
  const EFFECTIVE_MAX_QUESTIONS = 21;
  const EFFECTIVE_STREAK_TO_EXIT = 10;
  const PRODUCT_MAX_QUESTIONS = 21;
  const PRODUCT_STREAK_TO_EXIT = NONANCHORS.length;
  const PRODUCT_DOMAIN_QUESTION_COUNT = 15;
  const PRODUCT_DOMAINS = [
    { id: "6-10", min: 6, max: 10 },
    { id: "11-15", min: 11, max: 15 },
    { id: "16-20", min: 16, max: 20 },
  ];
  const FAST_MS = 1500;

  const START_OPTIONS = {
    normal: {
      id: "normal",
      route: [
        "anchors",
        "anchorSumValues",
        "rapidAnchorAdditions",
        "effectiveAnchorAddition",
        "nonAnchorProducts",
        "domainProducts",
      ],
    },
    anchorsOnly: { id: "anchorsOnly", route: ["anchors"] },
    intensivOnly: { id: "intensivOnly", route: ["intensiv"] },
    anchorSumValuesOnly: { id: "anchorSumValuesOnly", route: ["anchorSumValues"] },
    rapidAnchorAdditions: { id: "rapidAnchorAdditions", route: ["rapidAnchorAdditions"] },
    effectiveAnchorAddition: {
      id: "effectiveAnchorAddition",
      route: ["effectiveAnchorAddition"],
    },
    nonAnchorProducts: { id: "nonAnchorProducts", route: ["nonAnchorProducts"] },
    domainProducts: { id: "domainProducts", route: ["domainProducts"] },
  };

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
      if (stored && START_OPTIONS[stored]) return stored;
    } catch (err) {
      // Ignore storage failures.
    }
    return DEFAULT_START_STAGE;
  }

  function writeStartStage(stageId) {
    try {
      global.localStorage?.setItem?.(START_STAGE_KEY, stageId);
    } catch (err) {
      // Ignore storage failures.
    }
  }

  function formatMs(ms) {
    if (ms == null || !Number.isFinite(ms)) return "-";
    return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
  }

  function sameLastDigitOptions(correctNum, shuffle) {
    const correct = Number(correctNum);
    const lastDigit = ((correct % 10) + 10) % 10;
    const used = new Set([correct]);
    const candidates = [];

    function tryAdd(value) {
      if (!Number.isFinite(value) || value <= 0 || used.has(value)) return;
      if (((value % 10) + 10) % 10 !== lastDigit) return;
      used.add(value);
      candidates.push(value);
    }

    for (let k = 1; k <= 15; k += 1) {
      tryAdd(correct - 10 * k);
      tryAdd(correct + 10 * k);
    }
    for (let delta = 1; delta <= 2; delta += 1) {
      tryAdd(correct - delta);
      tryAdd(correct + delta);
    }

    candidates.sort((a, b) => Math.abs(a - correct) - Math.abs(b - correct));
    while (candidates.length < 2) tryAdd(correct + 10 * (candidates.length + 1));

    const options = shuffle([String(correct), String(candidates[0]), String(candidates[1])]);
    return { options, correctIndex: options.indexOf(String(correct)) };
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

  function decomposeNonanchor(b) {
    if (b >= 16) return { big: 15, small: b - 15 };
    if (b >= 11) return { big: 10, small: b - 10 };
    return { big: 5, small: b - 5 };
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

  function buildAnchorPass(randomInt) {
    const order = [...ANCHORS].sort((a, b) => a - b);
    for (let i = 0; i < order.length - 1; i += 1) {
      if (randomInt(0, 1) === 0) {
        const tmp = order[i];
        order[i] = order[i + 1];
        order[i + 1] = tmp;
      }
    }
    return order;
  }

  function createQuiz(config = {}) {
    const quizId = config.quizId ?? QUIZ_ID;
    const { randomInt, shuffle } = global.GameUtils;
    const QFG = global.QFGenerator;
    const Catalog = global.FactCatalog;
    const qfTypes = QFG.getActiveQFTypes(QF_PROFILE).filter(
      (type) => type.answerType === "number"
    );

    let level = MIN_LEVEL;
    let completed = false;
    let startStageSelection = readStartStage();
    let orchestrator = null;

    const shared = {
      anchorState: null,
      intensiveState: null,
      anchorSumState: null,
      rapidState: null,
      effectiveState: null,
      effectiveIntensiveState: null,
      productState: null,
      productIntensiveState: null,
      domainProductState: null,
      intensiveFactsText: [],
    };

    function factLabel(b) {
      return `${b}*${factorForLevel(level)}=?`;
    }

    function makeFact(b) {
      return Catalog.createFact({
        operation: "mul",
        values: { a: factorForLevel(level), b },
      });
    }

    function factorCapHit(state) {
      return (state.recentFactorFlags || []).slice(-4).filter(Boolean).length >= 1;
    }

    function noteFactorFlag(state, isFactor) {
      state.recentFactorFlags = state.recentFactorFlags || [];
      state.recentFactorFlags.push(Boolean(isFactor));
      if (state.recentFactorFlags.length > 5) state.recentFactorFlags.shift();
    }

    function buildQuestionForB(b, state, opts = {}) {
      const A = factorForLevel(level);
      const fact = makeFact(b);
      const excludeFactor = opts.excludeFactor === true;

      for (const type of shuffle(qfTypes)) {
        const rendered = QFG.renderQF(type, fact);
        if (!rendered || rendered.answerType !== "number") continue;
        const correct = Number(rendered.correctAnswer);
        if (!Number.isFinite(correct)) continue;
        if (correct === A && (excludeFactor || factorCapHit(state))) continue;
        const opt = sameLastDigitOptions(correct, shuffle);
        noteFactorFlag(state, correct === A);
        return {
          prompt: rendered.prompt,
          correctAnswer: correct,
          options: opt.options,
          correctIndex: opt.correctIndex,
          metadata: { factB: b, qfTypeId: type.id },
        };
      }

      const correct = A * b;
      const opt = sameLastDigitOptions(correct, shuffle);
      noteFactorFlag(state, correct === A);
      return {
        prompt: `${A}*${b}=?`,
        correctAnswer: correct,
        options: opt.options,
        correctIndex: opt.correctIndex,
        metadata: { factB: b, fallback: true },
      };
    }

    function pickAnchorB(state) {
      if (!state.anchorQueue?.length) state.anchorQueue = buildAnchorPass(randomInt);
      return state.anchorQueue.shift();
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

      return {
        prompt,
        correctAnswer: A * missingAnchor,
        options: opt.options,
        correctIndex: opt.correctIndex,
        metadata: {
          factB: b,
          missingAnchor,
          shownAnchor,
          subquiz: "anchorSumValues",
        },
      };
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
      if ((bigDivisibleByTen || smallDivisibleByTen) && !shouldRoundToHundred) {
        return null;
      }

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

    function buildRapidNoCandidatesQuestion() {
      return {
        prompt: "no candidates",
        correctAnswer: 0,
        options: ["0", "1", "2"],
        correctIndex: 0,
        metadata: { subquiz: "rapidAnchorAdditions", noCandidates: true },
      };
    }

    function pickRapidCandidate(state) {
      const candidates = state.candidates ?? [];
      if (!candidates.length) return null;
      if (candidates.length === 1) return candidates[0];

      let available = candidates.filter((candidate) => candidate.prompt !== state.lastPrompt);
      if (!available.length) available = candidates;
      const picked = available[state.candidateIndex % available.length];
      state.candidateIndex += 1;
      return picked;
    }

    function buildRapidQuestion(state) {
      const candidate = pickRapidCandidate(state);
      if (!candidate) return buildRapidNoCandidatesQuestion();

      const opt = nearbyNumberOptions(candidate.correct, shuffle);
      state.lastPrompt = candidate.prompt;
      return {
        prompt: candidate.prompt,
        correctAnswer: candidate.correct,
        options: opt.options,
        correctIndex: opt.correctIndex,
        metadata: {
          factB: candidate.b,
          subquiz: "rapidAnchorAdditions",
          strategy: candidate.strategy,
          bigTerm: candidate.bigTerm,
          smallTerm: candidate.smallTerm,
        },
      };
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
        correctAnswer: candidate.correct,
        options: opt.options,
        correctIndex: opt.correctIndex,
        metadata: {
          factB: candidate.b,
          subquiz: "effectiveAnchorAddition",
          bigTerm: candidate.bigTerm,
          smallTerm: candidate.smallTerm,
        },
      };
    }

    function buildEffectiveEffOptions(candidate, qfType) {
      const fact = makeEffectiveFact(candidate);
      const built = QFG.buildOptions(qfType, fact, shuffle);
      if (!built || built.answerType !== "number") return null;
      return {
        prompt: built.prompt,
        correctAnswer: Number(built.options[built.correctIndex]),
        options: built.options,
        correctIndex: built.correctIndex,
        metadata: {
          factB: candidate.b,
          subquiz: "effectiveAnchorAdditionIntensive",
          qfTypeId: qfType.id,
          bigTerm: candidate.bigTerm,
          smallTerm: candidate.smallTerm,
        },
      };
    }

    function dueEffectiveRetry(state) {
      const due = state.retryQueue.filter((entry) => entry.dueTurn <= state.turnCount);
      if (!due.length) return null;
      due.sort((a, b) => a.dueTurn - b.dueTurn);
      const picked = due[0];
      state.retryQueue = state.retryQueue.filter((entry) => entry !== picked);
      return buildEffectiveCandidateForB(picked.b);
    }

    function pickEffectiveCandidate(state) {
      const retry = dueEffectiveRetry(state);
      if (retry && retry.prompt !== state.lastPrompt) return retry;

      const candidates = NONANCHORS.map(buildEffectiveCandidateForB);
      let available = candidates.filter((candidate) => candidate.prompt !== state.lastPrompt);
      if (!available.length) available = candidates;

      if (state.lastB != null && available.length > 1) {
        const nearby = available.filter((candidate) => Math.abs(candidate.b - state.lastB) <= 3);
        if (nearby.length) return nearby[randomInt(0, nearby.length - 1)];

        const minDistance = Math.min(
          ...available.map((candidate) => Math.abs(candidate.b - state.lastB))
        );
        const closest = available.filter(
          (candidate) => Math.abs(candidate.b - state.lastB) === minDistance
        );
        return closest[randomInt(0, closest.length - 1)];
      }

      const picked = available[randomInt(0, available.length - 1)];
      state.candidateIndex += 1;
      return picked;
    }

    function buildEffectiveQuestion(state) {
      const candidate = pickEffectiveCandidate(state);
      const item = buildEffectiveOptions(candidate);
      state.lastPrompt = candidate.prompt;
      state.lastB = candidate.b;
      state.turnCount += 1;
      return item;
    }

    function scheduleEffectiveRetry(state, b) {
      const dueTurn = state.turnCount + randomInt(2, 5);
      state.retryQueue = state.retryQueue.filter((entry) => entry.b !== b);
      state.retryQueue.push({ b, dueTurn });
    }

    function noteEffectiveMistake(state, b) {
      state.errorCounts[b] = (state.errorCounts[b] ?? 0) + 1;
      if (state.errorCounts[b] >= 2 && !state.problemBs.includes(b)) {
        state.problemBs.push(b);
      }
      scheduleEffectiveRetry(state, b);
    }

    function buildEffectiveIntensiveQueue(problemBs) {
      const entries = [];
      problemBs.slice(0, 2).forEach((b) => {
        const candidate = buildEffectiveCandidateForB(b);
        const validTypes = qfTypes.filter((qfType) => {
          const built = buildEffectiveEffOptions(candidate, qfType);
          return built && Number.isFinite(Number(built.correctAnswer));
        });
        validTypes.slice(0, 5).forEach((qfType) => entries.push({ b, qfType }));
      });
      return shuffle(entries);
    }

    function buildEffectiveIntensiveQuestion(state) {
      const entry = state.queue[state.count] ?? state.queue[state.queue.length - 1];
      if (!entry) {
        return buildEffectiveOptions(buildEffectiveCandidateForB(NONANCHORS[0]));
      }
      const candidate = buildEffectiveCandidateForB(entry.b);
      return buildEffectiveEffOptions(candidate, entry.qfType) ?? buildEffectiveOptions(candidate);
    }

    function prepareEffectiveIntensive(state) {
      const trainingBs = state.problemBs.slice(0, 2);
      shared.intensiveFactsText = trainingBs.map((b) => buildEffectiveCandidateForB(b).prompt);
      trainingBs.forEach((b) => {
        state.errorCounts[b] = 0;
      });
      state.problemBs = state.problemBs.filter((b) => !trainingBs.includes(b));
      state.retryQueue = state.retryQueue.filter((entry) => !trainingBs.includes(entry.b));
      return trainingBs;
    }

    function buildProductPass() {
      return [...NONANCHORS];
    }

    function pickProductB(state) {
      if (!state.queue.length) state.queue = buildProductPass();
      return state.queue.shift();
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
      return {
        prompt: `${b}*${A}=?`,
        correctAnswer: correct,
        options: opt.options,
        correctIndex: opt.correctIndex,
        metadata: {
          factB: b,
          subquiz: "nonAnchorProducts",
        },
      };
    }

    function buildProductQuestion(state) {
      return buildProductQuestionForB(pickProductB(state));
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

    function buildProductIntensiveQuestion(state) {
      const entry = state.queue[state.count] ?? state.queue[state.queue.length - 1];
      if (!entry) return buildProductQuestionForB(NONANCHORS[0]);

      const fact = makeProductFact(entry.b);
      const built = QFG.buildOptions(entry.qfType, fact, shuffle);
      if (!built || built.answerType !== "number") return buildProductQuestionForB(entry.b);

      return {
        prompt: built.prompt,
        correctAnswer: Number(built.options[built.correctIndex]),
        options: built.options,
        correctIndex: built.correctIndex,
        metadata: {
          factB: entry.b,
          subquiz: "nonAnchorProductsIntensive",
          qfTypeId: entry.qfType.id,
        },
      };
    }

    function prepareProductIntensive(state) {
      const trainingBs = state.wrongBs.slice(0, 2);
      shared.intensiveFactsText = trainingBs.map((b) => `${b}*${factorForLevel(level)}=?`);
      state.wrongBs = state.wrongBs.filter((b) => !trainingBs.includes(b));
      return trainingBs;
    }

    function factorsForProductDomain(domain) {
      const factors = [];
      for (let b = domain.min; b <= domain.max; b += 1) factors.push(b);
      return factors;
    }

    function buildDomainProductOptions(correct, product) {
      const wrong = [];
      const addWrong = (value) => {
        if (value < 0 || value === correct || wrong.includes(value)) return;
        wrong.push(value);
      };

      if (correct === product) {
        [10, 20, 30].forEach((delta) => {
          addWrong(correct - delta);
          addWrong(correct + delta);
        });
      } else {
        [1, 2, 3].forEach((delta) => {
          addWrong(correct - delta);
          addWrong(correct + delta);
        });
      }

      while (wrong.length < 2) addWrong(correct + wrong.length + 1);

      const options = shuffle([String(correct), String(wrong[0]), String(wrong[1])]);
      return { options, correctIndex: options.indexOf(String(correct)) };
    }

    function buildDomainProductItem(b, qfType) {
      const product = factorForLevel(level) * b;
      const fact = Catalog.createFact({
        operation: "mul",
        values: { a: factorForLevel(level), b },
      });
      const built = QFG.buildOptions(qfType, fact, shuffle);
      if (!built || built.answerType !== "number") return null;
      const correct = Number(built.options[built.correctIndex]);
      if (!Number.isFinite(correct) || correct === factorForLevel(level)) return null;
      const opt = buildDomainProductOptions(correct, product);

      return {
        prompt: built.prompt,
        correctAnswer: correct,
        options: opt.options,
        correctIndex: opt.correctIndex,
        metadata: {
          factB: b,
          subquiz: "domainProducts",
          qfTypeId: qfType.id,
          domainId: null,
        },
      };
    }

    function avoidImmediateDomainFactRepeats(entries, limit) {
      const pool = [...entries];
      const ordered = [];

      while (pool.length && ordered.length < limit) {
        const previousFact = ordered[ordered.length - 1]?.metadata?.factB;
        let nextIndex = 0;
        if (previousFact != null && pool[0]?.metadata?.factB === previousFact) {
          const alternateIndex = pool.findIndex((item) => item.metadata?.factB !== previousFact);
          if (alternateIndex >= 0) nextIndex = alternateIndex;
        }
        ordered.push(pool.splice(nextIndex, 1)[0]);
      }

      return ordered;
    }

    function buildDomainProductQueue(domain) {
      const entries = [];
      const factors = factorsForProductDomain(domain);
      qfTypes.forEach((qfType) => {
        factors.forEach((b) => {
          const item = buildDomainProductItem(b, qfType);
          if (item) {
            item.metadata.domainId = domain.id;
            entries.push(item);
          }
        });
      });
      return avoidImmediateDomainFactRepeats(shuffle(entries), PRODUCT_DOMAIN_QUESTION_COUNT);
    }

    function enterNextProductDomain(state) {
      const domain = state.domainOrder[state.domainIndex] ?? null;
      state.currentDomain = domain;
      state.currentDomainCount = 0;
      state.currentQueue = domain ? buildDomainProductQueue(domain) : [];
    }

    function buildDomainProductQuestion(state) {
      if (!state.currentDomain) enterNextProductDomain(state);
      if (!state.currentQueue.length) {
        state.domainIndex += 1;
        enterNextProductDomain(state);
      }

      const item = state.currentQueue.shift();
      if (!item) {
        return {
          prompt: "Final subquiz 7",
          correctAnswer: 0,
          options: ["0", "1", "2"],
          correctIndex: 0,
          metadata: { subquiz: "domainProducts", complete: true },
        };
      }
      return item;
    }

    function buildIntensiveQueue(facts) {
      const [b1, b2] = facts;
      return shuffle([...Array(5).fill(b1), ...Array(5).fill(b2)]);
    }

    function roundViewFrom(runtime, extra = {}) {
      return runtime.view({
        hintMessage: HINT,
        ...extra,
      });
    }

    // Motor 3 butoane (M3B) — vezi documente de referinta/PLAN-motor-comun-raspuns.md, Faza E.
    // Fiecare subquiz de mai jos da doar date (esteCorect/generator/actiuni/mesaje);
    // subquiz-definition.js construieste UN SINGUR Motor3Butoane per subquiz activ (nu unul
    // nou la fiecare apasare, ca in tiparul dinainte de Faza E) si deleaga orice apasare la
    // el — CUM raspunde nu mai e treaba fisierului asta. Fixul de "pop fara view" (necesar ca
    // `onResume` sa nu fie ingropat de view-ul automat al M3B) e centralizat acum in
    // subquiz-definition.js, nu mai trebuie reimplementat aici.
    //
    // `esteCorect` pastrat identic cu vechiul cod (Number(...) === Number(...), fara fallback
    // pe string) — toate intrebarile de-aici sunt numerice, nicio schimbare de comportament.
    //
    // CORECTIE INTENTIONATA majora (Categoriile 3 si 6 din FAZA-A-inventar-contract.md),
    // mostenita din migrarea la Motor3Butoane (Faza D, Lotul 4) — TOATE cele 9 subquizuri
    // aveau cel putin o forma din bug-ul original sq3/sq5, reparata atunci, nu se re-repara
    // acum: pragurile numara doar la raspunsuri REZOLVATE (corecte), niciun exit/push/pop nu
    // se poate declansa pe gresit.
    //
    // Cateva ramuri de "exit" (fara `view` propriu in codul vechi) sunt urmate, in ruta
    // "normal", de un alt subquiz care ISI arata propria intrebare — un `message` implicit
    // global ar supravietui in acel ecran (M3B nu-l suprascrie decat daca vederea noua are ea
    // insasi camp `message`). Acolo unde conta (verificat pe fiecare ramura), am pus explicit
    // `message: undefined` ca sa pastrez exact ce se vedea inainte (nimic).
    const esteCorectV2 = (it, idx) => Number(it.options[idx]) === Number(it.correctAnswer);
    const mesajeStandard = {
      corect: "Corect!",
      gresit: (ctx) => `${ctx.alesul} nu e bun. Mai incearca!`,
    };

    function anchorDefinition() {
      return global.SubquizDefinition.define({
        id: "anchors",
        title: "anchors",
        hintMessage: HINT,
        esteCorect: esteCorectV2,
        mesaje: mesajeStandard,
        initialState() {
          const state = {
            answeredCount: 0,
            wrongFacts: [],
            lastCorrectByB: {},
            intensiveSessionsDone: 0,
            anchorQueue: [],
            recentFactorFlags: [],
          };
          shared.anchorState = state;
          shared.intensiveFactsText = [];
          return state;
        },
        generator({ state }) {
          const b = pickAnchorB(state);
          return buildQuestionForB(b, state);
        },
        onResume({ state, payload, runtime }) {
          if (payload?.intensiveCompleted) {
            state.intensiveSessionsDone += 1;
            if (state.intensiveSessionsDone >= INTENSIVE_SESSIONS_PER_LEVEL) {
              return {
                action: "exit",
                reason: "intensiveSessionsComplete",
                view: {
                  outcome: "step-correct",
                  correct: true,
                  bounce: true,
                  flash: "win",
                  message: "Subquiz 3: valori ancore suma",
                },
              };
            }
          }
          runtime.nextItem({ reason: "resume" });
          return {
            action: "continue",
            view: roundViewFrom(runtime, {
              outcome: "step-correct",
              correct: true,
              bounce: true,
              message: "Inapoi la test anchors.",
            }),
          };
        },
        actiuni: {
          dupaApasare(ctx) {
            if (!ctx.corect) {
              const factB = ctx.item.metadata.factB;
              if (!ctx.stare.wrongFacts.some((fact) => fact.b === factB)) {
                ctx.stare.wrongFacts.push({ b: factB, label: factLabel(factB) });
              }
            }
          },
          dupaRaspunsCorect(ctx) {
            const state = ctx.stare;
            const factB = ctx.item.metadata.factB;
            state.answeredCount += 1;
            state.lastCorrectByB[factB] = ctx.meta.responseMs ?? null;

            if (state.wrongFacts.length >= 2 && startStageSelection !== "anchorsOnly") {
              const facts = state.wrongFacts.map((fact) => fact.b);
              shared.intensiveFactsText = state.wrongFacts.map((fact) => fact.label);
              state.wrongFacts = [];
              return {
                action: "push",
                targetId: "intensiv",
                payload: { facts, returnToPrevious: true },
                view: {
                  message: `Mod intensiv: antrenament pe ${shared.intensiveFactsText.join(", ")}`,
                },
              };
            }

            if (state.answeredCount >= QUESTIONS_PER_LEVEL) {
              return {
                action: "exit",
                reason: "answeredCount",
                view: { flash: "win", message: "Subquiz 3: valori ancore suma" },
              };
            }
            // altfel: ramane in "anchors" — Motor3Butoane cere generator-ul automat.
          },
        },
        onTimeout({ runtime }) {
          return {
            action: "stay",
            view: roundViewFrom(runtime, {
              outcome: "round",
              resetFall: true,
            }),
          };
        },
      });
    }

    function intensiveDefinition() {
      return global.SubquizDefinition.define({
        id: "intensiv",
        title: "intensiv",
        hintMessage: HINT,
        esteCorect: esteCorectV2,
        mesaje: {
          gresit: mesajeStandard.gresit,
          corect: (ctx) => `Intensiv ${ctx.stare.count + 1}/${INTENSIVE_QUESTIONS}`,
        },
        initialState({ payload }) {
          const facts = Array.isArray(payload?.facts) && payload.facts.length >= 2
            ? payload.facts.slice(0, 2)
            : [2, 3];
          const state = {
            facts,
            returnToPrevious: payload?.returnToPrevious === true,
            count: 0,
            queue: buildIntensiveQueue(facts),
            recentFactorFlags: [],
          };
          shared.intensiveState = state;
          shared.intensiveFactsText = facts.map((b) => factLabel(b));
          return state;
        },
        generator({ state }) {
          const b = state.queue[state.count] ?? state.queue[state.queue.length - 1];
          return buildQuestionForB(b, state, { excludeFactor: true });
        },
        actiuni: {
          dupaRaspunsCorect(ctx) {
            const state = ctx.stare;
            state.count += 1;
            if (state.count >= INTENSIVE_QUESTIONS) {
              if (state.returnToPrevious) {
                return {
                  action: "pop",
                  reason: "intensiveComplete",
                  payload: { intensiveCompleted: true },
                };
              }
              // Singurul caz posibil aici (fara returnToPrevious): ruta "intensivOnly",
              // unde "intensiv" e singurul subquiz — exit duce direct la routeComplete,
              // view-ul de mai jos nu ajunge niciodata vizibil (pastrat explicit ca sa nu
              // depinda de asta implicit).
              return { action: "exit", reason: "intensiveComplete", view: { message: undefined } };
            }
            // altfel: ramane in "intensiv" — Motor3Butoane cere generator-ul automat.
          },
        },
        onTimeout({ runtime }) {
          return {
            action: "stay",
            view: roundViewFrom(runtime, {
              outcome: "round",
              resetFall: true,
            }),
          };
        },
      });
    }

    function anchorSumDefinition() {
      return global.SubquizDefinition.define({
        id: "anchorSumValues",
        title: "valori ancore suma",
        hintMessage: HINT,
        esteCorect: esteCorectV2,
        mesaje: mesajeStandard,
        initialState() {
          const state = {
            questionCount: 0,
            correctStreak: 0,
          };
          shared.anchorSumState = state;
          return state;
        },
        generator() {
          return buildAnchorSumQuestion();
        },
        actiuni: {
          dupaApasare(ctx) {
            if (!ctx.corect) ctx.stare.correctStreak = 0;
          },
          dupaRaspunsCorect(ctx) {
            const state = ctx.stare;
            state.questionCount += 1;
            state.correctStreak += 1;

            if (
              state.questionCount >= ANCHOR_SUM_MAX_QUESTIONS ||
              state.correctStreak >= ANCHOR_SUM_STREAK_TO_EXIT
            ) {
              return {
                action: "exit",
                reason:
                  state.correctStreak >= ANCHOR_SUM_STREAK_TO_EXIT ? "correctStreak" : "questionCount",
                // Fara `view` propriu in codul vechi. Ruta "normal" continua cu
                // "rapidAnchorAdditions" imediat dupa — un `message` implicit ar
                // supravietui in vederea primei intrebari de-acolo. Pastram exact ce
                // se vedea inainte (nimic).
                view: { message: undefined },
              };
            }
            // altfel: ramane in "anchorSumValues" — Motor3Butoane cere generator-ul automat.
          },
        },
        onTimeout({ runtime }) {
          return {
            action: "stay",
            view: roundViewFrom(runtime, {
              outcome: "round",
              resetFall: true,
            }),
          };
        },
      });
    }

    function rapidAnchorDefinition() {
      return global.SubquizDefinition.define({
        id: "rapidAnchorAdditions",
        title: "adunari rapide cu ancore",
        hintMessage: HINT,
        esteCorect: esteCorectV2,
        mesaje: mesajeStandard,
        initialState() {
          const candidates = NONANCHORS.map(buildRapidCandidateForB).filter(Boolean);
          const state = {
            candidates,
            candidateIndex: 0,
            questionCount: 0,
            correctStreak: 0,
            lastPrompt: null,
          };
          shared.rapidState = state;
          return state;
        },
        generator({ state }) {
          return buildRapidQuestion(state);
        },
        actiuni: {
          dupaApasare(ctx) {
            if (!ctx.corect) ctx.stare.correctStreak = 0;
          },
          dupaRaspunsCorect(ctx) {
            const state = ctx.stare;
            const candidateCount = state.candidates.length;

            if (candidateCount === 0) {
              return {
                action: "exit",
                reason: "rapidNoCandidates",
                view: { flash: "win", message: "no candidates, mai departe" },
              };
            }

            state.questionCount += 1;
            state.correctStreak += 1;

            const multipleCandidateLimit = Math.min(RAPID_MAX_QUESTIONS, candidateCount * 3);
            if (candidateCount > 1 && state.questionCount >= multipleCandidateLimit) {
              return {
                action: "exit",
                reason: "rapidQuestionLimit",
                view: { flash: "win", message: "ai terminat subquiz 4 modular" },
              };
            }

            if (candidateCount === 1) {
              return {
                action: "exit",
                reason: "rapidSingleCorrect",
                view: { flash: "win", message: "ai terminat subquiz 4 modular" },
              };
            }
            // altfel: ramane in "rapidAnchorAdditions" — Motor3Butoane cere generator-ul automat.
          },
        },
        onTimeout({ runtime }) {
          return {
            action: "stay",
            view: roundViewFrom(runtime, {
              outcome: "round",
              resetFall: true,
            }),
          };
        },
      });
    }

    function effectiveAnchorDefinition() {
      return global.SubquizDefinition.define({
        id: "effectiveAnchorAddition",
        title: "adunare efectiva ancore",
        hintMessage: HINT,
        esteCorect: esteCorectV2,
        mesaje: mesajeStandard,
        initialState() {
          const state = {
            questionCount: 0,
            correctStreak: 0,
            candidateIndex: 0,
            lastPrompt: null,
            lastB: null,
            turnCount: 0,
            errorCounts: {},
            problemBs: [],
            retryQueue: [],
          };
          shared.effectiveState = state;
          shared.effectiveIntensiveState = null;
          return state;
        },
        generator({ state }) {
          return buildEffectiveQuestion(state);
        },
        onResume({ runtime }) {
          runtime.nextItem({ reason: "effectiveIntensiveReturn" });
          return {
            action: "continue",
            view: roundViewFrom(runtime, {
              outcome: "step-correct",
              correct: true,
              bounce: true,
              message: "Inapoi la subquiz 5.",
            }),
          };
        },
        actiuni: {
          dupaApasare(ctx) {
            if (!ctx.corect) {
              ctx.stare.correctStreak = 0;
              noteEffectiveMistake(ctx.stare, ctx.item.metadata.factB);
            }
          },
          dupaRaspunsCorect(ctx) {
            const state = ctx.stare;
            state.questionCount += 1;
            state.correctStreak += 1;

            if (
              state.questionCount >= EFFECTIVE_MAX_QUESTIONS ||
              state.correctStreak >= EFFECTIVE_STREAK_TO_EXIT
            ) {
              return {
                action: "exit",
                reason:
                  state.correctStreak >= EFFECTIVE_STREAK_TO_EXIT
                    ? "effectiveCorrectStreak"
                    : "effectiveQuestionCount",
                view: { flash: "win", message: "ai terminat subquiz 5 modular" },
              };
            }

            if (state.problemBs.length >= 2) {
              const facts = prepareEffectiveIntensive(state);
              return {
                action: "push",
                targetId: "effectiveAnchorAdditionIntensive",
                payload: { facts },
                view: { message: `Mod intensiv subquiz 5: ${shared.intensiveFactsText.join(", ")}` },
              };
            }
            // altfel: ramane in "effectiveAnchorAddition" — Motor3Butoane cere generator-ul automat.
          },
        },
        onTimeout({ runtime }) {
          return {
            action: "stay",
            view: roundViewFrom(runtime, {
              outcome: "round",
              resetFall: true,
            }),
          };
        },
      });
    }

    function effectiveAnchorIntensiveDefinition() {
      return global.SubquizDefinition.define({
        id: "effectiveAnchorAdditionIntensive",
        title: "intensiv adunare efectiva ancore",
        hintMessage: HINT,
        esteCorect: esteCorectV2,
        mesaje: {
          gresit: mesajeStandard.gresit,
          corect: (ctx) => `Intensiv subquiz 5 ${ctx.stare.count + 1}/${ctx.stare.queue.length || 10}`,
        },
        initialState({ payload }) {
          const facts = Array.isArray(payload?.facts) && payload.facts.length >= 2
            ? payload.facts.slice(0, 2)
            : NONANCHORS.slice(0, 2);
          const state = {
            facts,
            count: 0,
            queue: buildEffectiveIntensiveQueue(facts),
          };
          shared.effectiveIntensiveState = state;
          shared.intensiveFactsText = facts.map((b) => buildEffectiveCandidateForB(b).prompt);
          return state;
        },
        generator({ state }) {
          return buildEffectiveIntensiveQuestion(state);
        },
        actiuni: {
          dupaRaspunsCorect(ctx) {
            const state = ctx.stare;
            state.count += 1;
            if (state.count >= state.queue.length) {
              return {
                action: "pop",
                reason: "effectiveIntensiveComplete",
                payload: { effectiveIntensiveCompleted: true, facts: state.facts },
              };
            }
            // altfel: ramane — Motor3Butoane cere generator-ul automat.
          },
        },
        onTimeout({ runtime }) {
          return {
            action: "stay",
            view: roundViewFrom(runtime, {
              outcome: "round",
              resetFall: true,
            }),
          };
        },
      });
    }

    function nonAnchorProductsDefinition() {
      return global.SubquizDefinition.define({
        id: "nonAnchorProducts",
        title: "inmultiri non-anchors",
        hintMessage: HINT,
        esteCorect: esteCorectV2,
        mesaje: mesajeStandard,
        initialState() {
          const state = {
            questionCount: 0,
            correctStreak: 0,
            wrongBs: [],
            queue: [],
          };
          shared.productState = state;
          shared.productIntensiveState = null;
          return state;
        },
        generator({ state }) {
          return buildProductQuestion(state);
        },
        onResume({ runtime }) {
          runtime.nextItem({ reason: "productIntensiveReturn" });
          return {
            action: "continue",
            view: roundViewFrom(runtime, {
              outcome: "step-correct",
              correct: true,
              bounce: true,
              message: "Inapoi la subquiz 6.",
            }),
          };
        },
        actiuni: {
          dupaApasare(ctx) {
            if (!ctx.corect) {
              const factB = ctx.item.metadata.factB;
              ctx.stare.correctStreak = 0;
              if (!ctx.stare.wrongBs.includes(factB)) ctx.stare.wrongBs.push(factB);
            }
          },
          dupaRaspunsCorect(ctx) {
            const state = ctx.stare;
            state.questionCount += 1;
            state.correctStreak += 1;

            if (
              state.correctStreak >= PRODUCT_STREAK_TO_EXIT ||
              state.questionCount >= PRODUCT_MAX_QUESTIONS
            ) {
              return {
                action: "exit",
                reason:
                  state.correctStreak >= PRODUCT_STREAK_TO_EXIT
                    ? "productCorrectStreak"
                    : "productQuestionCount",
                view: { flash: "win", message: "ai terminat subquiz 6 modular" },
              };
            }

            if (state.wrongBs.length >= 2) {
              const facts = prepareProductIntensive(state);
              return {
                action: "push",
                targetId: "nonAnchorProductsIntensive",
                payload: { facts },
                view: { message: `Mod intensiv subquiz 6: ${shared.intensiveFactsText.join(", ")}` },
              };
            }
            // altfel: ramane in "nonAnchorProducts" — Motor3Butoane cere generator-ul automat.
          },
        },
        onTimeout({ runtime }) {
          return {
            action: "stay",
            view: roundViewFrom(runtime, {
              outcome: "round",
              resetFall: true,
            }),
          };
        },
      });
    }

    function nonAnchorProductsIntensiveDefinition() {
      return global.SubquizDefinition.define({
        id: "nonAnchorProductsIntensive",
        title: "intensiv inmultiri non-anchors",
        hintMessage: HINT,
        esteCorect: esteCorectV2,
        mesaje: {
          gresit: mesajeStandard.gresit,
          corect: (ctx) => `Intensiv subquiz 6 ${ctx.stare.count + 1}/${ctx.stare.queue.length || 10}`,
        },
        initialState({ payload }) {
          const facts = Array.isArray(payload?.facts) && payload.facts.length >= 2
            ? payload.facts.slice(0, 2)
            : NONANCHORS.slice(0, 2);
          const state = {
            facts,
            count: 0,
            queue: buildProductIntensiveQueue(facts),
          };
          shared.productIntensiveState = state;
          shared.intensiveFactsText = facts.map((b) => `${b}*${factorForLevel(level)}=?`);
          return state;
        },
        generator({ state }) {
          return buildProductIntensiveQuestion(state);
        },
        actiuni: {
          dupaRaspunsCorect(ctx) {
            const state = ctx.stare;
            state.count += 1;
            if (state.count >= state.queue.length) {
              return {
                action: "pop",
                reason: "productIntensiveComplete",
                payload: { productIntensiveCompleted: true, facts: state.facts },
              };
            }
            // altfel: ramane — Motor3Butoane cere generator-ul automat.
          },
        },
        onTimeout({ runtime }) {
          return {
            action: "stay",
            view: roundViewFrom(runtime, {
              outcome: "round",
              resetFall: true,
            }),
          };
        },
      });
    }

    function domainProductsDefinition() {
      return global.SubquizDefinition.define({
        id: "domainProducts",
        title: "domenii non-anchors EFF",
        hintMessage: HINT,
        esteCorect: esteCorectV2,
        mesaje: {
          gresit: mesajeStandard.gresit,
          // `currentDomainCount` e resetat la 0 chiar inainte, de `enterNextProductDomain`
          // (in dupaRaspunsCorect), DOAR cand tocmai s-a trecut la un domeniu nou — restul
          // timpului e >=1. E singurul semnal disponibil aici (actiuni.* nu au acces la
          // "ce fel de tranzitie tocmai s-a intamplat", doar la starea deja mutata).
          corect: (ctx) =>
            ctx.stare.currentDomainCount === 0
              ? `Domeniul urmator: ${ctx.stare.currentDomain?.id}`
              : "Corect!",
        },
        initialState() {
          const state = {
            domainOrder: shuffle([...PRODUCT_DOMAINS]),
            domainIndex: 0,
            currentDomain: null,
            currentDomainCount: 0,
            totalCount: 0,
            currentQueue: [],
          };
          enterNextProductDomain(state);
          shared.domainProductState = state;
          return state;
        },
        generator({ state }) {
          shared.domainProductState = state;
          return buildDomainProductQuestion(state);
        },
        actiuni: {
          dupaRaspunsCorect(ctx) {
            const state = ctx.stare;
            if (ctx.item.metadata?.complete) {
              return {
                action: "exit",
                reason: "domainProductsComplete",
                view: { flash: "win", message: "ai terminat subquiz 7 modular" },
              };
            }

            state.currentDomainCount += 1;
            state.totalCount += 1;

            if (state.currentDomainCount >= PRODUCT_DOMAIN_QUESTION_COUNT) {
              state.domainIndex += 1;
              if (state.domainIndex >= state.domainOrder.length) {
                return {
                  action: "exit",
                  reason: "domainProductsComplete",
                  view: { flash: "win", message: "ai terminat subquiz 7 modular" },
                };
              }
              enterNextProductDomain(state);
              // altfel: ramane, cu domeniul nou — Motor3Butoane cere generator-ul automat;
              // `mesaje.corect` de mai sus detecteaza `currentDomainCount === 0` (proaspat
              // resetat) ca sa arate "Domeniul urmator: X" in loc de "Corect!".
            }
            // altfel: ramane in domeniul curent — Motor3Butoane cere generator-ul automat.
          },
        },
        onTimeout({ runtime }) {
          return {
            action: "stay",
            view: roundViewFrom(runtime, {
              outcome: "round",
              resetFall: true,
            }),
          };
        },
      });
    }

    function createOrchestrator() {
      const route = START_OPTIONS[startStageSelection]?.route ?? START_OPTIONS.normal.route;
      orchestrator = global.SubquizOrchestrator.create({
        definitions: [
          anchorDefinition(),
          intensiveDefinition(),
          anchorSumDefinition(),
          rapidAnchorDefinition(),
          effectiveAnchorDefinition(),
          effectiveAnchorIntensiveDefinition(),
          nonAnchorProductsDefinition(),
          nonAnchorProductsIntensiveDefinition(),
          domainProductsDefinition(),
        ],
        activeSubquizIds: route,
        // Mesajul de final de nivel depinde de subquizul din care s-a iesit —
        // orchestratorul il da in eveniment, nu-l mai ghiceste quizul.
        onRouteComplete: (eveniment) => advanceLevel(eveniment.subquizId ?? "anchors"),
        context: {
          quizId,
          getLevel: () => level,
          getStartStageSelection: () => startStageSelection,
          hintMessage: HINT,
        },
      });
    }

    function resetLevelState() {
      shared.anchorState = null;
      shared.intensiveState = null;
      shared.anchorSumState = null;
      shared.rapidState = null;
      shared.effectiveState = null;
      shared.effectiveIntensiveState = null;
      shared.productState = null;
      shared.productIntensiveState = null;
      shared.domainProductState = null;
      shared.intensiveFactsText = [];
      createOrchestrator();
    }

    function activeSubquizId() {
      const currentId = orchestrator?.getCurrentId?.();
      if (currentId) return currentId;
      return START_OPTIONS[startStageSelection]?.route?.[0] ?? START_OPTIONS.normal.route[0];
    }

    function activeRouteLabel() {
      const id = activeSubquizId();
      if (id === "intensiv") return `Nivel ${level} - Subquiz 2 - intensiv`;
      if (id === "effectiveAnchorAdditionIntensive") {
        return `Nivel ${level} - Subquiz 5 - intensiv`;
      }
      if (id === "nonAnchorProductsIntensive") {
        return `Nivel ${level} - Subquiz 6 - intensiv`;
      }
      if (id === "anchorSumValues") {
        return `Nivel ${level} - Subquiz 3 - valori ancore suma`;
      }
      if (id === "rapidAnchorAdditions") {
        return `Nivel ${level} - Subquiz 4 - adunari rapide cu ancore`;
      }
      if (id === "effectiveAnchorAddition") {
        return `Nivel ${level} - Subquiz 5 - adunare efectiva ancore`;
      }
      if (id === "nonAnchorProducts") {
        return `Nivel ${level} - Subquiz 6 - inmultiri non-anchors`;
      }
      if (id === "domainProducts") {
        return `Nivel ${level} - Subquiz 7 - domenii non-anchors EFF`;
      }
      return `Nivel ${level} - Subquiz 1 - anchors (modular)`;
    }

    function beginRoute() {
      if (!orchestrator) createOrchestrator();
      return orchestrator.startFirst();
    }

    // `advanceLevel` se cheama DOAR prin `onRouteComplete`, adica din interiorul
    // orchestratorului (vezi routeComplete in js/subquiz/subquiz-orchestrator.js).
    // De-aia nu-si mai pune singura nici semnatura M3B, nici `subquizEvent`:
    // le pune orchestratorul, ca la orice alt eveniment de rutare.
    function advanceLevel(via = "anchors") {
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
        via === "domainProducts"
          ? "ai terminat subquiz 7 modular, next level"
          : via === "nonAnchorProducts"
          ? "ai terminat subquiz 6 modular, next level"
          : via === "effectiveAnchorAddition"
          ? "ai terminat subquiz 5 modular, next level"
          : via === "rapidAnchorAdditions"
          ? "ai terminat subquiz 4 modular, next level"
          : via === "anchorSumValues"
          ? "ai terminat subquiz 3 modular, next level"
          : via === "intensiv"
          ? "ai terminat intensiv modular, next level"
          : "ai terminat subquiz 1 modular, next level";
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
        banner: `Nivel ${level} - ${factorForLevel(level)}x`,
        message: `Nivel ${level}`,
        nextRound: beginRoute(),
      };
    }

    resetLevelState();

    return {
      getQuizId: () => quizId,
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getMinLevel: () => MIN_LEVEL,
      getLevelLabel: activeRouteLabel,
      getLevelButtonTitle: (targetLevel) =>
        `Nivel ${targetLevel}: ${factorForLevel(targetLevel)}x anchors modular`,
      isCompleted: () => completed,
      getProgressDisplay: () => global.ProgressDisplay.hidden(),

      switchLevel(nextLevel) {
        level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        completed = false;
        resetLevelState();
        return null;
      },

      pickNextRound() {
        return beginRoute();
      },

      beginRound(next) {
        return next ?? beginRoute();
      },

      getSubquizStage: activeSubquizId,
      getSubquizStartOption: () => startStageSelection,
      getSubquizStartOptions() {
        return [
          { id: "normal", label: "Normal" },
          { id: "anchorsOnly", label: "1 anchors" },
          { id: "intensivOnly", label: "2 intensiv" },
          { id: "anchorSumValuesOnly", label: "3 valori ancore suma" },
          { id: "rapidAnchorAdditions", label: "4 adunari rapide cu ancore" },
          { id: "effectiveAnchorAddition", label: "5 adunare efectiva ancore" },
          { id: "nonAnchorProducts", label: "6 inmultiri non-anchors" },
          { id: "domainProducts", label: "7 domenii non-anchors EFF" },
        ];
      },
      setSubquizStartOption(stageId) {
        if (!START_OPTIONS[stageId]) return false;
        startStageSelection = stageId;
        writeStartStage(stageId);
        resetLevelState();
        return true;
      },

      getInfo11_20() {
        const A = factorForLevel(level);
        const anchorState = shared.anchorState;
        const intensiveState = shared.intensiveState;
        const anchorSumState = shared.anchorSumState;
        const rapidState = shared.rapidState;
        const effectiveState = shared.effectiveState;
        const effectiveIntensiveState = shared.effectiveIntensiveState;
        const productState = shared.productState;
        const productIntensiveState = shared.productIntensiveState;
        const domainProductState = shared.domainProductState;
        const currentId = activeSubquizId();
        const rapidCandidateCount = rapidState?.candidates?.length ?? 0;
        const rapidLimit =
          rapidCandidateCount > 1 ? Math.min(RAPID_MAX_QUESTIONS, rapidCandidateCount * 3) : null;
        return {
          visible: true,
          mode:
            currentId === "intensiv"
              ? "Subquiz 2: intensiv"
              : currentId === "effectiveAnchorAdditionIntensive"
              ? "Subquiz 5: intensiv"
              : currentId === "nonAnchorProductsIntensive"
              ? "Subquiz 6: intensiv"
              : currentId === "anchorSumValues"
              ? "Subquiz 3: valori ancore suma"
              : currentId === "rapidAnchorAdditions"
              ? "Subquiz 4: adunari rapide cu ancore"
              : currentId === "effectiveAnchorAddition"
              ? "Subquiz 5: adunare efectiva ancore"
              : currentId === "nonAnchorProducts"
              ? "Subquiz 6: inmultiri non-anchors"
              : currentId === "domainProducts"
              ? "Subquiz 7: domenii non-anchors EFF"
              : "Subquiz 1: anchors modular",
          wrongFactsText: anchorState?.wrongFacts?.length
            ? anchorState.wrongFacts.map((fact) => fact.label).join(", ")
            : "-",
          intensivText: shared.intensiveFactsText.length
            ? shared.intensiveFactsText.join(", ")
            : "-",
          answeredText:
            currentId === "intensiv"
              ? `${intensiveState?.count ?? 0} / ${INTENSIVE_QUESTIONS}`
              : currentId === "effectiveAnchorAdditionIntensive"
              ? `${effectiveIntensiveState?.count ?? 0} / ${effectiveIntensiveState?.queue?.length || 10}`
              : currentId === "nonAnchorProductsIntensive"
              ? `${productIntensiveState?.count ?? 0} / ${productIntensiveState?.queue?.length || 10}`
              : currentId === "anchorSumValues"
              ? `${anchorSumState?.questionCount ?? 0} / ${ANCHOR_SUM_MAX_QUESTIONS} - streak ${anchorSumState?.correctStreak ?? 0} / ${ANCHOR_SUM_STREAK_TO_EXIT}`
              : currentId === "rapidAnchorAdditions"
              ? rapidCandidateCount === 0
                ? "no candidates"
                : rapidCandidateCount === 1
                ? `${rapidState?.questionCount ?? 0} - pana la primul corect`
                : `${rapidState?.questionCount ?? 0} / ${rapidLimit}`
              : currentId === "effectiveAnchorAddition"
              ? `${effectiveState?.questionCount ?? 0} / ${EFFECTIVE_MAX_QUESTIONS} - streak ${effectiveState?.correctStreak ?? 0} / ${EFFECTIVE_STREAK_TO_EXIT}`
              : currentId === "nonAnchorProducts"
              ? `${productState?.questionCount ?? 0} / ${PRODUCT_MAX_QUESTIONS} - perfect ${productState?.correctStreak ?? 0} / ${PRODUCT_STREAK_TO_EXIT}`
              : currentId === "domainProducts"
              ? `${domainProductState?.currentDomain?.id ?? "-"}: ${domainProductState?.currentDomainCount ?? 0} / ${PRODUCT_DOMAIN_QUESTION_COUNT} - domenii ${Math.min((domainProductState?.domainIndex ?? 0) + 1, PRODUCT_DOMAINS.length)} / ${PRODUCT_DOMAINS.length}`
              : `${anchorState?.answeredCount ?? 0} / ${QUESTIONS_PER_LEVEL}`,
          intensivSessionsText:
            `${anchorState?.intensiveSessionsDone ?? 0} / ${INTENSIVE_SESSIONS_PER_LEVEL}`,
          facts: ANCHORS.map((b) => {
            const ms = anchorState?.lastCorrectByB?.[b] ?? null;
            return {
              label: `${b}*${A}`,
              timeText: b in (anchorState?.lastCorrectByB ?? {}) ? formatMs(ms) : "-",
              fast: ms != null && ms <= FAST_MS,
            };
          }),
        };
      },

      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },

      onTimeout(meta = {}) {
        return orchestrator.onTimeout(meta);
      },
    };
  }

  global.Mul1120V2ModularQuiz = { create: createQuiz };

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: QUIZ_TITLE,
    description: "Lab modular pentru T*/ 11-20 v2. Include anchors, intensiv si subquizurile 3-6.",
    order: 2.1,
    gestionareGreseli: { activ: false },
    create(meta = {}) {
      return global.Mul1120V2ModularQuiz.create({ quizId: meta.id ?? QUIZ_ID });
    },
  });
})(window);
