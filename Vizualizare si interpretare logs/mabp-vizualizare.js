"use strict";

const NUME_CAMPURI = {
  id: "Identificator",
  eticheta: "Element analizat",
  stare: "Stare",
  suficienta: "Suficiența datelor",
  directie: "Direcție",
  vechi: "Fereastra veche",
  nou: "Fereastra nouă",
  delta: "Schimbare",
};

const STARI_POZITIVE = new Set(["fluent", "progres", "stabil_la_nivel_bun"]);
const STARI_NEGATIVE = new Set(["regres", "regres_probabil"]);
const STARI_ATENTIE = new Set([
  "in_consolidare",
  "în_consolidare",
  "in_lucru",
  "în_lucru",
  "stabil_inca_nefluent",
  "stabil_încă_nefluent",
  "viteza_mai_mare_dar_precizie_in_scadere",
]);

let urmatorulIdGrafic = 1;

function valideazaContainer(container) {
  if (!container || typeof container.replaceChildren !== "function") {
    throw new TypeError("Vizualizarea MABP are nevoie de un container DOM valid.");
  }
}

function obtineDocument(container) {
  const documentRef = container.ownerDocument || globalThis.document;
  if (!documentRef || typeof documentRef.createElement !== "function") {
    throw new Error("Documentul DOM nu este disponibil pentru vizualizarea MABP.");
  }
  return documentRef;
}

function creeazaElement(documentRef, tag, { clasa, text, atribute } = {}) {
  const element = documentRef.createElement(tag);
  if (clasa) element.className = clasa;
  if (text !== undefined) element.textContent = text;
  Object.entries(atribute || {}).forEach(([nume, valoare]) => {
    element.setAttribute(nume, String(valoare));
  });
  return element;
}

function esteObiectSimplu(valoare) {
  return valoare !== null && typeof valoare === "object" && !Array.isArray(valoare);
}

function eticheteazaCamp(camp) {
  if (NUME_CAMPURI[camp]) return NUME_CAMPURI[camp];
  const text = String(camp || "valoare").replaceAll("_", " ").trim();
  return text ? text[0].toLocaleUpperCase("ro-RO") + text.slice(1) : "Valoare";
}

function normalizeazaStare(stare) {
  return String(stare ?? "necunoscut")
    .trim()
    .toLocaleLowerCase("ro-RO")
    .replaceAll(" ", "_");
}

function eticheteazaStare(stare) {
  if (stare === null || stare === undefined || stare === "") return "Nespecificat";
  return eticheteazaCamp(String(stare));
}

function stabilesteTon(stare) {
  const normalizata = normalizeazaStare(stare);
  if (STARI_POZITIVE.has(normalizata)) return "pozitiv";
  if (STARI_NEGATIVE.has(normalizata)) return "negativ";
  if (STARI_ATENTIE.has(normalizata)) return "atentie";
  return "neutru";
}

function simbolStare(stare) {
  const ton = stabilesteTon(stare);
  if (ton === "pozitiv") return "✓";
  if (ton === "negativ") return "↓";
  if (ton === "atentie") return "!";
  return "•";
}

function formateazaNumar(numar, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("ro-RO", {
    maximumFractionDigits,
  }).format(numar);
}

