// Teste STRICT pe logica motorului (citesteConfig/aplicaConfig/
// campNivelStandard) — nu pe construiesteDOM (DOM real, verificat separat
// prin Playwright, la fel ca restul proiectului; nicaieri in tests/ nu se
// foloseste jsdom, vezi grep). shared vine mereu dintr-un URL netrusted —
// testele verifica exact disciplina de validare: fiecare tip de camp cade pe
// o valoare sigura, niciodata pe input brut, niciodata nu arunca.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, test } from "node:test";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadMotor() {
  globalThis.window = globalThis;
  const code = readFileSync(join(rootDir, "js/motor-optiuni-control-panel.js"), "utf8");
  new Function("window", `${code}\n`)(globalThis);
  return globalThis.MotorOptiuniControlPanel;
}

beforeEach(() => {
  delete globalThis.MotorOptiuniControlPanel;
});

function campBifa(valoareInitiala = false) {
  let v = valoareInitiala;
  return { cheie: "activ", tip: "bifa", eticheta: "Activ", get: () => v, set: (x) => (v = x) };
}

function campCuloare(valoareInitiala = "#ff0000") {
  let v = valoareInitiala;
  return { cheie: "culoare", tip: "culoare", eticheta: "Culoare", get: () => v, set: (x) => (v = x) };
}

function campEnum(valoareInitiala = "rocada") {
  let v = valoareInitiala;
  return {
    cheie: "mod",
    tip: "enum",
    eticheta: "Mod",
    optiuni: [
      { valoare: "rocada", text: "Rocada" },
      { valoare: "alternareF2", text: "Alternare" },
    ],
    get: () => v,
    set: (x) => (v = x),
  };
}

function campNumar(valoareInitiala = 2, overrides = {}) {
  let v = valoareInitiala;
  return {
    cheie: "durata",
    tip: "numar",
    eticheta: "Durata",
    min: 0,
    max: 5,
    pas: 0.1,
    zecimale: 1,
    get: () => v,
    set: (x) => (v = x),
    ...overrides,
  };
}

function campSet(valoareInitiala = ["factor"], overrides = {}) {
  let v = valoareInitiala;
  return {
    cheie: "surse",
    tip: "set",
    eticheta: "Surse",
    optiuni: [
      { valoare: "factor", text: "factor" },
      { valoare: "produs", text: "produs" },
    ],
    minSelectate: 1,
    get: () => v,
    set: (x) => (v = x),
    ...overrides,
  };
}

test("citesteConfig citeste valoarea curenta a fiecarui camp, cheiat dupa camp.cheie", () => {
  const motor = loadMotor();
  const campuri = [campBifa(true), campEnum("alternareF2"), campNumar(3.2)];

  assert.deepEqual(motor.citesteConfig(campuri), { activ: true, mod: "alternareF2", durata: 3.2 });
});

test("aplicaConfig respinge un shared care nu e obiect, fara sa arunce, fara sa modifice campurile", () => {
  const motor = loadMotor();
  const bifa = campBifa(false);

  for (const invalid of [null, [1, 2], "text", 42]) {
    assert.doesNotThrow(() => {
      const rezultat = motor.aplicaConfig([bifa], invalid);
      assert.equal(rezultat, false);
    });
  }
  assert.equal(bifa.get(), false);
});

test("aplicaConfig() fara argument foloseste {} implicit, nu arunca, nu schimba nimic", () => {
  const motor = loadMotor();
  const bifa = campBifa(true);

  assert.doesNotThrow(() => motor.aplicaConfig([bifa]));
  assert.equal(bifa.get(), true);
});

test("aplicaConfig ignora o cheie absenta din shared — camp.set nu e apelat", () => {
  const motor = loadMotor();
  let apelat = false;
  const camp = { cheie: "x", tip: "bifa", get: () => false, set: () => (apelat = true) };

  motor.aplicaConfig([camp], { altaCheie: true });
  assert.equal(apelat, false);
});

test("tip bifa: orice valoare devine boolean prin Boolean()", () => {
  const motor = loadMotor();
  const bifa = campBifa(false);

  motor.aplicaConfig([bifa], { activ: "orice string truthy" });
  assert.equal(bifa.get(), true);

  motor.aplicaConfig([bifa], { activ: 0 });
  assert.equal(bifa.get(), false);

  motor.aplicaConfig([bifa], { activ: null });
  assert.equal(bifa.get(), false);
});

