"use strict";

import { construiesteConfiguratieAnaliza, creeazaMotorMABP } from "./mabp-analiza.js";
import { creeazaVizualizatorMABP } from "./mabp-vizualizare.js";

const NUME_BAZA_DATE = "youlearn_jurnal_intrebari";
const NUME_COLECTIE = "intrebari";

const CAI_IMPLICITE = Object.freeze({
  preseturi: new URL("./youlearn_preseturi_MABP_exemple_v1.json", import.meta.url).href,
  catalog: new URL("./youlearn_catalog_MABP_dummy_v1.json", import.meta.url).href,
  fixture: new URL("./youlearn_loguri_dummy_v1.json", import.meta.url).href,
});

function mesajEroare(eroare) {
  return eroare instanceof Error ? eroare.message : String(eroare);
}

function verificaRaspunsHttp(raspuns, cale) {
  if (!raspuns || ("ok" in raspuns && !raspuns.ok)) {
    const status = raspuns?.status ? ` (HTTP ${raspuns.status})` : "";
    throw new Error(`Nu s-a putut încărca ${cale}${status}.`);
  }
  return raspuns;
}

export async function incarcaJson(cale, { fetchFn = globalThis.fetch } = {}) {
  if (typeof fetchFn !== "function") {
    throw new Error("Încărcarea JSON necesită funcția fetch.");
  }
  const raspuns = verificaRaspunsHttp(await fetchFn(cale, { cache: "no-store" }), cale);
  if (typeof raspuns.json === "function") return raspuns.json();
  if (typeof raspuns.text === "function") return JSON.parse(await raspuns.text());
  throw new Error(`Răspunsul pentru ${cale} nu poate fi citit ca JSON.`);
}

export function extrageLoguriDinJson(date) {
  const loguri = Array.isArray(date) ? date : date?.loguri;
  if (!Array.isArray(loguri)) {
    throw new TypeError("Fișierul trebuie să conțină un array de loguri sau obiectul explicit { loguri: [...] }.");
  }
  return loguri;
}

export async function citesteLoguriDinFisier(fisier) {
  if (!fisier || typeof fisier.text !== "function") {
    throw new TypeError("Selectează un fișier JSON valid.");
  }
  let date;
  try {
    date = JSON.parse(await fisier.text());
  } catch (eroare) {
    throw new Error(`Fișierul JSON nu poate fi citit: ${mesajEroare(eroare)}`);
  }
  return extrageLoguriDinJson(date);
}

function deschideBazaDate(indexedDBRef, numeBazaDate) {
  if (!indexedDBRef || typeof indexedDBRef.open !== "function") {
    return Promise.reject(new Error("IndexedDB nu este disponibil în acest browser."));
  }

  return new Promise((resolve, reject) => {
    let bazaCreataAccidental = false;
    const cerere = indexedDBRef.open(numeBazaDate);
    cerere.onupgradeneeded = () => {
      bazaCreataAccidental = true;
      cerere.transaction?.abort();
    };
    cerere.onsuccess = () => {
      if (bazaCreataAccidental) {
        cerere.result?.close?.();
        reject(new Error(`Baza IndexedDB „${numeBazaDate}” nu există încă.`));
        return;
      }
      resolve(cerere.result);
    };
    cerere.onerror = () => {
      const cauza = bazaCreataAccidental
        ? `Baza IndexedDB „${numeBazaDate}” nu există încă.`
        : `Baza IndexedDB „${numeBazaDate}” nu a putut fi deschisă.`;
      reject(new Error(cauza));
    };
    cerere.onblocked = () => reject(new Error(`Baza IndexedDB „${numeBazaDate}” este blocată.`));
  });
}