function formateazaValoare(valoare, camp = "") {
  if (valoare === null || valoare === undefined || valoare === "") return "—";
  if (typeof valoare === "boolean") return valoare ? "Da" : "Nu";

  if (typeof valoare === "number" && Number.isFinite(valoare)) {
    const cheie = String(camp).toLocaleLowerCase("ro-RO");
    if (cheie.startsWith("n_") || /numar|total|incluse|excluse|count/.test(cheie)) {
      return formateazaNumar(valoare, 2);
    }
    if (/precizie|procent|rata|pondere/.test(cheie)) {
      const procent = Math.abs(valoare) <= 1 ? valoare * 100 : valoare;
      return `${formateazaNumar(procent, 1)}%`;
    }
    if (/timp|secund|durata|\brt\b/.test(cheie)) {
      return `${formateazaNumar(valoare, 2)} s`;
    }
    return formateazaNumar(valoare, 2);
  }

  if (Array.isArray(valoare)) {
    return valoare.length ? valoare.map((item) => formateazaValoare(item, camp)).join(", ") : "—";
  }

  if (esteObiectSimplu(valoare)) {
    if (Object.hasOwn(valoare, "valoare")) {
      const text = formateazaValoare(valoare.valoare, camp);
      return valoare.unitate ? `${text} ${valoare.unitate}`.trim() : text;
    }
    return Object.entries(valoare)
      .map(([cheie, continut]) => `${eticheteazaCamp(cheie)}: ${formateazaValoare(continut, cheie)}`)
      .join("; ");
  }

  return String(valoare);
}

function adaugaListaDefinitii(documentRef, container, date, { clasa = "mabp-definitii", limita } = {}) {
  if (!esteObiectSimplu(date)) return null;
  const intrari = Object.entries(date).filter(([, valoare]) => valoare !== undefined);
  const selectate = Number.isInteger(limita) ? intrari.slice(0, limita) : intrari;
  if (!selectate.length) return null;

  const lista = creeazaElement(documentRef, "dl", { clasa });
  selectate.forEach(([camp, valoare]) => {
    lista.append(
      creeazaElement(documentRef, "dt", { text: eticheteazaCamp(camp) }),
      creeazaElement(documentRef, "dd", { text: formateazaValoare(valoare, camp) }),
    );
  });
  container.append(lista);
  return lista;
}

function extrageAvertismente(rezultat) {
  const colectii = [
    rezultat?.metadata?.avertismente,
    rezultat?.calitate?.avertismente,
    rezultat?.configuratie?.avertismente,
  ];
  return [...new Set(colectii.flatMap((colectie) => (Array.isArray(colectie) ? colectie : [])))];
}

function randeazaContextRezultat(documentRef, container, rezultat) {
  const antet = creeazaElement(documentRef, "header", { clasa: "mabp-rezumat" });
  antet.append(creeazaElement(documentRef, "h3", { text: "Rezultatul analizei" }));

  const metadata = rezultat.metadata || {};
  const interval = metadata.interval || metadata.perioada;
  const descriere = [
    metadata.preset_id || rezultat.configuratie?.preset_id,
    metadata.preset_version ? `versiunea ${metadata.preset_version}` : null,
    typeof interval === "string" || typeof interval === "number" ? interval : null,
  ].filter(Boolean);
  if (descriere.length) {
    antet.append(creeazaElement(documentRef, "p", { text: descriere.join(" · ") }));
  }

  const avertismente = extrageAvertismente(rezultat);
  if (avertismente.length) {
    const bloc = creeazaElement(documentRef, "section", {
      clasa: "mabp-avertisment",
      atribute: { role: "status", "aria-label": "Avertismentele analizei" },
    });
    bloc.append(creeazaElement(documentRef, "h4", { text: "Atenție la interpretare" }));
    const lista = creeazaElement(documentRef, "ul");
    avertismente.forEach((mesaj) => lista.append(creeazaElement(documentRef, "li", { text: String(mesaj) })));
    bloc.append(lista);
    antet.append(bloc);
  }

  const panouri = creeazaElement(documentRef, "div", { clasa: "mabp-panouri-context" });
  if (Object.keys(metadata).length) {
    const detalii = creeazaElement(documentRef, "details", { clasa: "mabp-panou-context" });
    detalii.append(creeazaElement(documentRef, "summary", { text: "Metadatele raportului" }));
    adaugaListaDefinitii(documentRef, detalii, metadata);
    panouri.append(detalii);
  }
  if (esteObiectSimplu(rezultat.calitate) && Object.keys(rezultat.calitate).length) {
    const detalii = creeazaElement(documentRef, "details", { clasa: "mabp-panou-context" });
    detalii.append(creeazaElement(documentRef, "summary", { text: "Calitatea datelor" }));
    adaugaListaDefinitii(documentRef, detalii, rezultat.calitate);
    panouri.append(detalii);
  }
  if (esteObiectSimplu(rezultat.agregat) && Object.keys(rezultat.agregat).length) {
    const detalii = creeazaElement(documentRef, "details", { clasa: "mabp-panou-context" });
    detalii.append(creeazaElement(documentRef, "summary", { text: "Rezumat agregat" }));
    adaugaListaDefinitii(documentRef, detalii, rezultat.agregat);
    panouri.append(detalii);
  }
  if (esteObiectSimplu(rezultat.configuratie) && Object.keys(rezultat.configuratie).length) {
    const detalii = creeazaElement(documentRef, "details", { clasa: "mabp-panou-context" });
    detalii.append(creeazaElement(documentRef, "summary", { text: "Configurația folosită" }));
    adaugaListaDefinitii(documentRef, detalii, rezultat.configuratie);
    panouri.append(detalii);
  }
  if (panouri.children?.length || panouri.childNodes?.length) antet.append(panouri);
  container.append(antet);
}

