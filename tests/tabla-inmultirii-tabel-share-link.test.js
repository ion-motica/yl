// Testeaza STRICT contractul de partajare — cerere user, 03.09.2026: buton
// CP-General "Genereaza link la quizul curent cu parametrii curenti si copy
// in clipboard", mutat pe mecanism central 04.09.2026 (nu mai exista
// quiz.getSharedConfig()/getSharedLink()/applySharedConfig() — vezi
// quiz.controlPanel + MotorOptiuniControlPanel.citesteConfig/aplicaConfig,
// exact ce ar face app.js in productie, doar fara pasul de inregistrare
// intr-un Map extern). Nu testeaza restul quizului (fara suita dedicata
// pana acum) — doar noua functionalitate.
//
// `shared` in aplicaConfig vine mereu dintr-un URL, deci e input netrusted
// prin definitie (userul poate edita manual query string-ul, sau linkul
// poate fi generat de cineva rau intentionat). Testele de mai jos verifica
// exact disciplina de validare ceruta explicit de user ("anticipeaza
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

function encodeBase64Url(text) {
  return Buffer.from(text, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Mecanismul central: citesc structura declarativă deja raportată de quiz
// prin `controlPanel`, exact ce ar face app.js in productie.
function campuriQuiz(quiz) {
  return quiz.controlPanel.sectiuni.flatMap((sectiune) => sectiune.campuri);
}

function getSharedConfig(quiz) {
  return { v: 1, ...globalThis.MotorOptiuniControlPanel.citesteConfig(campuriQuiz(quiz)) };
}

function applySharedConfig(quiz, shared) {
  return globalThis.MotorOptiuniControlPanel.aplicaConfig(campuriQuiz(quiz), shared);
}

function getSharedLink(quiz, quizId, baseHref) {
  const url = new URL(baseHref ?? "http://localhost/index.html");
  url.hash = "";
  url.search = "";
  url.searchParams.set("quiz", quizId);
  url.searchParams.set("cfg", encodeBase64Url(JSON.stringify(getSharedConfig(quiz))));
  return url.href;
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

  const cfg = getSharedConfig(quiz);

  assert.equal(cfg.v, 1);
  assert.equal(cfg.nivel, 2);
  assert.equal(cfg.mutareColoane, "rocada");
  assert.equal(typeof cfg.rocadaDurataS, "number");
  assert.equal(cfg.adunareActiva, false);
});

test("getSharedLink produce un URL cu quiz si cfg (base64url) decodabil la exact configul curent", () => {
  const quiz = createQuiz();
  quiz.switchLevel(6);

  const link = getSharedLink(quiz, "tabla-inmultirii-tabel", "http://localhost/index.html");
  const url = new URL(link);

  assert.equal(url.searchParams.get("quiz"), "tabla-inmultirii-tabel");
  const cfgRaw = url.searchParams.get("cfg");
  assert.ok(cfgRaw, "lipseste parametrul cfg");

  const cfgDecodat = JSON.parse(decodeBase64Url(cfgRaw));
  assert.deepEqual(cfgDecodat, getSharedConfig(quiz));
  assert.equal(cfgDecodat.nivel, 6);
});

test("applySharedConfig cu date valide seteaza nivel, mod, durata si adunareActiva", () => {
  const quiz = createQuiz();

  const ok = applySharedConfig(quiz, {
    v: 1,
    nivel: 7,
    mutareColoane: "alternareF2",
    alternareF2DurataS: 2.3,
    adunareActiva: true,
  });

  assert.equal(ok, true);
  const cfg = getSharedConfig(quiz);
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
      const rezultat = applySharedConfig(quiz, valoareInvalida);
      assert.equal(rezultat, false);
    });
  }
});

test("applySharedConfig() fara argument (undefined) NU arunca — foloseste parametrul implicit {}, cade pe valori sigure", () => {
  const quiz = createQuiz();

  assert.doesNotThrow(() => {
    const rezultat = applySharedConfig(quiz, undefined);
    assert.equal(rezultat, true);
  });
  assert.equal(quiz.getLevel(), 2);
  assert.equal(getSharedConfig(quiz).mutareColoane, "rocada");
});

