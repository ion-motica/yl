const VERSIUNE_MOTOR = "1.1.0";

const MAPARE_CAMPURI_IMPLICITA = Object.freeze({
  data_ora_ro: ["data_ora_ro"],
  quiz_name: ["quiz_name"],
  subquiz_name: ["subquiz_name"],
  intrebare: ["intrebare"],
  raspuns: ["raspuns"],
  raspuns_corect: ["a_raspuns_corect", "raspuns_corect"],
  al_catelea_turn_apasare_pe_buton: ["al_catelea_turn_apasare_pe_buton"],
  durata_raspuns_secunde: ["durata_raspuns_secunde"],
  fact: ["fact"],
  quiz_id: ["quiz_id"],
  subquiz_id: ["subquiz_id"],
  fact_id: ["fact_id"],
  eq_form: ["eq_form"],
  pozitie_buton_apasat_pt_raspuns: ["pozitie_buton_apasat_pt_raspuns"],
  valori_variante_de_raspuns: ["valori_variante_de_raspuns"],
  valoare_raspuns_corect: ["valoare_raspuns_corect"],
  hints_aratate_pt_raspuns: ["hints_aratate_pt_raspuns"],
  session_id: ["session_id", "extra.session_id"],
  quiz_version: ["quiz_version", "extra.quiz_version"],
  question_index_in_session: [
    "question_index_in_session",
    "extra.question_index_in_session",
  ],
  event_type: ["event_type", "extra.event_type"],
  timed_out: ["timed_out", "timeout", "extra.timed_out", "extra.timeout"],
  button_options: ["extra.button_options"],
  selected_button_index: ["extra.selected_button_index"],
  eff_id: ["eff_id", "extra.eff_id"],
  eff_member_id: ["eff_member_id", "extra.eff_member_id"],
  eq_form_id: ["eq_form_id", "extra.eq_form_id"],
  unknown_member_role: ["unknown_member_role", "extra.unknown_member_role"],
  scenario: ["scenario", "extra.scenario"],
});

const CAMPURI_OPTIONALE_ANALIZA = Object.freeze([
  "session_id",
  "quiz_version",
  "question_index_in_session",
  "event_type",
  "timed_out",
  "eff_id",
  "eff_member_id",
  "eq_form_id",
  "unknown_member_role",
]);

const PRAGURI_STARE_IMPLICITE = Object.freeze({
  minim_date: 5,
  precizie_fluent: 0.95,
  timp_fluent_maxim: 1.5,
  precizie_consolidare: 0.9,
  timp_consolidare_maxim: 4,
});

const PRAGURI_DIRECTIE_IMPLICITE = Object.freeze({
  minim_observatii_per_fereastra: 5,
  prag_timp_material_secunde: 0.2,
  prag_precizie_material: 0.05,
});

const GRUPE_TIMP_IMPLICITE = Object.freeze([
  { id: "sub_0_5", min: -Infinity, max: 0.5, eticheta: "<0,5 s" },
  { id: "0_5_2", min: 0.5, max: 2, eticheta: "0,5-2 s" },
  { id: "2_4", min: 2, max: 4, eticheta: "2-4 s" },
  { id: "4_5", min: 4, max: 5, eticheta: "4-5 s" },
  { id: "5_15", min: 5, max: 15, eticheta: "5-15 s" },
  { id: "15_plus", min: 15, max: Infinity, eticheta: "15+ s" },
]);

export class EroareMABP extends Error {
  constructor(mesaj, cod = "MABP_INVALID") {
    super(mesaj);
    this.name = "EroareMABP";
    this.cod = cod;
  }
}

function esteObiect(valoare) {
  return Boolean(valoare) && typeof valoare === "object" && !Array.isArray(valoare);
}

function copieDate(valoare) {
  if (typeof structuredClone === "function") return structuredClone(valoare);
  return JSON.parse(JSON.stringify(valoare));
}

function citesteCale(obiect, cale) {
  return String(cale)
    .split(".")
    .reduce((curent, segment) => (curent == null ? undefined : curent[segment]), obiect);
}

function primaValoare(obiect, cai) {
  const listaCai = Array.isArray(cai) ? cai : cai == null ? [] : [cai];
  for (const cale of listaCai) {
    const valoare = citesteCale(obiect, cale);
    if (valoare !== undefined && valoare !== null) return valoare;
  }
  return null;
}

function combinaMapareCampuri(mapareImplicita, maparePersonalizata) {
  if (!esteObiect(maparePersonalizata)) {
    throw new EroareMABP("mapareCampuri trebuie sa fie obiect.", "MAPARE_CAMPURI_INVALIDA");
  }

  const rezultat = {};
  const campuri = new Set([
    ...Object.keys(mapareImplicita),
    ...Object.keys(maparePersonalizata),
  ]);
  for (const camp of campuri) {
    const personalizate = Object.hasOwn(maparePersonalizata, camp)
      ? Array.isArray(maparePersonalizata[camp])
        ? maparePersonalizata[camp]
        : [maparePersonalizata[camp]]
      : [];
    const implicite = Array.isArray(mapareImplicita[camp])
      ? mapareImplicita[camp]
      : [];
    const cai = [...new Set([...personalizate, ...implicite])];
    if (
      cai.length === 0 ||
      cai.some((cale) => typeof cale !== "string" || !cale.trim())
    ) {
      throw new EroareMABP(
        `Maparea campului ${camp} trebuie sa contina cai text nevid.`,
        "MAPARE_CAMP_INVALIDA"
      );
    }
    rezultat[camp] = Object.freeze(cai.map((cale) => cale.trim()));
  }
  return Object.freeze(rezultat);
}

function textSauNull(valoare) {
  return valoare == null ? null : String(valoare);
}

function numarSauNull(valoare, numeCamp, index) {
  if (valoare == null || valoare === "") return null;
  const numar = Number(valoare);
  if (!Number.isFinite(numar)) {
    throw new EroareMABP(
      `Inregistrarea ${index}: ${numeCamp} trebuie sa fie numar sau null.`,
      "CAMP_NUMERIC_INVALID"
    );
  }
  return numar;
}

function booleanSauNull(valoare, numeCamp, index) {
  if (valoare == null) return null;
  if (typeof valoare !== "boolean") {
    throw new EroareMABP(
      `Inregistrarea ${index}: ${numeCamp} trebuie sa fie boolean sau null.`,
      "CAMP_BOOLEAN_INVALID"
    );
  }
  return valoare;
}

