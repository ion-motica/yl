// IlustrareBonduri (js/bond-illustration.js) — modul nou, 30.08.2026, cerere
// user: ilustratie cu cosuri de mere langa fiecare bv rezolvat din prima, in
// tabelul InventarBonduri. Testele astea acopera doar functia pura
// (mereDeMutat) — partea care atinge DOM (`creeaza()`, dimensiunea merelor
// citita din fontul randului) se verifica live, in browser, nu aici (fara DOM
// real in acest fisier).
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadModule() {
  globalThis.window = globalThis;
  const code = readFileSync(join(rootDir, "js/bond-illustration.js"), "utf8");
  new Function("window", `${code}\n`)(globalThis);
  return globalThis.IlustrareBonduri;
}

describe("bond-illustration (IlustrareBonduri) — functii pure", () => {
  let IlustrareBonduri;
  before(() => {
    IlustrareBonduri = loadModule();
  });

  it("mereDeMutat: fara bv vechi (primul din nivel) intoarce null", () => {
    assert.equal(IlustrareBonduri.mereDeMutat({ vechi: null, nou: { a: 2, b: 4 } }), null);
  });

  it("mereDeMutat: a scade => merele pleaca dinspre a spre b, count = diferenta", () => {
    // 6=5+1 -> 6=2+4 (exemplul din specificatie): a scade de la 5 la 2, 3 mere
    // pleaca din a spre b.
    const mutare = IlustrareBonduri.mereDeMutat({ vechi: { a: 5, b: 1 }, nou: { a: 2, b: 4 } });
    assert.deepEqual(mutare, { directie: "a-spre-b", count: 3 });
  });

  it("mereDeMutat: a creste => merele pleaca dinspre b spre a", () => {
    const mutare = IlustrareBonduri.mereDeMutat({ vechi: { a: 1, b: 5 }, nou: { a: 4, b: 2 } });
    assert.deepEqual(mutare, { directie: "b-spre-a", count: 3 });
  });

  it("mereDeMutat: acelasi bv (a neschimbat) => count 0, fara directie", () => {
    const mutare = IlustrareBonduri.mereDeMutat({ vechi: { a: 3, b: 3 }, nou: { a: 3, b: 3 } });
    assert.deepEqual(mutare, { directie: null, count: 0 });
  });

  it("creeaza: intoarce un obiect cu arataBv si reseteaza, independent la fiecare apel", () => {
    const instanta1 = IlustrareBonduri.creeaza();
    const instanta2 = IlustrareBonduri.creeaza();
    assert.equal(typeof instanta1.arataBv, "function");
    assert.equal(typeof instanta1.reseteaza, "function");
    assert.notEqual(instanta1, instanta2, "fiecare creeaza() da o instanta noua, nu un singleton global");
  });
});