test("applySharedConfig clampeaza un nivel absurd la limitele MIN/MAX in loc sa-l asigneze brut", () => {
  const quiz = createQuiz();

  applySharedConfig(quiz, { nivel: 999, mutareColoane: "rocada" });
  assert.equal(quiz.getLevel(), quiz.getMaxLevel());

  applySharedConfig(quiz, { nivel: -50, mutareColoane: "rocada" });
  assert.equal(quiz.getLevel(), quiz.getMinLevel());
});

test("applySharedConfig cade pe LEVEL_IMPLICIT cand nivelul nu e un numar (string, NaN, obiect)", () => {
  const quiz = createQuiz();

  for (const nivelInvalid of ["abia", NaN, {}, "<script>alert(1)</script>", undefined]) {
    quiz.switchLevel(9); // starea dinainte, ca sa fim siguri ca s-a schimbat ceva
    applySharedConfig(quiz, { nivel: nivelInvalid, mutareColoane: "rocada" });
    assert.equal(quiz.getLevel(), 2, `nivel invalid ${JSON.stringify(nivelInvalid)} n-a cazut pe implicit`);
  }
});

test("applySharedConfig respinge un mod 'mutareColoane' necunoscut/malitios, cade pe implicitul rocada", () => {
  const quiz = createQuiz();

  for (const modInvalid of ["<script>alert(1)</script>", "modNecunoscut", "__proto__", 123, null]) {
    const ok = applySharedConfig(quiz, { nivel: 3, mutareColoane: modInvalid });
    assert.equal(ok, true);
    assert.equal(getSharedConfig(quiz).mutareColoane, "rocada");
  }
});

test("applySharedConfig clampeaza durata absurda (negativa sau uriasa) in intervalul valid [0,5]", () => {
  const quiz = createQuiz();

  applySharedConfig(quiz, { nivel: 3, mutareColoane: "toateEqFormsOriceRol", toateEqFormsOriceRolDurataS: 99999 });
  assert.ok(getSharedConfig(quiz).toateEqFormsOriceRolDurataS <= 5);

  applySharedConfig(quiz, { nivel: 3, mutareColoane: "toateEqFormsOriceRol", toateEqFormsOriceRolDurataS: -80 });
  assert.ok(getSharedConfig(quiz).toateEqFormsOriceRolDurataS >= 0);
});

test("applySharedConfig ignora o durata non-numerica, fara sa arunce si fara sa strice modul", () => {
  const quiz = createQuiz();

  assert.doesNotThrow(() => {
    applySharedConfig(quiz, { nivel: 4, mutareColoane: "alternareF2", alternareF2DurataS: "boom" });
  });
  assert.equal(getSharedConfig(quiz).mutareColoane, "alternareF2");
});

test("applySharedConfig forteaza adunareActiva la boolean, indiferent ce tip vine din URL", () => {
  const quiz = createQuiz();

  applySharedConfig(quiz, { nivel: 2, mutareColoane: "rocada", adunareActiva: "orice string truthy" });
  assert.equal(getSharedConfig(quiz).adunareActiva, true);

  applySharedConfig(quiz, { nivel: 2, mutareColoane: "rocada", adunareActiva: 0 });
  assert.equal(getSharedConfig(quiz).adunareActiva, false);
});

test("round-trip: getSharedConfig -> applySharedConfig pe alt quiz reproduce exact aceeasi configuratie", () => {
  const quizSursa = createQuiz();
  quizSursa.switchLevel(5);
  applySharedConfig(quizSursa, {
    nivel: 5,
    mutareColoane: "toateEqFormsFaraNrTabla",
    toateEqFormsFaraNrTablaDurataS: 1.2,
    adunareActiva: true,
  });
  const cfgSursa = getSharedConfig(quizSursa);

  const quizTinta = createQuiz();
  applySharedConfig(quizTinta, cfgSursa);

  assert.deepEqual(getSharedConfig(quizTinta), cfgSursa);
});

