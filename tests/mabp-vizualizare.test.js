import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  citesteLoguriDinIndexedDB,
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
    assert.equal(documentRef.getElementById("mabp-preset").children.length, 3);
    assert.match(documentRef.getElementById("mabp-status-sursa").textContent, /209 înregistrări/);
    assert.match(
      documentRef.getElementById("mabp-status-sursa").textContent,
      /preset stare_curenta_fact_v1/,
    );
    const rezultatText = textComplet(documentRef.getElementById("mabp-rezultat"));
    assert.match(rezultatText, /7\*8=56/);
    assert.match(rezultatText, /In consolidare/);
    assert.match(rezultatText, /95%/);
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
      /preset progres_7_zile_subtabla_v1/,
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
    const bazaDate = {
      objectStoreNames: { contains: (nume) => nume === "intrebari" },
      close() {
        bazaInchisa = true;
      },
      transaction(numeColectie, mod) {
        assert.equal(numeColectie, "intrebari");
        assert.equal(mod, "readonly");
        return {
          objectStore() {
            return {
              openCursor(_interval, directie) {
                directieCursor = directie;
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
    const indexedDBRef = {
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

    const loguri = await citesteLoguriDinIndexedDB({ indexedDBRef });

    assert.equal(directieCursor, "next");
    assert.deepEqual(loguri, valoriCursor);
    assert.equal(bazaInchisa, true);
  });
});
