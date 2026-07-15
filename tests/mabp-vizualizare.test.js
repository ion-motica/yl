import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  citesteLoguriDinIndexedDB,
  construiesteConfiguratieDinSelectii,
  determinaPornireDinURL,
  initializeazaAplicatiaMABP,
} from "../Vizualizare si interpretare logs/mabp-app.js";
import {
  construiesteConfiguratieAnaliza,
  creeazaMotorMABP,
} from "../Vizualizare si interpretare logs/mabp-analiza.js";
import { creeazaVizualizatorMABP } from "../Vizualizare si interpretare logs/mabp-vizualizare.js";

const fixtureDir = new URL("../Vizualizare si interpretare logs/", import.meta.url);

function citesteJson(numeFisier) {
  return JSON.parse(readFileSync(new URL(numeFisier, fixtureDir), "utf8"));
}

class ElementMinimal {
  constructor(tagName, documentRef) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = documentRef;
    this.children = [];
    this.childNodes = this.children;
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.className = "";
    this.style = {};
    this.textContent = "";
    this.value = "";
    this.type = "";
    this.name = "";
    this.checked = false;
    this.files = [];
    this.hidden = false;
    this.disabled = false;
  }

  appendChild(copil) {
    this.children.push(copil);
    return copil;
  }

  append(...copii) {
    copii.forEach((copil) => this.appendChild(copil));
  }

  replaceChildren(...copii) {
    this.children.length = 0;
    this.append(...copii);
  }

  setAttribute(nume, valoare) {
    this.attributes[nume] = String(valoare);
  }

  removeAttribute(nume) {
    delete this.attributes[nume];
  }

  getAttribute(nume) {
    return this.attributes[nume] ?? null;
  }

  addEventListener(tip, listener) {
    this.listeners[tip] ||= [];
    this.listeners[tip].push(listener);
  }

  async dispatch(tip) {
    await Promise.all((this.listeners[tip] || []).map((listener) => listener({ target: this })));
  }
}

class DocumentMinimal {
  constructor() {
    this.elementeDupaId = new Map();
  }

  createElement(tagName) {
    return new ElementMinimal(tagName, this);
  }

  createElementNS(_namespace, tagName) {
    return new ElementMinimal(tagName, this);
  }

  getElementById(id) {
    return this.elementeDupaId.get(id) || null;
  }

  adaugaElement(id, tagName = "div") {
    const element = this.createElement(tagName);
    element.id = id;
    this.elementeDupaId.set(id, element);
    return element;
  }
}

function creeazaContainer() {
  const documentRef = new DocumentMinimal();
  return documentRef.createElement("div");
}

function creeazaDocumentAplicatie() {
  const documentRef = new DocumentMinimal();
  documentRef.adaugaElement("mabp-app", "main");
  documentRef.adaugaElement("mabp-preset", "div");
  documentRef.adaugaElement("mabp-ajutor-preset", "p");
  documentRef.adaugaElement("mabp-reaplica-preset", "button");
  documentRef.adaugaElement("mabp-axe", "div");
  documentRef.adaugaElement("mabp-mod-afisare", "div");
  documentRef.adaugaElement("mabp-incarca-fixture", "button");
  documentRef.adaugaElement("mabp-importa-json", "input");
  documentRef.adaugaElement("mabp-incarca-indexeddb", "button");
  documentRef.adaugaElement("mabp-status-sursa", "p");
  documentRef.adaugaElement("mabp-mesaj", "div");
  documentRef.adaugaElement("mabp-rezultat", "div");
  return documentRef;
}

function texteDin(element) {
  return [
    element.textContent,
    ...(element.children || []).flatMap((copil) => texteDin(copil)),
  ].filter(Boolean);
}

function textComplet(element) {
  return texteDin(element).join(" | ");
}

function cautaElemente(element, predicat) {
  const rezultate = predicat(element) ? [element] : [];
  for (const copil of element.children || []) {
    rezultate.push(...cautaElemente(copil, predicat));
  }
  return rezultate;
}

function creeazaIndexedDBMock(
  valoriCursor,
  { laDirectieCursor = () => {}, laInchidere = () => {} } = {},
) {
  const bazaDate = {
    objectStoreNames: { contains: (nume) => nume === "intrebari" },
    close: laInchidere,
    transaction(numeColectie, mod) {
      assert.equal(numeColectie, "intrebari");
      assert.equal(mod, "readonly");
      return {
        objectStore() {
          return {
            openCursor(_interval, directie) {
              laDirectieCursor(directie);
              const cerere = {};
              let index = 0;
              const publica = () => {
                queueMicrotask(() => {
                  if (index >= valoriCursor.length) {
                    cerere.result = null;
                  } else {
                    cerere.result = {
                      value: valoriCursor[index],
                      continue() {
                        index += 1;
                        publica();
                      },
                    };
                  }
                  cerere.onsuccess?.();
                });
              };
              publica();
              return cerere;
            },
          };
        },
      };
    },
  };
  return {
    open(numeBazaDate) {
      assert.equal(numeBazaDate, "youlearn_jurnal_intrebari");
      const cerere = {};
      queueMicrotask(() => {
        cerere.result = bazaDate;
        cerere.onsuccess?.();
      });
      return cerere;
    },
  };
}

function rezultatCuGrup(grup, configuratie = {}) {
  return {
    metadata: { preset_id: "test_v1", preset_version: 1 },
    calitate: { total: 10, incluse_timp: 9 },
    grupuri: [grup],
    agregat: {},
    configuratie,
  };
}