function normalizeazaOInregistrare(intrare, index, mapare) {
  if (!esteObiect(intrare)) {
    throw new EroareMABP(
      `Inregistrarea ${index} trebuie sa fie un obiect.`,
      "INREGISTRARE_INVALIDA"
    );
  }

  const citeste = (camp) => primaValoare(intrare, mapare[camp]);
  const apasare = Number(citeste("al_catelea_turn_apasare_pe_buton"));
  if (!Number.isInteger(apasare) || apasare < 1) {
    throw new EroareMABP(
      `Inregistrarea ${index}: al_catelea_turn_apasare_pe_buton trebuie sa fie un intreg pozitiv.`,
      "APASARE_INVALIDA"
    );
  }

  const durata = numarSauNull(citeste("durata_raspuns_secunde"), "durata_raspuns_secunde", index);
  if (durata != null && durata < 0) {
    throw new EroareMABP(
      `Inregistrarea ${index}: durata_raspuns_secunde nu poate fi negativa.`,
      "DURATA_INVALIDA"
    );
  }

  const pozitieActuala = numarSauNull(
    citeste("pozitie_buton_apasat_pt_raspuns"),
    "pozitie_buton_apasat_pt_raspuns",
    index
  );
  const indexDummy = numarSauNull(
    citeste("selected_button_index"),
    "selected_button_index",
    index
  );
  const valoriActuale = citeste("valori_variante_de_raspuns");
  const buttonOptions = citeste("button_options");

  if (valoriActuale != null && !Array.isArray(valoriActuale)) {
    throw new EroareMABP(
      `Inregistrarea ${index}: valori_variante_de_raspuns trebuie sa fie array sau null.`,
      "VARIANTE_INVALID"
    );
  }
  if (buttonOptions != null && !Array.isArray(buttonOptions)) {
    throw new EroareMABP(
      `Inregistrarea ${index}: extra.button_options trebuie sa fie array sau null.`,
      "VARIANTE_DUMMY_INVALID"
    );
  }

  const extra = esteObiect(intrare.extra) ? intrare.extra : {};
  const hints = citeste("hints_aratate_pt_raspuns");
  if (hints != null && !esteObiect(hints)) {
    throw new EroareMABP(
      `Inregistrarea ${index}: hints_aratate_pt_raspuns trebuie sa fie obiect sau null.`,
      "HINTS_INVALID"
    );
  }

  const normalizata = {
    index_sursa: index,
    data_ora_ro: textSauNull(citeste("data_ora_ro")),
    quiz_name: textSauNull(citeste("quiz_name")),
    subquiz_name: textSauNull(citeste("subquiz_name")),
    intrebare: textSauNull(citeste("intrebare")),
    raspuns: textSauNull(citeste("raspuns")),
    raspuns_corect: booleanSauNull(citeste("raspuns_corect"), "raspuns_corect", index),
    al_catelea_turn_apasare_pe_buton: apasare,
    durata_raspuns_secunde: durata,
    fact: textSauNull(citeste("fact")),
    quiz_id: textSauNull(citeste("quiz_id")),
    subquiz_id: textSauNull(citeste("subquiz_id")),
    fact_id: textSauNull(citeste("fact_id")),
    eq_form: textSauNull(citeste("eq_form")),
    pozitie_buton_apasat_pt_raspuns:
      pozitieActuala == null ? null : Number(pozitieActuala),
    valori_variante_de_raspuns:
      valoriActuale == null ? null : valoriActuale.map(textSauNull),
    valoare_raspuns_corect: textSauNull(citeste("valoare_raspuns_corect")),
    hints_aratate_pt_raspuns: hints == null ? null : { ...hints },
    session_id: textSauNull(citeste("session_id")),
    quiz_version: textSauNull(citeste("quiz_version")),
    question_index_in_session: numarSauNull(
      citeste("question_index_in_session"),
      "question_index_in_session",
      index
    ),
    event_type: textSauNull(citeste("event_type")),
    timed_out: booleanSauNull(citeste("timed_out"), "timed_out", index),
    button_options: buttonOptions == null ? null : buttonOptions.map(textSauNull),
    selected_button_index: indexDummy == null ? null : Number(indexDummy),
    eff_id: textSauNull(citeste("eff_id")),
    eff_member_id: textSauNull(citeste("eff_member_id")),
    eq_form_id: textSauNull(citeste("eq_form_id")),
    unknown_member_role: textSauNull(citeste("unknown_member_role")),
    scenario: textSauNull(citeste("scenario")),
    extra: { ...extra },
    raw: intrare,
  };

  // Câmpurile canonice noi pot fi introduse prin mapare fără schimbarea
  // nucleului; validarea lor specifică aparține axei/metricii care le consumă.
  for (const camp of Object.keys(mapare)) {
    if (!Object.hasOwn(normalizata, camp)) normalizata[camp] = citeste(camp);
  }
  return normalizata;
}

function finalizeazaIntrebare(curenta, indexIntrebare) {
  const prima = curenta.apasari[0];
  const ultima = curenta.apasari.at(-1);
  return {
    id: `intrebare-${indexIntrebare + 1}`,
    index_intrebare: indexIntrebare,
    apasari: curenta.apasari,
    prima_apasare: prima,
    ultima_apasare: ultima,
    numar_apasari: curenta.apasari.length,
    corect_din_prima: prima.raspuns_corect === true,
    corectat_in_final: ultima.raspuns_corect === true,
    data_ora_ro: prima.data_ora_ro,
    fact: prima.fact,
    fact_id: prima.fact_id,
    eq_form: prima.eq_form,
    eq_form_id: prima.eq_form_id,
    session_id: prima.session_id,
    quiz_version: prima.quiz_version,
    question_index_in_session: prima.question_index_in_session,
    eff_id: prima.eff_id,
    eff_member_id: prima.eff_member_id,
    unknown_member_role: prima.unknown_member_role,
    scenario: prima.scenario,
    extra: prima.extra,
  };
}

function grupeazaApasariPeIntrebari(inregistrari) {
  if (!Array.isArray(inregistrari)) {
    throw new EroareMABP("Inregistrarile normalizate trebuie sa fie un array.");
  }

  const intrebari = [];
  let curenta = null;

  for (const inregistrare of inregistrari) {
    const apasare = inregistrare.al_catelea_turn_apasare_pe_buton;
    if (apasare === 1) {
      if (curenta) intrebari.push(finalizeazaIntrebare(curenta, intrebari.length));
      curenta = { apasari: [inregistrare] };
      continue;
    }

    if (!curenta) {
      throw new EroareMABP(
        `Secventa contine apasarea ${apasare} fara apasarea 1 anterioara.`,
        "APASARE_ORFANA"
      );
    }

    const urmatoareaAsteptata = curenta.apasari.length + 1;
    if (apasare !== urmatoareaAsteptata) {
      throw new EroareMABP(
        `Secventa astepta apasarea ${urmatoareaAsteptata}, dar a primit apasarea ${apasare}.`,
        "ORDINE_APASARI_INVALIDA"
      );
    }

    const prima = curenta.apasari[0];
    if (
      prima.fact_id != null &&
      inregistrare.fact_id != null &&
      prima.fact_id !== inregistrare.fact_id
    ) {
      throw new EroareMABP(
        `Apasarea ${apasare} are alt fact_id decat apasarea 1.`,
        "CONTEXT_INTREBARE_INCONSISTENT"
      );
    }
    curenta.apasari.push(inregistrare);
  }

  if (curenta) intrebari.push(finalizeazaIntrebare(curenta, intrebari.length));
  return intrebari;
}

function dateCatalogFact(catalog, factId) {
  return catalog?.facts?.[factId] || null;
}

function valoareStructurala(intrebare, camp, catalog) {
  const valoareDirecta = intrebare?.[camp] ?? intrebare?.prima_apasare?.[camp];
  if (valoareDirecta != null) return valoareDirecta;
  const factCatalog = dateCatalogFact(catalog, intrebare?.fact_id);
  return factCatalog?.[camp] ?? null;
}