function adaugaInsigneGrup(documentRef, container, grup) {
  const rand = creeazaElement(documentRef, "div", { clasa: "mabp-insigne" });
  const stare = grup.comparatie?.directie || grup.stare;
  if (stare) {
    rand.append(
      creeazaElement(documentRef, "span", {
        clasa: `mabp-insigna mabp-insigna--${stabilesteTon(stare)}`,
        text: `${simbolStare(stare)} ${eticheteazaStare(stare)}`,
      }),
    );
  }
  if (grup.suficienta) {
    rand.append(
      creeazaElement(documentRef, "span", {
        clasa: "mabp-insigna mabp-insigna--date",
        text: `Date: ${eticheteazaStare(grup.suficienta)}`,
      }),
    );
  }
  if (rand.children?.length || rand.childNodes?.length) container.append(rand);
}

function randeazaComparatie(documentRef, container, comparatie) {
  if (!esteObiectSimplu(comparatie)) return;
  const sectiune = creeazaElement(documentRef, "section", { clasa: "mabp-comparatie" });
  sectiune.append(creeazaElement(documentRef, "h5", { text: "Comparația ferestrelor" }));
  adaugaListaDefinitii(documentRef, sectiune, comparatie);
  container.append(sectiune);
}

function randeazaGol(documentRef, container, mesaj = "Nu există grupuri pentru configurația aleasă.") {
  container.append(
    creeazaElement(documentRef, "p", {
      clasa: "mabp-stare-goala",
      text: mesaj,
      atribute: { role: "status" },
    }),
  );
}

function randeazaDetaliuFact({ rezultat, container }) {
  const documentRef = obtineDocument(container);
  const grupuri = Array.isArray(rezultat.grupuri) ? rezultat.grupuri : [];
  if (!grupuri.length) {
    randeazaGol(documentRef, container);
    return;
  }

  const lista = creeazaElement(documentRef, "div", { clasa: "mabp-lista-detalii" });
  grupuri.forEach((grup) => {
    const articol = creeazaElement(documentRef, "article", { clasa: "mabp-card-detaliu" });
    articol.append(
      creeazaElement(documentRef, "h4", {
        text: grup.eticheta || grup.id || "Grup fără etichetă",
      }),
    );
    if (grup.id && grup.eticheta && grup.id !== grup.eticheta) {
      articol.append(creeazaElement(documentRef, "p", { clasa: "mabp-id", text: grup.id }));
    }
    adaugaInsigneGrup(documentRef, articol, grup);
    adaugaListaDefinitii(documentRef, articol, grup.metrici || {});
    randeazaComparatie(documentRef, articol, grup.comparatie);
    lista.append(articol);
  });
  container.append(lista);
}

