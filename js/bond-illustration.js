(function (global) {
  "use strict";

  // Fabrica pt. setari reglabile din CP, persistate prin LayoutConfig —
  // tiparul comun la toate setarile live ale ilustratiei (durata tranzitiei,
  // diametrul discului, ...): citire LENESA, nu la incarcarea modulului. In
  // index.html js/layout-config.js se incarca DUPA bond-illustration.js,
  // deci la momentul in care ruleaza acest fisier, global.LayoutConfig inca
  // nu exista — o citire directa aici ar cadea mereu pe implicit si ar
  // ignora tacut valoarea salvata. Valoarea ramane `null` pana la prima
  // citire REALA (prin `.get()`), moment la care LayoutConfig e deja
  // incarcat. `valideaza` (optional) filtreaza/corecteaza valori invalide
  // atat la citire cat si la scriere (ex. nu se persista un NaN).
  function creeazaSetareReglabila(cheie, implicit, valideaza = (v) => v) {
    let valoare = null;
    return {
      get() {
        if (valoare == null) {
          const citita = global.LayoutConfig && global.LayoutConfig.get(cheie, implicit);
          valoare = valideaza(citita) ?? implicit;
        }
        return valoare;
      },
      set(nou) {
        valoare = valideaza(nou) ?? implicit;
        if (global.LayoutConfig) global.LayoutConfig.set(cheie, valoare);
      },
    };
  }

  function numarPozitivSauNimic(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // Durata comuna a celor 3 miscari simultane (deplasarea divului, zborul
  // grupului de discuri, redimensionarea cosurilor). Reglabila live din CP
  // (cerere user, 31.08.2026: "Viteza reasezare mere" — panoul CP al
  // quizului pilot, pas 0.1s).
  const setareDurataTranzitie = creeazaSetareReglabila(
    "ilustrareBonduriDurataTranzitieMs",
    3000,
    numarPozitivSauNimic
  );
  function getDurataTranzitieMs() {
    return setareDurataTranzitie.get();
  }
  function setDurataTranzitieMs(ms) {
    setareDurataTranzitie.set(ms);
  }

  // Diametrul discului, ca procent din inaltimea reala masurata a unui numar
  // colorat (100% = neschimbat) — reglabil live din CP (cerere user,
  // 31.08.2026: "Diametru disc -[100%]+ din font").
  const setareDiametruDiscPct = creeazaSetareReglabila(
    "ilustrareBonduriDiametruDiscPct",
    100,
    numarPozitivSauNimic
  );
  function getDiametruDiscPct() {
    return setareDiametruDiscPct.get();
  }
  function setDiametruDiscPct(pct) {
    setareDiametruDiscPct.set(pct);
  }

  // Procentul-tinta din latimea containerului pe care trebuie sa-l ocupe cel
  // mai lat rand ("{nivel}=9+9" + ilustratie) — reglabil live din CP (cerere
  // user, 31.08.2026: "randul ocupa -[80%]+ din latimea divului — regleaza
  // fontul si diametrul discului"). Spre deosebire de celelalte setari, asta
  // nu seteaza direct o dimensiune — pregatesteNivel CAUTA (numeric, 2 pasi)
  // o scara de font care sa duca latimea masurata la exact acest procent;
  // vezi fontRandScala/aplicaScaraFont mai jos.
  const setareRandTargetLatimePct = creeazaSetareReglabila(
    "ilustrareBonduriRandTargetLatimePct",
    80,
    numarPozitivSauNimic
  );
  function getRandTargetLatimePct() {
    return setareRandTargetLatimePct.get();
  }
  function setRandTargetLatimePct(pct) {
    setareRandTargetLatimePct.set(pct);
  }

  // Scara curenta de font a randurilor — proprietate CSS globala (pe :root),
  // citita de .inventar-bonduri-semn/.inventar-bonduri-numar (vezi
  // style.css). Globala, deliberat: aceleasi clase sunt folosite si de
  // randul viu din tabel si de proba ascunsa de masurare (masoaraRand) — o
  // singura sursa de adevar, niciun risc sa ajunga desincronizate.
  const PROP_CSS_SCARA_FONT = "--ilustrare-font-scala";
  function aplicaScaraFont(scala) {
    document.documentElement.style.setProperty(PROP_CSS_SCARA_FONT, String(scala));
  }

  // Padding-ul cosului (in rem, pe toate 4 laturile), reglabil live din CP
  // (cerere user, 31.08.2026: "Padding cos -[]+" — vrea sa poata potrivi
  // vizual cosurile cu badge-urile de cifre). Aplicat inline pe fiecare cos,
  // vezi umpleCos.
  const setarePaddingCosRem = creeazaSetareReglabila("ilustrareBonduriPaddingCosRem", 0.05, (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  });
  function getPaddingCosRem() {
    return setarePaddingCosRem.get();
  }
  function setPaddingCosRem(rem) {
    setarePaddingCosRem.set(rem);
  }

  // Border-ul cosului (vezi .ilustrare-bonduri-cos in style.css) — 2px, pe
  // fiecare latura. Constanta separata de padding, ca sa ramana explicit de
  // ce cele doua se aduna la "chrome"-ul total (vezi chromeCosPx).
  const BORDER_COS_PX = 2;

  // Sub atat un disc nu se mai vede — plasa de siguranta pt. niveluri mari pe
  // ecrane inguste, nu o dimensiune normala de lucru.
  const DISC_MIN_PX = 6;

  // Padding (reglabil) + border (fix) ORIZONTAL ale unui cos, in px — nu mai
  // e o constanta, ca sa ramana corect cand userul schimba padding-ul din CP
  // (latimeCos trebuie sa reflecte exact cat spatiu ocupa chrome-ul REAL).
  function chromeCosPx() {
    const rootPx = parseFloat(global.getComputedStyle(document.documentElement).fontSize) || 16;
    return getPaddingCosRem() * rootPx * 2 + BORDER_COS_PX * 2;
  }

  // Cate discuri trebuie sa treaca dintr-un cos in celalalt intre doua bv-uri
  // ale ACELUIASI nivel (deci vechi.a+vechi.b === nou.a+nou.b). Functie pura.
  function mereDeMutat({ vechi, nou }) {
    if (!vechi) return null;
    const delta = nou.a - vechi.a;
    if (delta === 0) return { directie: null, count: 0 };
    return delta < 0
      ? { directie: "a-spre-b", count: -delta }
      : { directie: "b-spre-a", count: delta };
  }

  function latimeCos(valoare, dimensiuneDiscPx) {
    return Math.max(1, valoare) * dimensiuneDiscPx + chromeCosPx();
  }

  // Un disc = un cerc DESENAT (span rotunjit 50%, culoare de fundal), nu un
  // caracter de font -- cerere user (31.08.2026): bulina Unicode si apoi
  // Wingdings 0x98 ieseau amandoua extrem de mici/invizibile (acoperirea de
  // cerneala a unui glif e mult sub cutia lui, plus Wingdings nu e garantat
  // instalat pe orice sistem). Un cerc CSS umple cutia complet, deci iese
  // vizibil mare automat, la orice dimensiune si pe orice platforma, fara
  // nicio dependenta de font.
  // `ascuns` = disc care tocmai zboara spre locul asta: sta invizibil cat
  // dureaza zborul, ca sa nu apara de doua ori (si in cos, si in aer).
  function discHtml(dimensiunePx, ascuns) {
    return (
      `<span class="ilustrare-bonduri-disc${ascuns ? " e-in-zbor" : ""}" ` +
      `style="width:${dimensiunePx}px;height:${dimensiunePx}px"></span>`
    );
  }

  // Creeaza o instanta a ilustratiei — stare proprie (ultimul bv afisat, ca sa
  // stie daca urmatorul e "primul din nivel" sau o tranzitie; masurile
  // nivelului curent), separata de orice alta instanta.
  function creeaza() {
    let elDiv = null;
    let elEgal = null;
    let elCosA = null;
    let elCosB = null;
    let elSemn = null;
    let ultimulBv = null; // { a, b } — bv-ul afisat curent, sau null
    let nivelPregatit = null; // nivelul pt. care sunt valabile `masuri`
    let masuri = null; // vezi pregatesteNivel
    // Cand se termina (timestamp) zborul de discuri pornit cel mai recent —
    // 0 daca niciunul in curs. Foloseste `reseteaza()` ca sa nu elimine div-ul
    // ilustratiei cat timp inca zboara ceva spre el (vezi acolo).
    let zborInCursPanaLa = 0;

    function structuraExista() {
      return Boolean(elDiv && elDiv.isConnected && elCosA && elCosB);
    }

    function asigStructura(containerEl) {
      if (structuraExista()) return elDiv;
      if (elDiv) elDiv.remove();
      elDiv = document.createElement("div");
      elDiv.className = "ilustrare-bonduri";
      elDiv.setAttribute("aria-hidden", "true");
      // Ascunsa pana la prima pozitionare reala: intre creare si primul
      // `arataBv` e folosita si ca rigla (i se masoara latimea), iar atunci
      // sta inca la 0,0 — fara asta ar clipi acolo.
      elDiv.style.visibility = "hidden";

      // "=" dinaintea cosurilor — cerere user (31.08.2026): randul arata
      // "5=1+4=[m]+[mmmm]".
      elEgal = document.createElement("span");
      elEgal.className = "ilustrare-bonduri-egal";
      elEgal.textContent = "=";
      elCosA = document.createElement("div");
      elCosA.className = "ilustrare-bonduri-cos";
      elSemn = document.createElement("span");
      elSemn.className = "ilustrare-bonduri-semn";
      elSemn.textContent = "+";
      elCosB = document.createElement("div");
      elCosB.className = "ilustrare-bonduri-cos";

      elDiv.append(elEgal, elCosA, elSemn, elCosB);
      containerEl.appendChild(elDiv);
      return elDiv;
    }

    // `inaltimeCosPx`: inaltimea EXACTA a cosului (box-sizing:border-box —
    // include padding+border), luata din masurarea reala a unui
    // .inventar-bonduri-numar (vezi masoaraRand) — nu dedusa din font-size,
    // ca sa ramana corecta chiar si cand discurile s-au micsorat pt. incapere
    // pe ecran ingust (cerere user, 31.08.2026: "cosurile sunt mult mai
    // scunde decat numerele").
    function umpleCos(cosEl, valoare, culoare, dimensiuneDiscPx, inaltimeCosPx, indiciAscunsi) {
      cosEl.style.backgroundColor = culoare;
      cosEl.style.padding = `${getPaddingCosRem()}rem`;
      cosEl.style.width = `${latimeCos(valoare, dimensiuneDiscPx)}px`;
      if (inaltimeCosPx) cosEl.style.height = `${inaltimeCosPx}px`;
      cosEl.innerHTML = Array.from({ length: Math.max(0, valoare) }, (_, i) =>
        discHtml(dimensiuneDiscPx, Boolean(indiciAscunsi && indiciAscunsi.has(i)))
      ).join("");
    }

    // Plasa de siguranta daca masurarea reala (inaltimeNumarProba, mai jos)
    // esueaza dintr-un motiv oarecare — citeste macar font-size-ul cifrelor.
    function inaltimeFontRand(randEl) {
      const semnEl = randEl.querySelector(".inventar-bonduri-semn");
      const fontSize = semnEl ? global.getComputedStyle(semnEl).fontSize : null;
      const px = fontSize ? parseFloat(fontSize) : NaN;
      return Number.isFinite(px) && px > 0 ? px : 16;
    }

    // Dimensiunea de PORNIRE a unui disc = inaltimea REALA a unui numar
    // colorat ("9"), masurata pe o proba minimala — nu randul viu (la
    // momentul apelului poate inca arata "nivel=", fara niciun numar colorat
    // in el, daca e primul bv rezolvat din nivel — vezi capcana din
    // pozitieRand mai jos) si nu dedusa din font-size (cerere user,
    // 31.08.2026: "un disc MARE de inaltimea randului" — merele ieseau
    // ingrozitor de mici cu vechea baza de calcul, in special dupa
    // micsorarea pt. incapere pe ecran ingust). Shrink-to-fit-ul de mai jos
    // ramane neschimbat, doar baza de pornire creste.
    function inaltimeNumarProba(randuriEl) {
      const proba = document.createElement("span");
      proba.className = "inventar-bonduri-numar";
      proba.style.cssText = "position:absolute; visibility:hidden; pointer-events:none; left:0; top:0;";
      proba.textContent = "9";
      randuriEl.appendChild(proba);
      const inaltime = proba.getBoundingClientRect().height;
      proba.remove();
      return inaltime || null;
    }

    // Randeaza ASCUNS randul cel mai lat posibil al nivelului — "{nivel}=9+9"
    // plus locul rezervat ilustratiei — si masoara cele doua lungimi de care
    // depinde tot layoutul (cerere user, 31.08.2026: "ls = length(5=3+2
    // [mmm]+[mm])"):
    //   ls                 = latimea totala a randului
    //   latimeTextPlusGap  = de la marginea randului pana unde INCEPE ilustratia
    // Se masoara pe o proba randata cu aceleasi clase, in acelasi container —
    // nu se ghiceste din constante si nu se citeste de pe randul viu (randul
    // viu inca arata continutul VECHI in momentul apelului, vezi pozitieRand).
    function masoaraRand({ nivel, latimeIlustratie, randuriEl }) {
      const proba = document.createElement("div");
      proba.className = "inventar-bonduri-rand";
      proba.style.cssText =
        "position:absolute; visibility:hidden; pointer-events:none; " +
        "left:0; top:0; width:max-content; white-space:nowrap;";
      proba.innerHTML =
        `<span class="inventar-bonduri-semn">${nivel}=</span>` +
        `<span class="inventar-bonduri-numar">9</span>` +
        `<span class="inventar-bonduri-semn">+</span>` +
        `<span class="inventar-bonduri-numar">9</span>` +
        `<span class="inventar-bonduri-loc-ilustratie" style="width:${latimeIlustratie}px"></span>`;
      randuriEl.appendChild(proba);
      const rProba = proba.getBoundingClientRect();
      const rLoc = proba.lastElementChild.getBoundingClientRect();
      // Inaltimea REALA a unui numar colorat ("9"), masurata, nu dedusa din
      // font-size — singurul mod sigur sa iasa identica cu banda cosurilor,
      // indiferent de line-height mostenit sau alte particularitati CSS
      // (cerere user, 31.08.2026: banda cosului = exact inaltimea benzii
      // cifrelor).
      const rNumar = proba.querySelector(".inventar-bonduri-numar")?.getBoundingClientRect();
      const rezultat = {
        ls: rProba.width,
        latimeTextPlusGap: rLoc.left - rProba.left,
        inaltimeNumar: rNumar?.height || 0,
      };
      proba.remove();
      return rezultat;
    }

    // Se face O SINGURA DATA per nivel: masurile sunt aceleasi pentru orice bv
    // al nivelului (totalul de discuri e mereu `nivel`, iar eticheta cifrelor
    // are latime fixa), deci nu depind de care bv tocmai s-a rezolvat.
    function pregatesteNivel({ nivel, randEl, containerEl, latimeCaseta }) {
      if (nivelPregatit === nivel && masuri) return masuri;
      const randuriEl = randEl.parentElement;
      if (!randuriEl) return null;

      asigStructura(containerEl);

      // Orice impartire a nivelului da aceeasi latime totala de ilustratie
      // (`nivel` discuri in total + chrome constant) — luam una oarecare.
      const a = Math.max(1, nivel - 1);
      const b = Math.max(1, nivel - a);
      // Fara inaltimeCosPx la masurare (inca nu se stie — vine din
      // masoaraRand, mai jos): nu conteaza, se masoara doar latimea, iar
      // afisarea reala (mai jos in arataBv) primeste inaltimea corecta.
      const masoaraIlustratia = (discPx) => {
        umpleCos(elCosA, a, "transparent", discPx, null);
        umpleCos(elCosB, b, "transparent", discPx, null);
        return elDiv.getBoundingClientRect().width;
      };

      // PASUL 1: cauta scara de font care duce randul la procentul-tinta —
      // cu discul FIXAT la 100% (nu la procentul real ales de user din CP).
      // Deliberat separat de PASUL 2 (mai jos): daca aici am folosi procentul
      // REAL al discului, orice schimbare a lui "Diametru disc" ar modifica
      // latimea masurata si ar forta auto-fit-ul sa recompenseze prin font —
      // exact bug-ul raportat de user (31.08.2026): "Diametru disc se
      // comporta aberant, pe masura ce il micsorez fontul devine mai mare".
      // Cu discul fixat la 100% in cautare, cele doua controale din CP nu se
      // mai lupta: schimbarea diametrului nu mai atinge deloc fontul.
      const masoaraLaScaraFixa100 = () => {
        const inaltimeNumarBaza = inaltimeNumarProba(randuriEl) || inaltimeFontRand(randEl);
        const discPx = Math.max(DISC_MIN_PX, Math.round(inaltimeNumarBaza));
        const latIlustratie = masoaraIlustratia(discPx);
        const mas = masoaraRand({ nivel, latimeIlustratie: latIlustratie, randuriEl });
        return { inaltimeNumarBaza, mas };
      };

      // Scara de font a randurilor (.inventar-bonduri-semn/-numar, vezi
      // style.css) — proprietate CSS GLOBALA, deci pornim explicit de la 1
      // de fiecare data (nu ramane ce a lasat nivelul anterior), apoi cautam
      // numeric (corectie liniara, 2 pasi) valoarea care duce latimea celui
      // mai lat rand la procentul-tinta din latimea disponibila (cerere
      // user, 31.08.2026: "randul ocupa -[80%]+ din latimea divului —
      // regleaza fontul si diametrul discului"). 2 pasi sunt suficienti in
      // practica: relatia nu e perfect liniara (chrome-ul fix al cosului nu
      // se scaleaza), dar eroarea reziduala e neglijabila vizual.
      aplicaScaraFont(1);
      let { inaltimeNumarBaza, mas: m } = masoaraLaScaraFixa100();

      const targetPct = getRandTargetLatimePct();
      let scala = 1;
      if (latimeCaseta > 0 && targetPct > 0 && m.ls > 0) {
        const tinta = (targetPct / 100) * latimeCaseta;
        for (let pas = 0; pas < 2; pas += 1) {
          const factor = tinta / m.ls;
          if (!Number.isFinite(factor) || factor <= 0) break;
          scala *= factor;
          aplicaScaraFont(scala);
          ({ inaltimeNumarBaza, mas: m } = masoaraLaScaraFixa100());
        }
      }

      // PASUL 2: ACUM se aplica procentul REAL din CP (Diametru disc) —
      // multiplicator independent peste rezultatul auto-fit-ului, care NU
      // se mai recalculeaza in bucla de mai sus.
      let dimensiuneDiscPx = Math.max(DISC_MIN_PX, Math.round((inaltimeNumarBaza * getDiametruDiscPct()) / 100));
      let latimeIlustratie = masoaraIlustratia(dimensiuneDiscPx);
      m = masoaraRand({ nivel, latimeIlustratie, randuriEl });

      // Plasa de siguranta ramasa din shrink-to-fit-ul vechi (cerere user,
      // 30.08.2026): daca randul TOT nu incape (ex. targetPct=0, dezactivat
      // din CP, sau caseta e extrem de ingusta), micsoreaza doar discul, ca
      // sa nu iasa niciodata peste marginea casetei.
      if (latimeCaseta > 0 && m.ls > latimeCaseta) {
        const chrome = latimeIlustratie - nivel * dimensiuneDiscPx;
        const disponibil = latimeCaseta - m.latimeTextPlusGap - chrome;
        dimensiuneDiscPx = Math.max(DISC_MIN_PX, Math.floor(disponibil / nivel));
        latimeIlustratie = masoaraIlustratia(dimensiuneDiscPx);
        m = masoaraRand({ nivel, latimeIlustratie, randuriEl });
      }

      // Latime fixa pe containerul randurilor: randurile se intind la ea, iar
      // continutul lor porneste din acelasi loc (flex-start), deci toate "5="
      // se aliniaza — si cele pline, si cele goale. Centrarea (latimeCaseta -
      // ls)/2 ceruta de user se face singura: containerul e centrat de
      // `.singapore-prompt` (align-items:center).
      randuriEl.style.width = `${m.ls}px`;
      randuriEl.style.setProperty("--ilustrare-latime", `${latimeIlustratie}px`);

      // Gap-ul si latimile semnelor: constante pe tot nivelul, dar citite din
      // CSS-ul real, nu din constante duplicate aici. Servesc la calculul
      // destinatiei zborului (vezi destinatiaGrupului).
      const stilDiv = global.getComputedStyle(elDiv);
      const gapPx = parseFloat(stilDiv.columnGap) || parseFloat(stilDiv.gap) || 0;

      nivelPregatit = nivel;
      masuri = {
        dimensiuneDiscPx,
        latimeIlustratie,
        gapPx,
        latimeEgal: elEgal.getBoundingClientRect().width,
        latimeSemn: elSemn.getBoundingClientRect().width,
        ...m,
      };
      return masuri;
    }

    // Pozitia tinta pt. divul ilustratiei, relativ la containerul de
    // pozitionare (parintele caruia i s-a atasat — trebuie sa aiba
    // position:relative, vezi CSS).
    //
    // ATENTIE, capcana platita de doua ori (30-31.08.2026): la momentul
    // apelului, randul din DOM inca arata continutul VECHI (nerezolvat) —
    // motorul il rescrie abia dupa ce quizul termina de raspuns. Deci NU se
    // poate citi de pe el "unde se termina textul". Din randul viu se iau doar
    // marginea si inaltimea (corecte, pentru ca latimea containerului e fixa,
    // iar randurile au aceeasi inaltime); restul vine din masurile nivelului.
    function pozitieRand(randEl, parinteEl, m) {
      if (!randEl || !parinteEl) return null;
      const rRand = randEl.getBoundingClientRect();
      const rParinte = parinteEl.getBoundingClientRect();
      return {
        // Centrul vertical al randului; divul se ridica singur cu jumatate din
        // inaltimea lui (transform: translateY(-50%), vezi CSS).
        top: rRand.top - rParinte.top + rRand.height / 2,
        left: rRand.left - rParinte.left + m.latimeTextPlusGap,
      };
    }

    // Unde ajung, in pagina, discurile care pleaca — calculat pe layoutul NOU
    // (cerere user, 31.08.2026: "calculezi intai locatia unde trebuie sa ajunga
    // pe randul destinatie, acolo se indreapta de la bun inceput"). Nu se poate
    // masura din DOM: cosurile sunt inca in tranzitie de 3s cand plecam, deci
    // getBoundingClientRect ar da pozitii intermediare, nu finale.
    function destinatiaGrupului({ pozitie, parinteEl, a, b, count, directie, m }) {
      const disc = m.dimensiuneDiscPx;
      const rParinte = parinteEl.getBoundingClientRect();
      const stangaIlustratie = rParinte.left + pozitie.left;
      const centruY = rParinte.top + pozitie.top;

      const latA = latimeCos(a, disc);
      const latB = latimeCos(b, disc);
      const stangaCosA = stangaIlustratie + m.latimeEgal + m.gapPx;
      const stangaCosB = stangaCosA + latA + m.gapPx + m.latimeSemn + m.gapPx;
      // Discurile stau centrate in cos (justify-content:center), deci marginea
      // continutului nu depinde de constanta de chrome.
      const continutA = stangaCosA + (latA - a * disc) / 2;
      const continutB = stangaCosB + (latB - b * disc) / 2;

      const left =
        directie === "a-spre-b"
          ? continutB // sosesc lipite de "+", adica in stanga lui b
          : continutA + (a - count) * disc; // sosesc in dreapta lui a, tot langa "+"
      return { left, top: centruY - disc / 2 };
    }

    // Dreptunghiul ocupat ACUM de discurile care urmeaza sa plece — masurat pe
    // elementele reale, inainte de a reumple cosurile.
    function dreptunghiGrupSursa({ directie, count }) {
      const cosEl = directie === "a-spre-b" ? elCosA : elCosB;
      const discuri = Array.from(cosEl.querySelectorAll(".ilustrare-bonduri-disc"));
      // Pleaca mereu cele dinspre "+": ultimele din a, primele din b.
      const alese =
        directie === "a-spre-b" ? discuri.slice(Math.max(0, discuri.length - count)) : discuri.slice(0, count);
      if (!alese.length) return null;
      const rPrim = alese[0].getBoundingClientRect();
      return { left: rPrim.left, top: rPrim.top };
    }

    // Grupul care zboara: UN singur element, cu discurile aliniate in el
    // (cerere user, 31.08.2026: "zboara impreuna in formatie grupata,
    // aliniata"), pe linie dreapta de la sursa la destinatia calculata mai sus
    // (semicercul e amanat, tot cerere user).
    function zboaraGrupul({ count, sursa, destinatie, culoare, discPx }) {
      const grup = document.createElement("div");
      grup.className = "ilustrare-bonduri-zbor";
      grup.style.left = `${sursa.left}px`;
      grup.style.top = `${sursa.top}px`;
      grup.style.height = `${discPx}px`;
      grup.style.backgroundColor = culoare;
      grup.style.setProperty("--ilustrare-dx", `${destinatie.left - sursa.left}px`);
      grup.style.setProperty("--ilustrare-dy", `${destinatie.top - sursa.top}px`);
      grup.style.animationDuration = `${getDurataTranzitieMs()}ms`;
      grup.innerHTML = Array.from({ length: count }, () => discHtml(discPx, false)).join("");
      document.body.appendChild(grup);
      setTimeout(() => grup.remove(), getDurataTranzitieMs() + 60);
    }

    // Indicii discurilor care SOSESC in cosul destinatie — stau invizibile cat
    // dureaza zborul, ca sa nu se vada de doua ori.
    function indiciSosire({ directie, count, a }) {
      const indici = new Set();
      if (directie === "a-spre-b") {
        for (let i = 0; i < count; i += 1) indici.add(i); // stanga lui b
      } else {
        for (let i = a - count; i < a; i += 1) indici.add(i); // dreapta lui a
      }
      return indici;
    }

    // API principal, apelat de quiz exact cand un bv e rezolvat din prima
    // (vezi js/quizzes/addition-table-singapore-missing.js). Quizul
    // furnizeaza explicit tot ce trebuie — modulul nu ghiceste nimic din
    // starea quizului.
    function arataBv({ containerEl, randEl, nivel, a, b, culoareA, culoareB, latimeDisponibila }) {
      if (!containerEl || !randEl) return { zborDeclansat: false };
      const m = pregatesteNivel({ nivel, randEl, containerEl, latimeCaseta: latimeDisponibila });
      if (!m) return { zborDeclansat: false };
      const pozitie = pozitieRand(randEl, containerEl, m);
      if (!pozitie) return { zborDeclansat: false };
      const disc = m.dimensiuneDiscPx;

      if (!ultimulBv) {
        // Prima aparitie din nivel: direct la locul ei, fara sa gliseze de
        // niciunde (cerere user) — deci fara tranzitie pe acest pas.
        elDiv.style.transition = "none";
        elCosA.style.transition = "none";
        elCosB.style.transition = "none";
        elDiv.style.top = `${pozitie.top}px`;
        elDiv.style.left = `${pozitie.left}px`;
        umpleCos(elCosA, a, culoareA, disc, m.inaltimeNumar);
        umpleCos(elCosB, b, culoareB, disc, m.inaltimeNumar);
        elDiv.style.visibility = "visible";
        // Forteaza un reflow ACUM, cat timp transition e inca "none" —
        // altfel browserul poate contopi toate schimbarile de stil de mai
        // sus cu linia urmatoare (transition activat) intr-un singur
        // recalcul, si interpreteaza pozitia/latimea INITIALA (implicita,
        // 0,0, de dinainte sa existe elDiv la locul lui) ca punct de plecare
        // al unei animatii — cosurile "gliseaza" la prima afisare din nivel
        // (bug raportat de user, 31.08.2026: "cosurile alea se misca la
        // prima afisare, unde nu ar trebui sa se miste").
        void elDiv.offsetWidth;
        // Tranzitiile se activeaza pentru bv-urile URMATOARE din nivel.
        elDiv.style.transition = `top ${getDurataTranzitieMs()}ms ease, left ${getDurataTranzitieMs()}ms ease`;
        elCosA.style.transition = `width ${getDurataTranzitieMs()}ms ease`;
        elCosB.style.transition = `width ${getDurataTranzitieMs()}ms ease`;
        ultimulBv = { a, b };
        return { zborDeclansat: false };
      }

      const mutare = mereDeMutat({ vechi: ultimulBv, nou: { a, b } });
      let ascunseA = null;
      let ascunseB = null;
      let zborDeclansat = false;

      if (mutare && mutare.count > 0) {
        // Sursa se masoara ACUM (cosurile inca au continutul vechi), iar
        // destinatia se calculeaza pe layoutul nou — deci grupul pleaca direct
        // spre unde va ajunge, nu spre unde e acum cosul.
        const sursa = dreptunghiGrupSursa(mutare);
        const destinatie = destinatiaGrupului({ pozitie, parinteEl: containerEl, a, b, ...mutare, m });
        if (sursa) {
          zboaraGrupul({
            count: mutare.count,
            sursa,
            destinatie,
            culoare: mutare.directie === "a-spre-b" ? culoareB : culoareA,
            discPx: disc,
          });
          zborDeclansat = true;
          zborInCursPanaLa = Date.now() + getDurataTranzitieMs();
          const ascunse = indiciSosire({ ...mutare, a });
          if (mutare.directie === "a-spre-b") ascunseB = ascunse;
          else ascunseA = ascunse;
        }
      }

      elDiv.style.top = `${pozitie.top}px`;
      elDiv.style.left = `${pozitie.left}px`;
      umpleCos(elCosA, a, culoareA, disc, m.inaltimeNumar, ascunseA);
      umpleCos(elCosB, b, culoareB, disc, m.inaltimeNumar, ascunseB);
      ultimulBv = { a, b };

      // Discurile sosite devin vizibile exact cand aterizeaza grupul.
      setTimeout(() => {
        if (!elDiv) return;
        elDiv
          .querySelectorAll(".ilustrare-bonduri-disc.e-in-zbor")
          .forEach((el) => el.classList.remove("e-in-zbor"));
      }, getDurataTranzitieMs());

      return { zborDeclansat };
    }

    // Apelat de quiz la schimbarea de nivel — acelasi ciclu de reset ca
    // bvRezolvate. Urmatorul bv rezolvat va fi tratat ca "primul din nivel"
    // (afisare directa, fara animatie), cu masuri recalculate. Containerul
    // randurilor nu se curata aici: la nivel nou se schimba id-urile
    // bv-urilor, deci motorul rescrie tot promptul si containerul e oricum
    // altul, fara latimea pusa de noi.
    function reseteaza() {
      ultimulBv = null;
      nivelPregatit = null;
      masuri = null;
      if (elDiv) {
        const ramas = zborInCursPanaLa - Date.now();
        if (ramas > 0) {
          // Un zbor de discuri e inca in aer (vezi zborInCursPanaLa) — daca am
          // sterge div-ul ACUM, cosurile ar disparea de sub el si zborul ar
          // continua peste tabelul deja golit/rescris al nivelului urmator
          // (bug raportat de user, 31.08.2026: "marul se plimba aiurea pe
          // tabelul golit"). Il lasam pe ecran pana se termina zborul, apoi il
          // curatam — instanta oricum a pornit deja o structura noua pt.
          // urmatorul bv (elDiv == null mai jos), deci n-are cum sa se
          // amestece cu ea.
          const elDivDeCurata = elDiv;
          setTimeout(() => elDivDeCurata.remove(), ramas);
        } else {
          elDiv.remove();
        }
      }
      elDiv = null;
      elEgal = null;
      elCosA = null;
      elCosB = null;
      elSemn = null;
    }

    return { arataBv, reseteaza };
  }

  global.IlustrareBonduri = {
    mereDeMutat,
    creeaza,
    getDurataTranzitieMs,
    setDurataTranzitieMs,
    getDiametruDiscPct,
    setDiametruDiscPct,
    getPaddingCosRem,
    setPaddingCosRem,
    getRandTargetLatimePct,
    setRandTargetLatimePct,
  };
})(window);
