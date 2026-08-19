import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = "C:/Users/I/Projects/Youlearn.com";
const SQ3_ID = "sq3FactorGroup";
const SQ5_ID = "sq5FluentParty";
// Copie a listei din motor (js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js).
// Duplicare deliberata: testul verifica ca formula produce castigatorul asteptat
// pe datele reale, nu doar ca lista exista.
const FG_LIST = [
  [2, 4, 8, 16],
  [4, 8, 12, 16],
  [2, 4, 6, 8],
  [5, 15],
  [3, 6, 9],
  [7, 11, 13, 17, 19],
  [3, 6, 12, 18],
  [3, 9, 18],
];

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  const runner = new Function("window", `${code}\n`);
  runner(globalThis);
}

function setupLocalStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
  return store;
}

function setupQuiz({
  shuffle = (items) => [...items],
  random = () => 0,
  fluentaSursa = { scorPtFact: () => 0 },
  localStorageSeed = {},
} = {}) {
  globalThis.window = globalThis;
  globalThis.alert = () => {};
  setupLocalStorage(localStorageSeed);

  [
    "js/utils.js",
    "js/progress-display.js",
    "js/quiz-registry.js",
    "js/fact-catalog.js",
    "js/fact-window-sequencer.js",
    "js/eff/qf-generator.js",
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/motor-3-butoane.js",
    "js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js",
  ].forEach(loadScript);

  globalThis.GameUtils.shuffle = shuffle;

  return globalThis.Mul1120V4IntensivMultipli234Quiz.create({ random, fluentaSursa });
}

function loadRealFluentaSursa() {
  delete globalThis.ConfigPraguriVizualizare3;
  delete globalThis.MotorAnalizaVizualizare3;
  delete globalThis.SnapshotFluenta;
  loadScript("Vizualizare 3 - Claude/config-praguri.js");
  loadScript("Vizualizare 3 - Claude/motor-analiza.js");
  loadScript("js/snapshot-fluenta.js");
  const brut = JSON.parse(readFileSync(join(rootDir, "tests/fixture-jurnal-v4.json"), "utf8"));
  return globalThis.SnapshotFluenta.construiesteDinInregistrari(brut);
}

function answerCorrect(quiz, round) {
  return quiz.onAnswer(round.correctIndex, { responseMs: 500 });
}

function answerWrong(quiz, round) {
  const wrongIndex = (round.correctIndex + 1) % round.options.length;
  return quiz.onAnswer(wrongIndex, { responseMs: 500 });
}

