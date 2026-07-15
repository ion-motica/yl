"use strict";

import { construiesteConfiguratieAnaliza, creeazaMotorMABP } from "./mabp-analiza.js";
import { creeazaGrupOptiuni } from "./mabp-controale.js";
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
    "mabp-reaplica-preset",
    "mabp-axe",
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
    containerPreset: elemente["mabp-preset"],
    ajutorPreset: elemente["mabp-ajutor-preset"],
    butonReaplicaPreset: elemente["mabp-reaplica-preset"],
    containerAxe: elemente["mabp-axe"],
    containerModAfisare: elemente["mabp-mod-afisare"],
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

function copieDate(valoare) {
  if (valoare == null || typeof valoare !== "object") return valoare;
  if (Array.isArray(valoare)) return valoare.map(copieDate);
  return Object.fromEntries(
    Object.entries(valoare).map(([cheie, continut]) => [cheie, copieDate(continut)]),
  );
}

function esteObiectSimplu(valoare) {
  return Boolean(valoare) && typeof valoare === "object" && !Array.isArray(valoare);
}

function obtineInterfataDeclarativa(preseturi) {
  const interfata = preseturi?.interface;
  if (!esteObiectSimplu(interfata) || !Array.isArray(interfata.axe) || !interfata.axe.length) {
    throw new Error("Fișierul de preseturi nu definește `interface.axe`.");
  }
  if (!esteObiectSimplu(interfata.preset_selectii)) {
    throw new Error("Fișierul de preseturi nu definește `interface.preset_selectii`.");
  }
  return interfata;
}

function scrieCampConfiguratie(configuratie, camp, valoare) {
  if (typeof camp !== "string" || !camp.trim()) {
    throw new Error("O axă de interfață nu declară câmpul configurației.");
  }
  if (valoare === null) {
    delete configuratie[camp];
  } else {
    configuratie[camp] = copieDate(valoare);
  }
}

function aplicaPatchConfiguratie(configuratie, patch) {
  if (!esteObiectSimplu(patch)) {
    throw new Error("Opțiunea unei axe cu strategia `patch` trebuie să conțină un obiect.");
  }
  Object.entries(patch).forEach(([camp, valoare]) => {
    scrieCampConfiguratie(configuratie, camp, valoare);
  });
}

function selectiiEgale(stanga, dreapta, axe) {
  return axe.every((axa) => {
    const a = stanga?.[axa.id];
    const b = dreapta?.[axa.id];
    return Array.isArray(a) && Array.isArray(b) &&
      a.length === b.length && a.every((id, index) => id === b[index]);
  });
}

function gasesteCerintaNeindeplinita(interfata, selectii) {
  for (const axa of interfata.axe) {
    const optiuni = Array.isArray(axa.optiuni) ? axa.optiuni : [];
    const optiuniDupaId = new Map(optiuni.map((optiune) => [optiune?.id, optiune]));
    for (const optiuneId of selectii[axa.id] || []) {
      const optiune = optiuniDupaId.get(optiuneId);
      const cerinte = optiune?.necesita_selectii;
      if (cerinte === undefined) continue;
      if (!esteObiectSimplu(cerinte)) {
        throw new Error(`Opțiunea ${optiuneId} de pe axa ${axa.id} are cerințe invalide.`);
      }
      for (const [axaNecesara, iduriPermise] of Object.entries(cerinte)) {
        if (!interfata.axe.some((candidata) => candidata.id === axaNecesara)) {
          throw new Error(`Opțiunea ${optiuneId} cere axa necunoscută ${axaNecesara}.`);
        }
        if (
          !Array.isArray(iduriPermise) ||
          !iduriPermise.length ||
          iduriPermise.some((id) => typeof id !== "string" || !id.trim())
        ) {
          throw new Error(`Opțiunea ${optiuneId} are valori permise invalide pentru axa ${axaNecesara}.`);
        }
        const selectatePeAxa = selectii[axaNecesara] || [];
        if (!selectatePeAxa.some((id) => iduriPermise.includes(id))) {
          const motiv = typeof optiune.motiv_indisponibilitate === "string"
            ? optiune.motiv_indisponibilitate.trim()
            : "";
          return {
            axaId: axa.id,
            optiuneId,
            motiv: motiv || `Opțiunea ${optiuneId} cere o altă selecție pe axa ${axaNecesara}.`,
          };
        }
      }
    }
  }
  return null;
}

