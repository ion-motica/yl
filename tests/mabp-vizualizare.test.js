import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  citesteLoguriDinIndexedDB,
  determinaPornireDinURL,
  initializeazaAplicatiaMABP,
} from "../Vizualizare si interpretare logs/mabp-app.js";
import { creeazaMotorMABP } from "../Vizualizare si interpretare logs/mabp-analiza.js";
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
    this.textContent = "";
    this.value = "";
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
  documentRef.adaugaElement("mabp-preset", "select");
  documentRef.adaugaElement("mabp-ajutor-preset", "p");
  const selectorMod = documentRef.adaugaElement("mabp-mod-afisare", "select");
  selectorMod.value = "simplu";
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
      (element) => element.className.includes("mabp-fact-buton"),
    );
    assert.equal(butoane.length, 2);
    assert.equal(butoane[0].getAttribute("aria-pressed"), "true");
    assert.equal(butoane[1].getAttribute("aria-label"), "6×7: In lucru");
    assert.match(butoane[1].textContent, /6×7 · In lucru/);

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
    assert.equal(documentRef.getElementById("mabp-preset").children.length, 5);
    assert.equal(
      documentRef.getElementById("mabp-preset").children[0].textContent,
      "Privire generală asupra exercițiilor demo",
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
        element.className.includes("mabp-fact-buton") &&
        element.getAttribute("aria-label") === "2*3=6: Date insuficiente",
    )[0];
    assert.ok(butonDateInsuficiente);
    assert.match(butonDateInsuficiente.textContent, /Date insuficiente/);
    await butonDateInsuficiente.dispatch("click");
    const detaliuDateInsuficiente = cautaElemente(
      documentRef.getElementById("mabp-rezultat"),
      (element) => element.className.includes("mabp-rezumat-selectat"),
    )[0];
    assert.match(textComplet(detaliuDateInsuficiente), /prea puține întrebări/i);

    documentRef.getElementById("mabp-mod-afisare").value = "tehnic";
    await documentRef.getElementById("mabp-mod-afisare").dispatch("change");
    const textTehnic = textComplet(documentRef.getElementById("mabp-rezultat"));
    assert.match(textTehnic, /Metadatele raportului/);
    assert.match(textTehnic, /afișează textual starea/);
    assert.doesNotMatch(textTehnic, /Rezultat pe scurt/);
    assert.match(
      documentRef.getElementById("mabp-status-sursa").textContent,
      /afișare tehnică/,
    );
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
    assert.equal(documentRef.getElementById("mabp-preset").value, "stare_generala_observata_v1");
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
    documentRef.getElementById("mabp-preset").value =
      "progres_7_zile_subtabla_v1";

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

    for (const id of [
      "mabp-preset",
      "mabp-mod-afisare",
      "mabp-incarca-fixture",
      "mabp-importa-json",
      "mabp-incarca-indexeddb",
    ]) {
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
