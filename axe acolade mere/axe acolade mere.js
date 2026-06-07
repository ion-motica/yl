/**
 * Axe, acolade, mere — vizualizare facts +/- pe axă numerică.
 *
 * axeAcoladeMere(container, options?) → { destroy, setOptions, setSeries, fname, getFacts, getSeries }
 * fname(equation, target?, options?) → { svg, model, width, height }
 */
(function (global) {
  "use strict";

  const DISPLAY_OP = { "+": "+", "-": "−" };

  const DEFAULTS = {
    showAxaNumere: true,
    showNumereAxaNumere: true,
    showNumereAxaInJurulSegmentuluiMicDreapta: true,
    afiseazaObiecte: true,
    obiectAfisat: "mere",
    afiseazaAcoladeNumereMici: true,
    afiseazaAcoladaNumarMare: true,
    afiseazaNumarLaUnknown: false,
    axisStart: -2,
    axisEndPadding: 3,
    axisHideTailAfterLast: 5,
    viewWidth: 720,
    viewHeight: 240,
    seriesLength: 10,
    series: null,
  };

  const OBJECT_TYPES = ["mere", "lamai", "flori", "discuri"];

  /** Generează toate facts din tablele + și − (0–10), ambele orientări F2. */
  function generatePlusMinusFacts() {
    const facts = [];
    for (let a = 0; a <= 10; a += 1) {
      for (let b = 0; b <= 10; b += 1) {
        const sum = a + b;
        facts.push(`${a}+${b}=${sum}`);
        facts.push(`${sum}=${a}+${b}`);
      }
    }
    for (let a = 0; a <= 10; a += 1) {
      for (let b = 0; b <= 10; b += 1) {
        const diff = a - b;
        if (diff < 0) continue;
        facts.push(`${a}-${b}=${diff}`);
        facts.push(`${diff}=${a}-${b}`);
      }
    }
    return facts;
  }

  const ALL_FACTS = generatePlusMinusFacts();

  /** Serie fixă de 10 ecuații +/- (0–10), alternând facts complete și cu ?. */
  function buildDefaultFactSeries(length = 10) {
    const curated = [
      "3+7=10",
      "3+?=10",
      "2+8=10",
      "?+5=8",
      "10-7=3",
      "10-?=4",
      "9-4=5",
      "6+?=10",
      "10=3+7",
      "4=10-6",
    ];
    if (length <= curated.length) return curated.slice(0, length);
    const out = curated.slice();
    for (let i = curated.length; i < length; i += 1) {
      out.push(ALL_FACTS[i % ALL_FACTS.length]);
    }
    return out;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function normalizeEquation(raw) {
    return String(raw || "")
      .replace(/\s/g, "")
      .replace(/×/g, "*")
      .replace(/÷|:/g, "/")
      .replace(/−/g, "-");
  }

  function tokenKind(tok) {
    if (tok === "?") return "unknown";
    if (/^\d+$/.test(tok)) return "number";
    return "other";
  }

  /** Rezolvă ecuația; returnează model pentru desen. */
  function parseEquation(raw) {
    const eq = normalizeEquation(raw);
    const eqIdx = eq.indexOf("=");
    if (eqIdx < 0) throw new Error(`Lipsește '=': ${raw}`);

    const left = eq.slice(0, eqIdx);
    const right = eq.slice(eqIdx + 1);

    function parseExpr(side) {
      const m = side.match(/^(\?|\d+)([\+\-])(\?|\d+)$/);
      if (m) return { kind: "expr", a: m[1], op: m[2], b: m[3] };
      const n = side.match(/^(\?|\d+)$/);
      if (n) return { kind: "num", n: n[1] };
      throw new Error(`Expresie invalidă: ${side}`);
    }

    const L = parseExpr(left);
    const R = parseExpr(right);

    let aTok;
    let op;
    let bTok;
    let cTok;
    let orientation;

    if (L.kind === "expr" && R.kind === "num") {
      aTok = L.a;
      op = L.op;
      bTok = L.b;
      cTok = R.n;
      orientation = "stanga";
    } else if (L.kind === "num" && R.kind === "expr") {
      aTok = R.a;
      op = R.op;
      bTok = R.b;
      cTok = L.n;
      orientation = "dreapta";
    } else {
      throw new Error(`Formă neacceptată (deocamdata): ${eq}`);
    }

    if (op !== "+" && op !== "-") {
      throw new Error(`Operator neacceptat deocamdata: ${op}`);
    }

    const slots = [
      { key: "a", tok: aTok },
      { key: "b", tok: bTok },
      { key: "c", tok: cTok },
    ];

    const values = { a: null, b: null, c: null };
    for (const s of slots) {
      if (s.tok !== "?") values[s.key] = Number(s.tok);
    }

    function solve() {
      const known = Object.values(values).filter((v) => v != null).length;
      if (known < 2) throw new Error(`Prea multe necunoscute: ${eq}`);

      if (op === "+") {
        if (values.a == null) values.a = values.c - values.b;
        else if (values.b == null) values.b = values.c - values.a;
        else if (values.c == null) values.c = values.a + values.b;
        if (values.a < 0 || values.b < 0 || values.c < 0) throw new Error(`Rezultat invalid: ${eq}`);
      } else {
        if (values.a == null) values.a = values.c + values.b;
        else if (values.b == null) values.b = values.a - values.c;
        else if (values.c == null) values.c = values.a - values.b;
        if (values.a < 0 || values.b < 0 || values.c < 0) throw new Error(`Rezultat invalid: ${eq}`);
        if (values.b > values.a) throw new Error(`Scădere invalidă: ${eq}`);
      }
    }

    solve();

    const total =
      op === "+" ? values.c : values.a;

    const segmentKeys =
      op === "+"
        ? ["a", "b"]
        : ["b", "c"];

    const segmentOrder = [];
    const scan = eq.match(/(\?|\d+)/g) || [];
    for (const tok of scan) {
      for (const key of segmentKeys) {
        const slot = slots.find((s) => s.key === key);
        if (slot.tok !== tok) continue;
        if (segmentOrder.some((s) => s.key === key)) continue;
        segmentOrder.push({
          key,
          tok,
          value: values[key],
          hidden: tok === "?",
        });
      }
    }
    for (const key of segmentKeys) {
      if (!segmentOrder.some((s) => s.key === key)) {
        const slot = slots.find((s) => s.key === key);
        segmentOrder.push({
          key,
          tok: slot.tok,
          value: values[key],
          hidden: slot.tok === "?",
        });
      }
    }

    const segLens = segmentOrder.map((s) => s.value);
    if (segLens.reduce((a, b) => a + b, 0) !== total) {
      throw new Error(`Segmentele nu acoperă totalul: ${eq}`);
    }

    return {
      raw: eq,
      display: formatDisplay(aTok, op, bTok, cTok, orientation),
      orientation,
      op,
      values,
      total,
      segments: segmentOrder,
      slots,
    };
  }

  function formatDisplay(aTok, op, bTok, cTok, orientation) {
    const dOp = DISPLAY_OP[op] || op;
    if (orientation === "stanga") {
      return `${aTok}${dOp}${bTok}=${cTok}`;
    }
    return `${cTok}=${aTok}${dOp}${bTok}`;
  }

  function formatResolvedEquation(model, opts) {
    const dOp = DISPLAY_OP[model.op] || model.op;
    const a = String(model.values.a);
    const b = String(model.values.b);
    const c = String(model.values.c);
    if (opts.afiseazaNumarLaUnknown) {
      return model.orientation === "stanga" ? `${a}${dOp}${b}=${c}` : `${c}=${a}${dOp}${b}`;
    }
    return model.display.replace(/\?/g, " ? ");
  }

  function slotIsUnknown(model, key) {
    const slot = model.slots.find((s) => s.key === key);
    return slot != null && slot.tok === "?";
  }

  function bracketLabel(value, model, slotKey, opts) {
    if (slotIsUnknown(model, slotKey) && !opts.afiseazaNumarLaUnknown) return "?";
    return String(value);
  }

  function segmentLabel(seg, model, opts) {
    return bracketLabel(seg.value, model, seg.key, opts);
  }

  function totalLabel(model, opts) {
    const totalSlotKey = model.op === "+" ? "c" : "a";
    return bracketLabel(model.total, model, totalSlotKey, opts);
  }

  function axisNumberVisible(n, model, opts) {
    if (!opts.showNumereAxaNumere) return false;
    if (opts.showNumereAxaInJurulSegmentuluiMicDreapta) return true;
    const seg1 = model.segments[0]?.value || 0;
    const lastObj = model.total;
    const hideFrom = seg1 + 1;
    const hideTo = lastObj + opts.axisHideTailAfterLast;
    if (n >= hideFrom && n <= hideTo) return false;
    return true;
  }

  /** Raza de bază (px); sub 4R lățime, R se micșorează proporțional. */
  const BRACE_R0 = 6;
  const BRACE_FIXED_R = 4;

  function braceRadius(span) {
    const w = Math.max(span, 0);
    return w >= BRACE_FIXED_R * BRACE_R0 ? BRACE_R0 : w / BRACE_FIXED_R;
  }

  function braceStraightHalf(span, R) {
    return Math.max(0, span - BRACE_FIXED_R * R) / 2;
  }

  /**
   * Deschisă în jos — vârf ascuțit la centrul spanului (xc).
   * 2 sferturi curbe spre punctul (xc, yShelf−R), nu spre exterior.
   */
  function bracePathOpenJos(x1, x2, y0, R) {
    const xc = (x1 + x2) / 2;
    const xCapL = x1 + R;
    const xCapR = x2 - R;
    const xMotL = xc - R;
    const xMotR = xc + R;
    const yShelf = y0 - R;
    const p = [`M ${x1} ${y0}`];
    p.push(`A ${R} ${R} 0 0 1 ${xCapL} ${yShelf}`);
    if (xMotL > xCapL) p.push(`L ${xMotL} ${yShelf}`);
    p.push(`A ${R} ${R} 0 0 0 ${xc} ${yShelf - R}`);
    p.push(`A ${R} ${R} 0 0 0 ${xMotR} ${yShelf}`);
    if (xCapR > xMotR) p.push(`L ${xCapR} ${yShelf}`);
    p.push(`A ${R} ${R} 0 0 1 ${x2} ${y0}`);
    return p.join(" ");
  }

  /** Deschisă în sus — vârf ascuțit la (xc, yShelf+R). */
  function bracePathOpenSus(x1, x2, y0, R) {
    const xc = (x1 + x2) / 2;
    const xCapL = x1 + R;
    const xCapR = x2 - R;
    const xMotL = xc - R;
    const xMotR = xc + R;
    const yShelf = y0 + R;
    const p = [`M ${x1} ${y0}`];
    p.push(`A ${R} ${R} 0 0 0 ${xCapL} ${yShelf}`);
    if (xMotL > xCapL) p.push(`L ${xMotL} ${yShelf}`);
    p.push(`A ${R} ${R} 0 0 1 ${xc} ${yShelf + R}`);
    p.push(`A ${R} ${R} 0 0 1 ${xMotR} ${yShelf}`);
    if (xCapR > xMotR) p.push(`L ${xCapR} ${yShelf}`);
    p.push(`A ${R} ${R} 0 0 0 ${x2} ${y0}`);
    return p.join(" ");
  }

  /** jos | sus | stanga | dreapta — aceeași piesă, rotită la 90/180/270°. */
  const BRACE_ORIENT = {
    JOS: "jos",
    SUS: "sus",
    STANGA: "stanga",
    DREAPTA: "dreapta",
  };

  function appendExtensibleBrace(svg, spanStart, spanEnd, anchor, orient) {
    const horiz = orient === BRACE_ORIENT.JOS || orient === BRACE_ORIENT.SUS;
    let R;
    let L;

    if (horiz) {
      const x1 = spanStart;
      const x2 = spanEnd;
      R = braceRadius(x2 - x1);
      L = braceStraightHalf(x2 - x1, R);
      const d =
        orient === BRACE_ORIENT.JOS
          ? bracePathOpenJos(x1, x2, anchor, R)
          : bracePathOpenSus(x1, x2, anchor, R);
      svg.appendChild(svgEl("path", { d, class: "aam-brace" }));
    } else {
      const y1 = spanStart;
      const y2 = spanEnd;
      const span = y2 - y1;
      R = braceRadius(span);
      L = braceStraightHalf(span, R);
      const localD = bracePathOpenJos(0, span, 0, R);
      const cx = anchor;
      const cy = y1 + span / 2;
      const deg = orient === BRACE_ORIENT.STANGA ? -90 : 90;
      const g = svgEl("g", {
        transform: `translate(${cx} ${cy}) rotate(${deg}) translate(${-span / 2} 0)`,
      });
      g.appendChild(svgEl("path", { d: localD, class: "aam-brace" }));
      svg.appendChild(g);
    }

    return { R, L, orient };
  }

  /** Poziții Y compacte: bandele ascunse nu lasă gol. */
  function computeVerticalLayout(opts) {
    const padTop = 10;
    const padBottom = 10;
    const gap = 6;
    let y = padTop;
    const layout = { padTop, padBottom };

    if (opts.afiseazaAcoladeNumereMici) {
      layout.smallLabelY = y + 8;
      y += 16;
      layout.smallBraceY = y + 2 * BRACE_R0;
      y += 2 * BRACE_R0 + gap;
    }

    if (opts.afiseazaObiecte) {
      layout.objY = y + 14;
      y += 28 + gap;
    } else if (opts.showAxaNumere || opts.afiseazaAcoladaNumarMare) {
      layout.objY = y + 14;
      y += 6;
    }

    if (opts.showAxaNumere) {
      layout.axisY = y + 7;
      y += 14;
      if (opts.showNumereAxaNumere) {
        layout.axisNumberOffset = 15;
        y += 20 + gap;
      } else {
        y += gap;
      }
    }

    if (opts.afiseazaAcoladaNumarMare) {
      layout.bigBraceY = y;
      y += 2 * BRACE_R0 + 4;
      layout.bigLabelY = y + 10;
      y += 18;
    }

    layout.height = Math.max(y + padBottom, 48);
    return layout;
  }

  function drawObject(g, type, cx, cy, r, index) {
    if (type === "mere") {
      const stem = document.createElementNS("http://www.w3.org/2000/svg", "line");
      stem.setAttribute("x1", String(cx));
      stem.setAttribute("y1", String(cy - r - 2));
      stem.setAttribute("x2", String(cx + 2));
      stem.setAttribute("y2", String(cy - r - 7));
      stem.setAttribute("stroke", "#5a3e1b");
      stem.setAttribute("stroke-width", "2");
      g.appendChild(stem);
      const leaf = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      leaf.setAttribute("cx", String(cx + 5));
      leaf.setAttribute("cy", String(cy - r - 6));
      leaf.setAttribute("rx", "5");
      leaf.setAttribute("ry", "3");
      leaf.setAttribute("fill", "#4caf50");
      g.appendChild(leaf);
      const body = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      body.setAttribute("cx", String(cx));
      body.setAttribute("cy", String(cy));
      body.setAttribute("r", String(r));
      body.setAttribute("fill", "#e53935");
      g.appendChild(body);
      return;
    }
    if (type === "lamai") {
      const body = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      body.setAttribute("cx", String(cx));
      body.setAttribute("cy", String(cy));
      body.setAttribute("rx", String(r * 0.85));
      body.setAttribute("ry", String(r));
      body.setAttribute("fill", "#fdd835");
      body.setAttribute("stroke", "#f9a825");
      body.setAttribute("stroke-width", "1.5");
      g.appendChild(body);
      return;
    }
    if (type === "flori") {
      const hue = (index * 47) % 360;
      for (let i = 0; i < 6; i += 1) {
        const ang = (i / 6) * Math.PI * 2;
        const petal = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        petal.setAttribute("cx", String(cx + Math.cos(ang) * r * 0.55));
        petal.setAttribute("cy", String(cy + Math.sin(ang) * r * 0.55));
        petal.setAttribute("rx", String(r * 0.38));
        petal.setAttribute("ry", String(r * 0.55));
        petal.setAttribute("fill", `hsl(${hue}, 70%, 62%)`);
        g.appendChild(petal);
      }
      const center = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      center.setAttribute("cx", String(cx));
      center.setAttribute("cy", String(cy));
      center.setAttribute("r", String(r * 0.28));
      center.setAttribute("fill", "#ffeb3b");
      g.appendChild(center);
      return;
    }
    const hue = (index * 53 + 30) % 360;
    const disc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    disc.setAttribute("cx", String(cx));
    disc.setAttribute("cy", String(cy));
    disc.setAttribute("r", String(r));
    disc.setAttribute("fill", `hsl(${hue}, 68%, 54%)`);
    disc.setAttribute("stroke", "#fff");
    disc.setAttribute("stroke-width", "1.5");
    g.appendChild(disc);
  }

  function svgEl(name, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    }
    return el;
  }

  function svgText(x, y, text, className) {
    const t = svgEl("text", { x, y, class: className || "aam-text" });
    t.textContent = text;
    return t;
  }

  /**
   * Desenează vizualizarea pentru o ecuație.
   * @param {string} equation — ex. "3+7=10", "3+?=10"
   * @param {HTMLElement|string} [target] — container sau selector
   * @param {object} [options]
   */
  function fname(equation, target, options) {
    const opts = { ...DEFAULTS, ...(options || {}) };
    if (target && typeof target === "object" && !target.nodeType && !options) {
      options = target;
      target = null;
      Object.assign(opts, options);
    } else if (options) {
      Object.assign(opts, options);
    }

    const model = parseEquation(equation);
    const axisStart = opts.axisStart;
    const axisEnd = Math.max(model.total + opts.axisEndPadding, 4);
    const unit = opts.unitWidth || 48;
    const padX = 36;
    const layout = computeVerticalLayout(opts);
    const {
      smallLabelY,
      smallBraceY,
      objY,
      axisY,
      axisNumberOffset,
      bigBraceY,
      bigLabelY,
    } = layout;

    const xAt = (n) => padX + (n - axisStart) * unit;

    /** Capete acoladă: centrul primului/ultimului obiect ± jumătate pas axă (½ între 2 întregi). */
    function braceSpanForObjects(startIdx, endIdx) {
      const half = unit / 2;
      return {
        x1: xAt(startIdx) - half,
        x2: xAt(endIdx) + half,
      };
    }

    const width = padX * 2 + (axisEnd - axisStart) * unit;
    const height = layout.height;

    const svg = svgEl("svg", {
      viewBox: `0 0 ${width} ${height}`,
      class: "aam-svg",
      preserveAspectRatio: "xMidYMin meet",
    });

    const defs = svgEl("defs");
    const style = svgEl("style");
    style.textContent = `
      .aam-svg { font-family: system-ui, sans-serif; }
      .aam-text { font-size: 15px; fill: #1e293b; text-anchor: middle; dominant-baseline: middle; }
      .aam-text-small { font-size: 17px; font-weight: 700; fill: #0f172a; text-anchor: middle; dominant-baseline: middle; }
      .aam-text-big { font-size: 20px; font-weight: 800; fill: #0f172a; text-anchor: middle; dominant-baseline: middle; }
      .aam-axis { stroke: #334155; stroke-width: 2; }
      .aam-tick { stroke: #64748b; stroke-width: 1.5; }
      .aam-brace { fill: none; stroke: #0f172a; stroke-width: 1.35; stroke-linecap: round; stroke-linejoin: round; }
    `;
    defs.appendChild(style);
    svg.appendChild(defs);

    let cursor = 1;
    const ranges = model.segments.map((seg) => {
      const start = cursor;
      const end = cursor + seg.value - 1;
      cursor = end + 1;
      return { seg, start, end };
    });

    if (opts.showAxaNumere && axisY != null) {
      const axis = svgEl("line", {
        x1: xAt(axisStart),
        y1: axisY,
        x2: xAt(axisEnd),
        y2: axisY,
        class: "aam-axis",
      });
      svg.appendChild(axis);

      for (let n = axisStart; n <= axisEnd; n += 1) {
        const x = xAt(n);
        const tick = svgEl("line", {
          x1: x,
          y1: axisY - 7,
          x2: x,
          y2: axisY + 7,
          class: "aam-tick",
        });
        svg.appendChild(tick);
        if (opts.showNumereAxaNumere && axisNumberVisible(n, model, opts)) {
          svg.appendChild(
            svgText(x, axisY + axisNumberOffset, String(n), "aam-text")
          );
        }
      }
    }

    if (opts.afiseazaObiecte && objY != null) {
      const objG = svgEl("g");
      for (let i = 1; i <= model.total; i += 1) {
        drawObject(objG, opts.obiectAfisat, xAt(i), objY, 12, i);
      }
      svg.appendChild(objG);
    }

    if (opts.afiseazaAcoladeNumereMici && smallBraceY != null) {
      for (const range of ranges) {
        const { x1, x2 } = braceSpanForObjects(range.start, range.end);
        appendExtensibleBrace(svg, x1, x2, smallBraceY, BRACE_ORIENT.JOS);
        svg.appendChild(
          svgText((x1 + x2) / 2, smallLabelY, segmentLabel(range.seg, model, opts), "aam-text-small")
        );
      }
    }

    if (opts.afiseazaAcoladaNumarMare && model.total > 0 && bigBraceY != null) {
      const { x1, x2 } = braceSpanForObjects(1, model.total);
      appendExtensibleBrace(svg, x1, x2, bigBraceY, BRACE_ORIENT.SUS);
      svg.appendChild(svgText((x1 + x2) / 2, bigLabelY, totalLabel(model, opts), "aam-text-big"));
    }

    if (target) {
      const el =
        typeof target === "string" ? document.querySelector(target) : target;
      if (el) {
        el.replaceChildren(svg);
      }
    }

    return { svg, model, width, height };
  }

  class AxeAcoladeMereApp {
    constructor(container, options) {
      this.container = container;
      this.options = { ...DEFAULTS, ...options };
      this.facts =
        this.options.series ||
        buildDefaultFactSeries(this.options.seriesLength);
      this.rowRefs = [];
      this._buildDom();
      this.render();
    }

    _buildDom() {
      this.root = document.createElement("div");
      this.root.className = "aam-app";

      this.sidebar = document.createElement("aside");
      this.sidebar.className = "aam-sidebar";

      this.stage = document.createElement("section");
      this.stage.className = "aam-stage";

      this.seriesHead = document.createElement("div");
      this.seriesHead.className = "aam-series-head";
      this.seriesHead.textContent = `Serie: ${this.facts.length} facts +/-`;

      this.seriesList = document.createElement("div");
      this.seriesList.className = "aam-series-list";
      this.rowRefs = this.facts.map((fact, index) => {
        const row = document.createElement("div");
        row.className = "aam-series-row";

        const eq = document.createElement("div");
        eq.className = "aam-series-eq";

        const vizWrap = document.createElement("div");
        vizWrap.className = "aam-series-viz-wrap";
        const vizHost = document.createElement("div");
        vizHost.className = "aam-series-viz";
        vizWrap.appendChild(vizHost);

        row.append(eq, vizWrap);
        this.seriesList.appendChild(row);
        return { fact, index, row, eq, vizWrap, vizHost };
      });

      this.stage.append(this.seriesHead, this.seriesList);

      this._buildControls();

      this.root.append(this.sidebar, this.stage);
      this.container.replaceChildren(this.root);

      this._ro = new ResizeObserver(() => this.render());
      this._ro.observe(this.seriesList);
    }

    _buildControls() {
      const title = document.createElement("h2");
      title.textContent = "Control panel";
      this.sidebar.appendChild(title);

      this.switchRefs = {};

      const switches = [
        ["showAxaNumere", "Afișează axa numerelor"],
        ["showNumereAxaNumere", "Afișează numere pe axă"],
        [
          "showNumereAxaInJurulSegmentuluiMicDreapta",
          "Numere axă în jurul segmentului mic din dreapta",
        ],
        ["afiseazaObiecte", "Afișează obiecte"],
        ["afiseazaAcoladeNumereMici", "Afișează acolade numere mici"],
        ["afiseazaAcoladaNumarMare", "Afișează acolada număr mare"],
        ["afiseazaNumarLaUnknown", "La ? afișează numărul (nu «?»)"],
      ];

      for (const [key, label] of switches) {
        this.sidebar.appendChild(this._switchRow(key, label));
      }

      const objRow = document.createElement("div");
      objRow.className = "aam-row";
      const objLabel = document.createElement("label");
      objLabel.textContent = "Obiect afișat";
      this.objSelect = document.createElement("select");
      for (const t of OBJECT_TYPES) {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        this.objSelect.appendChild(opt);
      }
      this.objSelect.value = this.options.obiectAfisat;
      this.objSelect.addEventListener("change", () => {
        this.options.obiectAfisat = this.objSelect.value;
        this.render();
      });
      objRow.append(objLabel, this.objSelect);
      this.sidebar.appendChild(objRow);

      const info = document.createElement("p");
      info.className = "aam-info";
      info.textContent = `Serie de ${this.facts.length} ecuații (complete și cu ?). Schimbările din panel se aplică tuturor.`;
      this.sidebar.appendChild(info);
    }

    _switchRow(key, label) {
      const row = document.createElement("label");
      row.className = "aam-switch-row";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!this.options[key];
      input.addEventListener("change", () => {
        this.options[key] = input.checked;
        this.render();
      });
      const span = document.createElement("span");
      span.textContent = label;
      row.append(input, span);
      this.switchRefs[key] = input;
      return row;
    }

    _unitWidthFor(vizWrap, model) {
      const box = vizWrap.clientWidth || this.options.viewWidth;
      const span = Math.max(
        6,
        model.total + this.options.axisEndPadding - this.options.axisStart
      );
      return clamp(Math.floor((box - 72) / span), 18, 44);
    }

    render() {
      this.seriesHead.textContent = `Serie: ${this.facts.length} facts +/-`;

      for (const ref of this.rowRefs) {
        const fact = normalizeEquation(ref.fact);
        ref.row.classList.toggle("has-unknown", fact.includes("?") && !this.options.afiseazaNumarLaUnknown);

        try {
          const model = parseEquation(fact);
          ref.eq.textContent = formatResolvedEquation(model, this.options);
          const unitWidth = this._unitWidthFor(ref.vizWrap, model);
          const drawn = fname(fact, ref.vizHost, { ...this.options, unitWidth });
          ref.vizWrap.style.minHeight = `${drawn.height}px`;
          ref.row.style.minHeight = "";
          ref.row.classList.remove("has-error");
        } catch (err) {
          ref.eq.textContent = fact.replace(/\?/g, " ? ");
          ref.vizHost.replaceChildren();
          const msg = document.createElement("p");
          msg.className = "aam-error";
          msg.textContent = err.message || String(err);
          ref.vizHost.appendChild(msg);
          ref.row.classList.add("has-error");
        }
      }
    }

    setOptions(partial) {
      Object.assign(this.options, partial);
      for (const [k, input] of Object.entries(this.switchRefs)) {
        if (k in partial) input.checked = !!partial[k];
      }
      if (partial.obiectAfisat) this.objSelect.value = partial.obiectAfisat;
      this.render();
    }

    setSeries(facts) {
      this.facts = facts.map(normalizeEquation);
      this.seriesList.replaceChildren();
      this.rowRefs = this.facts.map((fact, index) => {
        const row = document.createElement("div");
        row.className = "aam-series-row";
        const eq = document.createElement("div");
        eq.className = "aam-series-eq";
        const vizWrap = document.createElement("div");
        vizWrap.className = "aam-series-viz-wrap";
        const vizHost = document.createElement("div");
        vizHost.className = "aam-series-viz";
        vizWrap.appendChild(vizHost);
        row.append(eq, vizWrap);
        this.seriesList.appendChild(row);
        return { fact, index, row, eq, vizWrap, vizHost };
      });
      this.render();
    }

    destroy() {
      this._ro?.disconnect();
      this.container.replaceChildren();
    }
  }

  function axeAcoladeMere(container, options) {
    const app = new AxeAcoladeMereApp(container, options);
    return {
      destroy: () => app.destroy(),
      setOptions: (o) => app.setOptions(o),
      setSeries: (facts) => app.setSeries(facts),
      fname: (eq, o) => fname(eq, null, { ...app.options, ...o }),
      getFacts: () => ALL_FACTS.slice(),
      getSeries: () => app.facts.slice(),
    };
  }

  global.generatePlusMinusFacts = generatePlusMinusFacts;
  global.buildDefaultFactSeries = buildDefaultFactSeries;
  global.parseAamEquation = parseEquation;
  global.fname = fname;
  global.axeAcoladeMere = axeAcoladeMere;
  global.AamBrace = {
    R0: BRACE_R0,
    FIXED_R: BRACE_FIXED_R,
    ORIENT: BRACE_ORIENT,
    radius: braceRadius,
    straightHalf: braceStraightHalf,
    pathOpenJos: bracePathOpenJos,
    pathOpenSus: bracePathOpenSus,
    append: appendExtensibleBrace,
  };
})(typeof window !== "undefined" ? window : globalThis);
