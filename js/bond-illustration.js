(function (global) {
  "use strict";

  // Durata comuna a celor 3 miscari simultane (deplasarea divului, zborul
  // grupului de discuri, redimensionarea cosurilor). Cerere user (30.08.2026):
  // "scade treptat cumva, vedem cum dupa" — constanta pana la o cerere clara.
  const DURATA_TRANZITIE_MS = 3000;

  // Padding+border orizontal ale UNUI cos.
  const CHROME_COS_PX = 18;

  // Sub atat un disc nu se mai vede — plasa de siguranta pt. niveluri mari pe
  // ecrane inguste, nu o dimensiune normala de lucru.
  const DISC_MIN_PX = 6;

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
    return Math.max(1, valoare) * dimensiuneDiscPx + CHROME_COS_PX;
  }

  // Un disc = caracterul "●" intr-un span propriu (cerere user, 31.08.2026:
  // "fiecare cerc in divul lui"), cu font-size egal cu al cifrelor din rand.
  // `ascuns` = disc care tocmai zboara spre locul asta: sta invizibil cat
  // dureaza zborul, ca sa nu apara de doua ori (si in cos, si in aer).
  function discHtml(dimensiunePx, ascuns) {
    return (
      `<span class="ilustrare-bonduri-disc${ascuns ? " e-in-zbor" : ""}" ` +
      `style="width:${dimensiunePx}px;height:${dimensiunePx}px;font-size:${dimensiunePx}px">●</span>`
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

    function umpleCos(cosEl, valoare, culoare, dimensiuneDiscPx, indiciAscunsi) {
      cosEl.style.backgroundColor = culoare;
      cosEl.style.width = `${latimeCos(valoare, dimensiuneDiscPx)}px`;
      cosEl.innerHTML = Array.from({ length: Math.max(0, valoare) }, (_, i) =>
        discHtml(dimensiuneDiscPx, Boolean(indiciAscunsi && indiciAscunsi.has(i)))
      ).join("");
    }

    // Dimensiunea unui disc = exact inaltimea fontului cifrelor din rand
    // (cerere user, 30.08.2026) — citita din randul real, nu dintr-o
    // constanta, ca sa ramana corecta si daca se schimba stilul textului.
    function inaltimeFontRand(randEl) {
      const semnEl = randEl.querySelector(".inventar-bonduri-semn");
      const fontSize = semnEl ? global.getComputedStyle(semnEl).fontSize : null;
      const px = fontSize ? parseFloat(fontSize) : NaN;
      return Number.isFinite(px) && px > 0 ? px : 16;
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
      const rezultat = { ls: rProba.width, latimeTextPlusGap: rLoc.left - rProba.left };
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
      const masoaraIlustratia = (discPx) => {
        umpleCos(elCosA, a, "transparent", discPx);
        umpleCos(elCosB, b, "transparent", discPx);
        return elDiv.getBoundingClientRect().width;
      };

      let dimensiuneDiscPx = inaltimeFontRand(randEl);
      let latimeIlustratie = masoaraIlustratia(dimensiuneDiscPx);
      let m = masoaraRand({ nivel, latimeIlustratie, randuriEl });

      // Discurile stau la inaltimea fontului si se micsoreaza DOAR daca randul
      // complet n-ar incapea in caseta intrebarii (cerere user, 30.08.2026:
      // "mai micsorezi merele ca sa incapa"). Chrome-ul cosurilor nu depinde de
      // marimea discului, deci o singura corectie e exacta.
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
      grup.style.animationDuration = `${DURATA_TRANZITIE_MS}ms`;
      grup.innerHTML = Array.from({ length: count }, () => discHtml(discPx, false)).join("");
      document.body.appendChild(grup);
      setTimeout(() => grup.remove(), DURATA_TRANZITIE_MS + 60);
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
      if (!containerEl || !randEl) return;
      const m = pregatesteNivel({ nivel, randEl, containerEl, latimeCaseta: latimeDisponibila });
      if (!m) return;
      const pozitie = pozitieRand(randEl, containerEl, m);
      if (!pozitie) return;
      const disc = m.dimensiuneDiscPx;

      if (!ultimulBv) {
        // Prima aparitie din nivel: direct la locul ei, fara sa gliseze de
        // niciunde (cerere user) — deci fara tranzitie pe acest pas.
        elDiv.style.transition = "none";
        elCosA.style.transition = "none";
        elCosB.style.transition = "none";
        elDiv.style.top = `${pozitie.top}px`;
        elDiv.style.left = `${pozitie.left}px`;
        umpleCos(elCosA, a, culoareA, disc);
        umpleCos(elCosB, b, culoareB, disc);
        elDiv.style.visibility = "visible";
        // Tranzitiile se activeaza pentru bv-urile URMATOARE din nivel.
        elDiv.style.transition = `top ${DURATA_TRANZITIE_MS}ms ease, left ${DURATA_TRANZITIE_MS}ms ease`;
        elCosA.style.transition = `width ${DURATA_TRANZITIE_MS}ms ease`;
        elCosB.style.transition = `width ${DURATA_TRANZITIE_MS}ms ease`;
        ultimulBv = { a, b };
        return;
      }

      const mutare = mereDeMutat({ vechi: ultimulBv, nou: { a, b } });
      let ascunseA = null;
      let ascunseB = null;

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
          const ascunse = indiciSosire({ ...mutare, a });
          if (mutare.directie === "a-spre-b") ascunseB = ascunse;
          else ascunseA = ascunse;
        }
      }

      elDiv.style.top = `${pozitie.top}px`;
      elDiv.style.left = `${pozitie.left}px`;
      umpleCos(elCosA, a, culoareA, disc, ascunseA);
      umpleCos(elCosB, b, culoareB, disc, ascunseB);
      ultimulBv = { a, b };

      // Discurile sosite devin vizibile exact cand aterizeaza grupul.
      setTimeout(() => {
        if (!elDiv) return;
        elDiv
          .querySelectorAll(".ilustrare-bonduri-disc.e-in-zbor")
          .forEach((el) => el.classList.remove("e-in-zbor"));
      }, DURATA_TRANZITIE_MS);
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
      if (elDiv) elDiv.remove();
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
  };
})(window);
