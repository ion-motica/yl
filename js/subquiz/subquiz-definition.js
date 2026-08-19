(function (global) {
  "use strict";

  function define(definition) {
    if (!definition || typeof definition !== "object") {
      throw new Error("SubquizDefinition requires an object.");
    }
    if (!definition.id) throw new Error("SubquizDefinition requires id.");
    if (!definition.title) throw new Error("SubquizDefinition requires title.");
    if (definition.onAnswer !== undefined) {
      // Faza E din documente de referinta/PLAN-motor-comun-raspuns.md: subquizul
      // da doar CE (esteCorect/generator/actiuni/mesaje), niciodata CUM. Calea
      // comuna de mai jos (vezi createRuntime) e singura care raspunde la o
      // apasare, delegand integral catre Motor3Butoane.
      throw new Error(
        `SubquizDefinition "${definition.id}": "onAnswer" nu mai e permis — ` +
          `foloseste esteCorect/generator/actiuni/mesaje. CUM raspunde la o apasare ` +
          `e treaba exclusiva a Motor3Butoane (js/motor-3-butoane.js), vezi ` +
          `documente de referinta/PLAN-motor-comun-raspuns.md, Faza E.`
      );
    }

    return {
      enabled: true,
      testMode: false,
      ...definition,
    };
  }

  function createState(definition, context, payload) {
    return typeof definition.initialState === "function"
      ? definition.initialState({ context, payload }) || {}
      : {};
  }

  function defaultEsteCorect(item, index) {
    const chosen = item?.options?.[index];
    const correct = item?.correctAnswer ?? item?.options?.[item?.correctIndex ?? -1];
    const chosenNum = Number(chosen);
    const correctNum = Number(correct);
    const bothNumeric = Number.isFinite(chosenNum) && Number.isFinite(correctNum);
    return bothNumeric ? chosenNum === correctNum : String(chosen) === String(correct);
  }

  const mesajeImplicite = {
    gresit: (context) => `${context.alesul} nu e bun. Mai incearca!`,
  };

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
        metadata: currentItem?.metadata,
        hintMessage: def.hintMessage ?? context.hintMessage ?? "",
        ...extra,
      };
    }

    // Singura cale prin care un subquiz raspunde la o apasare (Faza E). Subquizul
    // da doar date declarative (esteCorect/generator/actiuni/mesaje); CUM se
    // avanseaza sau se ramane pe intrebare e in intregime treaba lui Motor3Butoane
    // — vezi js/motor-3-butoane.js.
    const motor = global.Motor3Butoane.creeaza({
      esteCorect: def.esteCorect ?? defaultEsteCorect,
      intrebareUrmatoare: (m3bContext) => nextItem({ reason: "afterAnswer", m3bContext }),
      actiuni: def.actiuni,
      mesaje: { ...mesajeImplicite, ...(def.mesaje || {}) },
    });

    function begin(nextPayload = payload) {
      payload = nextPayload ?? {};
      state = createState(def, context, payload);
      if (typeof def.onEnter === "function") {
        def.onEnter({ context, state, payload, runtime: api });
      }
      nextItem({ reason: "begin" });
      return view(
        motor.laAfisareaIntrebarii({ item: currentItem, stare: state, itemAnterior: null })
      );
    }

    function onAnswer(index, meta = {}) {
      const rezultat = motor.laApasareButon({
        item: currentItem,
        index,
        stare: state,
        meta,
        construiesteVedere: view,
      });
      // M3B ataseaza mereu un view (chiar minimal) oricarei comenzi de rutare — inclusiv
      // "pop". Orchestratorul trateaza `command.view ?? resumed.view` la "pop" ca alternative
      // EXCLUSIVE, deci un view mereu-prezent ar ingropa mereu vederea produsa de `onResume`
      // al subquiz-ului la care se revine. Il stergem aici, centralizat, ca orice subquiz cu
      // `pop` sa primeasca vederea corecta fara sa reimplementeze fixul (gasit repetat, per
      // fisier, in Faza D — vezi documente de referinta/RAPORT-motor-comun-raspuns.md, Lotul 4).
      if (rezultat.action === "pop") delete rezultat.view;
      return rezultat;
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
      onAnswer,
      onTimeout,
    };

    return api;
  }

  global.SubquizDefinition = {
    define,
    createRuntime,
  };
})(window);
