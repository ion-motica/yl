// Motor de analiză pentru „Vizualizare 3 - Claude".
// Funcție pură: fără DOM, fără IndexedDB, fără variabile globale.
// Citirea datelor aparține codului apelant (bootstrap-ul).
//
// Contract public (vezi SPECIFICATIE.md, secțiunea 4):
//   ruleazaAnaliza({ inregistrari, catalog, configuratie }) -> model vizualizare
//
// Etapa 1 implementează primii pași ai fluxului:
//   valideaza -> normalizeaza -> grupeazaApasarilePeIntrebari
// Restul pașilor se adaugă în etapele următoare, fără a schimba acest flux.

(function (global) {
  "use strict";

  // ---- normalizare -----------------------------------------------------

  // Aduce o înregistrare brută (o apăsare) la câmpurile canonice folosite de
  // analiză. Ce lipsește rămâne `null`; nu inventăm valori.
  function normalizeazaInregistrare(bruta) {
    const camp = (valoare) => (valoare === undefined ? null : valoare);
    return {
      data_ora_ro: camp(bruta?.data_ora_ro),
      quiz_id: camp(bruta?.quiz_id),
      subquiz_id: camp(bruta?.subquiz_id),
      fact_id: camp(bruta?.fact_id),
      fact: camp(bruta?.fact),
      eq_form: camp(bruta?.eq_form),
      intrebare: camp(bruta?.intrebare),
      raspuns: camp(bruta?.raspuns),
      // Numele real, folosit de tot restul aplicatiei, e `a_raspuns_corect`
      // (vezi js/jurnal-intrebari.js); `raspuns_corect` e doar aliasul pe care
      // il foloseste fixture-ul demonstrativ de aici. Acelasi ordine de
      // preferinta ca in `Vizualizare si interpretare logs/mabp-analiza.js`.
      raspuns_corect: normalizeazaBoolean(bruta?.a_raspuns_corect ?? bruta?.raspuns_corect),
      a_cata_apasare_pe_buton: normalizeazaNumarApasare(bruta?.a_cata_apasare_pe_buton),
      durata_raspuns_secunde: normalizeazaDurata(bruta?.durata_raspuns_secunde),
    };
  }

  function normalizeazaBoolean(valoare) {
    if (valoare === true || valoare === false) return valoare;
    return null;
  }

  // Numărul apăsării delimitează întrebările: `1` începe o întrebare nouă.
  // O valoare invalidă rămâne `null` (nu presupunem `1`).
  function normalizeazaNumarApasare(valoare) {
    const numar = Number(valoare);
    return Number.isInteger(numar) && numar >= 1 ? numar : null;
  }

  function normalizeazaDurata(valoare) {
    const numar = Number(valoare);
    return Number.isFinite(numar) && numar >= 0 ? numar : null;
  }

  function normalizeaza(inregistrari) {
    if (!Array.isArray(inregistrari)) {
      throw new Error("Motorul are nevoie de un array de înregistrări.");
    }
    return inregistrari.map(normalizeazaInregistrare);
  }

  // ---- grupare apăsări -> întrebări ------------------------------------

  // Regula contractului: înregistrările vin în ordinea salvării. Valoarea
  // `a_cata_apasare_pe_buton === 1` începe o întrebare nouă; `2`, `3` etc.
  // continuă aceeași întrebare până la următorul `1`. Timestampul NU este
  // folosit pentru delimitare.
  //
  // Apăsările de dinaintea primului `1` (istoric incomplet) sunt ignorate
  // explicit, nu atașate greșit unei întrebări inventate.
  function grupeazaApasarilePeIntrebari(normalizate) {
    const intrebari = [];
    let apasariCurente = null;

    normalizate.forEach((inregistrare) => {
      const inceputIntrebareNoua = inregistrare.a_cata_apasare_pe_buton === 1;
      if (inceputIntrebareNoua) {
        if (apasariCurente) intrebari.push(construiesteIntrebare(apasariCurente));
        apasariCurente = [inregistrare];
        return;
      }
      if (apasariCurente) apasariCurente.push(inregistrare);
      // altfel: apăsare fără un `1` anterior -> ignorată (istoric incomplet).
    });

    if (apasariCurente) intrebari.push(construiesteIntrebare(apasariCurente));
    return intrebari;
  }

  // O întrebare = toate apăsările ei, rezumate. Prima apăsare dă reacția
  // inițială; o apăsare corectă ulterioară dă corectarea.
  function construiesteIntrebare(apasari) {
    const prima = apasari[0];
    const apasareCorecta = apasari.find((a) => a.raspuns_corect === true) || null;
    const raspunsuriGresite = apasari
      .filter((a) => a.raspuns_corect === false)
      .map((a) => a.raspuns);

    return {
      data_ora_ro: prima.data_ora_ro,
      quiz_id: prima.quiz_id,
      subquiz_id: prima.subquiz_id,
      fact_id: prima.fact_id,
      fact: prima.fact,
      eq_form: prima.eq_form,
      intrebare: prima.intrebare,
      primul_raspuns: prima.raspuns,
      corect_din_prima: prima.raspuns_corect,
      timp_primul_raspuns_secunde: prima.durata_raspuns_secunde,
      numar_apasari: apasari.length,
      corectat_in_final: apasareCorecta !== null,
      timp_pana_la_corect_secunde: apasareCorecta
        ? apasareCorecta.durata_raspuns_secunde
        : null,
      raspunsuri_gresite: raspunsuriGresite,
    };
  }

  // ---- maparea fact -> celulă (SINGURUL punct care „citește" operația) --

  // Punct unic și înlocuibil. Citește câmpul canonic `fact` raportat de quiz
  // (ex. "7*8=56"), nu textul întrebării, și întoarce cheia celulei poziționale.
  // Dacă vrei altă sursă de mapare (catalog explicit fact_id, familyKey etc.),
  // înlocuiești DOAR această funcție.
  function cheieCelulaDinInregistrare(intrebare) {
    const potrivire = String(intrebare?.fact ?? "").match(
      /^\s*(\d+)\s*[*x×]\s*(\d+)\s*=/
    );
    if (!potrivire) return null;
    return `mul:${Number(potrivire[1])}x${Number(potrivire[2])}`;
  }

  // ---- selecția domeniului ---------------------------------------------

  // Grupează întrebările pe celulele catalogului. Întrebările a căror celulă
  // nu există în catalog rămân separat (necatalogate), nu se pierd în tăcere.
  function selecteazaDomeniu(intrebari, catalog) {
    const celuleCunoscute = new Set((catalog?.celule ?? []).map((c) => c.cell_id));
    const peCelula = new Map();
    const necatalogate = [];

    intrebari.forEach((intrebare) => {
      const cheie = cheieCelulaDinInregistrare(intrebare);
      if (cheie && celuleCunoscute.has(cheie)) {
        if (!peCelula.has(cheie)) peCelula.set(cheie, []);
        peCelula.get(cheie).push(intrebare);
      } else {
        necatalogate.push(intrebare);
      }
    });

    return { peCelula, necatalogate };
  }

  // ---- segmentarea în calupuri -----------------------------------------

  // Un calup = un set de întrebări comparabile. În prototip există un singur
  // calup („tot istoricul"): `curent`. `referinta` (pentru progres) rămâne null.
  function segmenteazaInCalupuri(intrebariCelula, segmentare) {
    const tip = segmentare?.tip ?? "tot_istoricul";
    if (tip !== "tot_istoricul") {
      throw new Error(`Segmentare necunoscută: ${tip}`);
    }
    return { curent: intrebariCelula, referinta: null };
  }

  // ---- filtrarea (standard v1) -----------------------------------------

  // Nu șterge întrebări; marchează care intră în calculul vitezei. Precizia
  // folosește toate primele apăsări (dacă nu ceri altfel din configurare).
  function aplicaFiltre(calup, filtru) {
    const intrebari = calup?.curent ?? [];
    const timpValidPtViteza = (intrebare) => {
      const t = intrebare.timp_primul_raspuns_secunde;
      if (t === null) return false;
      return t >= filtru.timp_minim_secunde && t <= filtru.timp_maxim_secunde;
    };

    const pentruViteza = intrebari.filter(
      (intrebare) =>
        (!filtru.viteza_doar_corect_din_prima || intrebare.corect_din_prima === true) &&
        timpValidPtViteza(intrebare)
    );
    const pentruPrecizie = filtru.exclude_timpi_extremi_din_precizie
      ? intrebari.filter(
          (intrebare) =>
            intrebare.timp_primul_raspuns_secunde === null ||
            timpValidPtViteza(intrebare)
        )
      : intrebari;

    return { pentruPrecizie, pentruViteza };
  }

  // ---- statistici -------------------------------------------------------

  function mediana(valori) {
    if (!valori.length) return null;
    const sortate = [...valori].sort((a, b) => a - b);
    const mijloc = Math.floor(sortate.length / 2);
    const valoare =
      sortate.length % 2
        ? sortate[mijloc]
        : (sortate[mijloc - 1] + sortate[mijloc]) / 2;
    // Timpii sunt la o zecimală; mediana pe număr par are pasul 0,05.
    // Rotunjim la 2 zecimale ca să eliminăm zgomotul de virgulă mobilă.
    return Math.round(valoare * 100) / 100;
  }

  function ziDin(dataOraRo) {
    const text = String(dataOraRo ?? "");
    const potrivire = text.match(/^\d{4}-\d{2}-\d{2}/);
    return potrivire ? potrivire[0] : null;
  }

  function calculeazaStatistici(dateFiltrate) {
    const { pentruPrecizie, pentruViteza } = dateFiltrate;
    const cuRezultatPrima = pentruPrecizie.filter(
      (intrebare) => intrebare.corect_din_prima !== null
    );
    const corecteDinPrima = cuRezultatPrima.filter(
      (intrebare) => intrebare.corect_din_prima === true
    );
    const zileDistincte = new Set(
      cuRezultatPrima.map((intrebare) => ziDin(intrebare.data_ora_ro)).filter(Boolean)
    );

    return {
      n: cuRezultatPrima.length,
      zile_distincte: zileDistincte.size,
      precizie_prima: cuRezultatPrima.length
        ? corecteDinPrima.length / cuRezultatPrima.length
        : null,
      mediana_timp: mediana(
        pentruViteza.map((intrebare) => intrebare.timp_primul_raspuns_secunde)
      ),
    };
  }

  // ---- interpretarea (clasificarea stării) -----------------------------

  // Progresia stărilor și câte pătrățele afișează fiecare.
  const TRASEU_STARE = Object.freeze({
    netestat: 0,
    abia_inceput: 1,
    nu_il_stie: 2,
    in_lucru: 3,
    fluent: 4,
  });

  function clasificaStare(statistici, pragStare) {
    if (statistici.n === 0) return "netestat";
    if (
      statistici.n < pragStare.n_minim ||
      statistici.zile_distincte < pragStare.zile_distincte_minim
    ) {
      return "abia_inceput";
    }
    const { precizie_prima: precizie, mediana_timp: timp } = statistici;
    if (
      timp !== null &&
      precizie >= pragStare.fluent.precizie_minima &&
      timp <= pragStare.fluent.mediana_maxima_secunde
    ) {
      return "fluent";
    }
    if (
      timp !== null &&
      precizie >= pragStare.in_lucru.precizie_minima &&
      timp <= pragStare.in_lucru.mediana_maxima_secunde
    ) {
      return "in_lucru";
    }
    return "nu_il_stie";
  }

  // ---- modelul de vizualizare ------------------------------------------

  // Materializează TOATE celulele catalogului, inclusiv cele fără observații
  // (n:0, netestat). Vizualizarea doar așază; nu recalculează.
  function construiesteModelVizualizare({ catalog, statisticiPeCelula }) {
    const celule = catalog.celule.map((celulaCatalog) => {
      const statistici = statisticiPeCelula.get(celulaCatalog.cell_id) ?? {
        n: 0,
        zile_distincte: 0,
        precizie_prima: null,
        mediana_timp: null,
        stare: "netestat",
      };
      return {
        cell_id: celulaCatalog.cell_id,
        a: celulaCatalog.a,
        b: celulaCatalog.b,
        rand: celulaCatalog.rand,
        coloana: celulaCatalog.coloana,
        eticheta: celulaCatalog.eticheta,
        rezultat: celulaCatalog.rezultat,
        stare: statistici.stare,
        traseu: TRASEU_STARE[statistici.stare] ?? 0,
        n: statistici.n,
        zile_distincte: statistici.zile_distincte,
        precizie_prima: statistici.precizie_prima,
        mediana_timp: statistici.mediana_timp,
      };
    });

    return {
      catalog_id: catalog.catalog_id,
      table_id: catalog.table_id,
      randuri: catalog.randuri,
      coloane: catalog.coloane,
      celule,
    };
  }

  // ---- validarea intrărilor --------------------------------------------

  function valideaza(inregistrari, catalog, configuratie) {
    if (!Array.isArray(inregistrari)) {
      throw new Error("Motorul are nevoie de un array de înregistrări.");
    }
    if (!catalog || !Array.isArray(catalog.celule)) {
      throw new Error("Motorul are nevoie de un catalog cu celule.");
    }
    if (!configuratie || typeof configuratie !== "object") {
      throw new Error("Motorul are nevoie de o configurație.");
    }
  }

  // ---- fluxul public ----------------------------------------------------

  // Flux procedural, citibil de sus în jos (vezi SPECIFICATIE.md, secțiunea 4).
  function ruleazaAnaliza({ inregistrari, catalog, configuratie, praguri }) {
    valideaza(inregistrari, catalog, configuratie);
    const filtru = configuratie.filtrare?.filtru ?? praguri.filtru_standard_v1;
    const pragStare = praguri.stare;

    const normalizate = normalizeaza(inregistrari);
    const intrebari = grupeazaApasarilePeIntrebari(normalizate);
    const domeniu = selecteazaDomeniu(intrebari, catalog);

    const statisticiPeCelula = new Map();
    domeniu.peCelula.forEach((intrebariCelula, cellId) => {
      const calup = segmenteazaInCalupuri(intrebariCelula, configuratie.segmentare);
      const dateFiltrate = aplicaFiltre(calup, filtru);
      const statistici = calculeazaStatistici(dateFiltrate);
      statistici.stare = clasificaStare(statistici, pragStare);
      statisticiPeCelula.set(cellId, statistici);
    });

    return construiesteModelVizualizare({ catalog, statisticiPeCelula });
  }

  // ---- API public ------------------------------------------------------

  global.MotorAnalizaVizualizare3 = Object.freeze({
    normalizeaza,
    grupeazaApasarilePeIntrebari,
    cheieCelulaDinInregistrare,
    selecteazaDomeniu,
    aplicaFiltre,
    calculeazaStatistici,
    clasificaStare,
    ruleazaAnaliza,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
