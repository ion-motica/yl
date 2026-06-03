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
    numberVisibleColor: "#1e293b",
    beeColor: "#2563eb",
    background: "#0f172a",
    overlapCenterPx: 3,
    overlapBeePx: 0.14,
  };

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
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

  function trioValues(f0) {
    return [String(f0.a), String(f0.b), String(f0.r)];
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

  function buildBeeKeyframes(beeValue, syncEvents, beeIndex) {
    if (syncEvents.length === 0) return [];

    const keyframes = syncEvents.map((ev) => ({
      t: ev.t,
      x: ev.xByValue.get(beeValue),
      y: ev.y,
    }));

    const segments = [];
    const wander = 28 + beeIndex * 11;

    for (let i = 0; i < keyframes.length - 1; i += 1) {
      const p0 = keyframes[i];
      const p1 = keyframes[i + 1];
      const dt = p1.t - p0.t;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;
      const sign = beeIndex % 2 === 0 ? 1 : -1;
      const bulge = sign * wander * (0.65 + 0.15 * beeIndex);

      segments.push({
        t0: p0.t,
        t1: p1.t,
        p0x: p0.x,
        p0y: p0.y,
        c1x: p0.x + dx * 0.28 + nx * bulge,
        c1y: p0.y + dy * 0.28 + ny * bulge * 0.35,
        c2x: p1.x - dx * 0.28 + nx * bulge * 0.6,
        c2y: p1.y - dy * 0.28 - ny * bulge * 0.25,
        p1x: p1.x,
        p1y: p1.y,
        dt,
      });
    }

    return { keyframes, segments };
  }

  function evalBeePath(path, t) {
    const { keyframes, segments } = path;
    if (keyframes.length === 0) return { x: 0, y: 0 };
    if (t <= keyframes[0].t) return { x: keyframes[0].x, y: keyframes[0].y };
    const last = keyframes[keyframes.length - 1];
    if (t >= last.t) return { x: last.x, y: last.y };

    for (const seg of segments) {
      if (t >= seg.t0 && t <= seg.t1) {
        const u = seg.dt > 0 ? (t - seg.t0) / seg.dt : 0;
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
      this.trio = trioValues(this.f0);
      this.stream = new F8Stream(this.options.streamBatchSize, this.catalog);
      this.flowers = [];
      this.elapsed = 0;
      this.rafId = null;
      this.lastTs = null;
      this.syncHorizon = 0;
      this.beePaths = [];
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

      this.toolbar.append(this.factLabel, this.btnRestart, this.sliderLabel);

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

      this.beeLayer = document.createElement("div");
      this.beeLayer.className = "dae-bee-layer";

      this.bees = this.trio.map((value, i) => {
        const el = document.createElement("div");
        el.className = "dae-bee";
        el.dataset.value = value;
        el.innerHTML = `<span class="dae-bee-text">${value}</span>`;
        el.style.setProperty("--bee-i", String(i));
        return { value, el };
      });

      this.arena.append(this.refLine, this.flowerLayer, this.beeLayer);
      this.bees.forEach((b) => this.beeLayer.appendChild(b.el));
      this.arenaWrap.appendChild(this.arena);
      this.root.append(this.toolbar, this.arenaWrap);
      this.container.replaceChildren(this.root);
    }

    _bindControls() {
      this.btnRestart.addEventListener("click", () => this.restartRandomFact());
      this.intervalSlider.addEventListener("input", () => {
        this.options.flowerIntervalSec = Number(this.intervalSlider.value);
        this.intervalOut.textContent = this.intervalSlider.value;
        this._layoutMetrics();
        this._rebuildBeePaths();
      });
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

      this.root.style.setProperty("--dae-cell", `${this.cellSize}px`);
      this.root.style.setProperty("--dae-font", `${this.fontSize}px`);
      this.root.style.setProperty("--dae-sign", o.signColor);
      this.root.style.setProperty("--dae-num-hidden", o.numberHiddenColor);
      this.root.style.setProperty("--dae-num-visible", o.numberVisibleColor);
      this.root.style.setProperty("--dae-bee", o.beeColor);
      this.root.style.setProperty("--dae-flash", o.flashColor);

      this.bees.forEach((b) => {
        b.el.style.width = `${this.cellSize}px`;
        b.el.style.height = `${this.cellSize}px`;
      });

      this._updateFactLabel();
    }

    _updateFactLabel() {
      this.factLabel.textContent = `F0: ${formatFact(this.f0)}  ·  f8 × ${this.catalog.length}`;
    }

    _cellCenterX(cellIndex) {
      return (cellIndex + 0.5) * this.cellSize;
    }

    _flowerCenterY(flower) {
      return flower.y + this.flowerHeight / 2;
    }

    _xByValueForF8(f8id) {
      const f8 = this.catalog[f8id - 1];
      const map = new Map();
      f8.cells.forEach((cell) => {
        if (cell.kind === "number") {
          map.set(cell.text, this._cellCenterX(cell.index));
        }
      });
      return map;
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
      return el;
    }

    _spawnFlower(f8id, centerY) {
      const el = this._makeFlowerEl(f8id);
      const y = centerY - this.flowerHeight / 2;
      el.style.transform = `translateY(${y}px)`;
      this.flowerLayer.appendChild(el);
      const flower = { f8id, el, y, flashing: false, revealed: false };
      this.flowers.push(flower);
      return flower;
    }

    _resetScene() {
      this.flowerLayer.replaceChildren();
      this.flowers = [];
      this.elapsed = 0;
      this.lastTs = null;
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
          xByValue: this._xByValueForF8(nearest.f8id),
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
            xByValue: this._xByValueForF8(candidate.f8id),
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
      this.beePaths = this.trio.map((value, i) =>
        buildBeeKeyframes(value, events, i)
      );
    }

    _isPerfectOverlap(flower, beePositions) {
      const centerY = this._flowerCenterY(flower);
      if (Math.abs(centerY - this.referenceY) > this.options.overlapCenterPx) {
        return false;
      }

      const f8 = this.catalog[flower.f8id - 1];
      const cells = f8.cells.filter((c) => c.kind === "number");
      const tol = Math.max(4, this.cellSize * this.options.overlapBeePx);
      const used = new Set();

      for (const cell of cells) {
        const tx = this._cellCenterX(cell.index);
        const ty = this.referenceY;
        let matched = false;

        for (let i = 0; i < beePositions.length; i += 1) {
          if (used.has(i)) continue;
          if (beePositions[i].value !== cell.text) continue;
          if (Math.hypot(beePositions[i].x - tx, beePositions[i].y - ty) <= tol) {
            used.add(i);
            matched = true;
            break;
          }
        }
        if (!matched) return false;
      }
      return true;
    }

    _updateFlowerSync(flower, beePositions) {
      const aligned = this._isPerfectOverlap(flower, beePositions);

      if (aligned && !flower.revealed) {
        flower.revealed = true;
        flower.el.classList.add("dae-flower--revealed");
      }

      if (aligned !== flower.flashing) {
        flower.flashing = aligned;
        flower.el.classList.toggle("dae-flower--flash", aligned);
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
      for (const flower of this.flowers) {
        flower.y += this.speed * dt * dir;
        flower.el.style.transform = `translateY(${flower.y}px)`;
      }

      this._recycleFlowers();

      if (this.elapsed > this.syncHorizon - 4) {
        this._rebuildBeePaths(this.elapsed);
      }

      const beePositions = this.bees.map((bee, i) => {
        const pos = evalBeePath(this.beePaths[i], this.elapsed);
        bee.el.style.transform = `translate(${pos.x - this.cellSize / 2}px, ${pos.y - this.cellSize / 2}px)`;
        return { value: bee.value, x: pos.x, y: pos.y };
      });

      for (const flower of this.flowers) {
        this._updateFlowerSync(flower, beePositions);
      }

      this.rafId = requestAnimationFrame(this._tick);
    }

    setF0(f0) {
      this.f0 = f0;
      this.catalog = buildF8Catalog(this.f0);
      this.trio = trioValues(this.f0);
      this.bees.forEach((bee, i) => {
        bee.value = this.trio[i];
        bee.el.dataset.value = bee.value;
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
      this._layoutMetrics();
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
