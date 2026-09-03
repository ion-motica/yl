// Testeaza STRICT contractul de partajare (getSharedConfig / getSharedLink /
// applySharedConfig) din js/quizzes/tabla-inmultirii-tabel.js — cerere user,
// 03.09.2026: buton CP-General "Genereaza link la quizul curent cu parametrii
// curenti si copy in clipboard". Nu testeaza restul quizului (fara suita
// dedicata pana acum) — doar noua functionalitate.
//
// `shared` in applySharedConfig vine mereu dintr-un URL, deci e input
// netrusted prin definitie (userul poate edita manual query string-ul, sau
// linkul poate fi generat de cineva rau intentionat). Testele de mai jos
// verifica exact disciplina de validare ceruta explicit de user ("anticipeaza
// securitate pt server side, ca sa fii obligat sa tii seama de ea cand
// adaugam server side"): fiecare camp trebuie sa cada pe o valoare sigura,
// niciodata sa fie asignat brut sau sa arunce o exceptie neprinsa.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, test } from "node:test";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  new Function("window", `${code}\n`)(globalThis);
}

function loadQuiz() {
  globalThis.window = globalThis;
  loadScript("js/utils.js");
  loadScript("js/placeholder-raspuns.js");
  loadScript("js/schimbare-de-nivel.js");
  loadScript("js/layout-config.js");
  loadScript("js/motor-optiuni-control-panel.js");
  loadScript("js/fact-catalog.js");
  loadScript("js/fact-stats.js");
  loadScript("js/fact-store.js");
  loadScript("js/progress-display.js");
  loadScript("js/quiz-registry.js");
  loadScript("js/subquiz/item-generator.js");
  loadScript("js/subquiz/subquiz-definition.js");
  loadScript("js/subquiz/subquiz-orchestrator.js");
  loadScript("js/motor-3-butoane.js");
  loadScript("js/quizzes/tabla-inmultirii-tabel.js");
}

function decodeBase64Url(value) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

// Storage in-memory, simplu si functional — acelasi tipar ca in
// tests/fact-store.test.js. Necesar pt. ca getMutareColoaneMod/
// scrieMutareColoaneMod etc. trec prin LayoutConfig (localStorage) — fara
// storage real, orice "scriere" ar fi un no-op silentios (optional
// chaining), iar citirea urmatoare ar cadea mereu pe valoarea implicita,
// mascand exact validarea pe care vrem sa o testam.
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

function createQuiz() {
  loadQuiz();
  globalThis.GameUtils.shuffle = (items) => [...items];
  globalThis.FactStore.resetAll();
  return globalThis.QuizRegistry.get("tabla-inmultirii-tabel").create();
}

beforeEach(() => {
  delete globalThis.GameUtils;
  delete globalThis.ProgressDisplay;
  delete globalThis.QuizRegistry;
  delete globalThis.FactCatalog;
  delete globalThis.FactStore;
  delete globalThis.Motor3Butoane;
  delete globalThis.ItemGenerator;
  delete globalThis.SubquizDefinition;
  delete globalThis.SubquizOrchestrator;
  delete globalThis.LayoutConfig;
  delete globalThis.MotorOptiuniControlPanel;
  delete globalThis.location;
  globalThis.localStorage = creazaStorageFunctional();
  // Cateva scrie*() ating direct DOM-ul deja randat (document.getElementById,
  // vezi comentariul din tabla-inmultirii-tabel.js) — in Node nu exista deloc
  // `document`. In browser real elementele exista mereu la runtime; aici
  // stub minimal, `null` peste tot, e suficient (codul deja verifica `if
  // (rand) ...` inainte sa foloseasca rezultatul).
  globalThis.document = { getElementById: () => null };
});

test("getSharedConfig reflecta starea implicita (nivel 2, rocada, adunare inactiva)", () => {
  const quiz = createQuiz();

  const cfg = quiz.getSharedConfig();

  assert.equal(cfg.v, 1);
  assert.equal(cfg.nivel, 2);
  assert.equal(cfg.mutareColoane, "rocada");
  assert.equal(typeof cfg.rocadaDurataS, "number");
  assert.equal(cfg.adunareActiva, false);
});

test("getSharedLink produce un URL cu quiz si cfg (base64url) decodabil la exact configul curent", () => {
  const quiz = createQuiz();
  quiz.switchLevel(6);

  const link = quiz.getSharedLink("http://localhost/index.html");
  const url = new URL(link);

  assert.equal(url.searchParams.get("quiz"), "tabla-inmultirii-tabel");
  const cfgRaw = url.searchParams.get("cfg");
  assert.ok(cfgRaw, "lipseste parametrul cfg");

  const cfgDecodat = JSON.parse(decodeBase64Url(cfgRaw));
  assert.deepEqual(cfgDecodat, quiz.getSharedConfig());
  assert.equal(cfgDecodat.nivel, 6);
});

