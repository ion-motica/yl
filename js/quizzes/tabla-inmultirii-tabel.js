// TABLA INMULTIRII - TABEL — intrebarea e tabla de inmultire completa a
// nivelului curent (nr tabla = nivel, 1-10), randata ca <table> cu linii
// invizibile. Un singur rand (factorul intrebat) arata "?" cu fundal
// portocaliu in celula "produs", incadrat cu un dreptunghi cu colturi
// rotunjite pe grupul "factor x nr-tabla = produs".
//
// Fiecare celula, rand si coloana are id stabil (prefix "ti-"), ca sa poata
// fi modificate punctual mai tarziu (reordonare/ascundere/highlight — cerute
// de user, nu implementate inca). Trecerea intre randuri, in ACELASI nivel,
// nu retrimite tot tabelul: foloseste contractul "Mod scriere intrebare
// noua" din falling-engine.js (`elementeDivIntrebare`, cauta
// `data-element-div-intrebare="id"` deja randat si ii schimba doar
// continutul). La schimbare de nivel, tabelul se rescrie integral (nu se
// trimite `elementeDivIntrebare` — motorul cade singur pe randare completa).
(function (global) {
  "use strict";

  const QUIZ_ID = "tabla-inmultirii-tabel";
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 10;
  const MIN_FACTOR = 1;
  const MAX_FACTOR = 10;

  // "din primele 5 neraspunse" (user, 01.09.2026).
  const CANDIDATI_PREFERATI = 5;
  // "1 RCPA (raspuns corect din prima apasare) SAU 2 aparitii — indiferent
  // de RCPA — inchide factul pe nivelul curent" (user, 01.09.2026).
  //
  // Atentie, distinctie esentiala: asta numara APARITII ale intrebarii
  // (o aparitie = de la afisare pana la apasarea corecta care o inchide —
  // regula unica din motor-3-butoane.js ramane neatinsa, orice numar de
  // apasari gresite in interiorul unei aparitii), NU apasari brute de buton.
  // `esteCorect` mai jos ramane 100% onest, fara nicio exceptie.
  //
  // NU folosim `context.corect_din_primul_turn_apasare` din motor (parea
  // solutia "gratis", dar verificat empiric era gresit aici): acel contor se
  // reseteaza doar din `motor.laAfisareaIntrebarii`, apelat STRICT din
  // `SubquizDefinition.createRuntime().begin()` — o singura data, la
  // pornirea subquiz-ului. Noi schimbam intrebarea cu
  // `runtime.setCurrentItem(...)` (vezi `sincronizeazaOrchestratorul`), care
  // NU cheama `begin()` din nou — deci acel contor ramane "prima apasare"
  // doar la prima apasare din toata sesiunea, niciodata dupa. Tinem in loc
  // un contor propriu (`apasariInAparitiaCurenta`), resetat de noi la
  // fiecare intrebare noua — pur observational, nu ajunge niciodata in
  // valoarea intoarsa de `esteCorect`.
  const MAX_APARITII_PER_FACT = 2;

  const HINT_MESSAGE = "Alege produsul corect.";
  const PREFIX = "ti";

  // Numele canonice de coloana, exact cum le-a dat userul. "plus", "spatiu1",
  // "spatiu2" nu sunt in textul original (acolo erau goale) — botez celulele
  // goale ca sa aiba si ele id, cerut explicit ("id pt fiecare celula, rand
  // si coloana").
  const COLOANE = [
    "factor", "x", "nr-tabla", "egal", "produs", "plus", "spatiu1",
    "numarare1", "numarare2", "numarare3", "spatiu2",
    "adunari-repetate", "counter",
  ];
  const COLOANE_CADRU = ["factor", "x", "nr-tabla", "egal", "produs"];
  const POZITIE_IN_CADRU = {
    factor: "prim", x: "mijloc", "nr-tabla": "mijloc", egal: "mijloc", produs: "ultim",
  };
  const ETICHETE_HEADER = {
    factor: "factor", x: "x", "nr-tabla": "nr tabla", egal: "egal", produs: "produs",
    plus: "+", numarare1: "numarare", "adunari-repetate": "adunari repetate", counter: "counter",
  };

  const STIL_TD = "padding:0.15em 0.4em;border:1px solid transparent;text-align:center;min-width:1.5em;color:var(--text);";

  function idCelula(coloana, f) { return `${PREFIX}-${coloana}-${f}`; }
  function idCelulaSub(coloana, f) { return `${PREFIX}-${coloana}-sub-${f}`; }
  function idRand(f) { return `${PREFIX}-rand-${f}`; }
  function idRandSub(f) { return `${PREFIX}-rand-sub-${f}`; }
  function idColoana(coloana) { return `${PREFIX}-col-${coloana}`; }

  // Placeholderul standard, cu fundal portocaliu in loc de galben (cerere
  // user). Pastreaza clasa `placeholder-pt-raspuns` neschimbata — de ea are
  // nevoie `revealAnswerInPlace` din falling-engine.js ca sa gaseasca semnul
  // in DOM-ul deja randat si sa-l dezvaluie fara sa reconstruiasca tabelul.
  const placeholderGeneric = global.PlaceholderRaspuns.creeaza("?");
  const placeholder = {
    ...placeholderGeneric,
    marcaj: () =>
      `<span class="${placeholderGeneric.clasa}" style="background:orange;color:#000;font-weight:700;border-radius:0.2em;padding:0 0.2em;">` +
      `${placeholderGeneric.semn}</span>`,
  };

  function stilCadru(pozitie) {
    const baza = "border-top:2px solid var(--text);border-bottom:2px solid var(--text);";
    if (pozitie === "prim") return baza + "border-left:2px solid var(--text);border-radius:0.4em 0 0 0.4em;";
    if (pozitie === "ultim") return baza + "border-right:2px solid var(--text);border-radius:0 0.4em 0.4em 0;";
    return baza;
  }

  function createTablaInmultiriiTabelQuiz() {
    const { shuffle } = global.GameUtils;
    const { FactCatalog, FactStore } = global;

    let level = MIN_LEVEL;
    let gameCompleted = false;

    // Factorii 1..10 neterminati in nivelul curent, mereu pastrati crescator
    // (se scoate cu `.filter`, nu se adauga niciodata la mijloc). Un factor
    // ramane aici cat timp factul lui nu s-a inchis inca (vezi
    // MAX_APARITII_PER_FACT) — poate fi ales din nou dupa o aparitie
    // neincheiata cu RCPA.
    let neterminate = [];
    let factorCurent = null;
    // Cate aparitii ale fiecarui fact s-au INCHEIS deja pe nivelul curent
    // (cheia e `factId`, nu factorul — vezi comentariul de la
    // MAX_APARITII_PER_FACT). Se reseteaza la fiecare nivel nou.
    let aparitiiPerFact = {};
    // Cate apasari (orice fel) s-au facut in aparitia INCA DESCHISA a
    // intrebarii curente. Resetat la fiecare intrebare noua (`pregatesteFactor`),
    // incrementat din `esteCorect` (singurul loc apelat exact o data per
    // apasare reala) — vezi comentariul de la MAX_APARITII_PER_FACT.
    let apasariInAparitiaCurenta = 0;
    let options = [];
    let correctIndex = 0;
    let orchestrator = null;

    function produsPentru(f, targetLevel = level) { return f * targetLevel; }

    // Acelasi fapt (a=nivel, b=factor) ca la adaptorul existent
    // js/conexe-table-quiz/adapters/multiplication.js — asa incercarile de
    // aici si de la "Tabla inmultirii - intrebari ajutatoare 5*?=15" se
    // aduna pe ACELASI record din FactStore, nu pe doua paralele.
    function factForRow(f, targetLevel = level) {
      return FactCatalog.createFact({
        operation: "mul",
        promptForm: FactCatalog.PROMPT_FORMS.result,
        values: { a: targetLevel, b: f },
      });
    }

    function recordAttempt(correct, chosenAnswer, meta = {}) {
      const fact = factForRow(factorCurent);
      FactStore.recordAttempt(
        fact.factId,
        {
          at: meta.at,
          correct,
          responseMs: meta.responseMs,
          answer: chosenAnswer,
          timedOut: Boolean(meta.timedOut),
          quizId: QUIZ_ID,
        },
        fact
      );
    }

    function alegeFactorCurent() {
      const candidati = neterminate.slice(0, CANDIDATI_PREFERATI);
      return shuffle(candidati)[0];
    }

    function valoareStaticaCelula(coloana, f) {
      switch (coloana) {
        case "factor": return String(f);
        case "x": return "x";
        case "nr-tabla": return String(level);
        case "egal": return "=";
        case "produs": return String(produsPentru(f));
        case "plus": return f < MAX_FACTOR ? "+" : "";
        case "numarare1": return String((f - 1) * 3 + 1);
        case "numarare2": return String((f - 1) * 3 + 2);
        case "numarare3": return String((f - 1) * 3 + 3);
        case "adunari-repetate": return String(level);
        case "counter": return "";
        default: return "";
      }
    }

    // Continutul (fara <td>) al unei celule din grupul incadrat — comun
    // randarii complete SI patch-ului de tranzitie, ca sa nu existe doua
    // locuri care decid cum arata o celula (vezi js/bond-inventory.js pt.
    // acelasi principiu).
    function continutCelula(coloana, f, esteActiv) {
      const valoare = coloana === "produs" && esteActiv ? placeholder.marcaj() : valoareStaticaCelula(coloana, f);
      if (esteActiv && COLOANE_CADRU.includes(coloana)) {
        return `<span style="${stilCadru(POZITIE_IN_CADRU[coloana])}">${valoare}</span>`;
      }
      return `<span>${valoare}</span>`;
    }

    function celulaHtml(coloana, f, esteActiv) {
      const id = idCelula(coloana, f);
      return `<td id="${id}" data-element-div-intrebare="${id}" style="${STIL_TD}">${continutCelula(coloana, f, esteActiv)}</td>`;
    }

    function randMainRowHtml(f) {
      const esteActiv = f === factorCurent;
      const celule = COLOANE.map((coloana) => celulaHtml(coloana, f, esteActiv));
      return `<tr id="${idRand(f)}" data-element-div-intrebare="${idRand(f)}">${celule.join("")}</tr>`;
    }

    // Randul-schela dintre doua randuri principale: adunarea repetata scrisa
    // dedesubt (produsul creste cu `level` fata de randul anterior). Coloana
    // "produs" e inlocuita aici cu calificativul "adunare trei" (user,
    // 01.09.2026) — presupunere: celula cu valoarea repetata a nivelului, sub
    // "produs"; usor de redenumit daca nu e ce insemna userul.
    function randSubRowHtml(f) {
      const chei = [
        "factor", "x", "nr-tabla", "egal", "adunare-trei", "plus", "spatiu1",
        "numarare1", "numarare2", "numarare3", "spatiu2",
        "adunari-repetate", "counter",
      ];
      const valori = { "adunare-trei": String(level), "adunari-repetate": "+" };
      const celule = chei.map((cheie) => {
        const id = idCelulaSub(cheie, f);
        const text = valori[cheie] ?? "";
        return `<td id="${id}" data-element-div-intrebare="${id}" style="${STIL_TD}"><span>${text}</span></td>`;
      });
      return `<tr id="${idRandSub(f)}" data-element-div-intrebare="${idRandSub(f)}">${celule.join("")}</tr>`;
    }

    function headerRowHtml() {
      const celule = COLOANE.map((coloana) => {
        const text = ETICHETE_HEADER[coloana] ?? "";
        const stilRotit = text ? "writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;margin:0 auto;" : "";
        return (
          `<td id="${idColoana(coloana)}-header" style="${STIL_TD}height:5em;vertical-align:bottom;">` +
          `<span style="${stilRotit}">${text}</span></td>`
        );
      });
      return `<tr>${celule.join("")}</tr>`;
    }

    function colgroupHtml() {
      return `<colgroup>${COLOANE.map((c) => `<col id="${idColoana(c)}">`).join("")}</colgroup>`;
    }

    // Randare completa — folosita ca fallback (motorul cade pe ea singur
    // cand `elementeDivIntrebare` lipseste sau nu gaseste toate id-urile, ex.
    // la prima afisare sau la schimbare de nivel).
    function construiesteTabelComplet() {
      const randuri = [];
      for (let f = MIN_FACTOR; f <= MAX_FACTOR; f++) {
        randuri.push(randMainRowHtml(f));
        if (f < MAX_FACTOR) randuri.push(randSubRowHtml(f));
      }
      return (
        `<div style="text-align:center;">` +
        `<div style="font-size:0.8em;margin-bottom:0.3em;color:var(--text);">Tabla înmulțirii cu ${level}</div>` +
        `<table style="border-collapse:collapse;margin:0 auto;font-family:'Segoe UI', system-ui, sans-serif;">` +
        colgroupHtml() + headerRowHtml() + randuri.join("") +
        `</table></div>`
      );
    }

    // Patch-ul de tranzitie: doar cele 5 celule ale randului vechi (dezincadrate)
    // si ale randului nou (incadrate) — restul tabelului nu se atinge.
    function elementePatchTranzitie(vechiFactor, nouFactor) {
      const patch = [];
      for (const coloana of COLOANE_CADRU) {
        if (vechiFactor != null && vechiFactor !== nouFactor) {
          patch.push({ id: idCelula(coloana, vechiFactor), html: continutCelula(coloana, vechiFactor, false) });
        }
        patch.push({ id: idCelula(coloana, nouFactor), html: continutCelula(coloana, nouFactor, true) });
      }
      return patch;
    }

    function elementePatchDoarUnframe(vechiFactor) {
      return COLOANE_CADRU.map((coloana) => ({ id: idCelula(coloana, vechiFactor), html: continutCelula(coloana, vechiFactor, false) }));
    }

    function elementePatchCurent() {
      return COLOANE_CADRU.map((coloana) => ({ id: idCelula(coloana, factorCurent), html: continutCelula(coloana, factorCurent, true) }));
    }

    function vederePentruRunda(extra = {}) {
      return {
        prompt: `${factorCurent}x${level}=?`,
        promptHtml: construiesteTabelComplet(),
        options: [...options],
        correctIndex,
        hintMessage: extra.hintMessage ?? HINT_MESSAGE,
        ...extra,
      };
    }

    function vederePentruTranzitie(vechiFactor, extra = {}) {
      return { ...vederePentruRunda(extra), elementeDivIntrebare: elementePatchTranzitie(vechiFactor, factorCurent) };
    }

    function construiesteOptiuni() {
      const corect = produsPentru(factorCurent);
      // "distractorii random din intervalul 1-level*10" (user, 01.09.2026).
      const max = level * MAX_FACTOR;
      const candidati = [];
      for (let v = 1; v <= max; v++) if (v !== corect) candidati.push(v);
      const gresite = shuffle(candidati).slice(0, 2);
      options = shuffle([corect, gresite[0], gresite[1]]).map(String);
      correctIndex = options.indexOf(String(corect));
    }

    function sincronizeazaOrchestratorul(vechiFactor) {
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: `${factorCurent}x${level}=?`,
        promptHtml: construiesteTabelComplet(),
        elementeDivIntrebare: elementePatchTranzitie(vechiFactor, factorCurent),
        options: [...options],
        correctIndex,
      });
    }

    function pregatesteFactor(nou, vechiFactor) {
      factorCurent = nou;
      apasariInAparitiaCurenta = 0;
      construiesteOptiuni();
      sincronizeazaOrchestratorul(vechiFactor);
    }

    function incepeNivel() {
      neterminate = [];
      for (let f = MIN_FACTOR; f <= MAX_FACTOR; f++) neterminate.push(f);
      aparitiiPerFact = {};
      pregatesteFactor(alegeFactorCurent(), null);
    }

    // Motor 3 butoane (M3B): regula unica ramane neatinsa — "corect
    // avanseaza, gresit ramai pe loc", fara nicio exceptie, fara nicio
    // portita (vezi motor-3-butoane.js). `esteCorect` e 100% onest, ca la
    // orice alt quiz din proiect — nu exista nicio incercare "fortata".
    //
    // "1 RCPA sau 2 aparitii inchide factul" se implementeaza STRICT in
    // `dupaRaspunsCorect`, care oricum ruleaza doar cand aparitia curenta
    // s-a incheiat cu adevarat (apasare corecta): RCPA e "aparitia asta s-a
    // inchis din prima apasare", citit din contorul nostru local
    // (`apasariInAparitiaCurenta`, vezi comentariul de la
    // MAX_APARITII_PER_FACT — NU din motor). Numara aparitia inchisa pe
    // `factId`, si decide daca factorul iese din `neterminate` sau ramane
    // pentru o a doua aparitie. Nu atinge deloc ramura de "gresit" din M3B.
    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "tabel",
        title: "tabel",
        hintMessage: HINT_MESSAGE,
        esteCorect: (_item, index) => {
          apasariInAparitiaCurenta += 1;
          return Number(options[index]) === produsPentru(factorCurent);
        },
        generator: () => ({}),
        mesaje: {
          gresit: (ctx) => `${ctx.alesul} nu e produsul corect. Încearcă din nou!`,
        },
        actiuni: {
          dupa_turn_apasare: (ctx) => {
            recordAttempt(ctx.corect, ctx.alesul, ctx.meta);
            return {};
          },
          dupaRaspunsCorect: () => {
            const rezolvatFactor = factorCurent;
            const rcpa = apasariInAparitiaCurenta === 1;
            const factId = factForRow(rezolvatFactor).factId;
            aparitiiPerFact[factId] = (aparitiiPerFact[factId] ?? 0) + 1;
            const factGata = rcpa || aparitiiPerFact[factId] >= MAX_APARITII_PER_FACT;
            const patchUnframe = elementePatchDoarUnframe(rezolvatFactor);

            if (factGata) {
              neterminate = neterminate.filter((f) => f !== rezolvatFactor);
            }

            if (neterminate.length > 0) {
              pregatesteFactor(alegeFactorCurent(), rezolvatFactor);
              return {
                action: "continue",
                view: {
                  outcome: "step-correct",
                  correct: true,
                  bounce: true,
                  flash: "win",
                  message: "Corect!",
                  ...vederePentruTranzitie(rezolvatFactor),
                },
              };
            }

            const holdView = { ...vederePentruRunda({ hintMessage: "" }), elementeDivIntrebare: patchUnframe };

            if (level >= MAX_LEVEL) {
              gameCompleted = true;
              return {
                action: "continue",
                view: {
                  outcome: "step-correct",
                  correct: true,
                  bounce: true,
                  flash: "win",
                  message: "Corect!",
                  ...holdView,
                  pasUrmator: {
                    continua: {
                      outcome: "serie-terminata",
                      correct: true,
                      serie_terminata: true,
                      gameComplete: true,
                      flash: "win",
                      banner: "Felicitări! Ai parcurs ultimul nivel!",
                      message: "Felicitări! Ai parcurs ultimul nivel!",
                    },
                  },
                },
              };
            }

            level += 1;
            incepeNivel();
            return {
              action: "continue",
              view: {
                outcome: "step-correct",
                correct: true,
                bounce: true,
                flash: "win",
                message: "Corect!",
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
                    nextRound: vederePentruRunda(),
                  },
                },
              },
            };
          },
        },
      });
    }

    orchestrator = global.SubquizOrchestrator.create({
      definitions: [baseDefinition()],
      activeSubquizIds: ["tabel"],
      context: { quizId: QUIZ_ID },
    });
    orchestrator.startFirst();

    return {
      getLevel: () => level,
      getMaxLevel: () => MAX_LEVEL,
      getMinLevel: () => MIN_LEVEL,
      getLevelLabel: () => `Nivel ${level} · tabla lui ${level}`,
      getLevelButtonTitle: (targetLevel) => `Nivel ${targetLevel}: tabla lui ${targetLevel}`,

      getProgressDisplay: () => global.ProgressDisplay.hidden(),

      isCompleted: () => gameCompleted,
      setCompleted: (value) => { gameCompleted = value; },

      resetLevelState() {
        neterminate = [];
        factorCurent = null;
        aparitiiPerFact = {};
        apasariInAparitiaCurenta = 0;
        options = [];
        correctIndex = 0;
      },

      switchLevel(nextLevel) {
        if (nextLevel < MIN_LEVEL) level = MIN_LEVEL;
        else level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        gameCompleted = false;
        this.resetLevelState();
        return null;
      },

      placeholderRaspuns: placeholder,
      laSchimbareDeNivel: global.SchimbareDeNivel.standard(),

      beginRound() {
        incepeNivel();
        return vederePentruRunda();
      },

      onTimeout(meta = {}) {
        recordAttempt(false, null, { ...meta, timedOut: true });
        return {
          outcome: "timeout",
          flash: "wrong",
          message: "Prea târziu! Alege produsul corect.",
          resetFall: true,
          ...vederePentruRunda({ hintMessage: "" }),
          elementeDivIntrebare: elementePatchCurent(),
        };
      },

      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },

      pickNextRound: () => {
        incepeNivel();
        return vederePentruRunda();
      },
    };
  }

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: "Tabla inmultirii - Tabel",
    description: "Tabla înmulțirii ca tabel complet — alege produsul lipsă.",
    gestionareGreseli: { activ: false },
    create: createTablaInmultiriiTabelQuiz,
    // Incadrat la finalul "Clasa a 2-a" in js/manage_quiz_order_in_hamburger_menu.js
    // (cerere user, 01.09.2026).
  });
})(window);
