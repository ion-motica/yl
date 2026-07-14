"use strict";

function valideazaText(valoare, numeCamp) {
  if (typeof valoare !== "string" || !valoare.trim()) {
    throw new TypeError(`${numeCamp} trebuie să fie un text nevid.`);
  }
  return valoare.trim();
}

function valideazaIdGrup(valoare) {
  const id = valideazaText(valoare, "id");
  if (/\s/u.test(id)) {
    throw new RangeError("id nu poate conține spații.");
  }
  return id;
}

function valideazaOptiuni(optiuni) {
  if (!Array.isArray(optiuni) || optiuni.length === 0) {
    throw new TypeError("optiuni trebuie să fie un array nevid.");
  }

  const iduri = new Set();
  return optiuni.map((optiune, index) => {
    if (!optiune || typeof optiune !== "object" || Array.isArray(optiune)) {
      throw new TypeError(`optiuni[${index}] trebuie să fie un obiect.`);
    }

    const id = valideazaText(optiune.id, `optiuni[${index}].id`);
    if (iduri.has(id)) {
      throw new RangeError(`ID-ul opțiunii „${id}” este duplicat.`);
    }
    iduri.add(id);

    if (optiune.dezactivata !== undefined && typeof optiune.dezactivata !== "boolean") {
      throw new TypeError(`optiuni[${index}].dezactivata trebuie să fie booleană.`);
    }

    const motivDezactivare =
      optiune.motivDezactivare === undefined
        ? null
        : valideazaText(
            optiune.motivDezactivare,
            `optiuni[${index}].motivDezactivare`,
          );
    if (optiune.dezactivata === true && !motivDezactivare) {
      throw new TypeError(
        `optiuni[${index}].motivDezactivare este obligatoriu pentru o opțiune dezactivată.`,
      );
    }

    return {
      id,
      eticheta: valideazaText(optiune.eticheta, `optiuni[${index}].eticheta`),
      descriere:
        optiune.descriere === undefined
          ? null
          : valideazaText(optiune.descriere, `optiuni[${index}].descriere`),
      dezactivata: optiune.dezactivata === true,
      motivDezactivare,
    };
  });
}

function valideazaSelectate(
  selectate,
  tipSelectie,
  optiuniDupaId,
  motiveIndisponibile = new Map(),
) {
  if (!Array.isArray(selectate)) {
    throw new TypeError("selectate trebuie să fie un array de ID-uri.");
  }

  if (tipSelectie === "unica" && selectate.length > 1) {
    throw new RangeError("Selecția unică acceptă cel mult un ID.");
  }

  const rezultat = [];
  const iduriVazute = new Set();
  selectate.forEach((id, index) => {
    const idValid = valideazaText(id, `selectate[${index}]`);
    const optiune = optiuniDupaId.get(idValid);
    if (!optiune) {
      throw new RangeError(`Opțiunea selectată „${idValid}” nu există.`);
    }
    if (optiune.dezactivata) {
      throw new RangeError(`Opțiunea selectată „${idValid}” este dezactivată.`);
    }
    if (motiveIndisponibile.has(idValid)) {
      throw new RangeError(`Opțiunea selectată „${idValid}” este indisponibilă.`);
    }
    if (iduriVazute.has(idValid)) {
      throw new RangeError(`Opțiunea selectată „${idValid}” este duplicată.`);
    }
    iduriVazute.add(idValid);
    rezultat.push(idValid);
  });
  return rezultat;
}

function creeazaElement(documentRef, tag, { clasa, text, id } = {}) {
  const element = documentRef.createElement(tag);
  if (clasa) element.className = clasa;
  if (text !== undefined) element.textContent = text;
  if (id) element.id = id;
  return element;
}