function obtineTablaCatalog(catalog, tableId) {
  const tabla = catalog?.tables?.[tableId];
  if (!esteObiect(tabla)) {
    throw new EroareMABP(
      `Catalogul nu defineste tabla ${tableId}.`,
      "TABLA_LIPSA"
    );
  }
  if (tabla.table_id !== tableId) {
    throw new EroareMABP(
      `Tabla ${tableId} trebuie sa declare acelasi table_id.`,
      "TABLA_INVALIDA"
    );
  }

  const randuri = tabla.randuri;
  const coloane = tabla.coloane;
  const celule = tabla.celule;
  if (
    !Array.isArray(randuri) ||
    randuri.length === 0 ||
    !Array.isArray(coloane) ||
    coloane.length === 0 ||
    !Array.isArray(celule)
  ) {
    throw new EroareMABP(
      `Tabla ${tableId} trebuie sa declare randuri, coloane si celule.`,
      "TABLA_INVALIDA"
    );
  }
  if (celule.length !== randuri.length * coloane.length) {
    throw new EroareMABP(
      `Tabla ${tableId} trebuie sa declare exact cate o celula pentru fiecare pozitie.`,
      "TABLA_INCOMPLETA"
    );
  }

  const iduri = new Set();
  const pozitii = new Set();
  for (const celula of celule) {
    const idValid = typeof celula?.fact_id === "string" && celula.fact_id.length > 0;
    const etichetaValida =
      typeof celula?.eticheta === "string" && celula.eticheta.length > 0;
    const randValid = randuri.some((rand) => Object.is(rand, celula?.rand));
    const coloanaValida = coloane.some((coloana) =>
      Object.is(coloana, celula?.coloana)
    );
    if (!idValid || !etichetaValida || !randValid || !coloanaValida) {
      throw new EroareMABP(
        `Tabla ${tableId} contine o celula invalida.`,
        "CELULA_TABLA_INVALIDA"
      );
    }
    const pozitie = JSON.stringify([celula.rand, celula.coloana]);
    if (iduri.has(celula.fact_id) || pozitii.has(pozitie)) {
      throw new EroareMABP(
        `Tabla ${tableId} contine un fact_id sau o pozitie duplicata.`,
        "CELULA_TABLA_DUPLICATA"
      );
    }
    iduri.add(celula.fact_id);
    pozitii.add(pozitie);
  }

  for (const [factId, fact] of Object.entries(catalog?.facts || {})) {
    if (fact?.table_id !== tableId) continue;
    if (typeof fact.cell_id !== "string" || !iduri.has(fact.cell_id)) {
      throw new EroareMABP(
        `Factul ${factId} nu declara un cell_id valid in tabla ${tableId}.`,
        "MAPARE_CELULA_INVALIDA"
      );
    }
  }
  return tabla;
}

function idCelulaCanonica(intrebare, catalog) {
  return valoareStructurala(intrebare, "cell_id", catalog) ?? intrebare?.fact_id;
}

const AXE_STANDARD = Object.freeze({
  toate: () => true,
  fact: ({ intrebare, definitie }) => intrebare.fact_id === definitie.fact_id,
  tabla: ({ intrebare, definitie, catalog }) => {
    const tabla = obtineTablaCatalog(catalog, definitie.id);
    const cellId = idCelulaCanonica(intrebare, catalog);
    return tabla.celule.some((celula) => celula.fact_id === cellId);
  },
  subtabla: ({ intrebare, definitie, catalog }) => {
    const subtabla = catalog?.subtables?.[definitie.id];
    if (!subtabla) {
      throw new EroareMABP(
        `Catalogul nu defineste subtabla ${definitie.id}.`,
        "SUBTABLA_LIPSA"
      );
    }
    const membri = subtabla.member_fact_ids ?? subtabla.fact_ids ?? [];
    return membri.includes(intrebare.fact_id);
  },
  eff: ({ intrebare, definitie, catalog }) => {
    const effDirect = valoareStructurala(intrebare, "eff_id", catalog);
    if (effDirect != null) return effDirect === definitie.eff_id;
    const membri = catalog?.effs?.[definitie.eff_id]?.member_fact_ids ?? [];
    return membri.includes(intrebare.fact_id);
  },
  acelasi_rol_al_necunoscutei: ({ intrebare, definitie, catalog }) =>
    valoareStructurala(intrebare, "unknown_member_role", catalog) === definitie.rol,
  camp_egal: ({ intrebare, definitie }) =>
    citesteCale(intrebare, definitie.camp) === definitie.valoare,
  camp_in: ({ intrebare, definitie }) =>
    Array.isArray(definitie.valori) &&
    definitie.valori.includes(citesteCale(intrebare, definitie.camp)),
});

function construiesteSelector(definitie, axe, catalog) {
  if (!definitie) return () => true;
  if (Array.isArray(definitie)) {
    const selectori = definitie.map((item) => construiesteSelector(item, axe, catalog));
    return (intrebare) => selectori.every((selector) => selector(intrebare));
  }
  if (!esteObiect(definitie) || !definitie.tip) {
    throw new EroareMABP("Definitia axei trebuie sa contina tip.", "AXA_INVALIDA");
  }

  if (definitie.tip === "intersectie" || definitie.tip === "uniune") {
    if (!Array.isArray(definitie.axe) || definitie.axe.length === 0) {
      throw new EroareMABP(`${definitie.tip} necesita un array axe nevid.`, "AXA_COMBINATA_INVALIDA");
    }
    const selectori = definitie.axe.map((axa) => construiesteSelector(axa, axe, catalog));
    return definitie.tip === "intersectie"
      ? (intrebare) => selectori.every((selector) => selector(intrebare))
      : (intrebare) => selectori.some((selector) => selector(intrebare));
  }

  if (definitie.tip === "nu") {
    const selector = construiesteSelector(definitie.axa, axe, catalog);
    return (intrebare) => !selector(intrebare);
  }

  const axa = axe[definitie.tip];
  if (typeof axa !== "function") {
    throw new EroareMABP(`Axa ${definitie.tip} nu este definita.`, "AXA_NECUNOSCUTA");
  }
  return (intrebare) => axa({ intrebare, definitie, catalog }) === true;
}

function dataRoInMilisecunde(text) {
  const potrivire = String(text ?? "").match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/
  );
  if (!potrivire) return null;
  const [, an, luna, zi, ora = "00", minut = "00", secunda = "00"] = potrivire;
  const timp = Date.UTC(
    Number(an),
    Number(luna) - 1,
    Number(zi),
    Number(ora),
    Number(minut),
    Number(secunda)
  );
  return Number.isFinite(timp) ? timp : null;
}

function valoriDistincteInOrdine(items, citeste) {
  const vazute = new Set();
  const rezultat = [];
  for (const item of items) {
    const valoare = citeste(item);
    if (valoare == null || vazute.has(valoare)) continue;
    vazute.add(valoare);
    rezultat.push(valoare);
  }
  return rezultat;
}

