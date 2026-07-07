(function (global) {
  "use strict";

  function define(definition) {
    if (!definition || typeof definition !== "object") {
      throw new Error("SubquizDefinition requires an object.");
    }
    if (!definition.id) throw new Error("SubquizDefinition requires id.");
    if (!definition.title) throw new Error("SubquizDefinition requires title.");

    return {
      enabled: true,
      testMode: false,
      ...definition,
    };
  }

  function createState(definition, context, payload) {
    const base = {
      questionCount: 0,
      correctCount: 0,
      wrongCount: 0,
      consecutiveCorrect: 0,
      mistakesByKey: {},
    };
    const custom =
      typeof definition.initialState === "function"
        ? definition.initialState({ context, payload }) || {}
        : {};
    return { ...base, ...custom };
  }

  function defaultGrade(item, index) {
    const chosen = item?.options?.[index];
    const correct = item?.correctAnswer ?? item?.options?.[item?.correctIndex ?? -1];
    const chosenNum = Number(chosen);
    const correctNum = Number(correct);
    const bothNumeric = Number.isFinite(chosenNum) && Number.isFinite(correctNum);
    return {
      chosen,
      isCorrect: bothNumeric
        ? chosenNum === correctNum
        : String(chosen) === String(correct),
    };
  }

  function objectExitRule(exitRule, state) {
    if (!exitRule || typeof exitRule !== "object") return null;
    if (
      Number.isFinite(exitRule.maxQuestions) &&
      state.questionCount >= exitRule.maxQuestions
    ) {
      return { reason: "maxQuestions" };
    }
    if (
      Number.isFinite(exitRule.consecutiveCorrect) &&
      state.consecutiveCorrect >= exitRule.consecutiveCorrect
    ) {
      return { reason: "consecutiveCorrect" };
    }
    return null;
  }

  function normalizeCommand(command, fallbackView) {
    if (!command) return { action: "continue", view: fallbackView };
    if (command.action) return command;
    if (
      command.prompt !== undefined ||
      command.promptHtml !== undefined ||
      command.options !== undefined
    ) {
      return { action: "continue", view: command };
    }
    return { action: "continue", view: fallbackView, ...command };
  }

  function createRuntime(definition, context = {}, payload = {}) {
    const def = define(definition);
    const generator = global.ItemGenerator.create(def.generator ?? def.nextItem);
    let state = createState(def, context, payload);
    let currentItem = null;

    function nextItem(extra = {}) {
      currentItem = generator.next({
        context,
        state,
        payload,
        currentItem,
        ...extra,
      });
      return currentItem;
    }

    function view(extra = {}) {
      return {
        prompt: currentItem?.prompt ?? "-",
        promptHtml: currentItem?.promptHtml,
        options: currentItem ? [...currentItem.options] : ["-", "-", "-"],
        correctIndex: currentItem?.correctIndex ?? 0,
        hintMessage: def.hintMessage ?? context.hintMessage ?? "",
        ...extra,
      };
    }

    function begin(nextPayload = payload) {
      payload = nextPayload ?? {};
      state = createState(def, context, payload);
      if (typeof def.onEnter === "function") {
        def.onEnter({ context, state, payload, runtime: api });
      }
      nextItem({ reason: "begin" });
      return view();
    }

    function genericOnAnswer(index, meta = {}) {
      const graded =
        typeof def.grade === "function"
          ? def.grade({ item: currentItem, index, state, context, meta })
          : defaultGrade(currentItem, index);

      const event = {
        item: currentItem,
        index,
        meta,
        chosen: graded.chosen,
        isCorrect: graded.isCorrect,
        state,
        context,
        payload,
        runtime: api,
      };

      if (typeof def.onAnswer === "function") {
        return normalizeCommand(def.onAnswer(event), view());
      }

      state.questionCount += 1;
      if (graded.isCorrect) {
        state.correctCount += 1;
        state.consecutiveCorrect += 1;
      } else {
        state.wrongCount += 1;
        state.consecutiveCorrect = 0;
      }

      const exit =
        typeof def.exitRule === "function"
          ? def.exitRule(event)
          : objectExitRule(def.exitRule, state);
      if (exit) return { action: "exit", reason: exit.reason ?? "exit", event };

      if (!graded.isCorrect && def.wrongAnswerRule?.mode === "retrySame") {
        return {
          action: "stay",
          view: view({
            outcome: "wrong-answer",
            correct: false,
            flash: "wrong",
            message: `${graded.chosen} nu e bun. Mai incearca!`,
          }),
          event,
        };
      }

      nextItem({ reason: "afterAnswer", event });
      return {
        action: "continue",
        view: view({
          outcome: graded.isCorrect ? "step-correct" : "wrong-answer",
          correct: graded.isCorrect,
          bounce: graded.isCorrect,
          flash: graded.isCorrect ? undefined : "wrong",
        }),
        event,
      };
    }

    function onTimeout(meta = {}) {
      if (typeof def.onTimeout === "function") {
        return normalizeCommand(
          def.onTimeout({ item: currentItem, meta, state, context, payload, runtime: api }),
          view({ resetFall: true })
        );
      }
      return {
        action: "stay",
        view: view({ outcome: "round", resetFall: true }),
      };
    }

    function resume(resumePayload = {}) {
      if (typeof def.onResume === "function") {
        return normalizeCommand(
          def.onResume({ context, state, payload: resumePayload, runtime: api }),
          view()
        );
      }
      return { action: "continue", view: view() };
    }

    const api = {
      definition: def,
      getState: () => state,
      setState: (next) => {
        state = { ...state, ...(next || {}) };
      },
      getCurrentItem: () => currentItem,
      setCurrentItem: (item) => {
        currentItem = global.ItemGenerator.normalizeItem(item);
        return currentItem;
      },
      nextItem,
      view,
      begin,
      resume,
      onAnswer: genericOnAnswer,
      onTimeout,
    };

    return api;
  }

  global.SubquizDefinition = {
    define,
    createRuntime,
  };
})(window);
