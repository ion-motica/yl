import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const sursaNumaraTICs = readFileSync(join(rootDir, "js/numara-tics.js"), "utf8");

globalThis.window = globalThis;
new Function("window", sursaNumaraTICs)(globalThis);

const { numaraTICs } = globalThis;

function verificaRezultate(cazuri) {
  for (const [intrare, rezultatAsteptat] of cazuri) {
    assert.equal(numaraTICs(intrare), rezultatAsteptat, String(intrare));
  }
}

describe("numaraTICs", () => {
  it("este disponibilă în index înaintea quizurilor", () => {
    const index = readFileSync(join(rootDir, "index.html"), "utf8");
    const pozitieResursa = index.indexOf('<script src="js/numara-tics.js"></script>');
    const pozitiePrimQuiz = index.indexOf('<script src="js/quizzes/');

    assert.equal(typeof numaraTICs, "function");
    assert.ok(pozitieResursa >= 0);
    assert.ok(pozitieResursa < pozitiePrimQuiz);
  });

  it("acceptă obiectul comun și variantele de string/operator", () => {
    verificaRezultate([
      [{ operandStanga: 17, operatie: "*", operandDreapta: 12 }, 2],
      ["17*12", 2],
      ["17 × 12", 2],
      ["17x12", 2],
      ["17X12", 2],
      ["17 · 12", 2],
      ["200 : 39", 4],
      ["200 ÷ 39", 4],
      [" 017 * 12 ", 2],
      ["12 − 7", 1],
    ]);
  });

  it("numără transporturile la adunarea scrisă", () => {
    verificaRezultate([
      ["0+0", 0],
      ["123+456", 0],
      ["8+7", 1],
      ["99+1", 2],
      ["499+501", 3],
      ["1000+0", 0],
    ]);
  });

  it("numără fiecare frontieră traversată la scăderea scrisă", () => {
    verificaRezultate([
      ["500-500", 0],
      ["12-7", 1],
      ["300-199", 2],
      ["101-2", 2],
      ["1000-1", 3],
    ]);
  });

  it("numără produsele parțiale și adunarea lor fără a reordona operanzii", () => {
    verificaRezultate([
      ["10*10", 0],
      ["9*9", 1],
      ["99*9", 2],
      ["17*12", 2],
      ["25*40", 2],
      ["3*67", 3],
      ["67*3", 2],
    ]);
  });

  it("numără produsele și scăderile parțiale la împărțirea scrisă", () => {
    verificaRezultate([
      ["7/9", 0],
      ["101/10", 0],
      ["105/5", 1],
      ["100/6", 3],
      ["200/41", 3],
      ["200/39", 4],
      ["936/12", 3],
      ["1000/16", 5],
    ]);
  });

  it("aruncă TypeError pentru format, contract sau tipuri invalide", () => {
    const intrariInvalide = [
      "",
      "abc",
      "17**12",
      "17+12=29",
      "17/2/3",
      "-17+12",
      "17+-12",
      "1.5+2",
      null,
      [],
      17,
      { operandStanga: 17, operatie: "*" },
      { operandStanga: "17", operatie: "*", operandDreapta: 12 },
      { operandStanga: NaN, operatie: "*", operandDreapta: 12 },
      { operandStanga: Infinity, operatie: "*", operandDreapta: 12 },
      { operandStanga: 1.5, operatie: "+", operandDreapta: 2 },
      { operandStanga: 17, operatie: "?", operandDreapta: 12 },
      { operandStanga: 17, operatie: "*", operandDreapta: 12, context: {} },
    ];

    for (const intrare of intrariInvalide) {
      assert.throws(() => numaraTICs(intrare), TypeError);
    }
  });

  it("aruncă RangeError pentru valori sau rezultate în afara domeniului", () => {
    const intrariInvalide = [
      "3/0",
      "2-3",
      "999+2",
      "50*21",
      "1001-1",
      { operandStanga: -1, operatie: "+", operandDreapta: 2 },
      { operandStanga: 1, operatie: "+", operandDreapta: 1001 },
    ];

    for (const intrare of intrariInvalide) {
      assert.throws(() => numaraTICs(intrare), RangeError);
    }
  });
});