describe("vizualizatorul MABP", () => {
  it("rezumat_simplu explica factual un singur fact fara panourile tehnice", () => {
    const container = creeazaContainer();
    const rezultat = rezultatCuGrup(
      {
        id: "mul:7*8=?",
        eticheta: "7×8",
        stare: "in_consolidare",
        suficienta: "estimare_utila",
        metrici: {
          n_intrebari: 20,
          n_precizie: 20,
          n_corecte_prima_apasare: 19,
          precizie_prima_apasare: 0.95,
          n_timp: 17,
          mediana_timp_corect_prima_apasare: 1.8,
        },
      },
      { descriere: "Analizează ultimele 20 de întrebări." },
    );

    creeazaVizualizatorMABP().afiseaza({
      rezultat,
      container,
      tip: "rezumat_simplu",
    });

    const text = textComplet(container);
    assert.match(text, /Rezultat pe scurt/);
    assert.match(text, /19 din 20/);
    assert.match(text, /95%/);
    assert.match(text, /1,8 s/);
    assert.match(text, /17 timpi corecți și valizi/);
    assert.doesNotMatch(text, /Metadatele raportului|Configurația folosită/);
  });

  it("rezumat_simplu nu prezinta o stare stabila cand datele sunt insuficiente", () => {
    const container = creeazaContainer();
    const rezultat = rezultatCuGrup({
      id: "mul:2*3=?",
      eticheta: "2×3",
      stare: "in_consolidare",
      suficienta: "date_insuficiente",
      metrici: {
        n_intrebari: 4,
        n_precizie: 4,
        n_corecte_prima_apasare: 4,
        precizie_prima_apasare: 1,
        n_timp: 4,
        mediana_timp_corect_prima_apasare: 1.45,
      },
    });

    creeazaVizualizatorMABP().afiseaza({
      rezultat,
      container,
      tip: "rezumat_simplu",
    });

    const text = textComplet(container);
    assert.match(text, /Date insuficiente/);
    assert.match(text, /prea puține întrebări/i);
    assert.doesNotMatch(text, /viteza și precizia nu ating/i);
  });

  it("rezumat_simplu permite selectarea unui fact din grila demonstrativa", async () => {
    const container = creeazaContainer();
    const rezultat = {
      metadata: {},
      configuratie: {},
      grupuri: [
        {
          id: "mul:7*8=?",
          eticheta: "7×8",
          stare: "in_consolidare",
          suficienta: "estimare_utila",
          metrici: {
            n_intrebari: 20,
            n_precizie: 20,
            n_corecte_prima_apasare: 19,
            precizie_prima_apasare: 0.95,
            n_timp: 17,
            mediana_timp_corect_prima_apasare: 1.8,
          },
        },
        {
          id: "mul:6*7=?",
          eticheta: "6×7",
          stare: "in_lucru",
          suficienta: "estimare_utila",
          metrici: {
            n_intrebari: 20,
            n_precizie: 20,
            n_corecte_prima_apasare: 15,
            precizie_prima_apasare: 0.75,
            n_timp: 15,
            mediana_timp_corect_prima_apasare: 2.1,
          },
        },
      ],
    };

    creeazaVizualizatorMABP().afiseaza({
      rezultat,
      container,
      tip: "rezumat_simplu",
    });
    const butoane = cautaElemente(
      container,
      (element) => element.className.split(" ").includes("mabp-fact-buton"),
    );
    assert.equal(butoane.length, 2);
    assert.equal(butoane[0].getAttribute("aria-pressed"), "true");
    assert.equal(butoane[1].getAttribute("aria-label"), "6×7: In lucru");
    assert.match(textComplet(butoane[1]), /6×7.*In lucru/);

    await butoane[1].dispatch("click");

    const detaliu = cautaElemente(
      container,
      (element) => element.className.includes("mabp-rezumat-selectat"),
    )[0];
    const text = textComplet(detaliu);
    assert.equal(butoane[0].getAttribute("aria-pressed"), "false");
    assert.equal(butoane[1].getAttribute("aria-pressed"), "true");
    assert.match(text, /6×7/);
    assert.match(text, /15 din 20/);
    assert.match(text, /75%/);
  });

  it("rezumat_simplu păstrează matricea declarată și ordinea coordonatelor", async () => {
    const container = creeazaContainer();
    const grup = (id, eticheta, rand, coloana) => ({
      id,
      eticheta,
      pozitie: { rand, coloana },
      stare: "netestat",
      suficienta: "netestat",
      metrici: { n_intrebari: 0, n_precizie: 0, n_corecte_prima_apasare: 0 },
    });
    const rezultat = {
      metadata: {},
      configuratie: {},
      aranjare: {
        tip: "matrice",
        table_id: "test:2x2",
        eticheta: "Matrice 2 × 2",
        randuri: [1, 2],
        coloane: [1, 2],
      },
      grupuri: [
        grup("d", "D", 2, 2),
        grup("c", "C", 2, 1),
        grup("b", "B", 1, 2),
        grup("a", "A", 1, 1),
      ],
    };

    creeazaVizualizatorMABP().afiseaza({
      rezultat,
      container,
      tip: "rezumat_simplu",
    });

    const matrice = cautaElemente(
      container,
      (element) => element.getAttribute("data-aranjare") === "matrice",
    );
    assert.equal(matrice.length, 1);
    assert.equal(matrice[0].getAttribute("role"), "table");
    assert.equal(
      cautaElemente(
        matrice[0],
        (element) => element.getAttribute("role") === "cell",
      ).length,
      4,
    );
    const butoane = cautaElemente(
      matrice[0],
      (element) => element.className.split(" ").includes("mabp-fact-buton"),
    );
    assert.deepEqual(
      butoane.map((buton) =>
        cautaElemente(
          buton,
          (element) => element.className === "mabp-fact-buton__fact",
        )[0].textContent
      ),
      ["A", "B", "C", "D"],
    );
    assert.equal(butoane[0].getAttribute("aria-pressed"), "true");

    await butoane[3].dispatch("click");
    const detaliu = cautaElemente(
      container,
      (element) => element.className.includes("mabp-rezumat-selectat"),
    )[0];
    assert.match(textComplet(detaliu), /D/);
    assert.equal(butoane[3].getAttribute("aria-pressed"), "true");
  });

  it("rezumat_simplu arată traseul complet de la netestat la fluent", () => {
    const container = creeazaContainer();
    const niveluri = [
      ["netestat", "netestat"],
      ["in_lucru", "date_insuficiente"],
      ["in_lucru", "estimare_utila"],
      ["in_consolidare", "estimare_utila"],
      ["fluent", "estimare_utila"],
      ["progres", "estimare_utila"],
    ];
    creeazaVizualizatorMABP().afiseaza({
      container,
      tip: "rezumat_simplu",
      rezultat: {
        grupuri: niveluri.map(([stare, suficienta], index) => ({
          id: `fact-${index}`,
          stare,
          suficienta,
          metrici: {},
        })),
      },
    });
    const trasee = cautaElemente(
      container,
      (element) => element.className === "mabp-traseu-stare",
    );
    assert.deepEqual(
      trasee.map((traseu) => [
        cautaElemente(
          traseu,
          (pas) => pas.className.split(" ").includes("mabp-traseu-stare__pas"),
        ).length,
        cautaElemente(
          traseu,
          (pas) => pas.className.includes("mabp-traseu-stare__pas--plin"),
        ).length,
      ]),
      [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4]],
    );
    assert.ok(trasee.every((traseu) => traseu.getAttribute("aria-hidden") === "true"));
  });

  it("detaliu_fact afiseaza starea si metricile publice", () => {
    const container = creeazaContainer();
    const rezultat = rezultatCuGrup({
      id: "mul:7*8=?",
      eticheta: "7×8",
      stare: "in_consolidare",
      suficienta: "tendinta",
      metrici: {
        n_timp: 17,
        precizie_prima_apasare: 0.95,
        mediana_timp_corect_prima_apasare: 1.8,
      },
    });

    creeazaVizualizatorMABP().afiseaza({
      rezultat,
      container,
      tip: "detaliu_fact",
    });

    const text = textComplet(container);
    assert.match(text, /7×8/);
    assert.match(text, /In consolidare/);
    assert.match(text, /95%/);
    assert.match(text, /1,8 s/);
    assert.match(text, /17/);
    assert.doesNotMatch(text, /17 s/);
  });

  it("grila_progres afiseaza textual directia si suficienta", () => {
    const container = creeazaContainer();
    const rezultat = rezultatCuGrup({
      id: "mul:7*8=?",
      eticheta: "7×8",
      stare: "in_consolidare",
      suficienta: "estimare_utila",
      metrici: { delta_mediana_timp: 0.8 },
      comparatie: {
        vechi: { mediana_timp: 2.4 },
        nou: { mediana_timp: 1.6 },
        delta: { mediana_timp: 0.8 },
        directie: "progres",
      },
    });

    creeazaVizualizatorMABP().afiseaza({
      rezultat,
      container,
      tip: "grila_progres",
    });

    const text = textComplet(container);
    assert.match(text, /Progres/);
    assert.match(text, /Date: Estimare utila/);
    assert.match(text, /culoarea este doar un indiciu suplimentar/i);
  });

  it("grila_stare se eticheteaza distinct de grila progresului", () => {
    const container = creeazaContainer();
    const rezultat = rezultatCuGrup({
      id: "mul:7*8=?",
      eticheta: "7×8",
      stare: "in_consolidare",
      suficienta: "estimare_utila",
      metrici: { precizie_prima_apasare: 0.95 },
    });

    creeazaVizualizatorMABP().afiseaza({
      rezultat,
      container,
      tip: "grila_stare",
    });

    const grila = cautaElemente(
      container,
      (element) => element.className === "mabp-grila",
    )[0];
    assert.equal(grila.getAttribute("aria-label"), "Grila stării actuale");
    assert.match(textComplet(container), /afișează textual starea/);
    assert.doesNotMatch(textComplet(container), /afișează textual direcția/);
  });

  it("grila_adaptiva foloseste starea sau directia configurata fara etichete contradictorii", () => {
    const grupStare = {
      id: "mul:7*8=?",
      eticheta: "7×8",
      stare: "in_consolidare",
      suficienta: "estimare_utila",
      metrici: {},
    };
    const containerStare = creeazaContainer();
    creeazaVizualizatorMABP().afiseaza({
      rezultat: rezultatCuGrup(grupStare, { rezultat: "stare_curenta" }),
      container: containerStare,
      tip: "grila_adaptiva",
    });
    assert.match(textComplet(containerStare), /afișează textual starea/);
    assert.doesNotMatch(textComplet(containerStare), /afișează textual direcția/);

    const containerDirectie = creeazaContainer();
    creeazaVizualizatorMABP().afiseaza({
      rezultat: rezultatCuGrup(
        {
          ...grupStare,
          comparatie: { directie: "progres" },
        },
        { rezultat: "directie" },
      ),
      container: containerDirectie,
      tip: "grila_adaptiva",
    });
    assert.match(textComplet(containerDirectie), /afișează textual direcția/);
    assert.doesNotMatch(textComplet(containerDirectie), /afișează textual starea/);
  });

  it("randeaza pozițional 200 de celule în 20 rânduri × 10 coloane", () => {
    const container = creeazaContainer();
    const rezultat = rezultatCuGrup({});
    rezultat.aranjare = {
      tip: "matrice",
      table_id: "mul:11-20x1-20",
      eticheta: "Tabla înmulțirii 11–20 × 1–20",
      randuri: Array.from({ length: 20 }, (_, index) => index + 1),
      coloane: Array.from({ length: 10 }, (_, index) => index + 11),
    };
    rezultat.grupuri = Array.from({ length: 20 }, (_, indexStanga) =>
      Array.from({ length: 10 }, (_, indexDreapta) => {
        const stanga = indexStanga + 1;
        const dreapta = indexDreapta + 11;
        return {
          id: `mul:${stanga}*${dreapta}=?`,
          eticheta: `${stanga}×${dreapta}`,
          pozitie: { rand: stanga, coloana: dreapta },
          stare: "date_insuficiente",
          suficienta: "date_insuficiente",
          metrici: {},
        };
      }),
    ).flat().reverse();

    creeazaVizualizatorMABP().afiseaza({
      rezultat,
      container,
      tip: "grila_stare",
    });

    const celule = cautaElemente(
      container,
      (element) => element.className.split(" ").includes("mabp-celula"),
    );
    assert.equal(celule.length, 200);
    const matrice = cautaElemente(
      container,
      (element) => element.getAttribute("data-aranjare") === "matrice",
    );
    assert.equal(matrice.length, 1);
    assert.equal(matrice[0].getAttribute("role"), "table");
    assert.match(matrice[0].getAttribute("aria-label"), /11–20 × 1–20/);
    assert.equal(matrice[0].getAttribute("aria-rowcount"), "21");
    assert.equal(matrice[0].getAttribute("aria-colcount"), "11");

    const randuriAria = cautaElemente(
      matrice[0],
      (element) => element.getAttribute("role") === "row",
    );
    assert.equal(randuriAria.length, 21);

    const anteteRand = cautaElemente(
      matrice[0],
      (element) => element.getAttribute("data-antet-rand") != null,
    );
    const anteteColoana = cautaElemente(
      matrice[0],
      (element) => element.getAttribute("data-antet-coloana") != null,
    );
    assert.equal(anteteRand.length, 20);
    assert.equal(anteteColoana.length, 10);
    assert.ok(anteteRand.every((element) => element.getAttribute("role") === "rowheader"));
    assert.ok(
      anteteColoana.every((element) => element.getAttribute("role") === "columnheader"),
    );
    assert.deepEqual(
      anteteRand.map((element) => Number(element.getAttribute("data-antet-rand"))),
      rezultat.aranjare.randuri,
    );
    assert.deepEqual(
      anteteColoana.map((element) => Number(element.getAttribute("data-antet-coloana"))),
      rezultat.aranjare.coloane,
    );

    assert.ok(celule.every((element) => element.getAttribute("role") === "cell"));
    assert.equal(celule[0].getAttribute("aria-rowindex"), "2");
    assert.equal(celule[0].getAttribute("aria-colindex"), "2");
    assert.deepEqual(
      [
        Number(celule[0].getAttribute("data-rand")),
        Number(celule[0].getAttribute("data-coloana")),
      ],
      [1, 11],
      "Ordinea DOM trebuie să urmeze matricea, nu ordinea inversată a grupurilor.",
    );
    assert.deepEqual(
      [
        Number(celule.at(-1).getAttribute("data-rand")),
        Number(celule.at(-1).getAttribute("data-coloana")),
      ],
      [20, 20],
    );
    assert.match(textComplet(container), /1×11/);
    assert.match(textComplet(container), /20×20/);
  });

  it("păstrează grila fluidă existentă când rezultatul nu declară o matrice", () => {
    const container = creeazaContainer();
    const rezultat = rezultatCuGrup({
      id: "mul:7*8=?",
      eticheta: "7×8",
      stare: "in_consolidare",
      suficienta: "tendinta",
      metrici: { n_intrebari: 12 },
    });

    creeazaVizualizatorMABP().afiseaza({
      rezultat,
      container,
      tip: "grila_stare",
    });

    const grilaFluida = cautaElemente(
      container,
      (element) => element.className.split(" ").includes("mabp-grila"),
    );
    assert.equal(grilaFluida.length, 1);
    assert.equal(grilaFluida[0].getAttribute("data-aranjare"), null);
    assert.match(textComplet(grilaFluida[0]), /7×8/);
  });

  it("grafic_linie foloseste valoarea explicita din serie, nu prima metrica numerica", () => {
    const container = creeazaContainer();
    const rezultat = rezultatCuGrup({
      id: "mul:7*8=?",
      eticheta: "7×8",
      stare: "in_consolidare",
      suficienta: "tendinta",
      metrici: {},
      serie: [
        {
          eticheta: "S1",
          valoare: 2.4,
          metrica: "mediana_timp_corect_prima_apasare",
          unitate: "s",
          metrici: { n_intrebari: 999 },
        },
        {
          eticheta: "S2",
          valoare: 1.7,
          metrica: "mediana_timp_corect_prima_apasare",
          unitate: "s",
          metrici: { n_intrebari: 998 },
        },
      ],
    });

    creeazaVizualizatorMABP().afiseaza({
      rezultat,
      container,
      tip: "grafic_linie",
    });

    const text = textComplet(container);
    assert.match(text, /S1/);
    assert.match(text, /Metrică: Mediana timp corect prima apasare \(s\)/);
    assert.match(text, /2,4 s/);
    assert.match(text, /S2/);
    assert.match(text, /1,7/);
    assert.doesNotMatch(text, /999|998/);
    assert.equal(cautaElemente(container, (element) => element.tagName === "POLYLINE").length, 1);
  });

  it("permite adaugarea unei vizualizari custom", () => {
    const container = creeazaContainer();
    const rezultat = rezultatCuGrup({
      id: "mul:7*8=?",
      eticheta: "7×8",
      metrici: {},
    });
    let parametriPrimiti = null;
    const vizualizator = creeazaVizualizatorMABP({
      vizualizari: {
        sumar_custom(parametri) {
          parametriPrimiti = parametri;
          const mesaj = parametri.container.ownerDocument.createElement("p");
          mesaj.textContent = "Randare custom";
          parametri.container.append(mesaj);
        },
      },
    });

    const info = vizualizator.afiseaza({
      rezultat,
      container,
      tip: "sumar_custom",
    });

    assert.equal(info.tip, "sumar_custom");
    assert.equal(info.fallback, false);
    assert.equal(parametriPrimiti.rezultat, rezultat);
    assert.equal(parametriPrimiti.tip, "sumar_custom");
    assert.match(textComplet(container), /Randare custom/);
  });

  it("foloseste tabelul si un mesaj explicit pentru un tip necunoscut", () => {
    const container = creeazaContainer();
    const rezultat = rezultatCuGrup({
      id: "mul:7*8=?",
      eticheta: "7×8",
      stare: "in_consolidare",
      suficienta: "tendinta",
      metrici: { precizie_prima_apasare: 0.95 },
    });

    const info = creeazaVizualizatorMABP().afiseaza({
      rezultat,
      container,
      tip: "bare_neimplementate",
    });

    const text = textComplet(container);
    assert.deepEqual(info, { tip: "tabel", fallback: true });
    assert.match(text, /Rezultatul este afișat ca tabel/);
    assert.match(text, /Rezultatele analizei în format tabelar/);
    assert.match(text, /95%/);
  });

  it("trateaza numele mostenite ca vizualizari necunoscute", () => {
    const rezultat = rezultatCuGrup({
      id: "mul:7*8=?",
      eticheta: "7×8",
      metrici: { precizie_prima_apasare: 0.95 },
    });

    for (const tip of ["constructor", "__proto__", "toString"]) {
      const container = creeazaContainer();
      const info = creeazaVizualizatorMABP().afiseaza({
        rezultat,
        container,
        tip,
      });
      assert.deepEqual(info, { tip: "tabel", fallback: true });
      assert.match(textComplet(container), /Rezultatele analizei în format tabelar/);
    }
  });
});

