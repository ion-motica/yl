(function (global) {
  "use strict";

  const VERSIUNE_PRESET = 1;
  const GRUPE_PRESETURI = [
    {
      nume: "Preview",
      preseturi: [
        {
          versiune: 1,
          nume: "Preset 2",
          coloane: [
            { camp: "indexeddb_key", vizibila: false, latime: 147, minimizata: false },
            { camp: "data_ora_ro", vizibila: true, latime: 66, minimizata: false },
            { camp: "quiz_name", vizibila: true, latime: 106, minimizata: false },
            { camp: "subquiz_name", vizibila: true, latime: 75, minimizata: false },
            { camp: "fact", vizibila: true, latime: 84, minimizata: false },
            { camp: "eq_form", vizibila: true, latime: 109, minimizata: false },
            { camp: "intrebare", vizibila: true, latime: 114, minimizata: false },
            {
              camp: "durata_raspuns_secunde",
              vizibila: true,
              latime: 97,
              minimizata: false,
            },
            { camp: "raspuns", vizibila: false, latime: 106, minimizata: false },
            {
              camp: "a_raspuns_corect",
              vizibila: true,
              latime: 70,
              minimizata: false,
            },
            {
              camp: "al_catelea_turn_apasare_pe_buton",
              vizibila: true,
              latime: 43,
              minimizata: false,
            },
            { camp: "quiz_id", vizibila: false, latime: 265, minimizata: false },
            { camp: "subquiz_id", vizibila: false, latime: 122, minimizata: false },
            { camp: "fact_id", vizibila: false, latime: 100, minimizata: false },
            {
              camp: "pozitie_buton_apasat_pt_raspuns",
              vizibila: false,
              latime: 248,
              minimizata: false,
            },
            {
              camp: "valori_variante_de_raspuns",
              vizibila: false,
              latime: 213,
              minimizata: false,
            },
            {
              camp: "valoare_raspuns_corect",
              vizibila: false,
              latime: 192,
              minimizata: false,
            },
            {
              camp: "hints_aratate_pt_raspuns",
              vizibila: false,
              latime: 201,
              minimizata: false,
            },
            { camp: "extra", vizibila: false, latime: 92, minimizata: false },
          ],
          filtre: [
            {
              tip: "antet",
              camp: "al_catelea_turn_apasare_pe_buton",
              valoare: "1",
            },
          ],
          sortari: [
            { camp: "data_ora_ro", directie: "desc" },
            { camp: "eq_form", directie: "asc" },
            { camp: "fact", directie: "asc" },
          ],
        },
      ],
    },
  ];

  function valideazaTabel(tabel) {
    if (!tabel || typeof tabel.getColumns !== "function") {
      throw new Error("Presetul are nevoie de un tabel Tabulator valid.");
    }
  }

  function numarPozitiv(valoare, valoareImplicita) {
    const numar = Number(valoare);
    return Number.isFinite(numar) && numar > 0 ? Math.round(numar) : valoareImplicita;
  }

  function valoareSerializabila(valoare) {
    if (valoare === undefined || typeof valoare === "function") return false;
    try {
      JSON.stringify(valoare);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function normalizeazaColoana(coloana) {
    const camp = String(coloana?.camp ?? "").trim();
    if (!camp) return null;
    return {
      camp,
      vizibila: coloana.vizibila !== false,
      latime: numarPozitiv(coloana.latime, 120),
      minimizata: coloana.minimizata === true,
    };
  }

  function normalizeazaFiltru(filtru) {
    if (filtru?.tip === "primul_factor_in") {
      const valori = [...new Set((filtru.valori || []).map(Number).filter(Number.isFinite))];
      if (!valori.length) return null;
      return {
        tip: "primul_factor_in",
        camp: String(filtru.camp || "fact"),
        valori,
      };
    }

    const tip = filtru?.tip === "antet" ? "antet" : "camp";
    const camp = String(filtru?.camp ?? "").trim();
    if (!camp || !valoareSerializabila(filtru.valoare)) return null;
    if (tip === "antet") return { tip, camp, valoare: filtru.valoare };
    return {
      tip,
      camp,
      operator: String(filtru.operator || "="),
      valoare: filtru.valoare,
    };
  }

  function normalizeazaSortare(sortare) {
    const camp = String(sortare?.camp ?? "").trim();
    if (!camp) return null;
    return {
      camp,
      directie: sortare.directie === "desc" ? "desc" : "asc",
    };
  }

  function normalizeazaPreset(preset) {
    if (!preset || typeof preset !== "object") {
      throw new Error("Presetul trebuie sa fie un obiect cu date.");
    }
    return {
      versiune: VERSIUNE_PRESET,
      nume: String(preset.nume || "Preset nou").trim() || "Preset nou",
      coloane: (preset.coloane || []).map(normalizeazaColoana).filter(Boolean),
      filtre: (preset.filtre || []).map(normalizeazaFiltru).filter(Boolean),
      sortari: (preset.sortari || []).map(normalizeazaSortare).filter(Boolean),
    };
  }

  function obtineColoane(tabel) {
    return tabel
      .getColumns()
      .filter((coloana) => typeof coloana?.getField === "function" && coloana.getField());
  }

  function citestePresetCurent({ tabel, nume, latimiColoaneMinimizate = new Map() }) {
    valideazaTabel(tabel);
    const coloane = obtineColoane(tabel).map((coloana) => {
      const camp = coloana.getField();
      const minimizata = latimiColoaneMinimizate.has(camp);
      return {
        camp,
        vizibila: coloana.isVisible?.() !== false,
        latime: numarPozitiv(
          minimizata ? latimiColoaneMinimizate.get(camp) : coloana.getWidth?.(),
          120
        ),
        minimizata,
      };
    });

    const filtreAntet = (tabel.getHeaderFilters?.() || [])
      .filter((filtru) => valoareSerializabila(filtru.value))
      .map((filtru) => ({ tip: "antet", camp: filtru.field, valoare: filtru.value }));
    const filtreTabel = (tabel.getFilters?.() || [])
      .filter(
        (filtru) =>
          !Array.isArray(filtru) &&
          typeof filtru?.field === "string" &&
          typeof filtru?.type === "string" &&
          valoareSerializabila(filtru.value)
      )
      .map((filtru) => ({
        tip: "camp",
        camp: filtru.field,
        operator: filtru.type,
        valoare: filtru.value,
      }));
    const sortari = (tabel.getSorters?.() || [])
      .filter((sortare) => typeof sortare?.field === "string")
      .map((sortare) => ({
        camp: sortare.field,
        directie: sortare.dir === "desc" ? "desc" : "asc",
      }));

    return normalizeazaPreset({
      nume,
      coloane,
      filtre: [...filtreAntet, ...filtreTabel],
      sortari,
    });
  }

  function primulFactor(valoare) {
    const potrivire = String(valoare ?? "").match(
      /^\s*(-?\d+(?:[.,]\d+)?)\s*[*xX\u00d7]/
    );
    if (!potrivire) return null;
    const factor = Number(potrivire[1].replace(",", "."));
    return Number.isFinite(factor) ? factor : null;
  }

  function aplicaFiltre(tabel, filtre, campuriDisponibile) {
    tabel.clearFilter?.(true);
    const filtreTabel = [];

    filtre.forEach((filtru) => {
      if (!campuriDisponibile.has(filtru.camp)) return;
      if (filtru.tip === "antet") {
        tabel.setHeaderFilterValue?.(filtru.camp, filtru.valoare);
        return;
      }
      if (filtru.tip === "primul_factor_in") {
        const factori = new Set(filtru.valori);
        filtreTabel.push((inregistrare) => factori.has(primulFactor(inregistrare[filtru.camp])));
        return;
      }
      filtreTabel.push({
        field: filtru.camp,
        type: filtru.operator,
        value: filtru.valoare,
      });
    });

    if (filtreTabel.length) tabel.setFilter?.(filtreTabel);
  }

  function aplicaSortari(tabel, sortari, campuriDisponibile) {
    const sortariValide = sortari
      .filter((sortare) => campuriDisponibile.has(sortare.camp))
      .map((sortare) => ({ column: sortare.camp, dir: sortare.directie }));
    if (sortariValide.length) tabel.setSort?.(sortariValide);
    else tabel.clearSort?.();
  }

  function aplicaPreset({
    tabel,
    preset,
    latimiColoaneMinimizate = new Map(),
    latimeColoanaMinimizata = 36,
    dupaAplicareColoane,
  }) {
    valideazaTabel(tabel);
    const presetNormalizat = normalizeazaPreset(preset);
    const coloaneCurente = obtineColoane(tabel);
    const coloaneDupaCamp = new Map(
      coloaneCurente.map((coloana) => [coloana.getField(), coloana])
    );
    const campuriDisponibile = new Set(coloaneDupaCamp.keys());
    const campuriDinPreset = new Set();

    const layoutPreset = presetNormalizat.coloane
      .filter((coloana) => campuriDisponibile.has(coloana.camp))
      .map((coloana) => {
        campuriDinPreset.add(coloana.camp);
        return {
          field: coloana.camp,
          visible: coloana.vizibila,
          width: coloana.minimizata ? latimeColoanaMinimizata : coloana.latime,
        };
      });
    const layoutColoaneNoi = coloaneCurente
      .filter((coloana) => !campuriDinPreset.has(coloana.getField()))
      .map((coloana) => {
        const camp = coloana.getField();
        return {
          field: camp,
          visible: coloana.isVisible?.() !== false,
          width: numarPozitiv(
            latimiColoaneMinimizate.get(camp) ?? coloana.getWidth?.(),
            120
          ),
        };
      });

    latimiColoaneMinimizate.clear();
    presetNormalizat.coloane.forEach((coloana) => {
      if (coloana.minimizata && campuriDisponibile.has(coloana.camp)) {
        latimiColoaneMinimizate.set(coloana.camp, coloana.latime);
      }
    });

    tabel.setColumnLayout?.([...layoutPreset, ...layoutColoaneNoi]);
    dupaAplicareColoane?.(presetNormalizat);
    aplicaFiltre(tabel, presetNormalizat.filtre, campuriDisponibile);
    aplicaSortari(tabel, presetNormalizat.sortari, campuriDisponibile);
    return presetNormalizat;
  }

  function creeazaButon(text) {
    const buton = document.createElement("button");
    buton.type = "button";
    buton.textContent = text;
    return buton;
  }

  function afiseazaCopiereManuala({ zonaText, mesaj, text }) {
    zonaText.hidden = false;
    zonaText.value = text;
    zonaText.focus?.();
    zonaText.select?.();
    mesaj.textContent = "Clipboard indisponibil. Copiaza textul selectat.";
  }

  function randeazaPreseturi({
    element,
    grupe = GRUPE_PRESETURI,
    laAplicarePreset,
    laCitirePreset,
  }) {
    if (!element || typeof element.replaceChildren !== "function") {
      throw new Error("Rendererul presetelor are nevoie de un element valid.");
    }

    const titlu = document.createElement("p");
    titlu.className = "vizualizare-logs-preseturi-titlu";
    titlu.textContent = "Preseturi";
    const ajutorSortare = document.createElement("p");
    ajutorSortare.className = "vizualizare-logs-sortare-ajutor";
    ajutorSortare.textContent =
      "Click = sortare simpla. Shift + click = adauga sortarea la cele existente.";
    const continut = document.createElement("div");
    continut.className = "vizualizare-logs-preseturi-grupe";

    grupe.forEach((grupa) => {
      const sectiune = document.createElement("section");
      sectiune.className = "vizualizare-logs-preseturi-grupa";
      const numeGrupa = document.createElement("h3");
      numeGrupa.textContent = String(grupa.nume || "Preseturi");
      sectiune.appendChild(numeGrupa);
      (grupa.preseturi || []).forEach((preset) => {
        const buton = creeazaButon(String(preset.nume || "Preset"));
        buton.addEventListener("click", async () => {
          try {
            await laAplicarePreset?.(preset);
            mesaj.textContent = `Preset aplicat: ${preset.nume || "Preset"}`;
          } catch (error) {
            mesaj.textContent = "Presetul nu a putut fi aplicat.";
            global.console?.error?.("[VizualizareLogsPreseturi] Aplicare esuata.", error);
          }
        });
        sectiune.appendChild(buton);
      });
      continut.appendChild(sectiune);
    });

    if (!grupe.length) {
      const gol = document.createElement("p");
      gol.className = "vizualizare-logs-preseturi-gol";
      gol.textContent = "Niciun preset hardcodat.";
      continut.appendChild(gol);
    }

    const etichetaNume = document.createElement("label");
    etichetaNume.className = "vizualizare-logs-preseturi-nume";
    const textNume = document.createElement("span");
    textNume.textContent = "Nume preset";
    const campNume = document.createElement("input");
    campNume.type = "text";
    campNume.placeholder = "Numele presetului";
    campNume.value = "Preset nou";
    etichetaNume.append(textNume, campNume);

    const salveaza = creeazaButon("Save current view as preset");
    salveaza.className = "vizualizare-logs-salveaza-preset";
    const mesaj = document.createElement("p");
    mesaj.className = "vizualizare-logs-preseturi-mesaj";
    const zonaText = document.createElement("textarea");
    zonaText.className = "vizualizare-logs-preseturi-copiere-manuala";
    zonaText.readOnly = true;
    zonaText.hidden = true;

    salveaza.addEventListener("click", async () => {
      const nume = String(campNume.value || "Preset nou").trim() || "Preset nou";
      try {
        const preset = await laCitirePreset?.(nume);
        const text = JSON.stringify(preset, null, 2);
        try {
          if (typeof global.navigator?.clipboard?.writeText !== "function") {
            throw new Error("Clipboard indisponibil.");
          }
          await global.navigator.clipboard.writeText(text);
          zonaText.hidden = true;
          zonaText.value = "";
          mesaj.textContent = "Preset copiat in clipboard.";
        } catch (_error) {
          afiseazaCopiereManuala({ zonaText, mesaj, text });
        }
      } catch (error) {
        mesaj.textContent = "Starea curenta nu a putut fi citita.";
        global.console?.error?.("[VizualizareLogsPreseturi] Citire esuata.", error);
      }
    });

    element.replaceChildren(
      titlu,
      ajutorSortare,
      continut,
      etichetaNume,
      salveaza,
      mesaj,
      zonaText
    );
  }

  global.VizualizareLogsPreseturi = Object.freeze({
    grupe: GRUPE_PRESETURI,
    aplicaPreset,
    citestePresetCurent,
    randeazaPreseturi,
  });
})(window);
