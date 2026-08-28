(function (global) {
  "use strict";

  const NUME_BAZA_DATE = "youlearn_jurnal_intrebari";
  const VERSIUNE_BAZA_DATE = 1;
  const NUME_COLECTIE = "intrebari";
  const NUME_CANAL = "youlearn_jurnal_intrebari_live";
  const CAMPURI = [
    "data_ora_ro",
    "quiz_name",
    "subquiz_name",
    "intrebare",
    "raspuns",
    "a_raspuns_corect",
    "al_catelea_turn_apasare_pe_buton",
    "durata_raspuns_secunde",
    "fact",
    "quiz_id",
    "subquiz_id",
    "fact_id",
    "eq_form",
    "pozitie_buton_apasat_pt_raspuns",
    "valori_variante_de_raspuns",
    "valoare_raspuns_corect",
    "hints_aratate_pt_raspuns",
    "extra",
  ];

  const tabelHead = document.querySelector("#jurnal-head");
  const tabelBody = document.querySelector("#jurnal-body");
  const status = document.querySelector("#jurnal-status");
  const scrollContainer = document.querySelector("#jurnal-scroll");
  let bazaDate = null;

  function textCelula(valoare) {
    if (valoare == null) return "null";
    if (typeof valoare === "object") return JSON.stringify(valoare);
    return String(valoare);
  }

  function construiesteAntet() {
    const rand = document.createElement("tr");
    CAMPURI.forEach((camp) => {
      const celula = document.createElement("th");
      celula.scope = "col";
      celula.textContent = camp;
      rand.appendChild(celula);
    });
    tabelHead.replaceChildren(rand);
  }

  function deschideBazaDate() {
    return new Promise((resolve, reject) => {
      const cerere = global.indexedDB.open(NUME_BAZA_DATE, VERSIUNE_BAZA_DATE);
      cerere.onupgradeneeded = () => {
        const db = cerere.result;
        if (!db.objectStoreNames.contains(NUME_COLECTIE)) {
          db.createObjectStore(NUME_COLECTIE, { autoIncrement: true });
        }
      };
      cerere.onsuccess = () => resolve(cerere.result);
      cerere.onerror = () => reject(cerere.error);
    });
  }

  function citesteToate() {
    return new Promise((resolve, reject) => {
      const tranzactie = bazaDate.transaction(NUME_COLECTIE, "readonly");
      const cerere = tranzactie.objectStore(NUME_COLECTIE).getAll();
      cerere.onsuccess = () => resolve(Array.isArray(cerere.result) ? cerere.result : []);
      cerere.onerror = () => reject(cerere.error);
    });
  }

  async function afiseaza() {
    try {
      const intrari = await citesteToate();
      const fragment = document.createDocumentFragment();
      intrari.forEach((intrare) => {
        const rand = document.createElement("tr");
        CAMPURI.forEach((camp) => {
          const celula = document.createElement("td");
          celula.textContent = textCelula(intrare[camp]);
          rand.appendChild(celula);
        });
        fragment.appendChild(rand);
      });
      tabelBody.replaceChildren(fragment);
      status.textContent = `${intrari.length} inregistrari`;
      if (intrari.length) {
        scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: "smooth" });
      }
    } catch (error) {
      status.textContent = "Jurnalul nu a putut fi citit.";
      global.console?.error?.("[JurnalIntrebariViewer] Citirea a esuat.", error);
    }
  }

  async function porneste() {
    construiesteAntet();
    bazaDate = await deschideBazaDate();
    await afiseaza();
    if (typeof global.BroadcastChannel === "function") {
      const canal = new global.BroadcastChannel(NUME_CANAL);
      canal.addEventListener("message", afiseaza);
    }
  }

  porneste().catch((error) => {
    status.textContent = "Jurnalul nu a putut fi deschis.";
    global.console?.error?.("[JurnalIntrebariViewer] Pornirea a esuat.", error);
  });
})(window);
