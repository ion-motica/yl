// Contractul schimbarii de nivel (js/schimbare-de-nivel.js), decis de user
// 28.08.2026, dupa doua runde de regresii cu acelasi simptom (ecran inghetat pe
// intrebarea veche, raspunsuri corecte marcate gresit, avans "fantoma") si cauze
// tehnice mereu altele — vezi documente de referinta/RAPORT-motor-comun-raspuns.md.
//
// Inainte, avansul de nivel era reimplementat separat in 17 fisiere de quiz.
// Acum: un singur handler, declarat explicit de fiecare quiz cu niveluri.
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function incarca() {
  const code = readFileSync(join(rootDir, "js/schimbare-de-nivel.js"), "utf8");
  const scope = {};
  new Function("window", code)(scope);
  return scope.SchimbareDeNivel;
}

describe("SchimbareDeNivel — contractul unic al avansului de nivel", () => {
  it("standardul: text unic pentru nivel nou si pentru ultimul nivel", () => {
    const S = incarca();
    const c = S.standard();
    assert.equal(c.textNivelNou, "Felicitări! Nivelul următor!");
    assert.equal(c.textUltimulNivel, "Felicitări, ai parcurs ultimul nivel!");
  });

  it("standardul NU intrerupe fluxul: pauza inainte de runda urmatoare e 0", () => {
    const S = incarca();
    // Cerinta explicita a userului: intrebarea din nivelul nou apare IMEDIAT,
    // iar copilul poate raspunde la ea cat timp mesajul e inca pe ecran.
    // Inainte era LEVEL_ADV_MS=1400, cu butoanele moarte in tot acel interval.
    assert.equal(S.standard().pauzaInainteDeRundaUrmatoareMs, 0);
  });

  it("mesajul de nivel nou dispare singur, dupa o durata explicita", () => {
    const S = incarca();
    const c = S.standard();
    assert.ok(c.durataMesajMs >= 3000 && c.durataMesajMs <= 4000, `durata=${c.durataMesajMs}`);
  });

  it("orice valoare implicita poate fi suprascrisa prin argument", () => {
    const S = incarca();
    const c = S.standard({
      textNivelNou: "Bravo!",
      textUltimulNivel: "Gata!",
      durataMesajMs: 9000,
      pauzaInainteDeRundaUrmatoareMs: 250,
    });
    assert.equal(c.textNivelNou, "Bravo!");
    assert.equal(c.textUltimulNivel, "Gata!");
    assert.equal(c.durataMesajMs, 9000);
    assert.equal(c.pauzaInainteDeRundaUrmatoareMs, 250);
  });

  it("argumentele partiale lasa restul pe valorile implicite", () => {
    const S = incarca();
    const c = S.standard({ durataMesajMs: 5000 });
    assert.equal(c.durataMesajMs, 5000);
    assert.equal(c.textNivelNou, S.TEXT_NIVEL_NOU, "restul raman implicite");
    assert.equal(c.pauzaInainteDeRundaUrmatoareMs, S.PAUZA_INAINTE_DE_RUNDA_URMATOARE_MS);
  });

  it("valorile implicite sunt expuse, ca sa se schimbe intr-un singur loc", () => {
    const S = incarca();
    assert.equal(typeof S.TEXT_NIVEL_NOU, "string");
    assert.equal(typeof S.TEXT_ULTIMUL_NIVEL, "string");
    assert.equal(typeof S.DURATA_MESAJ_MS, "number");
    assert.equal(typeof S.PAUZA_INAINTE_DE_RUNDA_URMATOARE_MS, "number");
  });
});

describe("Contractul e declarat de toate quizurile cu niveluri", () => {
  it("fiecare quiz care declara placeholderRaspuns declara si laSchimbareDeNivel", () => {
    // Garda impotriva exact a problemei care a generat contractul: un quiz nou
    // (sau unul uitat la migrare) care avanseaza nivelul fara sa treaca prin
    // handlerul comun. Cele doua contracte merg impreuna: orice quiz care
    // ajunge in motorul de randare are nevoie de amandoua.
    const cuPlaceholder = execSync(
      'grep -rl "placeholderRaspuns:" js/ --include=*.js || true',
      { cwd: rootDir, encoding: "utf8" }
    )
      .trim()
      .split("\n")
      .filter((f) => f && !f.endsWith("js/placeholder-raspuns.js"));

    assert.ok(cuPlaceholder.length > 10, `asteptam multe quizuri, gasite ${cuPlaceholder.length}`);

    const fara = cuPlaceholder.filter((f) => {
      const src = readFileSync(join(rootDir, f), "utf8");
      return !src.includes("laSchimbareDeNivel:");
    });
    assert.deepEqual(fara, [], "fisiere cu placeholderRaspuns dar fara laSchimbareDeNivel");
  });
});