// "Domeniu facts:" (dropdown CP, cerere user, 05.09.2026) — alege ATAT
// intervalul nr-tabla/nivel CAT SI intervalul factor/rand (vezi DOMENII_FACTS
// in tabla-inmultirii-tabel.js). Aceeasi disciplina de validare ca la
// "mutareColoane" mai sus: camp enum, whitelist, fallback pe implicit.
test("getSharedConfig include domeniuFacts cu domeniul implicit (1..10 - 1..10)", () => {
  const quiz = createQuiz();

  const cfg = getSharedConfig(quiz);

  assert.equal(cfg.domeniuFacts, "tabla1-10_factor1-10");
  assert.equal(quiz.getMinLevel(), 1);
  assert.equal(quiz.getMaxLevel(), 10);
});

test("applySharedConfig cu domeniuFacts valid schimba MIN/MAX_LEVEL si reclampeaza nivelul curent ramas in afara noului domeniu", () => {
  const quiz = createQuiz();
  quiz.switchLevel(3); // valid azi (domeniul implicit, 1-10)

  const ok = applySharedConfig(quiz, { domeniuFacts: "tabla11-20_factor11-20" });

  assert.equal(ok, true);
  assert.equal(quiz.getMinLevel(), 11);
  assert.equal(quiz.getMaxLevel(), 20);
  // 3 nu mai e valid in noul domeniu (11-20) — reclampat la MIN_LEVEL, la fel
  // ca la un buton de nivel/switchLevel cu o valoare sub interval.
  assert.equal(quiz.getLevel(), 11);
});

test("applySharedConfig respinge un domeniuFacts necunoscut/malitios, cade pe domeniul implicit", () => {
  const quiz = createQuiz();

  for (const domeniuInvalid of ["<script>alert(1)</script>", "domeniuNecunoscut", "__proto__", 123, null]) {
    const ok = applySharedConfig(quiz, { domeniuFacts: domeniuInvalid });
    assert.equal(ok, true);
    assert.equal(getSharedConfig(quiz).domeniuFacts, "tabla1-10_factor1-10");
  }
});

test("round-trip cu domeniul schimbat efectiv reproduce acelasi domeniu si acelasi MIN/MAX_LEVEL pe alt quiz", () => {
  const quizSursa = createQuiz();
  applySharedConfig(quizSursa, { domeniuFacts: "tabla1-10_factor11-20" });
  const cfgSursa = getSharedConfig(quizSursa);

  const quizTinta = createQuiz();
  applySharedConfig(quizTinta, cfgSursa);

  assert.deepEqual(getSharedConfig(quizTinta), cfgSursa);
  assert.equal(quizTinta.getMinLevel(), quizSursa.getMinLevel());
  assert.equal(quizTinta.getMaxLevel(), quizSursa.getMaxLevel());
});

// Breșă cunoscuta, acceptata deliberat (gasita la scriere, nu ascunsa):
// campNivelStandard() (motor-optiuni-control-panel.js) capteaza min/max o
// SINGURA data, la construirea array-ului de campuri — nu le reciteste live
// in timpul aplicaConfig(). Un link care schimba DEODATA domeniuFacts SI
// nivel intr-un singur apply nu poate obtine exact nivelul cerut daca acesta
// depaseste domeniul VECHI (dinainte de switch) — cade pe marginea domeniului
// vechi, apoi e reclampat de switchLevel() in domeniul nou. Testul de mai jos
// blocheaza exact acest comportament curent (sigur, dar nu "exact"), ca sa nu
// devina silentios si mai gresit la o schimbare viitoare a motorului CP.
test("applySharedConfig cu domeniuFacts + nivel in ACELASI apply: nivelul cade pe marginea domeniului VECHI, nu pe cel cerut (limitare cunoscuta)", () => {
  const quiz = createQuiz(); // domeniul implicit: 1-10

  applySharedConfig(quiz, { domeniuFacts: "tabla11-20_factor11-20", nivel: 15 });

  // Cerinta ar fi nivel 15 (valid in noul domeniu 11-20), dar camp-ul "nivel"
  // a clampat deja 15 dupa min/max VECHI (1-10, capturate inainte de switch)
  // inainte ca switchLevel sa mai apuce sa-l reclampeze in noul domeniu.
  assert.equal(quiz.getMinLevel(), 11);
  assert.equal(quiz.getMaxLevel(), 20);
  assert.equal(quiz.getLevel(), 11);
});