function selecteazaFereastra(intrebari, fereastra, comparatie) {
  const definitie = fereastra || { tip: "toate" };
  const tip = definitie.tip || "toate";
  const valoare = Number(definitie.valoare);
  const cuPerioadaAnterioara = comparatie?.tip === "perioada_anterioara_egala";

  if (tip === "toate") {
    return { curenta: [...intrebari], anterioara: null, descriere: "toate" };
  }
  if (!Number.isInteger(valoare) || valoare < 1) {
    throw new EroareMABP(`Fereastra ${tip} necesita valoare intreaga pozitiva.`, "FEREASTRA_INVALIDA");
  }

  if (tip === "ultimele_raspunsuri") {
    const curenta = intrebari.slice(-valoare);
    const anterioara = cuPerioadaAnterioara
      ? intrebari.slice(-(valoare * 2), -valoare)
      : null;
    return { curenta, anterioara, descriere: `ultimele ${valoare} intrebari` };
  }

  if (tip === "sesiuni") {
    const sesiuni = valoriDistincteInOrdine(intrebari, (item) => item.session_id);
    if (sesiuni.length === 0) {
      throw new EroareMABP(
        "Analiza pe sesiuni necesita session_id in jurnal sau intr-un adaptor explicit.",
        "SESSION_ID_LIPSA"
      );
    }
    const sesiuniCurente = sesiuni.slice(-valoare);
    const sesiuniAnterioare = cuPerioadaAnterioara
      ? sesiuni.slice(-(valoare * 2), -valoare)
      : [];
    return {
      curenta: intrebari.filter((item) => sesiuniCurente.includes(item.session_id)),
      anterioara: cuPerioadaAnterioara
        ? intrebari.filter((item) => sesiuniAnterioare.includes(item.session_id))
        : null,
      descriere: `ultimele ${valoare} sesiuni relevante`,
    };
  }

  if (tip === "zile") {
    const cuTimp = intrebari
      .map((item) => ({ item, timp: dataRoInMilisecunde(item.data_ora_ro) }))
      .filter((item) => item.timp != null);
    if (cuTimp.length === 0) {
      throw new EroareMABP(
        "Analiza pe zile necesita data_ora_ro valida.",
        "DATA_ORA_LIPSA"
      );
    }
    const zi = 24 * 60 * 60 * 1000;
    const ancora = Math.max(...cuTimp.map((item) => item.timp));
    const inceputCurent = ancora - valoare * zi + 1;
    const inceputAnterior = ancora - valoare * 2 * zi + 1;
    const sfarsitAnterior = inceputCurent - 1;
    return {
      curenta: cuTimp
        .filter(({ timp }) => timp >= inceputCurent && timp <= ancora)
        .map(({ item }) => item),
      anterioara: cuPerioadaAnterioara
        ? cuTimp
            .filter(({ timp }) => timp >= inceputAnterior && timp <= sfarsitAnterior)
            .map(({ item }) => item)
        : null,
      descriere: `${valoare} zile, ancorate la ultima data relevanta`,
    };
  }

  throw new EroareMABP(`Tip de fereastra necunoscut: ${tip}.`, "FEREASTRA_NECUNOSCUTA");
}

function valoareObservatie(observatie, camp) {
  if (camp === "durata_raspuns_secunde") {
    return observatie.prima_apasare.durata_raspuns_secunde;
  }
  const directa = citesteCale(observatie, camp);
  if (directa !== undefined) return directa;
  return citesteCale(observatie.prima_apasare, camp);
}

function comparaPrag(valoare, operator, prag) {
  if (!Number.isFinite(Number(valoare))) return false;
  const numar = Number(valoare);
  if (operator === "<") return numar < prag;
  if (operator === "<=") return numar <= prag;
  if (operator === ">") return numar > prag;
  if (operator === ">=") return numar >= prag;
  if (operator === "===") return numar === prag;
  throw new EroareMABP(`Operator de prag necunoscut: ${operator}.`, "OPERATOR_NECUNOSCUT");
}

function cuartila(sortate, p) {
  if (sortate.length === 0) return null;
  const pozitie = (sortate.length - 1) * p;
  const jos = Math.floor(pozitie);
  const sus = Math.ceil(pozitie);
  if (jos === sus) return sortate[jos];
  return sortate[jos] + (sortate[sus] - sortate[jos]) * (pozitie - jos);
}

function adaugaMotiv(observatie, colectie, motiv) {
  if (!motiv) return;
  if (!observatie[colectie].includes(motiv)) observatie[colectie].push(motiv);
}

function normalizeazaReguli(reguli, avertismente, context) {
  if (reguli != null && !Array.isArray(reguli)) {
    throw new EroareMABP(
      `${context} trebuie sa fie array.`,
      "LISTA_REGULI_INVALIDA"
    );
  }
  return (Array.isArray(reguli) ? reguli : []).map((regula, index) => {
    if (!esteObiect(regula) || !regula.tip) {
      throw new EroareMABP(`Regula ${context}[${index}] este invalida.`, "REGULA_INVALIDA");
    }
    const copie = { ...regula };
    if (!["prag_fix", "interval", "iqr"].includes(copie.tip)) {
      throw new EroareMABP(
        `Regula ${context}[${index}] are tip necunoscut: ${copie.tip}.`,
        "REGULA_NECUNOSCUTA"
      );
    }
    if (
      copie.camp == null &&
      ["prag_fix", "interval", "iqr"].includes(copie.tip)
    ) {
      copie.camp = "durata_raspuns_secunde";
      avertismente.add(
        `${context}[${index}] nu declara camp; s-a normalizat explicit la durata_raspuns_secunde.`
      );
    }
    if (typeof copie.camp !== "string" || !copie.camp.trim()) {
      throw new EroareMABP(
        `Regula ${context}[${index}] trebuie sa declare un camp valid.`,
        "CAMP_REGULA_INVALID"
      );
    }
    copie.camp = copie.camp.trim();
    if (typeof copie.motiv !== "string" || !copie.motiv.trim()) {
      throw new EroareMABP(
        `Regula ${context}[${index}] trebuie sa declare un motiv.`,
        "MOTIV_REGULA_LIPSA"
      );
    }
    copie.motiv = copie.motiv.trim();

    if (copie.tip === "prag_fix") {
      if (!["<", "<=", ">", ">=", "==="].includes(copie.operator)) {
        throw new EroareMABP(
          `Regula ${context}[${index}] are operator necunoscut: ${copie.operator}.`,
          "OPERATOR_NECUNOSCUT"
        );
      }
      if (typeof copie.valoare !== "number" || !Number.isFinite(copie.valoare)) {
        throw new EroareMABP(
          `Regula ${context}[${index}] trebuie sa declare valoare numerica.`,
          "PRAG_INVALID"
        );
      }
    }

    if (copie.tip === "interval") {
      const minimValid = typeof copie.min === "number" && Number.isFinite(copie.min);
      const maximValid = typeof copie.max === "number" && Number.isFinite(copie.max);
      if (!minimValid || !maximValid || copie.min >= copie.max) {
        throw new EroareMABP(
          `Regula ${context}[${index}] necesita min si max numerice, cu min < max.`,
          "INTERVAL_INVALID"
        );
      }
    }

    if (copie.tip === "iqr") {
      copie.directie ??= "superior";
      if (!["inferior", "superior", "ambele"].includes(copie.directie)) {
        throw new EroareMABP(
          `Regula ${context}[${index}] are directie IQR necunoscuta: ${copie.directie}.`,
          "DIRECTIE_IQR_INVALIDA"
        );
      }
      copie.factor ??= 1.5;
      if (
        typeof copie.factor !== "number" ||
        !Number.isFinite(copie.factor) ||
        copie.factor <= 0
      ) {
        throw new EroareMABP(
          `Regula ${context}[${index}] necesita factor IQR pozitiv.`,
          "FACTOR_IQR_INVALID"
        );
      }
      if (
        copie.grupare_calcul != null &&
        (!Array.isArray(copie.grupare_calcul) ||
          copie.grupare_calcul.some(
            (camp) => typeof camp !== "string" || !camp.trim()
          ))
      ) {
        throw new EroareMABP(
          `Regula ${context}[${index}] are grupare_calcul invalida.`,
          "GRUPARE_IQR_INVALIDA"
        );
      }
    }
    return copie;
  });
}