function citesteColectieInOrdineaCursorului(bazaDate, numeColectie) {
  if (bazaDate.objectStoreNames?.contains && !bazaDate.objectStoreNames.contains(numeColectie)) {
    return Promise.reject(new Error(`Colecția IndexedDB „${numeColectie}” nu există.`));
  }

  return new Promise((resolve, reject) => {
    const loguri = [];
    let tranzactie;
    let cerere;
    try {
      tranzactie = bazaDate.transaction(numeColectie, "readonly");
      cerere = tranzactie.objectStore(numeColectie).openCursor(null, "next");
    } catch (eroare) {
      reject(new Error(`Colecția IndexedDB nu poate fi citită: ${mesajEroare(eroare)}`));
      return;
    }

    cerere.onsuccess = () => {
      const cursor = cerere.result;
      if (!cursor) {
        resolve(loguri);
        return;
      }
      // Ordinea array-ului rămâne exact ordinea autoritativă a cursorului.
      loguri.push(cursor.value);
      cursor.continue();
    };
    cerere.onerror = () => reject(cerere.error || new Error("Cursorul IndexedDB a eșuat."));
    tranzactie.onerror = () => reject(tranzactie.error || new Error("Tranzacția IndexedDB a eșuat."));
    tranzactie.onabort = () => reject(tranzactie.error || new Error("Tranzacția IndexedDB a fost anulată."));
  });
}

export async function citesteLoguriDinIndexedDB({
  indexedDBRef = globalThis.indexedDB,
  numeBazaDate = NUME_BAZA_DATE,
  numeColectie = NUME_COLECTIE,
} = {}) {
  const bazaDate = await deschideBazaDate(indexedDBRef, numeBazaDate);
  try {
    return await citesteColectieInOrdineaCursorului(bazaDate, numeColectie);
  } finally {
    bazaDate.close?.();
  }
}

export function determinaPornireDinURL(cautare = "") {
  const parametri = new URLSearchParams(String(cautare || ""));
  return Object.freeze({
    sursaInitiala:
      parametri.get("sursa") === "indexeddb" ? "indexeddb" : "fixture",
    analizaInitiala: parametri.get("analiza")?.trim() || null,
  });
}

function obtineElemente(documentRef) {
  const iduri = [
    "mabp-app",
    "mabp-preset",
    "mabp-ajutor-preset",
    "mabp-mod-afisare",
    "mabp-incarca-fixture",
    "mabp-importa-json",
    "mabp-incarca-indexeddb",
    "mabp-status-sursa",
    "mabp-mesaj",
    "mabp-rezultat",
  ];
  const elemente = Object.fromEntries(iduri.map((id) => [id, documentRef.getElementById(id)]));
  const lipsa = iduri.filter((id) => !elemente[id]);
  if (lipsa.length) {
    throw new Error(`Interfața MABP este incompletă. Lipsesc: ${lipsa.join(", ")}.`);
  }
  return {
    radacina: elemente["mabp-app"],
    selectorPreset: elemente["mabp-preset"],
    ajutorPreset: elemente["mabp-ajutor-preset"],
    selectorModAfisare: elemente["mabp-mod-afisare"],
    butonFixture: elemente["mabp-incarca-fixture"],
    inputImport: elemente["mabp-importa-json"],
    butonIndexedDB: elemente["mabp-incarca-indexeddb"],
    statusSursa: elemente["mabp-status-sursa"],
    mesaj: elemente["mabp-mesaj"],
    rezultat: elemente["mabp-rezultat"],
  };
}

function eticheteazaAnaliza(analizaId, preset) {
  if (typeof preset?.nume === "string" && preset.nume.trim()) {
    return preset.nume.trim();
  }
  const nume = analizaId.replaceAll("_", " ");
  const domeniu = preset?.domeniu?.tip ? ` · ${preset.domeniu.tip}` : "";
  return `${nume}${domeniu}`;
}

function populeazaPreseturi(documentRef, selector, preseturi) {
  const analize = preseturi?.analysis_presets;
  if (!analize || typeof analize !== "object" || Array.isArray(analize)) {
    throw new Error("Fișierul de preseturi nu conține obiectul `analysis_presets`.");
  }
  const intrari = Object.entries(analize);
  if (!intrari.length) throw new Error("Nu există preseturi de analiză disponibile.");

  selector.replaceChildren();
  intrari.forEach(([analizaId, preset]) => {
    const optiune = documentRef.createElement("option");
    optiune.value = analizaId;
    optiune.textContent = eticheteazaAnaliza(analizaId, preset);
    selector.append(optiune);
  });
  selector.value = intrari[0][0];
}

