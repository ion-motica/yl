(function (global) {
  "use strict";

  const QUIZ_ID = "addition-table-singapore";
  const MIN_LEVEL = 3;
  const MAX_LEVEL = 10;
  const MIN_POOL_SIZE = 2;
  const FAST_RESPONSE_MS = 2000;

  const FACT_STATS_CONFIG = {
    getFastResponseMs: () => FAST_RESPONSE_MS,
  };

  // Acelasi handler pe care quizul il declara motorului (vezi obiectul returnat
  // de `createAdditionTableSingaporeQuiz`). Vezi js/placeholder-raspuns.js.
  const placeholder = global.PlaceholderRaspuns.creeaza("?");

  function createAdditionTableSingaporeQuiz() {
    const { randomInt, shuffle } = global.GameUtils;
    const { FactCatalog, FactStore, FactStats } = global;
    const { KNOWLEDGE_LEVEL } = FactStats;

    let level = MIN_LEVEL;
    let gameCompleted = false;

    let knownPool = [];
    let activeQueue = [];
    let wrongFactIds = [];
    let phase = "main";
    let a_gresit_in_serie = false;
    // Bv-urile (label "a+b") rezolvate in nivelul curent — pt. inventarul
    // colorat afisat direct in caseta intrebarii (vezi promptHtmlPentruRunda).
    // Se reseteaza doar la nivel nou, NU la intrarea in faza retry: scopul e
    // sa arate acoperirea intregului nivel, care ramane valabila in retry.
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
    let options = [];
    let correctIndex = 0;
    let orchestrator = null;

    // Faza E, sectiunea 12: orice quiz trebuie construit intern prin
    // SubquizOrchestrator (vezi equations-e3-e6.js pt. explicatia completa a
    // tiparului). `buildOptionsForFact` e singurul loc care schimba
    // `options`/`correctIndex` — sincronizeaza neconditionat, chiar acolo, la
    // final.
    function sincronizeazaOrchestratorul() {
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: `${level}=`,
        promptHtml: promptHtmlPentruRunda(),
        options: [...options],
        correctIndex,
      });
    }

    function decompositionLabel(fact) {
      const { a, b } = fact.values;
      return `${a}+${b}`;
    }

    // Inventarul bv-urilor nivelului curent — cat timp e activa gratia
    // (vezi inventarInGratie), arata inca nivelul tocmai terminat.
    function inventarCurent() {
      return global.InventarBonduri.construieste(inventarInGratie ?? { nivel: level, rezolvate: bvRezolvate });
    }

    // `promptHtml` standard, construit de quiz (acelasi tipar ca la
    // addition-table-singapore-missing.js si stack-ul de la T*/ 11-20 v4):
    // inventarul colorat al bv-urilor + linia curenta, cu placeholderul marcat
    // prin contractul comun. Placeholderul aici tine locul intregii
    // descompuneri (butoanele arata "2+1", nu o singura cifra) — contractul
    // nu are nicio conditie asupra formei valorii revelate, doar asupra
    // locului ei.
    //
    // Cerere user (29.08.2026): lista colorata a bv-urilor (inainte un panou
    // separat, langa arena) inlocuieste aici vechiul istoric text simplu
    // (singapore-history) — acelasi loc din caseta intrebarii, continut nou.
    function promptHtmlPentruRunda() {
      return (
        `<div class="singapore-prompt">` +
        global.InventarBonduri.randaHtml(inventarCurent()) +
        `<div class="singapore-current">${level}=${placeholder.marcaj()}</div>` +
        `</div>`
      );
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

    // Universul per nivel e mic si fix (nivelul 6 are exact 5 bv-uri — vezi
    // decompositionLabel/factsForSum — nivelul 10 are 9). Regula de avans
    // (construieste_pasul_de_serie_terminata) cere acoperirea TUTUROR
    // bv-urilor unui nivel inainte de a trece mai departe, deci turul nu se
    // trunchiaza niciodata la un subset. Inainte, functia asta trunchia la
    // MAX_PERFORMANT/MIN_POOL_SIZE (tipar copiat dintr-un quiz cu univers mare
    // de fapte, unde esantionarea chiar are sens) — aici rupea acoperirea:
    // cu 2+ bv-uri deja "performante", turul se reducea la 2, iar o greseala
    // acolo intra in retry pe acelasi nivel la nesfarsit ("reseteaza lista si
    // reia cu acelasi numar", bug raportat 29.08.2026).
    function selectPoolForLevel(targetSum = level) {
      return factsForSum(targetSum);
    }

    function pickWrongDecompositions(targetSum, correctFact, count, exclude = []) {
      const { a: ca, b: cb } = correctFact.values;
      const correctLabel = decompositionLabel(correctFact);
      const used = new Set([correctLabel, ...exclude.filter(Boolean)]);
      const candidates = [];

      function tryAdd(x, y) {
        if (x < 1 || y < 1) return;
        const label = `${x}+${y}`;
        if (label === correctLabel || used.has(label) || candidates.includes(label)) return;
        if (x + y !== targetSum) {
          candidates.push(label);
          used.add(label);
        }
      }

      for (let da = -3; da <= 3; da++) {
        for (let db = -3; db <= 3; db++) {
          if (da === 0 && db === 0) continue;
          tryAdd(ca + da, cb + db);
        }
      }

      for (const fact of knownPool) {
        if (fact.factId === correctFact.factId) continue;
        used.add(decompositionLabel(fact));
      }

      if (candidates.length < count) {
        for (let offset = 1; offset <= targetSum + 4 && candidates.length < count * 4; offset++) {
          tryAdd(ca + offset, cb);
          tryAdd(ca, cb + offset);
          tryAdd(ca - offset, cb);
          tryAdd(ca, cb - offset);
          tryAdd(ca + offset, cb + offset);
          tryAdd(ca - offset, cb - offset);
        }
      }

      const picked = [];
      for (const label of shuffle(candidates)) {
        if (picked.length >= count) break;
        picked.push(label);
      }
      return picked.slice(0, count);
    }

    function buildOptionsForFact(fact) {
      const correctLabel = decompositionLabel(fact);
      const wrong = pickWrongDecompositions(level, fact, 2);
      const triple = shuffle([correctLabel, wrong[0] ?? `${fact.values.a}+${fact.values.b + 1}`, wrong[1] ?? `${fact.values.a + 1}+${fact.values.b}`]);
      options = triple;
      correctIndex = options.indexOf(correctLabel);
      sincronizeazaOrchestratorul();
    }

    function factById(factId) {
      return knownPool.find((fact) => fact.factId === factId) ?? null;
    }

    function addKnownVariants(needed) {
      let added = 0;
      const used = new Set(activeQueue);
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
          activeQueue.push(fact.factId);
          used.add(fact.factId);
          added++;
        }
      }
    }

    function incepe_serie_de_intrebari() {
      knownPool = selectPoolForLevel(level);
      activeQueue = shuffle(knownPool.map((fact) => fact.factId));
      wrongFactIds = [];
      phase = "main";
      a_gresit_in_serie = false;
      bvRezolvate = new Set();
      return beginCurrentStep();
    }

    function beginRetryPhase() {
      phase = "retry";
      activeQueue = [...wrongFactIds];
      wrongFactIds = [];

      if (activeQueue.length < MIN_POOL_SIZE) {
        addKnownVariants(MIN_POOL_SIZE - activeQueue.length);
      }

      activeQueue = shuffle(activeQueue);
      return beginCurrentStep();
    }

    function beginCurrentStep() {
      const nextId = activeQueue[0];
      if (!nextId) {
        return construieste_pasul_de_serie_terminata(decompositionLabel(currentFact) || `${level}=?`);
      }

      currentFact = factById(nextId);
      if (!currentFact) {
        activeQueue.shift();
        return beginCurrentStep();
      }

      buildOptionsForFact(currentFact);
      return roundView();
    }

    function roundView(extra = {}) {
      return {
        // `prompt` ramane text simplu — il citesc jurnalul si logurile.
        prompt: `${level}=`,
        promptHtml: promptHtmlPentruRunda(),
        options: formatOptionsForView(),
        correctIndex,
        divisionHistory: [],
        hintMessage: extra.hintMessage ?? "Alege descompunerea corectă.",
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
            message: `Corect! ${finishedLevel}=${label}`,
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
          message: `Corect! ${finishedLevel}=${label}`,
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
        message: `Corect! ${level}=${label}`,
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
    // Fara pasi intermediari de tip "lant" (spre deosebire de prime-divisors.js):
    // fiecare raspuns corect fie trece la urmatorul fapt din coada turului
    // curent, fie incheie turul (nivel nou / faza retry / joc complet), prin
    // `pasUrmator`.
    //
    // Pauza custom de 400ms (de dinainte de migrare) a fost SCOASA — cerere
    // user (28.08.2026), la standardizarea formatului
    // `singapore-bond`. Odata cu ea a aparut si REVELAREA propriu-zisa: acest
    // quiz nu arata NICIODATA raspunsul ales inainte de azi (verificat empiric
    // — `stateHasQuestionMark` era mereu `false`, pentru ca `bondKnownAddend`
    // nu era setat niciodata aici). Cu placeholderul standard, motorul
    // revelaza in loc, automat, exact ca la orice alt quiz — nu a fost nevoie
    // de cod suplimentar pentru asta. Vezi documente de referinta/
    // CONTINUARE-contract-semn-intrebare.md.
    //
    // Faza E, sectiunea 12: invelit intr-un SubquizOrchestrator (o singura
    // bucata "baza"). `esteCorect`/`intrebareUrmatoare`/`actiuni` copiate
    // identic — `dupaRaspunsCorect` intorcea deja mereu o comanda explicita cu
    // `action` (spre deosebire de sub-sau-langa-radical.js/bagare-sub-radical.js),
    // deci `intrebareUrmatoare` (aici `() => null`, deja neutralizata inainte
    // de aceasta lucrare) ramane cod mort neatins, ca la primele 4 fisiere.
    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "base",
        title: "baza",
        hintMessage: "Alege descompunerea corectă.",
        esteCorect: (_item, index) => options[index] === decompositionLabel(currentFact),
        generator: () => ({}),
        mesaje: {
          gresit: (ctx) => `La ${level}=?, ${ctx.alesul} nu e corect. Încearcă din nou!`,
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
              if (!wrongFactIds.includes(currentFact.factId)) {
                wrongFactIds.push(currentFact.factId);
              }
            }
            // Nimic de adaugat: `prompt`/`promptHtml` raman cele deja
            // sincronizate pe `currentItem` (vezi `sincronizeazaOrchestratorul`)
            // — motorul le reafiseaza neschimbate pe raspuns gresit, standard,
            // ca la orice alt quiz.
            return {};
          },
          dupaRaspunsCorect: () => {
            const label = decompositionLabel(currentFact);
            bvRezolvate.add(label);
            activeQueue.shift();

            if (activeQueue.length) {
              const nextView = beginCurrentStep();
              return {
                action: "continue",
                view: {
                  outcome: "step-correct",
                  correct: true,
                  bounce: true,
                  message: `Corect! ${level}=${label}`,
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

      // Contract explicit (vezi js/bond-inventory.js): quizul raporteaza doar
      // nivelul si bv-urile rezolvate — modulul construieste randurile.
      // Aceleasi date sunt randate direct in promptHtml (vezi inventarCurent),
      // dar metoda ramane pe API-ul public — utila separat de randare (teste).
      getInventarBonduri: () => inventarCurent(),

      isCompleted: () => gameCompleted,
      setCompleted: (value) => {
        gameCompleted = value;
      },

      resetLevelState() {
        knownPool = [];
        activeQueue = [];
        wrongFactIds = [];
        phase = "main";
        a_gresit_in_serie = false;
        bvRezolvate = new Set();
        inventarInGratie = null;
        currentFact = null;
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
        if (!wrongFactIds.includes(currentFact.factId)) {
          wrongFactIds.push(currentFact.factId);
        }
        return {
          outcome: "timeout",
          flash: "wrong",
          message: "Prea târziu! Alege descompunerea corectă.",
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
    title: "Tabla adunarii Singapore 6=3+3|3+4",
    description:
      "Descompuneri pentru același număr (ex. 3=), cu reluare după greșeli. Nivel 3–10.",
    order: -8,
    gestionareGreseli: { activ: false },
    create: createAdditionTableSingaporeQuiz,
  });
})(window);
