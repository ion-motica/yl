/**
 * Vizualizare „facts din coloane animate” — benzi verticale care își schimbă locul în fereastră.
 *
 * factsDinColoaneAnimate(container, options?) → { destroy, setOptions, restart }
 */
(function (global) {
  "use strict";

  const DISPLAY_OP = { "+": "+", "-": "−", "*": "×", "/": "÷" };
  const SIGN_POOL = ["+", "−", "×", "÷", "="];
  const NUMBER_SLOTS = [0, 2, 4];
  const SIGN_SLOTS = [1, 3];

  const DEFAULTS = {
    arenaWidth: 640,
    arenaHeight: 640,
    seriesLength: 10,
    transitionMs: 900,
    pauseMs: 1400,
    windowMode: "fix",
    cellGap: 2,
    divMargin: 2,
    cellScale: 72,
    operations: ["+", "-", "*", "/"],
    chainMode: "one",
    chainRandomSkip: 0.35,
  };

  /** 3 rigle numere: 11 + 11 + 101 celule (fără repetare). */
  const REEL_DEFS = [
    { id: "numMicA", type: "number-small", range: [0, 10], slot: 0 },
    { id: "signA", type: "sign", slot: 1 },
    { id: "numMicB", type: "number-small", range: [0, 10], slot: 2 },
    { id: "signB", type: "sign", slot: 3 },
    { id: "numMare", type: "number-large", range: [0, 100], slot: 4 },
  ];

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function randFloat(min, max) {
    return min + Math.random() * (max - min);
  }

  function isPleasantHsl(h, s, l, pastel) {
    if (pastel) {
      if (s < 16 || s > 54) return false;
      if (l < 56 || l > 86) return false;
    } else {
      if (s < 30 || s > 76) return false;
      if (l < 34 || l > 66) return false;
    }
    const hN = ((h % 360) + 360) % 360;
    if (!pastel && s < 40 && l > 38 && l < 52 && hN > 28 && hN < 52) return false;
    if (pastel && s > 38 && l < 58 && hN > 30 && hN < 50) return false;
    return true;
  }

  function sampleSatLight(pastel) {
    if (pastel) {
      return { s: randFloat(20, 46), l: randFloat(62, 80) };
    }
    return { s: randFloat(48, 68), l: randFloat(42, 58) };
  }

  function pleasantHsl(hue, sat, lit, pastel) {
    let h = hue;
    let s = sat;
    let l = lit;
    for (let i = 0; i < 24; i++) {
      if (isPleasantHsl(h, s, l, pastel)) break;
      const sl = sampleSatLight(pastel);
      s = sl.s;
      l = sl.l;
    }
    return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
  }

  /** Cheie 0–10: rigla mare repetă 1–10 la fiecare zece (11→1 … 20→10). */
  function digitColorKey(n) {
    if (n === 0) return "0";
    return String(((n - 1) % 10) + 1);
  }

  function lerpHue(h1, h2, t) {
    const delta = ((h2 - h1 + 540) % 360) - 180;
    return (h1 + delta * t + 360) % 360;
  }

  function colorAtAnchors(anchors, t, pastel) {
    const n = anchors.length;
    if (n === 0) return pleasantHsl(200, 55, 50, pastel);
    if (n === 1) {
      const a = anchors[0];
      return pleasantHsl(a.h, a.s, a.l, pastel);
    }
    const x = clamp(t, 0, 1) * (n - 1);
    const i = Math.min(Math.floor(x), n - 2);
    const lt = x - i;
    const a = anchors[i];
    const b = anchors[i + 1];
    return pleasantHsl(
      lerpHue(a.h, b.h, lt),
      lerp(a.s, b.s, lt),
      lerp(a.l, b.l, lt),
      pastel
    );
  }

  function buildAnchors(count, startHue, span, pastel) {
    const anchors = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);
      const sl = sampleSatLight(pastel);
      anchors.push({
        h: (startHue + t * span) % 360,
        s: sl.s,
        l: sl.l,
      });
    }
    return anchors;
  }

  /**
   * Numere 0–10: 2 sau 3 culori (random).
   * Semne: 3, 4 sau 5 culori pe un gradient armonizat.
   */
  function createPalette() {
    const numColorCount = pick([2, 3]);
    const signColorCount = randInt(3, 5);
    const pastel = Math.random() < 0.5;

    const baseHue = Math.random() * 360;
    const numSpan =
      numColorCount === 2 ? randFloat(32, 95) : randFloat(55, 115);
    const numAnchors = buildAnchors(numColorCount, baseHue, numSpan, pastel);

    const signStart = (baseHue + numSpan * randFloat(0.2, 0.45) + randFloat(12, 40)) % 360;
    const signSpan = randFloat(50, 110);
    const signAnchors = buildAnchors(signColorCount, signStart, signSpan, pastel);

    const byDigit = {};
    for (let d = 0; d <= 10; d++) {
      byDigit[String(d)] = colorAtAnchors(numAnchors, d / 10, pastel);
    }

    const bySign = {};
    SIGN_POOL.forEach((sym, i) => {
      const t = i / (SIGN_POOL.length - 1);
      bySign[sym] = colorAtAnchors(signAnchors, t, pastel);
    });
    return { byDigit, bySign, numColorCount, signColorCount, pastel };
  }

  function range(lo, hi) {
    const out = [];
    for (let i = lo; i <= hi; i++) out.push(i);
    return out;
  }

  function permutations(n) {
    if (n === 1) return [[0]];
    const out = [];
    const sub = permutations(n - 1);
    for (const p of sub) {
      for (let i = 0; i <= p.length; i++) {
        const next = p.slice();
        next.splice(i, 0, n - 1);
        out.push(next);
      }
    }
    return out;
  }

  const PERMS_3 = permutations(3);
  const PERMS_2 = permutations(2);

  function compute(a, op, b) {
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        return b === 0 ? NaN : a / b;
      default:
        return NaN;
    }
  }

  function buildFactCatalog(operations) {
    const catalog = [];
    const seen = new Set();

    function add(a, op, b, r, orient) {
      if (!Number.isFinite(r) || r < 0 || r > 100) return;
      if (a < 0 || a > 100 || b < 0 || b > 100) return;
      const calc = compute(a, op, b);
      if (!Number.isFinite(calc) || Math.round(calc) !== r) return;
      if (op === "/" && b === 0) return;
      const key = `${orient}:${a}:${op}:${b}:${r}`;
      if (seen.has(key)) return;
      seen.add(key);
      const dispOp = DISPLAY_OP[op];
      const nums = [a, b, r];
      let cells;
      if (orient === "left") {
        cells = { n1: a, s1: dispOp, n2: b, s2: "=", n3: r };
      } else {
        cells = { n1: r, s1: "=", n2: a, s2: dispOp, n3: b };
      }
      catalog.push({ a, op, b, r, orient, nums, cells });
    }

    for (const op of operations) {
      if (op === "+") {
        for (let a = 0; a <= 10; a++) {
          for (let b = 0; b <= 10; b++) {
            add(a, op, b, a + b, "left");
            add(a, op, b, a + b, "right");
          }
        }
      } else if (op === "-") {
        for (let a = 0; a <= 10; a++) {
          for (let b = 0; b <= 10; b++) {
            if (b > a) continue;
            add(a, op, b, a - b, "left");
            add(a, op, b, a - b, "right");
          }
        }
      } else if (op === "*") {
        for (let a = 0; a <= 10; a++) {
          for (let b = 0; b <= 10; b++) {
            add(a, op, b, a * b, "left");
            add(a, op, b, a * b, "right");
          }
        }
      } else if (op === "/") {
        for (let b = 1; b <= 10; b++) {
          for (let q = 0; q <= 10; q++) {
            add(b * q, op, b, q, "left");
            add(b * q, op, b, q, "right");
          }
        }
      }
    }
    return catalog;
  }

  function sharedUniqueCount(prev, next) {
    const prevSet = new Set(prev.nums);
    let n = 0;
    for (const v of new Set(next.nums)) {
      if (prevSet.has(v)) n += 1;
    }
    return n;
  }

  function chainOkOne(prev, next) {
    for (let i = 0; i < 3; i++) {
      const carry = next.nums[i];
      if (!prev.nums.includes(carry)) continue;
      const others = next.nums.filter((_, j) => j !== i);
      if (others.every((v) => !prev.nums.includes(v))) return true;
    }
    return false;
  }

  function chainOk(prev, next, mode, randomSkip) {
    if (!prev) return true;
    if (mode === "oneUnlessRandom" && Math.random() < randomSkip) return true;
    if (mode === "two") return sharedUniqueCount(prev, next) >= 2;
    return chainOkOne(prev, next);
  }

  function buildSeries(catalog, length, seedPrev, chainMode, chainRandomSkip) {
    const series = [];
    let prev = seedPrev;
    let guard = 0;
    while (series.length < length && guard < 8000) {
      guard += 1;
      const pool = catalog.filter((f) => chainOk(prev, f, chainMode, chainRandomSkip));
      if (!pool.length) break;
      const next = pick(pool);
      series.push(next);
      prev = next;
    }
    return series;
  }

  function formatFact(f) {
    const c = f.cells;
    return `${c.n1}${c.s1}${c.n2}${c.s2}${c.n3}`;
  }

  function windowMatchesFact(reels, fact) {
    const t = slotTargets(fact);
    for (const slot of [0, 1, 2, 3, 4]) {
      const reel = reels.find((r) => r.slot === slot);
      if (!reel) return false;
      const shown = reel.strip[reel.vertIndex];
      if (String(t[slot]) !== String(shown)) return false;
    }
    return true;
  }

  /** O singură listă finită — componentele vizibile ale riglei. */
  function buildStrip(values) {
    const strip = values.map(String);
    return { strip, baseLen: strip.length };
  }

  function valueIndexInStrip(strip, value, nearIndex) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < strip.length; i++) {
      if (strip[i] !== value) continue;
      const d = Math.abs(i - nearIndex);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best >= 0 ? best : 0;
  }

  function shortestVerticalDelta(cur, target) {
    return target - cur;
  }

  function reelCanShow(reel, value) {
    if (reel.type === "number-small") return Number(value) <= 10 && reel.strip.includes(value);
    if (reel.type === "number-large") return reel.strip.includes(value);
    return reel.strip.includes(value);
  }

  function slotTargets(fact) {
    const c = fact.cells;
    return {
      0: String(c.n1),
      1: c.s1,
      2: String(c.n2),
      3: c.s2,
      4: String(c.n3),
    };
  }

  function planAssignment(reels, fact) {
    const targets = slotTargets(fact);
    const numValues = [targets[0], targets[2], targets[4]];
    const signValues = [targets[1], targets[3]];
    const numberReels = reels.filter((r) => r.type.startsWith("number"));
    const signReels = reels.filter((r) => r.type === "sign");

    let best = null;

    function consider(assignments) {
      let still = 0;
      let cost = 0;
      const moves = [];
      for (const a of assignments) {
        const reel = a.reel;
        const slotSame = reel.slot === a.slot;
        const vertTarget = valueIndexInStrip(reel.strip, a.value, reel.vertIndex);
        const vertDelta = shortestVerticalDelta(reel.vertIndex, vertTarget);
        const vertSame = vertDelta === 0;
        if (slotSame && vertSame) still += 1;
        cost += Math.abs(reel.slot - a.slot) * 3 + Math.abs(vertDelta) * 0.05;
        moves.push({
          reel,
          slot: a.slot,
          value: a.value,
          vertTarget,
          vertDelta,
          slotSame,
          vertSame,
        });
      }
      cost += still > 1 ? (still - 1) * 40 : 0;

      if (!best || cost < best.cost) {
        best = { cost, moves, still };
      }
    }

    for (const np of PERMS_3) {
      const numAssign = [];
      let ok = true;
      for (let i = 0; i < 3; i++) {
        const reel = numberReels[i];
        const slot = NUMBER_SLOTS[np[i]];
        const value = numValues[np[i]];
        if (!reelCanShow(reel, value)) {
          ok = false;
          break;
        }
        numAssign.push({ reel, slot, value });
      }
      if (!ok) continue;

      for (const sp of PERMS_2) {
        const signAssign = [];
        let okS = true;
        for (let i = 0; i < 2; i++) {
          const reel = signReels[i];
          const slot = SIGN_SLOTS[sp[i]];
          const value = signValues[sp[i]];
          if (!reelCanShow(reel, value)) {
            okS = false;
            break;
          }
          signAssign.push({ reel, slot, value });
        }
        if (!okS) continue;
        consider(numAssign.concat(signAssign));
      }
    }

    if (!best || !best.moves.length) {
      return { moves: [], cost: Infinity };
    }

    for (const m of best.moves) {
      m.vertTarget = clamp(m.vertTarget, 0, m.reel.baseLen - 1);
      if (m.reel.strip[m.vertTarget] !== m.value) {
        m.vertTarget = valueIndexInStrip(m.reel.strip, m.value, m.vertTarget);
      }
      m.vertDelta = shortestVerticalDelta(m.reel.vertIndex, m.vertTarget);
    }

    return best;
  }

  class FactsColoaneInstance {
    constructor(container, options) {
      this.container = container;
      this.options = { ...DEFAULTS, ...options };
      this.catalog = buildFactCatalog(this.options.operations);
      this.series = [];
      this.factIndex = 0;
      this.frameOffset = 0;
      this.reels = [];
      this.anim = null;
      this.timer = null;
      this.destroyed = false;
      this._injectStyles();
      this._buildDom();
      this._layout();
      this._newSeries(null);
      this.reels.forEach((r) => {
        r.vertIndex = randInt(0, Math.max(0, r.baseLen - 1));
      });
      requestAnimationFrame(() => {
        this._showFact(0, true);
        this.timer = setTimeout(
          () => this._scheduleNext(),
          this.options.transitionMs + this.options.pauseMs
        );
      });
    }

    _injectStyles() {
      if (document.getElementById("fca-styles")) return;
      const style = document.createElement("style");
      style.id = "fca-styles";
      style.textContent = `
        .fca-root { display:flex; gap:1rem; font-family:system-ui,sans-serif; color:#e8eef5; }
        .fca-sidebar { flex:0 0 210px; display:flex; flex-direction:column; gap:0.65rem; padding:0.5rem 0; }
        .fca-sidebar label { display:flex; flex-direction:column; gap:0.3rem; font-size:0.82rem; color:#9fb0c7; }
        .fca-sidebar output { font-weight:700; color:#facc15; }
        .fca-sidebar input[type=range] { width:100%; }
        .fca-switch { display:flex; gap:0.35rem; flex-wrap:wrap; }
        .fca-switch button { flex:1; min-width:5rem; padding:0.4rem 0.45rem; border-radius:8px; border:1px solid #3d5068; background:#1a2433; color:#c5d4e8; cursor:pointer; font-size:0.76rem; }
        .fca-switch button.active { border-color:#facc15; background:#2a3448; color:#fff; }
        .fca-fact-readout { font-size:1.3rem; font-weight:800; letter-spacing:0.02em; min-height:2rem; }
        .fca-arena-wrap { flex:1; min-width:0; }
        .fca-arena { position:relative; margin:0 auto; background:linear-gradient(180deg,#141c28,#0d1218); border:1px solid #2a3548; border-radius:16px; overflow:hidden; }
        .fca-window { position:absolute; left:50%; transform:translateX(-50%); z-index:4; pointer-events:none; border:2px solid rgba(250,204,21,0.75); background:rgba(250,204,21,0.18); border-radius:8px; box-sizing:border-box; }
        .fca-viewport { position:absolute; left:50%; transform:translateX(-50%); overflow:hidden; z-index:2; display:flex; justify-content:center; }
        .fca-frame { position:relative; will-change:transform; flex:0 0 auto; }
        .fca-columns { position:relative; height:100%; flex:0 0 auto; }
        .fca-col { position:absolute; top:0; overflow:visible; will-change:left, transform; }
        .fca-col.moving { z-index:6; }
        .fca-col.idle { z-index:2; }
        .fca-strip { display:flex; flex-direction:column; will-change:transform; }
        .fca-btn-gradient { padding:0.5rem 0.65rem; border-radius:8px; border:1px solid #3d5068; background:#1a2433; color:#c5d4e8; cursor:pointer; font-size:0.82rem; font-weight:600; }
        .fca-btn-gradient:hover { border-color:#7ab8ff; color:#fff; }
        .fca-cell { display:flex; align-items:center; justify-content:center; box-sizing:border-box; border-radius:4px; border:1px solid #334155; font-weight:800; user-select:none; line-height:1; }
        .fca-cell.sign { color:#facc15; }
        .fca-cell.num { color:#fff; }
      `;
      document.head.appendChild(style);
    }

    _buildDom() {
      this.root = document.createElement("div");
      this.root.className = "fca-root";
      this.sidebar = document.createElement("aside");
      this.sidebar.className = "fca-sidebar";

      this.readout = document.createElement("div");
      this.readout.className = "fca-fact-readout";
      this.readout.setAttribute("aria-live", "polite");

      const speedLabel = document.createElement("label");
      this.speedOut = document.createElement("output");
      this.speedSlider = document.createElement("input");
      this.speedSlider.type = "range";
      this.speedSlider.min = "250";
      this.speedSlider.max = "2400";
      this.speedSlider.step = "50";
      this.speedSlider.value = String(this.options.transitionMs);
      this.speedOut.textContent = this.speedSlider.value;
      speedLabel.append("Viteză tranziție (ms) ", this.speedOut, this.speedSlider);

      const sizeLabel = document.createElement("label");
      this.sizeOut = document.createElement("output");
      this.sizeSlider = document.createElement("input");
      this.sizeSlider.type = "range";
      this.sizeSlider.min = "48";
      this.sizeSlider.max = "100";
      this.sizeSlider.step = "1";
      this.sizeSlider.value = String(this.options.cellScale);
      this.sizeOut.textContent = `${this.options.cellScale}%`;
      sizeLabel.append("Mărime celule ", this.sizeOut, this.sizeSlider);

      const gapLabel = document.createElement("label");
      this.gapOut = document.createElement("output");
      this.gapSlider = document.createElement("input");
      this.gapSlider.type = "range";
      this.gapSlider.min = "0";
      this.gapSlider.max = "8";
      this.gapSlider.step = "1";
      this.gapSlider.value = String(this.options.cellGap);
      this.gapOut.textContent = `${this.options.cellGap}px`;
      gapLabel.append("Spațiu între celule ", this.gapOut, this.gapSlider);

      const marginLabel = document.createElement("label");
      this.marginOut = document.createElement("output");
      this.marginSlider = document.createElement("input");
      this.marginSlider.type = "range";
      this.marginSlider.min = "0";
      this.marginSlider.max = "12";
      this.marginSlider.step = "1";
      this.marginSlider.value = String(this.options.divMargin);
      this.marginOut.textContent = `${this.options.divMargin}px`;
      marginLabel.append("Margine divs (strânge chenarul) ", this.marginOut, this.marginSlider);

      const modeWrap = document.createElement("div");
      modeWrap.className = "fca-switch";
      const modeCaption = document.createElement("span");
      modeCaption.style.cssText = "width:100%;font-size:0.82rem;color:#9fb0c7;";
      modeCaption.textContent = "Cadru + fereastră";
      this.btnFix = document.createElement("button");
      this.btnFix.type = "button";
      this.btnFix.textContent = "Fix";
      this.btnMobil = document.createElement("button");
      this.btnMobil.type = "button";
      this.btnMobil.textContent = "Mobil ±4";
      modeWrap.append(modeCaption, this.btnFix, this.btnMobil);

      const chainWrap = document.createElement("div");
      chainWrap.className = "fca-switch";
      const chainCaption = document.createElement("span");
      chainCaption.style.cssText = "width:100%;font-size:0.82rem;color:#9fb0c7;";
      chainCaption.textContent = "Lanț între facts";
      this.btnChain1 = document.createElement("button");
      this.btnChain1.type = "button";
      this.btnChain1.textContent = "1 nr comun";
      this.btnChain2 = document.createElement("button");
      this.btnChain2.type = "button";
      this.btnChain2.textContent = "2 nr comune";
      this.btnChainRand = document.createElement("button");
      this.btnChainRand.type = "button";
      this.btnChainRand.textContent = "1 sau random";
      chainWrap.append(chainCaption, this.btnChain1, this.btnChain2, this.btnChainRand);

      this.btnGradient = document.createElement("button");
      this.btnGradient.type = "button";
      this.btnGradient.className = "fca-btn-gradient";
      this.btnGradient.textContent = "Random new gradient";

      this.sidebar.append(
        this.readout,
        speedLabel,
        sizeLabel,
        gapLabel,
        marginLabel,
        this.btnGradient,
        chainWrap,
        modeWrap
      );

      this.arenaWrap = document.createElement("div");
      this.arenaWrap.className = "fca-arena-wrap";
      this.arena = document.createElement("div");
      this.arena.className = "fca-arena";
      this.windowEl = document.createElement("div");
      this.windowEl.className = "fca-window";
      this.viewport = document.createElement("div");
      this.viewport.className = "fca-viewport";
      this.frameEl = document.createElement("div");
      this.frameEl.className = "fca-frame";
      this.columnsEl = document.createElement("div");
      this.columnsEl.className = "fca-columns";

      for (const def of REEL_DEFS) {
        const values =
          def.type === "sign"
            ? SIGN_POOL.slice()
            : range(def.range[0], def.range[1]);
        const { strip, baseLen } = buildStrip(values);
        const col = document.createElement("div");
        col.className = `fca-col idle ${def.type === "sign" ? "sign-col" : def.type}`;
        const stripEl = document.createElement("div");
        stripEl.className = "fca-strip";
        const cellClass =
          def.type === "sign" ? "fca-cell sign" : "fca-cell num";
        for (const token of strip) {
          const cell = document.createElement("div");
          cell.className = cellClass;
          cell.textContent = token;
          stripEl.appendChild(cell);
        }
        col.appendChild(stripEl);
        this.columnsEl.appendChild(col);
        this.reels.push({
          id: def.id,
          type: def.type,
          slot: def.slot,
          vertIndex: 12,
          strip,
          baseLen,
          col,
          stripEl,
        });
      }

      this.frameEl.appendChild(this.columnsEl);
      this.viewport.appendChild(this.frameEl);
      this.arena.append(this.windowEl, this.viewport);
      this.arenaWrap.appendChild(this.arena);
      this.root.append(this.sidebar, this.arenaWrap);
      this.container.replaceChildren(this.root);

      this.speedSlider.addEventListener("input", () => {
        this.options.transitionMs = Number(this.speedSlider.value);
        this.speedOut.textContent = this.speedSlider.value;
      });
      this.sizeSlider.addEventListener("input", () => {
        this.options.cellScale = Number(this.sizeSlider.value);
        this.sizeOut.textContent = `${this.options.cellScale}%`;
        this._layout();
      });
      this.gapSlider.addEventListener("input", () => {
        this.options.cellGap = Number(this.gapSlider.value);
        this.gapOut.textContent = `${this.options.cellGap}px`;
        this._layout();
      });
      this.marginSlider.addEventListener("input", () => {
        this.options.divMargin = Number(this.marginSlider.value);
        this.marginOut.textContent = `${this.options.divMargin}px`;
        this._layout();
      });
      this.btnFix.addEventListener("click", () => this._setWindowMode("fix"));
      this.btnMobil.addEventListener("click", () => this._setWindowMode("mobil"));
      this.btnChain1.addEventListener("click", () => this._setChainMode("one"));
      this.btnChain2.addEventListener("click", () => this._setChainMode("two"));
      this.btnChainRand.addEventListener("click", () =>
        this._setChainMode("oneUnlessRandom")
      );
      this.btnGradient.addEventListener("click", () => this._newGradient());
      this.palette = createPalette();
      this._applyPaletteToCells();
      this._syncChainButtons();
      this._setWindowMode(this.options.windowMode);
    }

    _syncChainButtons() {
      const mode = this.options.chainMode;
      this.btnChain1.classList.toggle("active", mode === "one");
      this.btnChain2.classList.toggle("active", mode === "two");
      this.btnChainRand.classList.toggle("active", mode === "oneUnlessRandom");
    }

    _colorForToken(token, reelType) {
      const p = this.palette;
      if (!p) return null;
      if (reelType === "sign") return p.bySign[token] || p.bySign["+"];
      const n = parseInt(token, 10);
      if (!Number.isFinite(n) || n < 0) return p.byDigit["0"];
      return p.byDigit[digitColorKey(n)];
    }

    _applyPaletteToCells() {
      if (!this.palette) return;
      this.reels.forEach((r) => {
        r.stripEl.querySelectorAll(".fca-cell").forEach((cell) => {
          const bg = this._colorForToken(cell.textContent, r.type);
          if (bg) cell.style.backgroundColor = bg;
        });
      });
    }

    _newGradient() {
      this.palette = createPalette();
      this._applyPaletteToCells();
    }

    _setWindowMode(mode) {
      this.options.windowMode = mode;
      this.btnFix.classList.toggle("active", mode === "fix");
      this.btnMobil.classList.toggle("active", mode === "mobil");
      this._layout();
    }

    _setChainMode(mode) {
      this.options.chainMode = mode;
      this._syncChainButtons();
      this._rebuildSeriesAndShow();
    }

    _rebuildSeriesAndShow() {
      clearTimeout(this.timer);
      if (this.anim) cancelAnimationFrame(this.anim);
      this._newSeries(null);
      this.factIndex = 0;
      this.reels.forEach((r) => {
        r.vertIndex = randInt(0, Math.max(0, r.baseLen - 1));
      });
      this._showFact(0, true);
      this.timer = setTimeout(
        () => this._scheduleNext(),
        this.options.transitionMs + this.options.pauseMs
      );
    }

    _slotLeft(slot) {
      return slot * this.cellStep;
    }

    _layout() {
      const w = this.options.arenaWidth;
      const h = this.options.arenaHeight;
      const gap = this.options.cellGap;
      const scale = this.options.cellScale / 100;

      this.arena.style.width = `${w}px`;
      this.arena.style.height = `${h}px`;

      const inset = clamp(this.options.divMargin, 0, 12);
      this.options.divMargin = inset;
      this.cellInset = inset;
      const borderPx = 2;
      const baseFromArena = Math.max(22, Math.floor(((w * 0.82) / 5) * scale));
      this.fontSizePx = Math.max(12, Math.floor(baseFromArena * 0.52));
      this.cellSize = this.fontSizePx + 2 * inset + borderPx;
      this.cellGap = gap;
      this.cellStep = this.cellSize + gap;

      this.gridWidth = 4 * this.cellStep + this.cellSize;
      const windowPadX = 10;
      this.windowPadX = windowPadX;
      const windowW = this.gridWidth + 2 * windowPadX;
      const windowH = this.cellSize + 6;
      this.windowCenterY = h * 0.25 + this.cellSize / 2;
      this.columnsWidth = this.gridWidth;

      this.windowEl.style.width = `${windowW}px`;
      this.windowEl.style.height = `${windowH}px`;
      this.windowEl.style.top = `${this.windowCenterY - windowH / 2}px`;

      const viewportW =
        this.options.windowMode === "mobil"
          ? windowW + 8 * this.cellStep
          : windowW;
      this.viewport.style.width = `${viewportW}px`;
      this.viewport.style.height = `${h}px`;
      this.viewport.style.top = "0";
      this.columnsEl.style.width = `${this.columnsWidth}px`;
      this.columnsEl.style.height = `${h}px`;

      this.reels.forEach((r) => {
        r.col.style.width = `${this.cellSize}px`;
        r.stripEl.querySelectorAll(".fca-cell").forEach((cell) => {
          cell.style.width = `${this.cellSize}px`;
          cell.style.height = `${this.cellSize}px`;
          cell.style.marginBottom = `${gap}px`;
          cell.style.padding = `${this.cellInset}px`;
          cell.style.fontSize = `${this.fontSizePx}px`;
        });
      });
      if (this.marginOut) this.marginOut.textContent = `${this.cellInset}px`;

      this._paintReels(true);
      this._paintFrame(true);
    }

    _paintFrame(instant) {
      const x = this.frameOffset * this.cellStep;
      this.frameEl.style.transition = instant
        ? "none"
        : `transform ${this.options.transitionMs}ms cubic-bezier(0.4,0,0.2,1)`;
      this.frameEl.style.transform = `translateX(${x}px)`;
    }

    _paintReels(instant) {
      const dur = this.options.transitionMs;
      this.reels.forEach((r) => {
        const left = this._slotLeft(r.slot);
        const y =
          this.windowCenterY -
          (r.vertIndex * this.cellStep + this.cellSize / 2);
        r.col.style.transition = instant
          ? "none"
          : `left ${dur}ms cubic-bezier(0.4,0,0.2,1)`;
        r.col.style.left = `${left}px`;
        r.stripEl.style.transition = instant
          ? "none"
          : `transform ${dur}ms cubic-bezier(0.4,0,0.2,1)`;
        r.stripEl.style.transform = `translateY(${y}px)`;
      });
    }

    _newSeries(carryFrom) {
      const { chainMode, chainRandomSkip, seriesLength } = this.options;
      this.series = buildSeries(
        this.catalog,
        seriesLength,
        carryFrom,
        chainMode,
        chainRandomSkip
      );
      if (this.series.length < seriesLength) {
        this.series = buildSeries(
          this.catalog,
          seriesLength,
          null,
          chainMode,
          chainRandomSkip
        );
      }
      this.factIndex = 0;
    }

    _showFact(index, animate) {
      const fact = this.series[index];
      if (!fact) return;
      this.readout.textContent = formatFact(fact);

      const plan = planAssignment(this.reels, fact);
      if (!plan.moves || !plan.moves.length) {
        console.warn("facts din coloane animate: plan imposibil pentru", formatFact(fact));
        return;
      }

      let frameDelta = 0;
      if (this.options.windowMode === "mobil") {
        const tryDelta = randInt(-4, 4);
        frameDelta = clamp(this.frameOffset + tryDelta, -4, 4) - this.frameOffset;
      } else {
        frameDelta = -this.frameOffset;
      }

      if (!animate) {
        for (const m of plan.moves) {
          m.reel.slot = m.slot;
          m.reel.vertIndex = m.vertTarget;
        }
        this.frameOffset += frameDelta;
        this._paintReels(true);
        this._paintFrame(true);
        return;
      }

      const duration = this.options.transitionMs;
      const start = performance.now();
      const startFrames = this.reels.map((r) => ({
        slot: r.slot,
        vert: r.vertIndex,
        left: this._slotLeft(r.slot),
      }));
      const startFrameOff = this.frameOffset;

      this.reels.forEach((r) => {
        const moving = plan.moves.some(
          (m) => m.reel === r && (m.reel.slot !== m.slot || m.vertDelta !== 0)
        );
        r.col.classList.toggle("moving", moving);
        r.col.classList.toggle("idle", !moving);
      });

      if (this.anim) cancelAnimationFrame(this.anim);

      const tick = (now) => {
        const t = clamp((now - start) / duration, 0, 1);
        const e = easeInOutCubic(t);

        for (const m of plan.moves) {
          const i = this.reels.indexOf(m.reel);
          const s = startFrames[i];
          const left = lerp(s.left, this._slotLeft(m.slot), e);
          const vert = s.vert + m.vertDelta * e;
          const y =
            this.windowCenterY - (vert * this.cellStep + this.cellSize / 2);
          m.reel.col.style.transition = "none";
          m.reel.col.style.left = `${left}px`;
          m.reel.stripEl.style.transition = "none";
          m.reel.stripEl.style.transform = `translateY(${y}px)`;
        }

        const fx = (startFrameOff + frameDelta * e) * this.cellStep;
        this.frameEl.style.transition = "none";
        this.frameEl.style.transform = `translateX(${fx}px)`;

        if (t < 1) {
          this.anim = requestAnimationFrame(tick);
        } else {
          for (const m of plan.moves) {
            m.reel.slot = m.slot;
            m.reel.vertIndex = clamp(m.vertTarget, 0, m.reel.baseLen - 1);
          }
          this.frameOffset = startFrameOff + frameDelta;
          if (!windowMatchesFact(this.reels, fact)) {
            for (const m of plan.moves) {
              m.reel.vertIndex = valueIndexInStrip(
                m.reel.strip,
                m.value,
                m.reel.vertIndex
              );
            }
          }
          this.reels.forEach((r) => {
            r.col.classList.remove("moving");
            r.col.classList.add("idle");
          });
          this._paintReels(true);
          this._paintFrame(true);
          requestAnimationFrame(() => {
            this._paintReels(false);
            this._paintFrame(false);
          });
        }
      };
      this.anim = requestAnimationFrame(tick);
    }

    _scheduleNext() {
      if (this.destroyed) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        if (this.destroyed) return;
        const nextIndex = this.factIndex + 1;
        if (nextIndex >= this.series.length) {
          const last = this.series[this.series.length - 1];
          this._newSeries(last);
          this.factIndex = 0;
          this._showFact(0, true);
        } else {
          this.factIndex = nextIndex;
          this._showFact(this.factIndex, true);
        }
        this._scheduleNext();
      }, this.options.transitionMs + this.options.pauseMs);
    }

    setOptions(opts) {
      Object.assign(this.options, opts);
      if (opts.operations) this.catalog = buildFactCatalog(this.options.operations);
      if (opts.windowMode) this._setWindowMode(opts.windowMode);
      if (opts.transitionMs != null) {
        this.speedSlider.value = String(opts.transitionMs);
        this.speedOut.textContent = String(opts.transitionMs);
      }
      if (opts.cellScale != null) {
        this.sizeSlider.value = String(opts.cellScale);
        this.sizeOut.textContent = `${opts.cellScale}%`;
      }
      if (opts.cellGap != null) {
        this.gapSlider.value = String(opts.cellGap);
        this.gapOut.textContent = `${opts.cellGap}px`;
      }
      if (opts.divMargin != null) {
        this.marginSlider.value = String(opts.divMargin);
        this.marginOut.textContent = `${opts.divMargin}px`;
      }
      if (opts.chainMode) {
        this.options.chainMode = opts.chainMode;
        this._syncChainButtons();
      }
      this._layout();
    }

    restart() {
      this._newSeries(null);
      this.factIndex = 0;
      this.frameOffset = 0;
      clearTimeout(this.timer);
      if (this.anim) cancelAnimationFrame(this.anim);
      this.reels.forEach((r) => {
        r.slot = REEL_DEFS.find((d) => d.id === r.id).slot;
        r.vertIndex = randInt(0, Math.max(0, r.baseLen - 1));
      });
      requestAnimationFrame(() => {
        this._showFact(0, true);
        this.timer = setTimeout(
          () => this._scheduleNext(),
          this.options.transitionMs + this.options.pauseMs
        );
      });
    }

    destroy() {
      this.destroyed = true;
      clearTimeout(this.timer);
      if (this.anim) cancelAnimationFrame(this.anim);
      this.root.remove();
    }
  }

  function factsDinColoaneAnimate(container, options) {
    if (!container) throw new Error("factsDinColoaneAnimate: container lipsă");
    const instance = new FactsColoaneInstance(container, options || {});
    return {
      destroy: () => instance.destroy(),
      setOptions: (opts) => instance.setOptions(opts),
      restart: () => instance.restart(),
    };
  }

  global.factsDinColoaneAnimate = factsDinColoaneAnimate;
})(typeof window !== "undefined" ? window : globalThis);
