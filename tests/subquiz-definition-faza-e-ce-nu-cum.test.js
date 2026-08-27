// Test-santinela pentru Faza E din documente de referinta/PLAN-motor-comun-raspuns.md:
// un subquiz nu mai poate da CUM (onAnswer propriu) — doar CE (esteCorect, generator,
// actiuni, mesaje). Calea comuna din subquiz-definition.js delegă integral catre
// Motor3Butoane, la fel ca orice alt quiz migrat in Faza D.
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadScript(relativePath) {
  const code = readFileSync(join(rootDir, relativePath), "utf8");
  new Function("window", `${code}\n`)(globalThis);
}

function item(prompt, options, correctIndex) {
  return { prompt, options, correctIndex, correctAnswer: options[correctIndex] };
}

function definitieSimpla(overrides = {}) {
  const intrebari = [
    item("2+2=?", ["3", "4", "5"], 1),
    item("5+1=?", ["6", "7", "8"], 0),
    item("9-3=?", ["6", "5", "4"], 0),
  ];
  let i = 0;
  return {
    id: "base",
    title: "Baza",
    generator: () => intrebari[i++ % intrebari.length],
    ...overrides,
  };
}

describe("SubquizDefinition da CE, nu CUM (Faza E)", () => {
  beforeEach(() => {
    globalThis.window = globalThis;
    delete globalThis.Motor3Butoane;
    delete globalThis.ItemGenerator;
    delete globalThis.SubquizDefinition;
    delete globalThis.SubquizOrchestrator;
    loadScript("js/motor-3-butoane.js");
    loadScript("js/subquiz/item-generator.js");
    loadScript("js/subquiz/subquiz-definition.js");
    loadScript("js/subquiz/subquiz-orchestrator.js");
  });

  it("define({onAnswer}) chiar arunca", () => {
    assert.throws(
      () =>
        globalThis.SubquizDefinition.define({
          id: "test",
          title: "Test",
          onAnswer: () => ({ action: "continue" }),
        }),
      /onAnswer/,
      "un subquiz cu onAnswer propriu trebuie respins, nu acceptat tacit"
    );
  });

  it("SubquizOrchestrator.create respinge la construire o definitie cu onAnswer", () => {
    assert.throws(() =>
      globalThis.SubquizOrchestrator.create({
        definitions: [
          {
            ...definitieSimpla(),
            onAnswer: () => ({ action: "continue" }),
          },
        ],
      })
    );
  });

  it("fara onAnswer: raspuns gresit ramane pe aceeasi intrebare, oricate apasari", () => {
    const runtime = globalThis.SubquizDefinition.createRuntime(definitieSimpla());
    const vedereInitiala = runtime.begin();
    assert.equal(vedereInitiala.prompt, "2+2=?");

    for (let incercare = 0; incercare < 5; incercare += 1) {
      const rezultat = runtime.onAnswer(0); // gresit (corectIndex=1)
      assert.equal(rezultat.action, "stay");
      assert.equal(rezultat.view.outcome, "wrong-answer");
      assert.equal(rezultat.view.prompt, "2+2=?", `incercarea ${incercare}: aceeasi intrebare`);
    }
  });

  it("fara onAnswer: raspuns corect avanseaza la urmatoarea intrebare", () => {
    const runtime = globalThis.SubquizDefinition.createRuntime(definitieSimpla());
    runtime.begin();
    const rezultat = runtime.onAnswer(1); // corect
    assert.equal(rezultat.action, "continue");
    assert.equal(rezultat.view.outcome, "step-correct");
    assert.equal(rezultat.view.prompt, "5+1=?");
  });

  it("esteCorect implicit face comparatie numerica (ca vechiul defaultGrade)", () => {
    const runtime = globalThis.SubquizDefinition.createRuntime({
      id: "base",
      title: "Baza",
      generator: () => ({ prompt: "1+1=?", options: ["02", "2", "3"], correctIndex: 1 }),
    });
    runtime.begin();
    // "02" ca text nu e egal cu "2", dar numeric da - trebuie acceptat ca varianta corecta.
    const rezultat = runtime.onAnswer(0);
    assert.equal(rezultat.view.correct, true, "02 trebuie recunoscut ca acelasi numar cu 2");
  });

  it("actiuni.dupaRaspunsCorect poate cere rutare (push/pop/exit)", () => {
    const runtime = globalThis.SubquizDefinition.createRuntime(
      definitieSimpla({
        actiuni: {
          dupaRaspunsCorect: () => ({ action: "exit", reason: "gata" }),
        },
      })
    );
    runtime.begin();
    const rezultat = runtime.onAnswer(1); // corect
    assert.equal(rezultat.action, "exit");
    assert.equal(rezultat.reason, "gata");
  });

  it("actiunea 'pop' vine fara view — orchestratorul poate arata vederea lui onResume", () => {
    const runtime = globalThis.SubquizDefinition.createRuntime(
      definitieSimpla({
        actiuni: {
          dupaRaspunsCorect: () => ({ action: "pop", reason: "gata" }),
        },
      })
    );
    runtime.begin();
    const rezultat = runtime.onAnswer(1); // corect
    assert.equal(rezultat.action, "pop");
    assert.equal(
      "view" in rezultat,
      false,
      "M3B ataseaza mereu un view, dar la pop trebuie sters — altfel ingroapa vederea lui onResume"
    );
  });

  it("mesajul implicit de gresit ramane neschimbat cand subquizul nu-l suprascrie", () => {
    const runtime = globalThis.SubquizDefinition.createRuntime(definitieSimpla());
    runtime.begin();
    const rezultat = runtime.onAnswer(0); // gresit, alesul = "3"
    assert.equal(rezultat.view.message, "3 nu e bun. Mai incearca!");
  });
});