function actualizeazaAjutorPreset(element, preset) {
  const descriere = preset?.descriere;
  element.textContent =
    typeof descriere === "string" && descriere.trim()
      ? descriere.trim()
      : "Configurația aleasă este transmisă explicit motorului de analiză.";
}

function extrageTipVizualizare(rezultat, configuratie, modAfisare) {
  if (modAfisare === "simplu") return "rezumat_simplu";
  const vizualizare = rezultat?.configuratie?.vizualizare ?? configuratie?.vizualizare;
  if (typeof vizualizare === "string" && vizualizare) return vizualizare;
  if (vizualizare && typeof vizualizare.tip === "string" && vizualizare.tip) return vizualizare.tip;
  return "tabel";
}

function axaNecesitaCatalogStructural(definitie) {
  if (Array.isArray(definitie)) {
    return definitie.some(axaNecesitaCatalogStructural);
  }
  if (!definitie || typeof definitie !== "object") return false;
  if (["subtabla", "eff", "acelasi_rol_al_necunoscutei"].includes(definitie.tip)) {
    return true;
  }
  if (["intersectie", "uniune"].includes(definitie.tip)) {
    return Array.isArray(definitie.axe) &&
      definitie.axe.some(axaNecesitaCatalogStructural);
  }
  return definitie.tip === "nu" && axaNecesitaCatalogStructural(definitie.axa);
}

function valideazaCatalogPentruSursa(stare, configuratie) {
  if (
    stare.sursaEsteFixture ||
    stare.catalog?.catalog_scope !== "fixture_only" ||
    (!axaNecesitaCatalogStructural(configuratie.domeniu) &&
      !axaNecesitaCatalogStructural(configuratie.structura))
  ) {
    return;
  }
  throw new Error(
    "Catalogul inclus descrie numai fixture-ul dummy. Pentru o sursă reală, această analiză structurală necesită un catalog explicit compatibil; raportul a fost blocat pentru a nu omite facts în tăcere.",
  );
}

function seteazaMesaj(element, text = "", tip = "informare") {
  element.hidden = !text;
  element.textContent = text;
  element.dataset.tip = tip;
}

function seteazaOcupat(elemente, ocupat) {
  elemente.radacina.setAttribute("aria-busy", String(ocupat));
  [elemente.selectorPreset, elemente.selectorModAfisare, elemente.butonFixture, elemente.inputImport, elemente.butonIndexedDB].forEach(
    (element) => {
      element.disabled = ocupat;
    },
  );
}

function dezactiveazaControale(elemente) {
  elemente.radacina.setAttribute("aria-busy", "false");
  [elemente.selectorPreset, elemente.selectorModAfisare, elemente.butonFixture, elemente.inputImport, elemente.butonIndexedDB].forEach(
    (element) => {
      element.disabled = true;
    },
  );
}

function descrieSursa(
  stare,
  prefix = "Analiză actualizată",
  numeAnaliza = null,
  modAfisare = null,
) {
  const avertisment = stare.avertismentCatalog ? ` ${stare.avertismentCatalog}` : "";
  const analiza = numeAnaliza ? ` · ${numeAnaliza}` : "";
  const afisare = modAfisare
    ? ` · afișare ${modAfisare === "tehnic" ? "tehnică" : "pe scurt"}`
    : "";
  return `${prefix}${analiza}${afisare}: ${stare.loguri.length} înregistrări · ${stare.sursa}.${avertisment}`;
}

