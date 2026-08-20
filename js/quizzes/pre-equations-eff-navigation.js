(function (global) {
  "use strict";

  const QUIZ_ID = "pre-equations-eff-navigation";
  const QUIZ_TITLE = "Navigare pre-ecuatii EFF";
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 10;
  const PERFECT_TRIANGLES_PER_LEVEL = 3;
  const DEFAULT_INTERVAL_WIDTH = 6;
  const DEFAULT_LEVEL_STEP = 2;
  const OPS = ["+", "-", "*", "/"];
  const MULTIPLICATIVE_OPS = ["*", "/"];
  const OP_FAMILIES = [
    { label: "+-", op: "+", aliases: ["+", "-"] },
    { label: "*/", op: "*", aliases: ["*", "/"] },
  ];
  const HINT = "Alege raspunsul corect.";

  const DEFAULT_CONFIG = {
    operators: ["+"],
    nearNextSet: true,
    retryCycleOnMistake: true,
    answerMode: null,
    unknownSymbol: null,
    intervalWidth: DEFAULT_INTERVAL_WIDTH,
    intervalStep: DEFAULT_LEVEL_STEP,
  };

  function clampInt(value, min, max, fallback = min) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  function shuffle(items) {
    const fn = global.GameUtils?.shuffle;
    return typeof fn === "function" ? fn(items) : [...items].sort(() => Math.random() - 0.5);
  }

  function normalizeOperators(input = {}) {
    const raw = Array.isArray(input.operators)
      ? input.operators
      : input.operation
      ? [input.operation]
      : DEFAULT_CONFIG.operators;
    const selected = [];
    raw.forEach((op) => {
      const family = OP_FAMILIES.find(
        (item) => item.op === op || item.label === op || item.aliases.includes(op)
      );
      if (family && !selected.includes(family.op)) selected.push(family.op);
    });
    return selected.length ? selected : [...DEFAULT_CONFIG.operators];
  }

  function normalizeConfig(input = {}) {
    return {
      operators: normalizeOperators(input),
      nearNextSet:
        input.nearNextSet == null
          ? DEFAULT_CONFIG.nearNextSet
          : Boolean(input.nearNextSet),
      retryCycleOnMistake:
        input.retryCycleOnMistake == null
          ? DEFAULT_CONFIG.retryCycleOnMistake
          : Boolean(input.retryCycleOnMistake),
      answerMode: ["number", "formula", "alternate"].includes(input.answerMode)
        ? input.answerMode
        : null,
      unknownSymbol: ["?", "x"].includes(input.unknownSymbol)
        ? input.unknownSymbol
        : null,
      intervalWidth: clampInt(
        input.intervalWidth,
        1,
        30,
        DEFAULT_CONFIG.intervalWidth
      ),
      intervalStep: clampInt(
        input.intervalStep,
        1,
        20,
        DEFAULT_CONFIG.intervalStep
      ),
    };
  }

  function intervalForLevel(level, config) {
    const start = 1 + (level - 1) * config.intervalStep;
    return {
      start,
      end: start + config.intervalWidth,
    };
  }

  function isMultiplicativeOperation(op) {
    return MULTIPLICATIVE_OPS.includes(op);
  }

  function triangleResult(a, b, op = "+") {
    return isMultiplicativeOperation(op) ? a * b : a + b;
  }

  function triangleFamilyKey(op = "+") {
    return isMultiplicativeOperation(op) ? "mul" : "add";
  }

  function triangleKey(a, b, op = "+") {
    const x = Math.min(a, b);
    const y = Math.max(a, b);
    return `${triangleFamilyKey(op)}:${x},${y},${triangleResult(x, y, op)}`;
  }

  function makeTriangle(a, b, op = "+") {
    return {
      a,
      b,
      c: triangleResult(a, b, op),
      op,
      key: triangleKey(a, b, op),
    };
  }

  function termInInterval(value, interval) {
    return Number.isInteger(value) && value >= interval.start && value <= interval.end;
  }

  function isValidTriangle(triangle, interval) {
    return termInInterval(triangle.a, interval) && termInInterval(triangle.b, interval);
  }

  function triangleNumbers(triangle) {
    return [triangle.a, triangle.b, triangle.c];
  }

  function hasCommonAndNeighbor(candidate, previous) {
    if (!candidate || !previous) return false;
    const prevNumbers = triangleNumbers(previous);
    const candidateNumbers = triangleNumbers(candidate);
    const hasCommon = candidateNumbers.some((value) => prevNumbers.includes(value));
    const hasNeighbor = [candidate.a, candidate.b].some((value) =>
      prevNumbers.some((prevValue) => Math.abs(value - prevValue) === 1)
    );
    return hasCommon && hasNeighbor;
  }

  function allTrianglesForInterval(interval, op = "+") {
    const out = [];
    for (let a = interval.start; a <= interval.end; a += 1) {
      for (let b = a; b <= interval.end; b += 1) {
        out.push(makeTriangle(a, b, op));
      }
    }
    return out;
  }

  function preferredInitialTriangle(interval, op = "+") {
    const candidate = makeTriangle(interval.start + 1, interval.start + 2, op);
    if (isValidTriangle(candidate, interval)) return candidate;
    return makeTriangle(interval.start, interval.start + 1, op);
  }

  function pickAnyUnusedTriangle(interval, completedKeys, avoidKey, op) {
    const anyUnused = allTrianglesForInterval(interval, op).filter(
      (candidate) => candidate.key !== avoidKey && !completedKeys.has(candidate.key)
    );
    if (anyUnused.length) return shuffle(anyUnused)[0];

    const anyExceptCurrent = allTrianglesForInterval(interval, op).filter(
      (candidate) => candidate.key !== avoidKey
    );
    return shuffle(anyExceptCurrent)[0] ?? preferredInitialTriangle(interval, op);
  }

  function pickLinkedTriangle(previous, interval, completedKeys, avoidKey, op = "+", nearNextSet = true) {
    if (!previous) {
      const first = preferredInitialTriangle(interval, op);
      if (!completedKeys.has(first.key)) return first;
    }

    if (!nearNextSet) {
      return pickAnyUnusedTriangle(interval, completedKeys, avoidKey, op);
    }

    const proposedPairs = previous
      ? [
          [previous.a, previous.b + 1],
          [previous.b, previous.a + 1],
          [previous.a, previous.b - 1],
          [previous.b, previous.a - 1],
        ]
      : [];

    for (const [a, b] of proposedPairs) {
      const candidate = makeTriangle(a, b, op);
      if (!isValidTriangle(candidate, interval)) continue;
      if (candidate.key === avoidKey || completedKeys.has(candidate.key)) continue;
      if (hasCommonAndNeighbor(candidate, previous)) return candidate;
    }

    const pool = allTrianglesForInterval(interval, op).filter(
      (candidate) =>
        candidate.key !== avoidKey &&
        !completedKeys.has(candidate.key) &&
        (!previous || hasCommonAndNeighbor(candidate, previous))
    );
    if (pool.length) return shuffle(pool)[0];

    return pickAnyUnusedTriangle(interval, completedKeys, avoidKey, op);
  }

  function numericOptions(correct, triangle) {
    const used = new Set([correct]);
    const candidates = [];

    function add(value) {
      const n = Number(value);
      if (!Number.isInteger(n) || n <= 0 || used.has(n)) return;
      used.add(n);
      candidates.push(n);
    }

    [triangle.a, triangle.b, triangle.c].forEach(add);
    [1, -1, 2, -2, 3, -3, 5, -5].forEach((delta) => add(correct + delta));
    for (let value = 1; candidates.length < 2 && value <= correct + 20; value += 1) {
      add(value);
    }

    const options = shuffle([correct, candidates[0], candidates[1]].map(String));
    return { options, correctIndex: options.indexOf(String(correct)) };
  }

  function evalFormula(left, op, right) {
    if (op === "+") return left + right;
    if (op === "-") return left - right;
    if (op === "*") return left * right;
    if (op === "/") return right === 0 ? Number.NaN : left / right;
    return Number.NaN;
  }

  function formulaOptions(unknownSymbol, correctExpression, correctValue, left, right, opts = {}) {
    const candidates = [];
    const includePrefix = opts.includePrefix !== false;
    const correct = includePrefix
      ? `${unknownSymbol}=${correctExpression}`
      : correctExpression;
    const used = new Set([correct]);

    function formatExpression(a, op, b) {
      return includePrefix ? `${unknownSymbol}=${a}${op}${b}` : `${a}${op}${b}`;
    }

    function add(a, op, b) {
      const text = formatExpression(a, op, b);
      if (used.has(text)) return;
      const value = evalFormula(a, op, b);
      if (!Number.isFinite(value) || value === correctValue) return;
      used.add(text);
      candidates.push(text);
    }

    ["-", "+", "*", "/"].forEach((op) => {
      add(left, op, right);
      add(right, op, left);
    });

    while (candidates.length < 2) {
      add(left + candidates.length + 1, "+", right);
      if (candidates.length < 2) add(left, "-", right + candidates.length + 1);
    }

    const options = shuffle([correct, candidates[0], candidates[1]]);
    return { options, correctIndex: options.indexOf(correct) };
  }

  function stepDefForTriangle(triangle, stepIndex, unknownSymbol = "?") {
    const { a, b, c, op = "+" } = triangle;
    if (isMultiplicativeOperation(op)) {
      if (stepIndex === 0) {
        return {
          prompt: `${a}=${c}/${unknownSymbol}`,
          correctNumber: b,
          correctExpression: `${c}/${a}`,
          formulaLeft: c,
          formulaRight: a,
        };
      }
      if (stepIndex === 1) {
        return {
          prompt: `${b}=${unknownSymbol}/${a}`,
          correctNumber: c,
          correctExpression: `${b}*${a}`,
          formulaLeft: b,
          formulaRight: a,
        };
      }
      return {
        prompt: `${c}=${b}*${unknownSymbol}`,
        correctNumber: a,
        correctExpression: `${c}/${b}`,
        formulaLeft: c,
        formulaRight: b,
      };
    }

    if (stepIndex === 0) {
      return {
        prompt: `${a}=${c}-${unknownSymbol}`,
        correctNumber: b,
        correctExpression: `${c}-${a}`,
        formulaLeft: c,
        formulaRight: a,
      };
    }
    if (stepIndex === 1) {
      return {
        prompt: `${b}=${unknownSymbol}-${a}`,
        correctNumber: c,
        correctExpression: `${b}+${a}`,
        formulaLeft: b,
        formulaRight: a,
      };
    }
    return {
      prompt: `${c}=${b}+${unknownSymbol}`,
      correctNumber: a,
      correctExpression: `${c}-${b}`,
      formulaLeft: c,
      formulaRight: b,
    };
  }

  function modeLabel(mode) {
    if (mode === "formula") return "raspuns ca formula";
    if (mode === "alternate") return "alternare numeric/formula";
    return "raspuns ca numar";
  }

  function createQuiz(config = {}) {
    let quizConfig = normalizeConfig(config);
    let level = MIN_LEVEL;
    let currentTriangle = null;
    let previousTriangle = null;
    let currentStep = 0;
    let current = null;
    let currentCycleHadMistake = false;
    let perfectTriangleStreak = 0;
    let triangleSerial = 0;
    let completedTriangleKeys = new Set();
    let completed = false;
    let orchestrator = null;

    // Faza E, sectiunea 12: orice quiz trebuie construit intern prin
    // SubquizOrchestrator (vezi equations-e3-e6.js pt. explicatia completa a
    // tiparului). `buildQuestion()` e singurul loc care schimba `current`
    // (deci `options`/`correctIndex`) — sincronizeaza neconditionat, chiar
    // acolo, la final. `beginRound` mai cheama sincronizarea o data explicit,
    // pt. ramura cu `next` primit direct (nu trece prin `buildQuestion()`).
    function sincronizeazaOrchestratorul() {
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: current?.prompt ?? "-",
        options: current ? [...current.options] : ["-", "-", "-"],
        correctIndex: current?.correctIndex ?? 0,
      });
    }

    function chooseOperatorForTriangle() {
      return shuffle(quizConfig.operators)[0] ?? "+";
    }

    function effectiveAnswerMode() {
      if (quizConfig.answerMode) return quizConfig.answerMode;
      return level >= 4 ? "alternate" : "number";
    }

    function answerModeForCurrentTriangle() {
      const mode = effectiveAnswerMode();
      if (mode !== "alternate") return mode;
      return triangleSerial % 2 === 1 ? "number" : "formula";
    }

    function effectiveUnknownSymbol(responseMode = effectiveAnswerMode()) {
      if (quizConfig.unknownSymbol) return quizConfig.unknownSymbol;
      return responseMode === "formula" ? "x" : "?";
    }

    function effectiveXQuestionInPrompt(responseMode = effectiveAnswerMode()) {
      const unknownSymbol = effectiveUnknownSymbol(responseMode);
      return responseMode === "formula" && unknownSymbol === "x";
    }

    function currentInterval() {
      return intervalForLevel(level, quizConfig);
    }

    function chooseTriangle(avoidKey = null) {
      const interval = currentInterval();
      const op = chooseOperatorForTriangle();
      currentTriangle = pickLinkedTriangle(
        previousTriangle,
        interval,
        completedTriangleKeys,
        avoidKey,
        op,
        quizConfig.nearNextSet
      );
      currentStep = 0;
      currentCycleHadMistake = false;
      triangleSerial += 1;
    }

    function buildQuestion() {
      if (!currentTriangle) chooseTriangle();
      const responseMode = answerModeForCurrentTriangle();
      const unknownSymbol = effectiveUnknownSymbol(responseMode);
      const xQuestionInPrompt = effectiveXQuestionInPrompt(responseMode);
      const step = stepDefForTriangle(currentTriangle, currentStep, unknownSymbol);
      const prompt =
        responseMode === "formula" && xQuestionInPrompt
          ? `${step.prompt}; ${unknownSymbol}=?`
          : step.prompt;
      const opt =
        responseMode === "formula"
          ? formulaOptions(
              unknownSymbol,
              step.correctExpression,
              step.correctNumber,
              step.formulaLeft,
              step.formulaRight,
              { includePrefix: !xQuestionInPrompt }
            )
          : numericOptions(step.correctNumber, currentTriangle);

      current = {
        prompt,
        correct:
          responseMode === "formula"
            ? xQuestionInPrompt
              ? step.correctExpression
              : `${unknownSymbol}=${step.correctExpression}`
            : String(step.correctNumber),
        correctNumber: step.correctNumber,
        responseMode,
        unknownSymbol,
        xQuestionInPrompt,
        options: opt.options,
        correctIndex: opt.correctIndex,
        triangle: { ...currentTriangle },
        stepIndex: currentStep,
      };
      sincronizeazaOrchestratorul();
      return current;
    }

    function roundView(extra = {}) {
      return {
        prompt: current?.prompt ?? "-",
        options: current ? [...current.options] : ["-", "-", "-"],
        correctIndex: current?.correctIndex ?? 0,
        hintMessage: HINT,
        successionHistory: [
          { prompt: "Triunghi:", answer: currentTriangle ? `${currentTriangle.a}, ${currentTriangle.b}, ${currentTriangle.c}` : "-" },
          { prompt: "Semn:", answer: currentTriangle?.op ?? "-" },
          { prompt: "Pas:", answer: `${currentStep + 1}/3` },
          { prompt: "Mod:", answer: modeLabel(current?.responseMode ?? answerModeForCurrentTriangle()) },
          { prompt: "Perfecte:", answer: `${perfectTriangleStreak}/${PERFECT_TRIANGLES_PER_LEVEL}` },
        ],
        ...extra,
      };
    }

    function resetLevelState() {
      completed = false;
      currentTriangle = null;
      previousTriangle = null;
      currentStep = 0;
      current = null;
      currentCycleHadMistake = false;
      perfectTriangleStreak = 0;
      triangleSerial = 0;
      completedTriangleKeys = new Set();
    }

    function levelLabel(targetLevel = level) {
      const interval = intervalForLevel(targetLevel, quizConfig);
      const mode = effectiveAnswerMode();
      return `Nivel ${targetLevel} - ${interval.start}-${interval.end} - ${modeLabel(mode)}`;
    }

    function completeLevel() {
      if (level >= MAX_LEVEL) {
        completed = true;
        const message = "Ai terminat toate nivelurile.";
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

      level += 1;
      resetLevelState();
      buildQuestion();
      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        levelAdvanced: true,
        runDelayMs: 0,
        flash: "win",
        banner: levelLabel(),
        message: "Nivel nou.",
        nextRound: roundView(),
      };
    }

    function completeCycle() {
      const finishedTriangle = currentTriangle;
      const perfect = !currentCycleHadMistake;

      if (perfect) {
        perfectTriangleStreak += 1;
        completedTriangleKeys.add(finishedTriangle.key);
      } else {
        perfectTriangleStreak = 0;
      }

      previousTriangle = finishedTriangle;

      if (perfectTriangleStreak >= PERFECT_TRIANGLES_PER_LEVEL) {
        return completeLevel();
      }

      if (!perfect && quizConfig.retryCycleOnMistake) {
        currentTriangle = finishedTriangle;
        currentStep = 0;
        currentCycleHadMistake = false;
      } else {
        chooseTriangle(finishedTriangle.key);
      }

      buildQuestion();
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        flash: perfect ? undefined : "wrong",
        message: perfect
          ? "Triunghi perfect."
          : quizConfig.retryCycleOnMistake
          ? "Reluam acelasi triunghi."
          : "Continuam cu alt triunghi.",
        ...roundView(),
      };
    }

    function isCorrectChoice(index) {
      const chosen = current?.options?.[index];
      return String(chosen) === String(current?.correct);
    }

    function setConfig(patch = {}) {
      quizConfig = normalizeConfig({ ...quizConfig, ...patch });
      resetLevelState();
      return true;
    }

    // Motor 3 butoane (M3B) — vezi documente de referinta/PLAN-motor-comun-raspuns.md.
    // Migrare pura: regula corect/gresit era deja conforma (gresit nu atinge
    // `current`/`currentStep`, ramane pe acelasi pas). Exista un pas
    // intermediar real (3 pasi per triunghi, Categoria 7): `dupaRaspunsCorect`
    // fie trece la pasul urmator (step-correct), fie incheie ciclul triunghiului
    // (`completeCycle()`, care poate incheia si nivelul intreg, prin `completeLevel()`).
    // Faza E, sectiunea 12: invelit intr-un SubquizOrchestrator (o singura
    // bucata "baza"). `roundView()` are un singur camp propriu
    // (`successionHistory`, panoul de sumar) absent din vederea generica —
    // injectat prin `dupaApasare`, ca la equations-e3-e6.js. `options` sunt
    // deja string-uri (ambele moduri, `number`/`formula`, folosesc
    // `.map(String)`/text) — `ctx.alesul` sigur de folosit, fara capcana de tip.
    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "base",
        title: "baza",
        hintMessage: HINT,
        esteCorect: (_item, index) => isCorrectChoice(index),
        generator: () => ({}),
        mesaje: {
          gresit: (ctx) => `${ctx.alesul} nu e bun. Mai incearca.`,
        },
        actiuni: {
          dupaApasare: (ctx) => {
            if (!ctx.corect) {
              currentCycleHadMistake = true;
            }
            return { successionHistory: roundView().successionHistory };
          },
          dupaRaspunsCorect: () => {
            if (currentStep < 2) {
              currentStep += 1;
              buildQuestion();
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
            }

            return { action: "continue", view: completeCycle() };
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
      getLevelLabel: () => levelLabel(level),
      getLevelButtonTitle(targetLevel) {
        const interval = intervalForLevel(targetLevel, quizConfig);
        return `Nivel ${targetLevel}: termeni ${interval.start}-${interval.end}`;
      },
      getProgressDisplay() {
        return {
          green: global.ProgressDisplay.greenStreak(
            perfectTriangleStreak,
            PERFECT_TRIANGLES_PER_LEVEL,
            (index) => ({
              aria: `Triunghi perfect ${index + 1}`,
              title: `Triunghi perfect ${index + 1}`,
            })
          ),
          red: global.ProgressDisplay.redNone(),
        };
      },
      isCompleted: () => completed,
      switchLevel(nextLevel) {
        level = clampInt(nextLevel, MIN_LEVEL, MAX_LEVEL, MIN_LEVEL);
        resetLevelState();
        return null;
      },
      pickNextRound() {
        return buildQuestion();
      },
      beginRound(next) {
        if (next) {
          current = next;
        } else {
          buildQuestion();
        }
        sincronizeazaOrchestratorul();
        return roundView();
      },
      onTimeout() {
        currentCycleHadMistake = true;
        return {
          outcome: "timeout",
          correct: false,
          flash: "wrong",
          message: "Timpul a trecut. Incearca aceeasi intrebare.",
          ...roundView(),
        };
      },
      // Migrat la Motor3Butoane (Faza D, lotul 3), invelit in SubquizOrchestrator
      // (Faza E, sectiunea 12) — vezi `baseDefinition`, mai sus.
      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },
      getPreEquationNavigationConfig() {
        return {
          ...quizConfig,
          operation: quizConfig.operators[0] ?? "+",
          effectiveAnswerMode: effectiveAnswerMode(),
          effectiveUnknownSymbol: effectiveUnknownSymbol(),
          intervals: Array.from({ length: MAX_LEVEL }, (_, index) => {
            const lv = index + 1;
            return { level: lv, ...intervalForLevel(lv, quizConfig) };
          }),
        };
      },
      setPreEquationNavigationConfig: setConfig,
      appendPreEquationNavigationControlPanel(mount, opts = {}) {
        if (!mount) return null;
        mount.replaceChildren();

        const notifyChange = () => opts.onChange?.();

        function appendStepper(labelText, key, min, max) {
          const field = document.createElement("div");
          field.className = "control-panel-lift-field pre-eq-stepper-field";
          const label = document.createElement("label");
          label.textContent = labelText;
          const controls = document.createElement("div");
          controls.className = "pre-eq-stepper";
          const minus = document.createElement("button");
          minus.type = "button";
          minus.textContent = "-";
          const input = document.createElement("input");
          input.type = "number";
          input.min = String(min);
          input.max = String(max);
          input.step = "1";
          input.value = String(quizConfig[key]);
          const plus = document.createElement("button");
          plus.type = "button";
          plus.textContent = "+";

          const applyValue = (value) => {
            setConfig({ [key]: value });
            input.value = String(quizConfig[key]);
            notifyChange();
          };

          minus.addEventListener("click", () => {
            applyValue(Number(input.value) - 1);
          });
          plus.addEventListener("click", () => {
            applyValue(Number(input.value) + 1);
          });
          input.addEventListener("change", () => {
            applyValue(input.value);
          });

          controls.append(minus, input, plus);
          field.append(label, controls);
          mount.appendChild(field);
        }

        const opField = document.createElement("div");
        opField.className = "control-panel-lift-field pre-eq-inline-field";
        const opTitle = document.createElement("span");
        opTitle.textContent = "Semn";
        const opRow = document.createElement("div");
        opRow.className = "tonomat-op-row pre-eq-sign-row";
        const opInputs = new Map();
        OP_FAMILIES.forEach((family) => {
          const label = document.createElement("label");
          label.className = "tonomat-op-choice";
          const input = document.createElement("input");
          input.type = "checkbox";
          input.value = family.op;
          input.checked = quizConfig.operators.includes(family.op);
          input.addEventListener("change", () => {
            const selected = [...opInputs.entries()]
              .filter(([, el]) => el.checked)
              .map(([key]) => key);
            if (!selected.length) {
              input.checked = true;
              return;
            }
            setConfig({ operators: selected });
            notifyChange();
          });
          const span = document.createElement("span");
          span.textContent = family.label;
          label.append(input, span);
          opInputs.set(family.op, input);
          opRow.appendChild(label);
        });
        opField.append(opTitle, opRow);
        mount.appendChild(opField);

        const retryRow = document.createElement("label");
        retryRow.className = "control-panel-lift-row";
        const retryInput = document.createElement("input");
        retryInput.type = "checkbox";
        retryInput.checked = quizConfig.retryCycleOnMistake;
        retryInput.addEventListener("change", () => {
          setConfig({ retryCycleOnMistake: retryInput.checked });
          notifyChange();
        });
        const retryText = document.createElement("span");
        retryText.textContent = "Reia ciclul daca a gresit";
        retryRow.append(retryInput, retryText);
        mount.appendChild(retryRow);

        const nearRow = document.createElement("label");
        nearRow.className = "control-panel-lift-row";
        const nearInput = document.createElement("input");
        nearInput.type = "checkbox";
        nearInput.checked = quizConfig.nearNextSet;
        nearInput.addEventListener("change", () => {
          setConfig({ nearNextSet: nearInput.checked });
          notifyChange();
        });
        const nearText = document.createElement("span");
        nearText.textContent = "Urmatorul set apropiat (ex 2 3 5 -> 2 4 6)";
        nearRow.append(nearInput, nearText);
        mount.appendChild(nearRow);

        const modeField = document.createElement("div");
        modeField.className = "control-panel-lift-field";
        const modeTitle = document.createElement("span");
        modeTitle.textContent = "Raspuns ca:";
        const modeList = document.createElement("div");
        modeList.className = "tonomat-op-row";
        [
          ["number", "7"],
          ["formula", "6+1"],
          ["alternate", "alternat"],
        ].forEach(([mode, labelText]) => {
          const label = document.createElement("label");
          label.className = "tonomat-op-choice";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = "pre-eq-answer-mode";
          input.value = mode;
          input.checked = effectiveAnswerMode() === mode;
          input.addEventListener("change", () => {
            if (!input.checked) return;
            setConfig({
              answerMode: mode,
              unknownSymbol: null,
            });
            notifyChange();
          });
          const span = document.createElement("span");
          span.textContent = labelText;
          label.append(input, span);
          modeList.appendChild(label);
        });
        modeField.append(modeTitle, modeList);
        mount.appendChild(modeField);

        const unknownField = document.createElement("div");
        unknownField.className = "control-panel-lift-field";
        const unknownTitle = document.createElement("span");
        unknownTitle.textContent = "Necunoscuta";
        const unknownList = document.createElement("div");
        unknownList.className = "tonomat-op-row";
        [
          ["?", "?"],
          ["x", "x"],
        ].forEach(([symbol, labelText]) => {
          const label = document.createElement("label");
          label.className = "tonomat-op-choice";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = "pre-eq-unknown-symbol";
          input.value = symbol;
          input.checked = effectiveUnknownSymbol() === symbol;
          input.addEventListener("change", () => {
            if (!input.checked) return;
            setConfig({ unknownSymbol: symbol });
            notifyChange();
          });
          const span = document.createElement("span");
          span.textContent = labelText;
          label.append(input, span);
          unknownList.appendChild(label);
        });
        unknownField.append(unknownTitle, unknownList);
        mount.appendChild(unknownField);

        appendStepper("Latime interval", "intervalWidth", 1, 30);
        appendStepper("Pas crestere interval", "intervalStep", 1, 20);

        const intervalsRow = document.createElement("p");
        intervalsRow.className = "tonomat-preview-title pre-eq-intervals-row";
        const intervalsTitle = document.createElement("span");
        intervalsTitle.textContent = "Intervale rezultate:";
        const intervalsValues = document.createElement("span");
        intervalsValues.className = "pre-eq-intervals-values";
        intervalsValues.textContent = this.getPreEquationNavigationConfig().intervals
          .map((item) => `${item.start}-${item.end}`)
          .join(", ");
        intervalsRow.append(intervalsTitle, intervalsValues);
        mount.appendChild(intervalsRow);

        return mount;
      },
    };
  }

  global.PreEquationNavigationQuiz = {
    create: createQuiz,
    intervalForLevel,
    stepDefForTriangle,
    hasCommonAndNeighbor,
  };

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: QUIZ_TITLE,
    description:
      "Quiz izolat: lanturi pre-ecuatii EFF pe triunghiuri aditive.",
    order: -2,
    gestionareGreseli: { activ: false },
    create(meta = {}) {
      return global.PreEquationNavigationQuiz.create({ quizId: meta.id ?? QUIZ_ID });
    },
  });
})(window);
