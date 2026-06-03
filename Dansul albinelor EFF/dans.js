/**
 * Dansul albinelor EFF — motor reutilizabil de animație f8.
 *
 * Utilizare în Youlearn (ulterior):
 *   const app = DansAlbinelorEFF.create(containerElement, {
 *     arenaWidth: 300,
 *     arenaHeight: 600,
 *     direction: "down",           // "up" | "left" | "right" — pregătit, neimplementat vizual
 *     referenceLineRatio: 0.5,
 *     flowerIntervalSec: 2.4,
 *     lineCount: 1,                // mai multe șine — viitor
 *     streamBatchSize: 200,
 *     f0: { a: 3, op: "+", b: 2, r: 5 },
 *     // viitor: beeImages, flowerSkin, trailEffect, ...
 *   });
 *   app.restartRandomFact();
 *   app.setOptions({ flowerIntervalSec: 3 });
 *   app.destroy();
 */
(function (global) {
  "use strict";

  const F1_ORDER = [
    "f1_initial",
    "f1_comutat",
    "f1_complementar",
    "f1_complementar_comutat",
  ];
  const F2_ORDER = ["doua_nr_in_STANGA", "doua_nr_in_DREAPTA"];

  const DISPLAY_OP = { "+": "+", "-": "−", "*": "×", ":": "÷" };

  const DEFAULTS = {
    arenaWidth: 300,
    arenaHeight: 600,
    referenceLineRatio: 0.5,
    direction: "down",
    flowerIntervalSec: 2.4,
    streamBatchSize: 200,
    lineCount: 1,
    spacingFactor: 1.45,
    flashColor: "rgba(255, 140, 0, 0.55)",
    signColor: "#facc15",
    numberHiddenColor: "transparent",
    numberVisibleColor: "#ffffff",
    beeColor: "#2563eb",
    background: "#0f172a",
    overlapCenterPx: 3,
    overlapBeePx: 0.14,
    syncBeePx: 0.3,
    flowerDisplayMode: "all",
    signCompact: 0,
    trailLength: 55,
    pathRoundness: 55,
    sidebarWidth: 200,
  };

  const TRAIL_PALETTE = [
    [255, 183, 77],
    [255, 214, 102],
    [255, 160, 55],
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

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function isNumberToken(t) {
    return /^-?\d+$/.test(t);
  }

  function formatFact(f0) {
    const { a, op, b, r } = f0;
    return `${a}${DISPLAY_OP[op]}${b}=${r}`;
  }

  function randomF0() {
    const op = pick(["+", "-", "*", ":"]);
    if (op === "+") {
      const a = randInt(0, 10);
      const b = randInt(0, 10);
      return { a, op, b, r: a + b };
    }
    if (op === "-") {
      const a = randInt(0, 10);
      const b = randInt(0, a);
      return { a, op, b, r: a - b };
    }
    if (op === "*") {
      const a = randInt(1, 10);
      const b = randInt(1, 10);
      return { a, op, b, r: a * b };
    }
    const b = randInt(1, 10);
    const r = randInt(1, 10);
    const a = b * r;
    return { a, op, b, r };
  }

  function applyF1(raw, f1) {
    const { a, op, b, r } = raw;
    switch (f1) {
      case "f1_initial":
        return { x: a, op, y: b, r };
      case "f1_comutat":
        if (op === "+" || op === "*") return { x: b, op, y: a, r };
        return { x: a, op, y: r, r: b };
      case "f1_complementar":
        if (op === "+") return { x: r, op: "-", y: b, r: a };
        if (op === "-") return { x: r, op: "+", y: b, r: a };
        if (op === "*") return { x: r, op: ":", y: b, r: a };
        if (op === ":") return { x: r, op: "*", y: b, r: a };
        break;
      case "f1_complementar_comutat":
        if (op === "+") return { x: r, op: "-", y: a, r: b };
        if (op === "-") return { x: b, op: "+", y: r, r: a };
        if (op === "*") return { x: r, op: ":", y: a, r: b };
        if (op === ":") return { x: b, op: "*", y: r, r: a };
        break;
    }
    return null;
  }

  function applyF2(f1Fact, f2) {
    const { x, op, y, r } = f1Fact;
    const dOp = DISPLAY_OP[op] || op;
    if (f2 === "doua_nr_in_STANGA") {
      return [String(x), dOp, String(y), "=", String(r)];
    }
    return [String(r), "=", String(x), dOp, String(y)];
  }

  function isValidF1Fact(f1Fact) {
    if (!f1Fact) return false;
    if (f1Fact.op === ":" && Number(f1Fact.y) === 0) return false;
    return true;
  }

  function buildF8Catalog(f0) {
    const catalog = [];
    let id = 1;
    for (const f1 of F1_ORDER) {
      const f1Fact = applyF1(f0, f1);
      if (!isValidF1Fact(f1Fact)) continue;
      for (const f2 of F2_ORDER) {
        const tokens = applyF2(f1Fact, f2);
        const cells = tokens.map((text, index) => ({
          index,
          text,
          kind: isNumberToken(text) ? "number" : "sign",
        }));
        catalog.push({ f8id: id, f1, f2, tokens, cells });
        id += 1;
      }
    }
    return catalog;
  }

  function trioSlots(f0) {
    return [
      { slot: "a", value: String(f0.a) },
      { slot: "b", value: String(f0.b) },
      { slot: "r", value: String(f0.r) },
    ];
  }

  /** Succesiunea celor 3 numere în ordinea afișării (stânga → dreapta). */
  function f8NumberSuccession(catalog, f8id) {
    const f8 = catalog[f8id - 1];
    return f8.cells
      .filter((c) => c.kind === "number")
      .map((c) => c.text)
      .join("\u2192");
  }

  function pickF8Id(catalog, lastF8id) {
    const lastSeq = lastF8id ? f8NumberSuccession(catalog, lastF8id) : null;
    const candidates = [];
    for (let id = 1; id <= catalog.length; id += 1) {
      if (f8NumberSuccession(catalog, id) !== lastSeq) candidates.push(id);
    }
    return pick(candidates.length ? candidates : [1]);
  }

  class F8Stream {
    constructor(batchSize, catalog) {
      this.batchSize = batchSize;
      this.catalog = catalog;
      this.queue = [];
      this.lastF8id = null;
      this.refill();
    }

    refill() {
      for (let i = 0; i < this.batchSize; i += 1) {
        const id = pickF8Id(this.catalog, this.lastF8id);
        this.queue.push(id);
        this.lastF8id = id;
      }
    }

    next() {
      if (this.queue.length === 0) this.refill();
      const id = this.queue.shift();
      this.lastF8id = id;
      return id;
    }

    peek(offset) {
      while (this.queue.length <= offset) this.refill();
      return this.queue[offset];
    }
  }

  function cubicAt(p0, c1, c2, p1, u) {
    const m = 1 - u;
    return (
      m * m * m * p0 +
      3 * m * m * u * c1 +
      3 * m * u * u * c2 +
      u * u * u * p1
    );
  }

  function smoothstep(u) {
    return u * u * (3 - 2 * u);
  }

  function buildBeeKeyframes(beeIndex, syncEvents, opts) {
    if (syncEvents.length === 0) return { keyframes: [], segments: [], smoothU: false };

    const round = clamp(opts.pathRoundness, 0, 100) / 100;
    const refY = opts.referenceY;
    const arenaH = opts.arenaHeight;

    const keyframes = syncEvents.map((ev) => ({
      t: ev.t,
      x: ev.targets[beeIndex].x,
      y: ev.y,
    }));

    const segments = [];
    const bulgeX = lerp(26, 48, round) + beeIndex * 8;
    const liftY = lerp(10, arenaH * 0.2, round);
    const along = lerp(0.24, 0.5, round);
    const loftBlend = 0.5 + round * 0.4;

    for (let i = 0; i < keyframes.length - 1; i += 1) {
      const p0 = keyframes[i];
      const p1 = keyframes[i + 1];
      const dt = p1.t - p0.t;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist;
      const arcSign = (i + beeIndex) % 2 === 0 ? 1 : -1;
      const loftY = refY + arcSign * liftY;
      const bx = bulgeX * lerp(1, 0.65, round);

      segments.push({
        t0: p0.t,
        t1: p1.t,
        p0x: p0.x,
        p0y: p0.y,
        c1x: p0.x + dx * along + nx * bx,
        c1y: lerp(p0.y, loftY, loftBlend),
        c2x: p1.x - dx * along + nx * bx * 0.55,
        c2y: lerp(p1.y, loftY, loftBlend),
        p1x: p1.x,
        p1y: p1.y,
        dt,
      });
    }

    return { keyframes, segments, smoothU: round > 0.15 };
  }

  function evalBeePath(path, t) {
    const { keyframes, segments, smoothU } = path;
    if (keyframes.length === 0) return { x: 0, y: 0 };
    if (t <= keyframes[0].t) return { x: keyframes[0].x, y: keyframes[0].y };
    const last = keyframes[keyframes.length - 1];
    if (t >= last.t) return { x: last.x, y: last.y };

    for (const seg of segments) {
      if (t >= seg.t0 && t <= seg.t1) {
        let u = seg.dt > 0 ? (t - seg.t0) / seg.dt : 0;
        if (smoothU) u = smoothstep(u);
        return {
          x: cubicAt(seg.p0x, seg.c1x, seg.c2x, seg.p1x, u),
          y: cubicAt(seg.p0y, seg.c1y, seg.c2y, seg.p1y, u),
        };
      }
    }
    return { x: last.x, y: last.y };
  }

  class DansAlbinelorInstance {
    constructor(container, options) {
      this.container = container;
      this.options = { ...DEFAULTS, ...options };
      this.f0 = options.f0 || randomF0();
      this.catalog = buildF8Catalog(this.f0);
      this.trioSlots = trioSlots(this.f0);
      this.stream = new F8Stream(this.options.streamBatchSize, this.catalog);
      this.flowers = [];
      this.elapsed = 0;
      this.rafId = null;
      this.lastTs = null;
      this.syncHorizon = 0;
      this.beePaths = [];
      this.beeTrails = [[], [], []];
      this._lastBeePositions = null;
      this._buildDom();
      this._layoutMetrics();
      this._resetScene();
      this._bindControls();
      this._tick = this._tick.bind(this);
      this.rafId = requestAnimationFrame(this._tick);
    }

    _buildDom() {
      this.root = document.createElement("div");
      this.root.className = "dae-root";

      this.main = document.createElement("div");
      this.main.className = "dae-main";

      this.toolbar = document.createElement("div");
      this.toolbar.className = "dae-toolbar";

      this.factLabel = document.createElement("div");
      this.factLabel.className = "dae-fact-label";

      this.btnRestart = document.createElement("button");
      this.btnRestart.type = "button";
      this.btnRestart.className = "dae-btn";
      this.btnRestart.textContent = "Fact aleator (±×÷ 0–10) & restart";

      this.sliderLabel = document.createElement("label");
      this.sliderLabel.className = "dae-slider-label";

      this.intervalOut = document.createElement("output");
      this.intervalOut.className = "dae-interval-out";
      this.intervalOut.textContent = String(this.options.flowerIntervalSec);

      this.intervalSlider = document.createElement("input");
      this.intervalSlider.type = "range";
      this.intervalSlider.min = "0.8";
      this.intervalSlider.max = "5";
      this.intervalSlider.step = "0.1";
      this.intervalSlider.value = String(this.options.flowerIntervalSec);
      this.intervalSlider.className = "dae-slider";

      this.sliderLabel.append(
        "O floare la ",
        this.intervalOut,
        " secunde",
        this.intervalSlider
      );

      this.btnDisplayMode = document.createElement("button");
      this.btnDisplayMode.type = "button";
      this.btnDisplayMode.className = "dae-btn dae-btn-toggle";
      this._syncDisplayModeButton();

      this.signSliderLabel = document.createElement("label");
      this.signSliderLabel.className = "dae-slider-label";

      this.signCompactOut = document.createElement("output");
      this.signCompactOut.className = "dae-interval-out";
      this.signCompactOut.textContent = String(this.options.signCompact);

      this.signCompactSlider = document.createElement("input");
      this.signCompactSlider.type = "range";
      this.signCompactSlider.min = "0";
      this.signCompactSlider.max = "100";
      this.signCompactSlider.step = "1";
      this.signCompactSlider.value = String(this.options.signCompact);
      this.signCompactSlider.className = "dae-slider";

      this.signSliderLabel.append(
        "Strângere semne ",
        this.signCompactOut,
        "%",
        this.signCompactSlider
      );

      this.trailSliderLabel = document.createElement("label");
      this.trailSliderLabel.className = "dae-slider-label";

      this.trailLengthOut = document.createElement("output");
      this.trailLengthOut.className = "dae-interval-out";
      this.trailLengthOut.textContent = String(this.options.trailLength);

      this.trailLengthSlider = document.createElement("input");
      this.trailLengthSlider.type = "range";
      this.trailLengthSlider.min = "0";
      this.trailLengthSlider.max = "100";
      this.trailLengthSlider.step = "1";
      this.trailLengthSlider.value = String(this.options.trailLength);
      this.trailLengthSlider.className = "dae-slider";

      this.trailSliderLabel.append(
        "Coadă albine ",
        this.trailLengthOut,
        "%",
        this.trailLengthSlider
      );

      this.roundSliderLabel = document.createElement("label");
      this.roundSliderLabel.className = "dae-slider-label";

      this.pathRoundnessOut = document.createElement("output");
      this.pathRoundnessOut.className = "dae-interval-out";
      this.pathRoundnessOut.textContent = String(this.options.pathRoundness);

      this.pathRoundnessSlider = document.createElement("input");
      this.pathRoundnessSlider.type = "range";
      this.pathRoundnessSlider.min = "0";
      this.pathRoundnessSlider.max = "100";
      this.pathRoundnessSlider.step = "1";
      this.pathRoundnessSlider.value = String(this.options.pathRoundness);
      this.pathRoundnessSlider.className = "dae-slider";

      this.roundSliderLabel.append(
        "Rotunjire traiectorii ",
        this.pathRoundnessOut,
        "%",
        this.pathRoundnessSlider
      );

      this.toolbar.append(
        this.factLabel,
        this.btnRestart,
        this.btnDisplayMode,
        this.sliderLabel,
        this.signSliderLabel,
        this.trailSliderLabel,
        this.roundSliderLabel
      );

      this.arenaWrap = document.createElement("div");
      this.arenaWrap.className = "dae-arena-wrap";

      this.arena = document.createElement("div");
      this.arena.className = "dae-arena";
      this.arena.setAttribute("role", "img");
      this.arena.setAttribute("aria-label", "Dansul albinelor EFF");

      this.refLine = document.createElement("div");
      this.refLine.className = "dae-ref-line";

      this.flowerLayer = document.createElement("div");
      this.flowerLayer.className = "dae-flower-layer";

      this.trailCanvas = document.createElement("canvas");
      this.trailCanvas.className = "dae-trail-canvas";
      this.trailCanvas.setAttribute("aria-hidden", "true");
      this.trailCtx = this.trailCanvas.getContext("2d");

      this.beeLayer = document.createElement("div");
      this.beeLayer.className = "dae-bee-layer";

      this.bees = this.trioSlots.map((s, i) => {
        const el = document.createElement("div");
        el.className = "dae-bee";
        el.dataset.value = s.value;
        el.dataset.slot = s.slot;
        el.innerHTML = `<span class="dae-bee-text">${s.value}</span>`;
        el.style.setProperty("--bee-i", String(i));
        return { slot: s.slot, value: s.value, el };
      });

      this.arena.append(
        this.refLine,
        this.flowerLayer,
        this.trailCanvas,
        this.beeLayer
      );
      this.bees.forEach((b) => this.beeLayer.appendChild(b.el));
      this.arenaWrap.appendChild(this.arena);
      this.main.append(this.toolbar, this.arenaWrap);
      this.root.append(this.main);
      this.container.replaceChildren(this.root);
      this.toolbar.style.width = `${this.options.sidebarWidth}px`;
    }

    _bindControls() {
      this.btnRestart.addEventListener("click", () => this.restartRandomFact());
      this.btnDisplayMode.addEventListener("click", () => {
        this.options.flowerDisplayMode =
          this.options.flowerDisplayMode === "all" ? "oneQuestion" : "all";
        this._syncDisplayModeButton();
        this.flowers.forEach((f) => this._applyFlowerDisplay(f));
      });
      this.intervalSlider.addEventListener("input", () => {
        this.options.flowerIntervalSec = Number(this.intervalSlider.value);
        this.intervalOut.textContent = this.intervalSlider.value;
        this._layoutMetrics();
        this._rebuildBeePaths();
      });
      this.signCompactSlider.addEventListener("input", () => {
        this.options.signCompact = Number(this.signCompactSlider.value);
        this.signCompactOut.textContent = this.signCompactSlider.value;
        this._layoutMetrics();
        this._refreshFlowerCellWidths();
        this._rebuildBeePaths();
      });
      this.trailLengthSlider.addEventListener("input", () => {
        this.options.trailLength = Number(this.trailLengthSlider.value);
        this.trailLengthOut.textContent = this.trailLengthSlider.value;
        if (this.options.trailLength <= 0) this._clearBeeTrails();
        this._drawBeeTrails(this._lastBeePositions);
      });
      this.pathRoundnessSlider.addEventListener("input", () => {
        this.options.pathRoundness = Number(this.pathRoundnessSlider.value);
        this.pathRoundnessOut.textContent = this.pathRoundnessSlider.value;
        this._rebuildBeePaths();
      });
    }

    _pathBuildOpts() {
      return {
        pathRoundness: this.options.pathRoundness,
        referenceY: this.referenceY,
        arenaHeight: this.options.arenaHeight,
      };
    }

    _clearBeeTrails() {
      this.beeTrails.forEach((t) => (t.length = 0));
    }

    /** Aceeași derulare ca florile — coada rămâne pe ecuațiile de jos. */
    _scrollBeeTrails(dy) {
      if (!dy) return;
      const lo = -this.flowerHeight * 2;
      const hi = this.options.arenaHeight + this.flowerHeight * 2;

      this.beeTrails.forEach((trail) => {
        for (const p of trail) p.y += dy;
        for (let i = trail.length - 1; i >= 0; i -= 1) {
          if (trail[i].y < lo || trail[i].y > hi) trail.splice(i, 1);
        }
      });
    }

    _trailMaxPathLength() {
      const strength = clamp(this.options.trailLength, 0, 100) / 100;
      if (strength <= 0) return 0;
      return lerp(50, this.options.arenaHeight * 1.2, strength);
    }

    _pruneTrail(trail, maxLen) {
      if (maxLen <= 0) {
        trail.length = 0;
        return;
      }
      if (trail.length < 2) return;

      let total = 0;
      for (let i = trail.length - 1; i > 0; i -= 1) {
        total += Math.hypot(trail[i].x - trail[i - 1].x, trail[i].y - trail[i - 1].y);
      }
      while (total > maxLen && trail.length > 1) {
        total -= Math.hypot(trail[1].x - trail[0].x, trail[1].y - trail[0].y);
        trail.shift();
      }
    }

    _beeEmitPoint(pos) {
      return { x: pos.x, y: pos.y };
    }

    _appendTrailPoints(trail, from, to) {
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      if (dist < 0.5) return;
      const step = 3;
      for (let d = step; d < dist; d += step) {
        const u = d / dist;
        trail.push({
          x: lerp(from.x, to.x, u),
          y: lerp(from.y, to.y, u),
        });
      }
      trail.push({ x: to.x, y: to.y });
    }

    _recordBeeTrails(beePositions) {
      const strength = clamp(this.options.trailLength, 0, 100) / 100;
      if (strength <= 0) return;

      const maxLen = this._trailMaxPathLength();

      beePositions.forEach((pos, i) => {
        const emit = this._beeEmitPoint(pos);
        const trail = this.beeTrails[i];
        const last = trail[trail.length - 1];

        if (!last) {
          trail.push({ x: emit.x, y: emit.y });
        } else if (Math.hypot(last.x - emit.x, last.y - emit.y) > 0.8) {
          this._appendTrailPoints(trail, last, emit);
        }

        this._pruneTrail(trail, maxLen);
      });
    }

    _drawTrailDot(ctx, x, y, alpha, beeIndex, size) {
      const rgb = TRAIL_PALETTE[beeIndex % TRAIL_PALETTE.length];
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    _drawBeeTrails(beePositions) {
      const ctx = this.trailCtx;
      const w = this.options.arenaWidth;
      const h = this.options.arenaHeight;
      const strength = clamp(this.options.trailLength, 0, 100) / 100;

      ctx.clearRect(0, 0, w, h);
      if (strength <= 0) return;

      const positions = beePositions || [];

      this.beeTrails.forEach((trail, beeIndex) => {
        const points = trail.length > 0 ? trail.slice() : [];

        if (positions[beeIndex]) {
          const head = this._beeEmitPoint(positions[beeIndex]);
          const tail = points[points.length - 1];
          if (!tail || Math.hypot(tail.x - head.x, tail.y - head.y) > 0.5) {
            points.push(head);
          }
        }

        if (points.length === 0) return;

        const lastIdx = points.length - 1;

        for (let j = 0; j < points.length; j += 1) {
          const p = points[j];
          const t = lastIdx > 0 ? j / lastIdx : 1;
          const alpha = (0.14 + 0.58 * t) * strength;
          const size = 1.1 + t * 2;
          this._drawTrailDot(ctx, p.x, p.y, alpha, beeIndex + j, size);
        }
      });
    }

    _syncDisplayModeButton() {
      const q = this.options.flowerDisplayMode === "oneQuestion";
      this.btnDisplayMode.textContent = q
        ? "Floare: un „?” (click → toate numerele)"
        : "Floare: toate numerele (click → un „?”)";
      this.btnDisplayMode.classList.toggle("dae-btn-toggle--on", q);
    }

    _compactMetrics() {
      const t = clamp(this.options.signCompact, 0, 100) / 100;
      const c = this.cellSize;

      if (t <= 0) {
        return { numW: c, signW: c, gap: 0, span: c * 5, left: 0 };
      }

      const numW = c * lerp(1, 0.86, t);
      const signW = c * lerp(1, 0.12, t);
      const gap = c * lerp(0, 0.05, Math.pow(t, 0.75));
      const span = 3 * numW + 2 * signW + 4 * gap;
      const left = (this.options.arenaWidth - span) / 2;

      return { numW, signW, gap, span, left };
    }

    _cellCenterXForF8(f8id, cellIndex) {
      const f8 = this.catalog[f8id - 1];
      const { numW, signW, gap, left } = this._compactMetrics();
      let x = left;
      for (let i = 0; i < cellIndex; i += 1) {
        const w = f8.cells[i].kind === "sign" ? signW : numW;
        x += w + gap;
      }
      const w = f8.cells[cellIndex].kind === "sign" ? signW : numW;
      return x + w / 2;
    }

    _layoutMetrics() {
      const o = this.options;
      this.cellSize = Math.floor(o.arenaWidth / 5);
      this.flowerHeight = this.cellSize;
      this.spacing = this.flowerHeight * o.spacingFactor;
      this.speed = this.spacing / o.flowerIntervalSec;
      this.referenceY = o.arenaHeight * o.referenceLineRatio;
      this.fontSize = Math.max(14, Math.floor(this.cellSize * 0.52));

      this.arena.style.width = `${o.arenaWidth}px`;
      this.arena.style.height = `${o.arenaHeight}px`;
      this.arena.style.background = o.background;
      this.refLine.style.top = `${this.referenceY}px`;

      const dpr = window.devicePixelRatio || 1;
      this.trailCanvas.width = Math.floor(o.arenaWidth * dpr);
      this.trailCanvas.height = Math.floor(o.arenaHeight * dpr);
      this.trailCanvas.style.width = `${o.arenaWidth}px`;
      this.trailCanvas.style.height = `${o.arenaHeight}px`;
      this.trailCtx.setTransform(1, 0, 0, 1, 0, 0);
      this.trailCtx.scale(dpr, dpr);

      this.root.style.setProperty("--dae-cell", `${this.cellSize}px`);
      this.root.style.setProperty("--dae-font", `${this.fontSize}px`);
      this.root.style.setProperty("--dae-sign", o.signColor);
      this.root.style.setProperty("--dae-num-hidden", o.numberHiddenColor);
      this.root.style.setProperty("--dae-num-visible", o.numberVisibleColor);
      this.root.style.setProperty("--dae-bee", o.beeColor);
      this.root.style.setProperty("--dae-flash", o.flashColor);

      const { numW } = this._compactMetrics();
      this.beeBox = Math.floor(numW);

      this.bees.forEach((b) => {
        b.el.style.width = `${this.beeBox}px`;
        b.el.style.height = `${this.cellSize}px`;
      });

      this._updateFactLabel();
      this._refreshFlowerCellWidths();
    }

    _updateFactLabel() {
      this.factLabel.textContent = `F0: ${formatFact(this.f0)}  ·  f8 × ${this.catalog.length}`;
    }

    _flowerCenterY(flower) {
      return flower.y + this.flowerHeight / 2;
    }

    /** Poziții X pentru cele 3 albine (a, b, r), inclusiv valori duplicate. */
    _beeTargetsForF8(f8id) {
      const f8 = this.catalog[f8id - 1];
      const numberCells = f8.cells
        .filter((c) => c.kind === "number")
        .sort((a, b) => a.index - b.index);
      const used = new Set();

      return this.trioSlots.map((slot) => {
        let cell = numberCells.find(
          (c) => !used.has(c.index) && c.text === slot.value
        );
        if (!cell) {
          cell = numberCells.find((c) => !used.has(c.index));
        }
        used.add(cell.index);
        return {
          slot: slot.slot,
          value: slot.value,
          cellIndex: cell.index,
          x: this._cellCenterXForF8(f8id, cell.index),
        };
      });
    }

    _pickHiddenNumberIndex(f8id) {
      const f8 = this.catalog[f8id - 1];
      const indices = f8.cells
        .filter((c) => c.kind === "number")
        .map((c) => c.index);
      return pick(indices);
    }

    _applyFlowerCellWidths(el, f8id) {
      const f8 = this.catalog[f8id - 1];
      const { numW, signW, gap, span, left } = this._compactMetrics();
      const cells = el.querySelectorAll(".dae-flower-cell");

      el.style.width = `${span}px`;
      el.style.left = `${left}px`;
      el.style.right = "auto";

      f8.cells.forEach((cell, i) => {
        const w = cell.kind === "sign" ? signW : numW;
        const cellEl = cells[i];
        cellEl.style.flex = "0 0 auto";
        cellEl.style.width = `${w}px`;
        cellEl.style.maxWidth = `${w}px`;
        cellEl.style.minWidth = `${w}px`;
        cellEl.style.marginLeft = i === 0 ? "0" : `${gap}px`;
      });
    }

    _applyFlowerDisplay(flower) {
      const f8 = this.catalog[flower.f8id - 1];
      const cells = flower.el.querySelectorAll(".dae-flower-cell");
      f8.cells.forEach((cell, i) => {
        if (cell.kind !== "number") return;
        const cellEl = cells[i];
        if (!flower.revealed) {
          cellEl.textContent = cell.text;
          return;
        }
        if (
          this.options.flowerDisplayMode === "oneQuestion" &&
          cell.index === flower.hiddenAtIndex
        ) {
          cellEl.textContent = "?";
        } else {
          cellEl.textContent = cell.text;
        }
      });
    }

    _refreshFlowerCellWidths() {
      for (const flower of this.flowers) {
        this._applyFlowerCellWidths(flower.el, flower.f8id);
      }
    }

    _makeFlowerEl(f8id) {
      const f8 = this.catalog[f8id - 1];
      const el = document.createElement("div");
      el.className = "dae-flower";
      el.dataset.f8id = String(f8id);
      el.style.height = `${this.flowerHeight}px`;

      f8.cells.forEach((cell) => {
        const cellEl = document.createElement("div");
        cellEl.className = `dae-flower-cell dae-flower-cell--${cell.kind}`;
        cellEl.textContent = cell.text;
        cellEl.dataset.index = String(cell.index);
        el.appendChild(cellEl);
      });

      this._applyFlowerCellWidths(el, f8id);
      return el;
    }

    _spawnFlower(f8id, centerY) {
      const el = this._makeFlowerEl(f8id);
      const y = centerY - this.flowerHeight / 2;
      el.style.transform = `translateY(${y}px)`;
      this.flowerLayer.appendChild(el);
      const flower = {
        f8id,
        el,
        y,
        flashing: false,
        revealed: false,
        hiddenAtIndex: this._pickHiddenNumberIndex(f8id),
      };
      this.flowers.push(flower);
      return flower;
    }

    _resetScene() {
      this.flowerLayer.replaceChildren();
      this.flowers = [];
      this.elapsed = 0;
      this.lastTs = null;
      this._clearBeeTrails();
      this.stream = new F8Stream(this.options.streamBatchSize, this.catalog);

      const count = Math.ceil(this.options.arenaHeight / this.spacing) + 4;
      for (let i = -2; i < count; i += 1) {
        const f8id = this.stream.next();
        const centerY = this.referenceY + i * this.spacing;
        this._spawnFlower(f8id, centerY);
      }

      this.flowers.sort((a, b) => a.y - b.y);
      this._rebuildBeePaths();
    }

    _rebuildBeePaths(fromTime) {
      const now = fromTime ?? this.elapsed;
      const events = [];
      let streamStep = 0;

      let nearest = null;
      let nearestDist = Infinity;
      for (const f of this.flowers) {
        const d = Math.abs(this._flowerCenterY(f) - this.referenceY);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = f;
        }
      }
      if (nearest && nearestDist < this.flowerHeight * 0.6) {
        events.push({
          t: now,
          f8id: nearest.f8id,
          targets: this._beeTargetsForF8(nearest.f8id),
          y: this.referenceY,
        });
      }

      let virtual = this.flowers.map((f) => ({
        f8id: f.f8id,
        centerY: this._flowerCenterY(f),
      }));

      let simTime = now;

      for (let n = 0; n < 48; n += 1) {
        let candidateIdx = -1;
        let candidateCenter = -Infinity;

        for (let i = 0; i < virtual.length; i += 1) {
          const cy = virtual[i].centerY;
          if (cy < this.referenceY - 0.5 && cy > candidateCenter) {
            candidateCenter = cy;
            candidateIdx = i;
          }
        }

        if (candidateIdx < 0) break;

        const candidate = virtual[candidateIdx];
        const wait = (this.referenceY - candidate.centerY) / this.speed;
        simTime += wait;

        const duplicate = events.some(
          (ev) => Math.abs(ev.t - simTime) < 0.02 && ev.f8id === candidate.f8id
        );
        if (!duplicate) {
          events.push({
            t: simTime,
            f8id: candidate.f8id,
            targets: this._beeTargetsForF8(candidate.f8id),
            y: this.referenceY,
          });
        }

        const shift = wait * this.speed;
        for (const v of virtual) v.centerY += shift;

        const minCenter = Math.min(...virtual.map((v) => v.centerY));
        virtual.splice(candidateIdx, 1);
        virtual.push({
          f8id: this.stream.peek(streamStep),
          centerY: minCenter - this.spacing,
        });
        streamStep += 1;
      }

      events.sort((a, b) => a.t - b.t);
      this.syncHorizon = events.length ? events[events.length - 1].t : now + 10;
      this.beePaths = this.trioSlots.map((_, i) =>
        buildBeeKeyframes(i, events, this._pathBuildOpts())
      );
    }

    _flowerInRefBand(flower) {
      const half = this.flowerHeight / 2 + 2;
      return Math.abs(this._flowerCenterY(flower) - this.referenceY) <= half;
    }

    _beesAlignedToFlower(flower, beePositions, centerTolPx, beeTolFactor) {
      const centerY = this._flowerCenterY(flower);
      if (Math.abs(centerY - this.referenceY) > centerTolPx) return false;

      const targets = this._beeTargetsForF8(flower.f8id);
      const tol = Math.max(6, this.cellSize * beeTolFactor);
      const ty = this.referenceY;

      for (let i = 0; i < targets.length; i += 1) {
        const tx = targets[i].x;
        if (Math.hypot(beePositions[i].x - tx, beePositions[i].y - ty) > tol) {
          return false;
        }
      }
      return true;
    }

    _isPerfectOverlap(flower, beePositions) {
      return this._beesAlignedToFlower(
        flower,
        beePositions,
        this.options.overlapCenterPx,
        this.options.overlapBeePx
      );
    }

    _canRevealFlower(flower, beePositions) {
      if (!this._flowerInRefBand(flower)) return false;
      return this._beesAlignedToFlower(
        flower,
        beePositions,
        this.flowerHeight / 2 + 4,
        this.options.syncBeePx
      );
    }

    _updateFlowerSync(flower, beePositions) {
      const perfect = this._isPerfectOverlap(flower, beePositions);
      const canReveal = !flower.revealed && this._canRevealFlower(flower, beePositions);

      if (canReveal) {
        flower.revealed = true;
        flower.el.classList.add("dae-flower--revealed");
        this._applyFlowerDisplay(flower);
      } else if (!flower.revealed) {
        const flowerTop = this._flowerCenterY(flower) - this.flowerHeight / 2;
        if (flowerTop > this.referenceY + 8) {
          flower.revealed = true;
          flower.el.classList.add("dae-flower--revealed");
          this._applyFlowerDisplay(flower);
        }
      } else {
        flower.el.classList.add("dae-flower--revealed");
      }

      if (perfect !== flower.flashing) {
        flower.flashing = perfect;
        flower.el.classList.toggle("dae-flower--flash", perfect);
      }
    }

    _recycleFlowers() {
      const bottomLimit = this.options.arenaHeight + this.flowerHeight * 2;

      this.flowers = this.flowers.filter((f) => {
        if (this._flowerCenterY(f) > bottomLimit) {
          f.el.remove();
          return false;
        }
        return true;
      });

      if (this.flowers.length === 0) {
        this._spawnFlower(this.stream.next(), this.referenceY - this.spacing);
        return;
      }

      let topCenter = Math.min(...this.flowers.map((f) => this._flowerCenterY(f)));
      while (topCenter > this.flowerHeight * 0.5) {
        const f8id = this.stream.next();
        const newCenter = topCenter - this.spacing;
        this._spawnFlower(f8id, newCenter);
        topCenter = newCenter;
      }
    }

    _tick(ts) {
      if (this.lastTs == null) this.lastTs = ts;
      const dt = Math.min((ts - this.lastTs) / 1000, 0.05);
      this.lastTs = ts;
      this.elapsed += dt;

      const dir = this.options.direction === "down" ? 1 : -1;
      const scrollDy = this.speed * dt * dir;

      for (const flower of this.flowers) {
        flower.y += scrollDy;
        flower.el.style.transform = `translateY(${flower.y}px)`;
      }

      this._scrollBeeTrails(scrollDy);
      this._recycleFlowers();

      if (this.elapsed > this.syncHorizon - 4) {
        this._rebuildBeePaths(this.elapsed);
      }

      const beePositions = this.bees.map((bee, i) => {
        const pos = evalBeePath(this.beePaths[i], this.elapsed);
        const half = (this.beeBox || this.cellSize) / 2;
        bee.el.style.transform = `translate(${pos.x - half}px, ${pos.y - this.cellSize / 2}px)`;
        return { slot: bee.slot, value: bee.value, x: pos.x, y: pos.y };
      });

      for (const flower of this.flowers) {
        this._updateFlowerSync(flower, beePositions);
      }

      this._lastBeePositions = beePositions;
      this._recordBeeTrails(beePositions);
      this._drawBeeTrails(beePositions);

      this.rafId = requestAnimationFrame(this._tick);
    }

    setF0(f0) {
      this.f0 = f0;
      this.catalog = buildF8Catalog(this.f0);
      this.trioSlots = trioSlots(this.f0);
      this.bees.forEach((bee, i) => {
        bee.slot = this.trioSlots[i].slot;
        bee.value = this.trioSlots[i].value;
        bee.el.dataset.value = bee.value;
        bee.el.dataset.slot = bee.slot;
        bee.el.querySelector(".dae-bee-text").textContent = bee.value;
      });
      this._layoutMetrics();
      this._resetScene();
    }

    restartRandomFact() {
      this.setF0(randomF0());
    }

    setOptions(partial) {
      Object.assign(this.options, partial);
      if (partial.flowerIntervalSec != null) {
        this.intervalSlider.value = String(partial.flowerIntervalSec);
        this.intervalOut.textContent = String(partial.flowerIntervalSec);
      }
      if (partial.signCompact != null) {
        this.signCompactSlider.value = String(partial.signCompact);
        this.signCompactOut.textContent = String(partial.signCompact);
      }
      if (partial.flowerDisplayMode != null) {
        this._syncDisplayModeButton();
      }
      if (partial.trailLength != null) {
        this.trailLengthSlider.value = String(partial.trailLength);
        this.trailLengthOut.textContent = String(partial.trailLength);
      }
      if (partial.pathRoundness != null) {
        this.pathRoundnessSlider.value = String(partial.pathRoundness);
        this.pathRoundnessOut.textContent = String(partial.pathRoundness);
      }
      if (partial.sidebarWidth != null) {
        this.toolbar.style.width = `${partial.sidebarWidth}px`;
      }
      this._layoutMetrics();
      this._refreshFlowerCellWidths();
      this.flowers.forEach((f) => this._applyFlowerDisplay(f));
      this._rebuildBeePaths();
    }

    destroy() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.container.replaceChildren();
    }

    getState() {
      return {
        f0: { ...this.f0 },
        catalog: this.catalog,
        options: { ...this.options },
      };
    }
  }

  const DansAlbinelorEFF = {
    DEFAULTS,
    randomF0,
    buildF8Catalog,
    formatFact,
    create(container, options = {}) {
      return new DansAlbinelorInstance(container, options);
    },
  };

  global.DansAlbinelorEFF = DansAlbinelorEFF;
})(typeof window !== "undefined" ? window : globalThis);
