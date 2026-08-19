import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = "C:/Users/I/Projects/Youlearn.com";

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  new Function("window", `${code}\n`)(globalThis);
}

// Item minimal, in forma pe care o produc quizurile reale.
function item(prompt, options, correctIndex) {
  return { prompt, options, correctIndex, correctAnswer: options[correctIndex] };
}

// Cusatura catre motorul de randare (mr): in cod real e `runtime.view(extra)`.
// In teste o inlocuim cu ceva pur, ca sa testam contractul, nu DOM-ul.
function vedereDin(itemCurent) {
  return (extra = {}) => ({ prompt: itemCurent.prompt, options: itemCurent.options, ...extra });
}

describe("Motor 3 butoane (M3B)", () => {
  beforeEach(() => {
    globalThis.window = globalThis;
    delete globalThis.Motor3Butoane;
    loadScript("js/motor-3-butoane.js");
  });

  // ---- regula unica -------------------------------------------------------

  it("raspuns gresit: ramane pe aceeasi intrebare si NU cere intrebarea urmatoare", () => {
    const q1 = item("2+3=?", ["4", "5", "6"], 1);
    let cereriDeIntrebareNoua = 0;

    const m3b = globalThis.Motor3Butoane.creeaza({
      esteCorect: (it, idx) => idx === it.correctIndex,
      intrebareUrmatoare: () => {
        cereriDeIntrebareNoua += 1;
        return item("altceva", ["1", "2", "3"], 0);
      },
    });

    const rezultat = m3b.laApasareButon({
      item: q1,
      index: 0, // gresit
      construiesteVedere: vedereDin(q1),
    });

    assert.equal(cereriDeIntrebareNoua, 0, "pe gresit NU se cere intrebarea urmatoare");
    assert.equal(rezultat.action, "stay");
    assert.equal(rezultat.view.outcome, "wrong-answer", "eticheta care ii spune lui mr: nu randa");
    assert.equal(rezultat.view.correct, false);
    assert.equal(rezultat.view.prompt, "2+3=?", "pe ecran ramane aceeasi intrebare");
  });

  it("raspuns corect: cere intrebarea urmatoare si o afiseaza", () => {
    const q1 = item("2+3=?", ["4", "5", "6"], 1);
    const q2 = item("7+1=?", ["8", "9", "10"], 0);
    let cereriDeIntrebareNoua = 0;

    const m3b = globalThis.Motor3Butoane.creeaza({
      esteCorect: (it, idx) => idx === it.correctIndex,
      intrebareUrmatoare: () => {
        cereriDeIntrebareNoua += 1;
        return q2;
      },
    });

    const rezultat = m3b.laApasareButon({
      item: q1,
      index: 1, // corect
      construiesteVedere: vedereDin(q2),
    });

    assert.equal(cereriDeIntrebareNoua, 1);
    assert.equal(rezultat.action, "continue");
    assert.equal(rezultat.view.outcome, "step-correct");
    assert.equal(rezultat.view.correct, true);
    assert.equal(rezultat.view.prompt, "7+1=?", "pe ecran apare intrebarea noua");
  });

  it("3000 de apasari gresite nu schimba intrebarea — nu exista limita de incercari", () => {
    const q1 = item("2+3=?", ["4", "5", "6"], 1);
    let cereriDeIntrebareNoua = 0;

    const m3b = globalThis.Motor3Butoane.creeaza({
      esteCorect: (it, idx) => idx === it.correctIndex,
      intrebareUrmatoare: () => {
        cereriDeIntrebareNoua += 1;
        return item("altceva", ["1", "2", "3"], 0);
      },
    });

    for (let i = 0; i < 3000; i += 1) {
      const rezultat = m3b.laApasareButon({
        item: q1,
        index: i % 2 === 0 ? 0 : 2, // mereu gresit
        construiesteVedere: vedereDin(q1),
      });
      assert.equal(rezultat.view.outcome, "wrong-answer");
      assert.equal(rezultat.view.prompt, "2+3=?");
    }

    assert.equal(cereriDeIntrebareNoua, 0, "nicio cale de avans fara raspuns corect");
    assert.equal(m3b.numarApasariInTur(), 3000, "toate apasarile apartin aceluiasi tur");
  });

  // ---- tur vs. apasare ----------------------------------------------------

  it("turul e corect DOAR daca prima apasare a fost corecta", () => {
    const q1 = item("2+3=?", ["4", "5", "6"], 1);
    const verdicte = [];

    const m3b = globalThis.Motor3Butoane.creeaza({
      esteCorect: (it, idx) => idx === it.correctIndex,
      intrebareUrmatoare: () => item("urmatoarea", ["1", "2", "3"], 0),
      actiuni: {
        dupaApasare: (ctx) => {
          verdicte.push({
            numarApasare: ctx.numarApasare,
            estePrimaApasare: ctx.estePrimaApasare,
            corect: ctx.corect,
            turCorect: ctx.turCorect,
          });
          return {};
        },
      },
    });

    // gresit, gresit, apoi corect — turul ramane GRESIT
    m3b.laApasareButon({ item: q1, index: 0, construiesteVedere: vedereDin(q1) });
    m3b.laApasareButon({ item: q1, index: 2, construiesteVedere: vedereDin(q1) });
    m3b.laApasareButon({ item: q1, index: 1, construiesteVedere: vedereDin(q1) });

    assert.deepEqual(verdicte, [
      { numarApasare: 1, estePrimaApasare: true, corect: false, turCorect: false },
      { numarApasare: 2, estePrimaApasare: false, corect: false, turCorect: false },
      // a nimerit butonul corect abia la a 3-a apasare -> turul NU e corect
      { numarApasare: 3, estePrimaApasare: false, corect: true, turCorect: false },
    ]);
  });

  it("prima apasare corecta -> turul e corect", () => {
    const q1 = item("2+3=?", ["4", "5", "6"], 1);
    let verdict = null;

    const m3b = globalThis.Motor3Butoane.creeaza({
      esteCorect: (it, idx) => idx === it.correctIndex,
      intrebareUrmatoare: () => item("urmatoarea", ["1", "2", "3"], 0),
      actiuni: {
        dupaApasare: (ctx) => {
          verdict = { numarApasare: ctx.numarApasare, turCorect: ctx.turCorect };
          return {};
        },
      },
    });

    m3b.laApasareButon({ item: q1, index: 1, construiesteVedere: vedereDin(q1) });
    assert.deepEqual(verdict, { numarApasare: 1, turCorect: true });
  });

  it("numaratoarea apasarilor reporneste la fiecare intrebare noua", () => {
    const q1 = item("2+3=?", ["4", "5", "6"], 1);
    const q2 = item("7+1=?", ["8", "9", "10"], 0);
    const numere = [];

    const m3b = globalThis.Motor3Butoane.creeaza({
      esteCorect: (it, idx) => idx === it.correctIndex,
      intrebareUrmatoare: () => q2,
      actiuni: {
        dupaApasare: (ctx) => {
          numere.push(ctx.numarApasare);
          return {};
        },
      },
    });

    m3b.laApasareButon({ item: q1, index: 0, construiesteVedere: vedereDin(q1) }); // gresit
    m3b.laApasareButon({ item: q1, index: 1, construiesteVedere: vedereDin(q1) }); // corect -> tur nou
    m3b.laApasareButon({ item: q2, index: 1, construiesteVedere: vedereDin(q2) }); // gresit, in turul nou

    assert.deepEqual(numere, [1, 2, 1], "dupa raspunsul corect, turul nou porneste de la 1");
  });

  // ---- cele 4 momente -----------------------------------------------------

  it("cele 4 momente se declanseaza la timpul lor, iar campurile intoarse ajung in vedere", () => {
    const q1 = item("2+3=?", ["4", "5", "6"], 1);
    const ordinea = [];

    const m3b = globalThis.Motor3Butoane.creeaza({
      esteCorect: (it, idx) => idx === it.correctIndex,
      intrebareUrmatoare: () => item("urmatoarea", ["1", "2", "3"], 0),
      actiuni: {
        inainteDeAfisareaIntrebarii: () => {
          ordinea.push("inainteDeAfisare");
          return { resetFall: true };
        },
        dupaAfisareaIntrebarii: () => {
          ordinea.push("dupaAfisare");
          return {};
        },
        inainteDeApasare: () => {
          ordinea.push("inainteDeApasare");
          return {};
        },
        dupaApasare: () => {
          ordinea.push("dupaApasare");
          return { promptHoldMs: 160 };
        },
      },
    });

    m3b.laAfisareaIntrebarii({ item: q1 });
    const rezultat = m3b.laApasareButon({ item: q1, index: 1, construiesteVedere: vedereDin(q1) });

    assert.deepEqual(ordinea, [
      "inainteDeAfisare",
      "dupaAfisare",
      "inainteDeApasare",
      "dupaApasare",
      // afisarea intrebarii urmatoare, dupa raspunsul corect:
      "inainteDeAfisare",
      "dupaAfisare",
    ]);
    assert.equal(rezultat.view.promptHoldMs, 160, "campurile din actiuni ajung in vedere");
    assert.equal(rezultat.view.resetFall, true, "inclusiv cele de la afisarea intrebarii noi");
  });

  it("momentele de apasare se declanseaza si pe raspuns GRESIT, nu doar pe corect", () => {
    const q1 = item("2+3=?", ["4", "5", "6"], 1);
    const ordinea = [];

    const m3b = globalThis.Motor3Butoane.creeaza({
      esteCorect: (it, idx) => idx === it.correctIndex,
      intrebareUrmatoare: () => item("urmatoarea", ["1", "2", "3"], 0),
      actiuni: {
        inainteDeApasare: () => {
          ordinea.push("inainteDeApasare");
          return {};
        },
        dupaApasare: (ctx) => {
          ordinea.push(`dupaApasare(corect=${ctx.corect})`);
          return { flashSuplimentar: "x" };
        },
      },
    });

    const rezultat = m3b.laApasareButon({ item: q1, index: 0, construiesteVedere: vedereDin(q1) });

    assert.deepEqual(ordinea, ["inainteDeApasare", "dupaApasare(corect=false)"]);
    assert.equal(rezultat.view.flashSuplimentar, "x");
  });

  // ---- articularea cu msq (orchestratorul) --------------------------------

  it("schimbarea de ruta se cere DOAR dupa raspuns corect, si e pasata mai departe lui msq", () => {
    const q1 = item("2+3=?", ["4", "5", "6"], 1);
    let apeluriDupaRaspunsCorect = 0;

    const m3b = globalThis.Motor3Butoane.creeaza({
      esteCorect: (it, idx) => idx === it.correctIndex,
      intrebareUrmatoare: () => item("urmatoarea", ["1", "2", "3"], 0),
      actiuni: {
        dupaRaspunsCorect: () => {
          apeluriDupaRaspunsCorect += 1;
          return { action: "push", targetId: "sq3", payload: { facts: [2, 3] } };
        },
      },
    });

    // apasare gresita: nu se cere rutare
    m3b.laApasareButon({ item: q1, index: 0, construiesteVedere: vedereDin(q1) });
    assert.equal(apeluriDupaRaspunsCorect, 0, "pe gresit NU se evalueaza schimbarea de ruta");

    // apasare corecta: se cere rutare, si comanda ajunge intacta la msq
    const rezultat = m3b.laApasareButon({ item: q1, index: 1, construiesteVedere: vedereDin(q1) });
    assert.equal(apeluriDupaRaspunsCorect, 1);
    assert.equal(rezultat.action, "push");
    assert.equal(rezultat.targetId, "sq3");
    assert.deepEqual(rezultat.payload, { facts: [2, 3] });
  });

  it("cand se cere schimbare de ruta, NU se mai cere intrebarea urmatoare", () => {
    const q1 = item("2+3=?", ["4", "5", "6"], 1);
    let cereriDeIntrebareNoua = 0;

    const m3b = globalThis.Motor3Butoane.creeaza({
      esteCorect: (it, idx) => idx === it.correctIndex,
      intrebareUrmatoare: () => {
        cereriDeIntrebareNoua += 1;
        return item("urmatoarea", ["1", "2", "3"], 0);
      },
      actiuni: {
        dupaRaspunsCorect: () => ({ action: "pop", reason: "gata" }),
      },
    });

    m3b.laApasareButon({ item: q1, index: 1, construiesteVedere: vedereDin(q1) });
    assert.equal(cereriDeIntrebareNoua, 0, "ruta preia controlul; intrebarea vine din alta bucata");
  });

  // ---- mesaje -------------------------------------------------------------

  it("mesajele pot fi text fix sau functie care primeste contextul", () => {
    const q1 = item("2+3=?", ["4", "5", "6"], 1);

    const m3b = globalThis.Motor3Butoane.creeaza({
      esteCorect: (it, idx) => idx === it.correctIndex,
      intrebareUrmatoare: () => item("urmatoarea", ["1", "2", "3"], 0),
      mesaje: {
        corect: "Corect!",
        gresit: (ctx) => `${ctx.alesul} nu e bun.`,
      },
    });

    const gresit = m3b.laApasareButon({ item: q1, index: 0, construiesteVedere: vedereDin(q1) });
    assert.equal(gresit.view.message, "4 nu e bun.");

    const corect = m3b.laApasareButon({ item: q1, index: 1, construiesteVedere: vedereDin(q1) });
    assert.equal(corect.view.message, "Corect!");
  });

  // ---- semnatura (folosita de mr in Faza C, ca sa refuze alte cai) --------

  it("orice rezultat poarta semnatura M3B, si pe corect si pe gresit", () => {
    const q1 = item("2+3=?", ["4", "5", "6"], 1);
    const m3b = globalThis.Motor3Butoane.creeaza({
      esteCorect: (it, idx) => idx === it.correctIndex,
      intrebareUrmatoare: () => item("urmatoarea", ["1", "2", "3"], 0),
    });

    const gresit = m3b.laApasareButon({ item: q1, index: 0, construiesteVedere: vedereDin(q1) });
    const corect = m3b.laApasareButon({ item: q1, index: 1, construiesteVedere: vedereDin(q1) });

    assert.ok(globalThis.Motor3Butoane.esteRezultatValid(gresit));
    assert.ok(globalThis.Motor3Butoane.esteRezultatValid(corect));
    assert.equal(gresit.view.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
    assert.equal(corect.view.motor3Butoane, globalThis.Motor3Butoane.SEMNATURA);
  });

  it("un rezultat scris de mana, pe langa M3B, e respins", () => {
    const scrisDeMana = { action: "continue", view: { outcome: "step-correct", correct: true } };
    assert.equal(globalThis.Motor3Butoane.esteRezultatValid(scrisDeMana), false);
    assert.equal(globalThis.Motor3Butoane.esteRezultatValid(null), false);
  });

  // ---- validare la creare (erori explicite, imediate) --------------------

  it("creare fara `esteCorect` sau fara `intrebareUrmatoare` -> eroare explicita", () => {
    assert.throws(
      () => globalThis.Motor3Butoane.creeaza({ intrebareUrmatoare: () => null }),
      /esteCorect/
    );
    assert.throws(
      () => globalThis.Motor3Butoane.creeaza({ esteCorect: () => true }),
      /intrebareUrmatoare/
    );
  });

  it("apasare fara `construiesteVedere` -> eroare explicita, nu esec tacut", () => {
    const m3b = globalThis.Motor3Butoane.creeaza({
      esteCorect: () => true,
      intrebareUrmatoare: () => null,
    });
    assert.throws(
      () => m3b.laApasareButon({ item: item("x", ["1"], 0), index: 0 }),
      /construiesteVedere/
    );
  });
});
