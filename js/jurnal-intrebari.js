(function (global) {
  "use strict";

  const NUME_BAZA_DATE = "youlearn_jurnal_intrebari";
  const VERSIUNE_BAZA_DATE = 1;
  const NUME_COLECTIE = "intrebari";
  const NUME_CANAL = "youlearn_jurnal_intrebari_live";
  let promisiuneBazaDate = null;

  function deschideBazaDate() {
    if (!global.indexedDB) {
      return Promise.reject(new Error("IndexedDB nu este disponibil."));
    }
    if (promisiuneBazaDate) return promisiuneBazaDate;

    promisiuneBazaDate = new Promise((resolve, reject) => {
      const cerere = global.indexedDB.open(NUME_BAZA_DATE, VERSIUNE_BAZA_DATE);
      cerere.onupgradeneeded = () => {
        const bazaDate = cerere.result;
        if (!bazaDate.objectStoreNames.contains(NUME_COLECTIE)) {
          bazaDate.createObjectStore(NUME_COLECTIE, { autoIncrement: true });
        }
      };
      cerere.onsuccess = () => resolve(cerere.result);
      cerere.onerror = () => reject(cerere.error);
      cerere.onblocked = () => reject(new Error("Baza jurnalului este blocata."));
    });

    return promisiuneBazaDate;
  }

  function textObligatoriu(valoare, numeCamp) {
    const text = String(valoare ?? "").trim();
    if (!text) throw new Error(`Campul ${numeCamp} este obligatoriu.`);
    return text;
  }

  function textSauNull(valoare) {
    return valoare == null ? null : String(valoare);
  }

  function normalizeaza(intrebare) {
    if (!intrebare || typeof intrebare !== "object" || Array.isArray(intrebare)) {
      throw new Error("Intrebarea raportata trebuie sa fie un obiect.");
    }

    const apasare = Number(intrebare.al_catelea_turn_apasare_pe_buton);
    const durata = Number(intrebare.durata_raspuns_secunde);
    if (!Number.isInteger(apasare) || apasare < 1) {
      throw new Error("al_catelea_turn_apasare_pe_buton trebuie sa fie un numar intreg pozitiv.");
    }
    if (!Number.isFinite(durata) || durata < 0) {
      throw new Error("durata_raspuns_secunde trebuie sa fie un numar pozitiv.");
    }
    if (
      intrebare.a_raspuns_corect != null &&
      typeof intrebare.a_raspuns_corect !== "boolean"
    ) {
      throw new Error("a_raspuns_corect trebuie sa fie true, false sau null.");
    }

    const pozitieButon = intrebare.pozitie_buton_apasat_pt_raspuns;
    if (
      pozitieButon != null &&
      (!Number.isInteger(Number(pozitieButon)) || Number(pozitieButon) < 1 || Number(pozitieButon) > 3)
    ) {
      throw new Error("pozitie_buton_apasat_pt_raspuns trebuie sa fie 1, 2, 3 sau null.");
    }

    const variante = intrebare.valori_variante_de_raspuns;
    if (variante != null && !Array.isArray(variante)) {
      throw new Error("valori_variante_de_raspuns trebuie sa fie o lista sau null.");
    }

    const hints = intrebare.hints_aratate_pt_raspuns;
    if (hints != null && (typeof hints !== "object" || Array.isArray(hints))) {
      throw new Error("hints_aratate_pt_raspuns trebuie sa fie un obiect sau null.");
    }

    const extra = intrebare.extra;
    if (!extra || typeof extra !== "object" || Array.isArray(extra)) {
      throw new Error("extra trebuie sa fie un obiect.");
    }

    return {
      data_ora_ro: textObligatoriu(intrebare.data_ora_ro, "data_ora_ro"),
      quiz_name: textObligatoriu(intrebare.quiz_name, "quiz_name"),
      subquiz_name: textSauNull(intrebare.subquiz_name),
      intrebare: textObligatoriu(intrebare.intrebare, "intrebare"),
      raspuns: textObligatoriu(intrebare.raspuns, "raspuns"),
      a_raspuns_corect:
        intrebare.a_raspuns_corect == null ? null : intrebare.a_raspuns_corect === true,
      al_catelea_turn_apasare_pe_buton: apasare,
      durata_raspuns_secunde: Math.round(durata * 10) / 10,
      fact: textObligatoriu(intrebare.fact, "fact"),
      quiz_id: textObligatoriu(intrebare.quiz_id, "quiz_id"),
      subquiz_id: textSauNull(intrebare.subquiz_id),
      fact_id: textObligatoriu(intrebare.fact_id, "fact_id"),
      eq_form: textObligatoriu(intrebare.eq_form, "eq_form"),
      pozitie_buton_apasat_pt_raspuns:
        pozitieButon == null ? null : Number(pozitieButon),
      valori_variante_de_raspuns:
        variante == null ? null : variante.map((valoare) => textSauNull(valoare)),
      valoare_raspuns_corect: textSauNull(intrebare.valoare_raspuns_corect),
      hints_aratate_pt_raspuns: hints == null ? null : { ...hints },
      extra: { ...extra },
    };
  }

  function salveaza(bazaDate, obiectNou) {
    return new Promise((resolve, reject) => {
      const tranzactie = bazaDate.transaction(NUME_COLECTIE, "readwrite");
      tranzactie.objectStore(NUME_COLECTIE).add(obiectNou);
      tranzactie.oncomplete = () => resolve(obiectNou);
      tranzactie.onerror = () => reject(tranzactie.error);
      tranzactie.onabort = () => reject(tranzactie.error);
    });
  }

  function anuntaVizualizarea() {
    if (typeof global.BroadcastChannel !== "function") return;
    const canal = new global.BroadcastChannel(NUME_CANAL);
    canal.postMessage({ tip: "intrebare_noua" });
    canal.close();
  }

  async function inregistreazaIntrebare(intrebare) {
    try {
      const obiectNou = normalizeaza(intrebare);
      const bazaDate = await deschideBazaDate();
      await salveaza(bazaDate, obiectNou);
      anuntaVizualizarea();
      return obiectNou;
    } catch (error) {
      global.console?.error?.("[JurnalIntrebari] Intrebarea nu a putut fi salvata.", error);
      return null;
    }
  }

  global.JurnalIntrebari = { inregistreazaIntrebare };
})(window);