describe("configuratorul declarativ MABP", () => {
  it("reproduce exact fiecare preset cand axele nu sunt ajustate", () => {
    const preseturi = citesteJson("youlearn_preseturi_MABP_exemple_v1.json");

    Object.entries(preseturi.interface.preset_selectii).forEach(([analizaId, selectii]) => {
      if (preseturi.interface.preseturi?.[analizaId]?.dezactivata) return;
      assert.deepEqual(
        construiesteConfiguratieDinSelectii({ preseturi, analizaId, selectii }),
        construiesteConfiguratieAnaliza({ preseturi, analizaId }),
      );
    });

    assert.throws(
      () => construiesteConfiguratieDinSelectii({
        preseturi,
        analizaId: "explorator_eff_rol_necunoscuta_v1",
        selectii: preseturi.interface.preset_selectii.explorator_eff_rol_necunoscuta_v1,
      }),
      /nu sunt încă implementate distinct/,
    );
  });

  it("copiaza un domeniu 11–20 × 1–20 din date fara ipoteze despre dimensiunea grilei", () => {
    const preseturi = citesteJson("youlearn_preseturi_MABP_exemple_v1.json");
    const domeniu = preseturi.interface.axe.find((axa) => axa.id === "domeniu");
    domeniu.optiuni.push({
      id: "tabla_11_20_x_1_20",
      eticheta: "11–20 × 1–20",
      valoare: {
        tip: "camp_in",
        camp: "fact_id",
        valori: ["mul:11*1=?", "mul:20*20=?"],
      },
    });
    const selectii = structuredClone(
      preseturi.interface.preset_selectii.stare_generala_demo_v1,
    );
    selectii.domeniu = ["tabla_11_20_x_1_20"];

    const configuratie = construiesteConfiguratieDinSelectii({
      preseturi,
      analizaId: "stare_generala_demo_v1",
      selectii,
    });

    assert.deepEqual(configuratie.domeniu, domeniu.optiuni.at(-1).valoare);
    assert.equal(configuratie.preset_baza_id, "stare_generala_demo_v1");
    assert.equal(configuratie.preset_id, "stare_generala_demo_v1+ajustat");
  });

  it("combina mai multe bife structurale prin intersectia declarata", () => {
    const preseturi = citesteJson("youlearn_preseturi_MABP_exemple_v1.json");
    const structura = preseturi.interface.axe.find((axa) => axa.id === "structura");
    structura.optiuni.push({
      id: "forma_a_x_b",
      eticheta: "Forma a×b",
      valoare: { tip: "camp_egal", camp: "eq_form", valoare: "a*b=c" },
    });
    const selectii = structuredClone(
      preseturi.interface.preset_selectii.stare_generala_demo_v1,
    );
    selectii.structura = ["rol_necunoscuta_a", "forma_a_x_b"];

    const configuratie = construiesteConfiguratieDinSelectii({
      preseturi,
      analizaId: "stare_generala_demo_v1",
      selectii,
    });

    assert.equal(configuratie.structura.tip, "intersectie");
    assert.deepEqual(configuratie.structura.axe, structura.optiuni.map((optiune) => optiune.valoare));
  });

  it("respinge selectii duplicate, combinatii incompatibile si axe necunoscute", () => {
    const preseturi = citesteJson("youlearn_preseturi_MABP_exemple_v1.json");
    const selectii = structuredClone(
      preseturi.interface.preset_selectii.stare_generala_demo_v1,
    );

    selectii.structura = ["rol_necunoscuta_a", "rol_necunoscuta_a"];
    assert.throws(
      () => construiesteConfiguratieDinSelectii({
        preseturi,
        analizaId: "stare_generala_demo_v1",
        selectii,
      }),
      /selecții duplicate/,
    );

    selectii.structura = [];
    selectii.mod_analiza = ["directie_perioada"];
    assert.throws(
      () => construiesteConfiguratieDinSelectii({
        preseturi,
        analizaId: "stare_generala_demo_v1",
        selectii,
      }),
      /fereastră limitată/,
    );

    selectii.mod_analiza = ["stare_curenta"];
    selectii.axa_inexistenta = ["orice"];
    assert.throws(
      () => construiesteConfiguratieDinSelectii({
        preseturi,
        analizaId: "stare_generala_demo_v1",
        selectii,
      }),
      /axe necunoscute/,
    );
  });
});

