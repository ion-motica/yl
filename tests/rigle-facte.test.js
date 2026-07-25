import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const sursaRigleFacte = readFileSync(join(rootDir, "js/rigle/facte.js"), "utf8");

globalThis.window = globalThis;
new Function("window", sursaRigleFacte)(globalThis);

const { genereazaFact, alegeVariante } = globalThis.RigleFacte;

describe("RigleFacte.alegeVariante", () => {
  it("e disponibilă în index înaintea rigle-cl1.js", () => {
    const index = readFileSync(join(rootDir, "index.html"), "utf8");
    const pozitieResursa = index.indexOf('<script src="js/rigle/facte.js');
    const pozitieQuiz = index.indexOf('<script src="js/quizzes/rigle-cl1.js');

    assert.equal(typeof genereazaFact, "function");
    assert.equal(typeof alegeVariante, "function");
    assert.ok(pozitieResursa >= 0);
    assert.ok(pozitieResursa < pozitieQuiz);
  });

  it("întoarce mereu 3 lățimi distincte, >=1, cu suma printre ele exact o dată", () => {
    for (let i = 0; i < 1000; i++) {
      const suma = 2 + Math.floor(Math.random() * 29); // 2..30
      const { latimiColoane, indexCorect } = alegeVariante(suma);

      assert.equal(latimiColoane.length, 3, String(suma));
      assert.equal(new Set(latimiColoane).size, 3, `distincte pt suma=${suma}`);
      latimiColoane.forEach((w) => assert.ok(w >= 1, `lățime>=1 pt suma=${suma}, w=${w}`));
      assert.equal(
        latimiColoane.filter((w) => w === suma).length,
        1,
        `suma=${suma} apare exact o dată printre variante`
      );
      assert.equal(latimiColoane[indexCorect], suma, `indexCorect corect pt suma=${suma}`);
      // sortate crescător
      for (let k = 1; k < latimiColoane.length; k++) {
        assert.ok(latimiColoane[k] > latimiColoane[k - 1], `sortare crescătoare, suma=${suma}`);
      }
    }
  });

  it("la suma=2, poziția corectă e doar 0 sau 1 (nu există lățime 0)", () => {
    for (let i = 0; i < 200; i++) {
      const { latimiColoane, indexCorect } = alegeVariante(2);
      assert.ok([0, 1].includes(indexCorect));
      latimiColoane.forEach((w) => assert.ok(w >= 1));
    }
  });

  it("la suma=30, toate cele 3 poziții apar, iar variantele pot depăși 30 (max 33)", () => {
    const pozitii = new Set();
    for (let i = 0; i < 500; i++) {
      const { latimiColoane, indexCorect } = alegeVariante(30);
      pozitii.add(indexCorect);
      latimiColoane.forEach((w) => assert.ok(w <= 33, `max variantă <=33, a fost ${w}`));
    }
    assert.deepEqual([...pozitii].sort(), [0, 1, 2]);
  });

  it("poziția corectă e ~uniformă pe 3000 de rulări la suma=7 (toate 3 pozițiile fezabile)", () => {
    const numarare = { 0: 0, 1: 0, 2: 0 };
    for (let i = 0; i < 3000; i++) {
      numarare[alegeVariante(7).indexCorect]++;
    }
    // ~1000 fiecare; interval larg (±20%) ca să nu fie test fragil, dar tot detectează
    // o distribuție sistematic greșită (ex. mereu pe mijloc).
    [0, 1, 2].forEach((p) => {
      assert.ok(numarare[p] > 800 && numarare[p] < 1200, `poziția ${p}: ${numarare[p]}`);
    });
  });
});

describe("RigleFacte.genereazaFact", () => {
  it("a+b=suma, întrebarea și grupele corespund, suma e în interval", () => {
    for (let i = 0; i < 200; i++) {
      const sumaMin = 2 + Math.floor(Math.random() * 10);
      const sumaMax = sumaMin + Math.floor(Math.random() * 10);
      const fact = genereazaFact({ sumaMin, sumaMax });

      assert.equal(fact.a + fact.b, fact.suma);
      assert.ok(fact.a >= 1 && fact.b >= 1);
      assert.ok(fact.suma >= sumaMin && fact.suma <= sumaMax);
      assert.equal(fact.intrebare, `${fact.a}+${fact.b}=?`);
      assert.equal(fact.grupe[0].n, fact.a);
      assert.equal(fact.grupe[1].n, fact.b);
      assert.ok(fact.latimiColoane.includes(fact.suma));
      assert.equal(fact.latimiColoane[fact.indexCorect], fact.suma);
    }
  });

  it("normalizează un interval inversat (sumaMin > sumaMax) fără să crape", () => {
    const fact = genereazaFact({ sumaMin: 20, sumaMax: 5 });
    assert.equal(fact.suma, 20);
  });

  it("clampează sub 2 și peste 30", () => {
    const factJos = genereazaFact({ sumaMin: -5, sumaMax: -5 });
    assert.equal(factJos.suma, 2);
    const factSus = genereazaFact({ sumaMin: 99, sumaMax: 99 });
    assert.equal(factSus.suma, 30);
  });

  it("fără argumente, foloseşte implicit intervalul absolut [2,30]", () => {
    const fact = genereazaFact();
    assert.ok(fact.suma >= 2 && fact.suma <= 30);
  });
});
