(function (global) {
  "use strict";

  const QUIZ_ID = "equations-e3-e6";
  const QUIZ_TITLE = "Ecuatii cu 3 4 5 6 numere";
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 5;
  const DEFAULT_QUESTIONS_PER_RUN = 20;
  const SAME_SIGN = "same";
  const COMPLEMENTARY_SIGNS = "complementary";
  const OPS = ["+", "-", "*", "/"];
  const HINT = "Alege numarul care face ecuatia adevarata.";

  const FAMILY_DEFS = {
    E3: {
      id: "E3",
      group: "E3",
      label: "E3: a = b + c",
      shortLabel: "E3",
      left: ["a"],
      right: ["b", "c"],
    },
    E4: {
      id: "E4",
      group: "E4",
      label: "E4: a = b + c + d",
      shortLabel: "E4",
      left: ["a"],
      right: ["b", "c", "d"],
    },
    E4_BAL: {
      id: "E4_BAL",
      group: "E4",
      label: "E4 balanced: a + b = c + d",
      shortLabel: "E4 balanced",
      left: ["a", "b"],
      right: ["c", "d"],
    },
    E5: {
      id: "E5",
      group: "E5",
      label: "E5: a = b + c + d + e",
      shortLabel: "E5",
      left: ["a"],
      right: ["b", "c", "d", "e"],
    },
    E5_BAL: {
      id: "E5_BAL",
      group: "E5",
      label: "E5 balanced: a + b = c + d + e",
      shortLabel: "E5 balanced",
      left: ["a", "b"],
      right: ["c", "d", "e"],
    },
    E6: {
      id: "E6",
      group: "E6",
      label: "E6 balanced: a + b + c = d + e + f",
      shortLabel: "E6 balanced",
      left: ["a", "b", "c"],
      right: ["d", "e", "f"],
    },
  };

  const DEFAULT_CONFIG = {
    familyId: "E3",
    operators: ["+"],
    signMode: SAME_SIGN,
    showSummaryInArena: true,
    questionsPerRun: DEFAULT_QUESTIONS_PER_RUN,
  };

  const productTupleCache = new Map();

  function randomInt(min, max) {
    if (max < min) return min;
    const fn = global.GameUtils?.randomInt;
    return typeof fn === "function"
      ? fn(min, max)
      : Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffle(items) {
    const fn = global.GameUtils?.shuffle;
    return typeof fn === "function" ? fn(items) : [...items].sort(() => Math.random() - 0.5);
  }

  function pick(items) {
    return items[randomInt(0, items.length - 1)];
  }

  function clampInt(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function normalizeQuestionsPerRun(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_CONFIG.questionsPerRun;
    return Math.min(50, Math.max(5, Math.round(n)));
  }

  function maxTermForLevel(level) {
    return Math.min(9, 4 + clampInt(level, MIN_LEVEL, MAX_LEVEL));
  }

  function normalizeOperators(operators) {
    const out = [];
    (Array.isArray(operators) ? operators : []).forEach((op) => {
      if (OPS.includes(op) && !out.includes(op)) out.push(op);
    });
    return out.length ? out : ["+"];
  }

  function normalizeConfig(input = {}) {
    const familyId = FAMILY_DEFS[input.familyId] ? input.familyId : DEFAULT_CONFIG.familyId;
    return {
      familyId,
      operators: normalizeOperators(input.operators ?? DEFAULT_CONFIG.operators),
      signMode: input.signMode === COMPLEMENTARY_SIGNS ? SAME_SIGN : SAME_SIGN,
      showSummaryInArena:
        input.showSummaryInArena == null
          ? DEFAULT_CONFIG.showSummaryInArena
          : Boolean(input.showSummaryInArena),
      questionsPerRun: normalizeQuestionsPerRun(
        input.questionsPerRun ?? DEFAULT_CONFIG.questionsPerRun
      ),
    };
  }

  function sum(values) {
    return values.reduce((acc, value) => acc + value, 0);
  }

  function product(values) {
    return values.reduce((acc, value) => acc * value, 1);
  }

  function evalSide(values, op) {
    if (!values.length || values.some((value) => !Number.isInteger(value) || value <= 0)) {
      return { valid: false, value: null };
    }

    if (op === "+") return { valid: true, value: sum(values) };
    if (op === "*") return { valid: true, value: product(values) };

    let value = values[0];
    for (let i = 1; i < values.length; i += 1) {
      if (op === "-") {
        value -= values[i];
        if (value < 0) return { valid: false, value };
      } else if (op === "/") {
        if (values[i] === 0 || value % values[i] !== 0) {
          return { valid: false, value: null };
        }
        value /= values[i];
      }
    }
    return { valid: true, value };
  }

  function evalExpression(values, ops) {
    if (!values.length || values.some((value) => !Number.isInteger(value) || value <= 0)) {
      return { valid: false, value: null };
    }
    if (!ops.length) return { valid: true, value: values[0] };

    const terms = [values[0]];
    const additiveOps = [];

    for (let i = 0; i < ops.length; i += 1) {
      const op = ops[i];
      const next = values[i + 1];
      if (op === "*") {
        terms[terms.length - 1] *= next;
      } else if (op === "/") {
        const current = terms[terms.length - 1];
        if (next === 0 || current % next !== 0) return { valid: false, value: null };
        terms[terms.length - 1] = current / next;
      } else if (op === "+" || op === "-") {
        additiveOps.push(op);
        terms.push(next);
      } else {
        return { valid: false, value: null };
      }
    }

    let value = terms[0];
    for (let i = 0; i < additiveOps.length; i += 1) {
      if (additiveOps[i] === "+") {
        value += terms[i + 1];
      } else {
        value -= terms[i + 1];
        if (value < 0) return { valid: false, value };
      }
    }
    return { valid: true, value };
  }

  function positiveParts(total, count, maxTerm) {
    const parts = [];
    let remaining = total;

    for (let i = 0; i < count; i += 1) {
      const left = count - i - 1;
      const minValue = Math.max(1, remaining - left * maxTerm);
      const maxValue = Math.min(maxTerm, remaining - left);
      if (minValue > maxValue) return null;
      const value = i === count - 1 ? remaining : randomInt(minValue, maxValue);
      parts.push(value);
      remaining -= value;
    }

    return parts.every((value) => value >= 1 && value <= maxTerm) ? parts : null;
  }

  function subtractionSide(length, target, maxTerm) {
    if (length === 1) return target > 0 ? [target] : null;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const tail = [];
      for (let i = 1; i < length; i += 1) tail.push(randomInt(1, maxTerm));
      const first = target + sum(tail);
      if (first > 0 && first <= 90) return [first, ...tail];
    }

    return null;
  }

  function divisionSide(length, target, maxTerm) {
    if (length === 1) return target > 0 ? [target] : null;

    const divisorMax = Math.min(6, maxTerm);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const tail = [];
      for (let i = 1; i < length; i += 1) tail.push(randomInt(1, divisorMax));
      const first = target * product(tail);
      if (first > 0 && first <= 180) return [first, ...tail];
    }

    return null;
  }

  function productTuples(length, maxTerm) {
    const key = `${length}|${maxTerm}`;
    if (productTupleCache.has(key)) return productTupleCache.get(key);

    const byProduct = new Map();
    function walk(prefix) {
      if (prefix.length === length) {
        const p = product(prefix);
        if (!byProduct.has(p)) byProduct.set(p, []);
        byProduct.get(p).push(prefix);
        return;
      }
      for (let value = 1; value <= maxTerm; value += 1) {
        walk([...prefix, value]);
      }
    }
    walk([]);
    productTupleCache.set(key, byProduct);
    return byProduct;
  }

  function productSideForTarget(length, target, maxTerm) {
    const tuples = productTuples(length, maxTerm).get(target) || [];
    return tuples.length ? [...pick(tuples)] : null;
  }

  function buildUnbalancedValues(family, op, level) {
    const maxTerm = maxTermForLevel(level);
    const rightLen = family.right.length;
    let leftValue = null;
    let rightValues = null;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (op === "+") {
        rightValues = Array.from({ length: rightLen }, () => randomInt(1, maxTerm));
        leftValue = sum(rightValues);
      } else if (op === "*") {
        const factorMax = Math.min(5, maxTerm);
        rightValues = Array.from({ length: rightLen }, () => randomInt(1, factorMax));
        leftValue = product(rightValues);
        if (leftValue > 180) continue;
      } else if (op === "-") {
        leftValue = randomInt(1, maxTerm + 4);
        rightValues = subtractionSide(rightLen, leftValue, maxTerm);
      } else if (op === "/") {
        leftValue = randomInt(1, maxTerm + 2);
        rightValues = divisionSide(rightLen, leftValue, maxTerm);
      }

      if (rightValues) break;
    }

    const values = {};
    values[family.left[0]] = leftValue;
    family.right.forEach((slot, index) => {
      values[slot] = rightValues[index];
    });
    return values;
  }

  function buildBalancedValues(family, op, level) {
    const maxTerm = maxTermForLevel(level);
    const leftLen = family.left.length;
    const rightLen = family.right.length;
    let leftValues = null;
    let rightValues = null;

    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (op === "+") {
        const lower = Math.max(leftLen, rightLen);
        const upper = Math.min(leftLen * maxTerm, rightLen * maxTerm, 32);
        const target = randomInt(lower, upper);
        leftValues = positiveParts(target, leftLen, maxTerm);
        rightValues = positiveParts(target, rightLen, maxTerm);
      } else if (op === "-") {
        const target = randomInt(0, maxTerm + 3);
        leftValues = subtractionSide(leftLen, target, maxTerm);
        rightValues = subtractionSide(rightLen, target, maxTerm);
      } else if (op === "*") {
        const leftProducts = productTuples(leftLen, maxTerm);
        const rightProducts = productTuples(rightLen, maxTerm);
        const common = [...leftProducts.keys()].filter(
          (value) => value > 1 && value <= 180 && rightProducts.has(value)
        );
        const target = pick(common);
        leftValues = productSideForTarget(leftLen, target, maxTerm);
        rightValues = productSideForTarget(rightLen, target, maxTerm);
      } else if (op === "/") {
        const target = randomInt(1, maxTerm + 2);
        leftValues = divisionSide(leftLen, target, maxTerm);
        rightValues = divisionSide(rightLen, target, maxTerm);
      }

      if (leftValues && rightValues) break;
    }

    const values = {};
    family.left.forEach((slot, index) => {
      values[slot] = leftValues[index];
    });
    family.right.forEach((slot, index) => {
      values[slot] = rightValues[index];
    });
    return values;
  }

  function buildValues(family, op, level) {
    return family.left.length === 1
      ? buildUnbalancedValues(family, op, level)
      : buildBalancedValues(family, op, level);
  }

  function expressionTuples(length, ops, maxTerm) {
    const byValue = new Map();

    function add(tuple) {
      const result = evalExpression(tuple, ops);
      if (!result.valid || result.value <= 0 || result.value > 180) return;
      if (!byValue.has(result.value)) byValue.set(result.value, []);
      byValue.get(result.value).push(tuple);
    }

    function walk(prefix) {
      if (prefix.length === length) {
        add(prefix);
        return;
      }
      for (let value = 1; value <= maxTerm; value += 1) {
        walk([...prefix, value]);
      }
    }

    walk([]);
    return byValue;
  }

  function buildMixedValues(family, leftOps, rightOps, level) {
    const maxTerm = maxTermForLevel(level);
    const leftCandidates = expressionTuples(family.left.length, leftOps, maxTerm);
    const rightCandidates = expressionTuples(family.right.length, rightOps, maxTerm);
    const common = [...leftCandidates.keys()].filter((value) => rightCandidates.has(value));
    if (!common.length) {
      const fallbackOp = leftOps[0] || rightOps[0] || "+";
      return buildValues(family, fallbackOp, level);
    }

    const target = pick(common);
    const leftValues = [...pick(leftCandidates.get(target))];
    const rightValues = [...pick(rightCandidates.get(target))];
    const values = {};
    family.left.forEach((slot, index) => {
      values[slot] = leftValues[index];
    });
    family.right.forEach((slot, index) => {
      values[slot] = rightValues[index];
    });
    return values;
  }

  function chooseQuestionOps(operators, slotsCount) {
    if (slotsCount <= 0) return [];
    const selected = normalizeOperators(operators);
    if (selected.length === 1) return Array.from({ length: slotsCount }, () => selected[0]);

    const shuffled = shuffle(selected);
    const chosen = shuffled.slice(0, slotsCount);
    while (chosen.length < slotsCount) chosen.push(pick(selected));
    return shuffle(chosen);
  }

  function splitOpsForSides(family, allOps) {
    const leftCount = Math.max(0, family.left.length - 1);
    return {
      leftOps: allOps.slice(0, leftCount),
      rightOps: allOps.slice(leftCount),
    };
  }

  function renderSide(slots, values, ops, unknownSlot) {
    if (slots.length === 1) return slots[0] === unknownSlot ? "?" : String(values[slots[0]]);
    return slots
      .map((slot, index) => {
        const value = slot === unknownSlot ? "?" : String(values[slot]);
        return index === 0 ? value : `${ops[index - 1]} ${value}`;
      })
      .join(" ");
  }

  function displaySidesFor(family, flipped = false) {
    return flipped
      ? { left: family.right, right: family.left, flipped: true }
      : { left: family.left, right: family.right, flipped: false };
  }

  function shouldFlipSides(family, indexSeed) {
    if (family.left.length === family.right.length) return false;
    return Math.floor(Math.max(0, Number(indexSeed) || 0) / 2) % 2 === 1;
  }

  function renderPrompt(family, values, leftOps, rightOps, unknownSlot, flipped = false) {
    const sides = displaySidesFor(family, flipped);
    const displayLeftOps = flipped ? rightOps : leftOps;
    const displayRightOps = flipped ? leftOps : rightOps;
    return `${renderSide(sides.left, values, displayLeftOps, unknownSlot)} = ${renderSide(
      sides.right,
      values,
      displayRightOps,
      unknownSlot
    )}`;
  }

  function hasKnownCommonVisibleValue(leftSlots, rightSlots, values, unknownSlot) {
    if (Math.min(leftSlots.length, rightSlots.length) > 2) return false;
    const leftKnown = new Set(
      leftSlots
        .filter((slot) => slot !== unknownSlot)
        .map((slot) => values[slot])
    );
    return rightSlots
      .filter((slot) => slot !== unknownSlot)
      .some((slot) => leftKnown.has(values[slot]));
  }

  function buildOptions(correct) {
    const used = new Set([correct]);
    const traps = [];

    function add(value) {
      const n = Number(value);
      if (!Number.isInteger(n) || n <= 0 || used.has(n)) return;
      used.add(n);
      traps.push(n);
    }

    [1, -1, 2, -2, 3, -3, 5, -5, 10, -10].forEach((delta) => add(correct + delta));
    add(correct * 2);
    if (correct % 2 === 0) add(correct / 2);
    for (let value = 1; traps.length < 2 && value <= correct + 20; value += 1) add(value);

    const options = shuffle([correct, traps[0], traps[1]].map(String));
    return { options, correctIndex: options.indexOf(String(correct)) };
  }

  function buildQuestion(config = {}, opts = {}) {
    const cfg = normalizeConfig({ ...DEFAULT_CONFIG, ...config });
    const family = FAMILY_DEFS[cfg.familyId] || FAMILY_DEFS.E3;
    const operatorSlotsCount = Math.max(0, family.left.length - 1) + Math.max(0, family.right.length - 1);
    const forcedOps = Array.isArray(opts.operators)
      ? opts.operators.filter((item) => OPS.includes(item))
      : OPS.includes(opts.operator)
        ? Array.from({ length: operatorSlotsCount }, () => opts.operator)
        : null;
    const questionOps =
      forcedOps && forcedOps.length === operatorSlotsCount
        ? forcedOps
        : chooseQuestionOps(cfg.operators, operatorSlotsCount);
    const { leftOps, rightOps } = splitOpsForSides(family, questionOps);
    const uniqueOps = [...new Set(questionOps)];
    const op = uniqueOps.length === 1 ? uniqueOps[0] : null;
    const slots = [...family.left, ...family.right];
    const unknownIndex = clampInt(opts.unknownIndex ?? randomInt(0, slots.length - 1), 0, slots.length - 1);
    const unknownSlot = slots[unknownIndex];
    const flipped =
      opts.flipped == null
        ? shouldFlipSides(family, opts.orientationSeed ?? unknownIndex)
        : Boolean(opts.flipped) && family.left.length !== family.right.length;
    const displaySides = displaySidesFor(family, flipped);
    let values = null;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      values =
        op == null
          ? buildMixedValues(family, leftOps, rightOps, opts.level ?? MIN_LEVEL)
          : buildValues(family, op, opts.level ?? MIN_LEVEL);
      if (!hasKnownCommonVisibleValue(displaySides.left, displaySides.right, values, unknownSlot)) break;
    }

    const correct = values[unknownSlot];
    const { options, correctIndex } = buildOptions(correct);
    const prompt = renderPrompt(family, values, leftOps, rightOps, unknownSlot, flipped);
    const displayLeftOps = flipped ? rightOps : leftOps;
    const displayRightOps = flipped ? leftOps : rightOps;

    return {
      familyId: family.id,
      familyLabel: family.label,
      familyShortLabel: family.shortLabel,
      operator: op ?? questionOps.join(" "),
      operators: [...questionOps],
      leftOps: [...displayLeftOps],
      rightOps: [...displayRightOps],
      signMode: uniqueOps.length === 1 ? SAME_SIGN : COMPLEMENTARY_SIGNS,
      slots,
      leftSlots: [...displaySides.left],
      rightSlots: [...displaySides.right],
      flipped,
      unknownSlot,
      unknownIndex,
      values,
      correct,
      prompt,
      options,
      correctIndex,
      metadata: {
        family: family.id,
        operator: op ?? questionOps.join(" "),
        operators: [...questionOps],
        signMode: uniqueOps.length === 1 ? SAME_SIGN : COMPLEMENTARY_SIGNS,
        flipped,
        unknownSlot,
        correct,
      },
    };
  }

  function sideValuesForQuestion(question, side) {
    const family = FAMILY_DEFS[question.familyId];
    const slots =
      side === "left"
        ? question.leftSlots ?? family.left
        : question.rightSlots ?? family.right;
    return slots.map((slot) => question.values[slot]);
  }

  function validateQuestion(question) {
    const family = FAMILY_DEFS[question?.familyId];
    const questionOps = Array.isArray(question.operators)
      ? question.operators
      : OPS.includes(question.operator)
        ? Array.from({ length: Math.max(0, question.slots?.length - 2) }, () => question.operator)
        : [];
    if (!family || questionOps.some((op) => !OPS.includes(op))) return false;
    const allValues = [...family.left, ...family.right].map((slot) => question.values?.[slot]);
    if (allValues.some((value) => !Number.isInteger(value) || value <= 0)) return false;
    const leftOps = question.leftOps ?? [];
    const rightOps = question.rightOps ?? [];
    const left = evalExpression(sideValuesForQuestion(question, "left"), leftOps);
    const right = evalExpression(sideValuesForQuestion(question, "right"), rightOps);
    return left.valid && right.valid && left.value === right.value;
  }

  function revealedPrompt(question) {
    return question.prompt.replace("?", String(question.correct));
  }

  function revealedPromptHtml(question) {
    return question.prompt.replace(
      "?",
      `<span class="q-correct">${question.correct}</span>`
    );
  }

  function createSummaryRows(config, current, level, answered) {
    if (!config.showSummaryInArena) return [];
    const family = FAMILY_DEFS[config.familyId] || FAMILY_DEFS.E3;
    const mode = current?.signMode === COMPLEMENTARY_SIGNS ? "semne din bife" : "acelasi semn";
    return [
      { prompt: "Familie:", answer: family.shortLabel },
      { prompt: "Semne:", answer: (current?.operators ?? config.operators).join(" ") },
      { prompt: "Mod:", answer: mode },
      { prompt: "Pozitie ?:", answer: current?.unknownSlot ?? "-" },
      { prompt: "Intrebari:", answer: `${answered}/${config.questionsPerRun}` },
      { prompt: "Nivel:", answer: String(level) },
    ];
  }

  function appendCheckbox(parent, labelText, checked, onChange) {
    const row = document.createElement("label");
    row.className = "control-panel-lift-row";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked, input));
    const span = document.createElement("span");
    span.textContent = labelText;
    row.append(input, span);
    parent.appendChild(row);
    return input;
  }

  function base64UrlEncode(text) {
    const toBase64 =
      typeof global.btoa === "function"
        ? global.btoa.bind(global)
        : typeof Buffer !== "undefined"
          ? (value) => Buffer.from(value, "binary").toString("base64")
          : null;

    if (!toBase64) return encodeURIComponent(text);

    if (typeof global.TextEncoder === "function") {
      const bytes = new global.TextEncoder().encode(text);
      let binary = "";
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      return toBase64(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    return toBase64(unescape(encodeURIComponent(text)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function createQuiz(config = {}) {
    let level = MIN_LEVEL;
    let quizConfig = normalizeConfig({ ...DEFAULT_CONFIG, ...config });
    let answeredThisRun = 0;
    let questionSerial = 0;
    let current = null;
    let completed = false;
    let orchestrator = null;
    const attemptLog = [];

    function family() {
      return FAMILY_DEFS[quizConfig.familyId] || FAMILY_DEFS.E3;
    }

    function roundView(extra = {}) {
      return {
        prompt: current?.prompt ?? "-",
        options: current ? [...current.options] : ["-", "-", "-"],
        correctIndex: current?.correctIndex ?? 0,
        hintMessage: HINT,
        successionHistory: createSummaryRows(quizConfig, current, level, answeredThisRun),
        ...extra,
      };
    }

    // Faza E, sectiunea 12 din plan: orice quiz trebuie construit intern prin
    // SubquizOrchestrator, chiar unul "simplu" ca asta (o singura bucata "baza",
    // fara push/pop/exit). `beginRound`/`pickNextRound` gestioneaza `current`
    // direct (tiparul stabilit deja in toate quizurile simple migrate in Faza D)
    // — orchestratorul e pornit O SINGURA DATA, la construirea quiz-ului (mai
    // jos), cu un `generator` gol care nu se mai cheama niciodata dupa aia
    // (`dupaRaspunsCorect` intoarce mereu o comanda explicita, niciodata
    // `undefined` — vezi `baseDefinition`). De-aici incolo, `current` si
    // itemul orchestratorului sunt tinute sincron printr-un singur apel
    // neconditionat, ori de cate ori `current` se schimba.
    function sincronizeazaOrchestratorul() {
      orchestrator.getCurrentRuntime().setCurrentItem(current);
    }

    function pickNewQuestion() {
      const slots = [...family().left, ...family().right];
      current = buildQuestion(quizConfig, {
        level,
        unknownIndex: questionSerial % slots.length,
      });
      questionSerial += 1;
      sincronizeazaOrchestratorul();
      return current;
    }

    function resetRun() {
      answeredThisRun = 0;
      questionSerial = 0;
      current = null;
    }

    function restartAfterConfigChange() {
      completed = false;
      resetRun();
    }

    function levelLabel(targetLevel = level) {
      const ops = quizConfig.operators.join(" ");
      return `Nivel ${targetLevel} - ${family().shortLabel} - semne: ${ops}`;
    }

    function recordAttempt(isCorrect, chosen, meta = {}) {
      const entry = {
        at: meta.at ?? new Date().toISOString(),
        family: current.familyId,
        operators: [...(current.operators ?? [current.operator])],
        signMode: current.signMode,
        unknownSlot: current.unknownSlot,
        correctAnswer: current.correct,
        userAnswer: chosen,
        correct: Boolean(isCorrect),
        timedOut: Boolean(meta.timedOut),
        responseMs: meta.responseMs ?? null,
        prompt: current.prompt,
      };
      attemptLog.push(entry);
      global.console?.log?.("[equations-e3-e6]", entry);
      return entry;
    }

    function nextAfterCorrect() {
      answeredThisRun += 1;

      if (answeredThisRun >= quizConfig.questionsPerRun) {
        answeredThisRun = 0;
        const previousLevel = level;
        if (level < MAX_LEVEL) level += 1;
        pickNewQuestion();
        return {
          outcome: "run-complete",
          correct: true,
          runComplete: true,
          levelAdvanced: previousLevel < level,
          flash: "win",
          banner: levelLabel(),
          message: "Tura completa. Mergem mai departe.",
          nextRound: roundView(),
        };
      }

      pickNewQuestion();
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: "Corect!",
        ...roundView(),
      };
    }

    // Motor 3 butoane (M3B) — vezi documente de referinta/PLAN-motor-comun-raspuns.md.
    // Migrare pura: regula corect/gresit era deja conforma (gresit nu atinge
    // `current`, ramane pe aceeasi intrebare). `dupaApasare` inregistreaza
    // FIECARE apasare (ca inainte), `dupaRaspunsCorect` muta starea si pastreaza
    // dezvaluirea raspunsului (`revealedPrompt`/`revealedPromptHtml`) exact ca
    // inainte de migrare, la finalul unei ture.
    //
    // Faza E, sectiunea 12: invelit intr-un SubquizOrchestrator cu o singura
    // bucata "baza" (push/pop/exit nu se folosesc — nu e nevoie aici). Vezi
    // comentariul de la `sincronizeazaOrchestratorul`, mai sus, pt. de ce
    // `esteCorect`/`actiuni` citesc `current` din closure (neschimbat) in loc
    // sa citeasca din itemul dat de motor.
    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "base",
        title: "baza",
        hintMessage: HINT,
        esteCorect: (_item, index) => Boolean(current) && Number(current.options?.[index]) === current.correct,
        // Nu se cheama niciodata dupa pornirea initiala (vezi mai sus) — `current`
        // e gestionat direct de `pickNewQuestion`/`beginRound`, sincronizat separat.
        generator: () => ({}),
        mesaje: {
          gresit: (ctx) => `${ctx.alesul} nu e bun. Mai incearca.`,
        },
        actiuni: {
          dupaApasare: (ctx) => {
            recordAttempt(ctx.corect, Number(ctx.alesul), ctx.meta);
            // Vederea de "raspuns gresit" o construieste motorul comun (nu
            // `roundView()` proprie, ca inainte de migrare) — ii lipseste
            // `successionHistory` (panoul de sumar din arena) daca nu-l adaugam
            // aici explicit. `dupaApasare` ruleaza la FIECARE apasare (corecta
            // sau nu), deci merge si pe ramura corecta — acolo e oricum
            // suprascris de `roundView()` din `dupaRaspunsCorect`, fara conflict.
            return { successionHistory: createSummaryRows(quizConfig, current, level, answeredThisRun) };
          },
          dupaRaspunsCorect: () => {
            const solved = current;
            const result = nextAfterCorrect();
            if (result.runComplete) {
              result.prompt = revealedPrompt(solved);
              result.promptHtml = revealedPromptHtml(solved);
            }
            return { action: "continue", view: result };
          },
        },
      });
    }

    orchestrator = global.SubquizOrchestrator.create({
      definitions: [baseDefinition()],
      activeSubquizIds: ["base"],
      context: { quizId: config.quizId ?? QUIZ_ID, hintMessage: HINT },
    });
    orchestrator.startFirst();

    return {
      getQuizId: () => config.quizId ?? QUIZ_ID,
      getLevel: () => level,
      getMinLevel: () => MIN_LEVEL,
      getMaxLevel: () => MAX_LEVEL,
      getLevelLabel: () => levelLabel(level),
      getLevelButtonTitle: (targetLevel) =>
        `Nivel ${targetLevel}: pool mic, ${family().shortLabel}, ${quizConfig.operators.join(" ")}`,
      getProgressDisplay() {
        const percent = Math.round((answeredThisRun / quizConfig.questionsPerRun) * 100);
        return {
          green: global.ProgressDisplay.greenPercent(Math.min(100, percent)),
          red: global.ProgressDisplay.redNone(),
        };
      },
      isCompleted: () => completed,
      setCompleted: (value) => {
        completed = Boolean(value);
      },
      resetLevelState: resetRun,
      switchLevel(nextLevel) {
        level = clampInt(nextLevel, MIN_LEVEL, MAX_LEVEL);
        completed = false;
        resetRun();
        return null;
      },
      pickNextRound() {
        return pickNewQuestion();
      },
      beginRound(next) {
        current = next ?? pickNewQuestion();
        sincronizeazaOrchestratorul();
        return roundView();
      },
      onTimeout(meta = {}) {
        if (current) recordAttempt(false, null, { ...meta, timedOut: true });
        return {
          outcome: "timeout",
          correct: false,
          flash: "wrong",
          message: "Timpul a trecut. Incearca aceeasi intrebare.",
          ...roundView(),
        };
      },
      // Migrat la Motor3Butoane (Faza D, lotul 2), invelit in SubquizOrchestrator
      // (Faza E, sectiunea 12) — vezi `baseDefinition`, mai sus.
      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },
      getTonomatConfig: () => ({
        ...quizConfig,
        operators: [...quizConfig.operators],
      }),
      getSharedConfig: () => ({
        v: 1,
        familyId: quizConfig.familyId,
        operators: [...quizConfig.operators],
        signMode: quizConfig.signMode,
        showSummaryInArena: quizConfig.showSummaryInArena,
        questionsPerRun: quizConfig.questionsPerRun,
      }),
      getSharedLink(baseHref) {
        const fallbackHref = "index.html";
        const base = global.location?.href ?? "http://localhost/";
        const currentHref = baseHref ?? global.location?.href ?? fallbackHref;
        const url = new URL(currentHref, base);
        url.hash = "";
        url.search = "";
        url.searchParams.set("quiz", QUIZ_ID);
        url.searchParams.set("cfg", base64UrlEncode(JSON.stringify(this.getSharedConfig())));
        return url.href;
      },
      applySharedConfig(shared = {}) {
        if (!shared || typeof shared !== "object" || Array.isArray(shared)) return false;
        quizConfig = normalizeConfig({
          familyId: shared.familyId,
          operators: shared.operators,
          signMode: shared.signMode,
          showSummaryInArena: shared.showSummaryInArena,
          questionsPerRun: shared.questionsPerRun,
        });
        restartAfterConfigChange();
        return true;
      },
      setTonomatConfig(patch = {}) {
        quizConfig = normalizeConfig({ ...quizConfig, ...patch });
        restartAfterConfigChange();
        return true;
      },
      previewTonomatQuestions(count = 5) {
        const cfg = { ...quizConfig, operators: [...quizConfig.operators] };
        const slots = [...family().left, ...family().right];
        return Array.from({ length: count }, (_, index) =>
          buildQuestion(cfg, {
            level,
            unknownIndex: index % slots.length,
            operator: cfg.operators[index % cfg.operators.length],
          })
        );
      },
      getAttemptLog: () => attemptLog.map((entry) => ({ ...entry })),
      appendTonomatControlPanel(mount, opts = {}) {
        if (!mount) return null;
        mount.replaceChildren();
        let renderSharedLink = () => {};

        const renderPreview = () => {
          previewList.replaceChildren();
          this.previewTonomatQuestions(5).forEach((question) => {
            const item = document.createElement("li");
            item.textContent = question.prompt;
            previewList.appendChild(item);
          });
        };

        const notifyChange = () => {
          renderPreview();
          renderSharedLink();
          opts.onChange?.();
        };

        const familyField = document.createElement("div");
        familyField.className = "control-panel-lift-field tonomat-family-field";
        const familyLabel = document.createElement("span");
        familyLabel.textContent = "Tip quiz:";
        const familyList = document.createElement("div");
        familyList.className = "tonomat-family-list";
        Object.values(FAMILY_DEFS).forEach((def) => {
          const choice = document.createElement("label");
          choice.className = "tonomat-family-choice";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = "tonomat-family";
          input.value = def.id;
          input.checked = def.id === quizConfig.familyId;
          input.addEventListener("change", () => {
            if (!input.checked) return;
            this.setTonomatConfig({ familyId: def.id });
            notifyChange();
          });
          const text = document.createElement("span");
          text.textContent = def.label;
          choice.append(input, text);
          familyList.appendChild(choice);
        });
        familyField.append(familyLabel, familyList);
        mount.appendChild(familyField);

        const opField = document.createElement("div");
        opField.className = "control-panel-lift-field";
        const opTitle = document.createElement("span");
        opTitle.textContent = "Semne incluse";
        const opRow = document.createElement("div");
        opRow.className = "tonomat-op-row";
        const opInputs = new Map();
        OPS.forEach((op) => {
          const label = document.createElement("label");
          label.className = "tonomat-op-choice";
          const input = document.createElement("input");
          input.type = "checkbox";
          input.checked = quizConfig.operators.includes(op);
          input.addEventListener("change", () => {
            const selected = [...opInputs.entries()]
              .filter(([, el]) => el.checked)
              .map(([key]) => key);
            if (!selected.length) {
              input.checked = true;
              return;
            }
            this.setTonomatConfig({ operators: selected });
            notifyChange();
          });
          const span = document.createElement("span");
          span.textContent = op;
          label.append(input, span);
          opInputs.set(op, input);
          opRow.appendChild(label);
        });
        opField.append(opTitle, opRow);
        mount.appendChild(opField);

        appendCheckbox(mount, "Arata detalii in lista din arena", quizConfig.showSummaryInArena, (checked) => {
          this.setTonomatConfig({ showSummaryInArena: checked });
          notifyChange();
        });

        const countField = document.createElement("div");
        countField.className = "control-panel-lift-field";
        const countLabel = document.createElement("label");
        countLabel.textContent = "Intrebari pe tura";
        const countInput = document.createElement("input");
        countInput.type = "number";
        countInput.min = "5";
        countInput.max = "50";
        countInput.step = "1";
        countInput.value = String(quizConfig.questionsPerRun);
        countInput.addEventListener("change", () => {
          this.setTonomatConfig({ questionsPerRun: countInput.value });
          countInput.value = String(quizConfig.questionsPerRun);
          notifyChange();
        });
        countField.append(countLabel, countInput);
        mount.appendChild(countField);

        const shareField = document.createElement("div");
        shareField.className = "control-panel-lift-field tonomat-share";
        const shareButton = document.createElement("button");
        shareButton.type = "button";
        shareButton.className = "tonomat-share-button";
        shareButton.textContent = "Copiaza link la quiz si configuratie";
        const shareInput = document.createElement("input");
        shareInput.type = "text";
        shareInput.className = "tonomat-share-link";
        shareInput.readOnly = true;
        shareInput.setAttribute("aria-label", "Link la quiz si configuratie");
        const shareStatus = document.createElement("span");
        shareStatus.className = "tonomat-share-status";
        renderSharedLink = () => {
          shareInput.value = this.getSharedLink();
          shareStatus.textContent = "";
        };
        shareButton.addEventListener("click", async () => {
          const link = this.getSharedLink();
          shareInput.value = link;
          shareInput.focus();
          shareInput.select();

          try {
            if (global.navigator?.clipboard?.writeText) {
              await global.navigator.clipboard.writeText(link);
              shareStatus.textContent = "Link copiat.";
              return;
            }
            if (document.execCommand?.("copy")) {
              shareStatus.textContent = "Link copiat.";
              return;
            }
          } catch (_) {
            // The visible input remains as a manual-copy fallback.
          }

          shareStatus.textContent = "Copiaza manual linkul de mai sus.";
        });
        shareField.append(shareButton, shareInput, shareStatus);
        mount.appendChild(shareField);
        renderSharedLink();

        const note = document.createElement("p");
        note.className = "tonomat-note";
        note.textContent =
          "Semnele bifate intra in locurile disponibile. Daca sunt mai multe decat incap, se aleg aleator la fiecare intrebare.";
        mount.appendChild(note);

        const previewTitle = document.createElement("p");
        previewTitle.className = "tonomat-preview-title";
        previewTitle.textContent = "Preview intrebari";
        const previewList = document.createElement("ol");
        previewList.className = "tonomat-preview";
        mount.append(previewTitle, previewList);
        renderPreview();

        return mount;
      },
    };
  }

  global.EquationTonomatQuiz = {
    create: createQuiz,
    buildQuestion,
    validateQuestion,
    evalSide,
    FAMILY_DEFS,
    OPS,
    SAME_SIGN,
    COMPLEMENTARY_SIGNS,
  };

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: QUIZ_TITLE,
    description:
      "Tonomat combinatoric E3/E4/E5/E6, etapa 1: acelasi semn, necunoscuta in orice slot numeric.",
    order: -3,
    gestionareGreseli: { activ: false },
    create(meta = {}) {
      return global.EquationTonomatQuiz.create({ quizId: meta.id ?? QUIZ_ID });
    },
  });
})(window);
