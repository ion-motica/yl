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

  function renderSide(slots, values, op, unknownSlot) {
    return slots
      .map((slot) => (slot === unknownSlot ? "?" : String(values[slot])))
      .join(slots.length > 1 ? ` ${op} ` : "");
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

  function renderPrompt(family, values, op, unknownSlot, flipped = false) {
    const sides = displaySidesFor(family, flipped);
    return `${renderSide(sides.left, values, op, unknownSlot)} = ${renderSide(
      sides.right,
      values,
      op,
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
    const op = OPS.includes(opts.operator)
      ? opts.operator
      : pick(cfg.operators.filter((item) => OPS.includes(item)));
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
      values = buildValues(family, op, opts.level ?? MIN_LEVEL);
      if (!hasKnownCommonVisibleValue(displaySides.left, displaySides.right, values, unknownSlot)) break;
    }

    const correct = values[unknownSlot];
    const { options, correctIndex } = buildOptions(correct);
    const prompt = renderPrompt(family, values, op, unknownSlot, flipped);

    return {
      familyId: family.id,
      familyLabel: family.label,
      familyShortLabel: family.shortLabel,
      operator: op,
      signMode: SAME_SIGN,
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
        operator: op,
        signMode: SAME_SIGN,
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
    if (!family || !OPS.includes(question.operator)) return false;
    const allValues = [...family.left, ...family.right].map((slot) => question.values?.[slot]);
    if (allValues.some((value) => !Number.isInteger(value) || value <= 0)) return false;
    const left = evalSide(sideValuesForQuestion(question, "left"), question.operator);
    const right = evalSide(sideValuesForQuestion(question, "right"), question.operator);
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
    return [
      { prompt: "Familie:", answer: family.shortLabel },
      { prompt: "Semne:", answer: config.operators.join(" ") },
      { prompt: "Mod:", answer: "acelasi semn" },
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

  function createQuiz(config = {}) {
    let level = MIN_LEVEL;
    let quizConfig = normalizeConfig({ ...DEFAULT_CONFIG, ...config });
    let answeredThisRun = 0;
    let questionSerial = 0;
    let current = null;
    let completed = false;
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

    function pickNewQuestion() {
      const slots = [...family().left, ...family().right];
      current = buildQuestion(quizConfig, {
        level,
        unknownIndex: questionSerial % slots.length,
      });
      questionSerial += 1;
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
      return `Nivel ${targetLevel} - ${family().shortLabel} - ${ops} - acelasi semn`;
    }

    function recordAttempt(isCorrect, chosen, meta = {}) {
      const entry = {
        at: meta.at ?? new Date().toISOString(),
        family: current.familyId,
        operators: [current.operator],
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
      onAnswer(index, meta = {}) {
        const chosen = Number(current?.options?.[index]);
        const isCorrect = current && chosen === current.correct;
        const solved = current;
        recordAttempt(isCorrect, chosen, meta);

        if (!isCorrect) {
          return {
            outcome: "wrong-answer",
            correct: false,
            flash: "wrong",
            message: `${chosen} nu e bun. Mai incearca.`,
            ...roundView(),
          };
        }

        const result = nextAfterCorrect();
        if (result.runComplete) {
          result.prompt = revealedPrompt(solved);
          result.promptHtml = revealedPromptHtml(solved);
        }
        return result;
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

        const modeField = document.createElement("div");
        modeField.className = "control-panel-lift-field";
        const modeLabel = document.createElement("label");
        modeLabel.textContent = "Mod semne";
        const modeSelect = document.createElement("select");
        const sameOption = document.createElement("option");
        sameOption.value = SAME_SIGN;
        sameOption.textContent = "Acelasi semn";
        sameOption.selected = true;
        const complementaryOption = document.createElement("option");
        complementaryOption.value = COMPLEMENTARY_SIGNS;
        complementaryOption.textContent = "Semne complementare - etapa 2";
        complementaryOption.disabled = true;
        modeSelect.append(sameOption, complementaryOption);
        modeField.append(modeLabel, modeSelect);
        mount.appendChild(modeField);

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

        const note = document.createElement("p");
        note.className = "tonomat-note";
        note.textContent =
          "Etapa 1: acelasi semn peste tot. TODO etapa 2: semne complementare +/-, */.";
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