function calculeazaIndisponibilePentruAxa(interfata, selectii, axa) {
  const indisponibile = {};
  const selectateCurent = selectii[axa.id] || [];
  (axa.optiuni || []).forEach((optiune) => {
    if (optiune?.dezactivata === true || selectateCurent.includes(optiune?.id)) return;
    const selectiiPropuse = Object.fromEntries(
      Object.entries(selectii).map(([axaId, iduri]) => [axaId, [...iduri]]),
    );
    selectiiPropuse[axa.id] = axa.tip_selectie === "unica"
      ? [optiune.id]
      : [...selectateCurent, optiune.id];
    const cerinta = gasesteCerintaNeindeplinita(interfata, selectiiPropuse);
    if (cerinta) indisponibile[optiune.id] = cerinta.motiv;
  });
  return indisponibile;
}

export function construiesteConfiguratieDinSelectii({
  preseturi,
  analizaId,
  selectii,
}) {
  const interfata = obtineInterfataDeclarativa(preseturi);
  if (!esteObiectSimplu(selectii)) {
    throw new TypeError("Selecțiile interfeței trebuie să fie un obiect explicit.");
  }
  const metadatePreset = interfata.preseturi?.[analizaId];
  if (metadatePreset?.dezactivata === true) {
    const motiv = typeof metadatePreset.motiv_dezactivare === "string"
      ? metadatePreset.motiv_dezactivare.trim()
      : "";
    throw new Error(motiv || `Presetul ${analizaId} este dezactivat.`);
  }

  const configuratie = construiesteConfiguratieAnaliza({ preseturi, analizaId });
  const iduriAxe = new Set();

  interfata.axe.forEach((axa) => {
    if (!esteObiectSimplu(axa) || typeof axa.id !== "string" || !axa.id.trim()) {
      throw new Error("Fiecare axă de interfață trebuie să aibă un ID.");
    }
    if (iduriAxe.has(axa.id)) {
      throw new Error(`Axa de interfață ${axa.id} este duplicată.`);
    }
    iduriAxe.add(axa.id);

    const iduriSelectate = selectii[axa.id];
    if (!Array.isArray(iduriSelectate)) {
      throw new Error(`Lipsesc selecțiile pentru axa ${axa.id}.`);
    }
    if (new Set(iduriSelectate).size !== iduriSelectate.length) {
      throw new Error(`Axa ${axa.id} conține selecții duplicate.`);
    }
    if (axa.tip_selectie === "unica" && iduriSelectate.length !== 1) {
      throw new Error(`Axa ${axa.id} cere exact o opțiune.`);
    }
    if (axa.tip_selectie !== "unica" && axa.tip_selectie !== "multipla") {
      throw new Error(`Axa ${axa.id} are un tip de selecție necunoscut.`);
    }

    const optiuni = Array.isArray(axa.optiuni) ? axa.optiuni : [];
    const optiuniDupaId = new Map(optiuni.map((optiune) => [optiune?.id, optiune]));
    if (!optiuni.length || optiuniDupaId.size !== optiuni.length) {
      throw new Error(`Axa ${axa.id} trebuie să aibă opțiuni cu ID-uri unice.`);
    }
    const optiuniSelectate = iduriSelectate.map((id) => {
      const optiune = optiuniDupaId.get(id);
      if (!optiune) throw new Error(`Opțiunea ${id} nu există pe axa ${axa.id}.`);
      if (optiune.dezactivata === true) {
        const motiv = typeof optiune.motiv_dezactivare === "string"
          ? optiune.motiv_dezactivare.trim()
          : "";
        throw new Error(motiv || `Opțiunea ${id} de pe axa ${axa.id} este dezactivată.`);
      }
      return optiune;
    });

    if (axa.strategie === "inlocuieste") {
      scrieCampConfiguratie(configuratie, axa.camp, optiuniSelectate[0].valoare);
      return;
    }
    if (axa.strategie === "patch") {
      aplicaPatchConfiguratie(configuratie, optiuniSelectate[0].valoare);
      return;
    }
    if (axa.strategie === "lista") {
      scrieCampConfiguratie(
        configuratie,
        axa.camp,
        optiuniSelectate.map((optiune) => optiune.valoare),
      );
      return;
    }
    if (axa.strategie === "intersectie") {
      const valori = optiuniSelectate.map((optiune) => copieDate(optiune.valoare));
      const valoare = valori.length === 0
        ? null
        : valori.length === 1
          ? valori[0]
          : { tip: "intersectie", axe: valori };
      scrieCampConfiguratie(configuratie, axa.camp, valoare);
      return;
    }
    throw new Error(`Axa ${axa.id} are strategia necunoscută ${axa.strategie}.`);
  });

  const axeNecunoscute = Object.keys(selectii).filter((axaId) => !iduriAxe.has(axaId));
  if (axeNecunoscute.length) {
    throw new Error(`Selecțiile conțin axe necunoscute: ${axeNecunoscute.join(", ")}.`);
  }
  const cerintaNeindeplinita = gasesteCerintaNeindeplinita(interfata, selectii);
  if (cerintaNeindeplinita) {
    throw new Error(cerintaNeindeplinita.motiv);
  }

  const filtruId = configuratie.filtru_preset;
  const filtru = preseturi.filter_presets?.[filtruId];
  if (!esteObiectSimplu(filtru)) {
    throw new Error(`Presetul de filtru ${filtruId} nu există.`);
  }
  configuratie.filter_preset_id = filtruId;
  configuratie.filter_version = filtru.filter_version ?? preseturi.schema_version ?? 1;
  configuratie.filtru = copieDate(filtru);

  const selectiiPreset = interfata.preset_selectii[analizaId];
  if (!esteObiectSimplu(selectiiPreset)) {
    throw new Error(`Presetul ${analizaId} nu declară selecțiile interfeței.`);
  }
  if (!selectiiEgale(selectii, selectiiPreset, interfata.axe)) {
    configuratie.preset_baza_id = analizaId;
    configuratie.preset_id = `${analizaId}+ajustat`;
    configuratie.selectii_interfata = copieDate(selectii);
  }

  return configuratie;
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
  if (
    ["tabla", "subtabla", "eff", "acelasi_rol_al_necunoscutei"].includes(
      definitie.tip,
    )
  ) {
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
  (elemente.controlere || []).forEach((controler) => {
    controler.seteazaDezactivat(ocupat);
  });
  [elemente.butonReaplicaPreset, elemente.butonFixture, elemente.inputImport, elemente.butonIndexedDB].forEach(
    (element) => {
      element.disabled = ocupat;
    },
  );
}

function dezactiveazaControale(elemente) {
  elemente.radacina.setAttribute("aria-busy", "false");
  (elemente.controlere || []).forEach((controler) => {
    controler.seteazaDezactivat(true);
  });
  [elemente.butonReaplicaPreset, elemente.butonFixture, elemente.inputImport, elemente.butonIndexedDB].forEach(
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
  elemente.controlere = [];
  const stare = {
    preseturi: null,
    catalog: {},
    fixture: [],
    loguri: [],
    sursa: "fixture-ul inclus",
    sursaEsteFixture: true,
    avertismentCatalog: "",
    controlere: {
      preset: null,
      axe: new Map(),
      modAfisare: null,
    },
  };

  function analizaIdCurenta() {
    return stare.controlere.preset?.citeste()[0] ?? null;
  }

  function modAfisareCurent() {
    return stare.controlere.modAfisare?.citeste()[0] ?? "simplu";
  }

  function citesteSelectiiAxe() {
    return Object.fromEntries(
      [...stare.controlere.axe.entries()].map(([axaId, controler]) => [
        axaId,
        controler.citeste(),
      ]),
    );
  }

  function golesteIndisponibilitatiAxe() {
    stare.controlere.axe.forEach((controler) => {
      controler.seteazaIndisponibile({});
    });
  }

  function actualizeazaIndisponibilitatiAxe() {
    const interfata = obtineInterfataDeclarativa(stare.preseturi);
    const selectii = citesteSelectiiAxe();
    interfata.axe.forEach((axa) => {
      const indisponibile = calculeazaIndisponibilePentruAxa(
        interfata,
        selectii,
        axa,
      );
      stare.controlere.axe.get(axa.id)?.seteazaIndisponibile(indisponibile);
    });
  }

  function sincronizeazaAxeCuPreset(analizaId) {
    const selectii = stare.preseturi?.interface?.preset_selectii?.[analizaId];
    if (!esteObiectSimplu(selectii)) {
      throw new Error(`Presetul ${analizaId} nu declară selecțiile interfeței.`);
    }
    golesteIndisponibilitatiAxe();
    stare.preseturi.interface.axe.forEach((axa) => {
      stare.controlere.axe.get(axa.id)?.seteaza(selectii[axa.id] ?? []);
    });
    actualizeazaIndisponibilitatiAxe();
  }

  function configureazaControale(analizaId) {
    const analize = stare.preseturi?.analysis_presets;
    if (!esteObiectSimplu(analize) || !Object.keys(analize).length) {
      throw new Error("Fișierul de preseturi nu conține analize disponibile.");
    }
    const interfata = obtineInterfataDeclarativa(stare.preseturi);
    if (!Object.hasOwn(analize, analizaId)) {
      throw new Error(`Presetul inițial nu există: ${analizaId}.`);
    }

    elemente.containerPreset.replaceChildren();
    elemente.containerAxe.replaceChildren();
    elemente.containerModAfisare.replaceChildren();
    stare.controlere.axe.clear();
    elemente.controlere.length = 0;

    stare.controlere.preset = creeazaGrupOptiuni({
      documentRef,
      container: elemente.containerPreset,
      id: "mabp-grup-preset",
      eticheta: "Preset de pornire",
      ajutor: "Presetul completează toate axele; apoi poți modifica orice alegere.",
      tipSelectie: "unica",
      optiuni: Object.entries(analize).map(([id, preset]) => {
        const metadateInterfata = interfata.preseturi?.[id] || {};
        return {
          id,
          eticheta: eticheteazaAnaliza(id, preset),
          descriere: typeof preset.descriere === "string" ? preset.descriere : undefined,
          dezactivata: metadateInterfata.dezactivata,
          motivDezactivare: metadateInterfata.motiv_dezactivare,
        };
      }),
      selectate: [analizaId],
      laSchimbare: ([idSelectat]) => {
        if (!idSelectat) return;
        sincronizeazaAxeCuPreset(idSelectat);
        actualizeazaAjutorPreset(elemente.ajutorPreset, analize[idSelectat]);
        return ruleazaAnalizaCurenta();
      },
    });
    elemente.controlere.push(stare.controlere.preset);

    interfata.axe.forEach((axa) => {
      const controler = creeazaGrupOptiuni({
        documentRef,
        container: elemente.containerAxe,
        id: `mabp-grup-axa-${axa.id}`,
        eticheta: axa.eticheta,
        ajutor: axa.ajutor,
        tipSelectie: axa.tip_selectie,
        optiuni: axa.optiuni.map((optiune) => ({
          id: optiune.id,
          eticheta: optiune.eticheta,
          descriere: optiune.descriere,
          dezactivata: optiune.dezactivata,
          motivDezactivare: optiune.motiv_dezactivare,
        })),
        selectate: interfata.preset_selectii[analizaId]?.[axa.id] ?? [],
        laSchimbare: () => {
          actualizeazaIndisponibilitatiAxe();
          return ruleazaAnalizaCurenta();
        },
      });
      stare.controlere.axe.set(axa.id, controler);
      elemente.controlere.push(controler);
    });

    const definitieMod = interfata.mod_afisare;
    if (!esteObiectSimplu(definitieMod)) {
      throw new Error("Fișierul de preseturi nu definește `interface.mod_afisare`.");
    }
    stare.controlere.modAfisare = creeazaGrupOptiuni({
      documentRef,
      container: elemente.containerModAfisare,
      id: "mabp-grup-mod-afisare",
      eticheta: definitieMod.eticheta,
      ajutor: definitieMod.ajutor,
      tipSelectie: definitieMod.tip_selectie,
      optiuni: Array.isArray(definitieMod.optiuni)
        ? definitieMod.optiuni.map((optiune) => ({
            id: optiune.id,
            eticheta: optiune.eticheta,
            descriere: optiune.descriere,
            dezactivata: optiune.dezactivata,
            motivDezactivare: optiune.motiv_dezactivare,
          }))
        : definitieMod.optiuni,
      selectate: ["simplu"],
      laSchimbare: () => ruleazaAnalizaCurenta(),
    });
    elemente.controlere.push(stare.controlere.modAfisare);

    actualizeazaIndisponibilitatiAxe();
    actualizeazaAjutorPreset(elemente.ajutorPreset, analize[analizaId]);
  }

  async function ruleazaAnalizaCurenta() {
    seteazaOcupat(elemente, true);
    seteazaMesaj(elemente.mesaj);
    const analizaId = analizaIdCurenta();
    let numeAnaliza = analizaId;
    try {
      if (!analizaId) throw new Error("Nu este selectat niciun preset de pornire.");
      const configuratie = construiesteConfiguratieDinSelectii({
        preseturi: stare.preseturi,
        analizaId,
        selectii: citesteSelectiiAxe(),
      });
      const preset = stare.preseturi.analysis_presets[analizaId];
      numeAnaliza = eticheteazaAnaliza(analizaId, preset);
      if (configuratie.preset_baza_id) numeAnaliza += " · configurație ajustată";
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
          modAfisareCurent(),
        ),
      });
      elemente.statusSursa.textContent = descrieSursa(
        stare,
        "Analiză actualizată",
        numeAnaliza,
        modAfisareCurent(),
      );
      return rezultat;
    } catch (eroare) {
      elemente.rezultat.replaceChildren();
      seteazaMesaj(elemente.mesaj, `Analiza nu a putut fi rulată: ${mesajEroare(eroare)}`, "eroare");
      elemente.statusSursa.textContent = descrieSursa(
        stare,
        "Analiză eșuată pentru sursa",
        numeAnaliza,
        modAfisareCurent(),
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

  function reaplicaPresetCurent() {
    const analizaId = analizaIdCurenta();
    if (!analizaId) throw new Error("Nu este selectat niciun preset de reaplicat.");
    sincronizeazaAxeCuPreset(analizaId);
    actualizeazaAjutorPreset(
      elemente.ajutorPreset,
      stare.preseturi?.analysis_presets?.[analizaId],
    );
    return ruleazaAnalizaCurenta();
  }

  elemente.butonReaplicaPreset.addEventListener(
    "click",
    reaplicaPresetCurent,
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
    const analizaDePornire = analizaInitiala ?? Object.keys(stare.preseturi.analysis_presets)[0];
    configureazaControale(analizaDePornire);
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
