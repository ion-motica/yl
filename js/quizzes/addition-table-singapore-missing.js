(function (global) {
  "use strict";

  const QUIZ_ID = "addition-table-singapore-missing";
  const MIN_LEVEL = 3;
  const MAX_LEVEL = 10;
  const MIN_POOL_SIZE = 2;
  const FAST_RESPONSE_MS = 2000;
  const OPTION_MIN = 1;
  const OPTION_MAX = 9;

  const FACT_STATS_CONFIG = {
    getFastResponseMs: () => FAST_RESPONSE_MS,
  };

  // Acelasi handler pe care quizul il declara motorului (vezi obiectul returnat
  // de `createAdditionTableSingaporeMissingQuiz`). Vezi js/placeholder-raspuns.js.
  const placeholder = global.PlaceholderRaspuns.creeaza("?");

  function createAdditionTableSingaporeMissingQuiz() {
    const { shuffle } = global.GameUtils;
    const { FactCatalog, FactStore, FactStats } = global;
    const { KNOWLEDGE_LEVEL } = FactStats;

    let level = MIN_LEVEL;
    let gameCompleted = false;

    let knownPool = [];
    let activeQueue = [];
    let wrongFactIds = [];
    let phase = "main";
    let historyLines = [];
    let a_gresit_in_serie = false;
    // Bv-urile (label "a+b") rezolvate in nivelul curent — pt. inventarul
    // afisat (getInventarBonduri). Se reseteaza doar la nivel nou, NU la
    // intrarea in faza retry (spre deosebire de historyLines): scopul e sa
    // arate acoperirea intregului nivel, care ramane valabila in retry.
    let bvRezolvate = new Set();
    // Instantaneu al inventarului nivelului tocmai terminat, afisat CAT TIMP
    // sta pe ecran bannerul "Felicitări! Next level!" — cerere user
    // (29.08.2026): tabelul nu trebuie sa treaca la nivelul nou (gol) chiar
    // in clipa avansului, ci abia dupa ce se raspunde la prima intrebare a
    // nivelului nou (corect sau nu). Se seteaza o singura data, la avans
    // (construieste_pasul_de_serie_terminata), si se sterge neconditionat la
    // urmatorul raspuns (dupa_turn_apasare) — care e mereu primul raspuns din
    // nivelul nou, din constructie.
    let inventarInGratie = null;

    let currentFact = null;
    let currentMissingSide = "left";
    let options = [];
    let correctIndex = 0;
    let orchestrator = null;

    // Faza E, sectiunea 12: orice quiz trebuie construit intern prin
    // SubquizOrchestrator (vezi addition-table-singapore.js pt. explicatia
    // completa a tiparului — fisier-frate, aceeasi structura + dimensiunea
    // `missingSide`). `buildOptionsForFact` e singurul loc care schimba
    // `options`/`correctIndex` — sincronizeaza neconditionat, chiar acolo, la
    // final.
    function sincronizeazaOrchestratorul() {
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: promptLabel(currentFact, currentMissingSide),
        promptHtml: promptHtmlPentruRunda(currentFact, currentMissingSide),
        options: [...options],
        correctIndex,
      });
    }

    function pickMissingSide() {
      return Math.random() < 0.5 ? "left" : "right";
    }

    function correctAnswer(fact, missingSide = currentMissingSide) {
      const { a, b } = fact.values;
      return String(missingSide === "left" ? a : b);
    }

    function knownAddend(fact, missingSide = currentMissingSide) {
      const { a, b } = fact.values;
      return missingSide === "left" ? b : a;
    }

    function historyLine(fact) {
      const { a, b } = fact.values;
      return `${level}=${a}+${b}`;
    }

    // "a+b" fara prefixul de nivel — labelul folosit de InventarBonduri
    // (vezi getInventarBonduri, mai jos), acelasi format ca decompositionLabel
    // din addition-table-singapore.js (fisier-frate).
    function decompositionLabel(fact) {
      const { a, b } = fact.values;
      return `${a}+${b}`;
    }

    function promptLabel(fact, missingSide = currentMissingSide) {
      const k = knownAddend(fact, missingSide);
      return missingSide === "left" ? `${level}=?+${k}` : `${level}=${k}+?`;
    }

    // `promptHtml` standard, construit de quiz (ca la "Numaram din 2 in 2" sau
    // stack-ul de la T*/ 11-20 v4): istoricul turului + linia curenta, cu
    // placeholderul marcat prin contractul comun. Motorul nu mai are nevoie sa
    // stie nimic despre "singapore-bond" — gaseste span-ul marcat si-l
    // revelaza in loc, exact ca la orice alt quiz.
    function currentLineHtml(fact, missingSide = currentMissingSide) {
      const k = knownAddend(fact, missingSide);
      return missingSide === "left"
        ? `${level}=${placeholder.marcaj()}+${k}`
        : `${level}=${k}+${placeholder.marcaj()}`;
    }

    function promptHtmlPentruRunda(fact, missingSide = currentMissingSide) {
      const historyHtml = historyLines
        .map((line) => `<div class="singapore-history-line">${line}</div>`)
        .join("");
      return (
        `<div class="singapore-prompt">` +
        (historyHtml ? `<div class="singapore-history">${historyHtml}</div>` : "") +
        `<div class="singapore-current">${currentLineHtml(fact, missingSide)}</div>` +
        `</div>`
      );
    }

    function queueItem(factId, missingSide = pickMissingSide()) {
      return { factId, missingSide };
    }

    function factsForSum(targetSum) {
      const facts = [];
      for (let a = 1; a < targetSum; a++) {
        const b = targetSum - a;
        if (b < 1) continue;
        facts.push(
          FactCatalog.createFact({
            operation: "add",
            promptForm: FactCatalog.PROMPT_FORMS.result,
            values: { a, b },
          })
        );
      }
      return facts;
    }

    function knowledgeLevelOf(fact) {
      const stored = FactStore.getFact(fact.factId, fact) ?? fact;
      return FactStats.getKnowledgeLevel(stored, FACT_STATS_CONFIG);
    }

    // Universul per nivel e mic si fix (nivelul 6 are exact 5 bv-uri, nivelul
    // 10 are 9). Regula de avans (construieste_pasul_de_serie_terminata) cere
    // acoperirea TUTUROR bv-urilor unui nivel inainte de a trece mai departe,
    // deci turul nu se trunchiaza niciodata la un subset. Vezi comentariul
    // identic din addition-table-singapore.js (fisier-frate) pt. istoricul
    // bug-ului pe care trunchierea veche (MAX_PERFORMANT/FILL_TIERS) il cauza.
    function selectPoolForLevel(targetSum = level) {
      return factsForSum(targetSum);
    }

    function pickNearWrongAnswers(correct, count) {
      const correctNum = Number(correct);
      const used = new Set([correct]);
      const candidates = [];

      for (let delta = 1; delta <= OPTION_MAX - OPTION_MIN; delta++) {
        for (const value of [correctNum - delta, correctNum + delta]) {
          if (value < OPTION_MIN || value > OPTION_MAX) continue;
          const label = String(value);
          if (used.has(label)) continue;
          candidates.push(label);
          used.add(label);
        }
      }

      const picked = [];
      for (const label of shuffle(candidates)) {
        if (picked.length >= count) break;
        picked.push(label);
      }
      return picked;
    }

    function buildOptionsForFact(fact, missingSide = currentMissingSide) {
      const correctLabel = correctAnswer(fact, missingSide);
      const wrong = pickNearWrongAnswers(correctLabel, 2);
      const fallback = (offset) =>
        String(Math.min(OPTION_MAX, Math.max(OPTION_MIN, Number(correctLabel) + offset)));

      const triple = shuffle([
        correctLabel,
        wrong[0] ?? fallback(-1),
        wrong[1] ?? fallback(1),
      ]);
      options = triple;
      correctIndex = options.indexOf(correctLabel);
      sincronizeazaOrchestratorul();
    }

    function factById(factId) {
      return knownPool.find((fact) => fact.factId === factId) ?? null;
    }

    function addKnownVariants(needed) {
      let added = 0;
      const used = new Set(activeQueue.map((item) => item.factId));
      const tierOrder = [
        KNOWLEDGE_LEVEL.PERFORMANT,
        KNOWLEDGE_LEVEL.CORECT_DAR_LENT,
        KNOWLEDGE_LEVEL.SLAB,
        KNOWLEDGE_LEVEL.PRAF,
        KNOWLEDGE_LEVEL.NOU,
      ];

      for (const tier of tierOrder) {
        if (added >= needed) break;
        for (const fact of knownPool) {
          if (added >= needed) break;
          if (used.has(fact.factId)) continue;
          if (knowledgeLevelOf(fact) !== tier) continue;
          activeQueue.push(queueItem(fact.factId));
          used.add(fact.factId);
          added++;
        }
      }
    }

    function incepe_serie_de_intrebari() {
      knownPool = selectPoolForLevel(level);
      activeQueue = shuffle(knownPool.map((fact) => queueItem(fact.factId)));
      wrongFactIds = [];
      phase = "main";
      historyLines = [];
      a_gresit_in_serie = false;
      bvRezolvate = new Set();
      return beginCurrentStep();
    }

    function beginRetryPhase() {
      phase = "retry";
      historyLines = [];
      activeQueue = [...wrongFactIds];
      wrongFactIds = [];

      if (activeQueue.length < MIN_POOL_SIZE) {
        addKnownVariants(MIN_POOL_SIZE - activeQueue.length);
      }

      activeQueue = shuffle(activeQueue);
      return beginCurrentStep();
    }

    function beginCurrentStep() {
      const nextItem = activeQueue[0];
      if (!nextItem) {
        return construieste_pasul_de_serie_terminata(
          currentFact ? historyLine(currentFact) : `${level}=?`
        );
      }

      currentFact = factById(nextItem.factId);
      currentMissingSide = nextItem.missingSide;
      if (!currentFact) {
        activeQueue.shift();
        return beginCurrentStep();
      }

      buildOptionsForFact(currentFact, currentMissingSide);
      return roundView();
    }

    function roundView(extra = {}) {
      return {
        // `prompt` ramane text simplu (fara HTML) — il citesc jurnalul si
        // loguri, care vor "3=?+2", nu marcaj HTML.
        prompt: promptLabel(currentFact, currentMissingSide),
        promptHtml: promptHtmlPentruRunda(currentFact, currentMissingSide),
        options: formatOptionsForView(),
        correctIndex,
        divisionHistory: [],
        hintMessage: extra.hintMessage ?? "Alege numărul corect pentru ?.",
        ...extra,
      };
    }

    function formatOptionsForView(source = options) {
      return source.map((value) => (value == null ? "—" : String(value)));
    }

    function recordAttempt(correct, chosenAnswer, meta = {}) {
      FactStore.recordAttempt(
        currentFact.factId,
        {
          at: meta.at,
          correct,
          responseMs: meta.responseMs,
          answer: chosenAnswer,
          timedOut: Boolean(meta.timedOut),
          quizId: QUIZ_ID,
        },
        currentFact
      );
    }

    function construieste_pasul_de_serie_terminata(label) {
      const finishedLevel = level;
      const holdView = roundView({ hintMessage: "" });

      if (!a_gresit_in_serie) {
        if (finishedLevel >= MAX_LEVEL) {
          gameCompleted = true;
          return {
            outcome: "step-correct",
            correct: true,
            bounce: true,
            message: `Corect! ${label}`,
            ...holdView,
            pasUrmator: {
              continua: {
                outcome: "serie-terminata",
                correct: true,
                serie_terminata: true,
                gameComplete: true,
                flash: "win",
                banner: "Felicitări! Ai terminat nivelul 10!",
                message: "Felicitări! Ai terminat nivelul 10!",
              },
            },
          };
        }

        level++;
        inventarInGratie = { nivel: finishedLevel, rezolvate: new Set(bvRezolvate) };
        const nextView = incepe_serie_de_intrebari();
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Corect! ${label}`,
          ...holdView,
          pasUrmator: {
            continua: {
              outcome: "serie-terminata",
              correct: true,
              serie_terminata: true,
              levelAdvanced: true,
              flash: "win",
              banner: "Felicitări! Next level!",
              message: `Felicitări! Nivel ${level}`,
              nextRound: nextView,
            },
          },
        };
      }

      const retryView = beginRetryPhase();
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: `Corect! ${label}`,
        ...holdView,
        pasUrmator: {
          continua: {
            ...retryView,
            resetFall: true,
          },
        },
      };
    }

    // Motor 3 butoane (M3B) — vezi documente de referinta/PLAN-motor-comun-raspuns.md.
    // Fara pasi intermediari de tip "lant": fiecare raspuns corect fie trece la
    // urmatorul fapt din coada turului curent, fie incheie turul (nivel nou /
    // faza retry / joc complet), prin `pasUrmator`.
    //
    // Pauza custom de 400ms (de dinainte de migrare, de 2,5x mai lenta decat
    // DEFAULT_REVEAL_HOLD_MS=160 din motor) a fost SCOASA — cerere
    // user (28.08.2026), la standardizarea formatului `singapore-bond`. Vezi
    // documente de referinta/CONTINUARE-contract-semn-intrebare.md.
    //
    // Faza E, sectiunea 12: invelit intr-un SubquizOrchestrator (o singura
    // bucata "baza") — vezi addition-table-singapore.js pt. explicatia
    // capcanelor deja intalnite acolo (`intrebareUrmatoare` deja cod mort,
    // mesaj dinamic cu `ctx.alesul`), toate identice si aici.
    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "base",
        title: "baza",
        hintMessage: "Alege numărul corect pentru ?.",
        esteCorect: (_item, index) => options[index] === correctAnswer(currentFact, currentMissingSide),
        generator: () => ({}),
        mesaje: {
          gresit: (ctx) =>
            `La ${promptLabel(currentFact, currentMissingSide)}, ${ctx.alesul} nu e corect. Încearcă din nou!`,
        },
        actiuni: {
          dupa_turn_apasare: (ctx) => {
            // Orice raspuns (corect sau gresit) e din constructie primul din
            // nivelul nou daca tocmai am avansat — inventarul in gratie a
            // servit rolul lui (a tinut tabelul vechi pe ecran cat a fost
            // afisat bannerul), acum trece pe starea live a nivelului curent.
            inventarInGratie = null;
            recordAttempt(ctx.corect, ctx.alesul, ctx.meta);
            if (!ctx.corect) {
              a_gresit_in_serie = true;
              if (
                !wrongFactIds.some(
                  (item) =>
                    item.factId === currentFact.factId && item.missingSide === currentMissingSide
                )
              ) {
                wrongFactIds.push(queueItem(currentFact.factId, currentMissingSide));
              }
            }
            // Nimic de adaugat: `prompt`/`promptHtml` raman cele deja
            // sincronizate pe `currentItem` (vezi `sincronizeazaOrchestratorul`)
            // — motorul le reafiseaza neschimbate pe raspuns gresit, standard,
            // ca la orice alt quiz.
            return {};
          },
          dupaRaspunsCorect: () => {
            const label = historyLine(currentFact);
            bvRezolvate.add(decompositionLabel(currentFact));
            historyLines.push(label);
            activeQueue.shift();

            if (activeQueue.length) {
              const nextView = beginCurrentStep();
              return {
                action: "continue",
                view: {
                  outcome: "step-correct",
                  correct: true,
                  bounce: true,
                  message: `Corect! ${label}`,
                  ...nextView,
                },
              };
            }

            if (phase === "retry") {
              a_gresit_in_serie = false;
            }

            return { action: "continue", view: construieste_pasul_de_serie_terminata(label) };
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
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getMinLevel: () => MIN_LEVEL,
      getLevelLabel: () => `Nivel ${level} · numărul ${level}`,
      getLevelButtonTitle: (targetLevel) => `Nivel ${targetLevel}: numărul ${targetLevel}`,

      getProgressDisplay: () => ProgressDisplay.hidden(),

      // Contract explicit pt. panoul de inventar bonds (vezi js/bond-inventory.js
      // si app.js/renderInventarBonduri): quizul raporteaza doar nivelul si
      // ce bv-uri s-au rezolvat pana acum in nivelul asta — modulul construieste
      // randurile (ordine, culoare, spatiu rezervat).
      getInventarBonduri: () =>
        global.InventarBonduri.construieste(inventarInGratie ?? { nivel: level, rezolvate: bvRezolvate }),

      isCompleted: () => gameCompleted,
      setCompleted: (value) => {
        gameCompleted = value;
      },

      resetLevelState() {
        knownPool = [];
        activeQueue = [];
        wrongFactIds = [];
        phase = "main";
        historyLines = [];
        a_gresit_in_serie = false;
        bvRezolvate = new Set();
        inventarInGratie = null;
        currentFact = null;
        currentMissingSide = "left";
        options = [];
        correctIndex = 0;
      },

      switchLevel(nextLevel) {
        let message = null;
        if (nextLevel < MIN_LEVEL) {
          level = MIN_LEVEL;
          message = "Prea ușor! trecem direct la nivelul 3!";
        } else {
          level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        }
        gameCompleted = false;
        this.resetLevelState();
        return message;
      },

      placeholderRaspuns: placeholder,
      laSchimbareDeNivel: global.SchimbareDeNivel.standard(),
      beginRound() {
        return incepe_serie_de_intrebari();
      },

      onTimeout(meta = {}) {
        recordAttempt(false, null, { ...meta, timedOut: true });
        a_gresit_in_serie = true;
        if (!wrongFactIds.some((item) => item.factId === currentFact.factId && item.missingSide === currentMissingSide)) {
          wrongFactIds.push(queueItem(currentFact.factId, currentMissingSide));
        }
        return {
          outcome: "timeout",
          flash: "wrong",
          message: "Prea târziu! Alege numărul corect pentru ?.",
          resetFall: true,
          ...roundView({ hintMessage: "" }),
        };
      },

      // Migrat la Motor3Butoane (Faza D, lotul 2), invelit in SubquizOrchestrator
      // (Faza E, sectiunea 12) — vezi `baseDefinition`, mai sus.
      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },

      pickNextRound: () => incepe_serie_de_intrebari(),
    };
  }

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: "Tabla adunarii Singapore 6=?+3",
    description:
      "Completează ? în N=?+k sau N=k+? (ex. 6=?+3, 6=2+?). Reluare după greșeli. Nivel 3–10.",
    order: -7,
    gestionareGreseli: { activ: false },
    create: createAdditionTableSingaporeMissingQuiz,
  });
})(window);
