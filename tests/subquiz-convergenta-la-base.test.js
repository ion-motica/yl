// Test de contract (cerere user, 08.09.2026, extins acelasi 08.09.2026 —
// "UN SINGUR TRASEU"): "Orice subquiz non-base se intoarce in subquizul base
// prin push -> ... -> pop, identic pt. toate. Doar base poate decide
// terminarea nivelului/quizului." Verifica RUNTIME (nu grep static de nume de
// actiuni "pop"/"exit"): fiecare subquiz non-base activ din proiect, dus la
// propria finalizare interna, ajunge efectiv cu metadata.subquiz === "base" pe
// urmatoarea intrebare — SI, unde e posibil sa se distinga fara ambiguitate
// (vezi nota din testul "levelEnd" mai jos), prin subquizEvent.action ===
// "push" la intrare / "pop" la iesire — nu doar "nu mai e subquizul X".
//
// Domeniu: quizurile care AU subquiz-uri non-base azi — doar
// multiplication-1120-v3-train-eff-eq-forms(-jurnal) si
// multiplication-1120-v4-intensiv-multipli-234 (vezi auditul din
// conversatie: toate celelalte quizuri cu SubquizOrchestrator au un singur
// subquiz inregistrat — "base"/"tabel" — nimic de verificat acolo).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  new Function("window", `${code}\n`)(globalThis);
}

function setupLocalStorage() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

function resetGlobals() {
  delete globalThis.GameUtils;
  delete globalThis.ProgressDisplay;
  delete globalThis.QuizRegistry;
  delete globalThis.FactCatalog;
  delete globalThis.FactWindowSequencer;
  delete globalThis.ItemGenerator;
  delete globalThis.SubquizDefinition;
  delete globalThis.SubquizOrchestrator;
  delete globalThis.Motor3Butoane;
  delete globalThis.Mul1120V3TrainEffEqFormsQuiz;
  delete globalThis.Mul1120V4IntensivMultipli234Quiz;
  delete globalThis.MotorOptiuniControlPanel;
}

function setupQuizV3Jurnal() {
  resetGlobals();
  globalThis.window = globalThis;
  globalThis.alert = () => {};
  setupLocalStorage();
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
    "js/quizzes/multiplication-1120-v3-train-eff-eq-forms.js",
    "js/quizzes/multiplication-1120-v3-train-eff-eq-forms-jurnal.js",
  ].forEach(loadScript);
  globalThis.GameUtils.shuffle = (items) => [...items];
  const meta = globalThis.QuizRegistry.get("multiplication-1120-v3-train-eff-eq-forms-jurnal");
  return meta.create({ ...meta, random: () => 0 });
}

// `starePtFact` (nu doar `scorPtFact`) e ce citeste efectiv esteFluent() —
// vezi facteFluenteDomeniu() in sursa: fara el, sq5 (mod B, orice intrare)
// nu gaseste niciodata facte "fluente" si cade mereu pe ["base"]. Implicit
// "fluent" pt. toate factele — testele SQ5 de mai jos au nevoie de asta ca
// sa poata intra macar o data; SQ3 nu foloseste starePtFact, doar scorPtFact.
const FLUENTA_SURSA_SQ5 = { scorPtFact: () => 0, starePtFact: () => "fluent" };

function setupQuizV4Intensiv(fluentaSursa = { scorPtFact: () => 0 }) {
  resetGlobals();
  globalThis.window = globalThis;
  globalThis.alert = () => {};
  setupLocalStorage();
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
    fluentaSursa,
  });
}

function answerCorrect(quiz, round) {
  return quiz.onAnswer(round.correctIndex, { responseMs: 500 });
}

// Un raspuns GRESIT — orice index diferit de cel corect (motorul are mereu 3
// optiuni, indecsi 0/1/2). Nu avanseaza intrebarea, doar acumuleaza in
// state.wrongFacts (vezi baseDefinition().actiuni.dupa_turn_apasare).
function answerWrong(quiz, round) {
  const gresit = round.correctIndex === 0 ? 1 : 0;
  return quiz.onAnswer(gresit, { responseMs: 500 });
}

// Seteaza direct un camp CP prin contractul canonic creeazaCampuri(context) —
// exact traseul folosit de motor/UI (fara DOM, fara simulare de click).
function setCampValue(quiz, sectiuneId, cheie, valoare) {
  const sectiune = quiz.controlPanel.sectiuni.find((s) => s.id === sectiuneId);
  assert.ok(sectiune, `sectiunea CP "${sectiuneId}" trebuie sa existe`);
  const camp = sectiune.creeazaCampuri({}).find((c) => c.cheie === cheie);
  assert.ok(camp, `campul "${cheie}" trebuie sa existe in sectiunea "${sectiuneId}"`);
  camp.set(valoare);
}