function aplicaReguliIqr(observatii, reguli, colectieMotive) {
  for (const regula of reguli.filter((item) => item.tip === "iqr")) {
    const campuriGrupare = Array.isArray(regula.grupare_calcul)
      ? regula.grupare_calcul
      : [];
    const grupuri = new Map();
    for (const observatie of observatii) {
      const cheie = JSON.stringify(
        campuriGrupare.map((camp) => valoareObservatie(observatie, camp))
      );
      if (!grupuri.has(cheie)) grupuri.set(cheie, []);
      grupuri.get(cheie).push(observatie);
    }

    for (const grup of grupuri.values()) {
      const valori = grup
        .map((observatie) => Number(valoareObservatie(observatie, regula.camp)))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      if (valori.length < 4) continue;
      const q1 = cuartila(valori, 0.25);
      const q3 = cuartila(valori, 0.75);
      const iqr = q3 - q1;
      const factor = Number.isFinite(Number(regula.factor)) ? Number(regula.factor) : 1.5;
      const limitaJos = q1 - factor * iqr;
      const limitaSus = q3 + factor * iqr;
      for (const observatie of grup) {
        const valoare = Number(valoareObservatie(observatie, regula.camp));
        const potriveste =
          Number.isFinite(valoare) &&
          (regula.directie === "inferior"
            ? valoare < limitaJos
            : regula.directie === "ambele"
              ? valoare < limitaJos || valoare > limitaSus
              : valoare > limitaSus);
        if (potriveste) adaugaMotiv(observatie, colectieMotive, regula.motiv);
      }
    }
  }
}

function aplicaFiltru(intrebari, filtru = {}, avertismente = new Set()) {
  const reguliTimp = normalizeazaReguli(
    filtru.exclude_din_timp,
    avertismente,
    "exclude_din_timp"
  );
  const reguliPrecizie = normalizeazaReguli(
    filtru.exclude_din_precizie,
    avertismente,
    "exclude_din_precizie"
  );
  const reguliMarcaje = normalizeazaReguli(
    filtru.marcheaza_fara_excludere,
    avertismente,
    "marcheaza_fara_excludere"
  );

  if (filtru.doar_prima_apasare === false) {
    avertismente.add(
      "Metricele v1 sunt definite per intrebare si folosesc explicit prima apasare."
    );
  }

  const observatii = intrebari.map((intrebare) => ({
    ...intrebare,
    motive_excludere_timp: [],
    motive_excludere_precizie: [],
    marcaje: [],
  }));

  const aplicaSimple = (reguli, colectie) => {
    for (const regula of reguli.filter((item) => item.tip !== "iqr")) {
      for (const observatie of observatii) {
        const valoare = valoareObservatie(observatie, regula.camp);
        const potriveste =
          regula.tip === "prag_fix"
            ? comparaPrag(valoare, regula.operator, Number(regula.valoare))
            : regula.tip === "interval"
              ? Number.isFinite(Number(valoare)) &&
                Number(valoare) >= Number(regula.min) &&
                Number(valoare) < Number(regula.max)
              : false;
        if (potriveste) adaugaMotiv(observatie, colectie, regula.motiv);
      }
    }
  };

  aplicaSimple(reguliTimp, "motive_excludere_timp");
  aplicaSimple(reguliPrecizie, "motive_excludere_precizie");
  aplicaSimple(reguliMarcaje, "marcaje");
  aplicaReguliIqr(observatii, reguliTimp, "motive_excludere_timp");
  aplicaReguliIqr(observatii, reguliPrecizie, "motive_excludere_precizie");
  aplicaReguliIqr(observatii, reguliMarcaje, "marcaje");

  const motive = {};
  for (const observatie of observatii) {
    for (const motiv of [
      ...observatie.motive_excludere_timp,
      ...observatie.motive_excludere_precizie,
      ...observatie.marcaje,
    ]) {
      motive[motiv] = (motive[motiv] || 0) + 1;
    }
  }

  return {
    observatii,
    sumar: {
      total: observatii.length,
      incluse_timp: observatii.filter(
        (item) => item.motive_excludere_timp.length === 0
      ).length,
      excluse_timp: observatii.filter(
        (item) => item.motive_excludere_timp.length > 0
      ).length,
      incluse_precizie: observatii.filter(
        (item) => item.motive_excludere_precizie.length === 0
      ).length,
      excluse_precizie: observatii.filter(
        (item) => item.motive_excludere_precizie.length > 0
      ).length,
      motive,
    },
  };
}

function mediana(valori) {
  const sortate = valori.filter(Number.isFinite).sort((a, b) => a - b);
  if (sortate.length === 0) return null;
  const mijloc = Math.floor(sortate.length / 2);
  return sortate.length % 2 === 1
    ? sortate[mijloc]
    : (sortate[mijloc - 1] + sortate[mijloc]) / 2;
}

function calculeazaMetriciStandard(observatii, configuratie = {}) {
  const eligibilePrecizie = observatii.filter(
    (item) =>
      item.motive_excludere_precizie.length === 0 &&
      typeof item.prima_apasare.raspuns_corect === "boolean"
  );
  const corecte = eligibilePrecizie.filter(
    (item) => item.prima_apasare.raspuns_corect === true
  );
  const eligibileTimp = observatii.filter(
    (item) =>
      item.prima_apasare.raspuns_corect === true &&
      item.motive_excludere_timp.length === 0 &&
      Number.isFinite(item.prima_apasare.durata_raspuns_secunde)
  );
  const timpi = eligibileTimp.map(
    (item) => item.prima_apasare.durata_raspuns_secunde
  );
  const pragRapid = Number(configuratie.prag_rapid_secunde ?? 2);
  const rapidCorecte = eligibileTimp.filter(
    (item) => item.prima_apasare.durata_raspuns_secunde <= pragRapid
  ).length;
  const timpiVizibili = observatii
    .map((item) => item.prima_apasare.durata_raspuns_secunde)
    .filter(Number.isFinite);
  const distributie = GRUPE_TIMP_IMPLICITE.map((grupa) => {
    const numar = timpiVizibili.filter(
      (valoare) => valoare >= grupa.min && valoare < grupa.max
    ).length;
    return {
      id: grupa.id,
      eticheta: grupa.eticheta,
      numar,
      proportie: timpiVizibili.length === 0 ? null : numar / timpiVizibili.length,
    };
  });

  return {
    n_intrebari: observatii.length,
    n_precizie: eligibilePrecizie.length,
    n_corecte_prima_apasare: corecte.length,
    precizie_prima_apasare:
      eligibilePrecizie.length === 0 ? null : corecte.length / eligibilePrecizie.length,
    n_timp: eligibileTimp.length,
    n_timp_corect: eligibileTimp.length,
    mediana_timp_corect_prima_apasare: mediana(timpi),
    procent_rapid_si_corect:
      eligibilePrecizie.length === 0 ? null : rapidCorecte / eligibilePrecizie.length,
    distributie_grupe_timp: distributie,
  };
}

function nivelSuficienta(n) {
  if (n === 0) return "netestat";
  if (n < 5) return "date_insuficiente";
  if (n < 10) return "semnal_preliminar";
  if (n < 20) return "tendinta";
  if (n < 50) return "estimare_utila";
  return "estimare_robusta_operational";
}

function classificaStare(metrici, configuratie = {}) {
  const praguri = {
    ...PRAGURI_STARE_IMPLICITE,
    ...(configuratie.praguri_stare || {}),
  };
  if (metrici.n_intrebari === 0) return "netestat";
  const precizie = metrici.precizie_prima_apasare;
  const timp = metrici.mediana_timp_corect_prima_apasare;
  if (
    metrici.n_intrebari >= praguri.minim_date &&
    precizie != null &&
    timp != null &&
    precizie >= praguri.precizie_fluent &&
    timp < praguri.timp_fluent_maxim
  ) {
    return "fluent";
  }
  if (
    precizie != null &&
    timp != null &&
    precizie >= praguri.precizie_consolidare &&
    timp < praguri.timp_consolidare_maxim
  ) {
    return "in_consolidare";
  }
  return "in_lucru";
}

