(function (global) {
  "use strict";

  const QUIZ_ID = "addition-table-singapore-missing";
  const MIN_LEVEL = 3;
  const MAX_LEVEL = 10;
  const OPTION_MIN = 1;
  const OPTION_MAX = 9;

  // Acelasi handler pe care quizul il declara motorului (vezi obiectul returnat
  // de `createAdditionTableSingaporeMissingQuiz`). Vezi js/placeholder-raspuns.js.
  const placeholder = global.PlaceholderRaspuns.creeaza("?");

  function createAdditionTableSingaporeMissingQuiz() {
    const { shuffle } = global.GameUtils;
    const { FactCatalog, FactStore } = global;

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
    // Ilustratia cu cosuri de mere (js/bond-illustration.js) — instanta proprie
    // acestui quiz, cu acelasi ciclu de reset ca bvRezolvate (vezi mai jos).
    const ilustrareBonduri = global.IlustrareBonduri.creeaza();

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
        elementeDivIntrebare: elementeDivIntrebarePentruRunda(currentFact, currentMissingSide),
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

    // Motorul nu mai are nevoie sa stie nimic despre "singapore-bond" —
    // gaseste span-ul marcat si-l revelaza in loc, exact ca la orice alt quiz.
    function currentLineHtml(fact, missingSide = currentMissingSide) {
      const k = knownAddend(fact, missingSide);
      return missingSide === "left"
        ? `${level}=${placeholder.marcaj()}+${k}`
        : `${level}=${k}+${placeholder.marcaj()}`;
    }

    // Inventarul bv-urilor nivelului curent — live, fara intarziere. Cerere
    // user (30.08.2026): tabelul vechi ramas in caseta intrebarii dupa avans
    // (gratie pana la primul raspuns nou) confuza — trece pe nivelul nou
    // imediat ce se anunta avansul, nu asteapta niciun raspuns.
    function inventarCurent() {
      return global.InventarBonduri.construieste({ nivel: level, rezolvate: bvRezolvate });
    }

    // `promptHtml` standard, construit de quiz (ca la stack-ul de la T*/
    // 11-20 v4): inventarul colorat al bv-urilor + linia curenta, cu
    // placeholderul marcat prin contractul comun.
    //
    // Cerere user (29.08.2026): lista colorata a bv-urilor (inainte un panou
    // separat, langa arena) inlocuieste aici vechiul istoric text simplu
    // (singapore-history) — acelasi loc din caseta intrebarii, continut nou.
    function promptHtmlPentruRunda(fact, missingSide = currentMissingSide) {
      return (
        `<div class="singapore-prompt">` +
        global.InventarBonduri.randaHtml(inventarCurent()) +
        `<div class="singapore-current" data-element-div-intrebare="linia-curenta">${currentLineHtml(fact, missingSide)}</div>` +
        `</div>`
      );
    }

    // Elementele patchabile in loc la runda urmatoare (contractul "Mod
    // scriere intrebare noua" din falling-engine.js): randurile inventarului
    // bv-urilor SI linia curenta — motorul modifica DOAR elementele de-aici,
    // fara sa atinga restul promptului. Daca lipseste vreunul (ex. doar
    // randurile, nu si linia curenta), linia curenta ramane blocata pe
    // continutul vechi la runda urmatoare — gasit si reparat 30.08.2026.
    function elementeDivIntrebarePentruRunda(fact, missingSide = currentMissingSide) {
      return [
        ...global.InventarBonduri.elementeDivIntrebare(inventarCurent()),
        { id: "linia-curenta", html: currentLineHtml(fact, missingSide) },
      ];
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

    function incepe_serie_de_intrebari() {
      knownPool = selectPoolForLevel(level);
      activeQueue = shuffle(knownPool.map((fact) => queueItem(fact.factId)));
      wrongFactIds = [];
      phase = "main";
      a_gresit_in_serie = false;
      bvRezolvate = new Set();
      ilustrareBonduri.reseteaza();
      return beginCurrentStep();
    }

    // Bug raportat 30.08.2026: dupa o singura greseala, retry mai punea in
    // coada si un al doilea bv oarecare (padding pana la MIN_POOL_SIZE=2,
    // ales din knownPool fara sa tina cont ca era deja rezolvat) — inventarul
    // arata deja tot verde, dar mai venea o intrebare in plus, aparent din
    // senin. Retry reia STRICT ce s-a gresit, oricat de putin — 1 bv gresit
    // inseamna exact 1 intrebare in retry, nu 2.
    function beginRetryPhase() {
      phase = "retry";
      activeQueue = shuffle([...wrongFactIds]);
      wrongFactIds = [];
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
        elementeDivIntrebare: elementeDivIntrebarePentruRunda(currentFact, currentMissingSide),
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

    function construieste_pasul_de_serie_terminata(label, { asteaptaAnimatia = false } = {}) {
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
        const nextView = incepe_serie_de_intrebari();
        return {
          outcome: "step-correct",
          correct: true,
          bounce: true,
          message: `Corect! ${label}`,
          ...holdView,
          pasUrmator: {
            // Daca ultimul bv rezolvat inainte de avans a pornit un zbor de
            // discuri (vezi ilustrareBonduri.arataBv/zborDeclansat, mai sus),
            // asteptam sa se termine INAINTE sa aratam tabelul nivelului
            // urmator — altfel discurile ajung sa zboare peste tabelul deja
            // rescris (cerere user, 31.08.2026: "asteapta sa se termine
            // animatia inainte sa treci la nivelul urmator").
            ...(asteaptaAnimatia ? { dupa: global.IlustrareBonduri.DURATA_TRANZITIE_MS + 100 } : {}),
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
            // Vezi comentariul identic din addition-table-singapore.js — recuperarea
            // imediata dupa o apasare gresita (tot in faza "main") nu inseamna bv
            // terminat, se mai cere o data la reluare.
            const esteRecuperareInFazaPrincipala =
              phase === "main" &&
              wrongFactIds.some(
                (item) => item.factId === currentFact.factId && item.missingSide === currentMissingSide
              );
            // true daca bv-ul tocmai rezolvat a pornit un zbor de discuri —
            // citit de construieste_pasul_de_serie_terminata mai jos, ca sa
            // amane avansul de nivel pana se termina (cerere user, 31.08.2026).
            let zborDeclansat = false;
            if (!esteRecuperareInFazaPrincipala) {
              const bvLabel = decompositionLabel(currentFact);
              bvRezolvate.add(bvLabel);
              // Testele de logica pura ale quizului ruleaza fara DOM (Node,
              // fara `document`) — ilustratia are nevoie de DOM real, deci se
              // declanseaza doar in browser, nu schimba deloc fluxul de raspuns.
              if (typeof document !== "undefined") {
                const { a, b } = currentFact.values;
                const randEl = document
                  .getElementById("top-number")
                  ?.querySelector(`[data-element-div-intrebare="bv-${bvLabel}"]`);
                const rezultatIlustratie = ilustrareBonduri.arataBv({
                  containerEl: document.getElementById("arena"),
                  randEl,
                  nivel: level,
                  a,
                  b,
                  culoareA: global.InventarBonduri.culoareNumar(a),
                  culoareB: global.InventarBonduri.culoareNumar(b),
                  latimeDisponibila: document
                    .getElementById("falling-main")
                    ?.getBoundingClientRect().width,
                });
                zborDeclansat = Boolean(rezultatIlustratie?.zborDeclansat);
                // Randul propriu (cifrele "a+b") se scrie ACUM, in aceeasi
                // bucla sincrona ca ilustratia — altfel motorul il rescrie
                // abia peste ~160ms (DEFAULT_REVEAL_HOLD_MS, vezi
                // falling-engine.js), iar ilustratia apare langa un rand inca
                // gol "{nivel}=" (cerere user, 31.08.2026: "trebuie sa apara
                // simultan tot, instantaneu").
                const elemRand = global.InventarBonduri.elementeDivIntrebare(inventarCurent()).find(
                  (elem) => elem.id === `bv-${bvLabel}`
                );
                if (randEl && elemRand) randEl.innerHTML = elemRand.html;
              }
            }
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

            return {
              action: "continue",
              view: construieste_pasul_de_serie_terminata(label, { asteaptaAnimatia: zborDeclansat }),
            };
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
        ilustrareBonduri.reseteaza();
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

      // Liftul ajuns jos NU inseamna raspuns gresit (cerere user, 31.08.2026:
      // "liftul poate sa ajunga jos de cate ori vrea"). Deci, fata de inainte:
      // nu se mai inregistreaza o incercare gresita in jurnal, nu se mai
      // marcheaza seria ca gresita (`a_gresit_in_serie`), bv-ul nu mai intra in
      // coada de reluare (`wrongFactIds` — care blocheaza si ilustratia) si nu
      // mai apare flash rosu cu "Prea tarziu!". Ramane doar reluarea caderii,
      // pe aceeasi intrebare.
      //
      // `outcome: "timeout"` ramane: motorul il citeste ca "nu da stea, nu
      // avansa" (vezi starCorrect in falling-engine.js) — nu ca penalizare.
      onTimeout() {
        return {
          outcome: "timeout",
          message: "",
          resetFall: true,
          ...roundView(),
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
