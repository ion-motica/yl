// InventarBonduri (js/bond-inventory.js) — modul nou, 29.08.2026, cerere user:
// inventar bonds pt. cele 2 quizuri Singapore (addition-table-singapore si
// addition-table-singapore-missing). Testele astea acopera modulul izolat,
// fara sa treaca prin niciun quiz (functii pure).
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadModule() {
  globalThis.window = globalThis;
  const code = readFileSync(join(rootDir, "js/bond-inventory.js"), "utf8");
  new Function("window", `${code}\n`)(globalThis);
  return globalThis.InventarBonduri;
}

describe("bond-inventory (InventarBonduri)", () => {
  let InventarBonduri;
  before(() => {
    InventarBonduri = loadModule();
  });

  it("culoareNumar: rosu (hue 0) la 0, violet (hue 270) la 10", () => {
    assert.equal(InventarBonduri.culoareNumar(0), "hsl(0, 72%, 58%)");
    assert.equal(InventarBonduri.culoareNumar(10), "hsl(270, 72%, 58%)");
  });

  it("culoareNumar: hue creste monoton intre 0 si 10 (curgerea coloristica ceruta)", () => {
    const hue = (n) => Number(InventarBonduri.culoareNumar(n).match(/^hsl\((\d+)/)[1]);
    for (let n = 0; n < 10; n += 1) {
      assert.ok(hue(n) < hue(n + 1), `hue(${n}) trebuie sa fie sub hue(${n + 1})`);
    }
  });

  it("culoareNumar: valorile in afara intervalului 0-10 se clampeaza la capete", () => {
    assert.equal(InventarBonduri.culoareNumar(-3), InventarBonduri.culoareNumar(0));
    assert.equal(InventarBonduri.culoareNumar(15), InventarBonduri.culoareNumar(10));
  });

  it("culoareNumar: aceeasi valoare produce mereu aceeasi culoare (5+5 trebuie sa arate identic)", () => {
    assert.equal(InventarBonduri.culoareNumar(5), InventarBonduri.culoareNumar(5));
  });

  it("bvPentruNivel: randuri in ordine crescatoare dupa a, un rand per bv, nerepetate", () => {
    assert.deepEqual(
      InventarBonduri.bvPentruNivel(6).map((bv) => bv.label),
      ["1+5", "2+4", "3+3", "4+2", "5+1"]
    );
    assert.equal(InventarBonduri.bvPentruNivel(3).length, 2, "nivelul 3: 1+2, 2+1");
    assert.equal(InventarBonduri.bvPentruNivel(10).length, 9, "nivelul 10: 1+9..9+1");
  });

  it("construieste: fara nimic in `rezolvate`, toate randurile sunt goale (spatiu rezervat)", () => {
    const inventar = InventarBonduri.construieste({ nivel: 4, rezolvate: [] });
    assert.equal(inventar.visible, true);
    assert.equal(inventar.nivel, 4);
    assert.equal(inventar.randuri.length, 3);
    inventar.randuri.forEach((rand) => {
      assert.equal(rand.rezolvat, false);
      assert.equal(rand.a, null);
      assert.equal(rand.b, null);
      assert.equal(rand.culoareA, null);
      assert.equal(rand.culoareB, null);
    });
  });

  it("construieste: randul rezolvat capata a/b si culorile corecte, restul raman goale", () => {
    const inventar = InventarBonduri.construieste({ nivel: 4, rezolvate: new Set(["2+2"]) });
    const rezolvat = inventar.randuri.find((r) => r.label === "2+2");
    assert.equal(rezolvat.rezolvat, true);
    assert.equal(rezolvat.a, 2);
    assert.equal(rezolvat.b, 2);
    assert.equal(rezolvat.culoareA, InventarBonduri.culoareNumar(2));
    assert.equal(rezolvat.culoareB, InventarBonduri.culoareNumar(2));

    const restul = inventar.randuri.filter((r) => r.label !== "2+2");
    assert.ok(restul.every((r) => r.rezolvat === false));
  });

  it("construieste: accepta atat Set cat si array simplu pt. `rezolvate`", () => {
    const dinArray = InventarBonduri.construieste({ nivel: 3, rezolvate: ["1+2"] });
    assert.equal(dinArray.randuri.find((r) => r.label === "1+2").rezolvat, true);
    assert.equal(dinArray.randuri.find((r) => r.label === "2+1").rezolvat, false);
  });

  it("randaHtml: randul nerezolvat arata \"{nivel}=\" urmat de nimic, nu gol (rectificare 30.08.2026)", () => {
    const inventar = InventarBonduri.construieste({ nivel: 4, rezolvate: [] });
    const html = InventarBonduri.randaHtml(inventar);
    assert.ok(
      html.includes(
        '<div class="inventar-bonduri-rand e-gol" data-element-div-intrebare="bv-1+3">' +
          '<span class="inventar-bonduri-semn">4=</span></div>'
      ),
      "randul nerezolvat 1+3 trebuie sa contina textul '4=' in acelasi span mic ca randurile rezolvate, nu un div gol"
    );
  });

  it("randaHtml: fiecare rand poarta data-element-div-intrebare stabil, dupa label", () => {
    const inventar = InventarBonduri.construieste({ nivel: 4, rezolvate: ["2+2"] });
    const html = InventarBonduri.randaHtml(inventar);
    assert.ok(html.includes('data-element-div-intrebare="bv-1+3"'));
    assert.ok(html.includes('data-element-div-intrebare="bv-2+2"'));
    assert.ok(html.includes('data-element-div-intrebare="bv-3+1"'));
  });

  it("elementeDivIntrebare: un {id, html} per rand, id-urile in aceeasi ordine ca randurile", () => {
    const inventar = InventarBonduri.construieste({ nivel: 4, rezolvate: ["2+2"] });
    const elemente = InventarBonduri.elementeDivIntrebare(inventar);
    assert.deepEqual(
      elemente.map((el) => el.id),
      ["bv-1+3", "bv-2+2", "bv-3+1"]
    );
  });

  it("elementeDivIntrebare: continutul unui rand e identic cu ce pune randaHtml in acelasi rand", () => {
    const inventar = InventarBonduri.construieste({ nivel: 4, rezolvate: ["2+2"] });
    const elemente = InventarBonduri.elementeDivIntrebare(inventar);

    const nerezolvat = elemente.find((el) => el.id === "bv-1+3");
    assert.equal(nerezolvat.html, '<span class="inventar-bonduri-semn">4=</span>');

    const rezolvat = elemente.find((el) => el.id === "bv-2+2");
    assert.equal(
      rezolvat.html,
      `<span class="inventar-bonduri-semn">4=</span>` +
        `<span class="inventar-bonduri-numar" style="background-color:${InventarBonduri.culoareNumar(2)}">2</span>` +
        `<span class="inventar-bonduri-semn">+</span>` +
        `<span class="inventar-bonduri-numar" style="background-color:${InventarBonduri.culoareNumar(2)}">2</span>`
    );
  });

  it("elementeDivIntrebare: [] cand nu primeste un inventar vizibil", () => {
    assert.deepEqual(InventarBonduri.elementeDivIntrebare(undefined), []);
    assert.deepEqual(InventarBonduri.elementeDivIntrebare({ visible: false }), []);
  });
});