function classificaDirectieStandard({ metriciVechi, metriciNoi, configuratie }) {
  const praguri = {
    ...PRAGURI_DIRECTIE_IMPLICITE,
    ...(configuratie.interpretare || {}),
  };
  if (
    metriciVechi.n_intrebari < praguri.minim_observatii_per_fereastra ||
    metriciNoi.n_intrebari < praguri.minim_observatii_per_fereastra ||
    metriciVechi.precizie_prima_apasare == null ||
    metriciNoi.precizie_prima_apasare == null ||
    metriciVechi.mediana_timp_corect_prima_apasare == null ||
    metriciNoi.mediana_timp_corect_prima_apasare == null
  ) {
    return "date_insuficiente";
  }

  const deltaTimp =
    metriciNoi.mediana_timp_corect_prima_apasare -
    metriciVechi.mediana_timp_corect_prima_apasare;
  const deltaPrecizie =
    metriciNoi.precizie_prima_apasare - metriciVechi.precizie_prima_apasare;
  const timp = praguri.prag_timp_material_secunde;
  const precizie = praguri.prag_precizie_material;
  const eps = 1e-12;

  if (deltaTimp <= -timp + eps && deltaPrecizie <= -precizie + eps) {
    return "viteza_mai_mare_dar_precizie_in_scadere";
  }
  if (deltaTimp >= timp - eps || deltaPrecizie <= -precizie + eps) {
    return "regres_probabil";
  }
  if (deltaTimp <= -timp + eps || deltaPrecizie >= precizie - eps) {
    return "progres";
  }
  return classificaStare(metriciNoi, configuratie) === "fluent"
    ? "stabil_la_nivel_bun"
    : "stabil_inca_nefluent";
}

const INTERPRETARI_STANDARD = Object.freeze({
  stare_curenta_standard_v1: ({ metriciCurente, configuratie }) =>
    classificaStare(metriciCurente, configuratie),
  directie_standard_v1: classificaDirectieStandard,
});

function grupeazaDupa(items, citesteCheie) {
  const grupuri = new Map();
  for (const item of items) {
    const cheie = citesteCheie(item);
    if (cheie == null) continue;
    if (!grupuri.has(cheie)) grupuri.set(cheie, []);
    grupuri.get(cheie).push(item);
  }
  return grupuri;
}

function idGrup(intrebare, configuratie, catalog) {
  if (configuratie.domeniu?.tip === "tabla") {
    return idCelulaCanonica(intrebare, catalog);
  }
  if (configuratie.domeniu?.tip === "eff") {
    return (
      valoareStructurala(intrebare, "eq_form_id", catalog) ??
      intrebare.eq_form ??
      intrebare.fact_id
    );
  }
  return intrebare.fact_id ?? intrebare.eq_form ?? intrebare.id;
}

function etichetaGrup(intrebare, configuratie, catalog) {
  if (configuratie.domeniu?.tip === "tabla") {
    const tabla = obtineTablaCatalog(catalog, configuratie.domeniu.id);
    const cellId = idCelulaCanonica(intrebare, catalog);
    return tabla.celule.find((celula) => celula.fact_id === cellId)?.eticheta ?? cellId;
  }
  if (configuratie.domeniu?.tip === "eff") {
    return valoareStructurala(intrebare, "eq_form_id", catalog) ?? intrebare.eq_form;
  }
  return intrebare.fact ?? intrebare.eq_form ?? intrebare.fact_id ?? intrebare.id;
}

function imparteJumatatiEgale(intrebari) {
  const n = Math.floor(intrebari.length / 2);
  if (n === 0) return { anterioara: [], curenta: [...intrebari] };
  return {
    anterioara: intrebari.slice(0, n),
    curenta: intrebari.slice(-n),
  };
}

function sumaMotive(destinatie, motive) {
  for (const [motiv, numar] of Object.entries(motive || {})) {
    destinatie[motiv] = (destinatie[motiv] || 0) + numar;
  }
  return destinatie;
}

function calculeazaMetriciCuExtensii(
  observatii,
  configuratie,
  metriciExtensie,
  avertismente
) {
  const metrici = calculeazaMetriciStandard(observatii, configuratie);
  const definitii = Array.isArray(configuratie.metrici) ? configuratie.metrici : [];
  const standard = new Set([
    "precizie_prima_apasare",
    "mediana_timp_corect_prima_apasare",
    "procent_rapid_si_corect",
    "distributie_grupe_timp",
    "delta_mediana_timp",
    "delta_precizie",
  ]);
  for (const definitieBruta of definitii) {
    const definitie =
      typeof definitieBruta === "string" ? { tip: definitieBruta } : definitieBruta;
    if (!esteObiect(definitie) || !definitie.tip) {
      throw new EroareMABP("Definitia unei metrici este invalida.", "METRICA_INVALIDA");
    }
    if (standard.has(definitie.tip)) continue;
    const calculator = metriciExtensie[definitie.tip];
    if (typeof calculator !== "function") {
      throw new EroareMABP(`Metrica ${definitie.tip} nu este definita.`, "METRICA_NECUNOSCUTA");
    }
    metrici[definitie.tip] = calculator({
      observatii,
      metrici: { ...metrici },
      definitie,
      configuratie,
      avertismente,
    });
  }
  return metrici;
}

function materializeazaTabla({
  catalog,
  configuratie,
  grupuri,
  clasificari,
  metriciExtensie,
  avertismente,
}) {
  if (configuratie.domeniu?.tip !== "tabla") {
    return { grupuri, clasificari, aranjare: null };
  }

  const tabla = obtineTablaCatalog(catalog, configuratie.domeniu.id);
  const grupuriPeId = new Map(grupuri.map((grup) => [grup.id, grup]));
  const iduriCatalog = new Set(tabla.celule.map((celula) => celula.fact_id));
  const grupNecatalogat = grupuri.find((grup) => !iduriCatalog.has(grup.id));
  if (grupNecatalogat) {
    throw new EroareMABP(
      `Grupul ${grupNecatalogat.id} nu are celula declarata in tabla ${tabla.table_id}.`,
      "GRUP_TABLA_NECATALOGAT"
    );
  }

  const clasificariComplete = {};
  const grupuriComplete = tabla.celule.map((celula) => {
    const pozitie = { rand: celula.rand, coloana: celula.coloana };
    const existent = grupuriPeId.get(celula.fact_id);
    if (existent) {
      const completat = {
        ...existent,
        eticheta: celula.eticheta,
        pozitie,
      };
      clasificariComplete[celula.fact_id] = configuratie.comparatie
        ? completat.comparatie?.directie ?? "date_insuficiente"
        : completat.stare;
      return completat;
    }

    const metriciGoale = calculeazaMetriciCuExtensii(
      [],
      configuratie,
      metriciExtensie,
      avertismente
    );
    const grupNetestat = {
      id: celula.fact_id,
      eticheta: celula.eticheta,
      pozitie,
      metrici: metriciGoale,
      stare: "netestat",
      suficienta: "netestat",
      serie: [],
    };
    if (configuratie.comparatie) {
      grupNetestat.comparatie = {
        vechi: copieDate(metriciGoale),
        nou: copieDate(metriciGoale),
        delta: { timp: null, precizie: null },
        directie: "date_insuficiente",
      };
      clasificariComplete[celula.fact_id] = "date_insuficiente";
    } else {
      clasificariComplete[celula.fact_id] = "netestat";
    }
    return grupNetestat;
  });

  return {
    grupuri: grupuriComplete,
    clasificari: clasificariComplete,
    aranjare: {
      tip: "matrice",
      table_id: tabla.table_id,
      eticheta: tabla.eticheta ?? tabla.table_id,
      randuri: [...tabla.randuri],
      coloane: [...tabla.coloane],
    },
  };
}

