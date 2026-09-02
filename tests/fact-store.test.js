import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, beforeEach } from "node:test";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function incarcaSursa(caleRelativa) {
  const sursa = readFileSync(join(rootDir, caleRelativa), "utf8");
  new Function("window", sursa)(globalThis);
}

globalThis.window = globalThis;
incarcaSursa("js/fact-catalog.js");
incarcaSursa("js/fact-store.js");

const { FactStore, FactCatalog } = globalThis;

// Simuleaza exact situatia din productie (02.09.2026): storage-ul EXISTA,
// dar orice scriere noua esueaza cu QuotaExceededError — asta a blocat
// jocul, pt. ca `writeState` nu prindea eroarea si ea urca netratata prin
// tot lantul de apel al click-ului (recordAttempt -> dupa_turn_apasare ->
// motor-3-butoane -> ... -> handlerul de click), oprind rularea inainte ca
// `dupaRaspunsCorect` (cel care chiar avanseaza jocul) sa apuce sa ruleze.
function creazaStorageCareArunca() {
  return {
    getItem: () => null,
    setItem: () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    },
    removeItem: () => {},
  };
}

function creazaStorageFunctional() {
  const date = {};
  return {
    getItem: (cheie) => (Object.prototype.hasOwnProperty.call(date, cheie) ? date[cheie] : null),
    setItem: (cheie, valoare) => {
      date[cheie] = String(valoare);
    },
    removeItem: (cheie) => {
      delete date[cheie];
    },
  };
}

const factExemplu = {
  operation: "mul",
  promptForm: FactCatalog.PROMPT_FORMS.result,
  values: { a: 3, b: 7 },
};

describe("FactStore — rezistenta la localStorage plin (QuotaExceededError)", () => {
  beforeEach(() => {
    globalThis.localStorage = creazaStorageFunctional();
  });

  it("recordAttempt NU arunca eroarea mai departe cand setItem esueaza (regresie 02.09.2026)", () => {
    globalThis.localStorage = creazaStorageCareArunca();
    const fact = FactCatalog.createFact(factExemplu);

    assert.doesNotThrow(() => {
      FactStore.recordAttempt(fact.factId, { correct: true, responseMs: 1200 }, fact);
    });
  });

  it("saveFact NU arunca eroarea mai departe cand setItem esueaza", () => {
    globalThis.localStorage = creazaStorageCareArunca();
    const fact = FactCatalog.createFact(factExemplu);

    assert.doesNotThrow(() => {
      FactStore.saveFact(fact);
    });
  });

  it("cand storage-ul functioneaza normal, progresul tot se salveaza (fixul nu strica drumul fericit)", () => {
    const fact = FactCatalog.createFact(factExemplu);
    FactStore.recordAttempt(fact.factId, { correct: true, responseMs: 900 }, fact);

    const salvat = FactStore.getFact(fact.factId, fact);
    assert.equal(salvat.totals.attempts, 1);
    assert.equal(salvat.totals.correct, 1);
  });
});
