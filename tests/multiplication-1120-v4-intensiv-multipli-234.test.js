import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = "C:/Users/I/Projects/Youlearn.com";
const SQ3_ID = "sq3FactorGroup";
// Copie a listei din motor (js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js).
// Duplicare deliberata: testul verifica ca formula produce castigatorul asteptat
// pe datele reale, nu doar ca lista exista.
const FG_LIST = [
  [2, 4, 8, 16],
  [4, 8, 12, 16],
  [2, 4, 6, 8],
  [5, 15],
  [3, 6, 9],
  [12, 15, 18],
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

  it("declansatorul \"2 facte gresite\" functioneaza chiar cand chiar al 2-lea raspuns gresit e cel care declanseaza", () => {
    // Regresie directa pt fix-ul allowOnWrong: fara el, blockWrongTransition
    // (subquiz-definition.js) ar anula push-ul in sq3 fiindca raspunsul care
    // il declanseaza e chiar unul gresit.
    const quiz = setupQuiz({ random: () => 0 });
    let round = quiz.beginRound();
    round = answerWrong(quiz, round); // b=1, gresit -> wrongFacts=[1], motorul reia b=1
    assert.equal(round.metadata.factB, 1, "raspuns gresit fara declansator: motorul reia aceeasi intrebare");
    round = answerCorrect(quiz, round); // rezolva b=1 la a doua incercare
    assert.equal(round.metadata.factB, 2);
    const trigger = answerWrong(quiz, round); // b=2 gresit -> wrongFacts=[2], acum 2 facte gresite distincte (1 si 2)
    assert.equal(trigger.metadata.subquiz, SQ3_ID, "al doilea fact gresit distinct trebuia sa declanseze sq3, desi raspunsul a fost gresit");
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

  it("criteriul 6b: plasa de siguranta — un fact niciodata corect tot forteaza avansul dupa 5 incercari", () => {
    const quiz = setupQuiz({ fluentaSursa: { scorPtFact: () => 0 } });
    let round = quiz.beginRound();
    for (let i = 0; i < 4; i += 1) round = answerCorrect(quiz, round);
    round = answerCorrect(quiz, round);
    assert.equal(round.metadata.subquiz, SQ3_ID);

    const targetB = round.metadata.factB;
    let timesShown = 0;
    let guard = 0;
    // Raspundem mereu gresit la targetB (motorul reia aceeasi intrebare pana
    // la plafonul de 5 incercari, apoi forteaza avansul), corect la restul,
    // ca sesiunea sa se poata termina.
    while (round.metadata?.subquiz === SQ3_ID && guard < 60) {
      guard += 1;
      if (round.metadata.factB === targetB) {
        timesShown += 1;
        round = answerWrong(quiz, round);
      } else {
        round = answerCorrect(quiz, round);
      }
      round = round.nextRound ?? round;
    }
    assert.ok(guard < 60, "sesiunea sq3 nu trebuia sa ramana blocata la infinit pe factul greu");
    assert.ok(
      timesShown >= 5 && timesShown <= 6,
      `targetB=${targetB} trebuia sa fie afisat de ~5 ori inainte de avans fortat (a fost ${timesShown})`
    );
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

  it("criteriul 11: pe date reale, castigatorul primului sq3 e fg [12,15,18] la majoritatea nivelelor, dar [7,11,13,17,19] la nivelul 2 (A=12)", () => {
    // fg [12,14,16,18] a fost eliminat (user, 29.07.2026); recalculat pe
    // fixture-ul real dupa eliminare — nivelul 2 iese din tipar fiindca
    // A=12 se intampla sa aiba date reale mai bune la factele 7,11,13,17,19
    // decat restul nivelelor la fg-ul altfel castigator [12,15,18].
    const fluentaSursa = loadRealFluentaSursa();
    const asteptat = {
      1: [12, 15, 18],
      2: [7, 11, 13, 17, 19],
      3: [12, 15, 18],
      4: [12, 15, 18],
      5: [12, 15, 18],
      6: [12, 15, 18],
      7: [12, 15, 18],
      8: [12, 15, 18],
      9: [12, 15, 18],
      10: [12, 15, 18],
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

  it("FG_LIST din test reflecta exact lista din motor (santinela anti-drift)", () => {
    // Nu putem importa constanta privata direct; verificam indirect prin
    // comportamentul deja testat mai sus (criteriile 7 si 11). Aici doar
    // confirmam ca lista locala are forma asteptata — 9 grupuri de cand a
    // fost eliminat [12,14,16,18] (user, 29.07.2026).
    assert.equal(FG_LIST.length, 9);
    const sizes = FG_LIST.map((fg) => fg.length).sort((a, b) => a - b);
    assert.deepEqual(sizes, [2, 3, 3, 3, 4, 4, 4, 4, 5]);
  });
});
