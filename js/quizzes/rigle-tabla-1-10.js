/**
 * Quiz „Adunari cu coloane - Tabla adunarii 1-10" — clonă a „Adunari cu coloane
 * verticale" (`rigle-cl1.js`), pe același motor (`window.RigleEngine`), dar cu
 * generator de facte propriu: 10 niveluri, nivelul N = x+N, x=0-10 (11 ture/nivel,
 * INLOCUIESTE „Suma maxima" — decizie explicită, nu coexistă). Reintroducere peste
 * 2-3 ture la răspuns greșit, avans automat de nivel după 11 ture indiferent de
 * corectitudine. Chei `LayoutConfig` separate (prefix `rigleT110`), panou CP propriu.
 *
 * Corectitudinea per apăsare (numărul apăsării în tur, „turCorect" = doar prima
 * apăsare contează) vine din `window.Motor3Butoane` (M3B) — folosit AICI doar ca
 * bibliotecă pură de bookkeeping (esteCorect/laApasareButon), NU prin
 * `falling-engine.js`: Rigle rămâne motor separat (m2), își randează singur totul;
 * M3B doar ține evidența apăsărilor, ca peste tot în aplicație. Fiecare apăsare se
 * loghează direct în `window.JurnalIntrebari` (Rigle nu trece prin
 * `inregistreazaIntrebareDinMotor` din app.js, care depinde de `falling-engine.js`).
 *
 * Vezi `documente de referinta/RIGLE-REFERENCE.md` pentru arhitectura motorului.
 */
