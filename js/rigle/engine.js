/**
 * Motor „Cl. 1 - Rigle" — etapa 1 (doar mișcare, fără validare).
 *
 * Un lift îngust coboară lent și continuu; apăsarea unui buton îl glisează pe una
 * din coloanele-riglă. Fără feedback, fără sărbătoare — acelea vin în etape viitoare.
 * Vezi `js/rigle/SPEC-etapa1.md`.
 *
 *   RigleEngine.mount({ arenaEl, optionsEl }, config?) → { destroy }
 *
 * `mount` ascunde scena motorului 1 din `#arena` și butoanele `.option` existente,
 * randează scena Rigle + 3 butoane proprii, apoi pornește coborârea. `destroy`
 * oprește totul și restaurează nodurile ascunse.
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
}
.rigle-grid {
  position: absolute;
  inset: 0;
  background-color: #fbfbf3;
  background-image:
    linear-gradient(to right, rgba(70, 120, 190, 0.2) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(70, 120, 190, 0.2) 1px, transparent 1px);
}
.rigle-columns {
  position: absolute;
  inset: 0;
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
  z-index: 3;
}
.rigle-lift--ready {
  transition: left 0.35s ease;
}
.rigle-lift-q {
  font-weight: 800;
  font-size: calc(var(--cell) * 0.62);
  color: #1f2a3a;
  line-height: 1;
}
.rigle-lift-row {
  display: flex;
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
/* Halou neutru: un disc deschis exact în spatele mărului, ca legibilitatea să nu
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
`;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const DEFAULTS = {
    intrebare: "2+1=?",
    grupe: [
      { n: 2, fundal: "rosu" },
      { n: 1, fundal: "albastru" },
    ],
    obiect: "🍏",
    latimiColoane: [2, 3, 4],
    coloanaInitiala: 3, // lățimea coloanei pe care pornește liftul
    vitezaCoborare: 34, // px/s (mică — copii de clasa 1)
  };

  function mount(hosts, config) {
    const arenaEl = hosts && hosts.arenaEl;
    const optionsEl = hosts && hosts.optionsEl;
    if (!arenaEl || !optionsEl) {
      throw new Error("RigleEngine.mount: lipsesc arenaEl / optionsEl");
    }
    const cfg = Object.assign({}, DEFAULTS, config || {});
    injectStyles();

    const totalMere = cfg.grupe.reduce((sum, g) => sum + g.n, 0);

    // ── Ascunde tot ce ține de motorul 1 (restaurat exact la destroy). ──
    // Include #lift-fixed-host: în modul „bară fixă" (default prin ASNW) conținutul
    // liftului stă acolo, în afara #arena, deci trebuie ascuns separat.
    const restoreList = [];
    const hideEl = (el) => {
      if (!el) return;
      restoreList.push({ el, prev: el.style.display });
      el.style.display = "none";
    };
    [...arenaEl.children].forEach(hideEl);
    [...optionsEl.querySelectorAll(".option")].forEach(hideEl);
    hideEl(document.getElementById("lift-fixed-host"));

    // ── Scena Rigle ──
    const scene = document.createElement("div");
    scene.className = "rigle-scene";

    const gridEl = document.createElement("div");
    gridEl.className = "rigle-grid";
    scene.appendChild(gridEl);

    const columnsWrap = document.createElement("div");
    columnsWrap.className = "rigle-columns";
    scene.appendChild(columnsWrap);
    const colEls = cfg.latimiColoane.map((w) => {
      const col = document.createElement("div");
      col.className = "rigle-col";
      col.dataset.w = String(w);
      columnsWrap.appendChild(col);
      return col;
    });

    const lift = document.createElement("div");
    lift.className = "rigle-lift";
    const qEl = document.createElement("div");
    qEl.className = "rigle-lift-q";
    qEl.textContent = cfg.intrebare;
    const rowEl = document.createElement("div");
    rowEl.className = "rigle-lift-row";
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
    lift.append(qEl, rowEl);
    scene.appendChild(lift);

    arenaEl.appendChild(scene);

    // ── Butoane proprii (identice cu `.option`), în slotul `#options`. ──
    const myButtons = cfg.latimiColoane.map((w, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option rigle-option";
      const prime = document.createElement("span");
      prime.className = "prime";
      prime.textContent = String(w);
      btn.appendChild(prime);
      btn.addEventListener("click", () => selectColumn(idx));
      optionsEl.appendChild(btn);
      return btn;
    });

    // ── Geometrie + stare ──
    let cell = 32;
    let bandTop = 0;
    let bandBottom = 0;
    let colX = [];
    let travel = 1;
    let colIndex = cfg.latimiColoane.indexOf(cfg.coloanaInitiala);
    if (colIndex < 0) colIndex = Math.floor(cfg.latimiColoane.length / 2);
    let y = 0; // 0..travel (compensare verticală față de bandTop)

    function computeGeometry() {
      const arenaRect = arenaEl.getBoundingClientRect();
      const W = arenaRect.width || 360;
      const H = arenaRect.height || 720;
      // Insete măsurate RELATIV la arenă (nu din --hud-h/--options-h, care sunt
      // viewport-relative și ies aberante pe desktop, unde cutia e centrată).
      // Banda utilă = între josul barei de sus și susul barei de butoane.
      const topBar = document.querySelector(".butoane-sus");
      const topBarBottom = topBar
        ? topBar.getBoundingClientRect().bottom - arenaRect.top
        : H * 0.08;
      const optionsTop = optionsEl.getBoundingClientRect().top - arenaRect.top;
      bandTop = Math.max(0, topBarBottom) + 6;
      bandBottom = (optionsTop > 0 ? optionsTop : H * 0.75) - 6;

      const sumW = cfg.latimiColoane.reduce((s, w) => s + w, 0);
      const nGaps = Math.max(0, cfg.latimiColoane.length - 1);
      cell = Math.max(14, Math.floor(W / (sumW + nGaps + 1)));
      const gap = cell;
      const used = sumW * cell + nGaps * gap;
      const margin = Math.max(0, Math.round((W - used) / 2));

      colX = [];
      let x = margin;
      cfg.latimiColoane.forEach((w) => {
        colX.push(x);
        x += w * cell + gap;
      });

      scene.style.setProperty("--cell", `${cell}px`);
      gridEl.style.backgroundSize = `${cell}px ${cell}px`;
      gridEl.style.backgroundPosition = `${margin}px ${bandTop}px`;

      const colH = Math.max(0, bandBottom - bandTop);
      colEls.forEach((el, i) => {
        el.style.left = `${colX[i]}px`;
        el.style.top = `${bandTop}px`;
        el.style.width = `${cfg.latimiColoane[i] * cell}px`;
        el.style.height = `${colH}px`;
      });

      lift.style.width = `${totalMere * cell}px`;
      const liftH = lift.offsetHeight || cell * 2.4;
      travel = Math.max(1, colH - liftH);

      lift.style.left = `${colX[colIndex]}px`;
      lift.style.top = `${bandTop + Math.min(y, travel)}px`;
    }

    function selectColumn(idx) {
      if (idx < 0 || idx >= colX.length) return;
      colIndex = idx;
      lift.style.left = `${colX[colIndex]}px`; // glisare orizontală (tranziția CSS)
    }

    computeGeometry();
    // Activăm tranziția orizontală abia după prima așezare, ca liftul să nu
    // gliseze din colț la pornire.
    requestAnimationFrame(() => lift.classList.add("rigle-lift--ready"));

    // ── Bucla de coborâre (lentă, continuă, wrap la podea, aceeași coloană). ──
    let rafId = null;
    let lastTs = 0;
    function tick(ts) {
      if (!lastTs) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      y += cfg.vitezaCoborare * dt;
      if (y >= travel) y = 0;
      lift.style.top = `${bandTop + y}px`;
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
      scene.remove();
      myButtons.forEach((btn) => btn.remove());
      restoreList.forEach(({ el, prev }) => {
        el.style.display = prev;
      });
    }

    return { destroy };
  }

  global.RigleEngine = { mount };
})(window);
