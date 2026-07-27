/**
 * Motor 2 (m2) — „Cl. 1 - Rigle". Motor complet separat de motorul 1 (FallingEngine):
 * scenă proprie + butoane proprii. Când m2 e activ, shell-ul m1 din arenă e suprimat
 * (scenă, slot butoane, bară fixă) — m1 nu există aici.
 *
 * Sursa curentă de adevăr pentru arhitectură/contract e
 * `documente de referinta/RIGLE-REFERENCE.md` — actualizeaz-o la orice schimbare aici.
 * `js/rigle/SPEC-etapa1.md` e istoric (etapa 1, doar mișcarea).
 *
 *   RigleEngine.mount({ arenaEl, optionsEl }, config?)
 *     → { destroy, setGridLines, setColumnLayout, reporneste, setNumerotareRanduri, setLift }
 *
 * `arenaEl` = #arena (scena m2). `optionsEl` = #options (slotul m1, doar ca reper
 * pentru stratul de butoane = părintele lui) — NU e reutilizat, doar suprimat.
 */
(function (global) {
  "use strict";

  const STYLE_ID = "rigle-styles";

  const CSS = `
.rigle-scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  --cell: 32px;
  font-family: system-ui, sans-serif;
  background: #fbfbf3;
}
/* Suprapunere „PAUZĂ" — propria copie a lui .game.is-paused .div-strat-anunturi::after
   din style.css, fiindcă acel element e unul dintre copiii #arena pe care Rigle îi
   ascunde. Duplicare intenționată, nu bug — vezi setPauza() în JS. */
.game.rigle-active.is-paused .rigle-scene::after {
  content: "PAUZĂ";
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 1.5rem;
  font-weight: 700;
  pointer-events: none;
}
.rigle-columns {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
.rigle-col {
  position: absolute;
  background: #ffe14d;
  border: 1px solid #e6c02a;
  border-radius: 6px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.06);
}
.rigle-lift {
  position: absolute;
  z-index: 2;
  box-sizing: border-box;
  background: #ffffff;
  border: 2px solid #3a4a63;
  border-radius: 8px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
}
.rigle-lift--ready {
  transition: left 0.35s ease;
}
.rigle-lift-q {
  font-weight: 800;
  font-size: 19px; /* fix, nu urmărește --cell — nu se micșorează la sume mari */
  white-space: nowrap;
  color: #1f2a3a;
  line-height: 1;
}
.rigle-lift-row {
  display: flex;
}
/* „Prea puțin"/„prea mult" — dreptunghi portocaliu clipitor, copil al .rigle-lift,
   poziționat analitic (nu măsurat) relativ la colțul liftului — vezi
   actualizeazaMismatch() în JS. Ascuns implicit (display none), afișat doar când
   lățimea coloanei ≠ totalMere. */
.rigle-lift-mismatch {
  position: absolute;
  display: none;
  background: #ff9800;
  border-radius: 4px;
  animation: rigle-blink 0.6s ease-in-out infinite;
  pointer-events: none;
}
@keyframes rigle-blink {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.rigle-apple {
  position: relative;
  width: var(--cell);
  height: var(--cell);
  display: grid;
  place-items: center;
  box-sizing: border-box;
}
.rigle-apple--rosu {
  background: #e23b3b;
}
.rigle-apple--albastru {
  background: #2f6fe0;
}
/* Halou neutru: disc deschis exact în spatele mărului, ca legibilitatea să nu
   depindă de culoarea fundalului (roșu/albastru sau altele, care se vor schimba). */
.rigle-apple::before {
  content: "";
  position: absolute;
  inset: 12%;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(248, 248, 244, 0.96) 55%,
    rgba(248, 248, 244, 0) 74%
  );
}
.rigle-apple-emoji {
  position: relative;
  z-index: 1;
  font-size: calc(var(--cell) * 0.74);
  line-height: 1;
}
/* Grila de caiet = DOAR linii, strat de sus peste tot (paper, coloane, lift).
   background-image e setat din JS (applyGridLines), în funcție de vertical/orizontal. */
.rigle-grid {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}
/* Numerotarea rândurilor (CP „Numerotează rânduri din coloane") — peste coloane,
   sub lift. Un .rigle-row per linie de grilă dintr-o coloană, cu 1..lățime cifre
   înăuntru; opacity/color se scriu pe .rigle-row (nu pe fiecare cifră), ca
   actualizarea din modul animat să fie ieftină. */
.rigle-row-numbers {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
.rigle-row {
  position: absolute;
  display: flex;
  box-sizing: border-box;
}
.rigle-row-cell {
  flex: 1 0 0;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: calc(var(--cell) * 0.5);
  line-height: 1;
  color: inherit;
}
/* Butoanele m2 — look-ul copiat din motorul 1, dar complet self-contained
   (clasă proprie, valori hardcodate; nu depinde de .option / #options). */
/* Butoanele m2: fiecare are lățimea coloanei lui și stă exact peste ea
   (left/width setate din JS); poziționate absolut în bara de jos. */
.rigle-buttons {
  margin-top: auto;
  position: relative;
  width: 100%;
  height: clamp(126px, 25dvh, 252px);
  box-sizing: border-box;
  pointer-events: none;
}
.rigle-btn {
  pointer-events: auto;
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.7rem 0.4rem;
  border: 2px solid rgba(61, 156, 245, 0.55);
  border-radius: 10px;
  background: rgba(20, 28, 40, 0.16); /* mai transparent cu 60% fata de 0.4 */
  color: #e8eef5;
  cursor: pointer;
  box-sizing: border-box;
  font: inherit;
}
.rigle-btn:hover {
  border-color: #3d9cf5;
}
.rigle-btn-num {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}
/* Butoanele de sus (≡/CP/⏸) — fundal semitransparent cât e m2 activ, ca scrisul
   să se vadă peste coloanele galbene. Scoped pe m2: nu atinge motorul 1. */
.rigle-active .butoane-sus .menu-toggle,
.rigle-active .butoane-sus .cp-toggle,
.rigle-active .butoane-sus .play-pause {
  background: rgba(20, 28, 40, 0.55);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}
`;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const DEFAULTS = {
    // intrebare/grupe/latimiColoane: folosite doar dacă NU se dă `urmatorulFact`
    // (fallback pentru un mount fără generator — vezi factInitial mai jos).
    intrebare: "2+1=?",
    grupe: [
      { n: 2, fundal: "rosu" },
      { n: 1, fundal: "albastru" },
    ],
    obiect: "🍏",
    latimiColoane: [2, 3, 4],
    coloanaInitialaIndex: 1, // index-ul coloanei pe care pornește liftul (nu lățimea ei)
    vitezaCoborare: 34, // px/s (mică — copii de clasa 1)
    gridVertical: true, // linii verticale (implicit engine; quizul rezolvă din CP)
    gridOrizontal: true, // linii orizontale
    pozitieTreime: true, // true = fiecare coloană o treime din spațiu; false = proporțional
    urmatorulFact: null, // () => fact | null. null ⇒ factul nu se schimbă la wrap.
    numerotareRanduri: "dezactivat", // "dezactivat" | "toate" | "animat"
    randuriInSus: 10, // modul "animat": câte rânduri deasupra liftului rămân vizibile
    randuriInJos: 10, // modul "animat": câte rânduri sub lift rămân vizibile
    liftFundalTransparenta: 50, // 0 = alb opac, 100 = complet transparent
    liftMargine: true, // false = marginea liftului devine transparentă (nu dispare din layout)
  };

  const GRID_LINE = "rgba(70, 120, 190, 0.28) 1px, transparent 1px";
  const NUMEROTARE_CULOARE_STATICA = "rgba(70, 120, 190, 0.65)"; // modul "toate rândurile"
  const NUMEROTARE_HUE_APROAPE = 205; // albastru, la rândul liftului
  const NUMEROTARE_HUE_DEPARTE = 320; // roz-magenta, la marginea ferestrei (modul "animat")

  function mount(hosts, config) {
    const arenaEl = hosts && hosts.arenaEl;
    const optionsEl = hosts && hosts.optionsEl;
    if (!arenaEl || !optionsEl) {
      throw new Error("RigleEngine.mount: lipsesc arenaEl / optionsEl");
    }
    const gameEl = (hosts && hosts.gameEl) || document.getElementById("game");
    const cfg = Object.assign({}, DEFAULTS, config || {});
    injectStyles();
    if (gameEl) gameEl.classList.add("rigle-active");

    let totalMere = cfg.grupe.reduce((sum, g) => sum + g.n, 0); // recalculat la fiecare fact
    const butoaneLayer = optionsEl.parentElement; // #div-strat-butoane

    // ── Suprimă shell-ul m1 din arenă (scenă + slot butoane + bară fixă). ──
    // m1 nu există cât timp m2 e activ; restaurăm exact la destroy.
    const restoreList = [];
    const hideEl = (el) => {
      if (!el) return;
      restoreList.push({ el, prev: el.style.display });
      el.style.display = "none";
    };
    [...arenaEl.children].forEach(hideEl);
    hideEl(optionsEl);
    hideEl(document.getElementById("lift-fixed-host"));

    // ── Scena m2: structura fixă se creează o dată aici (paper → coloane → lift →
    // grilă). Conținutul variabil (întrebare, mere, lățimi coloane, butoane) vine
    // din randeazaFact(), apelată la mount și la fiecare fact nou. ──
    const scene = document.createElement("div");
    scene.className = "rigle-scene";

    const columnsWrap = document.createElement("div");
    columnsWrap.className = "rigle-columns";

    const rowNumbersWrap = document.createElement("div");
    rowNumbersWrap.className = "rigle-row-numbers";

    const lift = document.createElement("div");
    lift.className = "rigle-lift";
    const qEl = document.createElement("div");
    qEl.className = "rigle-lift-q";
    const rowEl = document.createElement("div");
    rowEl.className = "rigle-lift-row";
    const mismatchEl = document.createElement("div");
    mismatchEl.className = "rigle-lift-mismatch";
    lift.append(qEl, rowEl, mismatchEl);

    const gridEl = document.createElement("div");
    gridEl.className = "rigle-grid";

    scene.append(columnsWrap, rowNumbersWrap, lift, gridEl);
    arenaEl.appendChild(scene);

    // ── Bara de butoane proprie a m2, în stratul de butoane (peste scenă). ──
    const buttonsBar = document.createElement("div");
    buttonsBar.className = "rigle-buttons";
    butoaneLayer.appendChild(buttonsBar);

    // ── Geometrie + stare ──
    let cell = 32;
    let colX = [];
    let mismatchMinH = 0; // prag minim înălțime pt. bara portocalie „coloană mai îngustă" — vezi computeGeometry()
    let travel = 1;
    let colEls = [];
    let myButtons = [];
    let rowEls = []; // rowEls[coloană][rând] = elementul .rigle-row (numerotare)
    let paused = false;
    const playPauseBtn = document.getElementById("play-pause");
    let colIndex = cfg.coloanaInitialaIndex;
    if (colIndex < 0 || colIndex >= cfg.latimiColoane.length) {
      colIndex = Math.floor(cfg.latimiColoane.length / 2);
    }
    let y = 0; // 0..travel (top-ul liftului, de la marginea de sus a arenei)

    // Randare completă a conținutului variabil dintr-un fact (UI = f(state), fără
    // update parțial): întrebarea, rândul de mere, coloanele, butoanele, apoi
    // geometria. Ordinea contează — computeGeometry() citește lift.offsetHeight,
    // deci conținutul liftului trebuie deja în DOM.
    function randeazaFact(fact) {
      cfg.intrebare = fact.intrebare;
      cfg.grupe = fact.grupe;
      cfg.latimiColoane = fact.latimiColoane;
      totalMere = cfg.grupe.reduce((sum, g) => sum + g.n, 0);

      // 1. întrebarea
      qEl.textContent = cfg.intrebare;

      // 2. rândul de mere
      rowEl.replaceChildren();
      cfg.grupe.forEach((g) => {
        for (let i = 0; i < g.n; i++) {
          const cellEl = document.createElement("div");
          cellEl.className = `rigle-apple rigle-apple--${g.fundal}`;
          const emoji = document.createElement("span");
          emoji.className = "rigle-apple-emoji";
          emoji.textContent = cfg.obiect;
          cellEl.appendChild(emoji);
          rowEl.appendChild(cellEl);
        }
      });

      // 3. coloanele
      columnsWrap.replaceChildren();
      colEls = cfg.latimiColoane.map((w) => {
        const col = document.createElement("div");
        col.className = "rigle-col";
        col.dataset.w = String(w);
        columnsWrap.appendChild(col);
        return col;
      });

      // 4. butoanele — lățimea + poziția reală vin din computeGeometry() (pasul 5).
      buttonsBar.replaceChildren();
      myButtons = cfg.latimiColoane.map((w, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "rigle-btn";
        const num = document.createElement("span");
        num.className = "rigle-btn-num";
        num.textContent = String(w);
        btn.appendChild(num);
        btn.addEventListener("click", () => selectColumn(idx));
        buttonsBar.appendChild(btn);
        return btn;
      });

      if (colIndex >= colEls.length) colIndex = Math.floor(colEls.length / 2);

      // 5. geometria
      computeGeometry();
    }

    function computeGeometry() {
      const arenaRect = arenaEl.getBoundingClientRect();
      const W = arenaRect.width || 360;
      const H = arenaRect.height || 720;
      // Coloanele și traseul liftului merg de la marginea de sus la cea de jos a
      // #arena (curg pe sub bara de sus și pe sub butoane).
      let margin = 0;

      if (cfg.pozitieTreime) {
        // Fiecare coloană = 1/N din lățimea arenei. `cellsPerThird` = nr. de celule
        // cât să încapă mereu, în orice treime, ȘI coloana ei ȘI liftul (bloc rigid,
        // poate fi mai lat decât coloana îngustă pe care stă parcat — „prea mult"
        // vizual din SPEC). `cell` derivă din asta, deci colX cade mereu pe multipli
        // exacți de `cell` — marginile coloanei coincid cu liniile grilei.
        const n = cfg.latimiColoane.length;
        const thirdW = W / n;
        const cellsPerThird = Math.max(Math.max(...cfg.latimiColoane), totalMere);
        cell = Math.max(1, Math.floor(thirdW / cellsPerThird));
        colX = cfg.latimiColoane.map((_, i) => i * cellsPerThird * cell);
      } else {
        const sumW = cfg.latimiColoane.reduce((s, w) => s + w, 0);
        const nGaps = Math.max(0, cfg.latimiColoane.length - 1);
        cell = Math.max(1, Math.floor(W / (sumW + nGaps + 1)));
        const gap = cell;
        const used = sumW * cell + nGaps * gap;
        margin = Math.max(0, Math.round((W - used) / 2));

        colX = [];
        let x = margin;
        cfg.latimiColoane.forEach((w) => {
          colX.push(x);
          x += w * cell + gap;
        });
      }

      // Prag minim pt. bara „coloană mai îngustă" din actualizeazaMismatch(): la sume
      // mari `cell` poate ajunge la 1-3px (vezi RIGLE-REFERENCE §5) și bara devine
      // practic invizibilă. Pragul = cât ar fi lățimea unei celule „în treime" la suma
      // de referință 5, aceeași pe pc și pe telefon — se adaptează singur la lățimea
      // arenei curente (mai mare pe ecran lat, mai mic pe telefon), fără prag separat.
      const SUMA_REFERINTA_MIN_H = 5;
      mismatchMinH = Math.max(1, Math.floor(W / cfg.latimiColoane.length / SUMA_REFERINTA_MIN_H));

      scene.style.setProperty("--cell", `${cell}px`);
      gridEl.style.backgroundSize = `${cell}px ${cell}px`;
      gridEl.style.backgroundPosition = `${margin}px 0px`;
      applyGridLines();

      colEls.forEach((el, i) => {
        el.style.left = `${colX[i]}px`;
        el.style.top = "0px";
        el.style.width = `${cfg.latimiColoane[i] * cell}px`;
        el.style.height = `${H}px`;
      });

      // Butoanele: lățimea coloanei lor, exact peste coloană.
      myButtons.forEach((btn, i) => {
        btn.style.left = `${colX[i]}px`;
        btn.style.width = `${cfg.latimiColoane[i] * cell}px`;
      });

      lift.style.width = `${totalMere * cell}px`;
      const liftH = lift.offsetHeight || cell * 2.4;
      travel = Math.max(1, H - liftH);

      lift.style.left = `${colX[colIndex]}px`;
      lift.style.top = `${Math.min(y, travel)}px`;

      randeazaNumerotare(H);
      actualizeazaMismatch();
    }

    // „Prea puțin"/„prea mult": compară lățimea coloanei curente cu totalMere.
    // Coordonate calculate analitic, nu măsurate — lift.style.left = colX[colIndex],
    // deci în sistemul de coordonate al liftului (0 = marginea lui stângă), coloana
    // se termină la latimeColoana*cell, indiferent de padding-ul intern al liftului.
    // top-ul rândului de mere SE măsoară (rowEl.offsetTop/Height), fiindcă depinde de
    // înălțimea randată a textului întrebării — nu are o formulă simplă. Bara e
    // centrată pe axa verticală a rândului de mere — cu o excepție: la sumă mică
    // (<=5) și coloană mai îngustă, rândul de mere e prea scund/aglomerat ca bara
    // centrată să nu se suprapună vizibil peste mere, deci rămâne SUB rând, ca înainte.
    function actualizeazaMismatch() {
      const latimeColoana = cfg.latimiColoane[colIndex];
      if (latimeColoana === totalMere) {
        mismatchEl.style.display = "none";
        return;
      }
      mismatchEl.style.display = "block";
      const centruRand = rowEl.offsetTop + rowEl.offsetHeight / 2;
      if (latimeColoana > totalMere) {
        // coloana mai lată — celule goale în continuarea rândului de mere
        const h = Math.max(rowEl.offsetHeight, mismatchMinH);
        mismatchEl.style.left = `${totalMere * cell}px`;
        mismatchEl.style.width = `${(latimeColoana - totalMere) * cell}px`;
        mismatchEl.style.top = `${centruRand - h / 2}px`;
        mismatchEl.style.height = `${h}px`;
      } else {
        // coloana mai îngustă — mere care ies peste marginea galbenă
        const h = Math.max(cell, mismatchMinH);
        mismatchEl.style.left = `${latimeColoana * cell}px`;
        mismatchEl.style.width = `${(totalMere - latimeColoana) * cell}px`;
        const top = totalMere <= 5 ? rowEl.offsetTop + rowEl.offsetHeight : centruRand - h / 2;
        mismatchEl.style.top = `${top}px`;
        mismatchEl.style.height = `${h}px`;
      }
    }

    // Rebuild complet al numerotării (nu update parțial): un .rigle-row pe fiecare
    // linie de grilă din fiecare coloană, cu 1..lățime cifre. Apelat din
    // computeGeometry() — deci la mount, resize, setColumnLayout, fact nou și
    // setNumerotareRanduri(). Modul "animat" pornește cu toate rândurile invizibile
    // (opacity 0); tick()/selectColumn() decid ce se vede.
    function randeazaNumerotare(H) {
      rowNumbersWrap.replaceChildren();
      rowEls = [];
      if (cfg.numerotareRanduri === "dezactivat") return;

      const maxRanduri = Math.max(0, Math.ceil(H / cell));
      cfg.latimiColoane.forEach((w, i) => {
        const randuriColoana = [];
        for (let r = 0; r < maxRanduri; r++) {
          const randEl = document.createElement("div");
          randEl.className = "rigle-row";
          randEl.style.left = `${colX[i]}px`;
          randEl.style.top = `${r * cell}px`;
          randEl.style.width = `${w * cell}px`;
          randEl.style.height = `${cell}px`;
          for (let k = 1; k <= w; k++) {
            const cifraEl = document.createElement("span");
            cifraEl.className = "rigle-row-cell";
            cifraEl.textContent = String(k);
            randEl.appendChild(cifraEl);
          }
          if (cfg.numerotareRanduri === "toate") {
            randEl.style.color = NUMEROTARE_CULOARE_STATICA;
            randEl.style.opacity = "1";
          } else {
            randEl.style.opacity = "0"; // "animat" — actualizeazaNumerotareAnimata() decide
          }
          rowNumbersWrap.appendChild(randEl);
          randuriColoana.push(randEl);
        }
        rowEls[i] = randuriColoana;
      });
    }

    // Modul "animat": fereastra de `randuriInSus` rânduri deasupra + `randuriInJos`
    // rânduri sub rândul liftului, pe coloana curentă — opacitate + culoare (hue) în
    // funcție de distanța (în orice direcție) până la rândul liftului. Ieftin: doar
    // `maxRanduri` scrieri de style, nicio creare de DOM (asta se întâmplă o singură
    // dată, în randeazaNumerotare).
    //
    // `pozitieReper` e FRACȚIONARĂ, nu rotunjită la rând întreg — altfel gradientul
    // sare o dată pe celulă parcursă (vizibil brusc). Fiindcă se recalculează la
    // fiecare cadru din tick(), iar `y` avansează continuu, opacitatea/culoarea
    // fiecărui rând se ajustează în fiecare cadru (practic la fiecare fracțiune de
    // pătrățel), nu doar când liftul trece pe rândul următor.
    function actualizeazaNumerotareAnimata() {
      if (cfg.numerotareRanduri !== "animat") return;
      const randuriColoana = rowEls[colIndex];
      if (!randuriColoana) return;
      const liftH = lift.offsetHeight || cell * 2.4;
      const pozitieReper = (y + liftH) / cell + 1; // rândul liftului + cel de sub, fracționar
      const Xsus = Math.max(1, cfg.randuriInSus);
      const Xjos = Math.max(1, cfg.randuriInJos);

      randuriColoana.forEach((randEl, r) => {
        const distanta = pozitieReper - r; // pozitiv = deasupra liftului, negativ = sub
        const X = distanta >= 0 ? Xsus : Xjos;
        const distantaAbs = Math.abs(distanta);
        if (distantaAbs > X) {
          randEl.style.opacity = "0";
          return;
        }
        const t = distantaAbs / X;
        const hue = NUMEROTARE_HUE_APROAPE + (NUMEROTARE_HUE_DEPARTE - NUMEROTARE_HUE_APROAPE) * t;
        randEl.style.opacity = String(1 - t);
        randEl.style.color = `hsl(${hue}, 75%, 40%)`;
      });
    }

    function selectColumn(idx) {
      if (idx < 0 || idx >= colX.length) return;
      if (cfg.numerotareRanduri === "animat" && rowEls[colIndex]) {
        rowEls[colIndex].forEach((randEl) => {
          randEl.style.opacity = "0";
        });
      }
      colIndex = idx;
      lift.style.left = `${colX[colIndex]}px`; // glisare orizontală (tranziția CSS)
      actualizeazaNumerotareAnimata();
      actualizeazaMismatch();
    }

    // Pauză proprie lui m2 — motorul 1 (falling-engine.js) are „if
    // (getQuiz().isCompleted()) return;" ca prim rând al handler-ului de pauză, iar
    // Rigle raportează isCompleted()→true (§2 RIGLE-REFERENCE), deci butonul/tasta nu
    // ajung niciodată la logica lui m1. Duplicat aici, nu adăugat în falling-engine.js
    // — pauza lui m1 e împletită cu fallHeld/animating/locked/bouncing/optionBtns,
    // stare fără sens pentru m2; „nicio modificare în falling-engine.js" e principiul
    // stabilit încă din etapa 1.
    function setPauza(val) {
      paused = val;
      if (playPauseBtn) playPauseBtn.textContent = paused ? "▶" : "⏸";
      if (gameEl) gameEl.classList.toggle("is-paused", paused);
      myButtons.forEach((btn) => {
        btn.disabled = paused;
      });
    }

    function onPlayPauseClick() {
      setPauza(!paused);
    }
    if (playPauseBtn) playPauseBtn.addEventListener("click", onPlayPauseClick);

    function applyGridLines() {
      const parts = [];
      if (cfg.gridVertical) parts.push(`linear-gradient(to right, ${GRID_LINE})`);
      if (cfg.gridOrizontal) parts.push(`linear-gradient(to bottom, ${GRID_LINE})`);
      gridEl.style.backgroundImage = parts.length ? parts.join(", ") : "none";
    }

    function setGridLines(opts) {
      if (!opts) return;
      if (typeof opts.vertical === "boolean") cfg.gridVertical = opts.vertical;
      if (typeof opts.orizontal === "boolean") cfg.gridOrizontal = opts.orizontal;
      applyGridLines();
    }

    function setColumnLayout(opts) {
      if (!opts) return;
      if (typeof opts.treime === "boolean") cfg.pozitieTreime = opts.treime;
      const frac = travel > 0 ? y / travel : 0;
      computeGeometry();
      y = frac * travel;
    }

    // La fact nou se schimbă lățimile coloanelor, deci colX, deci lift.style.left —
    // cu tranziția activă liftul ar glisa orizontal exact când sare vertical sus.
    // Se scoate clasa înainte de randare, se pune la loc pe rAF (ca la mount).
    function schimbaFact(fact) {
      lift.classList.remove("rigle-lift--ready");
      randeazaFact(fact);
      requestAnimationFrame(() => lift.classList.add("rigle-lift--ready"));
    }

    function faNouFact() {
      const fact = cfg.urmatorulFact?.();
      if (fact) schimbaFact(fact);
    }

    // Folosită de CP: fără ea, o schimbare de interval din „Suma maxima" s-ar vedea
    // abia la următorul wrap (~20s), și controlul ar părea stricat.
    function reporneste() {
      y = 0;
      faNouFact();
    }

    // CP „Numerotează rânduri din coloane" — live, fără remount. computeGeometry()
    // rebuild-uiește randeazaNumerotare() cu noile cfg.numerotareRanduri/randuriInSus.
    function setNumerotareRanduri(opts) {
      if (!opts) return;
      if (typeof opts.mod === "string") cfg.numerotareRanduri = opts.mod;
      if (typeof opts.randuriInSus === "number") cfg.randuriInSus = opts.randuriInSus;
      if (typeof opts.randuriInJos === "number") cfg.randuriInJos = opts.randuriInJos;
      computeGeometry();
      actualizeazaNumerotareAnimata();
    }

    // CP „Lift" — transparență fundal alb + afișare margine. Live, fără remount.
    function aplicaStilLift() {
      const transparenta = Math.min(100, Math.max(0, cfg.liftFundalTransparenta));
      const alfa = (100 - transparenta) / 100;
      lift.style.background = `rgba(255, 255, 255, ${alfa})`;
      // Culoarea devine transparentă (nu border-width: 0), ca să nu schimbe cutia
      // liftului — actualizeazaMismatch() presupune padding+border constante.
      lift.style.borderColor = cfg.liftMargine ? "#3a4a63" : "transparent";
    }

    function setLift(opts) {
      if (!opts) return;
      if (typeof opts.transparentaFundal === "number") cfg.liftFundalTransparenta = opts.transparentaFundal;
      if (typeof opts.margine === "boolean") cfg.liftMargine = opts.margine;
      aplicaStilLift();
    }

    // Factul inițial vine din același callback ca la wrap, ca să nu existe două căi
    // diferite de a produce un fact. Fără callback (mount fără generator), se
    // folosesc valorile din cfg — comportament identic cu etapa 1.
    aplicaStilLift();
    const factInitial = cfg.urmatorulFact
      ? cfg.urmatorulFact()
      : { intrebare: cfg.intrebare, grupe: cfg.grupe, latimiColoane: cfg.latimiColoane };
    randeazaFact(factInitial);
    // Activăm tranziția orizontală abia după prima așezare, ca liftul să nu
    // gliseze din colț la pornire.
    requestAnimationFrame(() => lift.classList.add("rigle-lift--ready"));

    // ── Taste 1/2/3 → coloana 1/2/3 (poziții stânga→dreapta). ──
    // Space/p/P NU se tratează aici: falling-engine.js are deja un listener de
    // keydown negardat (fără isCompleted()) care apelează necondiționat
    // `playPauseBtn.click()` pentru acele taste — ajunge oricum la
    // onPlayPauseClick() mai jos. Tratarea și aici ar comuta pauza de două ori pe
    // apăsare (dublu-toggle = anulare reciprocă) — verificat, era bug real.
    const onKey = (e) => {
      if (e.repeat) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      if (paused) return; // fără schimbare de coloană cât timp e pauză
      const idx = ["1", "2", "3"].indexOf(e.key);
      if (idx >= 0 && idx < colX.length) selectColumn(idx);
    };
    document.addEventListener("keydown", onKey);

    // ── Bucla de coborâre (lentă, continuă, wrap la podea → fact nou). ──
    let rafId = null;
    let lastTs = 0;
    function tick(ts) {
      if (!lastTs) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      if (!paused) {
        y += cfg.vitezaCoborare * dt;
        if (y >= travel) {
          y = 0;
          faNouFact();
        }
        lift.style.top = `${y}px`;
        actualizeazaNumerotareAnimata();
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    // ── Recalcul la schimbare de dimensiune (mobil/desktop, rotire). ──
    const ro = new ResizeObserver(() => {
      const frac = travel > 0 ? y / travel : 0;
      computeGeometry();
      y = frac * travel;
    });
    ro.observe(arenaEl);

    function destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      document.removeEventListener("keydown", onKey);
      if (playPauseBtn) {
        playPauseBtn.removeEventListener("click", onPlayPauseClick);
        playPauseBtn.textContent = "⏸"; // iconul implicit (nepauzat) — motorul 1 pornește mereu nepauzat
      }
      scene.remove();
      buttonsBar.remove();
      if (gameEl) {
        gameEl.classList.remove("rigle-active");
        gameEl.classList.remove("is-paused"); // nu lăsăm starea de pauză să "scurgă" spre motorul 1
      }
      restoreList.forEach(({ el, prev }) => {
        el.style.display = prev;
      });
    }

    return { destroy, setGridLines, setColumnLayout, reporneste, setNumerotareRanduri, setLift };
  }

  global.RigleEngine = { mount };
})(window);
