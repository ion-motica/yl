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

  // Apăsare oarbă (sub plancher): nu e un răspuns citit, iese și din precizie.
  // Câmp opțional: filtrele care nu-l au (ex. filtru_standard_v1) nu exclud nimic aici.
  function esteRaspunsImpulsiv(intrebare, filtru) {
    const prag = filtru.plancher_impulsivitate_secunde;
    const t = intrebare.timp_primul_raspuns_secunde;
    return prag != null && t !== null && t < prag;
  }

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
        !esteRaspunsImpulsiv(intrebare, filtru) &&
        (!filtru.viteza_doar_corect_din_prima || intrebare.corect_din_prima === true) &&
        timpValidPtViteza(intrebare)
    );
    const pentruPrecizieBaza = filtru.exclude_timpi_extremi_din_precizie
      ? intrebari.filter(
          (intrebare) =>
            intrebare.timp_primul_raspuns_secunde === null ||
            timpValidPtViteza(intrebare)
        )
      : intrebari;
    const pentruPrecizie = pentruPrecizieBaza.filter(
      (intrebare) => !esteRaspunsImpulsiv(intrebare, filtru)
    );

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

  // ---- interpretare v1: scorul de apropiere de fluență (SPECIFICATIE.md §13) --

  // Rampă crescătoare 0..1: sub prag0 -> 0, peste prag1 -> 1, liniar între.
  // Folosită pentru corectitudine (prag0 = ghicit, prag1 = plin).
  function rampaCrescatoare(valoare, prag0, prag1) {
    if (valoare === null) return 0;
    if (valoare <= prag0) return 0;
    if (valoare >= prag1) return 1;
    return (valoare - prag0) / (prag1 - prag0);
  }

  // Rampă descrescătoare 0..1: sub prag1 -> 1, peste prag0 -> 0, liniar între.
  // Folosită pentru viteză (prag0 = zero/lent, prag1 = plin/rapid).
  function rampaDescrescatoare(valoare, prag0, prag1) {
    if (valoare === null) return 0;
    if (valoare <= prag1) return 1;
    if (valoare >= prag0) return 0;
    return (prag0 - valoare) / (prag0 - prag1);
  }

  // Scorul unui singur fact: înmulțirea celor două rampe (ambele condiții
  // simultan, nu adunare — vezi §13). Netestat (n=0) -> 0, „praf".
  function calculeazaScorFact(statisticiFact, praguriInterpretareV1) {
    if (!statisticiFact.n) {
      return { scor: 0, coef_corectitudine: 0, coef_viteza: 0 };
    }
    const { corectitudine, viteza } = praguriInterpretareV1;
    const coefCorectitudine = rampaCrescatoare(
      statisticiFact.precizie_prima,
      corectitudine.prag_ghicit,
      corectitudine.prag_plin
    );
    const coefViteza = rampaDescrescatoare(
      statisticiFact.mediana_timp,
      viteza.secunde_zero,
      viteza.secunde_plin
    );
    return {
      scor: coefCorectitudine * coefViteza,
      coef_corectitudine: coefCorectitudine,
      coef_viteza: coefViteza,
    };
  }

  // Etichetă de încredere per fereastră+calup, din n valide și zile distincte
  // (§13, tabelul de etichete — texte fixate de user).
  const ETICHETE_INCREDERE_SCOR = Object.freeze({
    date_insuficiente: "Date insuficiente — nu calculăm",
    incredere_mica: "Date puține — încredere mică în coeficient",
    incredere_mare: "Date suficiente — încredere mare în coeficient",
  });

  function clasificaIncredereScor(nTotal, zileDistincte, praguriIncredere) {
    if (nTotal < praguriIncredere.n_minim_calcul) return "date_insuficiente";
    if (
      nTotal >= praguriIncredere.n_incredere_mare &&
      zileDistincte >= praguriIncredere.zile_distincte_incredere_mare
    ) {
      return "incredere_mare";
    }
    return "incredere_mica";
  }

  // Scorul unei ferestre de facts (ex. o subtablă) într-un calup: media
  // scorurilor per fact din `celuleFereastra`, cu netestat = 0. `intrebari`
  // conține toate întrebările calupului (poate acoperi mai multe facts);
  // gruparea pe celulă reutilizează `selecteazaDomeniu`.
  //
  // NU implementează încă plafonarea pe acoperire (sub jumătate din facts
  // testate -> „date puține" chiar cu n mare) — era DE CONFIRMAT în §13, nu
  // decisă de user.
  function calculeazaScorFluenta({ intrebari, celuleFereastra, praguri }) {
    const praguriV1 = praguri.interpretare_v1;
    const catalogFereastra = {
      celule: celuleFereastra.map((cellId) => ({ cell_id: cellId })),
    };
    const domeniu = selecteazaDomeniu(intrebari, catalogFereastra);

    let sumaScoruri = 0;
    let nTotal = 0;
    let factsTestate = 0;
    const zileDistincteFereastra = new Set();

    celuleFereastra.forEach((cellId) => {
      const intrebariCelula = domeniu.peCelula.get(cellId) ?? [];
      const calup = segmenteazaInCalupuri(intrebariCelula, { tip: "tot_istoricul" });
      const filtrate = aplicaFiltre(calup, praguriV1.filtru);
      const statistici = calculeazaStatistici(filtrate);
      const { scor } = calculeazaScorFact(statistici, praguriV1);

      sumaScoruri += scor;
      nTotal += statistici.n;
      if (statistici.n > 0) factsTestate += 1;
      intrebariCelula.forEach((intrebare) => {
        const zi = ziDin(intrebare.data_ora_ro);
        if (zi) zileDistincteFereastra.add(zi);
      });
    });

    const factsTotal = celuleFereastra.length;
    const zileDistincte = zileDistincteFereastra.size;
    const eticheta = clasificaIncredereScor(nTotal, zileDistincte, praguriV1.incredere);

    return {
      scor:
        eticheta === "date_insuficiente" || !factsTotal
          ? null
          : sumaScoruri / factsTotal,
      eticheta,
      eticheta_text: ETICHETE_INCREDERE_SCOR[eticheta],
      n_total: nTotal,
      zile_distincte: zileDistincte,
      facts_testate: factsTestate,
      facts_total: factsTotal,
    };
  }

  // ---- segmentarea în calupuri (pentru seria de scoruri, §13) -----------

  // „Răspuns valid" = exact ce numără calculeazaStatistici ca `n` (are
  // rezultat, nu e impulsiv, respectă intervalul de timp dacă filtrul cere
  // asta) — garantează n_valide al calupului == n_total al scorului.
  function esteRaspunsValidPentruCalup(intrebare, filtru) {
    if (intrebare.corect_din_prima === null || intrebare.corect_din_prima === undefined) {
      return false;
    }
    if (esteRaspunsImpulsiv(intrebare, filtru)) return false;
    if (filtru.exclude_timpi_extremi_din_precizie) {
      const t = intrebare.timp_primul_raspuns_secunde;
      if (t !== null && (t < filtru.timp_minim_secunde || t > filtru.timp_maxim_secunde)) {
        return false;
      }
    }
    return true;
  }

  // Închide un calup colectat NOU -> VECHI (timpul scanării înapoi) și îl
  // aduce la forma cronologică (VECHI -> NOU) cerută de contract.
  function inchideCalup(calupNouVechi, nValide, complet, indexDinPrezent, filtru) {
    const intrebariCronologic = calupNouVechi.slice().reverse();
    const zileValide = intrebariCronologic
      .filter((intrebare) => esteRaspunsValidPentruCalup(intrebare, filtru))
      .map((intrebare) => ziDin(intrebare.data_ora_ro))
      .filter(Boolean);
    return {
      index_din_prezent: indexDinPrezent,
      intrebari: intrebariCronologic,
      n_valide: nValide,
      complet,
      data_prima_zi: zileValide.length ? zileValide[0] : null,
      data_ultima_zi: zileValide.length ? zileValide[zileValide.length - 1] : null,
    };
  }

  // Taie istoricul unei ferestre de facts în calupuri de `marimeCalup`
  // răspunsuri valide consecutive, ANCORATE ÎN PREZENT: se scanează de la cel
  // mai recent răspuns spre cel mai vechi, deci calupul incomplet (dacă
  // există) e mereu cel mai vechi, nu cel mai nou. Returnează cronologic
  // (vechi -> nou); `index_din_prezent` (0 = cel mai recent) merge în
  // celălalt sens. `intrebari` = întrebări GRUPATE (ca la calculeazaScorFluenta).
  function segmenteazaFereastraInCalupuri({ intrebari, celuleFereastra, marimeCalup, filtru }) {
    if (!Array.isArray(intrebari)) {
      throw new Error("Segmentarea are nevoie de un array de întrebări.");
    }
    if (!Number.isInteger(marimeCalup) || marimeCalup < 1) {
      throw new Error("Mărimea calupului trebuie să fie un întreg pozitiv.");
    }

    const cheiFereastra = new Set(celuleFereastra);
    const aleFerestrei = intrebari.filter((intrebare) =>
      cheiFereastra.has(cheieCelulaDinInregistrare(intrebare))
    );

    const calupuri = [];
    let calupCurent = []; // colectat NOU -> VECHI; inchideCalup il aduce cronologic
    let nValide = 0;

    for (let i = aleFerestrei.length - 1; i >= 0; i--) {
      const intrebare = aleFerestrei[i];
      calupCurent.push(intrebare);
      if (esteRaspunsValidPentruCalup(intrebare, filtru)) nValide++;
      if (nValide === marimeCalup) {
        calupuri.push(inchideCalup(calupCurent, nValide, true, calupuri.length, filtru));
        calupCurent = [];
        nValide = 0;
      }
    }
    // Calupul rămas (cel mai vechi) se emite doar dacă are măcar un răspuns
    // valid; un rest compus doar din invalide nu e un calup.
    if (nValide >= 1) {
      calupuri.push(inchideCalup(calupCurent, nValide, false, calupuri.length, filtru));
    }

    return calupuri.reverse();
  }

  // Seria de scoruri a unei ferestre: un element per calup, cronologic
  // (vechi -> nou) — rândul complet al viitorului tabel.
  function calculeazaSerieScorFluenta({ intrebari, celuleFereastra, marimeCalup, praguri }) {
    const filtru = praguri.interpretare_v1.filtru;
    const calupuri = segmenteazaFereastraInCalupuri({
      intrebari,
      celuleFereastra,
      marimeCalup,
      filtru,
    });
    return calupuri.map((calup) => ({
      ...calculeazaScorFluenta({ intrebari: calup.intrebari, celuleFereastra, praguri }),
      index_din_prezent: calup.index_din_prezent,
      n_valide: calup.n_valide,
      complet: calup.complet,
      data_prima_zi: calup.data_prima_zi,
      data_ultima_zi: calup.data_ultima_zi,
    }));
  }

  // ---- modelul tabelului de scor pe calupuri (§13, fotografii stratificate v2) --

  // Eticheta antetului unei poze care nu e „acum": ziua din data_ora_ro a
  // ultimului răspuns valid inclus, formatul "zz.ll" (fixat de user).
  function formateazaZiuaAntet(dataOraRo) {
    const text = String(dataOraRo ?? "");
    return `${text.slice(8, 10)}.${text.slice(5, 7)}`;
  }

  // Fereastra unui fact la momentul `k` (indexul din `valide` până la care se
  // uită înapoi, exclusiv): ultimele `adancime` răspunsuri valide ale
  // factului, oricât de vechi. Fără redistribuire între facts (decis).
  function fereastraFactLaMoment(valide, cellId, k, adancime) {
    const aleFactului = valide
      .slice(0, k)
      .filter((intrebare) => cheieCelulaDinInregistrare(intrebare) === cellId);
    return aleFactului.slice(Math.max(0, aleFactului.length - adancime));
  }

  // O celulă a tabelului = o fotografie a stării ferestrei (`cellIds`) la
  // momentul `k`, prin eșantionare stratificată per fact (SPECIFICATIE.md
  // §13, „Fotografii — v2"). Scorul brut se calculează ÎNTOTDEAUNA — eticheta
  // de încredere decide doar afișarea, nu calculul.
  function construiesteCelulaFoto({ valide, cellIds, k, kAnterior, adancime, praguriV1 }) {
    let sumaScoruri = 0;
    let nTotal = 0;
    let factsTestate = 0;
    let factsNoi = 0;
    const zileContribuite = [];

    cellIds.forEach((cellId) => {
      const fereastra = fereastraFactLaMoment(valide, cellId, k, adancime);
      const statistici = calculeazaStatistici(aplicaFiltre({ curent: fereastra }, praguriV1.filtru));
      const { scor } = calculeazaScorFact(statistici, praguriV1);

      sumaScoruri += scor;
      nTotal += statistici.n;
      if (statistici.n > 0) factsTestate += 1;

      const areRaspunsNou = valide
        .slice(kAnterior, k)
        .some((intrebare) => cheieCelulaDinInregistrare(intrebare) === cellId);
      if (areRaspunsNou) factsNoi += 1;

      fereastra.forEach((intrebare) => {
        const zi = ziDin(intrebare.data_ora_ro);
        if (zi) zileContribuite.push(zi);
      });
    });

    zileContribuite.sort();
    const zileDistincte = new Set(zileContribuite).size;
    const eticheta = clasificaIncredereScor(nTotal, zileDistincte, praguriV1.incredere);

    return {
      scor: cellIds.length ? sumaScoruri / cellIds.length : 0,
      eticheta,
      eticheta_text: ETICHETE_INCREDERE_SCOR[eticheta],
      n: nTotal,
      zile_distincte: zileDistincte,
      facts_testate: factsTestate,
      facts_total: cellIds.length,
      facts_noi: factsNoi,
      data_prima_zi: zileContribuite.length ? zileContribuite[0] : null,
      data_ultima_zi: zileContribuite.length ? zileContribuite[zileContribuite.length - 1] : null,
    };
  }

  // Construiește modelul tabelului „% fluență per subtablă": un rând per
  // subtablă (valoare distinctă `a` din catalog) + un rând „Toată fereastra",
  // coloane = fotografii ale ferestrei, ancorate în prezent (momente comune
  // tuturor rândurilor, cronologic vechi -> noi; ultima = „acum").
  // `inregistrari` sunt BRUTE, ca la ruleazaAnaliza.
  function construiesteModelTabelFluenta({ inregistrari, catalog, adancime, praguri }) {
    if (!Array.isArray(inregistrari)) {
      throw new Error("Motorul are nevoie de un array de înregistrări.");
    }
    if (!catalog || !Array.isArray(catalog.celule)) {
      throw new Error("Motorul are nevoie de un catalog cu celule.");
    }
    if (!Number.isInteger(adancime) || adancime < 1) {
      throw new Error("Adâncimea fotografiei trebuie să fie un întreg pozitiv.");
    }

    const praguriV1 = praguri.interpretare_v1;
    const intrebari = grupeazaApasarilePeIntrebari(normalizeaza(inregistrari));
    const celuleCunoscute = new Set(catalog.celule.map((c) => c.cell_id));
    const aleDomeniului = intrebari.filter((intrebare) =>
      celuleCunoscute.has(cheieCelulaDinInregistrare(intrebare))
    );
    const valide = aleDomeniului.filter((intrebare) =>
      esteRaspunsValidPentruCalup(intrebare, praguriV1.filtru)
    );
    const B = valide.length;

    const valoriA = [...new Set(catalog.celule.map((c) => c.a))].sort((x, y) => x - y);
    const factsPerSubtabla = catalog.celule.filter((c) => c.a === valoriA[0]).length;
    const ferestre = valoriA.map((a) => ({
      tip: "subtabla",
      eticheta: `${a} ×`,
      cellIds: catalog.celule.filter((c) => c.a === a).map((c) => c.cell_id),
    }));
    ferestre.push({
      tip: "total",
      eticheta: "Toată fereastra",
      cellIds: catalog.celule.map((c) => c.cell_id),
    });

    if (B === 0) {
      return {
        tip: "tabel_fluenta",
        adancime,
        eticheta_domeniu: catalog.eticheta,
        facts_per_subtabla: factsPerSubtabla,
        numar_raspunsuri_valide: 0,
        antete: [],
        randuri: ferestre.map(({ tip, eticheta }) => ({ tip, eticheta, celule: [] })),
      };
    }

    const pas = adancime * factsPerSubtabla;
    const momenteNouVechi = [];
    for (let k = B; k >= 1; k -= pas) momenteNouVechi.push(k);
    const momente = momenteNouVechi.slice().reverse();

    const antete = momente.map((k) => ({
      eticheta: k === B ? "acum" : formateazaZiuaAntet(valide[k - 1].data_ora_ro),
      este_acum: k === B,
    }));

    const randuri = ferestre.map(({ tip, eticheta, cellIds }) => ({
      tip,
      eticheta,
      celule: momente.map((k, idx) =>
        construiesteCelulaFoto({
          valide,
          cellIds,
          k,
          kAnterior: idx === 0 ? 0 : momente[idx - 1],
          adancime,
          praguriV1,
        })
      ),
    }));

    return {
      tip: "tabel_fluenta",
      adancime,
      eticheta_domeniu: catalog.eticheta,
      facts_per_subtabla: factsPerSubtabla,
      numar_raspunsuri_valide: B,
      antete,
      randuri,
    };
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
    calculeazaScorFact,
    clasificaIncredereScor,
    calculeazaScorFluenta,
    segmenteazaFereastraInCalupuri,
    calculeazaSerieScorFluenta,
    construiesteModelTabelFluenta,
    ruleazaAnaliza,
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
