import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = "C:/Users/I/Projects/Youlearn.com";

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  const runner = new Function("window", `${code}\n`);
  runner(globalThis);
}

function setupModules() {
  globalThis.window = globalThis;
  delete globalThis.ConfigPraguriVizualizare3;
  delete globalThis.MotorAnalizaVizualizare3;
  delete globalThis.SnapshotFluenta;
  loadScript("Vizualizare 3 - Claude/config-praguri.js");
  loadScript("Vizualizare 3 - Claude/motor-analiza.js");
  loadScript("js/snapshot-fluenta.js");
}

describe("SnapshotFluenta", () => {
  it("sursaGoala si construiesteDinInregistrari([]) dau scor 0 peste tot, fara exceptii", () => {
    setupModules();
    const goala = globalThis.SnapshotFluenta.sursaGoala();
    assert.equal(goala.scorPtFact(11, 1), 0);
    assert.equal(goala.scorPtFact(20, 20), 0);

    const dinGol = globalThis.SnapshotFluenta.construiesteDinInregistrari([]);
    assert.equal(dinGol.scorPtFact(12, 7), 0);
  });

  it("reproduce cifrele exacte ale conductei pe fixture-ul real (criteriul 10 din plan)", () => {
    setupModules();
    const brut = JSON.parse(readFileSync(join(rootDir, "tests/fixture-jurnal-v4.json"), "utf8"));

    // Verificare directa a conductei (nu doar a scorPtFact), ca sa prinda o
    // regresie in orice veriga: normalizeaza / grupeaza / selecteazaDomeniu.
    const motor = globalThis.MotorAnalizaVizualizare3;
    const intrebari = motor.grupeazaApasarilePeIntrebari(motor.normalizeaza(brut));
    assert.equal(brut.length, 1711);
    assert.equal(intrebari.length, 1620);

    const celule = [];
    for (let a = 11; a <= 20; a += 1) {
      for (let b = 1; b <= 20; b += 1) celule.push({ cell_id: `mul:${a}x${b}` });
    }
    const domeniu = motor.selecteazaDomeniu(intrebari, { celule });
    assert.equal(domeniu.necatalogate.length, 0);

    let cuDate = 0;
    let cuScor = 0;
    const sursa = globalThis.SnapshotFluenta.construiesteDinInregistrari(brut);
    celule.forEach(({ cell_id }) => {
      const n = (domeniu.peCelula.get(cell_id) ?? []).length;
      if (n > 0) cuDate += 1;
      const [a, b] = cell_id.replace("mul:", "").split("x").map(Number);
      if (sursa.scorPtFact(a, b) > 0) cuScor += 1;
    });
    assert.equal(cuDate, 109);
    assert.equal(cuScor, 103);

    assert.ok(sursa.scorPtFact(12, 7) > 0, "celula cu cel mai mare volum (51 apasari) trebuie sa aiba scor > 0");
    assert.equal(sursa.scorPtFact(11, 1), 0, "b=1 nu exista in v3, deci fara date");
    assert.equal(sursa.scorPtFact(20, 19), 0, "in interiorul domeniului v3 dar niciodata atins (fereastra nu trecea de 13)");
  });

  it("construiesteDinInregistrari e sincron si nu atinge indexedDB", () => {
    setupModules();
    assert.equal(typeof globalThis.indexedDB, "undefined");
    const sursa = globalThis.SnapshotFluenta.construiesteDinInregistrari([
      {
        data_ora_ro: "2026-07-12 18:57:40",
        fact: "12*7=84",
        a_raspuns_corect: true,
        a_cata_apasare_pe_buton: 1,
        durata_raspuns_secunde: 1.2,
      },
    ]);
    assert.equal(typeof sursa.scorPtFact, "function");
  });

  it("pregateste() rezolva cu sursa goala cand indexedDB nu exista", async () => {
    setupModules();
    const sursa = await globalThis.SnapshotFluenta.pregateste();
    assert.equal(sursa.scorPtFact(11, 1), 0);
  });
});