function construiesteSerie(observatii, configuratie, metriciExtensie, avertismente) {
  const sesiuni = grupeazaDupa(observatii, (item) => item.session_id);
  if (sesiuni.size === 0) return [];
  return [...sesiuni.entries()].map(([sessionId, elemente]) => {
    const metrici = calculeazaMetriciCuExtensii(
      elemente,
      configuratie,
      metriciExtensie,
      avertismente
    );
    return {
      id: sessionId,
      eticheta: sessionId,
      valoare: metrici.mediana_timp_corect_prima_apasare,
      metrica: "mediana_timp_corect_prima_apasare",
      unitate: "s",
      metrici,
    };
  });
}

function intervalDate(intrebari) {
  const valori = intrebari.map((item) => item.data_ora_ro).filter(Boolean);
  return {
    inceput: valori[0] ?? null,
    sfarsit: valori.at(-1) ?? null,
  };
}

function campuriIndisponibile(inregistrari) {
  return CAMPURI_OPTIONALE_ANALIZA.filter((camp) =>
    inregistrari.every((item) => item[camp] == null)
  );
}

function numaraInconsistenteOptiuni(intrebari) {
  let total = 0;
  let dummy = 0;
  for (const intrebare of intrebari) {
    const apasare = intrebare.prima_apasare;
    const actualaInconsistenta =
      Array.isArray(apasare.valori_variante_de_raspuns) &&
      Number.isInteger(apasare.pozitie_buton_apasat_pt_raspuns) &&
      apasare.valori_variante_de_raspuns[
        apasare.pozitie_buton_apasat_pt_raspuns - 1
      ] != null &&
      String(
        apasare.valori_variante_de_raspuns[
          apasare.pozitie_buton_apasat_pt_raspuns - 1
        ]
      ) !== apasare.raspuns;
    const dummyInconsistenta =
      Array.isArray(apasare.button_options) &&
      Number.isInteger(apasare.selected_button_index) &&
      apasare.button_options[apasare.selected_button_index] != null &&
      String(apasare.button_options[apasare.selected_button_index]) !== apasare.raspuns;
    if (actualaInconsistenta || dummyInconsistenta) total += 1;
    if (dummyInconsistenta) dummy += 1;
  }
  return { total, dummy };
}

function agregaComparatii(grupuri) {
  const comparabile = grupuri.filter(
    (grup) =>
      grup.comparatie &&
      grup.comparatie.directie !== "date_insuficiente" &&
      Number.isFinite(grup.comparatie.delta.timp) &&
      Number.isFinite(grup.comparatie.delta.precizie)
  );
  return {
    ponderare: "greutate_egala_per_fact",
    n_facts_comparabile: comparabile.length,
    delta_mediana_timp: mediana(comparabile.map((grup) => grup.comparatie.delta.timp)),
    delta_mediana_precizie: mediana(
      comparabile.map((grup) => grup.comparatie.delta.precizie)
    ),
  };
}

function combinaExtensii(standard, extensii, tip) {
  const rezultat = { ...standard };
  for (const [id, functie] of Object.entries(extensii || {})) {
    if (typeof functie !== "function") {
      throw new EroareMABP(`${tip} ${id} trebuie sa fie functie.`, "EXTENSIE_INVALIDA");
    }
    if (id in rezultat) {
      throw new EroareMABP(`${tip} ${id} exista deja.`, "EXTENSIE_DUPLICATA");
    }
    rezultat[id] = functie;
  }
  return Object.freeze(rezultat);
}

export function construiesteConfiguratieAnaliza({ preseturi, analizaId }) {
  if (!esteObiect(preseturi)) {
    throw new EroareMABP("Preseturile trebuie sa fie un obiect.", "PRESETURI_INVALID");
  }
  const analiza = preseturi.analysis_presets?.[analizaId];
  if (!esteObiect(analiza)) {
    throw new EroareMABP(`Presetul de analiza ${analizaId} nu exista.`, "PRESET_ANALIZA_LIPSA");
  }
  const filtruId = analiza.filtru_preset;
  const filtru = preseturi.filter_presets?.[filtruId];
  if (!esteObiect(filtru)) {
    throw new EroareMABP(`Presetul de filtru ${filtruId} nu exista.`, "PRESET_FILTRU_LIPSA");
  }
  return {
    schema_version: preseturi.schema_version ?? 1,
    preset_id: analizaId,
    preset_version: analiza.preset_version ?? preseturi.schema_version ?? 1,
    filter_preset_id: filtruId,
    filter_version: filtru.filter_version ?? preseturi.schema_version ?? 1,
    ...copieDate(analiza),
    filtru: copieDate(filtru),
  };
}