test("applySharedConfig cu date valide seteaza nivel, mod, durata si adunareActiva", () => {
  const quiz = createQuiz();

  const ok = quiz.applySharedConfig({
    v: 1,
    nivel: 7,
    mutareColoane: "alternareF2",
    alternareF2DurataS: 2.3,
    adunareActiva: true,
  });

  assert.equal(ok, true);
  const cfg = quiz.getSharedConfig();
  assert.equal(cfg.nivel, 7);
  assert.equal(cfg.mutareColoane, "alternareF2");
  assert.equal(cfg.alternareF2DurataS, 2.3);
  assert.equal(cfg.adunareActiva, true);
  assert.equal(quiz.getLevel(), 7);
});

test("applySharedConfig respinge un shared care nu e obiect (null, array, string, numar) fara sa arunce", () => {
  const quiz = createQuiz();

  for (const valoareInvalida of [null, [1, 2, 3], "cfg malitios", 42]) {
    assert.doesNotThrow(() => {
      const rezultat = quiz.applySharedConfig(valoareInvalida);
      assert.equal(rezultat, false);
    });
  }
});

test("applySharedConfig() fara argument (undefined) NU arunca — foloseste parametrul implicit {}, cade pe valori sigure", () => {
  const quiz = createQuiz();

  assert.doesNotThrow(() => {
    const rezultat = quiz.applySharedConfig();
    assert.equal(rezultat, true);
  });
  assert.equal(quiz.getLevel(), 2);
  assert.equal(quiz.getSharedConfig().mutareColoane, "rocada");
});

test("applySharedConfig clampeaza un nivel absurd la limitele MIN/MAX in loc sa-l asigneze brut", () => {
  const quiz = createQuiz();

  quiz.applySharedConfig({ nivel: 999, mutareColoane: "rocada" });
  assert.equal(quiz.getLevel(), quiz.getMaxLevel());

  quiz.applySharedConfig({ nivel: -50, mutareColoane: "rocada" });
  assert.equal(quiz.getLevel(), quiz.getMinLevel());
});

test("applySharedConfig cade pe LEVEL_IMPLICIT cand nivelul nu e un numar (string, NaN, obiect)", () => {
  const quiz = createQuiz();

  for (const nivelInvalid of ["abia", NaN, {}, "<script>alert(1)</script>", undefined]) {
    quiz.switchLevel(9); // starea dinainte, ca sa fim siguri ca s-a schimbat ceva
    quiz.applySharedConfig({ nivel: nivelInvalid, mutareColoane: "rocada" });
    assert.equal(quiz.getLevel(), 2, `nivel invalid ${JSON.stringify(nivelInvalid)} n-a cazut pe implicit`);
  }
});

test("applySharedConfig respinge un mod 'mutareColoane' necunoscut/malitios, cade pe implicitul rocada", () => {
  const quiz = createQuiz();

  for (const modInvalid of ["<script>alert(1)</script>", "modNecunoscut", "__proto__", 123, null]) {
    const ok = quiz.applySharedConfig({ nivel: 3, mutareColoane: modInvalid });
    assert.equal(ok, true);
    assert.equal(quiz.getSharedConfig().mutareColoane, "rocada");
  }
});

test("applySharedConfig clampeaza durata absurda (negativa sau uriasa) in intervalul valid [0,5]", () => {
  const quiz = createQuiz();

  quiz.applySharedConfig({ nivel: 3, mutareColoane: "toateEqFormsOriceRol", toateEqFormsOriceRolDurataS: 99999 });
  assert.ok(quiz.getSharedConfig().toateEqFormsOriceRolDurataS <= 5);

  quiz.applySharedConfig({ nivel: 3, mutareColoane: "toateEqFormsOriceRol", toateEqFormsOriceRolDurataS: -80 });
  assert.ok(quiz.getSharedConfig().toateEqFormsOriceRolDurataS >= 0);
});

test("applySharedConfig ignora o durata non-numerica, fara sa arunce si fara sa strice modul", () => {
  const quiz = createQuiz();

  assert.doesNotThrow(() => {
    quiz.applySharedConfig({ nivel: 4, mutareColoane: "alternareF2", alternareF2DurataS: "boom" });
  });
  assert.equal(quiz.getSharedConfig().mutareColoane, "alternareF2");
});

test("applySharedConfig forteaza adunareActiva la boolean, indiferent ce tip vine din URL", () => {
  const quiz = createQuiz();

  quiz.applySharedConfig({ nivel: 2, mutareColoane: "rocada", adunareActiva: "orice string truthy" });
  assert.equal(quiz.getSharedConfig().adunareActiva, true);

  quiz.applySharedConfig({ nivel: 2, mutareColoane: "rocada", adunareActiva: 0 });
  assert.equal(quiz.getSharedConfig().adunareActiva, false);
});

test("round-trip: getSharedConfig -> applySharedConfig pe alt quiz reproduce exact aceeasi configuratie", () => {
  const quizSursa = createQuiz();
  quizSursa.switchLevel(5);
  quizSursa.applySharedConfig({
    nivel: 5,
    mutareColoane: "toateEqFormsFaraNrTabla",
    toateEqFormsFaraNrTablaDurataS: 1.2,
    adunareActiva: true,
  });
  const cfgSursa = quizSursa.getSharedConfig();

  const quizTinta = createQuiz();
  quizTinta.applySharedConfig(cfgSursa);

  assert.deepEqual(quizTinta.getSharedConfig(), cfgSursa);
});
