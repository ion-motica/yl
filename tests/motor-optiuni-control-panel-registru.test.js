// Testeaza mecanismul central de inregistrare CP (cerere user, 04.09.2026):
// MotorOptiuniControlPanel.inregistreazaControlPanel/obtineSectiuniCP/
// toateCampurileCP — contractul PUBLIC si rezultatul, nu structura interna.
// Nu testeaza butonul din app.js direct (fisier legat strans de DOM, fara
// jsdom in proiect) — dar app.js e un wrapper subtire peste exact aceste 3
// functii + citesteConfig/aplicaConfig, acoperite integral aici si in
// tests/motor-optiuni-control-panel.test.js.
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

function loadMotor() {
  globalThis.window = globalThis;
  loadScript("js/motor-optiuni-control-panel.js");
  return globalThis.MotorOptiuniControlPanel;
}

// Incarca quizul REAL multiplication-1120-v4 (nu un dublu sintetic) — acelasi
// tipar ca tests/multiplication-1120-v4-intensiv-multipli-234.test.js, plus
// motor-optiuni-control-panel.js (testul acela nu are nevoie de el, noi da).
function loadMotorSiQuizV4() {
  globalThis.window = globalThis;
  globalThis.alert = () => {};
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  [
    "js/utils.js",
    "js/placeholder-raspuns.js",
    "js/schimbare-de-nivel.js",
    "js/progress-display.js",
    "js/quiz-registry.js",
    "js/motor-optiuni-control-panel.js",
    "js/fact-catalog.js",
    "js/fact-window-sequencer.js",
    "js/eff/qf-generator.js",
    "js/subquiz/item-generator.js",
    "js/subquiz/subquiz-definition.js",
    "js/subquiz/subquiz-orchestrator.js",
    "js/motor-3-butoane.js",
    "js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js",
  ].forEach(loadScript);
  globalThis.GameUtils.shuffle = (items) => [...items];
  return globalThis.Mul1120V4IntensivMultipli234Quiz.create({
    random: () => 0,
    fluentaSursa: { scorPtFact: () => 0 },
  });
}

beforeEach(() => {
  delete globalThis.MotorOptiuniControlPanel;
  delete globalThis.QuizRegistry;
  delete globalThis.GameUtils;
  delete globalThis.ProgressDisplay;
  delete globalThis.FactCatalog;
  delete globalThis.ItemGenerator;
  delete globalThis.SubquizDefinition;
  delete globalThis.SubquizOrchestrator;
  delete globalThis.Motor3Butoane;
  delete globalThis.Mul1120V4IntensivMultipli234Quiz;
  delete globalThis.location;
});

// Camp declarativ minim, sintetic — pt. testele de MECANISM (nu au nevoie de
// un quiz real): A, C, D, F verifica genericitatea motorului, nu un quiz anume.
function campSintetic(cheieSuffix, valoareInitiala) {
  let valoare = valoareInitiala;
  return {
    cheie: `sintetic${cheieSuffix}`,
    tip: "numar",
    eticheta: `Sintetic ${cheieSuffix}`,
    min: 0,
    max: 1000,
    get: () => valoare,
    set: (v) => (valoare = v),
  };
}

test("A — quiz cu o singura sectiune: inregistrat + citit produce configuratia curenta", () => {
  const motor = loadMotor();
  const camp = campSintetic("A", 5);

  motor.inregistreazaControlPanel("quiz-o-sectiune", {
    sectiuni: [{ id: "principal", campuri: [camp] }],
  });

  const campuri = motor.toateCampurileCP("quiz-o-sectiune");
  assert.deepEqual(motor.citesteConfig(campuri), { sinteticA: 5 });
});

test("B — quiz cu doua sectiuni (sintetic): AMBELE intra in configuratie, niciuna nu o suprascrie pe cealalta", () => {
  const motor = loadMotor();
  const campA = campSintetic("B1", 1);
  const campB = campSintetic("B2", 2);

  motor.inregistreazaControlPanel("quiz-doua-sectiuni", {
    sectiuni: [
      { id: "sectiuneA", campuri: [campA] },
      { id: "sectiuneB", campuri: [campB] },
    ],
  });

  const campuri = motor.toateCampurileCP("quiz-doua-sectiuni");
  assert.deepEqual(motor.citesteConfig(campuri), { sinteticB1: 1, sinteticB2: 2 });
});

test("B (date reale) — multiplication-1120-v4: sectiunile SQ3 si SQ5 coexista, ambele in configuratie", () => {
  const quiz = loadMotorSiQuizV4();
  const motor = globalThis.MotorOptiuniControlPanel;

  motor.inregistreazaControlPanel("multiplication-1120-v4-intensiv-multipli-234", quiz.controlPanel);

  const campuri = motor.toateCampurileCP("multiplication-1120-v4-intensiv-multipli-234");
  const chei = campuri.map((c) => c.cheie);

  assert.ok(chei.includes("sq3ShowStack"), "lipseste un camp din sectiunea SQ3");
  assert.ok(chei.includes("sq5Mode"), "lipseste un camp din sectiunea SQ5");
});

