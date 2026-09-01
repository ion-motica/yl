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

  // Multiplicator peste scara de font gasita de auto-fit (fontRandScala mai
  // jos), 100% = neschimbat — reglabil live din CP (cerere user, 01.09.2026:
  // "Marire font -[100%]+"). La fel ca Diametru disc, NU se hraneste inapoi
  // in bucla de auto-fit (PASUL 1) — altfel auto-fit-ul ar re-tinti latimea
  // si ar anula exact multiplicatorul cerut de user. Spre deosebire de
  // Diametru disc insa, schimba baza (inaltimeNumarBaza) folosita si de
  // Diametru disc, deci dupa aplicare se re-masoara (vezi pregatesteNivel).
  const setareMarireFontPct = creeazaSetareReglabila("ilustrareBonduriMarireFontPct", 100, numarPozitivSauNimic);
  function getMarireFontPct() {
    return setareMarireFontPct.get();
  }
  function setMarireFontPct(pct) {
    setareMarireFontPct.set(pct);
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

  // Culoarea discurilor (.ilustrare-bonduri-disc) — proprietate CSS globala,
  // acelasi tipar ca scara de font: o singura sursa de adevar, citita de
  // TOATE discurile de pe ecran deodata (cos + grup zburator + orice clona),
  // fara nicio interventie JS suplimentara la schimbare. Reglabila live din
  // CP ("Culoare bila:", cerere user 01.09.2026) — deocamdata alba,
  // inlocuind fostul #0f1419 hardcodat din CSS (aproape negru, facea
  // discurile sa para "gauri" in cos).
  const setareCuloareDisc = creeazaSetareReglabila("ilustrareBonduriCuloareDisc", "#ffffff", (v) =>
    typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : null
  );
  const PROP_CSS_CULOARE_DISC = "--ilustrare-disc-culoare";
  function aplicaCuloareDisc(culoare) {
    document.documentElement.style.setProperty(PROP_CSS_CULOARE_DISC, culoare);
  }
  function getCuloareDisc() {
    return setareCuloareDisc.get();
  }
  function setCuloareDisc(culoare) {
    setareCuloareDisc.set(culoare);
    aplicaCuloareDisc(culoare);
  }

  // Traiectoria grupului de discuri zburator — "oblic" (implicit,
  // comportamentul de dintotdeauna: linie dreapta intre sursa si destinatie)
  // vs "orizontal" (cerere user, 01.09.2026: bilele raman mereu la nivelul
  // cosului care se muta pe verticala, deplasarea catre celalalt cos se face
  // pe orizontala, simultan). Reglabila live din CP ("Traiectorie bile:").
  const setareTraiectorieBile = creeazaSetareReglabila("ilustrareBonduriTraiectorieBile", "oblic", (v) =>
    v === "oblic" || v === "orizontal" ? v : null
  );
  function getTraiectorieBile() {
    return setareTraiectorieBile.get();
  }
  function setTraiectorieBile(valoare) {
    setareTraiectorieBile.set(valoare);
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

  // Doua trepte de z-index pt. divurile ilustratiei (.ilustrare-bonduri,
  // elDiv SAU o clona) — "plimbator" (in tranzitie de pozitie) DEASUPRA
  // "fix" (asezat), indiferent de ordinea lor in DOM (cerere user,
  // 01.09.2026: "cosul clonat si bilele sa pluteasca pe deasupra celorlate
  // cosuri, nu pe dedesubt ca acum"). Fara asta, un element mai VECHI in DOM
  // (deci desenat primul) care se muta ACUM poate trece vizual SUB un
  // element mai nou, deja asezat static, doar pt ca DOM-ul il deseneaza mai
  // tarziu — chiar daca cel static nu se mai misca deloc. Vezi CSS:
  // .ilustrare-bonduri.e-plimbator.
  function marcheazaPlimbator(el) {
    el?.classList.add("e-plimbator");
  }
  function marcheazaFix(el) {
    el?.classList.remove("e-plimbator");
  }

  // Perechea de cifre colorate "a+b" care zboara de la intrebarea
  // propriu-zisa pana la randul ei din tabel — independenta de instanta
  // ilustratiei (nu are nevoie de elDiv/cosuri, doar de doua elemente deja
  // randate: sursa si destinatia), la fel ca zboaraGrupul de mai jos.
  // Cerere user (01.09.2026): "dupa ce am dat raspunsul vreau ca numerele
  // colorate 5+2 sa apara exact suprapuse peste numerele 5+2 din intrebarea
  // propriu zisa si sa pluteasca pana ajung la locul lor pe randul
  // corespunzator". "Suprapus" (confirmat de user) = pozitionat exact peste
  // dreptunghiul sursei, nu deasupra ei — de-aia grupul ia latimea/inaltimea
  // lui sursaEl, nu doar un punct. Apelanta (quiz) e responsabila sa ascunda
  // cifrele din randul destinatie pana aterizeaza (acelasi tipar ca
  // indiciSosire/e-in-zbor la discuri) — functia asta doar deseneaza zborul.
  function zboaraCifre({ sursaEl, destinatieEl, a, b, culoareA, culoareB }) {
    if (!sursaEl || !destinatieEl) return;
    const rSursa = sursaEl.getBoundingClientRect();
    const rDest = destinatieEl.getBoundingClientRect();
    const grup = document.createElement("div");
    grup.className = "ilustrare-cifre-zbor";
    grup.style.left = `${rSursa.left}px`;
    grup.style.top = `${rSursa.top}px`;
    grup.style.width = `${rSursa.width}px`;
    grup.style.height = `${rSursa.height}px`;
    grup.style.setProperty("--ilustrare-cifre-dx", `${rDest.left + rDest.width / 2 - (rSursa.left + rSursa.width / 2)}px`);
    grup.style.setProperty("--ilustrare-cifre-dy", `${rDest.top + rDest.height / 2 - (rSursa.top + rSursa.height / 2)}px`);
    const ms = getDurataTranzitieMs();
    grup.style.animationDuration = `${ms}ms`;
    grup.innerHTML =
      `<span class="ilustrare-cifre-numar" style="background-color:${culoareA}">${a}</span>` +
      `<span class="ilustrare-cifre-plus">+</span>` +
      `<span class="ilustrare-cifre-numar" style="background-color:${culoareB}">${b}</span>`;
    document.body.appendChild(grup);
    setTimeout(() => grup.remove(), ms + 60);
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
    // Clone LASATE PE LOC, independente de elDiv, create direct in
    // containerEl — deci reseteaza() trebuie sa le curate explicit (nu se
    // sterg singure ca elDiv). Doua surse: joacaSpectacolFinal (cascada de
    // final de nivel) SI arataBv, cand modul "Ilustratie la: toate
    // bondurile cu raspuns" e activ (cerere user, 31.08.2026) — la fiecare
    // bv nou, elDiv se cloneaza EXACT cum arata acum, inainte sa se mute la
    // randul nou, ca ilustratia randului vechi sa ramana vizibila definitiv.
    // Elemente `{ el, a, b }`, NU doar nodul DOM — bondul propriu fiecarei
    // clone e necesar ca sa poata fi RE-randata mai tarziu la o setare noua
    // din CP (vezi reaplicaSetari), cerere user (01.09.2026): "daca sunt mai
    // multe randuri cu raspuns ... trebuie toate rerandate".
    let cloneRamase = [];
    // Cand se termina (timestamp) spectacolul final in curs — 0 daca
    // niciunul. Acelasi rol ca zborInCursPanaLa, pt. reseteaza() (vezi acolo).
    let spectacolInCursPanaLa = 0;
    // Grupul de discuri zburatoare (vezi zboaraGrupul) pornit cel mai recent —
    // null daca niciunul in curs / deja aterizat. joacaSpectacolFinal il
    // elimina imediat la start (nivelul e oricum deja complet la momentul
    // spectacolului, n-are sens sa mai anime spre o destinatie veche — bug
    // raportat de user, 31.08.2026: "animatia ultimului bond ... nu se
    // termina iar punctele ei sunt complete inainte sa ajunga la cos
    // punctele plimbatoare").
    let grupZburatorCurent = null;

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
      // "-cos-b", in plus fata de clasa comuna — CSS aliniaza discurile lui
      // A la stanga si pe ale lui B la dreapta (vezi .ilustrare-bonduri-cos),
      // ca sa nu se rearanjeze toate discurile la fiecare schimbare de
      // latime (cerere user, 31.08.2026).
      elCosB.className = "ilustrare-bonduri-cos ilustrare-bonduri-cos-b";

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
      // Sincronizeaza mereu culoarea discurilor cu setarea din CP — auto-
      // vindecabil chiar daca userul n-a deschis niciodata panoul CP (ex.
      // pagina proaspat incarcata, cu o culoare salvata din sesiuni
      // anterioare).
      aplicaCuloareDisc(getCuloareDisc());

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
      // numeric valoarea care duce latimea celui mai lat rand la
      // procentul-tinta din latimea disponibila (cerere user, 31.08.2026:
      // "randul ocupa -[80%]+ din latimea divului — regleaza fontul si
      // diametrul discului"). Pana la 6 pasi de corectie liniara, cu iesire
      // anticipata sub 1px eroare — nu 2 fixi: relatia latime~scara NU e
      // perfect liniara (chrome-ul FIX al cosului, padding+bordura, nu se
      // scaleaza cu fontul), deci la tinte extreme (aproape de 100%) o
      // singura corectie converge prea incet si ramane vizibil peste chenar
      // (bug raportat de user, 31.08.2026, cu "Randul ocupa" = 95%: "nu mai
      // tine la valorile din poza").
      aplicaScaraFont(1);
      let { inaltimeNumarBaza, mas: m } = masoaraLaScaraFixa100();

      const targetPct = getRandTargetLatimePct();
      let scala = 1;
      if (latimeCaseta > 0 && targetPct > 0 && m.ls > 0) {
        const tinta = (targetPct / 100) * latimeCaseta;
        for (let pas = 0; pas < 6; pas += 1) {
          if (Math.abs(tinta - m.ls) < 1) break;
          const factor = tinta / m.ls;
          if (!Number.isFinite(factor) || factor <= 0) break;
          scala *= factor;
          aplicaScaraFont(scala);
          ({ inaltimeNumarBaza, mas: m } = masoaraLaScaraFixa100());
        }
      }

      // PASUL 1bis: multiplicatorul "Marire font" din CP, peste scara gasita
      // de auto-fit — apoi RE-MASOARA (discul inca fixat la 100%, ca la
      // masuratorile de mai sus), ca baza folosita de Diametru disc (pasul
      // urmator) sa reflecte fontul REAL vazut de user, nu cel de dinainte
      // de multiplicator.
      const marireFontPct = getMarireFontPct();
      if (marireFontPct !== 100) {
        scala *= marireFontPct / 100;
        aplicaScaraFont(scala);
        ({ inaltimeNumarBaza, mas: m } = masoaraLaScaraFixa100());
      }

      // PASUL 2: ACUM se aplica procentul REAL din CP (Diametru disc) —
      // multiplicator independent peste rezultatul auto-fit-ului, care NU
      // se mai recalculeaza in bucla de mai sus.
      let dimensiuneDiscPx = Math.max(DISC_MIN_PX, Math.round((inaltimeNumarBaza * getDiametruDiscPct()) / 100));
      let latimeIlustratie = masoaraIlustratia(dimensiuneDiscPx);
      m = masoaraRand({ nivel, latimeIlustratie, randuriEl });

      // Plasa de siguranta FINALA: daca randul TOT nu incape (target extrem,
      // ex. 95%+, combinat cu un chrome mare al cosului, sau caseta extrem
      // de ingusta), micsoreaza UNIFORM tot — font SI disc — cu raportul
      // exact necesar, repetat pana incape (max. 3 incercari; convergenta
      // geometrica, in practica 1 e suficienta). Diferit de vechea plasa
      // (care micsora doar discul): acum garanteaza ca randul NU iese
      // NICIODATA peste marginea casetei, indiferent cat de bine a convers
      // cautarea de mai sus.
      for (let pas = 0; pas < 3 && latimeCaseta > 0 && m.ls > latimeCaseta; pas += 1) {
        const factorSiguranta = latimeCaseta / m.ls;
        if (!Number.isFinite(factorSiguranta) || factorSiguranta <= 0) break;
        scala *= factorSiguranta;
        aplicaScaraFont(scala);
        dimensiuneDiscPx = Math.max(DISC_MIN_PX, Math.round(dimensiuneDiscPx * factorSiguranta));
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

    // Randul din tabel care arata EXACT bondul (a,b) dat — cautat prin
    // continutul lui viu (cele doua .inventar-bonduri-numar), nu preluat de
    // la vreun apelant. Necesar in reaplicaSetari (mai jos): fiecare clona
    // ramasa pe loc trebuie repozitionata la randul EI, nu la randul curent
    // primit ca parametru. Acelasi tipar ca dateRanduri din
    // joacaSpectacolFinal (citeste bondul direct din DOM-ul randului viu).
    // Sigur doar dupa ce randul a fost REZOLVAT (motorul ii rescrie cifrele
    // abia atunci) — adevarat pt. orice rand care are deja o clona.
    function gasesteRandulPentru(randuriEl, a, b) {
      if (!randuriEl) return null;
      return (
        Array.from(randuriEl.children).find((rand) => {
          const numere = rand.querySelectorAll(".inventar-bonduri-numar");
          return numere.length >= 2 && Number(numere[0].textContent) === a && Number(numere[1].textContent) === b;
        }) || null
      );
    }

    // Pozitia verticala a primului sau ultimului rand din tabelul bv-urilor —
    // folosita ca punct de PLECARE pt. prima aparitie din nivel (vezi
    // arataBv). Acelasi calcul de `top` ca pozitieRand, dar pe randul extrem,
    // nu pe cel tinta.
    function pozitieLinieExtrema(randuriEl, parinteEl, foloseseLiniaDeSus) {
      if (!randuriEl || !randuriEl.children.length) return null;
      const randExtrem = foloseseLiniaDeSus ? randuriEl.children[0] : randuriEl.children[randuriEl.children.length - 1];
      const rRand = randExtrem.getBoundingClientRect();
      const rParinte = parinteEl.getBoundingClientRect();
      return { top: rRand.top - rParinte.top + rRand.height / 2 };
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
    // elementele reale, inainte de a reumple cosurile. `cosEls`, daca dat,
    // permite reutilizarea pe cosurile unui CLON (Spectacol 1), nu doar pe
    // elCosA/elCosB ale ilustratiei live (implicit, pt. arataBv).
    function dreptunghiGrupSursa({ directie, count }, cosEls) {
      const cosA = (cosEls && cosEls.cosA) || elCosA;
      const cosB = (cosEls && cosEls.cosB) || elCosB;
      const cosEl = directie === "a-spre-b" ? cosA : cosB;
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
    function zboaraGrupul({ count, sursa, destinatie, discPx }) {
      const ms = getDurataTranzitieMs();
      const discuriHtml = Array.from({ length: count }, () => discHtml(discPx, false)).join("");

      // "Orizontal" (cerere user, 01.09.2026) — bilele raman mereu la
      // nivelul cosului care se muta pe verticala; deplasarea catre celalalt
      // cos e pe orizontala, simultan. PRIMA incercare (keyframe cu o
      // oprire intermediara la 60%) producea un salt vizibil — bug raportat
      // de user: "merge drept, pica intr-o groapa, iar iese din groapa"
      // (easing-ul se intrerupe si reporneste la fiecare oprire de
      // keyframe, deci viteza are un colt exact acolo). Fix: DOUA straturi
      // imbricate, fiecare cu PROPRIA tranzitie CSS simpla (from->to, fara
      // nicio oprire), nu un singur keyframe cu mai multe puncte — stratul
      // EXTERN se ocupa NUMAI de verticala, cu EXACT aceeasi durata/easing
      // ca liftul cosului insusi ("ease", elDiv.style.transition mai jos),
      // stratul INTERN NUMAI de orizontala — miscandu-se simultan, fiecare
      // lin pe axa lui, fara nicio discontinuitate de viteza.
      if (getTraiectorieBile() === "orizontal") {
        const extern = document.createElement("div");
        extern.className = "ilustrare-bonduri-zbor-orizontal-extern";
        extern.style.left = `${sursa.left}px`;
        extern.style.top = `${sursa.top}px`;
        extern.style.height = `${discPx}px`;
        extern.style.transition = "none";
        const intern = document.createElement("div");
        intern.className = "ilustrare-bonduri-zbor-orizontal-intern";
        intern.style.transition = "none";
        intern.innerHTML = discuriHtml;
        extern.appendChild(intern);
        document.body.appendChild(extern);
        void extern.offsetWidth;
        extern.style.transition = `transform ${ms}ms ease`;
        intern.style.transition = `transform ${ms}ms ease`;
        extern.style.transform = `translateY(${destinatie.top - sursa.top}px)`;
        intern.style.transform = `translateX(${destinatie.left - sursa.left}px)`;
        grupZburatorCurent = extern;
        setTimeout(() => {
          extern.remove();
          if (grupZburatorCurent === extern) grupZburatorCurent = null;
        }, ms + 60);
        return;
      }

      const grup = document.createElement("div");
      grup.className = "ilustrare-bonduri-zbor";
      grup.style.left = `${sursa.left}px`;
      grup.style.top = `${sursa.top}px`;
      grup.style.height = `${discPx}px`;
      // FARA fundal, deloc — nici alb, nici culoarea cosului destinatie
      // (cerere user, 31.08.2026: "scoate-i orice halou" — orice fundal,
      // chiar si alb, tot citea ca un al doilea cos plutitor, nu ca o bila
      // liber in zbor). Vizibilitatea discului insusi pe fundalul paginii
      // ramane o discutie separata, deocamdata neatinsa aici.
      grup.style.setProperty("--ilustrare-dx", `${destinatie.left - sursa.left}px`);
      grup.style.setProperty("--ilustrare-dy", `${destinatie.top - sursa.top}px`);
      grup.style.animationDuration = `${ms}ms`;
      grup.innerHTML = discuriHtml;
      document.body.appendChild(grup);
      grupZburatorCurent = grup;
      setTimeout(() => {
        grup.remove();
        // Doar daca grupul asta e inca "cel curent" — daca joacaSpectacolFinal
        // l-a eliminat deja mai devreme, referinta a fost deja golita.
        if (grupZburatorCurent === grup) grupZburatorCurent = null;
      }, ms + 60);
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
    function arataBv({ containerEl, randEl, nivel, a, b, culoareA, culoareB, latimeDisponibila, faraAnimatie, acumuleaza }) {
      if (!containerEl || !randEl) return { zborDeclansat: false };
      const m = pregatesteNivel({ nivel, randEl, containerEl, latimeCaseta: latimeDisponibila });
      if (!m) return { zborDeclansat: false };
      const pozitie = pozitieRand(randEl, containerEl, m);
      if (!pozitie) return { zborDeclansat: false };
      const disc = m.dimensiuneDiscPx;
      const ms = getDurataTranzitieMs();

      if (!ultimulBv) {
        // Prima aparitie din nivel: acum ANIMATA si ea, "unitar" cu restul
        // tranzitiilor (cerere user, 31.08.2026) — dar nu de la pozitia
        // implicita (0,0), ci de la linia EXTREMA a tabelului (prima sau
        // ultima) care e mai DEPARTATA de linia tinta, ca sa parcurga drumul
        // cel mai lung posibil.
        const randuriEl = randEl.parentElement;
        const pozSus = randuriEl ? pozitieLinieExtrema(randuriEl, containerEl, true) : null;
        const pozJos = randuriEl ? pozitieLinieExtrema(randuriEl, containerEl, false) : null;
        let pozitiePornire = pozitie;
        // Bondul PROPRIU liniei de plecare — nu bondul bv-ului curent (asta
        // ar insemna sa nu se miste nicio bila, doar cosul, o singura
        // "aparitie" fara animatie de mere). Randurile tabelului sunt
        // ordonate crescator dupa `a` (vezi bvPentruNivel din
        // bond-inventory.js), determinist, indiferent de ordinea REALA in
        // care se raspunde — deci linia extrema are mereu bondul 1+(nivel-1)
        // (prima linie) sau (nivel-1)+1 (ultima), chiar daca inca
        // NEREZOLVATA in DOM (cerere user, 31.08.2026: "sa plece cu
        // configuratia de mere proprie liniei de plecare (1+x sau x+1) ...
        // ca sa aiba si animatie de miscare a merelor").
        let bondPornire = { a, b };
        if (pozSus && pozJos) {
          const distSus = Math.abs(pozitie.top - pozSus.top);
          const distJos = Math.abs(pozitie.top - pozJos.top);
          const plecaDeSus = distSus >= distJos;
          pozitiePornire = plecaDeSus ? pozSus : pozJos;
          bondPornire = plecaDeSus ? { a: 1, b: nivel - 1 } : { a: nivel - 1, b: 1 };
        }

        elDiv.style.transition = "none";
        elCosA.style.transition = "none";
        elCosB.style.transition = "none";
        elDiv.style.top = `${pozitiePornire.top}px`;
        elDiv.style.left = `${pozitie.left}px`;
        umpleCos(elCosA, bondPornire.a, culoareA, disc, m.inaltimeNumar);
        umpleCos(elCosB, bondPornire.b, culoareB, disc, m.inaltimeNumar);
        elDiv.style.visibility = "visible";
        // Forteaza un reflow ACUM, cat timp transition e inca "none" —
        // altfel browserul poate contopi toate schimbarile de stil de mai
        // sus cu linia urmatoare (transition activat) intr-un singur
        // recalcul, si interpreteaza pozitia INITIALA (implicita, 0,0, de
        // dinainte sa existe elDiv la locul lui) ca punct de plecare al unei
        // animatii — cosurile "gliseaza" din locul gresit la prima afisare
        // din nivel (bug raportat de user, 31.08.2026: "cosurile alea se
        // misca la prima afisare, unde nu ar trebui sa se miste"). Aici insa
        // CHIAR vrem o animatie, doar cu punctul de plecare CORECT
        // (pozitiePornire), nu cel implicit.
        void elDiv.offsetWidth;
        elDiv.style.transition = `top ${ms}ms ease, left ${ms}ms ease`;
        elCosA.style.transition = `width ${ms}ms ease`;
        elCosB.style.transition = `width ${ms}ms ease`;
        // Miscarea REALA, catre pozitia tinta — declansata abia acum, cu
        // tranzitia deja activa.
        marcheazaPlimbator(elDiv);
        elDiv.style.top = `${pozitie.top}px`;

        // Continutul se transforma SI el, cu acelasi zbor de discuri ca
        // orice alta tranzitie (mereDeMutat + zboaraGrupul), de la bondul de
        // plecare la bondul REAL al bv-ului — sincron cu deplasarea de mai
        // sus, masurat pe elCosA/elCosB (care au tocmai primit bondPornire).
        const mutarePornire = mereDeMutat({ vechi: bondPornire, nou: { a, b } });
        let ascunsePornireA = null;
        let ascunsePornireB = null;
        if (mutarePornire && mutarePornire.count > 0) {
          const sursaPornire = dreptunghiGrupSursa(mutarePornire);
          const destinatiePornire = destinatiaGrupului({ pozitie, parinteEl: containerEl, a, b, ...mutarePornire, m });
          if (sursaPornire) {
            zboaraGrupul({ count: mutarePornire.count, sursa: sursaPornire, destinatie: destinatiePornire, discPx: disc });
            zborInCursPanaLa = Date.now() + ms;
            const ascunse = indiciSosire({ ...mutarePornire, a });
            if (mutarePornire.directie === "a-spre-b") ascunsePornireB = ascunse;
            else ascunsePornireA = ascunse;
          }
        }
        umpleCos(elCosA, a, culoareA, disc, m.inaltimeNumar, ascunsePornireA);
        umpleCos(elCosB, b, culoareB, disc, m.inaltimeNumar, ascunsePornireB);
        ultimulBv = { a, b };
        setTimeout(() => {
          if (!elDiv) return;
          elDiv
            .querySelectorAll(".ilustrare-bonduri-disc.e-in-zbor")
            .forEach((el) => el.classList.remove("e-in-zbor"));
          marcheazaFix(elDiv);
        }, ms);
        return { zborDeclansat: Boolean(mutarePornire && mutarePornire.count > 0) };
      }

      if (acumuleaza) {
        // "Ilustratie la: toate bondurile cu raspuns" (cerere user,
        // 31.08.2026) — inainte sa mutam elDiv la randul NOU, il clonam
        // EXACT cum arata acum (randul VECHI, deja asezat), si lasam clona
        // pe loc definitiv. Reutilizeaza acelasi tipar ca joacaSpectacolFinal
        // ("ilustratia veche ramane pe pozitia ei"), doar ca declansat aici
        // pas cu pas, la fiecare raspuns, nu intr-o cascada la finalul
        // nivelului.
        const clonaRamasa = elDiv.cloneNode(true);
        // Clona ramane STATICA definitiv — daca zborul bv-ului anterior inca
        // n-a aterizat (raspuns foarte rapid), discurile "e-in-zbor" ar
        // ramane ascunse PERMANENT pe ea (nimeni nu mai are ocazia sa le
        // curete, ca la elDiv). Le facem vizibile explicit, chiar acum.
        clonaRamasa
          .querySelectorAll(".ilustrare-bonduri-disc.e-in-zbor")
          .forEach((el) => el.classList.remove("e-in-zbor"));
        // Clona ramane STATICA, deci treapta "fix" — defensiv, ca sa nu
        // moshteneasca "e-plimbator" de la elDiv daca acesta era inca in
        // tranzitie in momentul clonarii (vezi marcheazaPlimbator/Fix).
        marcheazaFix(clonaRamasa);
        containerEl.appendChild(clonaRamasa);
        // Bondul e cel VECHI (ultimulBv) — elDiv inca arata randul dinainte
        // sa se mute la cel nou, cateva linii mai jos.
        cloneRamase.push({ el: clonaRamasa, a: ultimulBv.a, b: ultimulBv.b });
      }

      if (faraAnimatie) {
        // Ultimul bv al nivelului, chiar inainte de Spectacol 1: bila
        // TELEPORTEAZA direct in cosul destinatie (fara zbor, fara discuri
        // ascunse care asteapta sa aterizeze), dar cosul si pozitia raman
        // ANIMATE — tranzitiile sunt DEJA active continuu de la primul bv al
        // nivelului (niciodata dezactivate intre bv-uri, vezi mai jos), deci
        // NU trebuie atinse aici. Bug anterior: le dezactivam, setam direct
        // valorile FINALE, apoi le reactivam fara sa mai schimb nimic dupa —
        // asta anula orice animatie (nimic nu mai ramanea de tranzitionat),
        // exact "animatia brusca, fara pasi intermediari" raportat de user
        // (31.08.2026, cu poze "de la 4+1 la 3+2, nu exista frame-uri
        // intermediare"). Spectacolul preia imediat dupa si face EL insusi
        // singura tranzitie animata (de la acest bond la randul 1), evitand
        // doua tranzitii simultane pe acelasi elDiv — coliziunea celor doua
        // era cauza cea mai probabila a "bilei lui Schrodinger", prezenta
        // simultan in ambele cosuri. z-index "plimbator" ramane pana il
        // preia joacaSpectacolFinal (urmeaza imediat, cand faraAnimatie e
        // true) — el insusi marcheaza/demarcheaza in jurul PROPRIEI
        // tranzitii pe acelasi elDiv, deci nu e nevoie de un cleanup separat
        // aici.
        marcheazaPlimbator(elDiv);
        elDiv.style.top = `${pozitie.top}px`;
        elDiv.style.left = `${pozitie.left}px`;
        umpleCos(elCosA, a, culoareA, disc, m.inaltimeNumar);
        umpleCos(elCosB, b, culoareB, disc, m.inaltimeNumar);
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
            discPx: disc,
          });
          zborDeclansat = true;
          zborInCursPanaLa = Date.now() + getDurataTranzitieMs();
          const ascunse = indiciSosire({ ...mutare, a });
          if (mutare.directie === "a-spre-b") ascunseB = ascunse;
          else ascunseA = ascunse;
        }
      }

      marcheazaPlimbator(elDiv);
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
        marcheazaFix(elDiv);
      }, getDurataTranzitieMs());

      return { zborDeclansat };
    }

    // Re-randeaza IMEDIAT, pe loc, tot ce e vizibil ACUM (ilustratia curenta
    // + orice clona ramasa, modul "Ilustratie la: toate bondurile cu
    // raspuns") la setarile curente din CP — fara sa treaca prin reseteaza()
    // (care le-ar sterge pe toate si ar astepta urmatorul raspuns sa le
    // redeseneze). Apelata de quiz la fiecare schimbare dintr-un camp cu
    // `afecteazaMasurarea` (cerere user, 01.09.2026: "nu vad modificarea
    // imediat ... bilele si cosurile dispar si reapar abia la urmatoarea
    // apasare de buton").
    //
    // Doar mere/cosuri — NU si scara de font a cifrelor propriu-zise
    // (.inventar-bonduri-semn/-numar): aceea deja se propaga singura, live,
    // prin variabila CSS globala (--ilustrare-font-scala, vezi
    // aplicaScaraFont), fara ajutor din partea acestei functii. Merele si
    // latimea cosurilor insa sunt pixeli FICSI, scrisi de JS (vezi umpleCos)
    // dupa o masurare reala — nu exista nicio formula CSS din care sa se
    // recalculeze singure, deci fiecare element (elDiv + fiecare clona)
    // trebuie rescris explicit, cu bondul lui propriu.
    //
    // Repozitioneaza si fiecare tinta (top/left) la randul EI, nu doar
    // dimensiunile — daca "Marire font" a schimbat inaltimea randurilor din
    // tabel (cifrele proprii "6=4+2" cresc si ele, prin acelasi
    // --ilustrare-font-scala), pozitiile vechi ramase pe loc ar defaza tot
    // mai mult fata de randurile lor pe masura ce se aduna clicuri (bug
    // raportat de user, 01.09.2026, cu poze: "randurle cu cosurile incep sa
    // se defazeze de randurile cu numerele — din ce in ce mai mult la
    // fiecare clic").
    function reaplicaSetari({ containerEl, randEl, latimeDisponibila }) {
      if (!structuraExista() || !nivelPregatit || !containerEl || !randEl) return;
      const nivel = nivelPregatit;
      const ms = getDurataTranzitieMs();
      const randuriEl = randEl.parentElement;

      // Culorile se CAPTUREAZA ACUM, inainte sa ruleze pregatesteNivel —
      // masurarea lui scrie direct pe elCosA/elCosB (proba "transparent",
      // vezi masoaraIlustratia), deci daca le-am citi DUPA am recupera
      // "transparent" in loc de culoarea reala (bug raportat de user,
      // 01.09.2026: "un cos se decoloreaza", la primul clic). Clonele nu
      // sunt atinse de acea masurare, dar le capturam la fel, uniform.
      const tinte = [];
      if (ultimulBv) {
        tinte.push({
          elDivTinta: elDiv,
          cosA: elCosA,
          cosB: elCosB,
          a: ultimulBv.a,
          b: ultimulBv.b,
          culoareA: elCosA.style.backgroundColor,
          culoareB: elCosB.style.backgroundColor,
        });
      }
      cloneRamase.forEach(({ el, a, b }) => {
        const cosA = el.children[1];
        const cosB = el.children[3];
        tinte.push({ elDivTinta: el, cosA, cosB, a, b, culoareA: cosA.style.backgroundColor, culoareB: cosB.style.backgroundColor });
      });

      // Opreste tranzitiile cat dureaza re-masurarea (pregatesteNivel scrie
      // latimi PROBA, intermediare, direct pe elCosA/elCosB) SI aplicarea
      // finala — schimbarea trebuie vazuta INSTANT, nu animata treptat ca o
      // tranzitie normala intre doua bv-uri.
      tinte.forEach(({ elDivTinta, cosA, cosB }) => {
        elDivTinta.style.transition = "none";
        if (cosA) cosA.style.transition = "none";
        if (cosB) cosB.style.transition = "none";
      });

      nivelPregatit = null; // forteaza pregatesteNivel sa re-masoare, nu cache-ul vechi
      const m = pregatesteNivel({ nivel, randEl, containerEl, latimeCaseta: latimeDisponibila });

      const reactiveazaTranzitiile = () => {
        void containerEl.offsetWidth;
        tinte.forEach(({ elDivTinta, cosA, cosB }) => {
          elDivTinta.style.transition = `top ${ms}ms ease, left ${ms}ms ease`;
          if (cosA) cosA.style.transition = `width ${ms}ms ease`;
          if (cosB) cosB.style.transition = `width ${ms}ms ease`;
        });
      };

      if (!m) {
        reactiveazaTranzitiile();
        return;
      }

      tinte.forEach(({ elDivTinta, cosA, cosB, a, b, culoareA, culoareB }) => {
        if (cosA) umpleCos(cosA, a, culoareA, m.dimensiuneDiscPx, m.inaltimeNumar);
        if (cosB) umpleCos(cosB, b, culoareB, m.dimensiuneDiscPx, m.inaltimeNumar);
        const randPropriu = gasesteRandulPentru(randuriEl, a, b);
        const poz = randPropriu ? pozitieRand(randPropriu, containerEl, m) : null;
        if (poz) {
          elDivTinta.style.top = `${poz.top}px`;
          elDivTinta.style.left = `${poz.left}px`;
        }
      });
      reactiveazaTranzitiile();
    }

    // "Spectacol 1" (cerere user, 31.08.2026, camp CP "Spectacol la final de
    // level"): la finalul unui nivel, ilustratia urca la randul 1, apoi se
    // multiplica in cascada — la fiecare pas se creeaza un CLONE EXACT peste
    // ilustratia care tocmai a ajuns la randul ei, originalul ramane pe loc,
    // iar clonul continua sa coboare la randul urmator — pana fiecare rand
    // are ilustratia proprie. `randuriEl` = containerul tuturor randurilor
    // tabelului nivelului CARE SE INCHEIE (nu al celui urmator). Intoarce
    // `{ durataTotalaMs }` — cat trebuie sa astepte quizul (pasUrmator.dupa)
    // inainte sa arate nivelul urmator, ca show-ul sa apuce sa se termine.
    function joacaSpectacolFinal({ containerEl, randuriEl }, gataCallback) {
      const ms = getDurataTranzitieMs();
      if (!elDiv || !containerEl || !randuriEl || !randuriEl.children.length || !masuri) {
        gataCallback?.();
        return { durataTotalaMs: 0 };
      }

      // Referinte LOCALE la elDiv/masuri, capturate ACUM — pana termina
      // cascada (cateva sute de ms - cateva secunde), quizul apeleaza aproape
      // sigur reseteaza() (nivelul urmator incepe imediat dupa), care pune
      // AMBELE variabile din closure pe null. urmatorulPas() (mai jos)
      // ruleaza async, dupa acel moment — daca ar citi `elDiv`/`masuri`
      // direct, ar pica (bug reprodus si prins cu Playwright, 31.08.2026, de
      // doua ori — o data pt. elDiv, o data pt. masuri). Folosim doar
      // `elDivOriginal`/`masuriOriginale` in tot restul functiei.
      const elDivOriginal = elDiv;
      const masuriOriginale = masuri;

      // Daca ultimul bv rezolvat inainte de spectacol a pornit un zbor de
      // discuri (grupul independent din zboaraGrupul, atasat direct la
      // document.body, nu la elDiv), el continua altfel sa anime singur spre
      // o destinatie veche cateva sute de ms dupa ce cosurile arata deja
      // complet (bug raportat de user, 31.08.2026: "animatia ultimului bond
      // se altereaza si nu se termina"). Nivelul e oricum complet aici — il
      // eliminam imediat, inainte sa continuam.
      if (grupZburatorCurent) {
        grupZburatorCurent.remove();
        grupZburatorCurent = null;
      }

      // Daca ultimul bv rezolvat inainte de spectacol a pornit un zbor de
      // discuri, unele discuri pot fi inca marcate "e-in-zbor" (invizibile,
      // asteptand sa aterizeze) — cleanup-ul normal (vezi arataBv) tinteste
      // doar elDiv, nu si clonele create mai jos, deci ele ar mosteni starea
      // ascunsa PERMANENT. Nivelul e oricum COMPLET aici, nu mai are sens sa
      // asteptam nicio aterizare — le facem vizibile explicit, chiar acum,
      // inainte sa clonam orice.
      elDivOriginal
        .querySelectorAll(".ilustrare-bonduri-disc.e-in-zbor")
        .forEach((el) => el.classList.remove("e-in-zbor"));

      // Bondul + pozitia FIECARUI rand — citite direct din randul viu (deja
      // randat cu cifrele si culorile corecte), nu preluate de la ultimul bv
      // rezolvat. Fiecare etaj din cascada trebuie sa arate PROPRIUL sau
      // numar de mere (cerere user, 31.08.2026: "numarul de mere e acelasi
      // pe fiecare linie, ar trebui sa corespunda bondului de pe linia
      // respectiva" — bug-ul initial clona literal continutul, in loc sa-l
      // rescrie pt. fiecare rand).
      const rParinte = containerEl.getBoundingClientRect();
      const dateRanduri = Array.from(randuriEl.children)
        .map((rand) => {
          const numere = rand.querySelectorAll(".inventar-bonduri-numar");
          if (numere.length < 2) return null;
          const rRand = rand.getBoundingClientRect();
          return {
            a: Number(numere[0].textContent),
            b: Number(numere[1].textContent),
            culoareA: numere[0].style.backgroundColor,
            culoareB: numere[1].style.backgroundColor,
            top: rRand.top - rParinte.top + rRand.height / 2,
            left: rRand.left - rParinte.left + masuriOriginale.latimeTextPlusGap,
          };
        })
        .filter(Boolean);
      if (!dateRanduri.length) {
        gataCallback?.();
        return { durataTotalaMs: 0 };
      }

      // Umple cosurile unui div de ilustratie (elDiv SAU un clon) cu bondul
      // unui anume rand — reutilizeaza umpleCos (functia comuna), care nu
      // presupune nimic despre a cui e cosEl. `ascunseA`/`ascunseB`, daca
      // date, marcheaza discurile nou-sosite ca invizibile pana aterizeaza
      // (vezi indiciSosire) — acelasi tipar ca la tranzitiile normale intre
      // bv-uri (arataBv).
      const aplicaBondPe = (elDivTinta, dateRand, ascunseA, ascunseB) => {
        const cosA = elDivTinta.children[1];
        const cosB = elDivTinta.children[3];
        if (cosA) umpleCos(cosA, dateRand.a, dateRand.culoareA, masuriOriginale.dimensiuneDiscPx, masuriOriginale.inaltimeNumar, ascunseA);
        if (cosB) umpleCos(cosB, dateRand.b, dateRand.culoareB, masuriOriginale.dimensiuneDiscPx, masuriOriginale.inaltimeNumar, ascunseB);
      };

      // Ilustratia LIVE urca la randul 1, cu bondul PROPRIU randului 1 (nu
      // cu ce arata acum, ramas de la ultimul bv rezolvat) — cu acelasi zbor
      // de discuri ca la pasii cascadei de mai jos, daca bondul chiar difera
      // (unitar cu tot restul spectacolului).
      const mutareInitiala = mereDeMutat({ vechi: ultimulBv, nou: dateRanduri[0] });
      let ascunseInitialeA = null;
      let ascunseInitialeB = null;
      if (mutareInitiala && mutareInitiala.count > 0) {
        const sursaInitiala = dreptunghiGrupSursa(mutareInitiala);
        const destinatieInitiala = destinatiaGrupului({
          pozitie: { top: dateRanduri[0].top, left: dateRanduri[0].left },
          parinteEl: containerEl,
          a: dateRanduri[0].a,
          b: dateRanduri[0].b,
          ...mutareInitiala,
          m: masuriOriginale,
        });
        if (sursaInitiala) {
          zboaraGrupul({
            count: mutareInitiala.count,
            sursa: sursaInitiala,
            destinatie: destinatieInitiala,
            discPx: masuriOriginale.dimensiuneDiscPx,
          });
          const ascunseInitiale = indiciSosire({ ...mutareInitiala, a: dateRanduri[0].a });
          if (mutareInitiala.directie === "a-spre-b") ascunseInitialeB = ascunseInitiale;
          else ascunseInitialeA = ascunseInitiale;
        }
      }
      aplicaBondPe(elDivOriginal, dateRanduri[0], ascunseInitialeA, ascunseInitialeB);
      marcheazaPlimbator(elDivOriginal);
      elDivOriginal.style.top = `${dateRanduri[0].top}px`;
      elDivOriginal.style.left = `${dateRanduri[0].left}px`;
      setTimeout(() => {
        elDivOriginal.querySelectorAll(".ilustrare-bonduri-disc.e-in-zbor").forEach((el) => el.classList.remove("e-in-zbor"));
        marcheazaFix(elDivOriginal);
      }, ms);

      let indexCurent = 0;
      // Elementul de la care porneste URMATOAREA clona — cel care tocmai a
      // ajuns la randul lui curent (elDivOriginal la inceput, apoi fiecare
      // clona pe rand). Ramane pe loc, neschimbat, dupa ce e clonat (cerere
      // user, 31.08.2026: "ilustratia veche ramane pe pozitia" ei). Bug
      // anterior: se clona mereu elDivOriginal, deci toate clonele porneau
      // din randul 1 in loc de randul precedent ("toate animatiile duplicat
      // pornesc de pe randul 1, nu de pe randul precedent").
      let elementCurent = elDivOriginal;

      const urmatorulPas = () => {
        if (indexCurent >= dateRanduri.length - 1) {
          setTimeout(() => gataCallback?.(), 500);
          return;
        }
        // Clona porneste EXACT peste elementCurent (acelasi rand, acelasi
        // bond — un duplicat perfect), apoi se deplaseaza SI ISI TRANSFORMA
        // continutul (latimea cosurilor) simultan spre randul urmator,
        // corespunzator bondului acelui rand (cerere user, 31.08.2026: "se
        // duplica pe randul 1. ilustratia noua porneste de pe randul 1 spre
        // randul 2 si se transforma ca sa corespunda lui 2+..."). Fara
        // tranzitie la creare, cu reflow fortat — acelasi tipar ca la prima
        // aparitie din nivel, ca sa nu "gliseze" gresit din pozitia gresita.
        // Curata orice "e-in-zbor" ramas pe elementCurent (garda defensiva —
        // acelasi motiv ca la elDivOriginal mai sus: daca timeout-ul de
        // aterizare al pasului precedent n-a apucat inca sa ruleze, clona
        // n-ar trebui sa mosteneasca discuri ascunse permanent).
        elementCurent.querySelectorAll(".ilustrare-bonduri-disc.e-in-zbor").forEach((el) => el.classList.remove("e-in-zbor"));

        const clona = elementCurent.cloneNode(true);
        const cosAClona = clona.children[1];
        const cosBClona = clona.children[3];
        clona.style.transition = "none";
        if (cosAClona) cosAClona.style.transition = "none";
        if (cosBClona) cosBClona.style.transition = "none";
        // Defensiv, ca la clona din arataBv: reseteaza treapta mostenita
        // prin cloneNode, inainte sa marcam explicit "plimbator" mai jos.
        marcheazaFix(clona);
        containerEl.appendChild(clona);
        void clona.offsetWidth;
        clona.style.transition = `top ${ms}ms ease, left ${ms}ms ease`;
        if (cosAClona) cosAClona.style.transition = `width ${ms}ms ease`;
        if (cosBClona) cosBClona.style.transition = `width ${ms}ms ease`;
        marcheazaPlimbator(clona);

        // Discurile care "se muta" intre cosuri de la un rand la altul —
        // acelasi calcul (mereDeMutat) si acelasi zbor (zboaraGrupul) ca la
        // tranzitiile normale intre bv-uri, ca sa fie "unitar": fara asta,
        // bila noua aparea direct in cos, fara nicio animatie de zbor, iar
        // largirea cosului incepea abia dupa (bug raportat de user,
        // 31.08.2026: "intaai cosul se umple direct cu bila suplimentara —
        // fara animatie de zbor, si abia apoi incepe sa se largeasca
        // cosul"). Masurate PE CLONA (cosAClona/cosBClona), inainte sa-i
        // rescriem continutul.
        const randActual = dateRanduri[indexCurent];
        const randTinta = dateRanduri[indexCurent + 1];
        const mutare = mereDeMutat({ vechi: randActual, nou: randTinta });
        let ascunseA = null;
        let ascunseB = null;
        if (mutare && mutare.count > 0) {
          const sursa = dreptunghiGrupSursa(mutare, { cosA: cosAClona, cosB: cosBClona });
          const destinatie = destinatiaGrupului({
            pozitie: { top: randTinta.top, left: randTinta.left },
            parinteEl: containerEl,
            a: randTinta.a,
            b: randTinta.b,
            ...mutare,
            m: masuriOriginale,
          });
          if (sursa) {
            zboaraGrupul({
              count: mutare.count,
              sursa,
              destinatie,
              discPx: masuriOriginale.dimensiuneDiscPx,
            });
            const ascunse = indiciSosire({ ...mutare, a: randTinta.a });
            if (mutare.directie === "a-spre-b") ascunseB = ascunse;
            else ascunseA = ascunse;
          }
        }

        indexCurent += 1;
        aplicaBondPe(clona, dateRanduri[indexCurent], ascunseA, ascunseB);
        clona.style.top = `${dateRanduri[indexCurent].top}px`;
        clona.style.left = `${dateRanduri[indexCurent].left}px`;
        cloneRamase.push({ el: clona, a: dateRanduri[indexCurent].a, b: dateRanduri[indexCurent].b });
        elementCurent = clona;

        // Discurile sosite devin vizibile exact cand aterizeaza grupul —
        // acelasi tipar ca in arataBv, dar tintind explicit CLONA acestui
        // pas (nu elDiv), ca sa nu repete bug-ul de cleanup-ul care rata
        // clonele (vezi comentariul de mai sus, la elDivOriginal).
        setTimeout(() => {
          clona.querySelectorAll(".ilustrare-bonduri-disc.e-in-zbor").forEach((el) => el.classList.remove("e-in-zbor"));
          marcheazaFix(clona);
        }, ms);

        setTimeout(urmatorulPas, ms);
      };

      setTimeout(urmatorulPas, ms);

      // O tranzitie de urcare la randul 1 + (N-1) pasi de cascada + pauza
      // finala de 0.5s — usor supraestimat (foloseste N, nu N-1, ca marja),
      // nu costa nimic sa astepte quizul putin mai mult decat strictul
      // necesar.
      const durataTotalaMs = dateRanduri.length * ms + 500;
      spectacolInCursPanaLa = Date.now() + durataTotalaMs;
      return { durataTotalaMs };
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
      // Zborul de discuri SAU spectacolul final (Spectacol 1) pot fi inca in
      // desfasurare — folosim termenul mai TARZIU dintre cele doua.
      const panaLa = Math.max(zborInCursPanaLa, spectacolInCursPanaLa);
      const ramas = panaLa - Date.now();
      const elDivDeCurata = elDiv;
      if (ramas > 0) {
        // Daca am sterge ACUM elDiv/clonele, animatia inca in desfasurare
        // (zbor de discuri sau cascada Spectacol 1) ar continua peste
        // tabelul deja golit/rescris al nivelului urmator (bug raportat de
        // user, 31.08.2026: "marul se plimba aiurea pe tabelul golit").
        // ATENTIE: `cloneRamase` NU se reasigneaza aici — cascada mai
        // poate impinge in ea clone noi pana se termina (vezi
        // joacaSpectacolFinal); reasignarea acum ar rupe legatura, iar
        // clonele create dupa acest moment n-ar mai fi curatate niciodata.
        // Instanta oricum a pornit deja o structura noua pt. urmatorul bv
        // (elDiv == null mai jos), deci n-are cum sa se amestece cu ea.
        setTimeout(() => {
          if (elDivDeCurata) elDivDeCurata.remove();
          cloneRamase.forEach(({ el }) => el.remove());
          cloneRamase = [];
        }, ramas);
      } else {
        if (elDivDeCurata) elDivDeCurata.remove();
        cloneRamase.forEach(({ el }) => el.remove());
        cloneRamase = [];
      }
      elDiv = null;
      elEgal = null;
      elCosA = null;
      elCosB = null;
      elSemn = null;
    }

    return { arataBv, reseteaza, joacaSpectacolFinal, reaplicaSetari };
  }

  global.IlustrareBonduri = {
    mereDeMutat,
    zboaraCifre,
    creeaza,
    getDurataTranzitieMs,
    setDurataTranzitieMs,
    getDiametruDiscPct,
    setDiametruDiscPct,
    getMarireFontPct,
    setMarireFontPct,
    getCuloareDisc,
    setCuloareDisc,
    getTraiectorieBile,
    setTraiectorieBile,
    getPaddingCosRem,
    setPaddingCosRem,
    getRandTargetLatimePct,
    setRandTargetLatimePct,
  };
})(window);