export async function initializeazaAplicatiaMABP({
  documentRef = globalThis.document,
  fetchFn = globalThis.fetch,
  indexedDBRef = globalThis.indexedDB,
  motor = creeazaMotorMABP(),
  vizualizator = creeazaVizualizatorMABP(),
  cai = CAI_IMPLICITE,
  sursaInitiala = "fixture",
  analizaInitiala = null,
} = {}) {
  if (!documentRef || typeof documentRef.getElementById !== "function") {
    throw new Error("Documentul paginii MABP nu este disponibil.");
  }
  if (!motor || typeof motor.ruleazaAnaliza !== "function") {
    throw new TypeError("Motorul MABP trebuie să ofere metoda `ruleazaAnaliza`.");
  }
  if (!vizualizator || typeof vizualizator.afiseaza !== "function") {
    throw new TypeError("Vizualizatorul MABP trebuie să ofere metoda `afiseaza`.");
  }
  if (!["fixture", "indexeddb"].includes(sursaInitiala)) {
    throw new TypeError("Sursa inițială MABP trebuie să fie `fixture` sau `indexeddb`.");
  }

  const elemente = obtineElemente(documentRef);
  const stare = {
    preseturi: null,
    catalog: {},
    fixture: [],
    loguri: [],
    sursa: "fixture-ul inclus",
    sursaEsteFixture: true,
    avertismentCatalog: "",
  };

  async function ruleazaAnalizaCurenta() {
    seteazaOcupat(elemente, true);
    seteazaMesaj(elemente.mesaj);
    const analizaId = elemente.selectorPreset.value;
    let numeAnaliza = analizaId;
    try {
      const configuratie = construiesteConfiguratieAnaliza({ preseturi: stare.preseturi, analizaId });
      const preset = stare.preseturi.analysis_presets[analizaId];
      numeAnaliza = eticheteazaAnaliza(analizaId, preset);
      valideazaCatalogPentruSursa(stare, configuratie);
      const rezultat = await motor.ruleazaAnaliza({
        loguri: stare.loguri,
        catalog: stare.catalog,
        configuratie,
      });
      vizualizator.afiseaza({
        rezultat,
        container: elemente.rezultat,
        tip: extrageTipVizualizare(
          rezultat,
          configuratie,
          elemente.selectorModAfisare.value,
        ),
      });
      elemente.statusSursa.textContent = descrieSursa(
        stare,
        "Analiză actualizată",
        numeAnaliza,
        elemente.selectorModAfisare.value,
      );
      return rezultat;
    } catch (eroare) {
      elemente.rezultat.replaceChildren();
      seteazaMesaj(elemente.mesaj, `Analiza nu a putut fi rulată: ${mesajEroare(eroare)}`, "eroare");
      elemente.statusSursa.textContent = descrieSursa(
        stare,
        "Analiză eșuată pentru sursa",
        numeAnaliza,
        elemente.selectorModAfisare.value,
      );
      return null;
    } finally {
      seteazaOcupat(elemente, false);
    }
  }

  async function folosesteLoguri(
    loguri,
    sursa,
    { sursaEsteFixture = false } = {},
  ) {
    if (!Array.isArray(loguri)) throw new TypeError("Logurile transmise aplicației trebuie să fie un array.");
    stare.loguri = loguri;
    stare.sursa = sursa;
    stare.sursaEsteFixture = sursaEsteFixture;
    return ruleazaAnalizaCurenta();
  }

  async function folosesteLoguriIndexedDB() {
    const loguri = await citesteLoguriDinIndexedDB({ indexedDBRef });
    return folosesteLoguri(loguri, "jurnalul IndexedDB, în ordinea cursorului");
  }

  elemente.selectorPreset.addEventListener("change", () => {
    actualizeazaAjutorPreset(
      elemente.ajutorPreset,
      stare.preseturi?.analysis_presets?.[elemente.selectorPreset.value],
    );
    void ruleazaAnalizaCurenta();
  });
  elemente.selectorModAfisare.addEventListener(
    "change",
    ruleazaAnalizaCurenta,
  );
  elemente.butonFixture.addEventListener("click", () => {
    void folosesteLoguri(stare.fixture, "fixture-ul inclus", {
      sursaEsteFixture: true,
    });
  });
  elemente.inputImport.addEventListener("change", () => {
    const fisier = elemente.inputImport.files?.[0];
    if (!fisier) return;
    void (async () => {
      seteazaOcupat(elemente, true);
      seteazaMesaj(elemente.mesaj);
      try {
        const loguri = await citesteLoguriDinFisier(fisier);
        await folosesteLoguri(loguri, `fișierul ${fisier.name}`);
      } catch (eroare) {
        seteazaMesaj(
          elemente.mesaj,
          `Importul a eșuat: ${mesajEroare(eroare)} Raportul afișat a rămas neschimbat.`,
          "eroare",
        );
        elemente.statusSursa.textContent = descrieSursa(stare, "Raport neschimbat");
      } finally {
        elemente.inputImport.value = "";
        seteazaOcupat(elemente, false);
      }
    })();
  });
  elemente.butonIndexedDB.addEventListener("click", () => {
    void (async () => {
      seteazaOcupat(elemente, true);
      seteazaMesaj(elemente.mesaj);
      try {
        await folosesteLoguriIndexedDB();
      } catch (eroare) {
        seteazaMesaj(
          elemente.mesaj,
          `Citirea IndexedDB a eșuat: ${mesajEroare(eroare)} Raportul afișat a rămas neschimbat.`,
          "eroare",
        );
        elemente.statusSursa.textContent = descrieSursa(stare, "Raport neschimbat");
      } finally {
        seteazaOcupat(elemente, false);
      }
    })();
  });

  seteazaOcupat(elemente, true);
  seteazaMesaj(elemente.mesaj);
  try {
    const catalogPromisiune = incarcaJson(cai.catalog, { fetchFn })
      .then((catalog) => ({ catalog, avertisment: "" }))
      .catch((eroare) => ({
        catalog: {},
        avertisment: `Catalogul matematic lipsește (${mesajEroare(eroare)}); analizele structurale pot eșua.`,
      }));
    const [preseturi, fixtureDate, catalogIncarcat] = await Promise.all([
      incarcaJson(cai.preseturi, { fetchFn }),
      incarcaJson(cai.fixture, { fetchFn }),
      catalogPromisiune,
    ]);
    stare.preseturi = preseturi;
    stare.fixture = extrageLoguriDinJson(fixtureDate);
    stare.loguri = stare.fixture;
    stare.catalog = catalogIncarcat.catalog;
    stare.avertismentCatalog = catalogIncarcat.avertisment;
    populeazaPreseturi(documentRef, elemente.selectorPreset, stare.preseturi);
    if (analizaInitiala !== null) {
      if (!Object.hasOwn(stare.preseturi.analysis_presets, analizaInitiala)) {
        throw new Error(`Presetul inițial nu există: ${analizaInitiala}.`);
      }
      elemente.selectorPreset.value = analizaInitiala;
    }
    actualizeazaAjutorPreset(
      elemente.ajutorPreset,
      stare.preseturi.analysis_presets[elemente.selectorPreset.value],
    );
  } catch (eroare) {
    seteazaMesaj(elemente.mesaj, `Aplicația nu a putut porni: ${mesajEroare(eroare)}`, "eroare");
    elemente.statusSursa.textContent = "Datele inițiale nu au fost încărcate.";
    dezactiveazaControale(elemente);
    return Object.freeze({ ruleaza: ruleazaAnalizaCurenta, folosesteLoguri, stare });
  }
  seteazaOcupat(elemente, false);
  if (sursaInitiala === "indexeddb") {
    try {
      await folosesteLoguriIndexedDB();
    } catch (eroare) {
      await ruleazaAnalizaCurenta();
      seteazaMesaj(
        elemente.mesaj,
        `Jurnalul IndexedDB nu a putut fi încărcat automat: ${mesajEroare(eroare)} A fost păstrat fixture-ul inclus.`,
        "eroare",
      );
    }
  } else {
    await ruleazaAnalizaCurenta();
  }

  return Object.freeze({ ruleaza: ruleazaAnalizaCurenta, folosesteLoguri, stare });
}

function raporteazaEroarePornire(eroare) {
  const element = globalThis.document?.getElementById?.("mabp-mesaj");
  if (!element) return;
  seteazaMesaj(element, `Aplicația nu a putut porni: ${mesajEroare(eroare)}`, "eroare");
}

function pornesteAutomat() {
  const radacina = globalThis.document?.getElementById?.("mabp-app");
  if (!radacina || radacina.dataset.mabpPornit === "da") return;
  radacina.dataset.mabpPornit = "da";
  const pornire = determinaPornireDinURL(globalThis.location?.search);
  void initializeazaAplicatiaMABP(pornire).catch(raporteazaEroarePornire);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pornesteAutomat, { once: true });
  } else {
    pornesteAutomat();
  }
}
