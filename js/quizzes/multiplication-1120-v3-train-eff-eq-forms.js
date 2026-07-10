(function (global) {
  "use strict";

  const QUIZ_ID = "multiplication-1120-v3-train-eff-eq-forms";
  const QUIZ_TITLE = "T*/ 11-20 - v3 - train w eff si eq forms";
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 10;
  const QUESTIONS_PER_LEVEL = 12;
  const SQ2_TRIGGER_EVERY_BASE_ANSWERS = 5;
  const LEVEL_FACTOR_ANSWER_WINDOW = 10;
  const LEVEL_FACTOR_ANSWER_MAX_IN_WINDOW = 1;
  const HINT = "Alege raspunsul corect.";
  const SQ2_FACT_COUNT_KEY = "yl:mul1120v3:sq2FactCount";
  const SQ2_EXIT_COUNT_KEY = "yl:mul1120v3:sq2ExitCount";
  const SQ2_EXIT_MODE_KEY = "yl:mul1120v3:sq2ExitMode";

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

  function clampChoice(value, allowed, fallback) {
    const num = Number(value);
    return allowed.includes(num) ? num : fallback;
  }

  function readNumberSetting(key, allowed, fallback) {
    try {
      return clampChoice(global.localStorage?.getItem?.(key), allowed, fallback);
    } catch (err) {
      return fallback;
    }
  }

  function writeSetting(key, value) {
    try {
      global.localStorage?.setItem?.(key, String(value));
    } catch (err) {
      // Ignore storage failures.
    }
  }

  function readExitMode() {
    try {
      const stored = global.localStorage?.getItem?.(SQ2_EXIT_MODE_KEY);
      return stored === "any" ? "any" : "correct";
    } catch (err) {
      return "correct";
    }
  }

  function buildMulDivEqFormOptions(correctNum, productNum, shuffle) {
    const correct = Number(correctNum);
    const product = Number(productNum);
    const wrong = [];

    function addWrong(value) {
      if (!Number.isFinite(value) || value < 0 || value === correct || wrong.includes(value)) {
        return;
      }
      wrong.push(value);
    }

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

  function createQuiz(config = {}) {
    const quizId = config.quizId ?? QUIZ_ID;
    const { shuffle } = global.GameUtils;
    const QFG = global.QFGenerator;
    const Catalog = global.FactCatalog;
    const qfTypes = QFG.getActiveQFTypes(QF_PROFILE).filter(
      (type) => type.answerType === "number"
    );

    let level = MIN_LEVEL;
    let completed = false;
    let orchestrator = null;
    let sq2FactCount = readNumberSetting(SQ2_FACT_COUNT_KEY, [1, 2, 3, 4], 2);
    let sq2ExitCount = readNumberSetting(SQ2_EXIT_COUNT_KEY, [3, 4, 5], 3);
    let sq2ExitMode = readExitMode();
    const shared = {
      baseState: null,
      sq2State: null,
      sq2FactsText: [],
    };

    function makeFact(b) {
      return Catalog.createFact({
        operation: "mul",
        values: { a: factorForLevel(level), b },
      });
    }

    function buildBQueue() {
      const factor = factorForLevel(level);
      return shuffle(Array.from({ length: factor }, (_, index) => index + 1));
    }

    function pickB(state) {
      if (!state.bQueue?.length) state.bQueue = buildBQueue();
      return state.bQueue.shift();
    }

    function canUseLevelFactorAnswer(state) {
      const history = state?.levelFactorAnswerHistory || [];
      const recent = history.slice(-(LEVEL_FACTOR_ANSWER_WINDOW - 1));
      return (
        recent.filter(Boolean).length < LEVEL_FACTOR_ANSWER_MAX_IN_WINDOW
      );
    }

    function noteLevelFactorAnswer(state, isLevelFactorAnswer) {
      if (!state) return;
      state.levelFactorAnswerHistory = state.levelFactorAnswerHistory || [];
      state.levelFactorAnswerHistory.push(Boolean(isLevelFactorAnswer));
      if (state.levelFactorAnswerHistory.length > LEVEL_FACTOR_ANSWER_WINDOW - 1) {
        state.levelFactorAnswerHistory.shift();
      }
    }

    function questionItem(prompt, correct, b, product, subquizId, extraMetadata = {}) {
      const A = factorForLevel(level);
      const opt = buildMulDivEqFormOptions(correct, product, shuffle);
      return {
        prompt,
        correctAnswer: correct,
        options: opt.options,
        correctIndex: opt.correctIndex,
        metadata: {
          subquiz: subquizId,
          factA: A,
          factB: b,
          product,
          ...extraMetadata,
        },
      };
    }

    function fallbackQuestionForB(b, subquizId, state) {
      const A = factorForLevel(level);
      const product = A * b;
      const shouldAvoidLevelFactor = !canUseLevelFactorAnswer(state);

      if (shouldAvoidLevelFactor && product === A) {
        const correct = b;
        noteLevelFactorAnswer(state, correct === A);
        return questionItem(`${A}*?=${product}`, correct, b, product, subquizId, {
          fallback: true,
          avoidedLevelFactorAnswer: true,
        });
      }

      const correct = product;
      noteLevelFactorAnswer(state, correct === A);
      return questionItem(`${A}*${b}=?`, correct, b, product, subquizId, {
        fallback: true,
      });
    }

    function buildQuestionForB(b, subquizId = "base", state = null) {
      const A = factorForLevel(level);
      const product = A * b;
      const fact = makeFact(b);
      const allowLevelFactorAnswer = canUseLevelFactorAnswer(state);

      for (const type of shuffle(qfTypes)) {
        const rendered = QFG.renderQF(type, fact);
        if (!rendered || rendered.answerType !== "number") continue;
        const correct = Number(rendered.correctAnswer);
        if (!Number.isFinite(correct)) continue;
        if (correct === A && !allowLevelFactorAnswer) continue;
        noteLevelFactorAnswer(state, correct === A);
        return questionItem(rendered.prompt, correct, b, product, subquizId, {
            qfTypeId: type.id,
        });
      }

      return fallbackQuestionForB(b, subquizId, state);
    }

    function buildBaseQuestion(state) {
      return buildQuestionForB(pickB(state), "base", state);
    }

    function factLabel(b) {
      return `${factorForLevel(level)}*${b}`;
    }

    function uniqueFacts(bs) {
      return [...new Set((bs || []).filter((b) => Number.isFinite(Number(b))).map(Number))];
    }

    function selectFactsForSq2(preferredBs = []) {
      const state = shared.baseState;
      if (!state) return [];
      const picked = [];

      function add(b) {
        if (!Number.isFinite(Number(b))) return;
        const factB = Number(b);
        if (factB < 1 || factB > factorForLevel(level) || picked.includes(factB)) return;
        picked.push(factB);
      }

      uniqueFacts(preferredBs).forEach(add);
      uniqueFacts(state.wrongFacts).forEach(add);

      const slowFacts = Object.entries(state.responseTimesByB || {})
        .map(([b, ms]) => ({ b: Number(b), ms: Number(ms) }))
        .filter((entry) => Number.isFinite(entry.b) && Number.isFinite(entry.ms))
        .sort((a, b) => b.ms - a.ms);
      slowFacts.forEach((entry) => {
        if (picked.length < sq2FactCount) add(entry.b);
      });

      return picked.slice(0, sq2FactCount);
    }

    function startSq2WithFacts(facts, reason, view = {}) {
      const selected = uniqueFacts(facts);
      if (!selected.length) return null;
      shared.sq2FactsText = selected.map(factLabel);
      return {
        action: "push",
        targetId: "sq2EffVbs",
        payload: { facts: selected, reason },
        view: {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Subquiz 2 EFF VBS: ${shared.sq2FactsText.join(", ")}`,
          ...view,
        },
      };
    }

    function maybeEnterSq2FromBase(state, reason) {
      const facts = selectFactsForSq2();
      if (!facts.length) return null;
      return startSq2WithFacts(facts, reason);
    }

    function roundViewFrom(runtime, extra = {}) {
      return runtime.view({
        hintMessage: HINT,
        ...extra,
      });
    }

    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "base",
        title: "baza",
        hintMessage: HINT,
        initialState() {
          const state = {
            questionCount: 0,
            correctCount: 0,
            bQueue: [],
            wrongFacts: [],
            responseTimesByB: {},
            currentFactB: null,
            levelFactorAnswerHistory: [],
          };
          shared.baseState = state;
          return state;
        },
        generator({ state }) {
          shared.baseState = state;
          const item = buildBaseQuestion(state);
          state.currentFactB = item.metadata.factB;
          return item;
        },
        onAnswer(event) {
          const { item, index, meta, state, runtime } = event;
          shared.baseState = state;
          const chosen = item.options[index];
          const isCorrect = Number(chosen) === Number(item.correctAnswer);
          const factB = item.metadata.factB;

          state.questionCount += 1;
          if (isCorrect) state.correctCount += 1;
          else if (!state.wrongFacts.includes(factB)) state.wrongFacts.push(factB);
          if (Number.isFinite(meta.responseMs)) state.responseTimesByB[factB] = meta.responseMs;

          if (state.wrongFacts.length >= 2) {
            const command = maybeEnterSq2FromBase(state, "twoWrongFacts");
            if (command) return command;
          }

          if (state.questionCount % SQ2_TRIGGER_EVERY_BASE_ANSWERS === 0) {
            const command = maybeEnterSq2FromBase(state, "baseFiveFacts");
            if (command) return command;
          }

          if (state.questionCount >= QUESTIONS_PER_LEVEL) {
            return {
              action: "exit",
              reason: "answeredCount",
              view: {
                outcome: "step-correct",
                correct: true,
                bounce: true,
                flash: "win",
                message: "Subquiz 1 baza terminat, next level",
              },
            };
          }

          runtime.nextItem({ reason: "afterAnswer" });
          return {
            action: "continue",
            view: roundViewFrom(runtime, {
              outcome: "step-correct",
              correct: isCorrect,
              bounce: isCorrect,
              flash: isCorrect ? undefined : "wrong",
              message: isCorrect ? "Corect!" : `${chosen} nu e bun.`,
            }),
          };
        },
        onResume({ runtime }) {
          if (runtime?.getState) shared.baseState = runtime.getState();
          runtime.nextItem({ reason: "resumeFromSq2" });
          return {
            action: "continue",
            view: roundViewFrom(runtime, {
              outcome: "step-correct",
              correct: true,
              bounce: true,
              message: "Inapoi la Subquiz 1 baza.",
            }),
          };
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

    function sq2Definition() {
      return global.SubquizDefinition.define({
        id: "sq2EffVbs",
        title: "Intensiv cu eff VBS",
        hintMessage: HINT,
        initialState({ payload }) {
          const facts = uniqueFacts(payload?.facts).slice(0, 4);
          const state = {
            facts: facts.length ? facts : [1],
            countsByB: {},
            correctCountsByB: {},
            questionCount: 0,
            queue: [],
            reason: payload?.reason ?? "manual",
            levelFactorAnswerHistory: [],
          };
          state.facts.forEach((b) => {
            state.countsByB[b] = 0;
            state.correctCountsByB[b] = 0;
          });
          shared.sq2State = state;
          shared.sq2FactsText = state.facts.map(factLabel);
          return state;
        },
        generator({ state }) {
          shared.sq2State = state;
          if (!state.queue.length) state.queue = shuffle([...state.facts]);
          const b = state.queue.shift() ?? state.facts[0];
          return buildQuestionForB(b, "sq2EffVbs", state);
        },
        onAnswer(event) {
          const { item, index, state, runtime } = event;
          shared.sq2State = state;
          const chosen = item.options[index];
          const isCorrect = Number(chosen) === Number(item.correctAnswer);
          const factB = item.metadata.factB;

          state.questionCount += 1;
          state.countsByB[factB] = (state.countsByB[factB] ?? 0) + 1;
          if (isCorrect) state.correctCountsByB[factB] = (state.correctCountsByB[factB] ?? 0) + 1;

          const complete = state.facts.every((b) => {
            const value =
              sq2ExitMode === "any" ? state.countsByB[b] ?? 0 : state.correctCountsByB[b] ?? 0;
            return value >= sq2ExitCount;
          });

          if (complete) {
            return {
              action: "pop",
              reason: "sq2Complete",
              payload: { sq2Completed: true },
            };
          }

          runtime.nextItem({ reason: "sq2Next" });
          return {
            action: "continue",
            view: roundViewFrom(runtime, {
              outcome: "step-correct",
              correct: isCorrect,
              bounce: isCorrect,
              flash: isCorrect ? undefined : "wrong",
              message: isCorrect ? "Corect!" : `${chosen} nu e bun.`,
            }),
          };
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
      orchestrator = global.SubquizOrchestrator.create({
        definitions: [baseDefinition(), sq2Definition()],
        activeSubquizIds: ["base"],
        context: {
          quizId,
          getLevel: () => level,
          hintMessage: HINT,
        },
      });
    }

    function resetLevelState() {
      shared.baseState = null;
      shared.sq2State = null;
      shared.sq2FactsText = [];
      createOrchestrator();
    }

    function beginRoute() {
      if (!orchestrator) createOrchestrator();
      return orchestrator.startFirst();
    }

    function advanceLevel() {
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

      global.alert?.("Subquiz 1 baza terminat, next level");
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

    function handleOrchestratorResult(result) {
      if (result?.subquizEvent?.routeComplete) return advanceLevel();
      return result;
    }

    resetLevelState();

    return {
      getQuizId: () => quizId,
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getMinLevel: () => MIN_LEVEL,
      getLevelLabel: () =>
        orchestrator?.getCurrentId?.() === "sq2EffVbs"
          ? `Nivel ${level} - Subquiz 2 - Intensiv cu eff VBS`
          : `Nivel ${level} - Subquiz 1 - baza (${factorForLevel(level)}x)`,
      getLevelButtonTitle: (targetLevel) =>
        `Nivel ${targetLevel}: ${factorForLevel(targetLevel)}*1-${factorForLevel(targetLevel)}`,
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

      getSubquizStage: () => orchestrator?.getCurrentId?.() ?? "base",
      getSubquizStartOption: () => "base",
      getSubquizStartOptions() {
        return [{ id: "base", label: "1 baza" }];
      },
      setSubquizStartOption(stageId) {
        return stageId === "base";
      },

      getInfo11_20() {
        const A = factorForLevel(level);
        const baseState = shared.baseState;
        const sq2State = shared.sq2State;
        const currentId = orchestrator?.getCurrentId?.() ?? "base";
        const sq2Progress = sq2State
          ? sq2State.facts
              .map((b) => {
                const value =
                  sq2ExitMode === "any"
                    ? sq2State.countsByB[b] ?? 0
                    : sq2State.correctCountsByB[b] ?? 0;
                return `${factLabel(b)} ${value}/${sq2ExitCount}`;
              })
              .join(", ")
          : "-";
        return {
          visible: true,
          mode:
            currentId === "sq2EffVbs"
              ? "Subquiz 2: Intensiv cu eff VBS"
              : "Subquiz 1: baza",
          theme: currentId === "sq2EffVbs" ? "sq2-eff-vbs" : "base",
          wrongFactsText: baseState?.wrongFacts?.length
            ? baseState.wrongFacts.map(factLabel).join(", ")
            : "-",
          intensivText: currentId === "sq2EffVbs" ? sq2Progress : shared.sq2FactsText.join(", ") || "-",
          answeredText:
            currentId === "sq2EffVbs"
              ? `${sq2State?.questionCount ?? 0} intrebari SQ2`
              : `${baseState?.questionCount ?? 0} / ${QUESTIONS_PER_LEVEL}`,
          intensivSessionsText: "-",
          facts: Array.from({ length: A }, (_, index) => {
            const b = index + 1;
            return {
              label: `${A}*${b}`,
              timeText: "-",
              fast: false,
            };
          }),
        };
      },

      onAnswer(index, meta = {}) {
        return handleOrchestratorResult(orchestrator.onAnswer(index, meta));
      },

      onTimeout(meta = {}) {
        return handleOrchestratorResult(orchestrator.onTimeout(meta));
      },

      getArenaActions() {
        return [
          {
            id: "sendCurrentFactToSq2",
            label: "Baga factul curent in subquiz 2!",
            disabled: orchestrator?.getCurrentId?.() !== "base" || !shared.baseState?.currentFactB,
          },
        ];
      },

      runArenaAction(actionId) {
        if (actionId !== "sendCurrentFactToSq2") return null;
        return this.startCurrentFactSq2();
      },

      startCurrentFactSq2() {
        if (orchestrator?.getCurrentId?.() !== "base") return null;
        const factB = shared.baseState?.currentFactB;
        if (!factB) return null;
        const result = orchestrator.command({
          action: "push",
          targetId: "sq2EffVbs",
          payload: {
            facts: uniqueFacts([factB]),
            reason: "manualArenaButton",
          },
          view: {
            outcome: "step-correct",
            correct: true,
            bounce: true,
            flash: "win",
            message: `Subquiz 2 EFF VBS: ${factLabel(factB)}`,
          },
        });
        return handleOrchestratorResult(result);
      },

      appendSq2ControlPanel(mount, hooks = {}) {
        if (!mount) return;
        const factRow = document.createElement("div");
        factRow.className = "control-panel-lift-field sq2-eff-vbs-field";
        const factLabelEl = document.createElement("span");
        factLabelEl.textContent = "Nr facts de intarit simultan in Sq2 EFF VBS:";
        factRow.appendChild(factLabelEl);
        [1, 2, 3, 4].forEach((count) => {
          const label = document.createElement("label");
          label.className = "control-panel-lift-row sq2-eff-vbs-radio";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = "sq2-eff-vbs-fact-count";
          input.value = String(count);
          input.checked = sq2FactCount === count;
          input.addEventListener("change", () => {
            sq2FactCount = count;
            writeSetting(SQ2_FACT_COUNT_KEY, count);
            hooks.onChange?.();
          });
          label.append(input, document.createTextNode(String(count)));
          factRow.appendChild(label);
        });

        const exitRow = document.createElement("div");
        exitRow.className = "control-panel-lift-field sq2-eff-vbs-field";
        const exitText = document.createElement("span");
        exitText.textContent = "Se iese din SQ2 dupa ce fiecare fact are:";
        exitRow.appendChild(exitText);
        [3, 4, 5].forEach((count) => {
          const label = document.createElement("label");
          label.className = "control-panel-lift-row sq2-eff-vbs-radio";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = "sq2-eff-vbs-exit-count";
          input.value = String(count);
          input.checked = sq2ExitCount === count;
          input.addEventListener("change", () => {
            sq2ExitCount = count;
            writeSetting(SQ2_EXIT_COUNT_KEY, count);
            hooks.onChange?.();
          });
          label.append(input, document.createTextNode(String(count)));
          exitRow.appendChild(label);
        });

        const modeRow = document.createElement("div");
        modeRow.className = "control-panel-lift-field sq2-eff-vbs-field";
        ["correct", "any"].forEach((mode) => {
          const label = document.createElement("label");
          label.className = "control-panel-lift-row sq2-eff-vbs-radio";
          const input = document.createElement("input");
          input.type = "radio";
          input.name = "sq2-eff-vbs-exit-mode";
          input.value = mode;
          input.checked = sq2ExitMode === mode;
          input.addEventListener("change", () => {
            sq2ExitMode = mode;
            writeSetting(SQ2_EXIT_MODE_KEY, mode);
            hooks.onChange?.();
          });
          label.append(input, document.createTextNode(mode === "correct" ? "corect" : "corect sau incorect"));
          modeRow.appendChild(label);
        });

        mount.append(factRow, exitRow, modeRow);
      },

      setSq2Config(config = {}) {
        if ([1, 2, 3, 4].includes(Number(config.factCount))) {
          sq2FactCount = Number(config.factCount);
          writeSetting(SQ2_FACT_COUNT_KEY, sq2FactCount);
        }
        if ([3, 4, 5].includes(Number(config.exitCount))) {
          sq2ExitCount = Number(config.exitCount);
          writeSetting(SQ2_EXIT_COUNT_KEY, sq2ExitCount);
        }
        if (config.exitMode === "correct" || config.exitMode === "any") {
          sq2ExitMode = config.exitMode;
          writeSetting(SQ2_EXIT_MODE_KEY, sq2ExitMode);
        }
        return true;
      },
    };
  }

  global.Mul1120V3TrainEffEqFormsQuiz = { create: createQuiz };

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: QUIZ_TITLE,
    description: "Tabelul 11-20 cu subquiz baza, EFF si forme de ecuatii.",
    order: 2.2,
    gestionareGreseli: { activ: false },
    create(meta = {}) {
      return global.Mul1120V3TrainEffEqFormsQuiz.create({
        quizId: meta.id ?? QUIZ_ID,
      });
    },
  });
})(window);