test("C — restore: registrul pastreaza descriptori vii, nu o poza a valorilor de la inregistrare", () => {
  const motor = loadMotor();
  const camp = campSintetic("C", 3);

  motor.inregistreazaControlPanel("quiz-restore", { sectiuni: [{ id: "principal", campuri: [camp] }] });

  const campuri = motor.toateCampurileCP("quiz-restore");
  const configPartajat = motor.citesteConfig(campuri);

  camp.set(999); // schimbare "din alta parte" — dovedeste ca array-ul stocat e viu
  assert.equal(motor.citesteConfig(campuri).sinteticC, 999);

  motor.aplicaConfig(campuri, configPartajat);
  assert.equal(camp.get(), 3, "aplicarea configului partajat nu a refacut valoarea originala");
});

test("D — quiz fara CP (cazul addition-table.js): nu se strica, produce lista goala", () => {
  const motor = loadMotor();

  assert.deepEqual(motor.obtineSectiuniCP("quiz-fara-cp"), []);
  assert.deepEqual(motor.toateCampurileCP("quiz-fara-cp"), []);
  assert.deepEqual(motor.citesteConfig(motor.toateCampurileCP("quiz-fara-cp")), {});

  motor.inregistreazaControlPanel("quiz-cp-gol", { sectiuni: [] });
  assert.deepEqual(motor.toateCampurileCP("quiz-cp-gol"), []);
});

test("E — formatul URL ramane compatibil: v:1, ?quiz=, ?cfg= base64url, decodabil la exact configul", () => {
  const motor = loadMotor();
  const camp = campSintetic("E", 7);
  motor.inregistreazaControlPanel("quiz-compat", { sectiuni: [{ id: "principal", campuri: [camp] }] });

  const campuri = motor.toateCampurileCP("quiz-compat");
  const config = { v: 1, ...motor.citesteConfig(campuri) };

  const url = new URL("http://localhost/index.html");
  url.searchParams.set("quiz", "quiz-compat");
  const cfgEncodat = Buffer.from(JSON.stringify(config), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  url.searchParams.set("cfg", cfgEncodat);

  assert.equal(url.searchParams.get("quiz"), "quiz-compat");
  const cfgDecodat = JSON.parse(
    Buffer.from(url.searchParams.get("cfg").replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
  );
  assert.deepEqual(cfgDecodat, config);
  assert.equal(cfgDecodat.v, 1);
});

test("F — mentenabilitate: un camp NOU, niciodata vazut de codul central, e inclus automat", () => {
  const motor = loadMotor();
  // Cheie deliberat inventata, needocumentata nicaieri central — dovedeste ca
  // motorul nu are o lista hardcodata de chei asteptate per quiz.
  const campNouNeasteptat = campSintetic("NiciodataVazutInainte12345", 42);

  motor.inregistreazaControlPanel("quiz-mentenabilitate", {
    sectiuni: [{ id: "principal", campuri: [campNouNeasteptat] }],
  });

  const config = motor.citesteConfig(motor.toateCampurileCP("quiz-mentenabilitate"));
  assert.equal(config.sinteticNiciodataVazutInainte12345, 42);
});

test("coliziune de cheie intre doua sectiuni ale ACELUIASI quiz arunca explicit, nu cade tacit pe ultimul castigator", () => {
  const motor = loadMotor();
  const campVechi = campSintetic("Coliziune", 1);
  const campNou = campSintetic("Coliziune", 2); // aceeasi cheie, deliberat

  motor.inregistreazaControlPanel("quiz-coliziune", {
    sectiuni: [
      { id: "sectiuneVeche", campuri: [campVechi] },
      { id: "sectiuneNoua", campuri: [campNou] },
    ],
  });

  assert.throws(() => motor.toateCampurileCP("quiz-coliziune"), /cheia "sinteticColiziune"/);
});

test("re-inregistrarea aceluiasi quizId suprascrie complet intrarea veche, nu o pastreaza alaturi", () => {
  const motor = loadMotor();
  const campVechi = campSintetic("Vechi", 1);
  const campNou = campSintetic("Nou", 2);

  motor.inregistreazaControlPanel("quiz-reactivat", { sectiuni: [{ id: "principal", campuri: [campVechi] }] });
  motor.inregistreazaControlPanel("quiz-reactivat", { sectiuni: [{ id: "principal", campuri: [campNou] }] });

  const campuri = motor.toateCampurileCP("quiz-reactivat");
  assert.deepEqual(motor.citesteConfig(campuri), { sinteticNou: 2 });
});