// Ruleaza raspunsuri corecte pana cand metadata.subquiz nu mai e `dinSubquiz`
// (adica subquizul respectiv s-a incheiat singur — pop/exit intern). Garda
// opreste testul cu eroare explicita daca nu se termina intr-un numar
// rezonabil de pasi, in loc sa ruleze la infinit.
function drivePanaIese(quiz, round, dinSubquiz, maxPasi = 60) {
  let pasi = 0;
  while (round.metadata?.subquiz === dinSubquiz && pasi < maxPasi) {
    pasi += 1;
    round = answerCorrect(quiz, round);
    round = round.nextRound ?? round;
  }
  assert.ok(pasi < maxPasi, `"${dinSubquiz}" trebuia sa se incheie intr-un numar rezonabil de raspunsuri (${maxPasi})`);
  return round;
}

describe("Contract: orice subquiz non-base revine in base (nu termina level/quiz direct)", () => {
  describe("v3-jurnal (multiplication-1120-v3-train-eff-eq-forms-jurnal)", () => {
    it("SQ2 eff VBS (implicit): push -> ... -> pop -> base", () => {
      const quiz = setupQuizV3Jurnal();
      let round = quiz.beginRound();
      // SQ2_TRIGGER_EVERY_BASE_ANSWERS = 5
      for (let i = 0; i < 4; i += 1) round = answerCorrect(quiz, round);
      round = answerCorrect(quiz, round);
      round = round.nextRound ?? round;
      assert.equal(round.metadata.subquiz, "sq2EffVbs", "a 5-a intrebare corecta trebuia sa declanseze SQ2 VBS");
      assert.equal(round.subquizEvent?.action, "push", "SQ2 VBS trebuia atins prin push");

      round = drivePanaIese(quiz, round, "sq2EffVbs");
      assert.equal(round.metadata.subquiz, "base", "SQ2 VBS trebuia sa revina in base, nu sa termine nivelul direct");
      assert.equal(round.subquizEvent?.action, "pop", "revenirea din SQ2 VBS trebuia sa fie prin pop, nu prin exit");
    });

    it("SQ2 SBS (fortat prin setSq2Config): push -> ... -> pop -> base", () => {
      const quiz = setupQuizV3Jurnal();
      const res = quiz.setSq2Config({ intensiveMode: "sbs" });
      assert.deepEqual(res.rejected, [], "intensiveMode: sbs trebuia acceptat");

      let round = quiz.beginRound();
      for (let i = 0; i < 4; i += 1) round = answerCorrect(quiz, round);
      round = answerCorrect(quiz, round);
      round = round.nextRound ?? round;
      assert.equal(round.metadata.subquiz, "sq2EffSbs", "a 5-a intrebare corecta trebuia sa declanseze SQ2 SBS");
      assert.equal(round.subquizEvent?.action, "push", "SQ2 SBS trebuia atins prin push");

      round = drivePanaIese(quiz, round, "sq2EffSbs");
      assert.equal(round.metadata.subquiz, "base", "SQ2 SBS trebuia sa revina in base, nu sa termine nivelul direct");
      assert.equal(round.subquizEvent?.action, "pop", "revenirea din SQ2 SBS trebuia sa fie prin pop, nu prin exit");
    });
  });

  describe("v4-intensiv (multiplication-1120-v4-intensiv-multipli-234)", () => {
    it("SQ3 grup de factori: push -> ... -> pop -> base", () => {
      const quiz = setupQuizV4Intensiv();
      let round = quiz.beginRound();
      for (let i = 0; i < 4; i += 1) round = answerCorrect(quiz, round);
      round = answerCorrect(quiz, round);
      assert.equal(round.metadata.subquiz, "sq3FactorGroup", "a 5-a intrebare corecta trebuia sa declanseze SQ3");
      assert.equal(round.subquizEvent?.action, "push", "SQ3 trebuia atins prin push");

      round = drivePanaIese(quiz, round, "sq3FactorGroup");
      assert.equal(round.metadata.subquiz, "base", "SQ3 trebuia sa revina in base, nu sa termine nivelul direct");
      assert.equal(round.subquizEvent?.action, "pop", "revenirea din SQ3 trebuia sa fie prin pop, nu prin exit");
    });

    // UN SINGUR TRASEU (cerere user, 08.09.2026): toate cele 3 intrari ale sq5
    // (random/levelEnd/levelStart) folosesc acum EXACT acelasi mecanism tehnic
    // — push la intrare, pop generic la iesire, niciodata o pozitie de ruta
    // statica separata (vezi maybeEnterSq5Random / maybeEnterSq5LevelEndFinale
    // / maybeEnterSq5LevelStart si createOrchestrator/beginRoute in sursa).
    // Fiecare din cele 3 teste de mai jos verifica RUNTIME (subquizEvent.action,
    // nu grep static) exact acest lucru pt. propria ei intrare.
    it("SQ5 Fluent party, intrare 'random': push -> ... -> pop -> base (dupa epuizarea bugetului sq3)", () => {
      // De ce nu raspundem pur si simplu corect de multe ori: declansatorul
      // "random" verifica intai sq3 la fiecare punct eligibil (dupaRaspunsCorect
      // incearca maybeEnterSq3 inaintea lui maybeEnterSq5Random) — cat timp sq3
      // mai are buget (SQ3_MAX_PER_LEVEL=3), il consuma mereu el primul. Iar
      // declansatorul "a 5-a intrebare corecta" cere prea multe facte acoperite
      // de baza intre excursii ca sq3 sa apuce sa epuizeze bugetul INAINTE ca
      // nivelul intreg (20 facte) sa se acopere — verificat empiric (script de
      // diagnostic): cu acel declansator, nivelul se incheie dupa doar 2
      // excursii sq3, bugetul de 3 nu se epuizeaza niciodata, deci sq5-random
      // n-ar apuca sa se declanseze deloc.
      // De-aia folosim declansatorul "doua raspunsuri gresite" (mult mai ieftin
      // in facte-acoperite: doar 1 raspuns corect pe ciclu, nu 5) — verificat
      // empiric ca dupa exact 3 astfel de cicluri (3 excursii sq3 reale), al
      // 4-lea ciclu gaseste bugetul sq3 epuizat si cade pe sq5-random, care se
      // declanseaza imediat (sq5RandomTargetK=1, determinist cu random:()=>0).
      const quiz = setupQuizV4Intensiv(FLUENTA_SURSA_SQ5);
      setCampValue(quiz, "sq5FluentParty", "sq5Entry", "random");

      let round = quiz.beginRound();
      let cicluri = 0;
      while (round.metadata?.subquiz === "base" && cicluri < 15) {
        cicluri += 1;
        quiz.onAnswer(round.correctIndex === 0 ? 1 : 0, { responseMs: 500 });
        quiz.onAnswer(round.correctIndex === 0 ? 1 : 0, { responseMs: 500 });
        round = answerCorrect(quiz, round);
        round = round.nextRound ?? round;
        if (round.metadata?.subquiz === "sq3FactorGroup") {
          round = drivePanaIese(quiz, round, "sq3FactorGroup");
        }
      }
      assert.equal(
        round.metadata?.subquiz,
        "sq5FluentParty",
        `dupa epuizarea bugetului sq3 (in ${cicluri} cicluri), urmatorul declansator trebuia sa cada pe sq5 (random)`
      );
      assert.equal(round.subquizEvent?.action, "push", "sq5 (random) trebuia atins prin push");

      round = drivePanaIese(quiz, round, "sq5FluentParty", 300);
      assert.equal(round.metadata?.subquiz, "base", "sq5 (random) trebuia sa predea controlul catre base");
      assert.equal(round.subquizEvent?.action, "pop", "revenirea din sq5 (random) trebuia sa fie prin pop, nu prin exit");
    });

    it("SQ5 Fluent party, intrare 'levelStart': push -> ... -> pop -> base (nu mai e pozitie de ruta statica)", () => {
      // Pana la conversia din 08.09.2026, "levelStart" era o pozitie de ruta
      // statica (activeSubquizIds [SQ5_ID,"base"]) — mecanism DIFERIT fata de
      // "random"/"levelEnd" (push/pop), desi rezultatul vizibil era acelasi.
      // Acum toate 3 folosesc identic push/pop: beginRoute() porneste intai
      // "base" (are nevoie sa fie pe stiva ca sa poata fi restaurat la pop),
      // apoi declanseaza push-ul spre sq5 INAINTE ca userul sa vada vreo
      // intrebare din base — de-aia prima runda intoarsa de beginRound() are
      // deja subquiz "sq5FluentParty" cu subquizEvent.action "push".
      const quiz = setupQuizV4Intensiv(FLUENTA_SURSA_SQ5);
      setCampValue(quiz, "sq5FluentParty", "sq5Entry", "levelStart");

      let round = quiz.beginRound();
      assert.equal(round.metadata.subquiz, "sq5FluentParty", "cu intrare levelStart, SQ5 trebuia sa fie chiar prima intrebare a nivelului");
      assert.equal(round.subquizEvent?.action, "push", "sq5 (levelStart) trebuia atins prin push, nu prin pozitie de ruta statica");

      round = drivePanaIese(quiz, round, "sq5FluentParty", 300);
      assert.equal(round.metadata.subquiz, "base", "SQ5 (levelStart) trebuia sa predea controlul catre base");
      assert.equal(round.subquizEvent?.action, "pop", "revenirea din sq5 (levelStart) trebuia sa fie prin pop, nu prin exit");
      assert.equal(round.metadata?.factB, 1, "prima intrebare REALA a lui base trebuia sa fie exact prima din coada (nu una pierduta din cauza intrebarii aruncate la pornire)");
    });

    it("SQ5 Fluent party, intrare 'levelEnd': SQ5 intra prin push (nu prin pozitie de ruta), deci revenirea trece garantat prin base.onResume()", () => {
      // De ce NU verificam doar "urmatoarea intrebare dupa SQ5 e din base":
      // verificat empiric (script de diagnostic, ambele variante — cu si fara
      // fix) ca acel semnal NU distinge fixul de bug-ul vechi aici. Motivul:
      // Motor3Butoane sterge centralizat `view`-ul oricarei comenzi "pop"
      // (js/subquiz/subquiz-definition.js, comentariul de la onAnswer), deci
      // orchestratorul recurge oricum, sincron, prin base.onResume() — iar
      // cum base e deja acoperit complet cand SQ5 e impins, onResume()
      // decide mereu "exit" imediat, iar tranzitia spre nivelul urmator se
      // vede identic in ambele variante (acelasi round final, acelasi nivel).
      // Semnalul care CHIAR distinge cele doua variante e subquizEvent.action
      // la intrarea in SQ5: "push" (fix — base ramane pe stiva, revenirea e
      // garantata de acelasi mecanism deja verificat la SQ2/SQ3) vs.
      // "exit-next" (vechi — SQ5 ajuns prin pozitie de ruta, iesirea proprie
      // a lui SQ5 putea cadea direct pe routeComplete() fara base).
      const quiz = setupQuizV4Intensiv(FLUENTA_SURSA_SQ5);
      setCampValue(quiz, "sq5FluentParty", "sq5Entry", "levelEnd");

      let round = quiz.beginRound();
      let pasi = 0;
      // Acopera tot nivelul raspunzand mereu corect — base alege singur
      // urmatorul fact neacoperit; excursii SQ3 pe parcurs sunt tolerate (SQ3
      // contribuie si el la `covered`), bucla se opreste la prima tranzitie
      // in sq5FluentParty (finala).
      while (round.metadata?.subquiz !== "sq5FluentParty" && pasi < 80) {
        pasi += 1;
        round = answerCorrect(quiz, round);
        round = round.nextRound ?? round;
      }
      assert.equal(
        round.metadata?.subquiz,
        "sq5FluentParty",
        "dupa acoperirea completa a nivelului, base trebuia sa treaca in SQ5 (finala)"
      );
      assert.equal(
        round.subquizEvent?.action,
        "push",
        "SQ5 (levelEnd) trebuia sa fie ATINS prin push (base ramane pe stiva, garantand revenirea prin pop/onResume), " +
          "nu prin avansul unei rute statice (\"exit-next\") — asta era exact bug-ul: iesirea proprie a lui SQ5 " +
          "putea termina nivelul direct, fara sa mai treaca prin decizia lui base"
      );

      // Regresie: round-trip-ul complet tot functioneaza (nu se blocheaza,
      // ajunge intr-un final la o intrebare din base — a nivelului curent sau
      // a celui urmator, echivalent aici, vezi nota de mai sus).
      round = drivePanaIese(quiz, round, "sq5FluentParty", 300);
      assert.equal(round.metadata?.subquiz, "base", "dupa SQ5 (levelEnd), urmatoarea intrebare tot din base trebuie sa fie");
    });
  });

  // Mecanismul "Level 0" (fostul mod A: sq5 rula EXCLUSIV, fara "base" deloc
  // in ruta, o singura data inainte de nivelul 1) a fost eliminat complet din
  // sursa (cerere user, 08.09.2026 — "ZERO EXCEPTII"). Nu mai exista niciun
  // traseu in care sq5 sa ruleze inaintea existentei lui base.
  //
  // UN SINGUR TRASEU (cerere user, 08.09.2026, follow-up): mecanismul de
  // pozitie-de-ruta-statica pt. "levelStart" (singurul care mai supravietuia
  // din "Level 0" — activeSubquizIds [SQ5_ID,"base"]) a fost la randul lui
  // eliminat. Toate cele 3 trasee ramase (levelStart/levelEnd/random) folosesc
  // acum identic push/pop — niciun subquiz non-base nu mai are un mecanism de
  // iesire diferit de "pop" — verificat explicit mai sus, pt. fiecare, prin
  // subquizEvent.action la intrare SI la iesire (nu doar prin observarea ca
  // "urmatoarea runda e din base", care nu distinge intre mecanisme).
});