export function creeazaMotorMABP({
  axe = {},
  metrici = {},
  interpretari = {},
  mapareCampuri = {},
} = {}) {
  const axeDisponibile = combinaExtensii(AXE_STANDARD, axe, "Axa");
  const interpretariDisponibile = combinaExtensii(
    INTERPRETARI_STANDARD,
    interpretari,
    "Interpretarea"
  );
  const mapare = combinaMapareCampuri(
    MAPARE_CAMPURI_IMPLICITA,
    mapareCampuri
  );

  function normalizeazaInregistrari(loguri) {
    if (!Array.isArray(loguri)) {
      throw new EroareMABP("Logurile trebuie sa fie un array.", "LOGURI_INVALID");
    }
    return loguri.map((intrare, index) => normalizeazaOInregistrare(intrare, index, mapare));
  }

  function ruleazaAnaliza({ loguri, catalog = {}, configuratie }) {
    if (!esteObiect(configuratie)) {
      throw new EroareMABP("Configuratia analizei trebuie sa fie obiect.", "CONFIGURATIE_INVALIDA");
    }
    if (!esteObiect(configuratie.filtru)) {
      throw new EroareMABP(
        "Configuratia trebuie sa contina presetul de filtru rezolvat in campul filtru.",
        "FILTRU_NEREZOLVAT"
      );
    }

    const avertismente = new Set();
    const inregistrari = normalizeazaInregistrari(loguri);
    const intrebari = grupeazaApasariPeIntrebari(inregistrari);
    const selectorDomeniu = construiesteSelector(
      configuratie.domeniu || { tip: "toate" },
      axeDisponibile,
      catalog
    );
    const selectorStructura = construiesteSelector(
      configuratie.structura,
      axeDisponibile,
      catalog
    );
    const intrebariDomeniu = intrebari.filter(
      (intrebare) => selectorDomeniu(intrebare) && selectorStructura(intrebare)
    );
    const fereastra = selecteazaFereastra(
      intrebariDomeniu,
      configuratie.fereastra,
      configuratie.comparatie
    );
    const grupuri = [];
    const clasificari = {};
    const motiveCalitate = {};
    let intrebariCurenteRezultat = fereastra.curenta;
    const interpretareTip =
      configuratie.interpretare?.tip ||
      (configuratie.rezultat === "directie"
        ? "directie_standard_v1"
        : "stare_curenta_standard_v1");
    const interpreteaza = interpretariDisponibile[interpretareTip];
    if (typeof interpreteaza !== "function") {
      throw new EroareMABP(
        `Interpretarea ${interpretareTip} nu este definita.`,
        "INTERPRETARE_NECUNOSCUTA"
      );
    }

    if (configuratie.comparatie) {
      const bazaComparatie =
        configuratie.comparatie.tip === "jumatati_egale"
          ? fereastra.curenta
          : intrebariDomeniu;
      const toatePeGrup = grupeazaDupa(bazaComparatie, (item) =>
        idGrup(item, configuratie, catalog)
      );
      const curentePeGrup = grupeazaDupa(fereastra.curenta, (item) =>
        idGrup(item, configuratie, catalog)
      );
      const anterioarePeGrup = grupeazaDupa(fereastra.anterioara || [], (item) =>
        idGrup(item, configuratie, catalog)
      );
      const jumatatiCurente = [];

      for (const [id, toate] of toatePeGrup.entries()) {
        const ferestre =
          configuratie.comparatie.tip === "jumatati_egale"
            ? imparteJumatatiEgale(toate)
            : {
                anterioara: anterioarePeGrup.get(id) || [],
                curenta: curentePeGrup.get(id) || [],
              };
        if (configuratie.comparatie.tip === "jumatati_egale") {
          jumatatiCurente.push(...ferestre.curenta);
        }
        const filtruVechi = aplicaFiltru(
          ferestre.anterioara,
          configuratie.filtru,
          avertismente
        );
        const filtruNou = aplicaFiltru(
          ferestre.curenta,
          configuratie.filtru,
          avertismente
        );
        const filtruCurent = aplicaFiltru(
          ferestre.curenta,
          configuratie.filtru,
          avertismente
        );
        const metriciVechi = calculeazaMetriciCuExtensii(
          filtruVechi.observatii,
          configuratie,
          metrici,
          avertismente
        );
        const metriciNoi = calculeazaMetriciCuExtensii(
          filtruNou.observatii,
          configuratie,
          metrici,
          avertismente
        );
        const metriciCurente = calculeazaMetriciCuExtensii(
          filtruCurent.observatii,
          configuratie,
          metrici,
          avertismente
        );
        const directie = interpreteaza({
          metriciVechi,
          metriciNoi,
          metriciCurente,
          configuratie,
        });
        const delta = {
          timp:
            metriciVechi.mediana_timp_corect_prima_apasare == null ||
            metriciNoi.mediana_timp_corect_prima_apasare == null
              ? null
              : metriciNoi.mediana_timp_corect_prima_apasare -
                metriciVechi.mediana_timp_corect_prima_apasare,
          precizie:
            metriciVechi.precizie_prima_apasare == null ||
            metriciNoi.precizie_prima_apasare == null
              ? null
              : metriciNoi.precizie_prima_apasare -
                metriciVechi.precizie_prima_apasare,
        };
        const prima = toate[0];
        grupuri.push({
          id,
          eticheta: etichetaGrup(prima, configuratie, catalog),
          metrici: metriciCurente,
          stare: classificaStare(metriciNoi, configuratie),
          suficienta: nivelSuficienta(
            Math.min(metriciVechi.n_intrebari, metriciNoi.n_intrebari)
          ),
          comparatie: {
            vechi: metriciVechi,
            nou: metriciNoi,
            delta,
            directie,
          },
          serie: construiesteSerie(
            filtruCurent.observatii,
            configuratie,
            metrici,
            avertismente
          ),
        });
        clasificari[id] = directie;
        sumaMotive(motiveCalitate, filtruCurent.sumar.motive);
      }
      if (configuratie.comparatie.tip === "jumatati_egale") {
        intrebariCurenteRezultat = jumatatiCurente;
      }
    } else {
      const peGrup = grupeazaDupa(fereastra.curenta, (item) =>
        idGrup(item, configuratie, catalog)
      );
      for (const [id, elemente] of peGrup.entries()) {
        const filtrate = aplicaFiltru(elemente, configuratie.filtru, avertismente);
        const metriciCurente = calculeazaMetriciCuExtensii(
          filtrate.observatii,
          configuratie,
          metrici,
          avertismente
        );
        const stare = interpreteaza({
          metriciVechi: null,
          metriciNoi: null,
          metriciCurente,
          configuratie,
        });
        grupuri.push({
          id,
          eticheta: etichetaGrup(elemente[0], configuratie, catalog),
          metrici: metriciCurente,
          stare,
          suficienta: nivelSuficienta(metriciCurente.n_intrebari),
          serie: construiesteSerie(
            filtrate.observatii,
            configuratie,
            metrici,
            avertismente
          ),
        });
        clasificari[id] = stare;
        sumaMotive(motiveCalitate, filtrate.sumar.motive);
      }
    }

    const tablaMaterializata = materializeazaTabla({
      catalog,
      configuratie,
      grupuri,
      clasificari,
      metriciExtensie: metrici,
      avertismente,
    });
    const grupuriRezultat = tablaMaterializata.grupuri;
    const clasificariRezultat = tablaMaterializata.clasificari;

    const filtruAgregat = aplicaFiltru(
      intrebariCurenteRezultat,
      configuratie.filtru,
      avertismente
    );
    const metriciAgregate = calculeazaMetriciCuExtensii(
      filtruAgregat.observatii,
      configuratie,
      metrici,
      avertismente
    );
    const agregat = configuratie.comparatie
      ? { metrici: metriciAgregate, comparatie: agregaComparatii(grupuriRezultat) }
      : { metrici: metriciAgregate };
    const indisponibile = campuriIndisponibile(inregistrari);
    if (indisponibile.length > 0) {
      avertismente.add(
        `Campuri optionale indisponibile in setul curent: ${indisponibile.join(", ")}.`
      );
    }

    const inconsistenteOptiuni = numaraInconsistenteOptiuni(
      intrebariCurenteRezultat
    );

    return {
      tip: configuratie.rezultat || "exploratoriu",
      metadata: {
        motor_version: VERSIUNE_MOTOR,
        schema_version: configuratie.schema_version ?? null,
        preset_id: configuratie.preset_id ?? null,
        preset_version: configuratie.preset_version ?? null,
        filter_preset_id: configuratie.filter_preset_id ?? null,
        filter_version: configuratie.filter_version ?? null,
        total_inregistrari: inregistrari.length,
        total_intrebari: intrebari.length,
        intrebari_domeniu: intrebariDomeniu.length,
        intrebari_fereastra: intrebariCurenteRezultat.length,
        fereastra:
          configuratie.comparatie?.tip === "jumatati_egale"
            ? `${fereastra.descriere}; jumatatea curenta per grup`
            : fereastra.descriere,
        interval: intervalDate(intrebariCurenteRezultat),
        numar_facts: new Set(
          intrebariCurenteRezultat.map((item) => item.fact_id).filter(Boolean)
        ).size,
        numar_celule: tablaMaterializata.aranjare
          ? grupuriRezultat.length
          : null,
        numar_sesiuni: new Set(
          intrebariCurenteRezultat.map((item) => item.session_id).filter(Boolean)
        ).size,
        campuri_indisponibile: indisponibile,
        avertismente: [...avertismente],
      },
      calitate: {
        total: filtruAgregat.sumar.total,
        incluse_timp: filtruAgregat.sumar.incluse_timp,
        excluse_timp: filtruAgregat.sumar.excluse_timp,
        incluse_precizie: filtruAgregat.sumar.incluse_precizie,
        excluse_precizie: filtruAgregat.sumar.excluse_precizie,
        motive: motiveCalitate,
        inconsistente_optiuni: inconsistenteOptiuni.total,
        inconsistente_optiuni_dummy: inconsistenteOptiuni.dummy,
      },
      aranjare: tablaMaterializata.aranjare,
      grupuri: grupuriRezultat,
      agregat,
      clasificari: clasificariRezultat,
      configuratie: copieDate(configuratie),
    };
  }

  return Object.freeze({
    normalizeazaInregistrari,
    grupeazaApasariPeIntrebari,
    aplicaFiltru,
    ruleazaAnaliza,
  });
}