function randeazaGrilaProgres({ rezultat, container }) {
  const documentRef = obtineDocument(container);
  const grupuri = Array.isArray(rezultat.grupuri) ? rezultat.grupuri : [];
  if (!grupuri.length) {
    randeazaGol(documentRef, container);
    return;
  }

  const explicatie = creeazaElement(documentRef, "p", {
    clasa: "mabp-explicatie-grila",
    text: "Fiecare celulă afișează textual direcția și suficiența datelor; culoarea este doar un indiciu suplimentar.",
  });
  const grila = creeazaElement(documentRef, "ul", {
    clasa: "mabp-grila",
    atribute: { "aria-label": "Grila progresului" },
  });

  grupuri.forEach((grup) => {
    const stare = grup.comparatie?.directie || grup.stare || "necunoscut";
    const elementLista = creeazaElement(documentRef, "li");
    const celula = creeazaElement(documentRef, "article", {
      clasa: `mabp-celula mabp-celula--${stabilesteTon(stare)}`,
      atribute: { "data-stare": normalizeazaStare(stare) },
    });
    celula.append(
      creeazaElement(documentRef, "h4", { text: grup.eticheta || grup.id || "Grup" }),
      creeazaElement(documentRef, "p", {
        clasa: "mabp-celula-stare",
        text: `${simbolStare(stare)} ${eticheteazaStare(stare)}`,
      }),
    );
    if (grup.suficienta) {
      celula.append(
        creeazaElement(documentRef, "p", {
          clasa: "mabp-celula-suficienta",
          text: `Date: ${eticheteazaStare(grup.suficienta)}`,
        }),
      );
    }
    adaugaListaDefinitii(documentRef, celula, grup.metrici || {}, {
      clasa: "mabp-definitii mabp-definitii--compact",
      limita: 3,
    });
    elementLista.append(celula);
    grila.append(elementLista);
  });

  container.append(explicatie, grila);
}

function extragePunctSerie(punct, index) {
  if (typeof punct === "number" && Number.isFinite(punct)) {
    return { eticheta: String(index + 1), valoare: punct };
  }
  if (!esteObiectSimplu(punct)) return null;

  const eticheta =
    punct.eticheta ?? punct.label ?? punct.data ?? punct.sesiune ?? punct.perioada ?? punct.x ?? index + 1;
  const candidati = [
    ["valoare", punct.valoare],
    ["value", punct.value],
    ["y", punct.y],
    ["mediana", punct.mediana],
    ["mediana_timp", punct.mediana_timp],
    ["timp", punct.timp],
    ["delta", punct.delta],
  ];
  const gasit = candidati.find(([, candidat]) =>
    typeof candidat === "number" && Number.isFinite(candidat)
  );
  if (!gasit) return null;
  const [campGasit, valoare] = gasit;
  const metrica = punct.metrica ?? punct.metric ??
    (!["valoare", "value", "y"].includes(campGasit) ? campGasit : null);
  return {
    eticheta: String(eticheta),
    valoare,
    metrica: metrica == null ? null : String(metrica),
    unitate: punct.unitate ?? punct.unit ?? null,
  };
}

function descrieSerie(puncte) {
  const metrica = puncte.find((punct) => punct.metrica)?.metrica ?? null;
  const unitate = puncte.find((punct) => punct.unitate)?.unitate ?? null;
  const nume = metrica ? eticheteazaCamp(metrica) : "Valoare";
  return {
    metrica,
    unitate,
    eticheta: unitate ? `${nume} (${unitate})` : nume,
  };
}

function formateazaPunctSerie(punct, descriere) {
  const camp = punct.metrica || descriere.metrica || "";
  const unitate = punct.unitate || descriere.unitate;
  const text = formateazaValoare(punct.valoare, camp);
  return unitate && !text.endsWith(String(unitate))
    ? `${text} ${unitate}`
    : text;
}