test("tip culoare: hex valid trece, orice altceva cade pe valoarea curenta", () => {
  const motor = loadMotor();
  const culoare = campCuloare("#112233");

  motor.aplicaConfig([culoare], { culoare: "#abcdef" });
  assert.equal(culoare.get(), "#abcdef");

  for (const invalid of ["<script>alert(1)</script>", "red", "#zzz", "#12345", 123, null]) {
    const inainte = culoare.get();
    motor.aplicaConfig([culoare], { culoare: invalid });
    assert.equal(culoare.get(), inainte, `culoare invalida acceptata: ${JSON.stringify(invalid)}`);
  }
});

test("tip enum: valoare din lista de optiuni trece, valoare necunoscuta cade pe fallback", () => {
  const motor = loadMotor();
  const modEnum = campEnum("rocada");

  motor.aplicaConfig([modEnum], { mod: "alternareF2" });
  assert.equal(modEnum.get(), "alternareF2");

  for (const invalid of ["<script>alert(1)</script>", "modNecunoscut", "__proto__", 123, null]) {
    motor.aplicaConfig([modEnum], { mod: invalid });
    assert.equal(modEnum.get(), "alternareF2", `mod invalid acceptat: ${JSON.stringify(invalid)}`);
  }
});

test("tip enum: cu camp.implicit declarat, valoare necunoscuta cade pe implicit (nu pe get())", () => {
  const motor = loadMotor();
  const modEnum = campEnum("alternareF2");
  modEnum.implicit = "rocada";

  motor.aplicaConfig([modEnum], { mod: "necunoscut" });
  assert.equal(modEnum.get(), "rocada");
});

test("tip numar: valoare in interval trece si e rotunjita la zecimale", () => {
  const motor = loadMotor();
  const numar = campNumar(1);

  motor.aplicaConfig([numar], { durata: 2.34 });
  assert.equal(numar.get(), 2.3);
});

test("tip numar: clampeaza in afara [min,max] in loc sa asigneze brut", () => {
  const motor = loadMotor();
  const numar = campNumar(1);

  motor.aplicaConfig([numar], { durata: 99999 });
  assert.equal(numar.get(), 5);

  motor.aplicaConfig([numar], { durata: -80 });
  assert.equal(numar.get(), 0);
});

test("tip numar: non-numeric (NaN, string, obiect) cade pe valoarea curenta, fara sa arunce", () => {
  const motor = loadMotor();
  const numar = campNumar(2.5);

  for (const invalid of ["abia", NaN, {}, "<script>alert(1)</script>", undefined]) {
    assert.doesNotThrow(() => motor.aplicaConfig([numar], { durata: invalid }));
    assert.equal(numar.get(), 2.5, `valoare non-numerica acceptata: ${JSON.stringify(invalid)}`);
  }
});

test("tip set: filtreaza doar valorile din optiuni, elimina restul", () => {
  const motor = loadMotor();
  const set = campSet(["factor"]);

  motor.aplicaConfig([set], { surse: ["produs", "valoareNecunoscuta", "<script>"] });
  assert.deepEqual(set.get(), ["produs"]);
});

test("tip set: sub minSelectate cade pe valoarea curenta, niciodata array gol", () => {
  const motor = loadMotor();
  const set = campSet(["factor", "produs"]);

  motor.aplicaConfig([set], { surse: ["valoareNecunoscuta"] }); // ar ramane 0 elemente valide
  assert.deepEqual(set.get(), ["factor", "produs"]);

  motor.aplicaConfig([set], { surse: [] });
  assert.deepEqual(set.get(), ["factor", "produs"]);
});

test("tip set: non-array cade pe valoarea curenta, fara sa arunce", () => {
  const motor = loadMotor();
  const set = campSet(["factor"]);

  assert.doesNotThrow(() => motor.aplicaConfig([set], { surse: "factor" }));
  assert.deepEqual(set.get(), ["factor"]);
});