describe("integrarea aplicatiei MABP", () => {
  it("citeste explicit sursa si presetul initial din URL", () => {
    assert.deepEqual(
      determinaPornireDinURL(
        "?sursa=indexeddb&analiza=stare_generala_observata_v1",
      ),
      {
        sursaInitiala: "indexeddb",
        analizaInitiala: "stare_generala_observata_v1",
      },
    );
    assert.deepEqual(determinaPornireDinURL("?sursa=necunoscuta"), {
      sursaInitiala: "fixture",
      analizaInitiala: null,
    });
  });

  it("incarca prin fetch mock preseturile, catalogul si fixture-ul, apoi afiseaza rezultatul motorului real", async () => {
    const preseturi = citesteJson("youlearn_preseturi_MABP_exemple_v1.json");
    const catalog = citesteJson("youlearn_catalog_MABP_dummy_v1.json");
    const loguri = citesteJson("youlearn_loguri_dummy_v1.json");
    const documentRef = creeazaDocumentAplicatie();
    const dateDupaCale = {
      "/preseturi.json": preseturi,
      "/catalog.json": catalog,
      "/loguri.json": loguri,
    };
    const caiCerute = [];
    const fetchFn = async (cale) => {
      caiCerute.push(cale);
      const date = dateDupaCale[cale];
      return {
        ok: Boolean(date),
        status: date ? 200 : 404,
        async json() {
          return structuredClone(date);
        },
      };
    };

    const aplicatie = await initializeazaAplicatiaMABP({
      documentRef,
      fetchFn,
      indexedDBRef: null,
      motor: creeazaMotorMABP(),
      vizualizator: creeazaVizualizatorMABP(),
      cai: {
        preseturi: "/preseturi.json",
        catalog: "/catalog.json",
        fixture: "/loguri.json",
      },
    });

    assert.deepEqual([...caiCerute].sort(), ["/catalog.json", "/loguri.json", "/preseturi.json"]);
    assert.equal(aplicatie.stare.loguri.length, 209);
    const intrariPreset = cautaElemente(
      documentRef.getElementById("mabp-preset"),
      (element) => element.tagName === "INPUT",
    );
    assert.equal(intrariPreset.length, 6);
    assert.ok(intrariPreset.every((intrare) => intrare.type === "radio"));
    assert.equal(new Set(intrariPreset.map((intrare) => intrare.name)).size, 1);
    assert.match(
      textComplet(documentRef.getElementById("mabp-preset")),
      /Privire generală asupra exercițiilor demo/,
    );
    assert.match(
      documentRef.getElementById("mabp-ajutor-preset").textContent,
      /șase exerciții de înmulțire/,
    );
    assert.match(documentRef.getElementById("mabp-status-sursa").textContent, /209 înregistrări/);
    assert.match(
      documentRef.getElementById("mabp-status-sursa").textContent,
      /Privire generală asupra exercițiilor demo/,
    );
    const rezultatText = textComplet(documentRef.getElementById("mabp-rezultat"));
    assert.match(rezultatText, /Rezultat pe scurt/);
    assert.match(rezultatText, /6 elemente analizate/);
    assert.match(rezultatText, /7\*8=56/);
    assert.match(rezultatText, /In consolidare/);
    assert.match(rezultatText, /95%/);
    assert.match(rezultatText, /2 limite tehnice ale datelor/);

    const butonDateInsuficiente = cautaElemente(
      documentRef.getElementById("mabp-rezultat"),
      (element) =>
        element.className.split(" ").includes("mabp-fact-buton") &&
        element.getAttribute("aria-label") === "2*3=6: Date insuficiente",
    )[0];
    assert.ok(butonDateInsuficiente);
    assert.match(textComplet(butonDateInsuficiente), /Date insuficiente/);
    await butonDateInsuficiente.dispatch("click");
    const detaliuDateInsuficiente = cautaElemente(
      documentRef.getElementById("mabp-rezultat"),
      (element) => element.className.includes("mabp-rezumat-selectat"),
    )[0];
    assert.match(textComplet(detaliuDateInsuficiente), /prea puține întrebări/i);

    aplicatie.stare.controlere.modAfisare.seteaza(["tehnic"]);
    await aplicatie.stare.controlere.modAfisare.intrari
      .find((intrare) => intrare.value === "tehnic")
      .dispatch("change");
    const textTehnic = textComplet(documentRef.getElementById("mabp-rezultat"));
    assert.match(textTehnic, /Metadatele raportului/);
    assert.match(textTehnic, /afișează textual starea/);
    assert.doesNotMatch(textTehnic, /Rezultat pe scurt/);
    assert.match(
      documentRef.getElementById("mabp-status-sursa").textContent,
      /afișare tehnică/,
    );
  });

  it("ruleaza motorul o singura data pentru o schimbare de axa si transmite configuratia explicita", async () => {
    const preseturi = citesteJson("youlearn_preseturi_MABP_exemple_v1.json");
    const catalog = citesteJson("youlearn_catalog_MABP_dummy_v1.json");
    const loguri = citesteJson("youlearn_loguri_dummy_v1.json");
    const documentRef = creeazaDocumentAplicatie();
    const configuratiiPrimite = [];
    const dateDupaCale = {
      "/preseturi.json": preseturi,
      "/catalog.json": catalog,
      "/loguri.json": loguri,
    };

    const aplicatie = await initializeazaAplicatiaMABP({
      documentRef,
      fetchFn: async (cale) => ({
        ok: true,
        async json() {
          return structuredClone(dateDupaCale[cale]);
        },
      }),
      motor: {
        async ruleazaAnaliza({ configuratie }) {
          configuratiiPrimite.push(structuredClone(configuratie));
          return { configuratie };
        },
      },
      vizualizator: { afiseaza() {} },
      cai: {
        preseturi: "/preseturi.json",
        catalog: "/catalog.json",
        fixture: "/loguri.json",
      },
    });

    assert.equal(configuratiiPrimite.length, 1);
    const controlDomeniu = aplicatie.stare.controlere.axe.get("domeniu");
    controlDomeniu.seteaza(["fact_7x8"]);
    await controlDomeniu.intrari
      .find((intrare) => intrare.value === "fact_7x8")
      .dispatch("change");

    assert.equal(configuratiiPrimite.length, 2);
    assert.deepEqual(configuratiiPrimite[1].domeniu, {
      tip: "fact",
      fact_id: "mul:7*8=?",
    });
    assert.equal(configuratiiPrimite[1].preset_baza_id, "stare_generala_demo_v1");
    assert.deepEqual(configuratiiPrimite[1].selectii_interfata.domeniu, ["fact_7x8"]);
  });

  it("dezactiveaza combinatiile incompatibile si poate reaplica direct presetul curent", async () => {
    const preseturi = citesteJson("youlearn_preseturi_MABP_exemple_v1.json");
    const catalog = citesteJson("youlearn_catalog_MABP_dummy_v1.json");
    const loguri = citesteJson("youlearn_loguri_dummy_v1.json");
    const documentRef = creeazaDocumentAplicatie();
    const dateDupaCale = {
      "/preseturi.json": preseturi,
      "/catalog.json": catalog,
      "/loguri.json": loguri,
    };

    const aplicatie = await initializeazaAplicatiaMABP({
      documentRef,
      fetchFn: async (cale) => ({
        ok: true,
        async json() {
          return structuredClone(dateDupaCale[cale]);
        },
      }),
      motor: {
        async ruleazaAnaliza({ configuratie }) {
          return { configuratie };
        },
      },
      vizualizator: { afiseaza() {} },
      cai: {
        preseturi: "/preseturi.json",
        catalog: "/catalog.json",
        fixture: "/loguri.json",
      },
    });

    const controlFereastra = aplicatie.stare.controlere.axe.get("fereastra");
    const controlMod = aplicatie.stare.controlere.axe.get("mod_analiza");
    const directiePerioada = controlMod.intrari.find(
      (intrare) => intrare.value === "directie_perioada",
    );
    const deLaInceput = controlFereastra.intrari.find(
      (intrare) => intrare.value === "toate",
    );
    assert.equal(directiePerioada.disabled, true);
    assert.match(
      textComplet(controlMod.element),
      /fereastră limitată, nu «De la început»/,
    );

    controlFereastra.seteaza(["zile_7"]);
    await controlFereastra.intrari
      .find((intrare) => intrare.value === "zile_7")
      .dispatch("change");
    assert.equal(directiePerioada.disabled, false);

    controlMod.seteaza(["directie_perioada"]);
    await directiePerioada.dispatch("change");
    assert.equal(deLaInceput.disabled, true);

    await documentRef.getElementById("mabp-reaplica-preset").dispatch("click");
    assert.deepEqual(controlFereastra.citeste(), ["toate"]);
    assert.deepEqual(controlMod.citeste(), ["stare_curenta"]);
    assert.equal(directiePerioada.disabled, true);
    assert.doesNotMatch(
      documentRef.getElementById("mabp-status-sursa").textContent,
      /configurație ajustată/,
    );

    const presetExploratoriu = aplicatie.stare.controlere.preset.intrari.find(
      (intrare) => intrare.value === "explorator_eff_rol_necunoscuta_v1",
    );
    const graficLinie = aplicatie.stare.controlere.axe
      .get("vizualizare")
      .intrari.find((intrare) => intrare.value === "grafic_linie");
    assert.equal(presetExploratoriu.disabled, true);
    assert.equal(graficLinie.disabled, true);
    assert.match(textComplet(aplicatie.stare.controlere.preset.element), /nu sunt încă implementate distinct/);
    assert.match(textComplet(aplicatie.stare.controlere.axe.get("vizualizare").element), /nu produc încă serii temporale/);
  });

  it("poate porni direct cu toate facts observate din IndexedDB", async () => {
    const preseturi = citesteJson("youlearn_preseturi_MABP_exemple_v1.json");
    const catalog = citesteJson("youlearn_catalog_MABP_dummy_v1.json");
    const fixture = citesteJson("youlearn_loguri_dummy_v1.json");
    const documentRef = creeazaDocumentAplicatie();
    const logFirefox = {
      data_ora_ro: "2026-07-15 00:10:00",
      quiz_name: "Quiz Firefox",
      subquiz_name: null,
      intrebare: "12*7=?",
      raspuns: "84",
      a_raspuns_corect: true,
      a_cata_apasare_pe_buton: 1,
      durata_raspuns_secunde: 1.8,
      fact: "12*7=84",
      quiz_id: "quiz-firefox",
      subquiz_id: null,
      fact_id: "mul:12*7=?",
      eq_form: "12*7=?",
      pozitie_buton_apasat_pt_raspuns: 1,
      valori_variante_de_raspuns: ["77", "84", "91"],
      valoare_raspuns_corect: "84",
      hints_aratate_pt_raspuns: null,
      extra: {},
    };
    const dateDupaCale = {
      "/preseturi.json": preseturi,
      "/catalog.json": catalog,
      "/loguri.json": fixture,
    };

    const aplicatie = await initializeazaAplicatiaMABP({
      documentRef,
      fetchFn: async (cale) => ({
        ok: true,
        async json() {
          return structuredClone(dateDupaCale[cale]);
        },
      }),
      indexedDBRef: creeazaIndexedDBMock([logFirefox]),
      motor: creeazaMotorMABP(),
      vizualizator: creeazaVizualizatorMABP(),
      cai: {
        preseturi: "/preseturi.json",
        catalog: "/catalog.json",
        fixture: "/loguri.json",
      },
      sursaInitiala: "indexeddb",
      analizaInitiala: "stare_generala_observata_v1",
    });

    assert.equal(aplicatie.stare.loguri.length, 1);
    assert.deepEqual(
      aplicatie.stare.controlere.preset.citeste(),
      ["stare_generala_observata_v1"],
    );
    assert.match(documentRef.getElementById("mabp-ajutor-preset").textContent, /toate valorile fact_id/);
    assert.match(documentRef.getElementById("mabp-status-sursa").textContent, /1 înregistrări.*jurnalul IndexedDB/);
    const text = textComplet(documentRef.getElementById("mabp-rezultat"));
    assert.match(text, /12\*7=84/);
    assert.match(text, /Date insuficiente/);
    assert.match(text, /1 timp corect și valid/);
  });

  it("blocheaza catalogul dummy pentru o analiza structurala pe loguri externe", async () => {
    const preseturi = citesteJson("youlearn_preseturi_MABP_exemple_v1.json");
    const catalog = citesteJson("youlearn_catalog_MABP_dummy_v1.json");
    const loguri = citesteJson("youlearn_loguri_dummy_v1.json");
    const documentRef = creeazaDocumentAplicatie();
    const dateDupaCale = {
      "/preseturi.json": preseturi,
      "/catalog.json": catalog,
      "/loguri.json": loguri,
    };
    const aplicatie = await initializeazaAplicatiaMABP({
      documentRef,
      fetchFn: async (cale) => ({
        ok: true,
        async json() {
          return structuredClone(dateDupaCale[cale]);
        },
      }),
      motor: creeazaMotorMABP(),
      vizualizator: creeazaVizualizatorMABP(),
      cai: {
        preseturi: "/preseturi.json",
        catalog: "/catalog.json",
        fixture: "/loguri.json",
      },
    });
    aplicatie.stare.controlere.preset.seteaza(["progres_7_zile_subtabla_v1"]);
    await aplicatie.stare.controlere.preset.intrari
      .find((intrare) => intrare.value === "progres_7_zile_subtabla_v1")
      .dispatch("change");

    const rezultat = await aplicatie.folosesteLoguri(loguri, "fișier extern.json");

    assert.equal(rezultat, null);
    assert.match(
      documentRef.getElementById("mabp-mesaj").textContent,
      /Catalogul inclus descrie numai fixture-ul dummy/,
    );
    assert.match(
      documentRef.getElementById("mabp-status-sursa").textContent,
      /Progres în ultimele 7 zile — tabla lui 7/,
    );
  });

  it("pastreaza controalele dezactivate daca datele initiale nu se incarca", async () => {
    const documentRef = creeazaDocumentAplicatie();

    await initializeazaAplicatiaMABP({
      documentRef,
      fetchFn: async () => ({ ok: false, status: 500 }),
      indexedDBRef: null,
      cai: {
        preseturi: "/preseturi-lipsa.json",
        catalog: "/catalog-lipsa.json",
        fixture: "/loguri-lipsa.json",
      },
    });

    for (const id of ["mabp-reaplica-preset", "mabp-incarca-fixture", "mabp-importa-json", "mabp-incarca-indexeddb"]) {
      assert.equal(documentRef.getElementById(id).disabled, true);
    }
    assert.match(
      documentRef.getElementById("mabp-mesaj").textContent,
      /Aplicația nu a putut porni/,
    );
  });

  it("citeste IndexedDB cu cursor next si pastreaza ordinea cursorului", async () => {
    const valoriCursor = [
      { id: "prima_in_cursor", data_ora_ro: "2026-07-14 12:00:01" },
      { id: "a_doua_in_cursor", data_ora_ro: "2026-07-14 11:59:59" },
    ];
    let directieCursor = null;
    let bazaInchisa = false;
    const indexedDBRef = creeazaIndexedDBMock(valoriCursor, {
      laDirectieCursor(directie) {
        directieCursor = directie;
      },
      laInchidere() {
        bazaInchisa = true;
      },
    });

    const loguri = await citesteLoguriDinIndexedDB({ indexedDBRef });

    assert.equal(directieCursor, "next");
    assert.deepEqual(loguri, valoriCursor);
    assert.equal(bazaInchisa, true);
  });
});