function creeazaSvgSerie(documentRef, puncte, titlu, descriere) {
  if (typeof documentRef.createElementNS !== "function" || puncte.length < 2) return null;

  const latime = 720;
  const inaltime = 260;
  const margine = { sus: 28, dreapta: 24, jos: 42, stanga: 56 };
  const valori = puncte.map((punct) => punct.valoare);
  let minim = Math.min(...valori);
  let maxim = Math.max(...valori);
  if (minim === maxim) {
    minim -= 0.5;
    maxim += 0.5;
  }

  const x = (index) => margine.stanga + (index / (puncte.length - 1)) * (latime - margine.stanga - margine.dreapta);
  const y = (valoare) =>
    margine.sus + ((maxim - valoare) / (maxim - minim)) * (inaltime - margine.sus - margine.jos);
  const svg = documentRef.createElementNS("http://www.w3.org/2000/svg", "svg");
  const idTitlu = `mabp-grafic-titlu-${urmatorulIdGrafic++}`;
  svg.setAttribute("class", "mabp-grafic-svg");
  svg.setAttribute("viewBox", `0 0 ${latime} ${inaltime}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-labelledby", idTitlu);

  const titluSvg = documentRef.createElementNS("http://www.w3.org/2000/svg", "title");
  titluSvg.setAttribute("id", idTitlu);
  titluSvg.textContent = `${titlu}: ${descriere.eticheta}, evoluție în ${puncte.length} puncte`;
  svg.append(titluSvg);

  [0, 0.5, 1].forEach((raport) => {
    const pozitieY = margine.sus + raport * (inaltime - margine.sus - margine.jos);
    const linie = documentRef.createElementNS("http://www.w3.org/2000/svg", "line");
    linie.setAttribute("x1", margine.stanga);
    linie.setAttribute("x2", latime - margine.dreapta);
    linie.setAttribute("y1", pozitieY);
    linie.setAttribute("y2", pozitieY);
    linie.setAttribute("class", "mabp-grafic-grila");
    svg.append(linie);

    const eticheta = documentRef.createElementNS("http://www.w3.org/2000/svg", "text");
    eticheta.setAttribute("x", margine.stanga - 9);
    eticheta.setAttribute("y", pozitieY + 4);
    eticheta.setAttribute("text-anchor", "end");
    eticheta.setAttribute("class", "mabp-grafic-eticheta");
    eticheta.textContent = formateazaPunctSerie(
      { valoare: maxim - raport * (maxim - minim) },
      descriere,
    );
    svg.append(eticheta);
  });

  const linieDate = documentRef.createElementNS("http://www.w3.org/2000/svg", "polyline");
  linieDate.setAttribute(
    "points",
    puncte.map((punct, index) => `${x(index)},${y(punct.valoare)}`).join(" "),
  );
  linieDate.setAttribute("class", "mabp-grafic-linie");
  svg.append(linieDate);

  puncte.forEach((punct, index) => {
    const cerc = documentRef.createElementNS("http://www.w3.org/2000/svg", "circle");
    cerc.setAttribute("cx", x(index));
    cerc.setAttribute("cy", y(punct.valoare));
    cerc.setAttribute("r", 4);
    cerc.setAttribute("class", "mabp-grafic-punct");
    const descrierePunct = documentRef.createElementNS(
      "http://www.w3.org/2000/svg",
      "title",
    );
    descrierePunct.textContent = `${punct.eticheta}: ${formateazaPunctSerie(
      punct,
      descriere,
    )}`;
    cerc.append(descrierePunct);
    svg.append(cerc);
  });

  const primaEticheta = documentRef.createElementNS("http://www.w3.org/2000/svg", "text");
  primaEticheta.setAttribute("x", margine.stanga);
  primaEticheta.setAttribute("y", inaltime - 14);
  primaEticheta.setAttribute("class", "mabp-grafic-eticheta");
  primaEticheta.textContent = puncte[0].eticheta;
  svg.append(primaEticheta);

  const ultimaEticheta = documentRef.createElementNS("http://www.w3.org/2000/svg", "text");
  ultimaEticheta.setAttribute("x", latime - margine.dreapta);
  ultimaEticheta.setAttribute("y", inaltime - 14);
  ultimaEticheta.setAttribute("text-anchor", "end");
  ultimaEticheta.setAttribute("class", "mabp-grafic-eticheta");
  ultimaEticheta.textContent = puncte.at(-1).eticheta;
  svg.append(ultimaEticheta);

  return svg;
}

function randeazaTabelSerie(documentRef, container, puncte, titlu, descriere) {
  const tabel = creeazaElement(documentRef, "table", { clasa: "mabp-tabel mabp-tabel--serie" });
  tabel.append(creeazaElement(documentRef, "caption", { text: `Valorile graficului: ${titlu}` }));
  const antet = creeazaElement(documentRef, "thead");
  const randAntet = creeazaElement(documentRef, "tr");
  ["Punct", descriere.eticheta].forEach((text) => {
    randAntet.append(creeazaElement(documentRef, "th", { text, atribute: { scope: "col" } }));
  });
  antet.append(randAntet);
  const corp = creeazaElement(documentRef, "tbody");
  puncte.forEach((punct) => {
    const rand = creeazaElement(documentRef, "tr");
    rand.append(
      creeazaElement(documentRef, "th", { text: punct.eticheta, atribute: { scope: "row" } }),
      creeazaElement(documentRef, "td", {
        text: formateazaPunctSerie(punct, descriere),
      }),
    );
    corp.append(rand);
  });
  tabel.append(antet, corp);
  container.append(tabel);
}

function randeazaGraficLinie({ rezultat, container }) {
  const documentRef = obtineDocument(container);
  const grupuri = (Array.isArray(rezultat.grupuri) ? rezultat.grupuri : []).filter(
    (grup) => Array.isArray(grup.serie),
  );
  if (!grupuri.length) {
    container.append(
      creeazaElement(documentRef, "p", {
        clasa: "mabp-nota-fallback",
        text: "Rezultatul nu conține încă o serie temporală. Metricile disponibile sunt afișate ca tabel.",
        atribute: { role: "status" },
      }),
    );
    randeazaTabel({ rezultat, container });
    return;
  }

  grupuri.forEach((grup) => {
    const puncte = grup.serie.map(extragePunctSerie).filter(Boolean);
    const titlu = grup.eticheta || grup.id || "Serie";
    const articol = creeazaElement(documentRef, "article", { clasa: "mabp-card-grafic" });
    articol.append(creeazaElement(documentRef, "h4", { text: titlu }));
    adaugaInsigneGrup(documentRef, articol, grup);
    if (!puncte.length) {
      randeazaGol(
        documentRef,
        articol,
        "Seria nu declară explicit o valoare numerică; graficul nu a ales arbitrar una dintre metrici.",
      );
    } else {
      const descriereSerie = descrieSerie(puncte);
      articol.append(
        creeazaElement(documentRef, "p", {
          clasa: "mabp-grafic-metrica",
          text: `Metrică: ${descriereSerie.eticheta}`,
        }),
      );
      const svg = creeazaSvgSerie(
        documentRef,
        puncte,
        titlu,
        descriereSerie,
      );
      if (svg) articol.append(svg);
      randeazaTabelSerie(documentRef, articol, puncte, titlu, descriereSerie);
    }
    container.append(articol);
  });
}

function construiesteRandTabel(grup) {
  return {
    id: grup.id,
    eticheta: grup.eticheta,
    stare: grup.stare,
    suficienta: grup.suficienta,
    ...(esteObiectSimplu(grup.metrici) ? grup.metrici : {}),
    ...(esteObiectSimplu(grup.comparatie)
      ? {
          directie: grup.comparatie.directie,
          vechi: grup.comparatie.vechi,
          nou: grup.comparatie.nou,
          delta: grup.comparatie.delta,
        }
      : {}),
  };
}

function randeazaTabel({ rezultat, container }) {
  const documentRef = obtineDocument(container);
  const randuri = (Array.isArray(rezultat.grupuri) ? rezultat.grupuri : []).map(construiesteRandTabel);
  if (!randuri.length) {
    randeazaGol(documentRef, container);
    return;
  }
  const coloane = [...new Set(randuri.flatMap((rand) => Object.keys(rand)))];
  const invelis = creeazaElement(documentRef, "div", {
    clasa: "mabp-tabel-scroll",
    atribute: {
      role: "region",
      "aria-label": "Tabelul rezultatelor; poate fi derulat orizontal",
      tabindex: "0",
    },
  });
  const tabel = creeazaElement(documentRef, "table", { clasa: "mabp-tabel" });
  tabel.append(creeazaElement(documentRef, "caption", { text: "Rezultatele analizei în format tabelar" }));
  const antet = creeazaElement(documentRef, "thead");
  const randAntet = creeazaElement(documentRef, "tr");
  coloane.forEach((coloana) => {
    randAntet.append(
      creeazaElement(documentRef, "th", {
        text: eticheteazaCamp(coloana),
        atribute: { scope: "col" },
      }),
    );
  });
  antet.append(randAntet);

  const corp = creeazaElement(documentRef, "tbody");
  randuri.forEach((dateRand) => {
    const rand = creeazaElement(documentRef, "tr");
    coloane.forEach((coloana, index) => {
      const tag = index === 0 ? "th" : "td";
      const celula = creeazaElement(documentRef, tag, {
        text: formateazaValoare(dateRand[coloana], coloana),
        atribute: index === 0 ? { scope: "row" } : undefined,
      });
      rand.append(celula);
    });
    corp.append(rand);
  });
  tabel.append(antet, corp);
  invelis.append(tabel);
  container.append(invelis);
}

const VIZUALIZARI_IMPLICITE = Object.freeze({
  detaliu_fact: randeazaDetaliuFact,
  grila_progres: randeazaGrilaProgres,
  grafic_linie: randeazaGraficLinie,
});

function valideazaVizualizari(vizualizari) {
  if (!esteObiectSimplu(vizualizari)) {
    throw new TypeError("`vizualizari` trebuie să fie un obiect cu funcții de randare.");
  }
  Object.entries(vizualizari).forEach(([tip, randeaza]) => {
    if (!tip || typeof randeaza !== "function") {
      throw new TypeError(`Vizualizarea „${tip || "fără nume"}” trebuie să fie o funcție.`);
    }
  });
}

export function creeazaVizualizatorMABP({ vizualizari = {} } = {}) {
  valideazaVizualizari(vizualizari);
  const registru = Object.freeze({ ...VIZUALIZARI_IMPLICITE, ...vizualizari });

  function afiseaza({ rezultat, container, tip } = {}) {
    valideazaContainer(container);
    if (!esteObiectSimplu(rezultat)) {
      throw new TypeError("Vizualizarea MABP are nevoie de rezultatul explicit al analizei.");
    }

    const documentRef = obtineDocument(container);
    const tipCerut = typeof tip === "string" && tip.trim() ? tip.trim() : "tabel";
    const esteInregistrata = Object.hasOwn(registru, tipCerut);
    const folosesteFallback = !esteInregistrata && tipCerut !== "tabel";
    const randeaza = esteInregistrata ? registru[tipCerut] : randeazaTabel;
    container.replaceChildren();
    randeazaContextRezultat(documentRef, container, rezultat);

    const continut = creeazaElement(documentRef, "section", {
      clasa: "mabp-vizualizare-continut",
      atribute: { "aria-label": `Vizualizare: ${tipCerut}` },
    });
    if (folosesteFallback) {
      continut.append(
        creeazaElement(documentRef, "p", {
          clasa: "mabp-nota-fallback",
          text: `Vizualizarea „${tipCerut}” nu este înregistrată. Rezultatul este afișat ca tabel.`,
          atribute: { role: "status" },
        }),
      );
    }
    randeaza({ rezultat, container: continut, tip: tipCerut });
    container.append(continut);

    return {
      tip: esteInregistrata ? tipCerut : "tabel",
      fallback: folosesteFallback,
    };
  }

  return Object.freeze({ afiseaza });
}