export function creeazaGrupOptiuni(parametri = {}) {
  if (!parametri || typeof parametri !== "object" || Array.isArray(parametri)) {
    throw new TypeError("Parametrii grupului trebuie să fie un obiect.");
  }
  const {
    documentRef,
    container,
    id,
    eticheta,
    ajutor,
    tipSelectie,
    optiuni,
    selectate = [],
    laSchimbare,
  } = parametri;

  if (!documentRef || typeof documentRef.createElement !== "function") {
    throw new TypeError("documentRef trebuie să fie un document DOM valid.");
  }
  if (!container || typeof container.append !== "function") {
    throw new TypeError("container trebuie să fie un element DOM valid.");
  }
  const idGrup = valideazaIdGrup(id);
  if (
    typeof documentRef.getElementById === "function" &&
    documentRef.getElementById(idGrup)
  ) {
    throw new RangeError(`ID-ul grupului „${idGrup}” este deja folosit.`);
  }
  const etichetaGrup = valideazaText(eticheta, "eticheta");
  const ajutorGrup =
    ajutor === undefined ? null : valideazaText(ajutor, "ajutor");
  if (tipSelectie !== "unica" && tipSelectie !== "multipla") {
    throw new RangeError('tipSelectie trebuie să fie „unica” sau „multipla”.');
  }
  if (laSchimbare !== undefined && typeof laSchimbare !== "function") {
    throw new TypeError("laSchimbare trebuie să fie o funcție.");
  }

  const optiuniNormalizate = valideazaOptiuni(optiuni);
  const optiuniDupaId = new Map(
    optiuniNormalizate.map((optiune) => [optiune.id, optiune]),
  );
  const selectateInitial = valideazaSelectate(
    selectate,
    tipSelectie,
    optiuniDupaId,
  );

  const fieldset = creeazaElement(documentRef, "fieldset", {
    clasa: "mabp-grup-optiuni",
    id: idGrup,
  });
  fieldset.append(
    creeazaElement(documentRef, "legend", {
      clasa: "mabp-grup-optiuni__eticheta",
      text: etichetaGrup,
    }),
  );

  if (ajutorGrup) {
    const idAjutor = `${idGrup}-ajutor`;
    fieldset.append(
      creeazaElement(documentRef, "p", {
        clasa: "mabp-grup-optiuni__ajutor",
        text: ajutorGrup,
        id: idAjutor,
      }),
    );
    fieldset.setAttribute("aria-describedby", idAjutor);
  }

  const lista = creeazaElement(documentRef, "div", {
    clasa: "mabp-grup-optiuni__lista",
  });
  const intrari = [];
  const optiuneDupaIntrare = new Map();
  const iduriDescriereFixeDupaIntrare = new Map();
  const motivDinamicDupaIntrare = new Map();
  let motiveIndisponibile = new Map();
  let grupDezactivat = false;

  function citeste() {
    return intrari
      .filter((intrare) => intrare.checked)
      .map((intrare) => optiuneDupaIntrare.get(intrare).id);
  }

  function seteaza(noiSelectate) {
    const iduriSelectate = new Set(
      valideazaSelectate(
        noiSelectate,
        tipSelectie,
        optiuniDupaId,
        motiveIndisponibile,
      ),
    );
    intrari.forEach((intrare) => {
      intrare.checked = iduriSelectate.has(optiuneDupaIntrare.get(intrare).id);
    });
  }

  function actualizeazaIntrare(intrare) {
    const optiune = optiuneDupaIntrare.get(intrare);
    const motivDinamic = motivDinamicDupaIntrare.get(intrare);
    const motiv = motiveIndisponibile.get(optiune.id) || null;
    const iduriDescriere = [
      ...(iduriDescriereFixeDupaIntrare.get(intrare) || []),
    ];

    intrare.disabled = grupDezactivat || optiune.dezactivata || Boolean(motiv);
    motivDinamic.hidden = !motiv;
    motivDinamic.textContent = motiv || "";
    if (motiv) iduriDescriere.push(motivDinamic.id);

    if (iduriDescriere.length) {
      intrare.setAttribute("aria-describedby", iduriDescriere.join(" "));
    } else {
      intrare.removeAttribute("aria-describedby");
    }
  }

  function seteazaDezactivat(dezactivat) {
    if (typeof dezactivat !== "boolean") {
      throw new TypeError("Starea dezactivată trebuie să fie booleană.");
    }
    grupDezactivat = dezactivat;
    fieldset.disabled = grupDezactivat;
    intrari.forEach(actualizeazaIntrare);
  }

  function seteazaIndisponibile(motiveDupaId = {}) {
    const prototip =
      motiveDupaId && typeof motiveDupaId === "object"
        ? Object.getPrototypeOf(motiveDupaId)
        : null;
    if (
      !motiveDupaId ||
      typeof motiveDupaId !== "object" ||
      Array.isArray(motiveDupaId) ||
      (prototip !== Object.prototype && prototip !== null)
    ) {
      throw new TypeError(
        "Motivele indisponibilității trebuie să fie un obiect simplu.",
      );
    }

    const motiveNoi = new Map();
    for (const [idOptiune, motiv] of Object.entries(motiveDupaId)) {
      if (!optiuniDupaId.has(idOptiune)) {
        throw new RangeError(`Opțiunea indisponibilă „${idOptiune}” nu există.`);
      }
      motiveNoi.set(
        idOptiune,
        valideazaText(motiv, `motivul indisponibilității pentru „${idOptiune}”`),
      );
    }

    const iduriSelectate = new Set(citeste());
    for (const idOptiune of motiveNoi.keys()) {
      if (iduriSelectate.has(idOptiune)) {
        throw new RangeError(
          `Opțiunea selectată „${idOptiune}” nu poate deveni indisponibilă.`,
        );
      }
    }

    motiveIndisponibile = motiveNoi;
    intrari.forEach(actualizeazaIntrare);
  }

  optiuniNormalizate.forEach((optiune, index) => {
    const idIntrare = `${idGrup}-optiune-${index + 1}`;
    const idEticheta = `${idIntrare}-eticheta`;
    const iduriDescriere = [];
    const etichetaOptiune = creeazaElement(documentRef, "label", {
      clasa: "mabp-grup-optiuni__optiune",
    });
    etichetaOptiune.setAttribute("for", idIntrare);

    const intrare = creeazaElement(documentRef, "input", {
      clasa: "mabp-grup-optiuni__intrare",
      id: idIntrare,
    });
    intrare.type = tipSelectie === "unica" ? "radio" : "checkbox";
    intrare.name = idGrup;
    intrare.value = optiune.id;
    intrare.checked = selectateInitial.includes(optiune.id);
    intrare.disabled = optiune.dezactivata;
    intrare.setAttribute("aria-labelledby", idEticheta);

    const continut = creeazaElement(documentRef, "span", {
      clasa: "mabp-grup-optiuni__continut",
    });
    continut.append(
      creeazaElement(documentRef, "span", {
        clasa: "mabp-grup-optiuni__text",
        text: optiune.eticheta,
        id: idEticheta,
      }),
    );

    if (optiune.descriere) {
      const idDescriere = `${idIntrare}-descriere`;
      iduriDescriere.push(idDescriere);
      continut.append(
        creeazaElement(documentRef, "span", {
          clasa: "mabp-grup-optiuni__descriere",
          text: optiune.descriere,
          id: idDescriere,
        }),
      );
    }

    if (optiune.dezactivata && optiune.motivDezactivare) {
      const idMotiv = `${idIntrare}-motiv-dezactivare`;
      iduriDescriere.push(idMotiv);
      continut.append(
        creeazaElement(documentRef, "span", {
          clasa: "mabp-grup-optiuni__motiv-dezactivare",
          text: optiune.motivDezactivare,
          id: idMotiv,
        }),
      );
    }

    const motivDinamic = creeazaElement(documentRef, "span", {
      clasa: "mabp-grup-optiuni__motiv-indisponibilitate",
      id: `${idIntrare}-motiv-indisponibilitate`,
    });
    motivDinamic.hidden = true;
    continut.append(motivDinamic);

    if (iduriDescriere.length) {
      intrare.setAttribute("aria-describedby", iduriDescriere.join(" "));
    }
    intrare.addEventListener("change", () => laSchimbare?.(citeste()));

    optiuneDupaIntrare.set(intrare, optiune);
    iduriDescriereFixeDupaIntrare.set(intrare, iduriDescriere);
    motivDinamicDupaIntrare.set(intrare, motivDinamic);
    intrari.push(intrare);
    etichetaOptiune.append(intrare, continut);
    lista.append(etichetaOptiune);
  });

  fieldset.append(lista);
  container.append(fieldset);

  return {
    citeste,
    seteaza,
    seteazaDezactivat,
    seteazaIndisponibile,
    element: fieldset,
    intrari,
  };
}