describe("multiplication-1120-v4 intensiv multipli 2 3 4", () => {
  beforeEach(() => {
    delete globalThis.QuizRegistry;
    delete globalThis.GameUtils;
    delete globalThis.ProgressDisplay;
    delete globalThis.FactCatalog;
    delete globalThis.FactWindowSequencer;
    delete globalThis.QFGenerator;
    delete globalThis.ItemGenerator;
    delete globalThis.SubquizDefinition;
    delete globalThis.SubquizOrchestrator;
    delete globalThis.Mul1120V4IntensivMultipli234Quiz;
  });

  it("criteriul 1: domeniul e intotdeauna b=1..20, la orice nivel", () => {
    const quiz = setupQuiz();
    const round = quiz.beginRound();
    // Nu verificam textul exact al promptului (depinde de ce forma de ecuatie
    // a fost aleasa dintre cele active) — verificam factul canonic din spate.
    assert.equal(round.metadata.fact, "11*1=11");
    let info = quiz.getInfo11_20();
    assert.equal(info.facts.length, 20);
    assert.deepEqual(
      info.facts.map((f) => f.label),
      Array.from({ length: 20 }, (_, i) => `11*${i + 1}`)
    );

    quiz.switchLevel(10);
    quiz.beginRound();
    info = quiz.getInfo11_20();
    assert.deepEqual(
      info.facts.map((f) => f.label),
      Array.from({ length: 20 }, (_, i) => `20*${i + 1}`)
    );
  });

  it("criteriul 2/4/5/8: parcurgere completa de nivel — fara repetitii in sq1, sq3 nu repeta un b deja acoperit, plafon <=3, fg nerepetat", () => {
    // Raspunsuri corecte peste tot: izoleaza exact geometria de acoperire
    // (sq1 + declansatorul "la fiecare 5") de complicatiile motorului comun
    // legate de raspunsuri gresite (blockWrongTransition reia aceeasi
    // intrebare — testat separat, mai jos).
    const quiz = setupQuiz({ random: () => 0 });

    const seenBaseB = [];
    const seenSq3B = new Set();
    const fgUsed = [];
    let round = quiz.beginRound();
    let guard = 0;
    let levelAdvanced = false;

    // Ne oprim la finalul PRIMULUI nivel — invariantele (fara repetitii, plafon,
    // fg nerepetat) sunt per-nivel; starea de acoperire se reseteaza la fiecare
    // nivel, deci acumularea peste mai multe nivele ar da fals-pozitive.
    while (!levelAdvanced && !quiz.isCompleted() && guard < 200) {
      guard += 1;
      const subquiz = round.metadata?.subquiz;
      const factB = round.metadata?.factB;

      if (subquiz === "base") {
        assert.ok(!seenBaseB.includes(factB), `b=${factB} a fost intrebat de doua ori in sq1`);
        assert.ok(!seenSq3B.has(factB), `b=${factB} a fost cerut in sq1 desi fusese deja acoperit in sq3`);
        seenBaseB.push(factB);
      } else if (subquiz === SQ3_ID) {
        seenSq3B.add(factB);
      }

      const next = answerCorrect(quiz, round);
      if (next.message && /^Subquiz 3: /.test(next.message)) {
        fgUsed.push(next.message);
      }
      levelAdvanced = Boolean(next.levelAdvanced) || quiz.isCompleted();

      round = next.nextRound ?? next;
    }

    assert.ok(guard < 200, "testul nu ar trebui sa intre in bucla fara sfarsit");
    assert.ok(levelAdvanced, "primul nivel trebuia sa se termine in acest test");

    // criteriul 2: niciun b nu se repeta in sq1 (deja verificat mai sus, la fiecare pas).
    assert.equal(new Set(seenBaseB).size, seenBaseB.length);

    // criteriul 4: sensul testat e unidirectional — o data ce sq3 acopera un b,
    // sq1 nu-l mai cere niciodata dupa aceea (deja verificat in bucla, la
    // fiecare pas prin sq1). Inversul (sq3 alegand un fg care se suprapune cu
    // ceva deja acoperit prin sq1) e permis prin design: formula alegeFG
    // favorizeaza fg-uri putin acoperite, dar nu le exclude complet pe cele
    // partial acoperite — asta face exact metrica de "acoperire".

    // criteriul 5: plafonul de 3 sq3/nivel nu a fost depasit.
    assert.ok(fgUsed.length <= 3, `s-au declansat ${fgUsed.length} subquiz 3, plafonul e 3`);

    // criteriul 8: fg-urile folosite intr-un nivel sunt distincte.
    assert.equal(new Set(fgUsed).size, fgUsed.length, "acelasi fg a fost ales de doua ori in acelasi nivel");
  });

  // CORECTAT (Faza D, lotul 4): inainte de migrare, `allowOnWrong:true` lasa
  // declansatorul "2 facte gresite" sa treaca chiar pe raspunsul gresit care
  // il declansa — insemnand ca o apasare GRESITA putea ea insasi schimba
  // intrebarea afisata (push in sq3), o incalcare directa a regulii
  // universale ("gresit ramane pe aceeasi intrebare"). Corectat: declansatorul
  // se verifica DOAR dupa ce raspunsul curent a fost REZOLVAT corect.
  it("declansatorul \"2 facte gresite\" functioneaza abia dupa ce al doilea fact gresit e rezolvat corect", () => {
    const quiz = setupQuiz({ random: () => 0 });
    let round = quiz.beginRound();
    round = answerWrong(quiz, round); // b=1, gresit -> wrongFacts=[1], motorul reia b=1
    assert.equal(round.metadata.factB, 1, "raspuns gresit fara declansator: motorul reia aceeasi intrebare");
    round = answerCorrect(quiz, round); // rezolva b=1 la a doua incercare
    assert.equal(round.metadata.factB, 2);
    const trigger = answerWrong(quiz, round); // b=2 gresit -> ramane pe b=2, NU declanseaza inca
    assert.equal(trigger.metadata.factB, 2, "raspunsul gresit ramane pe aceeasi intrebare");
    assert.equal(trigger.outcome, "wrong-answer");
    const resolved = answerCorrect(quiz, trigger); // abia acum, dupa rezolvare, se declanseaza
    assert.equal(resolved.metadata.subquiz, SQ3_ID, "al doilea fact gresit distinct declanseaza sq3 dupa ce a fost REZOLVAT corect");
  });

  it("criteriul 3: ordinea K=4 — primele 4 facte sunt {1,2,3,4}, in ordinea data de shuffle (nu 1,2,3,4 identic)", () => {
    // Verificam doar primul batch: la a 5-a intrebare, declansatorul "la
    // fiecare 5 raspunsuri" intra deja in sq3 (testat separat mai sus), deci
    // al doilea batch nu mai poate fi citit "curat" prin acelasi mecanism.
    const quiz = setupQuiz({ shuffle: (items) => [...items].reverse() });
    const seen = [];
    let round = quiz.beginRound();
    for (let i = 0; i < 4; i += 1) {
      seen.push(round.metadata.factB);
      round = answerCorrect(quiz, round);
    }
    assert.deepEqual(seen, [4, 3, 2, 1], "shuffle-ul (reverse) trebuie sa se reflecte in ordinea batch-ului");
  });

  it("criteriul 6a: sq3 se termina normal cand toate factele ajung la 3 corecte", () => {
    const quiz = setupQuiz({ fluentaSursa: { scorPtFact: () => 0 } });
    let round = quiz.beginRound();
    for (let i = 0; i < 4; i += 1) round = answerCorrect(quiz, round);
    round = answerCorrect(quiz, round);
    assert.equal(round.metadata.subquiz, SQ3_ID, "al 5-lea raspuns trebuie sa declanseze sq3");

    let guard = 0;
    while (round.metadata?.subquiz === SQ3_ID && guard < 40) {
      guard += 1;
      round = answerCorrect(quiz, round);
      round = round.nextRound ?? round;
    }
    assert.ok(guard < 40, "sq3 trebuia sa se termine intr-un numar rezonabil de raspunsuri corecte");
    assert.notEqual(round.metadata?.subquiz, SQ3_ID, "sq3 trebuia sa se fi terminat (pop inapoi in baza, sau nivel complet)");
  });

  // CORECTAT (Categoria 5 din FAZA-A-inventar-contract.md — ELIMINATA
  // complet, decizie fermă a userului, consemnata deja in acel document):
  // fostele "criteriul 6b" si "contract de randare: ... plasa de siguranta"
  // testau EXPLICIT mecanismul de avans fortat dupa 5 incercari gresite —
  // exact genul de exceptie pe care userul a respins-o direct ("Poate sa
  // apese de 3000 de ori pe raspunsurile gresite, nu treci la alta
  // intrebare"). Inlocuite cu un singur test care verifica eliminarea:
  // niciun numar de incercari gresite nu forteaza avansul.
  it("CORECTAT (Categoria 5 eliminata): un fact niciodata corect NU forteaza avansul, oricat de multe incercari gresite", () => {
    const quiz = setupQuiz({ fluentaSursa: { scorPtFact: () => 0 } });
    let round = quiz.beginRound();
    for (let i = 0; i < 4; i += 1) round = answerCorrect(quiz, round);
    round = answerCorrect(quiz, round);
    assert.equal(round.metadata.subquiz, SQ3_ID);

    const targetB = round.metadata.factB;
    for (let i = 0; i < 40; i += 1) {
      round = answerWrong(quiz, round);
      assert.equal(round.outcome, "wrong-answer", `incercarea ${i + 1}: ramane pe intrebare, fara limita`);
      assert.equal(round.metadata.factB, targetB, `incercarea ${i + 1}: intrebarea nu avanseaza niciodata pe gresit`);
    }
  });

  it("criteriul 7: alegeFG pe cazul numeric din plan (nivel 1, fluenta 0 peste tot, acoperit {1,2,3,4,7})", () => {
    // Shuffle special: batch-ul 2 [5,6,7,8] devine [7,5,6,8], ca al 5-lea raspuns
    // sa acopere b=7 (nu b=5), reproducand exact covered={1,2,3,4,7} din plan.
    const customShuffle = (items) => {
      if (items.length === 4 && items.every((v, i) => v === [5, 6, 7, 8][i])) {
        return [7, 5, 6, 8];
      }
      return [...items];
    };
    const quiz = setupQuiz({ shuffle: customShuffle, fluentaSursa: { scorPtFact: () => 0 } });
    let round = quiz.beginRound();
    for (let i = 0; i < 4; i += 1) round = answerCorrect(quiz, round);
    assert.equal(round.metadata.factB, 7, "shuffle-ul special trebuia sa aduca b=7 al cincilea");
    const trigger = answerCorrect(quiz, round);

    assert.equal(trigger.metadata.subquiz, SQ3_ID);
    assert.equal(trigger.message, "Subquiz 3: 11*5, 11*15", "castigatorul asteptat e fg [5,15], departajat lexicografic");
  });

  it("criteriul 11: pe date reale, castigatorul primului sq3 e fg [7,11,13,17,19] la toate nivelele", () => {
    // fg [12,14,16,18] a fost eliminat (user, 29.07.2026); fg [12,15,18] a fost
    // eliminat ulterior (user, 05.08.2026, "il avem pe fg 8 si fg 4" — elementele
    // lui 12 si 18 sunt in [3,6,12,18], iar 15 e in [5,15]). Recalculat pe
    // fixture-ul real dupa a doua eliminare: fara [12,15,18], fg-ul care ii lua
    // locul la scor minim (2,0, din medie=0 la toate cele 5 facte netestate)
    // e [7,11,13,17,19] la toate cele 10 nivele — nu mai exista variatie intre
    // nivele, fiindca acel fg era deja castigator la nivelul 2 si acum e singurul
    // fg cu medie=0 pe toate facte, la orice A.
    const fluentaSursa = loadRealFluentaSursa();
    const asteptat = {
      1: [7, 11, 13, 17, 19],
      2: [7, 11, 13, 17, 19],
      3: [7, 11, 13, 17, 19],
      4: [7, 11, 13, 17, 19],
      5: [7, 11, 13, 17, 19],
      6: [7, 11, 13, 17, 19],
      7: [7, 11, 13, 17, 19],
      8: [7, 11, 13, 17, 19],
      9: [7, 11, 13, 17, 19],
      10: [7, 11, 13, 17, 19],
    };

    for (let nivel = 1; nivel <= 10; nivel += 1) {
      const quiz = setupQuiz({ fluentaSursa });
      quiz.switchLevel(nivel);
      let round = quiz.beginRound();
      for (let i = 0; i < 4; i += 1) round = answerCorrect(quiz, round);
      const trigger = answerCorrect(quiz, round);
      assert.equal(trigger.metadata.subquiz, SQ3_ID, `nivel ${nivel}: trebuia sa declanseze sq3`);
      const A = 10 + nivel;
      const fgAsteptat = asteptat[nivel];
      assert.equal(
        trigger.message,
        `Subquiz 3: ${fgAsteptat.map((b) => `${A}*${b}`).join(", ")}`,
        `nivel ${nivel}: castigatorul asteptat e fg [${fgAsteptat.join(",")}]`
      );
    }
  });

  it("criteriile 12/13/14: stack — toate factele fg-ului, ordine crescatoare, fara forme degenerate, supravietuieste raspunsului", () => {
    const quiz = setupQuiz({ fluentaSursa: { scorPtFact: () => 0 } });
    let round = quiz.beginRound();
    for (let i = 0; i < 4; i += 1) round = answerCorrect(quiz, round);
    const trigger = answerCorrect(quiz, round);
    assert.equal(trigger.metadata.subquiz, SQ3_ID);

    // fg-ul ales depinde de formula (medie+acoperire) si de ce e deja acoperit
    // in acel moment — il citim din mesajul de intrare, nu presupunem care e,
    // ca testul sa nu depinda de o coincidenta de tie-break.
    const fg = trigger.message
      .replace("Subquiz 3: ", "")
      .split(", ")
      .map((s) => Number(s.split("*")[1]));
    assert.ok(fg.length >= 2, "fg-ul ales trebuie sa aiba cel putin 2 facte");

    // Extragem continutul fiecarui rand, in ordinea din DOM — nu presupunem
    // forma exacta de ecuatie (poate fi oricare dintre cele active).
    const rows = [...trigger.promptHtml.matchAll(/<div class="fg-stack-row[^"]*">(.*?)<\/div>/g)].map(
      (m) => m[1]
    );
    assert.equal(rows.length, fg.length, "stack-ul trebuie sa aiba exact atatea randuri cate facte are fg-ul");

    // Ordinea crescatoare: randul de pe pozitia i corespunde lui fg[i] (deja
    // sortat ascendent), deci fiecare rand trebuie sa mentioneze exact b-ul lui.
    const A = 11;
    fg.forEach((b, i) => {
      assert.ok(rows[i].includes(String(b)), `randul ${i} (asteptat b=${b}) nu-l contine: "${rows[i]}"`);
    });

    // criteriul 14: raspunsul corect al intrebarii curente nu e niciodata A.
    assert.notEqual(trigger.correctAnswer, A);

    // criteriul 13: dupa un raspuns, promptHtml-ul intors de motor tot are
    // acelasi numar de randuri — nu se prabuseste la o singura linie.
    const after = answerCorrect(quiz, trigger);
    const afterRows = [...after.promptHtml.matchAll(/class="fg-stack-row[^"]*"/g)];
    assert.equal(afterRows.length, fg.length, "stack-ul nu trebuie sa se prabuseasca la o linie dupa raspuns");
    assert.notEqual(after.correctAnswer, A);
  });

  it("criteriul 15: cadenta de rotire — 0 pastreaza aceeasi forma, 1 schimba forma la fiecare intrebare", () => {
    const seedZero = {
      "yl:mul1120v4:sq3RotateEvery": "0",
      "yl:mul1120v4:sq3EqFormCount": "20",
    };
    const quizZero = setupQuiz({ fluentaSursa: { scorPtFact: () => 0 }, localStorageSeed: seedZero });
    let roundZero = quizZero.beginRound();
    for (let i = 0; i < 4; i += 1) roundZero = answerCorrect(quizZero, roundZero);
    roundZero = answerCorrect(quizZero, roundZero);
    const formsZero = [];
    let guardZero = 0;
    while (roundZero.metadata?.subquiz === SQ3_ID && guardZero < 12) {
      guardZero += 1;
      formsZero.push(roundZero.metadata.qfTypeId);
      roundZero = answerCorrect(quizZero, roundZero);
      roundZero = roundZero.nextRound ?? roundZero;
    }
    assert.equal(new Set(formsZero).size, 1, "cu rotire 0, forma trebuie sa ramana fixa tot subquiz-ul");

    const seedOne = {
      "yl:mul1120v4:sq3RotateEvery": "1",
      "yl:mul1120v4:sq3EqFormCount": "20",
    };
    const quizOne = setupQuiz({ fluentaSursa: { scorPtFact: () => 0 }, localStorageSeed: seedOne });
    let roundOne = quizOne.beginRound();
    for (let i = 0; i < 4; i += 1) roundOne = answerCorrect(quizOne, roundOne);
    roundOne = answerCorrect(quizOne, roundOne);
    const formsOne = [];
    let guardOne = 0;
    while (roundOne.metadata?.subquiz === SQ3_ID && guardOne < 12) {
      guardOne += 1;
      formsOne.push(roundOne.metadata.qfTypeId);
      roundOne = answerCorrect(quizOne, roundOne);
      roundOne = roundOne.nextRound ?? roundOne;
    }
    assert.ok(new Set(formsOne).size > 1, "cu rotire 1, forma trebuie sa varieze intre intrebari consecutive");
  });

  it("criteriul 16: fact-ul logat e mereu canonic A*b=produs, indiferent de forma afisata", () => {
    const quiz = setupQuiz({ fluentaSursa: { scorPtFact: () => 0 } });
    let round = quiz.beginRound();
    for (let i = 0; i < 4; i += 1) {
      assert.equal(round.metadata.fact, `11*${round.metadata.factB}=${11 * round.metadata.factB}`);
      round = answerCorrect(quiz, round);
    }
    // A 5-a e primul fact din sq3.
    assert.equal(round.metadata.fact, `11*${round.metadata.factB}=${11 * round.metadata.factB}`);
    const trigger = answerCorrect(quiz, round);
    assert.equal(trigger.metadata.subquiz, SQ3_ID);
    assert.equal(
      trigger.metadata.fact,
      `11*${trigger.metadata.factB}=${11 * trigger.metadata.factB}`,
      "campul fact trebuie sa fie canonic A*b=produs si in sq3, indiferent de eq_form afisat"
    );
  });

  // ---- Exceptia facte fluente (user, 05.08.2026) ---------------------------
  // "fluent" = eticheta exacta din grila Vizualizare 3 (starePtFact), nu
  // scorul continuu (scorPtFact, folosit in continuare doar pt. alegeFG).
  // "sesiunea curenta" = nivelul curent (shared.baseState.covered).

  // CORECTAT: politica "once" insemna inainte "o incercare, corecta sau
  // gresita" — sub regula universala (gresit ramane pe intrebare pana la
  // rezolvare), "once" inseamna acum "un singur raspuns CORECT e suficient"
  // (spre deosebire de "normal", care cere 3 corecte).
  it("criteriul 17 (CORECTAT): fapt fluent, netestat inca in sesiune -> un singur raspuns CORECT e suficient", () => {
    // Fara custom shuffle: cu scor 0 peste tot, primul declansator (a 5-a
    // intrebare, covered={1,2,3,4,5}) alege fg [7,11,13,17,19] (singurul
    // complet neacoperit — vezi criteriul 11). Niciun membru nu e acoperit
    // inca in sesiune, deci marcarea "fluent" pe unul singur (b=7) izoleaza
    // exact cazul "once", cu restul (11,13,17,19) pe regula normala.
    const fluentaSursa = {
      scorPtFact: () => 0,
      starePtFact: (a, b) => (a === 11 && b === 7 ? "fluent" : "in_lucru"),
    };
    // sq5Mode "B" + entry "random": testul verifica exceptia facte-fluente a
    // lui sq3, nu sq5 — orice fact fluent la nivelul 1 ar activa si level 0
    // al lui sq5 (mod A, default), care cuprinde prin definitie si subtabla
    // nivelului curent; iar entry "levelStart" (default in mod B) ar porni
    // sq5 inaintea lui sq1 in interiorul nivelului. Cu "random", sq5 nu intra
    // in lista ordonata deloc — iar la singurul punct eligibil din test (a
    // 5-a intrebare), sq3 are prioritate si il consuma primul.
    const quiz = setupQuiz({
      fluentaSursa,
      localStorageSeed: { "yl:mul1120v4:sq5Mode": "B", "yl:mul1120v4:sq5Entry": "random" },
    });
    let round = quiz.beginRound();
    for (let i = 0; i < 4; i += 1) round = answerCorrect(quiz, round);
    const trigger = answerCorrect(quiz, round);
    assert.equal(trigger.metadata.subquiz, SQ3_ID);
    assert.equal(trigger.message, "Subquiz 3: 11*7, 11*11, 11*13, 11*17, 11*19");

    const seenB7 = [];
    let r = trigger;
    let guard = 0;
    // Raspundem mereu corect: b=7 (fluent, "once") trebuie sa iasa dupa exact
    // 1 raspuns; restul (nefluente, "normal") au nevoie de 3 corecte fiecare.
    while (r.metadata?.subquiz === SQ3_ID && guard < 60) {
      guard += 1;
      if (r.metadata.factB === 7) seenB7.push(true);
      r = answerCorrect(quiz, r);
      r = r.nextRound ?? r;
    }
    assert.ok(guard < 60, "sesiunea sq3 nu trebuia sa ramana blocata");
    assert.equal(seenB7.length, 1, "b=7 (fluent, netestat in sesiune) trebuia intrebat o singura data, apoi rezolvat");
  });

  it("criteriul 18: fapt fluent SI deja acoperit in sesiune -> sarit complet din sq3 (dar vizibil bifat in stack)", () => {
    // Acelasi rulaj default: al doilea declansator natural (dupa ce primul
    // sq3 se termina si sq1 continua) alege fg [5,15], cu b=5 deja acoperit
    // din sq1 (a fost al 5-lea fact, cel care a declansat primul sq3) si
    // b=15 inca netestat in sesiune. Marcam ambele "fluent": b=5 trebuie
    // sarit complet (skip), b=15 trebuie sa primeasca "once" (nu e inca
    // acoperit) — deci sq3 tot porneste (nu e cazul "totulSarit").
    const fluentaSursa = {
      scorPtFact: () => 0,
      starePtFact: (a, b) => ([5, 15].includes(b) ? "fluent" : "in_lucru"),
    };
    // sq5Mode "B" + entry "random": izoleaza testul de sq5 — vezi comentariul
    // din criteriul 17.
    const quiz = setupQuiz({
      fluentaSursa,
      localStorageSeed: { "yl:mul1120v4:sq5Mode": "B", "yl:mul1120v4:sq5Entry": "random" },
    });
    let round = quiz.beginRound();
    let guard = 0;
    let secondTrigger = null;
    while (!secondTrigger && guard < 100) {
      guard += 1;
      const next = answerCorrect(quiz, round);
      if (next.message === "Subquiz 3: 11*5, 11*15") secondTrigger = next;
      round = next.nextRound ?? next;
    }
    assert.ok(secondTrigger, "al doilea declansator (fg [5,15]) trebuia sa apara in rulajul default");
    assert.equal(secondTrigger.metadata.subquiz, SQ3_ID, "sq3 tot trebuia sa porneasca — nu toate factele sunt sarite (b=15 e doar \"once\")");

    const seenB5 = [];
    const seenB15 = [];
    let r = secondTrigger;
    guard = 0;
    while (r.metadata?.subquiz === SQ3_ID && guard < 60) {
      guard += 1;
      if (r.metadata.factB === 5) seenB5.push(true);
      if (r.metadata.factB === 15) seenB15.push(true);
      r = answerCorrect(quiz, r);
      r = r.nextRound ?? r;
    }
    assert.ok(guard < 60, "sesiunea sq3 nu trebuia sa ramana blocata");
    assert.equal(seenB5.length, 0, "b=5 (fluent + deja acoperit) nu trebuia intrebat deloc");
    assert.equal(seenB15.length, 1, "b=15 (fluent, netestat inca) trebuia intrebat o singura data");
  });

  it("criteriul 19: daca TOATE factele fg-ului ales sunt fluente si deja acoperite, sq3 nu mai porneste deloc", () => {
    // Penalizam scorul lui [7,11,13,17,19] ca sa castige [5,15] primul (nu
    // fg-ul cu scor minim implicit) — izoleaza exact rulajul in care al
    // treilea declansator natural ar alege [2,4,6,8], cu toate cele 4 facte
    // deja acoperite prin mersul secvential al sq1 pana atunci. Marcandu-le
    // pe toate "fluent", acel declansator nu mai trebuie sa produca sq3.
    const fluentaSursa = {
      scorPtFact: (a, b) => ([7, 11, 13, 17, 19].includes(b) ? 1 : 0),
      starePtFact: (a, b) => ([2, 4, 6, 8].includes(b) ? "fluent" : "netestat"),
    };
    // sq5Mode "B" + entry "random": izoleaza testul de sq5 — vezi comentariul
    // din criteriul 17.
    const quiz = setupQuiz({
      fluentaSursa,
      localStorageSeed: { "yl:mul1120v4:sq5Mode": "B", "yl:mul1120v4:sq5Entry": "random" },
    });
    const triggers = [];
    let round = quiz.beginRound();
    let guard = 0;
    let done = false;
    while (!done && guard < 300) {
      guard += 1;
      const next = answerCorrect(quiz, round);
      if (next.message && /^Subquiz 3: /.test(next.message)) triggers.push(next.message);
      done = Boolean(next.levelAdvanced) || quiz.isCompleted();
      round = next.nextRound ?? next;
    }
    assert.ok(done, "nivelul trebuia sa se termine normal, chiar fara al treilea sq3");
    assert.deepEqual(
      triggers,
      ["Subquiz 3: 11*3, 11*6, 11*12, 11*18", "Subquiz 3: 11*5, 11*15"],
      "doar primele doua declansatoare trebuiau sa produca sq3 — al treilea (fg [2,4,6,8], toate fluente+acoperite) trebuia sarit complet"
    );
  });

  it("FG_LIST din test reflecta exact lista din motor (santinela anti-drift)", () => {
    // Nu putem importa constanta privata direct; verificam indirect prin
    // comportamentul deja testat mai sus (criteriile 7 si 11). Aici doar
    // confirmam ca lista locala are forma asteptata — 8 grupuri de cand au
    // fost eliminate [12,14,16,18] (user, 29.07.2026) si [12,15,18]
    // (user, 05.08.2026).
    assert.equal(FG_LIST.length, 8);
    const sizes = FG_LIST.map((fg) => fg.length).sort((a, b) => a - b);
    assert.deepEqual(sizes, [2, 3, 3, 4, 4, 4, 4, 5]);
  });
});

describe("subquiz 5: Fluent party", () => {
  beforeEach(() => {
    delete globalThis.QuizRegistry;
    delete globalThis.GameUtils;
    delete globalThis.ProgressDisplay;
    delete globalThis.FactCatalog;
    delete globalThis.FactWindowSequencer;
    delete globalThis.QFGenerator;
    delete globalThis.ItemGenerator;
    delete globalThis.SubquizDefinition;
    delete globalThis.SubquizOrchestrator;
    delete globalThis.Mul1120V4IntensivMultipli234Quiz;
    delete globalThis.SnapshotFluenta;
  });

  it("domeniu mod B: sq5 ruleaza exact factele fluente din subtabla nivelului curent", () => {
    const fluentaSursa = {
      scorPtFact: () => 0,
      starePtFact: (a, b) => (a === 11 && [2, 3, 4].includes(b) ? "fluent" : "netestat"),
    };
    const quiz = setupQuiz({
      fluentaSursa,
      localStorageSeed: { "yl:mul1120v4:sq5Mode": "B", "yl:mul1120v4:sq5Entry": "levelStart" },
    });
    const round = quiz.beginRound();
    assert.equal(round.metadata.subquiz, SQ5_ID);
    assert.equal(round.metadata.factA, 11);
    assert.ok([2, 3, 4].includes(round.metadata.factB), `factB=${round.metadata.factB} ar trebui sa fie 2, 3 sau 4`);
  });

  it("level 0: un fact fluent din alta subtabla decat cea a nivelului curent porneste level 0, iar jurnalul ramane canonic", () => {
    // Cea mai importanta verificare de siguranta a datelor din tot planul
    // (P3/B3): level e 1 (A=11) tot timpul level-ului 0, dar factul ales e
    // din tabla lui 17 — campul `fact` NU trebuie sa foloseasca A-ul
    // nivelului (11), ci A-ul real al factului (17), altfel s-ar scrie
    // "11*8=88" in loc de "17*8=136", corupand celula reala din jurnal.
    const fluentaSursa = {
      scorPtFact: () => 0,
      starePtFact: (a, b) => (a === 17 && b === 8 ? "fluent" : "netestat"),
    };
    const quiz = setupQuiz({ fluentaSursa }); // mod A e default (D4)
    const round = quiz.beginRound();
    assert.equal(round.metadata.subquiz, SQ5_ID, "cu un singur fact fluent (17*8), level 0 trebuia sa porneasca");
    assert.equal(round.metadata.factA, 17, "factorul logat trebuie sa fie cel al FACTULUI (17), nu al nivelului (11)");
    assert.equal(round.metadata.factB, 8);
    assert.equal(round.metadata.fact, "17*8=136", "campul fact trebuie sa fie canonic, cu A-ul real al factului");
    assert.ok(round.metadata.factId, "factId trebuie sa existe");
  });

  it("zero facte fluente: level 0 nu porneste, nivelul 1 incepe normal, fara nicio eroare", () => {
    const quiz = setupQuiz(); // default: scorPtFact 0, fara starePtFact -> netestat mereu
    const round = quiz.beginRound();
    assert.equal(round.metadata.subquiz, "base");
    assert.equal(round.metadata.factA, 11);
  });

  it('"Se pregateste quizul...": ramane pe runda de asteptare pana se rezolva sursa, apoi repornesc o singura data', async () => {
    globalThis.window = globalThis;
    globalThis.alert = () => {};
    setupLocalStorage({});
    [
      "js/utils.js",
      "js/progress-display.js",
      "js/quiz-registry.js",
      "js/fact-catalog.js",
      "js/fact-window-sequencer.js",
      "js/eff/qf-generator.js",
      "js/subquiz/item-generator.js",
      "js/subquiz/subquiz-definition.js",
      "js/subquiz/subquiz-orchestrator.js",
    ].forEach(loadScript);
    globalThis.GameUtils.shuffle = (items) => [...items];

    let rezolva;
    const promisiune = new Promise((resolve) => {
      rezolva = resolve;
    });
    globalThis.SnapshotFluenta = {
      iaSincron: () => null,
      pregatesteOData: () => promisiune,
    };
    loadScript("js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js");
    const quiz = globalThis.Mul1120V4IntensivMultipli234Quiz.create({ random: () => 0 });

    const round1 = quiz.pickNextRound();
    assert.equal(round1.metadata.loading, true, "cat timp sursa nu e gata, runda trebuie sa fie cea de asteptare");
    assert.equal(round1.prompt, "Se pregătește quizul…");

    let callbackApelat = 0;
    quiz.setOnFluentaReady(() => {
      callbackApelat += 1;
    });

    globalThis.SnapshotFluenta.iaSincron = () => ({ scorPtFact: () => 0, starePtFact: () => "netestat" });
    rezolva();
    await promisiune;

    assert.equal(callbackApelat, 1, "callback-ul de repornire trebuia apelat o singura data, dupa ce sursa s-a rezolvat");
    const round2 = quiz.pickNextRound();
    assert.notEqual(round2.metadata.loading, true, "dupa ce sursa e gata, runda nu mai trebuie sa fie cea de asteptare");
    assert.equal(round2.metadata.subquiz, "base");
  });

  it("regresie: cursa la construire (sursa inca nerezolvata) nu blocheaza level 0 permanent dupa ce sursa devine gata", () => {
    // Bug real, gasit dupa implementare (nu in planul initial): quizul cheama
    // eager resetLevelState()->createOrchestrator() la construire, INAINTE
    // sa se stie daca IndexedDB a raspuns. Fara garda pe fluentaEsteGata(),
    // acel apel vedea "0 facte fluente" (sursa inca goala) si seta
    // level0Done=true PERMANENT — chiar daca datele reale (cu facte fluente)
    // deveneau disponibile imediat dupa, level 0 nu mai pornea niciodata in
    // acea sesiune. Aici simulam exact secventa: sursa e null la constructie
    // (`config.fluentaSursa` nefolosit), devine gata abia dupa aceea, cu
    // facte fluente reale.
    globalThis.window = globalThis;
    globalThis.alert = () => {};
    setupLocalStorage({});
    [
      "js/utils.js",
      "js/progress-display.js",
      "js/quiz-registry.js",
      "js/fact-catalog.js",
      "js/fact-window-sequencer.js",
      "js/eff/qf-generator.js",
      "js/subquiz/item-generator.js",
      "js/subquiz/subquiz-definition.js",
      "js/subquiz/subquiz-orchestrator.js",
    ].forEach(loadScript);
    globalThis.GameUtils.shuffle = (items) => [...items];

    // La constructia quizului (Mul1120V4IntensivMultipli234Quiz.create, mai
    // jos), iaSincron() intoarce inca null — exact cursa din P1.
    globalThis.SnapshotFluenta = {
      iaSincron: () => null,
      pregatesteOData: () => new Promise(() => {}), // nu se rezolva in acest test
    };
    loadScript("js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js");
    const quiz = globalThis.Mul1120V4IntensivMultipli234Quiz.create({ random: () => 0 });

    // Sursa devine gata DUPA constructie, cu un fact fluent real (17*8).
    globalThis.SnapshotFluenta.iaSincron = () => ({
      scorPtFact: () => 0,
      starePtFact: (a, b) => (a === 17 && b === 8 ? "fluent" : "netestat"),
    });

    const round = quiz.pickNextRound();
    assert.equal(
      round.metadata.subquiz,
      SQ5_ID,
      "level 0 trebuia sa porneasca — sursa are un fact fluent, indiferent ca la constructie era inca nerezolvata"
    );
    assert.equal(round.metadata.factA, 17);
  });

  it("level 0 nu se reia dupa o schimbare manuala de nivel (R7)", () => {
    const fluentaSursa = {
      scorPtFact: () => 0,
      starePtFact: (a, b) => (a === 17 && b === 8 ? "fluent" : "netestat"),
    };
    const quiz = setupQuiz({ fluentaSursa });
    quiz.switchLevel(3);
    const round = quiz.beginRound();
    assert.equal(round.metadata.subquiz, "base", "dupa switchLevel, sq5 nu mai trebuie sa apara ca level 0");
    assert.equal(round.metadata.factA, 13);
  });

  it("random: sq3 are prioritate — cand sq3 se declanseaza, sq5-random nu il intrerupe", () => {
    const fluentaSursa = {
      scorPtFact: () => 0,
      starePtFact: (a, b) => (a === 11 && b === 6 ? "fluent" : "netestat"),
    };
    const quiz = setupQuiz({
      random: () => 0,
      fluentaSursa,
      localStorageSeed: { "yl:mul1120v4:sq5Mode": "B", "yl:mul1120v4:sq5Entry": "random" },
    });
    let round = quiz.beginRound();
    for (let i = 0; i < 4; i += 1) round = answerCorrect(quiz, round);
    const trigger = answerCorrect(quiz, round);
    assert.equal(trigger.metadata.subquiz, SQ3_ID, "la a 5-a intrebare, sq3 trebuia sa castige, nu sq5");
  });

  it("eq forms: +1 la o zi noua de folosire, nu de doua ori in aceeasi zi, se opreste dupa interventie manuala", () => {
    const fluentaSursa = {
      scorPtFact: () => 0,
      starePtFact: (a, b) => (a === 11 && b === 5 ? "fluent" : "netestat"),
    };
    const baseSeed = { "yl:mul1120v4:sq5Mode": "B", "yl:mul1120v4:sq5Entry": "levelStart" };

    const quiz1 = setupQuiz({
      fluentaSursa,
      localStorageSeed: {
        ...baseSeed,
        "yl:mul1120v4:sq5EqFormCount": "4",
        "yl:mul1120v4:sq5EqFormLastDay": "2000-01-01",
      },
    });
    quiz1.beginRound();
    const dupaZiNoua = globalThis.localStorage.getItem("yl:mul1120v4:sq5EqFormCount");
    const aziScris = globalThis.localStorage.getItem("yl:mul1120v4:sq5EqFormLastDay");
    assert.equal(dupaZiNoua, "5", "zi noua fata de ultima inregistrata -> +1");
    assert.notEqual(aziScris, "2000-01-01", "ziua trebuia actualizata la cea curenta");

    delete globalThis.SnapshotFluenta;
    const quiz2 = setupQuiz({
      fluentaSursa,
      localStorageSeed: {
        ...baseSeed,
        "yl:mul1120v4:sq5EqFormCount": dupaZiNoua,
        "yl:mul1120v4:sq5EqFormLastDay": aziScris,
      },
    });
    quiz2.beginRound();
    assert.equal(
      globalThis.localStorage.getItem("yl:mul1120v4:sq5EqFormCount"),
      "5",
      "aceeasi zi ca ultima inregistrare -> nu creste a doua oara"
    );

    delete globalThis.SnapshotFluenta;
    const quiz3 = setupQuiz({
      fluentaSursa,
      localStorageSeed: {
        ...baseSeed,
        "yl:mul1120v4:sq5EqFormCount": "6",
        "yl:mul1120v4:sq5EqFormLastDay": "2000-01-01",
        "yl:mul1120v4:sq5EqFormManual": "true",
      },
    });
    quiz3.beginRound();
    assert.equal(
      globalThis.localStorage.getItem("yl:mul1120v4:sq5EqFormCount"),
      "6",
      "dupa interventia manuala, nu mai creste, chiar daca ziua e diferita"
    );
  });

  it("P2: cu o singura forma de ecuatie activa, sesiunea sq5 nu ramane blocata la infinit", () => {
    const fluentaSursa = {
      scorPtFact: () => 0,
      starePtFact: (a, b) => (a === 11 && [2, 3].includes(b) ? "fluent" : "netestat"),
    };
    const quiz = setupQuiz({
      fluentaSursa,
      localStorageSeed: {
        "yl:mul1120v4:sq5Mode": "B",
        "yl:mul1120v4:sq5Entry": "levelStart",
        "yl:mul1120v4:sq5EqFormCount": "1",
        "yl:mul1120v4:sq5SbsPct": "100",
      },
    });
    let round = quiz.beginRound();
    let guard = 0;
    while (round.metadata?.subquiz === SQ5_ID && guard < 200) {
      guard += 1;
      round = answerCorrect(quiz, round);
      round = round.nextRound ?? round;
    }
    assert.ok(guard < 200, "sq5 nu trebuia sa ramana blocat la infinit cu o singura forma activa");
    assert.equal(round.metadata.subquiz, "base", "dupa sq5, trebuie sa continue normal in baza");
  });

  it("blocul inceput se duce pana la capat: 1 singur fact fluent tot primeste lungimea blocului, nu doar TURNS", () => {
    const fluentaSursa = {
      scorPtFact: () => 0,
      starePtFact: (a, b) => (a === 11 && b === 9 ? "fluent" : "netestat"),
    };
    const quiz = setupQuiz({
      fluentaSursa,
      localStorageSeed: {
        "yl:mul1120v4:sq5Mode": "B",
        "yl:mul1120v4:sq5Entry": "levelStart",
        "yl:mul1120v4:sq5TurnsPerFact": "3",
        "yl:mul1120v4:sq5BlocLen": "12",
        "yl:mul1120v4:sq5SbsPct": "100",
      },
    });
    let round = quiz.beginRound();
    let count = 0;
    let guard = 0;
    while (round.metadata?.subquiz === SQ5_ID && guard < 40) {
      guard += 1;
      count += 1;
      round = answerCorrect(quiz, round);
      round = round.nextRound ?? round;
    }
    assert.equal(count, 12, "cu un singur fact fluent si bloc de 12, sq5 trebuia sa puna exact 12 intrebari, nu doar 3");
  });

  it("sq5 nu marcheaza facte ca acoperite in subquiz 1 (baza)", () => {
    const fluentaSursa = {
      scorPtFact: () => 0,
      starePtFact: (a, b) => (a === 11 && b === 9 ? "fluent" : "netestat"),
    };
    const quiz = setupQuiz({
      fluentaSursa,
      localStorageSeed: { "yl:mul1120v4:sq5Mode": "B", "yl:mul1120v4:sq5Entry": "levelStart" },
    });
    let round = quiz.beginRound();
    let guard = 0;
    while (round.metadata?.subquiz === SQ5_ID && guard < 40) {
      guard += 1;
      round = answerCorrect(quiz, round);
      round = round.nextRound ?? round;
    }
    assert.equal(round.metadata.subquiz, "base");
    const info = quiz.getInfo11_20();
    assert.equal(info.answeredText, "0 / 20 acoperite", "sq5 nu trebuia sa marcheze niciun fact ca acoperit in sq1");
  });

  // CORECTAT (Faza D, lotul 4) — bug-ul ORIGINAL care a pornit tot refactorul
  // (raportat de user, 17.08.2026): inainte, sq5 "consuma un turn corect sau
  // nu" — un raspuns gresit avansa itemul intern in tacere, dar eticheta
  // ramanea "wrong-answer", desincronizand ecranul de starea reala
  // (falling-engine.js sarea randarea, butoane "moarte", raspunsurile
  // urmatoare notate fata de intrebarea nevazuta). Titlul original al acestui
  // test ("... allowOnWrong") testa chiar acel mecanism ca feature. Acum
  // gresit ramane pe aceeasi intrebare (fara limita), iar iesirea din sq5
  // se intampla doar prin rezolvari corecte.
  it("CORECTAT: raspunsul gresit in sq5 ramane pe aceeasi intrebare (fara limita); iesirea se intampla doar prin raspunsuri corecte", () => {
    const fluentaSursa = {
      scorPtFact: () => 0,
      starePtFact: (a, b) => (a === 11 && b === 9 ? "fluent" : "netestat"),
    };
    const quiz = setupQuiz({
      fluentaSursa,
      localStorageSeed: {
        "yl:mul1120v4:sq5Mode": "B",
        "yl:mul1120v4:sq5Entry": "levelStart",
        "yl:mul1120v4:sq5BlocLen": "3",
        "yl:mul1120v4:sq5TurnsPerFact": "3",
      },
    });
    const round = quiz.beginRound();
    assert.equal(round.metadata.subquiz, SQ5_ID);

    // 30 apasari gresite pe rand: outcome ramane onest "wrong-answer", itemul
    // nu avanseaza deloc (fact + forma neschimbate).
    let current = round;
    for (let i = 0; i < 30; i += 1) {
      const wrong = answerWrong(quiz, current);
      assert.equal(wrong.outcome, "wrong-answer", `incercarea ${i + 1}: eticheta trebuie sa ramana onesta`);
      assert.equal(
        `${wrong.metadata.factA}*${wrong.metadata.factB}=${wrong.metadata.eqForm}`,
        `${current.metadata.factA}*${current.metadata.factB}=${current.metadata.eqForm}`,
        `incercarea ${i + 1}: itemul nu trebuia sa avanseze pe raspuns gresit`
      );
      current = wrong;
    }

    // Abia acum, raspunzand corect, sq5 avanseaza si in cele din urma iese.
    let guard = 0;
    while (current.metadata?.subquiz === SQ5_ID && guard < 20) {
      guard += 1;
      current = answerCorrect(quiz, current);
      current = current.nextRound ?? current;
    }
    assert.ok(guard < 20, "sq5 nu trebuia sa ramana blocat la raspunsuri corecte");
    assert.equal(current.metadata.subquiz, "base", "sq5 trebuia sa iasa normal spre baza, prin rezolvari corecte");
  });

  it("subquiz_id separabil in jurnal: toate randurile sq5 au subquiz_id si subquiz_name", () => {
    // jurnalIntrebariActiv nu e expus prin setupQuiz() (setupQuiz apeleaza
    // .create() direct, fara wrapper-ul din QuizRegistry.register care il
    // seteaza true) — creat manual aici, ca sa testam contractul real al
    // getContextJurnal, nu doar metadata brute.
    const fluentaSursa = {
      scorPtFact: () => 0,
      starePtFact: (a, b) => (a === 11 && b === 9 ? "fluent" : "netestat"),
    };
    setupQuiz({
      fluentaSursa,
      localStorageSeed: { "yl:mul1120v4:sq5Mode": "B", "yl:mul1120v4:sq5Entry": "levelStart" },
    }); // doar ca sa incarce scripturile pe globalThis
    const quiz = globalThis.Mul1120V4IntensivMultipli234Quiz.create({
      random: () => 0,
      fluentaSursa,
      jurnalIntrebariActiv: true,
    });
    const round = quiz.beginRound();
    assert.equal(round.metadata.subquiz, SQ5_ID);
    const contextJurnal = quiz.getContextJurnal(round);
    assert.equal(contextJurnal.subquiz_id, SQ5_ID);
    assert.ok(contextJurnal.subquiz_name, "subquiz_name nu trebuie sa fie null pentru sq5");
  });
});
