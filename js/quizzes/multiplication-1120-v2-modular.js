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
  const FAST_MS = 1500;

  const START_OPTIONS = {
    normal: { id: "normal", route: ["anchors", "anchorSumValues"] },
    anchorsOnly: { id: "anchorsOnly", route: ["anchors"] },
    intensivOnly: { id: "intensivOnly", route: ["intensiv"] },
    anchorSumValuesOnly: { id: "anchorSumValuesOnly", route: ["anchorSumValues"] },
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

  function decomposeNonanchor(b) {
    if (b >= 16) return { big: 15, small: b - 15 };
    if (b >= 11) return { big: 10, small: b - 10 };
    return { big: 5, small: b - 5 };
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

    function anchorDefinition() {
      return global.SubquizDefinition.define({
        id: "anchors",
        title: "anchors",
        hintMessage: HINT,
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
        onAnswer(event) {
          const { item, index, meta, state, runtime } = event;
          const chosen = item.options[index];
          const isCorrect = Number(chosen) === Number(item.correctAnswer);
          const factB = item.metadata.factB;

          state.answeredCount += 1;

          if (!isCorrect) {
            if (!state.wrongFacts.some((fact) => fact.b === factB)) {
              state.wrongFacts.push({ b: factB, label: factLabel(factB) });
            }
            if (state.answeredCount >= QUESTIONS_PER_LEVEL) {
              return {
                action: "exit",
                reason: "answeredCount",
                view: {
                  outcome: "step-correct",
                  correct: true,
                  bounce: true,
                  flash: "win",
                  message: "Subquiz 3: valori ancore suma",
                },
              };
            }
            return {
              action: "stay",
              view: roundViewFrom(runtime, {
                outcome: "wrong-answer",
                correct: false,
                flash: "wrong",
                message: `${chosen} nu e bun. Mai incearca!`,
              }),
            };
          }

          state.lastCorrectByB[factB] = meta.responseMs ?? null;

          if (state.wrongFacts.length >= 2 && startStageSelection !== "anchorsOnly") {
            const facts = state.wrongFacts.map((fact) => fact.b);
            shared.intensiveFactsText = state.wrongFacts.map((fact) => fact.label);
            state.wrongFacts = [];
            return {
              action: "push",
              targetId: "intensiv",
              payload: {
                facts,
                returnToPrevious: true,
              },
              view: {
                outcome: "step-correct",
                correct: true,
                bounce: true,
                message: `Mod intensiv: antrenament pe ${shared.intensiveFactsText.join(", ")}`,
              },
            };
          }

          if (state.answeredCount >= QUESTIONS_PER_LEVEL) {
            return {
              action: "exit",
              reason: "answeredCount",
              view: {
                outcome: "step-correct",
                correct: true,
                bounce: true,
                flash: "win",
                message: "Subquiz 3: valori ancore suma",
              },
            };
          }

          runtime.nextItem({ reason: "correct" });
          return {
            action: "continue",
            view: roundViewFrom(runtime, {
              outcome: "step-correct",
              correct: true,
              bounce: true,
              message: "Corect!",
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

    function intensiveDefinition() {
      return global.SubquizDefinition.define({
        id: "intensiv",
        title: "intensiv",
        hintMessage: HINT,
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
        onAnswer(event) {
          const { state, runtime } = event;
          state.count += 1;
          if (state.count >= INTENSIVE_QUESTIONS) {
            if (state.returnToPrevious) {
              return {
                action: "pop",
                reason: "intensiveComplete",
                payload: { intensiveCompleted: true },
              };
            }
            return { action: "exit", reason: "intensiveComplete" };
          }

          runtime.nextItem({ reason: "intensiveNext" });
          return {
            action: "continue",
            view: roundViewFrom(runtime, {
              outcome: "step-correct",
              correct: true,
              bounce: true,
              message: `Intensiv ${state.count + 1}/${INTENSIVE_QUESTIONS}`,
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

    function anchorSumDefinition() {
      return global.SubquizDefinition.define({
        id: "anchorSumValues",
        title: "valori ancore suma",
        hintMessage: HINT,
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
        onAnswer(event) {
          const { item, index, state, runtime } = event;
          const chosen = item.options[index];
          const isCorrect = Number(chosen) === Number(item.correctAnswer);

          state.questionCount += 1;
          state.correctStreak = isCorrect ? state.correctStreak + 1 : 0;

          if (
            state.questionCount >= ANCHOR_SUM_MAX_QUESTIONS ||
            state.correctStreak >= ANCHOR_SUM_STREAK_TO_EXIT
          ) {
            return {
              action: "exit",
              reason:
                state.correctStreak >= ANCHOR_SUM_STREAK_TO_EXIT
                  ? "correctStreak"
                  : "questionCount",
            };
          }

          runtime.nextItem({ reason: "anchorSumNext" });
          return {
            action: "continue",
            view: roundViewFrom(runtime, {
              outcome: isCorrect ? "step-correct" : "wrong-answer",
              correct: isCorrect,
              bounce: isCorrect,
              flash: isCorrect ? undefined : "wrong",
              message: isCorrect ? "Corect!" : `${chosen} nu e bun. Mai incearca!`,
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
      const route = START_OPTIONS[startStageSelection]?.route ?? START_OPTIONS.normal.route;
      orchestrator = global.SubquizOrchestrator.create({
        definitions: [anchorDefinition(), intensiveDefinition(), anchorSumDefinition()],
        activeSubquizIds: route,
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
      shared.intensiveFactsText = [];
      createOrchestrator();
    }

    function activeRouteLabel() {
      const id = orchestrator?.getCurrentId?.();
      if (id === "intensiv") return `Nivel ${level} - Subquiz 2 - intensiv`;
      if (id === "anchorSumValues") {
        return `Nivel ${level} - Subquiz 3 - valori ancore suma`;
      }
      return `Nivel ${level} - Subquiz 1 - anchors (modular)`;
    }

    function beginRoute() {
      if (!orchestrator) createOrchestrator();
      return orchestrator.startFirst();
    }

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
        via === "anchorSumValues"
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

    function handleOrchestratorResult(result) {
      if (result?.subquizEvent?.routeComplete) {
        return advanceLevel(result.subquizEvent.subquizId ?? "anchors");
      }
      return result;
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

      getSubquizStage: () => orchestrator?.getCurrentId?.() ?? "anchors",
      getSubquizStartOption: () => startStageSelection,
      getSubquizStartOptions() {
        return [
          { id: "normal", label: "Normal" },
          { id: "anchorsOnly", label: "1 anchors" },
          { id: "intensivOnly", label: "2 intensiv" },
          { id: "anchorSumValuesOnly", label: "3 valori ancore suma" },
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
        const currentId = orchestrator?.getCurrentId?.();
        return {
          visible: true,
          mode:
            currentId === "intensiv"
              ? "Subquiz 2: intensiv"
              : currentId === "anchorSumValues"
              ? "Subquiz 3: valori ancore suma"
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
              : currentId === "anchorSumValues"
              ? `${anchorSumState?.questionCount ?? 0} / ${ANCHOR_SUM_MAX_QUESTIONS} - streak ${anchorSumState?.correctStreak ?? 0} / ${ANCHOR_SUM_STREAK_TO_EXIT}`
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
        return handleOrchestratorResult(orchestrator.onAnswer(index, meta));
      },

      onTimeout(meta = {}) {
        return handleOrchestratorResult(orchestrator.onTimeout(meta));
      },
    };
  }

  global.Mul1120V2ModularQuiz = { create: createQuiz };

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: QUIZ_TITLE,
    description: "Lab modular pentru T*/ 11-20 v2. Etapa 1: anchors + intensiv intern.",
    order: 2.1,
    gestionareGreseli: { activ: false },
    create(meta = {}) {
      return global.Mul1120V2ModularQuiz.create({ quizId: meta.id ?? QUIZ_ID });
    },
  });
})(window);
