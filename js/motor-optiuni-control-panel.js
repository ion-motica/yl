// MOTOR OPTIUNI CONTROL PANEL — cerere user, 03.09.2026: "standardizam
// optiunile din CP ca sa poata fi citite automat, nu sa trebuiasca sa vina
// nenea claude la fiecare quiz si sa faca analiza cuantica". Inainte de acest
// fisier, fiecare quiz cu panou CP scria propriul cod DOM (addBifa/addStepper/
// appendSelectField duplicate identic in mai multe fisiere — vezi rigle-cl1.js
// vs rigle-tabla-1-10.js) SI, daca voia link de partajare, propriile
// getSharedConfig/applySharedConfig scrise manual, camp cu camp. Coeziune
// slaba clasica (documente de referinta/razgandire-ieftina.md): "daca ma
// razgandesc la o optiune noua, in cate locuri trebuie sa scriu?" — raspunsul
// era "cel putin 3". Cu acest motor, un quiz DECLARA optiunile ca date (un
// tabel de "campuri"), nu ca cod imperativ — vezi regula 3 din documentul de
// mai sus ("tabele in loc de if-uri").
//
// Un "camp" e un obiect simplu:
//   {
//     cheie: "mutareColoane",       // identificator unic — devine cheia in
//                                   // linkul de partajare (?cfg=...)
//     tip: "bifa" | "enum" | "numar" | "set" | "culoare",
//     eticheta: "Mutare coloane:",  // text afisat langa control
//     grup: "Mutare coloane",       // (optional) titlu de sectiune — campurile
//                                   // consecutive cu acelasi grup se aduna
//                                   // sub un singur titlu
//     get: () => valoareCurenta,
//     set: (valoare) => {...},      // aplica + valideaza/clampeaza intern
//                                   // (asa cum fac deja scrie*() din quizuri)
//
//     // specifice tipului "enum":
//     optiuni: [{ valoare, text }, ...],
//     stilAfisare: "select" | "radio",   // implicit "select"
//
//     // specifice tipului "numar":
//     min, max,
//     pas: 1,             // implicit 1
//     zecimale: 0,        // implicit 0 (rotunjire la afisare/validare)
//     stilAfisare: "stepper" | "slider", // implicit "stepper"
//     formateazaAfisare: (valoare) => text,  // (optional, doar slider) text
//                          // custom in loc de cifra bruta — ex. "de 3x mai incet"
//
//     // specific tipului "set" (mai multe valori bifate simultan):
//     optiuni: [{ valoare, text }, ...],
//     minSelectate: 1,    // implicit 1 — sub acest numar, ultima debifare e refuzata
//
//     implicit: <valoare>,  // (optional) folosit de aplicaConfig() cand
//                           // input-ul din link e invalid — daca lipseste,
//                           // cade pe get() (nu schimba nimic)
//     inDOM: true,          // (optional) false = nu apare in panoul CP
//                           // (ex: nivelul, care are propriul UI in bara de
//                           // niveluri) — dar tot participa la citesteConfig/
//                           // aplicaConfig, deci si la linkul de partajare
//     activCand: (valoriCurente) => boolean,  // (optional) vizibil doar cand
//                                              // alt camp are o anume valoare
//     dupaSchimbare: () => {},  // (optional) efect secundar suplimentar dupa
//                               // set() — ex: re-randare live a unei ilustratii
//   }
//
// construiesteDOM deseneaza panoul din tabel; citesteConfig/aplicaConfig
// genereaza automat getSharedConfig/applySharedConfig — un quiz care
// declara campurile corect capata linkul de partajare GRATIS, fara sa mai
// scrie validare manuala. Vezi documente de referinta/standard-optiuni-cp.md.
(function (global) {
  "use strict";

  const TIPURI_VALIDE = new Set(["bifa", "enum", "numar", "set", "culoare"]);
  const REGEX_CULOARE_HEX = /^#[0-9a-fA-F]{6}$/;

  function rotunjesteLaZecimale(valoare, zecimale) {
    const factor = 10 ** zecimale;
    return Math.round(valoare * factor) / factor;
  }

  // Camp standard, generat automat — un quiz il pune la inceputul propriei
  // liste de campuri ca nivelul de pornire sa intre in linkul de partajare,
  // fara sa-l redeclare manual. `inDOM: false`: nivelul are deja propriul UI
  // (bara de butoane de nivel, in afara panoului CP), deci NU se deseneaza a
  // doua oara aici.
  function campNivelStandard(quizApi, nivelImplicit) {
    const camp = {
      cheie: "nivel",
      tip: "numar",
      eticheta: "Nivel",
      get: () => quizApi.getLevel(),
      set: (valoare) => quizApi.switchLevel(valoare),
      min: quizApi.getMinLevel(),
      max: quizApi.getMaxLevel(),
      pas: 1,
      zecimale: 0,
      inDOM: false,
    };
    if (nivelImplicit != null) camp.implicit = nivelImplicit;
    return camp;
  }

  function citesteConfig(campuri) {
    const rezultat = {};
    for (const camp of campuri) {
      rezultat[camp.cheie] = camp.get();
    }
    return rezultat;
  }

  // Valideaza+clampeaza O valoare venita din shared (netrusted) dupa
  // metadata campului. Cade pe camp.implicit daca exista, altfel pe get()
  // (input invalid = nu schimba nimic), niciodata pe valoarea bruta primita.
  function valoareValidataPentruCamp(camp, valoareCeruta) {
    const fallback = "implicit" in camp ? camp.implicit : camp.get();

    if (camp.tip === "bifa") {
      return Boolean(valoareCeruta);
    }

    if (camp.tip === "culoare") {
      return typeof valoareCeruta === "string" && REGEX_CULOARE_HEX.test(valoareCeruta)
        ? valoareCeruta
        : fallback;
    }

    if (camp.tip === "enum") {
      const valoriValide = camp.optiuni.map((o) => o.valoare);
      return valoriValide.includes(valoareCeruta) ? valoareCeruta : fallback;
    }

    if (camp.tip === "numar") {
      const numar = Number(valoareCeruta);
      if (!Number.isFinite(numar)) return fallback;
      const clampat = Math.min(camp.max, Math.max(camp.min, numar));
      return rotunjesteLaZecimale(clampat, camp.zecimale ?? 0);
    }

    if (camp.tip === "set") {
      if (!Array.isArray(valoareCeruta)) return fallback;
      const valoriValide = new Set(camp.optiuni.map((o) => o.valoare));
      const filtrate = valoareCeruta.filter((v) => valoriValide.has(v));
      const minim = camp.minSelectate ?? 1;
      return filtrate.length >= minim ? filtrate : fallback;
    }

    return fallback;
  }

  // Aplica shared (obiect netrusted, de regula decodat dintr-un URL) peste
  // campuri. Fiecare cheie prezenta in shared e validata INDIVIDUAL, dupa
  // tipul campului — niciodata asignare bruta. O cheie absenta sau un camp
  // necunoscut in shared e pur si simplu ignorat (nu e o eroare).
  function aplicaConfig(campuri, shared = {}) {
    if (!shared || typeof shared !== "object" || Array.isArray(shared)) return false;

    for (const camp of campuri) {
      if (!(camp.cheie in shared)) continue;
      const valoareValidata = valoareValidataPentruCamp(camp, shared[camp.cheie]);
      camp.set(valoareValidata);
    }
    return true;
  }

  function adaugaTitluGrup(mount, text) {
    const titlu = document.createElement("p");
    titlu.className = "control-panel-lift-title";
    titlu.textContent = text;
    mount.appendChild(titlu);
  }

  function construiesteBifa(mount, camp, onSchimbare) {
    const rand = document.createElement("label");
    rand.className = "control-panel-lift-row";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(camp.get());
    input.addEventListener("change", () => onSchimbare(input.checked));
    const span = document.createElement("span");
    span.textContent = camp.eticheta;
    rand.append(input, span);
    mount.appendChild(rand);
  }

  function construiesteCuloare(mount, camp, onSchimbare) {
    const field = document.createElement("div");
    field.className = "control-panel-lift-field control-panel-lift-field-inline";
    const label = document.createElement("label");
    label.textContent = camp.eticheta;
    const input = document.createElement("input");
    input.type = "color";
    input.value = camp.get();
    input.addEventListener("input", () => onSchimbare(input.value));
    field.append(label, input);
    mount.appendChild(field);
  }

  function construiesteEnumSelect(mount, camp, onSchimbare) {
    const field = document.createElement("div");
    field.className = "control-panel-lift-field control-panel-lift-field-inline";
    const label = document.createElement("label");
    label.textContent = camp.eticheta;
    const select = document.createElement("select");
    camp.optiuni.forEach(({ valoare, text }) => {
      const optiune = document.createElement("option");
      optiune.value = valoare;
      optiune.textContent = text;
      select.appendChild(optiune);
    });
    select.value = camp.get();
    select.addEventListener("change", () => onSchimbare(select.value));
    field.append(label, select);
    mount.appendChild(field);
  }

  function construiesteEnumRadio(mount, camp, onSchimbare) {
    if (camp.eticheta) {
      const eticheta = document.createElement("p");
      eticheta.className = "control-panel-lift-field";
      eticheta.textContent = camp.eticheta;
      mount.appendChild(eticheta);
    }
    const numeGrup = `cp-radio-${camp.cheie}`;
    const valoareCurenta = camp.get();
    camp.optiuni.forEach(({ valoare, text }) => {
      const rand = document.createElement("label");
      rand.className = "control-panel-lift-row";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = numeGrup;
      input.checked = valoare === valoareCurenta;
      input.addEventListener("change", () => onSchimbare(valoare));
      const span = document.createElement("span");
      span.textContent = text;
      rand.append(input, span);
      mount.appendChild(rand);
    });
  }

  function construiesteNumarStepper(mount, camp, onSchimbare) {
    const zecimale = camp.zecimale ?? 0;
    const pas = camp.pas ?? 1;
    const formateaza = (v) => rotunjesteLaZecimale(v, zecimale).toFixed(zecimale);

    const field = document.createElement("div");
    field.className = "control-panel-lift-field pre-eq-stepper-field";
    const label = document.createElement("label");
    label.textContent = camp.eticheta;
    const controls = document.createElement("div");
    controls.className = "pre-eq-stepper";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "-";
    const input = document.createElement("input");
    input.type = "number";
    input.min = String(camp.min);
    input.max = String(camp.max);
    input.step = String(pas);
    input.value = formateaza(camp.get());
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "+";

    const aplica = (valoare) => {
      onSchimbare(valoare);
      input.value = formateaza(camp.get());
    };

    minus.addEventListener("click", () => aplica(Number(input.value) - pas));
    plus.addEventListener("click", () => aplica(Number(input.value) + pas));
    input.addEventListener("change", () => aplica(Number(input.value)));

    controls.append(minus, input, plus);
    field.append(label, controls);
    mount.appendChild(field);
  }

  function construiesteNumarSlider(mount, camp, onSchimbare) {
    const formateaza = camp.formateazaAfisare ?? String;
    const field = document.createElement("div");
    field.className = "control-panel-lift-field control-panel-lift-slider-field";
    const head = document.createElement("div");
    head.className = "control-panel-lift-slider-head";
    const label = document.createElement("label");
    label.textContent = camp.eticheta;
    const out = document.createElement("span");
    out.className = "control-panel-lift-slider-out";
    out.textContent = formateaza(camp.get());
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(camp.min);
    slider.max = String(camp.max);
    slider.step = String(camp.pas ?? 1);
    slider.value = String(camp.get());
    slider.addEventListener("input", () => {
      onSchimbare(Number(slider.value));
      out.textContent = formateaza(camp.get());
    });
    head.append(label, out);
    field.append(head, slider);
    mount.appendChild(field);
  }

  function construiesteSet(mount, camp, onSchimbare) {
    const field = document.createElement("div");
    field.className = "control-panel-lift-field";
    const label = document.createElement("span");
    label.textContent = camp.eticheta;
    field.appendChild(label);
    const minim = camp.minSelectate ?? 1;
    const inputuri = new Map();

    const sincronizeaza = () => {
      const selectate = [...inputuri.entries()].filter(([, el]) => el.checked).map(([v]) => v);
      if (selectate.length < minim) {
        // refuza sa scada sub minim — reface bifa care tocmai a fost debifata
        const valoareCurenta = camp.get();
        inputuri.forEach((el, valoare) => {
          el.checked = valoareCurenta.includes(valoare);
        });
        return;
      }
      onSchimbare(selectate);
    };

    camp.optiuni.forEach(({ valoare, text }) => {
      const rand = document.createElement("label");
      rand.className = "control-panel-lift-row";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = camp.get().includes(valoare);
      input.addEventListener("change", sincronizeaza);
      inputuri.set(valoare, input);
      const span = document.createElement("span");
      span.textContent = text;
      rand.append(input, span);
      field.appendChild(rand);
    });
    mount.appendChild(field);
  }

  // Doar camp.dupaSchimbare — NU un onChange automat: in codebase-ul
  // existent, o schimbare "pur vizuala" (padding, marime font) NU declanseaza
  // restart de nivel, dar o schimbare de continut (mod mutare coloane,
  // adunareActiva) DA. Motorul nu poate ghici care e care — quizul o spune
  // explicit, per camp, prin dupaSchimbare (ex: `() => opts.onChange?.()`,
  // capturat din closure-ul quizului, nu primit de motor).
  function construiesteCamp(mount, camp) {
    const onSchimbare = (valoareBruta) => {
      camp.set(valoareBruta);
      camp.dupaSchimbare?.();
    };

    if (camp.tip === "bifa") return construiesteBifa(mount, camp, onSchimbare);
    if (camp.tip === "culoare") return construiesteCuloare(mount, camp, onSchimbare);
    if (camp.tip === "enum") {
      return camp.stilAfisare === "radio"
        ? construiesteEnumRadio(mount, camp, onSchimbare)
        : construiesteEnumSelect(mount, camp, onSchimbare);
    }
    if (camp.tip === "numar") {
      return camp.stilAfisare === "slider"
        ? construiesteNumarSlider(mount, camp, onSchimbare)
        : construiesteNumarStepper(mount, camp, onSchimbare);
    }
    if (camp.tip === "set") return construiesteSet(mount, camp, onSchimbare);

    throw new Error(`MotorOptiuniControlPanel: tip de camp necunoscut "${camp.tip}" (cheie "${camp.cheie}")`);
  }

  // Deseneaza panoul din tabelul de campuri. Re-randare completa (nu update
  // partial) — "UI = f(state)", punctul 12 din razgandire-ieftina.md: cand un
  // camp cu activCand depinde de altul, apelantul re-cheama aceasta functie
  // din propriul dupaSchimbare, si vizibilitatea se recalculeaza de la zero.
  function construiesteDOM(mount, campuri) {
    if (!mount) return;
    mount.replaceChildren();

    const valoriCurente = citesteConfig(campuri);
    let grupAfisat = null;

    for (const camp of campuri) {
      if (!TIPURI_VALIDE.has(camp.tip)) {
        throw new Error(`MotorOptiuniControlPanel: tip de camp necunoscut "${camp.tip}" (cheie "${camp.cheie}")`);
      }
      if (camp.inDOM === false) continue;
      if (camp.activCand && !camp.activCand(valoriCurente)) continue;

      if (camp.grup && camp.grup !== grupAfisat) {
        adaugaTitluGrup(mount, camp.grup);
        grupAfisat = camp.grup;
      }

      construiesteCamp(mount, camp);
    }
  }

  // Registru central CP (cerere user, 04.09.2026): fiecare quiz raportează
  // O SINGURĂ DATĂ, prin `quiz.controlPanel.sectiuni`, structura lui
  // declarativă — motorul o păstrează aici, indexată după quizId, ca orice
  // feature central (share-link azi, altele posibil mâine) să citească de
  // aici, fără să mai ceară nimic direct quizului (fără getSharedLink()/
  // getCampuriCP() per quiz — vezi documente de referinta/razgandire-ieftina.md,
  // "date în loc de apeluri"). Instanța de quiz se recreează la fiecare
  // activare (QuizRegistry.createActive()), deci reînregistrarea trebuie să
  // se întâmple la fiecare activare — set() suprascrie, intenționat, orice
  // intrare anterioară pentru același quizId.
  const registruControlPanel = new Map();

  function inregistreazaControlPanel(quizId, controlPanel) {
    if (!quizId) return;
    registruControlPanel.set(quizId, Array.isArray(controlPanel?.sectiuni) ? controlPanel.sectiuni : []);
  }

  function obtineSectiuniCP(quizId) {
    return registruControlPanel.get(quizId) ?? [];
  }

  // Aplatizează secțiunile unui quiz intr-un singur array de câmpuri, pt.
  // citesteConfig/aplicaConfig (care nu știu de concептul de „secțiune").
  // O cheie identică in doua secțiuni diferite ale ACELUIAȘI quiz e o
  // greșeală de configurare, nu o stare validă — nu cădem tăcut pe
  // "ultimul câștigă" (razgandire-ieftina.md, punctul 9, fail fast).
  function toateCampurileCP(quizId) {
    const rezultat = [];
    const sectiuneDupaCheie = new Map();
    for (const sectiune of obtineSectiuniCP(quizId)) {
      for (const camp of sectiune.campuri ?? []) {
        const sectiuneAnterioara = sectiuneDupaCheie.get(camp.cheie);
        if (sectiuneAnterioara && sectiuneAnterioara !== sectiune.id) {
          throw new Error(
            `MotorOptiuniControlPanel: cheia "${camp.cheie}" apare in doua sectiuni CP diferite ` +
              `("${sectiuneAnterioara}" si "${sectiune.id}") ale quizului "${quizId}" — ` +
              `redenumeste una din ele, nu le lasa sa coincida.`
          );
        }
        sectiuneDupaCheie.set(camp.cheie, sectiune.id);
        rezultat.push(camp);
      }
    }
    return rezultat;
  }

  global.MotorOptiuniControlPanel = {
    campNivelStandard,
    citesteConfig,
    aplicaConfig,
    construiesteDOM,
    inregistreazaControlPanel,
    obtineSectiuniCP,
    toateCampurileCP,
  };
})(window);