(function (global) {
  "use strict";

  const CONFIG_ETAPA1 = {
    obiect: "🍏",
    coloanaInitialaIndex: 1, // a doua coloană (mijloc); lățimile sunt aleatoare, deci
    // e un index, nu o lățime — vezi RigleFacte.
    vitezaCoborare: 34,
  };

  // CP — Grilă: persistă în LayoutConfig, ca celelalte bife simple din CP.
  const GRID_VERTICAL_KEY = "rigleT110GridVertical";
  const GRID_ORIZONTAL_KEY = "rigleT110GridOrizontal";
  const getGridVertical = () => global.LayoutConfig?.get(GRID_VERTICAL_KEY, true) !== false;
  const getGridOrizontal = () => global.LayoutConfig?.get(GRID_ORIZONTAL_KEY, false) === true;

  // CP — Poziție coloane: treime din spațiu (implicit) vs. proporțional (spațiu).
  const COL_TREIME_KEY = "rigleT110ColoaneTreime";
  const getColoaneTreime = () => global.LayoutConfig?.get(COL_TREIME_KEY, true) !== false;

  // CP — Numerotează rânduri din coloane: "dezactivat" | "toate" | "animat".
  const NUMEROTARE_KEY = "rigleT110Numerotare";
  const RANDURI_SUS_KEY = "rigleT110RanduriInSus";
  const RANDURI_JOS_KEY = "rigleT110RanduriInJos";
  const RANDURI_IMPLICIT = 10;
  const getNumerotare = () => global.LayoutConfig?.get(NUMEROTARE_KEY, "dezactivat") ?? "dezactivat";
  const getRanduriInSus = () => global.LayoutConfig?.get(RANDURI_SUS_KEY, RANDURI_IMPLICIT) ?? RANDURI_IMPLICIT;
  const getRanduriInJos = () => global.LayoutConfig?.get(RANDURI_JOS_KEY, RANDURI_IMPLICIT) ?? RANDURI_IMPLICIT;

  // CP — Bara cu mere: poziție față de numerotare (sub implicit/deasupra) + transparență.
  const MERE_SUB_NUMEROTARE_KEY = "rigleT110MereSubNumerotare";
  const MERE_TRANSPARENTA_KEY = "rigleT110MereTransparenta";
  const MERE_TRANSPARENTA_IMPLICIT = 50;
  const getMereSubNumerotare = () => global.LayoutConfig?.get(MERE_SUB_NUMEROTARE_KEY, true) !== false;
  const getMereTransparenta = () =>
    global.LayoutConfig?.get(MERE_TRANSPARENTA_KEY, MERE_TRANSPARENTA_IMPLICIT) ?? MERE_TRANSPARENTA_IMPLICIT;
  function seteazaMereTransparenta(valoare) {
    const v = Math.max(0, Math.min(100, Math.round(valoare)));
    global.LayoutConfig?.set(MERE_TRANSPARENTA_KEY, v);
  }
  function seteazaRanduriInSus(valoare) {
    const v = Math.max(1, Math.min(50, Math.round(valoare)));
    global.LayoutConfig?.set(RANDURI_SUS_KEY, v);
  }
  function seteazaRanduriInJos(valoare) {
    const v = Math.max(1, Math.min(50, Math.round(valoare)));
    global.LayoutConfig?.set(RANDURI_JOS_KEY, v);
  }

  // CP — Lift: transparență fundal alb + afișare margine.
  const LIFT_TRANSPARENTA_KEY = "rigleT110LiftTransparentaFundal";
  const LIFT_MARGINE_KEY = "rigleT110LiftMargine";
  const LIFT_TRANSPARENTA_IMPLICIT = 50;
  const getLiftTransparenta = () =>
    global.LayoutConfig?.get(LIFT_TRANSPARENTA_KEY, LIFT_TRANSPARENTA_IMPLICIT) ?? LIFT_TRANSPARENTA_IMPLICIT;
  const getLiftMargine = () => global.LayoutConfig?.get(LIFT_MARGINE_KEY, true) !== false;
  function seteazaLiftTransparenta(valoare) {
    const v = Math.max(0, Math.min(100, Math.round(valoare)));
    global.LayoutConfig?.set(LIFT_TRANSPARENTA_KEY, v);
  }

  // CP — Etichete (FOV Feedback Oranj Verde): pe buton / pe lift / animație pt. corect.
  const FOV_BUTON_KEY = "rigleT110FovButon";
  const FOV_LIFT_KEY = "rigleT110FovLift";
  const FOV_LIFT_CORECT_KEY = "rigleT110FovLiftAnimatieCorect";
  const FOV_LIFT_VITEZA_KEY = "rigleT110FovLiftDivizorViteza";
  const FOV_LIFT_VITEZA_IMPLICIT = 1; // 1 = viteza actuală, 10 = de 10x mai încet
  const getFovButon = () => global.LayoutConfig?.get(FOV_BUTON_KEY, true) !== false;
  const getFovLift = () => global.LayoutConfig?.get(FOV_LIFT_KEY, true) !== false;
  const getFovLiftCorect = () => global.LayoutConfig?.get(FOV_LIFT_CORECT_KEY, true) !== false;
  const getFovLiftViteza = () =>
    global.LayoutConfig?.get(FOV_LIFT_VITEZA_KEY, FOV_LIFT_VITEZA_IMPLICIT) ?? FOV_LIFT_VITEZA_IMPLICIT;

  // CP — Dara glorioasă: Lungime (0-10, cât de sus ajunge frontul de sus) / Desime
  // (0-100, cât de dese sunt dreptunghiurile — 100 = cadru lângă cadru).
  const DARA_LUNGIME_KEY = "rigleT110DaraLungime";
  const DARA_DESIME_KEY = "rigleT110DaraDesime";
  const DARA_LUNGIME_IMPLICIT = 10;
  const DARA_DESIME_IMPLICIT = 50;
  const getDaraLungime = () => global.LayoutConfig?.get(DARA_LUNGIME_KEY, DARA_LUNGIME_IMPLICIT) ?? DARA_LUNGIME_IMPLICIT;
  const getDaraDesime = () => global.LayoutConfig?.get(DARA_DESIME_KEY, DARA_DESIME_IMPLICIT) ?? DARA_DESIME_IMPLICIT;

  // CP — Culori: 5 elemente colorabile, aplicate live prin RigleEngine.setCuloriTema
  // (js/rigle/engine.js). Valorile implicite = schema aleasă de user prin CP, codificată
  // aici (23.08.2026) ca implicit pt. orice utilizator nou — nu doar cine a salvat-o în
  // propriul localStorage: Fundal bleumarin-închis, Coloane albastru, Valori butoane
  // alb-gri (neschimbat față de implicitul original), Grila verde-închis, Numere din
  // coloane galben. Grila/Numere din coloane sunt acum OPACE — nu mai moștenesc
  // transparența rgba() din engine.js (schimbare intenționată, nu regresie). O valoare
  // deja salvată în LayoutConfig (userul a personalizat din CP) rămâne prioritară față
  // de implicit — vezi getCuloareElement.
  const ELEMENTE_CULOARE = [
    { id: "fundal", eticheta: "Fundal", implicit: "#000040" },
    { id: "coloane", eticheta: "Coloane", implicit: "#0c1d94" },
    { id: "valoriButoane", eticheta: "Valori butoane", implicit: "#e8eef5" },
    { id: "grila", eticheta: "Grila", implicit: "#305506" },
    { id: "numereColoane", eticheta: "Numere din coloane", implicit: "#fdec73" },
  ];
  const culoareKey = (id) => `rigleT110Culoare_${id}`;
  const getCuloareElement = (id) => {
    const def = ELEMENTE_CULOARE.find((e) => e.id === id);
    return global.LayoutConfig?.get(culoareKey(id), def.implicit) ?? def.implicit;
  };
  const seteazaCuloareElement = (id, hex) => global.LayoutConfig?.set(culoareKey(id), hex);
  const toateCuloriTema = () => {
    const rezultat = {};
    ELEMENTE_CULOARE.forEach((def) => {
      rezultat[def.id] = getCuloareElement(def.id);
    });
    return rezultat;
  };

  // Doar pt. afișarea în input[type=color] (acceptă STRICT #rrggbb, fără alpha) —
  // culorile reale rămân rgba() oriunde altundeva (cfg, CSS custom properties,
  // scheme salvate). Folosește parserul de culori al browser-ului (setat pe un
  // element aruncat, citit înapoi normalizat), nu regex pe formatul rgba —
  // funcționează pt. orice sintaxă CSS validă, nu doar rgba().
  function cssColorToHex(culoare) {
    if (/^#[0-9a-fA-F]{6}$/.test(culoare)) return culoare;
    const proba = document.createElement("span");
    proba.style.color = culoare;
    document.body.appendChild(proba);
    const rgb = getComputedStyle(proba).color;
    proba.remove();
    const m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return "#000000";
    const hex = (n) => Number(n).toString(16).padStart(2, "0");
    return `#${hex(m[0])}${hex(m[1])}${hex(m[2])}`;
  }

  // CP — Culori — „Save Color": paletă personală de max. 10 culori favorite,
  // independentă de elemente/scheme — doar culori reținute pt. refolosire rapidă
  // (decizie explicită a userului: NU ține de „color scheme").
  const PALETA_CULORI_KEY = "rigleT110PaletaCuloriSalvate";
  const PALETA_CULORI_MAX = 10;
  const getPaletaCulori = () => {
    const raw = global.LayoutConfig?.get(PALETA_CULORI_KEY, []);
    return Array.isArray(raw) ? raw : [];
  };
  function salveazaInPaletaCulori(hex) {
    const paleta = getPaletaCulori();
    if (paleta.length >= PALETA_CULORI_MAX) return false; // plină — nu suprascrie, nu rotește
    paleta.push(hex);
    global.LayoutConfig?.set(PALETA_CULORI_KEY, paleta);
    return true;
  }

  // CP — Culori — „Save current color scheme": grupează toate culorile active
  // curent (ELEMENTE_CULOARE) sub un singur preset (id + o valoare per element),
  // afișat ca rând de pătrățele + See/Edit/Delete.
  const SCHEME_CULORI_KEY = "rigleT110SchemeCulori";
  const getSchemeCulori = () => {
    const raw = global.LayoutConfig?.get(SCHEME_CULORI_KEY, []);
    return Array.isArray(raw) ? raw : [];
  };
  function salveazaSchemaCuloriCurenta() {
    const schema = getSchemeCulori();
    schema.push(Object.assign({ id: Date.now() }, toateCuloriTema()));
    global.LayoutConfig?.set(SCHEME_CULORI_KEY, schema);
  }
  function stergeSchemaCulori(id) {
    global.LayoutConfig?.set(
      SCHEME_CULORI_KEY,
      getSchemeCulori().filter((s) => s.id !== id)
    );
  }

  global.QuizRegistry.register({
    id: "rigle-tabla-1-10",
    title: "Adunari cu coloane - Tabla adunarii 1-10",
    description: "Măsoară suma de obiecte cu rigle (coloane). Facte a+b=? variabile.",
    order: 99, // ultimul în meniu; nu devine quiz implicit
    create() {
      let mounted = null;

      // ── Niveluri: nivelul N = x+N, x=0-10 (11 ture/nivel). Stare în memorie, ca
      // la addition-table-range.js — NU persistă în LayoutConfig, resetează la
      // fiecare reselectare a quizului (nu doar la reload).
      const TURE_PER_NIVEL = 4; // deocamdată redus de la 11 (=x 0..10) — testare/reglaj ritm
      const NIVEL_MAX = 10;
      const REINTRODUCERE_MIN_TURE = 2;
      const REINTRODUCERE_MAX_TURE = 3;
      const FEREASTRA_INTRODUCERE = 4; // „cele mai mici 4 facts nelucrate"

      let nivelCurent = 1;
      let turIndexInNivel = 0; // câte facte s-au arătat deja la nivelul curent
      let xLucrateInNivel = new Set(); // x introduse măcar o dată la nivelul curent
      let coadaReintroducere = []; // [{ x, turePanaLaReintroducere }]
      let factCurent = null; // { x, nivel, suma, intrebare, latimiColoane }
      let factAfisatLa = 0; // Date.now() la afișarea factului curent

      // ── Flash „Felicitări! Next level!" la avans de nivel — text și stil
      // copiate de la addition-table-range.js (banner: "Felicitări! Next
      // level!") + CSS-ul lui .level-banner din style.css (fundal închis
      // translucid, text auriu, fade 250ms). Element PROPRIU, nu #level-banner
      // din #arena — Rigle îl ascunde la mount (RIGLE-REFERENCE §2), la fel ca
      // „PAUZĂ" (§9): duplicare intenționată, nu bug.
      const NIVEL_BANNER_STYLE_ID = "rigle-t110-nivel-banner-style";
      function injecteazaStilBanner() {
        if (document.getElementById(NIVEL_BANNER_STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = NIVEL_BANNER_STYLE_ID;
        style.textContent = `
.rigle-t110-nivel-banner {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 20, 25, 0.72);
  font-size: 1.5rem;
  font-weight: 700;
  color: #fbbf24;
  text-align: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}
.rigle-t110-nivel-banner.show {
  opacity: 1;
}
`;
        document.head.appendChild(style);
      }

      // CP „Culori" — stil injectat separat de bannerul de nivel (funcționalitate
      // independentă). Reutilizează limbajul vizual al .arena-quiz-action
      // (bordură #334155, fundal închis translucid) fără să depindă de acea clasă.
      const CULORI_STYLE_ID = "rigle-t110-culori-style";
      function injecteazaStilCulori() {
        if (document.getElementById(CULORI_STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = CULORI_STYLE_ID;
        style.textContent = `
.rigle-t110-culori-paleta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0.5rem 0;
}
.rigle-t110-culori-patrat {
  width: 1.7rem;
  height: 1.7rem;
  padding: 0;
  border: 1px solid #334155;
  border-radius: 6px;
  cursor: pointer;
}
.rigle-t110-culori-patrat:disabled {
  cursor: default;
  border-style: dashed;
  opacity: 0.5;
}
.rigle-t110-culori-btn {
  min-height: 1.9rem;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  background: rgba(15, 23, 42, 0.82);
  color: #e2e8f0;
  font-size: 0.72rem;
  cursor: pointer;
  margin: 0.2rem 0.35rem 0.2rem 0;
}
.rigle-t110-culori-btn:hover {
  border-color: var(--accent, #3d9cf5);
}
.rigle-t110-schema-rand {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 0.4rem;
  padding: 0.3rem;
  border: 1px solid #334155;
  border-radius: 6px;
}
.rigle-t110-schema-mini {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  flex-shrink: 0;
}
.rigle-t110-schema-goale {
  font-size: 0.78rem;
  color: var(--muted);
  margin: 0 0 0.5rem;
}
`;
        document.head.appendChild(style);
      }

      let bannerEl = null;
      function flashNivelBanner(text) {
        if (!bannerEl) return;
        bannerEl.textContent = text;
        requestAnimationFrame(() => bannerEl.classList.add("show"));
        setTimeout(() => bannerEl?.classList.remove("show"), 1600);
      }

      // „Joc finalizat." — reutilizează ACELAȘI element ca flash-ul de nivel, dar
      // FĂRĂ setTimeout de ascundere (rămâne afișat, nu e trecător). Motorul e
      // oprit dur (setOpritDefinitiv) — nu doar vizual, chiar nu mai acceptă
      // apăsări/taste. ascundeJocFinalizat() e apelată din seteazaNivelCurent()
      // (userul alege manual alt nivel → jocul repornește).
      let jocFinalizat = false;
      function aratajocFinalizat() {
        if (!bannerEl) return;
        bannerEl.textContent = "Joc finalizat.";
        bannerEl.classList.add("show");
      }
      function ascundeJocFinalizat() {
        bannerEl?.classList.remove("show");
      }

      function resetStareNivel() {
        turIndexInNivel = 0;
        xLucrateInNivel = new Set();
        coadaReintroducere = [];
      }

      function seteazaNivelCurent(valoare) {
        nivelCurent = Math.max(1, Math.min(NIVEL_MAX, Math.round(valoare)));
        resetStareNivel();
        if (jocFinalizat) {
          jocFinalizat = false;
          ascundeJocFinalizat();
          mounted?.setOpritDefinitiv(false);
        }
        mounted?.reporneste();
      }

      // Reintroducerile scadente au prioritate (FIFO); altfel, aleator din cele
      // mai mici 4 valori x încă nearătate la acest nivel.
      function alegeXUrmator() {
        coadaReintroducere.forEach((intrare) => {
          intrare.turePanaLaReintroducere -= 1;
        });
        const scadentIndex = coadaReintroducere.findIndex((intrare) => intrare.turePanaLaReintroducere <= 0);
        if (scadentIndex >= 0) {
          const [scadent] = coadaReintroducere.splice(scadentIndex, 1);
          return scadent.x;
        }
        const nelucrate = [];
        for (let x = 0; x <= 10; x++) {
          if (!xLucrateInNivel.has(x)) nelucrate.push(x);
        }
        // Apărare — nu ar trebui atins: TURE_PER_NIVEL garantează avans de nivel
        // înainte ca toate cele 11 valori să fie epuizate.
        if (nelucrate.length === 0) return Math.floor(Math.random() * 11);
        const fereastra = nelucrate.slice(0, FEREASTRA_INTRODUCERE);
        return fereastra[Math.floor(Math.random() * fereastra.length)];
      }

      function urmatorulFact() {
        turIndexInNivel += 1;
        if (turIndexInNivel > TURE_PER_NIVEL) {
          if (nivelCurent >= NIVEL_MAX) {
            // Ultimul nivel, ultima tură — jocul se oprește, nu mai wrap-uiește la 1.
            jocFinalizat = true;
            mounted?.setOpritDefinitiv(true);
            aratajocFinalizat();
            return null; // schimbaFact() nu rulează (engine.js: `if (fact) schimbaFact(fact)`) —
            // ultimul fact rămâne randat sub suprapunerea „Joc finalizat.".
          }
          nivelCurent += 1;
          turIndexInNivel = 1;
          xLucrateInNivel = new Set();
          coadaReintroducere = [];
          flashNivelBanner("Felicitări! Next level!");
        }
        const x = alegeXUrmator();
        xLucrateInNivel.add(x);
        const suma = x + nivelCurent;
        const { latimiColoane } = global.RigleFacte.alegeVariante(suma);
        factCurent = { x, nivel: nivelCurent, suma, intrebare: `${x}+${nivelCurent}=?`, latimiColoane };
        factAfisatLa = Date.now();
        motorRaspuns?.laAfisareaIntrebarii();
        return {
          intrebare: factCurent.intrebare,
          grupe: [
            { n: x, fundal: "rosu" },
            { n: nivelCurent, fundal: "albastru" },
          ],
          latimiColoane,
        };
      }

      // ── M3B ca bibliotecă pură de bookkeeping (esteCorect/numarApasare/turCorect),
      // NU pentru rutare/randare — Rigle își randează singur totul, prin motorul m2.
      // M3B NU pune numarApasare/turCorect direct pe rezultat — le pasează doar în
      // `context`-ul primit de actiuni.inainteDeApasare/dupaApasare (vezi
      // motor-3-butoane.js, campuriDinActiune) — de-aia le capturăm explicit în
      // dupaApasare și le întoarcem, ca să ajungă (prin `dupa`) în obiectul dat lui
      // construiesteVedere, pe care-l întoarcem neschimbat mai jos.
      const motorRaspuns = global.Motor3Butoane?.creeaza({
        esteCorect: (item) => item?.corect === true,
        intrebareUrmatoare: () => null, // neutilizat — vezi urmatorulFact() de mai sus
        actiuni: {
          dupaApasare: (context) => ({
            numarApasare: context.numarApasare,
            turCorect: context.turCorect,
          }),
        },
      });

      function dataOraBucuresti(data) {
        if (Number.isNaN(data.getTime())) return null;
        const parti = new Intl.DateTimeFormat("ro-RO", {
          timeZone: "Europe/Bucharest",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }).formatToParts(data);
        const valoare = (tip) => parti.find((parte) => parte.type === tip)?.value;
        return `${valoare("year")}-${valoare("month")}-${valoare("day")} ${valoare("hour")}:${valoare("minute")}:${valoare("second")}`;
      }

      // Apelat de engine la FIECARE apăsare de coloană (corectă sau nu) — vezi
      // cfg.onSelectColumn în js/rigle/engine.js, selectColumn(). Loghează în
      // JurnalIntrebari (Rigle nu trece prin falling-engine.js, deci nu prin
      // inregistreazaIntrebareDinMotor din app.js) și programează reintroducerea
      // dacă turul s-a încheiat cu prima apăsare greșită.
      function logheazaApasare({ idx, corect, latime }) {
        if (!motorRaspuns || !factCurent) return;
        const rezultat = motorRaspuns.laApasareButon({
          item: { corect },
          index: idx,
          construiesteVedere: (extra) => extra,
        });
        const ctx = rezultat.view;
        global.JurnalIntrebari?.inregistreazaIntrebare({
          data_ora_ro: dataOraBucuresti(new Date(factAfisatLa)),
          quiz_name: "Adunari cu coloane - Tabla adunarii 1-10",
          subquiz_name: null,
          intrebare: factCurent.intrebare,
          raspuns: String(latime),
          a_raspuns_corect: corect,
          a_cata_apasare_pe_buton: ctx.numarApasare,
          durata_raspuns_secunde: Math.round((Date.now() - factAfisatLa) / 100) / 10,
          fact: `${factCurent.x}+${factCurent.nivel}`,
          quiz_id: "rigle-tabla-1-10",
          subquiz_id: null,
          fact_id: `nivel${factCurent.nivel}-x${factCurent.x}`,
          eq_form: "a+b=?",
          pozitie_buton_apasat_pt_raspuns: idx + 1,
          valori_variante_de_raspuns: factCurent.latimiColoane.map((v) => String(v)),
          valoare_raspuns_corect: String(factCurent.suma),
          hints_aratate_pt_raspuns: null,
          extra: { nivel: factCurent.nivel, x: factCurent.x },
        });

        if (corect && !ctx.turCorect) {
          const tureIntarziere =
            REINTRODUCERE_MIN_TURE + Math.floor(Math.random() * (REINTRODUCERE_MAX_TURE - REINTRODUCERE_MIN_TURE + 1));
          coadaReintroducere.push({ x: factCurent.x, turePanaLaReintroducere: tureIntarziere });
        }
      }

      return {
        customEngine: true,
        // Ține motorul 1 (FallingEngine) în standby cât timp Rigle e activ.
        isCompleted: () => true,

        mountArena(hosts) {
          if (mounted) mounted.destroy();
          const cfg = Object.assign({}, CONFIG_ETAPA1, {
            gridVertical: getGridVertical(),
            gridOrizontal: getGridOrizontal(),
            pozitieTreime: getColoaneTreime(),
            numerotareRanduri: getNumerotare(),
            randuriInSus: getRanduriInSus(),
            randuriInJos: getRanduriInJos(),
            mereSubNumerotare: getMereSubNumerotare(),
            mereTransparenta: getMereTransparenta(),
            liftFundalTransparenta: getLiftTransparenta(),
            liftMargine: getLiftMargine(),
            fovButon: getFovButon(),
            fovLift: getFovLift(),
            fovLiftAnimatieCorect: getFovLiftCorect(),
            fovLiftDivizorViteza: getFovLiftViteza(),
            daraLungime: getDaraLungime(),
            daraDesime: getDaraDesime(),
            urmatorulFact,
            onSelectColumn: logheazaApasare,
          });
          mounted = global.RigleEngine.mount(hosts, cfg);
          mounted.setCuloriTema(toateCuloriTema());

          injecteazaStilBanner();
          if (!bannerEl) {
            bannerEl = document.createElement("div");
            bannerEl.className = "rigle-t110-nivel-banner";
          }
          hosts.arenaEl?.appendChild(bannerEl);
        },
        unmountArena() {
          if (mounted) mounted.destroy();
          mounted = null;
          bannerEl?.remove();
        },

        // CP — Tabla adunarii 1-10: Grilă (linii), Poziție coloane (treime/spațiu),
        // Numerotează rânduri, Bara cu mere (poziție/transparență), Lift, Etichete, Dara glorioasă.
        // Nivelul NU mai e aici — butoanele standard din „Alege quiz" → „Alegeti nivelul:".
        appendRigleTabla110ControlPanel(mount) {
          if (!mount) return;
          mount.replaceChildren();

          const title = document.createElement("p");
          title.className = "control-panel-lift-title";
          title.textContent = "Grila";
          mount.appendChild(title);

          const addRow = (labelText, checked, onChange) => {
            const row = document.createElement("label");
            row.className = "control-panel-lift-row";
            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = checked;
            input.addEventListener("change", () => onChange(input.checked));
            const span = document.createElement("span");
            span.textContent = labelText;
            row.append(input, span);
            mount.appendChild(row);
          };

          addRow("Vertical", getGridVertical(), (checked) => {
            global.LayoutConfig?.set(GRID_VERTICAL_KEY, checked);
            mounted?.setGridLines({ vertical: checked });
          });
          addRow("Orizontal", getGridOrizontal(), (checked) => {
            global.LayoutConfig?.set(GRID_ORIZONTAL_KEY, checked);
            mounted?.setGridLines({ orizontal: checked });
          });

          const posTitle = document.createElement("p");
          posTitle.className = "control-panel-lift-title";
          posTitle.textContent = "Poziție coloane";
          mount.appendChild(posTitle);

          const addRadioRow = (labelText, value, currentValue, groupName, onChange) => {
            const row = document.createElement("label");
            row.className = "control-panel-lift-row";
            const input = document.createElement("input");
            input.type = "radio";
            input.name = groupName;
            input.checked = value === currentValue;
            input.addEventListener("change", onChange);
            const span = document.createElement("span");
            span.textContent = labelText;
            row.append(input, span);
            mount.appendChild(row);
          };

          const treimeAcum = getColoaneTreime();
          addRadioRow("Fiecare coloană are o treime din spațiu", true, treimeAcum, "rigleT110-col-pozitie", () => {
            global.LayoutConfig?.set(COL_TREIME_KEY, true);
            mounted?.setColumnLayout({ treime: true });
          });
          addRadioRow("În funcție de spațiu", false, treimeAcum, "rigleT110-col-pozitie", () => {
            global.LayoutConfig?.set(COL_TREIME_KEY, false);
            mounted?.setColumnLayout({ treime: false });
          });

          const addStepper = (labelText, getValue, onApply, min, max, dupaAplicare) => {
            const field = document.createElement("div");
            field.className = "control-panel-lift-field pre-eq-stepper-field";
            const label = document.createElement("label");
            label.textContent = labelText;
            const controls = document.createElement("div");
            controls.className = "pre-eq-stepper";
            const minus = document.createElement("button");
            minus.type = "button";
            minus.textContent = "-";
            const input = document.createElement("input");
            input.type = "number";
            input.min = String(min);
            input.max = String(max);
            input.step = "1";
            input.value = String(getValue());
            const plus = document.createElement("button");
            plus.type = "button";
            plus.textContent = "+";

            const apply = (valoare) => {
              onApply(Number(valoare));
              input.value = String(getValue());
              dupaAplicare?.();
            };

            minus.addEventListener("click", () => apply(Number(input.value) - 1));
            plus.addEventListener("click", () => apply(Number(input.value) + 1));
            input.addEventListener("change", () => apply(input.value));

            controls.append(minus, input, plus);
            field.append(label, controls);
            mount.appendChild(field);
            return input;
          };

          const numTitle = document.createElement("p");
          numTitle.className = "control-panel-lift-title";
          numTitle.textContent = "Numerotează rânduri din coloane";
          mount.appendChild(numTitle);

          const numerotareAcum = getNumerotare();
          addRadioRow("Dezactivat", "dezactivat", numerotareAcum, "rigleT110-numerotare", () => {
            global.LayoutConfig?.set(NUMEROTARE_KEY, "dezactivat");
            mounted?.setNumerotareRanduri({ mod: "dezactivat" });
          });
          addRadioRow("Pe toate rândurile", "toate", numerotareAcum, "rigleT110-numerotare", () => {
            global.LayoutConfig?.set(NUMEROTARE_KEY, "toate");
            mounted?.setNumerotareRanduri({ mod: "toate" });
          });
          addRadioRow("Animat fade-in pe coloana curentă", "animat", numerotareAcum, "rigleT110-numerotare", () => {
            global.LayoutConfig?.set(NUMEROTARE_KEY, "animat");
            mounted?.setNumerotareRanduri({ mod: "animat" });
          });

          addStepper("Câte rânduri în sus", getRanduriInSus, seteazaRanduriInSus, 1, 50, () => {
            mounted?.setNumerotareRanduri({ randuriInSus: getRanduriInSus() });
          });
          addStepper("Câte rânduri în jos", getRanduriInJos, seteazaRanduriInJos, 1, 50, () => {
            mounted?.setNumerotareRanduri({ randuriInJos: getRanduriInJos() });
          });

          const merePozTitle = document.createElement("p");
          merePozTitle.className = "control-panel-lift-title";
          merePozTitle.textContent = "Bara cu mere";
          mount.appendChild(merePozTitle);

          const mereSubAcum = getMereSubNumerotare();
          addRadioRow("Sub numerotarea rândurilor", true, mereSubAcum, "rigleT110-mere-pozitie", () => {
            global.LayoutConfig?.set(MERE_SUB_NUMEROTARE_KEY, true);
            mounted?.setPozitieMere({ subNumerotare: true });
          });
          addRadioRow("Deasupra numerotării rândurilor", false, mereSubAcum, "rigleT110-mere-pozitie", () => {
            global.LayoutConfig?.set(MERE_SUB_NUMEROTARE_KEY, false);
            mounted?.setPozitieMere({ subNumerotare: false });
          });
          addStepper("Transparență bară mere", getMereTransparenta, seteazaMereTransparenta, 0, 100, () => {
            mounted?.setPozitieMere({ transparenta: getMereTransparenta() });
          });

          const liftTitle = document.createElement("p");
          liftTitle.className = "control-panel-lift-title";
          liftTitle.textContent = "Lift";
          mount.appendChild(liftTitle);

          addStepper("Transparență fundal alb lift", getLiftTransparenta, seteazaLiftTransparenta, 0, 100, () => {
            mounted?.setLift({ transparentaFundal: getLiftTransparenta() });
          });
          addRow("Afișează marginea liftului", getLiftMargine(), (checked) => {
            global.LayoutConfig?.set(LIFT_MARGINE_KEY, checked);
            mounted?.setLift({ margine: checked });
          });

          const fovTitle = document.createElement("p");
          fovTitle.className = "control-panel-lift-title";
          fovTitle.textContent = "Etichete (FOV Feedback Oranj Verde)";
          mount.appendChild(fovTitle);

          addRow("Pe buton", getFovButon(), (checked) => {
            global.LayoutConfig?.set(FOV_BUTON_KEY, checked);
            mounted?.setFov({ buton: checked });
          });
          addRow("Pe lift", getFovLift(), (checked) => {
            global.LayoutConfig?.set(FOV_LIFT_KEY, checked);
            mounted?.setFov({ lift: checked });
          });
          addRow("Cu animație pt. corect", getFovLiftCorect(), (checked) => {
            global.LayoutConfig?.set(FOV_LIFT_CORECT_KEY, checked);
            mounted?.setFov({ animatieCorect: checked });
          });

          const vitezaRow = document.createElement("div");
          vitezaRow.className = "control-panel-lift-field";
          const vitezaLabel = document.createElement("label");
          vitezaLabel.textContent = "Viteza pătrățelului";
          const vitezaSlider = document.createElement("input");
          vitezaSlider.type = "range";
          vitezaSlider.min = "1";
          vitezaSlider.max = "10";
          vitezaSlider.step = "1";
          vitezaSlider.value = String(getFovLiftViteza());
          const vitezaOut = document.createElement("span");
          vitezaOut.className = "control-panel-lift-slider-out";
          const descrieViteza = (v) => (Number(v) <= 1 ? "viteza actuală" : `de ${v}× mai încet`);
          vitezaOut.textContent = descrieViteza(vitezaSlider.value);
          vitezaSlider.addEventListener("input", () => {
            const v = Number(vitezaSlider.value);
            global.LayoutConfig?.set(FOV_LIFT_VITEZA_KEY, v);
            vitezaOut.textContent = descrieViteza(v);
            mounted?.setFov({ divizorViteza: v });
          });
          vitezaRow.append(vitezaLabel, vitezaSlider, vitezaOut);
          mount.appendChild(vitezaRow);

          const daraTitle = document.createElement("p");
          daraTitle.className = "control-panel-lift-title";
          daraTitle.textContent = "Dara glorioasă";
          mount.appendChild(daraTitle);

          const lungimeRow = document.createElement("div");
          lungimeRow.className = "control-panel-lift-field";
          const lungimeLabel = document.createElement("label");
          lungimeLabel.textContent = "Lungime dara";
          const lungimeSlider = document.createElement("input");
          lungimeSlider.type = "range";
          lungimeSlider.min = "0";
          lungimeSlider.max = "10";
          lungimeSlider.step = "1";
          lungimeSlider.value = String(getDaraLungime());
          const lungimeOut = document.createElement("span");
          lungimeOut.className = "control-panel-lift-slider-out";
          lungimeOut.textContent = lungimeSlider.value;
          lungimeSlider.addEventListener("input", () => {
            const v = Number(lungimeSlider.value);
            global.LayoutConfig?.set(DARA_LUNGIME_KEY, v);
            lungimeOut.textContent = String(v);
            mounted?.setDaraGlorioasa({ lungime: v });
          });
          lungimeRow.append(lungimeLabel, lungimeSlider, lungimeOut);
          mount.appendChild(lungimeRow);

          const desimeRow = document.createElement("div");
          desimeRow.className = "control-panel-lift-field";
          const desimeLabel = document.createElement("label");
          desimeLabel.textContent = "Desime dara";
          const desimeSlider = document.createElement("input");
          desimeSlider.type = "range";
          desimeSlider.min = "0";
          desimeSlider.max = "100";
          desimeSlider.step = "1";
          desimeSlider.value = String(getDaraDesime());
          const desimeOut = document.createElement("span");
          desimeOut.className = "control-panel-lift-slider-out";
          desimeOut.textContent = desimeSlider.value;
          desimeSlider.addEventListener("input", () => {
            const v = Number(desimeSlider.value);
            global.LayoutConfig?.set(DARA_DESIME_KEY, v);
            desimeOut.textContent = String(v);
            mounted?.setDaraGlorioasa({ desime: v });
          });
          desimeRow.append(desimeLabel, desimeSlider, desimeOut);
          mount.appendChild(desimeRow);

          // ── Culori: „Element:" (radio) + color picker live + paletă personală
          // (Save Color, max. 10 sloturi) + scheme salvate (Save current color
          // scheme → rând de 3 pătrățele + See/Edit/Delete). Doar aici — NU se
          // adaugă la rigle-cl1.js (decizie explicită, ca la niveluri).
          injecteazaStilCulori();

          const culoriTitle = document.createElement("p");
          culoriTitle.className = "control-panel-lift-title";
          culoriTitle.textContent = "Culori";
          mount.appendChild(culoriTitle);

          const elementLabel = document.createElement("p");
          elementLabel.className = "control-panel-lift-field";
          elementLabel.textContent = "Element:";
          mount.appendChild(elementLabel);

          let elementSelectat = ELEMENTE_CULOARE[0].id;
          ELEMENTE_CULOARE.forEach((def) => {
            addRadioRow(def.eticheta, def.id, elementSelectat, "rigleT110-culori-element", () => {
              elementSelectat = def.id;
              colorInput.value = cssColorToHex(getCuloareElement(elementSelectat));
            });
          });

          const colorInput = document.createElement("input");
          colorInput.type = "color";
          colorInput.value = cssColorToHex(getCuloareElement(elementSelectat));
          colorInput.style.display = "block";
          colorInput.style.margin = "0.3rem 0 0.6rem";
          colorInput.addEventListener("input", () => {
            seteazaCuloareElement(elementSelectat, colorInput.value);
            mounted?.setCuloriTema({ [elementSelectat]: colorInput.value });
          });
          mount.appendChild(colorInput);

          const salveazaCuloareBtn = document.createElement("button");
          salveazaCuloareBtn.type = "button";
          salveazaCuloareBtn.className = "rigle-t110-culori-btn";
          salveazaCuloareBtn.textContent = "Save Color";
          mount.appendChild(salveazaCuloareBtn);

          const paletaEl = document.createElement("div");
          paletaEl.className = "rigle-t110-culori-paleta";
          mount.appendChild(paletaEl);

          function randeazaPaleta() {
            paletaEl.replaceChildren();
            const paleta = getPaletaCulori();
            for (let i = 0; i < PALETA_CULORI_MAX; i++) {
              const hex = paleta[i];
              const patrat = document.createElement("button");
              patrat.type = "button";
              patrat.className = "rigle-t110-culori-patrat";
              patrat.style.background = hex || "#ffffff";
              patrat.disabled = !hex;
              patrat.title = hex || "Slot liber";
              if (hex) {
                patrat.addEventListener("click", () => {
                  colorInput.value = hex;
                  seteazaCuloareElement(elementSelectat, hex);
                  mounted?.setCuloriTema({ [elementSelectat]: hex });
                });
              }
              paletaEl.appendChild(patrat);
            }
          }
          randeazaPaleta();

          salveazaCuloareBtn.addEventListener("click", () => {
            salveazaInPaletaCulori(colorInput.value);
            randeazaPaleta();
          });

          const salveazaSchemaBtn = document.createElement("button");
          salveazaSchemaBtn.type = "button";
          salveazaSchemaBtn.className = "rigle-t110-culori-btn";
          salveazaSchemaBtn.textContent = "Save current color scheme";
          mount.appendChild(salveazaSchemaBtn);

          const schemeTitle = document.createElement("p");
          schemeTitle.className = "control-panel-lift-title";
          schemeTitle.textContent = "Scheme salvate";
          mount.appendChild(schemeTitle);

          const schemeListEl = document.createElement("div");
          mount.appendChild(schemeListEl);

          function aplicaSchema(intrare) {
            // Guard pt. scheme salvate înainte de „Grila"/„Numere din coloane" (doar 3
            // câmpuri) — nu suprascrie cu undefined (LayoutConfig.set(cheie, undefined)
            // ar ȘTERGE cheia, vezi JSON.stringify) elementele lipsă din presetul vechi.
            const tema = {};
            ELEMENTE_CULOARE.forEach((def) => {
              if (typeof intrare[def.id] !== "string") return;
              seteazaCuloareElement(def.id, intrare[def.id]);
              tema[def.id] = intrare[def.id];
            });
            mounted?.setCuloriTema(tema);
            colorInput.value = cssColorToHex(getCuloareElement(elementSelectat));
          }

          function randeazaScheme() {
            schemeListEl.replaceChildren();
            const scheme = getSchemeCulori();
            if (scheme.length === 0) {
              const gol = document.createElement("p");
              gol.className = "rigle-t110-schema-goale";
              gol.textContent = "Nicio schemă salvată încă.";
              schemeListEl.appendChild(gol);
              return;
            }
            scheme.forEach((intrare) => {
              const rand = document.createElement("div");
              rand.className = "rigle-t110-schema-rand";
              ELEMENTE_CULOARE.forEach((def) => {
                const hex = intrare[def.id];
                if (typeof hex !== "string") return; // preset vechi, salvat înainte de acest element
                const mini = document.createElement("span");
                mini.className = "rigle-t110-schema-mini";
                mini.style.background = hex;
                mini.title = def.eticheta;
                rand.appendChild(mini);
              });

              const seeBtn = document.createElement("button");
              seeBtn.type = "button";
              seeBtn.className = "rigle-t110-culori-btn";
              seeBtn.textContent = "See";
              seeBtn.addEventListener("click", () => aplicaSchema(intrare));

              const editBtn = document.createElement("button");
              editBtn.type = "button";
              editBtn.className = "rigle-t110-culori-btn";
              editBtn.textContent = "Edit";
              editBtn.addEventListener("click", () => aplicaSchema(intrare));

              const deleteBtn = document.createElement("button");
              deleteBtn.type = "button";
              deleteBtn.className = "rigle-t110-culori-btn";
              deleteBtn.textContent = "Delete";
              deleteBtn.addEventListener("click", () => {
                stergeSchemaCulori(intrare.id);
                randeazaScheme();
              });

              rand.append(seeBtn, editBtn, deleteBtn);
              schemeListEl.appendChild(rand);
            });
          }
          randeazaScheme();

          salveazaSchemaBtn.addEventListener("click", () => {
            salveazaSchemaCuloriCurenta();
            randeazaScheme();
          });
        },

        // Niveluri reale — butoanele standard din „Alege quiz" → „Alegeti nivelul:"
        // (app.js: buildLevelPicker, guardat să nu sară peste quiz-urile customEngine
        // care AU niveluri reale — vezi getMaxLevel()>1). pickNextRound/beginRound
        // rămân stub-uri: nu au sens pentru Rigle (nu trece prin engine.startRound —
        // app.js gardează și acel apel pt. customEngine, vezi createLevelButton).
        getLevel: () => nivelCurent,
        getMinLevel: () => 1,
        getMaxLevel: () => NIVEL_MAX,
        getLevelLabel: () => (jocFinalizat ? "Joc finalizat." : `Nivel ${nivelCurent}`),
        getLevelButtonTitle: (lv) => `Nivel ${lv}`,
        switchLevel(lv) {
          seteazaNivelCurent(lv);
          return "";
        },
        pickNextRound: () => null,
        beginRound: () => ({}),
        onAnswer() {},
        onTimeout() {},
      };
    },
  });
})(window);