test("campNivelStandard leaga cheie/get/set/min/max la API-ul quizului si e exclus din DOM", () => {
  const motor = loadMotor();
  let nivelIntern = 2;
  const quizFals = {
    getLevel: () => nivelIntern,
    switchLevel: (n) => {
      nivelIntern = Math.min(10, Math.max(1, n));
    },
    getMinLevel: () => 1,
    getMaxLevel: () => 10,
  };

  const camp = motor.campNivelStandard(quizFals);

  assert.equal(camp.cheie, "nivel");
  assert.equal(camp.tip, "numar");
  assert.equal(camp.inDOM, false);
  assert.equal(camp.get(), 2);

  motor.aplicaConfig([camp], { nivel: 7 });
  assert.equal(nivelIntern, 7);

  motor.aplicaConfig([camp], { nivel: 999 });
  assert.equal(nivelIntern, 10);
});

test("campSubquizStart adauga '----' ca prima optiune si o leaga de prima optiune reala a quizului", () => {
  const motor = loadMotor();
  let selectat = "normal";
  const quizFals = {
    getSubquizStartOptions: () => [
      { id: "normal", label: "Normal" },
      { id: "sq3", label: "SQ3" },
    ],
    getSubquizStartOption: () => selectat,
    setSubquizStartOption: (id) => {
      selectat = id;
      return true;
    },
  };

  const camp = motor.campSubquizStart(quizFals);

  assert.equal(camp.cheie, "subquizStart");
  assert.equal(camp.tip, "enum");
  assert.deepEqual(
    camp.optiuni.map((o) => o.valoare),
    ["----", "sq3"],
    "'normal' nu se mai afiseaza separat — '----' il reprezinta deja"
  );
  assert.equal(camp.get(), "----", "prima optiune reala (normal) trebuie afisata ca '----'");

  camp.set("sq3");
  assert.equal(selectat, "sq3");
  assert.equal(camp.get(), "sq3");

  camp.set("----");
  assert.equal(selectat, "normal", "'----' trebuie sa aplice prima optiune reala, nu un string literal");
  assert.equal(camp.get(), "----");
});

test("campSubquizStart functioneaza generic si la un quiz cu o singura optiune reala (fara 'normal')", () => {
  const motor = loadMotor();
  const quizFals = {
    getSubquizStartOptions: () => [{ id: "base", label: "1 baza" }],
    getSubquizStartOption: () => "base",
    setSubquizStartOption: (id) => id === "base",
  };

  const camp = motor.campSubquizStart(quizFals);

  assert.deepEqual(
    camp.optiuni.map((o) => o.valoare),
    ["----"],
    "singura optiune reala (base) e chiar valoarea neutra — nu se afiseaza separat"
  );
  assert.equal(camp.get(), "----", "singura optiune reala e implicit neutra, deci '----'");
});

test("campSubquizStart: round-trip prin citesteConfig/aplicaConfig pastreaza o selectie reala explicita", () => {
  const motor = loadMotor();
  let selectat = "sq3";
  const quizFals = {
    getSubquizStartOptions: () => [
      { id: "normal", label: "Normal" },
      { id: "sq3", label: "SQ3" },
    ],
    getSubquizStartOption: () => selectat,
    setSubquizStartOption: (id) => {
      selectat = id;
      return true;
    },
  };

  const camp = motor.campSubquizStart(quizFals);
  const config = motor.citesteConfig([camp]);
  assert.equal(config.subquizStart, "sq3");

  selectat = "normal";
  motor.aplicaConfig([camp], config);
  assert.equal(selectat, "sq3", "aplicaConfig trebuie sa restaureze exact subquizul din link");
});

test("round-trip: citesteConfig -> aplicaConfig pe un al doilea set de campuri reproduce exact aceleasi valori", () => {
  const motor = loadMotor();
  const sursa = [campBifa(true), campEnum("alternareF2"), campNumar(3.2), campSet(["produs"]), campCuloare("#abcdef")];
  const configSursa = motor.citesteConfig(sursa);

  const tinta = [campBifa(false), campEnum("rocada"), campNumar(0), campSet(["factor"]), campCuloare("#000000")];
  motor.aplicaConfig(tinta, configSursa);

  assert.deepEqual(motor.citesteConfig(tinta), configSursa);
});

test("construiesteDOM arunca pe un tip de camp necunoscut, in loc sa il ignore silentios", () => {
  const motor = loadMotor();
  const mount = { replaceChildren: () => {} };

  assert.throws(() => {
    motor.construiesteDOM(mount, [{ cheie: "x", tip: "nu-exista", get: () => null }]);
  });
});
