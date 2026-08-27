import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function incarca() {
  const code = readFileSync(join(rootDir, "js/placeholder-raspuns.js"), "utf8");
  const scope = {};
  new Function("window", code)(scope);
  return scope.PlaceholderRaspuns;
}

describe("PlaceholderRaspuns — contractul semnului de raspuns", () => {
  it("expune o singura clasa, aceeasi pentru toate quizurile", () => {
    const PR = incarca();
    assert.equal(PR.CLASA, "placeholder-pt-raspuns");
    assert.equal(PR.creeaza("?").clasa, PR.CLASA);
    assert.equal(PR.creeaza("_").clasa, PR.CLASA);
  });

  it("construieste marcajul cu semnul primit ca argument", () => {
    const PR = incarca();
    assert.equal(
      PR.creeaza("?").marcaj(),
      '<span class="placeholder-pt-raspuns">?</span>'
    );
    assert.equal(
      PR.creeaza("_").marcaj(),
      '<span class="placeholder-pt-raspuns">_</span>'
    );
  });

  it("refuza un semn lipsa sau gol, in loc sa presupuna \"?\"", () => {
    const PR = incarca();
    assert.throws(() => PR.creeaza(), /semn/);
    assert.throws(() => PR.creeaza(""), /semn/);
    assert.throws(() => PR.creeaza(null), /semn/);
  });

  it("gaseste si marcheaza placeholderul intr-un prompt-text", () => {
    const PR = incarca();
    const p = PR.creeaza("?");
    assert.equal(p.are("10=?+5"), true);
    assert.equal(p.are("10=7+5"), false);
    assert.equal(
      p.marcheaza("10=?+5"),
      '10=<span class="placeholder-pt-raspuns">?</span>+5'
    );
  });

  it("inlocuieste placeholderul si cu text simplu, si cu HTML", () => {
    const PR = incarca();
    const p = PR.creeaza("?");
    assert.equal(p.inlocuieste("10=?+5", "5"), "10=5+5");
    assert.equal(
      p.inlocuieste("10=?+5", '<span class="q-correct">5</span>'),
      '10=<span class="q-correct">5</span>+5'
    );
  });

  it("trateaza semnul ca text, nu ca expresie regulata", () => {
    const PR = incarca();
    // "?" si "*" sunt metacaractere de regex. Un `replace` cu regex neescapat
    // ar arunca sau ar potrivi altceva; contractul foloseste split/join.
    assert.equal(PR.creeaza("?").inlocuieste("a?b", "X"), "aXb");
    assert.equal(PR.creeaza("*").inlocuieste("a*b", "X"), "aXb");
    assert.equal(PR.creeaza("*").are("a*b"), true);
  });

  it("marcheaza si inlocuieste dupa aceeasi regula (nu diverg)", () => {
    const PR = incarca();
    const p = PR.creeaza("?");
    // Inainte de contract, afisarea marca TOATE aparitiile, iar revelarea o
    // inlocuia doar pe prima — doua raspunsuri diferite la aceeasi intrebare.
    const text = "?+?";
    assert.equal(p.marcheaza(text).split("placeholder-pt-raspuns").length - 1, 2);
    assert.equal(p.inlocuieste(text, "1"), "1+1");
  });
});
