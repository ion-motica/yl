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
    animBraceMsPerStep: 400,
    animNumereAxaCuMerele: true,
    animAcoladeNumereMici: true,
    animFadeNumere: true,
    animFadeObiecte: true,
    axisStart: -2,
    axisEndPadding: 3,
    axisHideTailAfterLast: 5,
    viewWidth: 720,
    viewHeight: 240,
    seriesLength: 10,
    series: null,
  };

  const OBJECT_TYPES = ["mere", "lamai", "flori", "discuri"];

  /** Generează facts din tablele + și −; operanzii segment (mici) sunt 1–10. */
  function generatePlusMinusFacts() {
    const facts = [];
    for (let a = 1; a <= 10; a += 1) {
      for (let b = 1; b <= 10; b += 1) {
        const sum = a + b;
        facts.push(`${a}+${b}=${sum}`);
        facts.push(`${sum}=${a}+${b}`);
      }
    }
    for (let b = 1; b <= 10; b += 1) {
      for (let c = 1; c <= 10; c += 1) {
        const a = b + c;
        facts.push(`${a}-${b}=${c}`);
        facts.push(`${c}=${a}-${b}`);
      }
    }
    return facts;
  }

  /** Variante cu un singur «?» per ecuație (inclusiv «3+4=?», «?=3+4», etc.). */
  function generatePlusMinusUnknownFacts() {
    const facts = [];
    for (let a = 1; a <= 10; a += 1) {
      for (let b = 1; b <= 10; b += 1) {
        const sum = a + b;
        facts.push(`?+${b}=${sum}`);
        facts.push(`${a}+?=${sum}`);
        facts.push(`${a}+${b}=?`);
        facts.push(`?=${a}+${b}`);
        facts.push(`${sum}=?+${b}`);
        facts.push(`${sum}=${a}+?`);
      }
    }
    for (let b = 1; b <= 10; b += 1) {
      for (let c = 1; c <= 10; c += 1) {
        const a = b + c;
        facts.push(`?-${b}=${c}`);
        facts.push(`${a}-?=${c}`);
        facts.push(`${a}-${b}=?`);
        facts.push(`?=${a}-${b}`);
        facts.push(`${c}=?-${b}`);
        facts.push(`${c}=${a}-?`);
      }
    }
    return facts;
  }

  const ALL_FACTS = generatePlusMinusFacts();

  function randInt(lo, hi) {
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  function pickOne(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  function randomPlusEquation(withUnknown) {
    const a = randInt(1, 10);
    const b = randInt(1, 10);
    const sum = a + b;
    if (!withUnknown) {
      return pickOne([`${a}+${b}=${sum}`, `${sum}=${a}+${b}`]);
    }
    return pickOne([
      `?+${b}=${sum}`,
      `${a}+?=${sum}`,
      `${a}+${b}=?`,
      `?=${a}+${b}`,
      `${sum}=?+${b}`,
      `${sum}=${a}+?`,
    ]);
  }

  function randomMinusEquation(withUnknown) {
    const b = randInt(1, 10);
    const c = randInt(1, 10);
    const a = b + c;
    if (!withUnknown) {
      return pickOne([`${a}-${b}=${c}`, `${c}=${a}-${b}`]);
    }
    return pickOne([
      `?-${b}=${c}`,
      `${a}-?=${c}`,
      `${a}-${b}=?`,
      `?=${a}-${b}`,
      `${c}=?-${b}`,
      `${c}=${a}-?`,
    ]);
  }

  /** Serie aleatoare: operanzii mici 1–10, total derivat (2–20); jumătate cu ?. */
  function buildDefaultFactSeries(length = 10) {
    const out = [];
    for (let i = 0; i < length; i += 1) {
      const withUnknown = i % 2 === 1;
      const plus = Math.random() < 0.5;
      out.push(plus ? randomPlusEquation(withUnknown) : randomMinusEquation(withUnknown));
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

  function totalSlotKey(model) {
    return model.op === "+" ? "c" : "a";
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

  /** Etichetă acoladă mică în animație: 1, 2, … până la valoarea segmentului. */
  function segmentAnimLabelState(range, g, model, opts) {
    const { start: S, end: E, seg } = range;
    const objectCount = Math.floor(Math.max(0, g)) + 1;

    if (objectCount < S) {
      return { visible: false, curr: "", prev: null, t: 1 };
    }

    const nInSeg = Math.min(objectCount - S + 1, E - S + 1);
    const curr = bracketLabel(nInSeg, model, seg.key, opts);
    const activeApple = Math.floor(Math.max(0, g)) + 1;

    if (activeApple > E) {
      return { visible: true, curr, prev: null, t: 1 };
    }

    if (activeApple >= S) {
      const prevN = nInSeg - 1;
      const prev = prevN >= 1 ? bracketLabel(prevN, model, seg.key, opts) : null;
      return { visible: true, curr, prev, t: animStepFadeT(g) };
    }

    return { visible: true, curr, prev: null, t: 1 };
  }

  function totalLabel(model, opts) {
    return bracketLabel(model.total, model, totalSlotKey(model), opts);
  }

  /** Durata crossfade (în pași globali animație) la schimbarea unui număr. */
  const ANIM_FADE_DUR = 0.35;

  function animStepFadeT(g) {
    const seg = Math.floor(Math.max(0, g));
    return clamp((g - seg) / ANIM_FADE_DUR, 0, 1);
  }

  function braceLabelFadePair(g, model, opts) {
    const seg = Math.floor(Math.max(0, g));
    const key = totalSlotKey(model);
    const curr = bracketLabel(seg + 1, model, key, opts);
    const prev = seg === 0 ? null : bracketLabel(seg, model, key, opts);
    return { curr, prev, t: animStepFadeT(g) };
  }

  function appearFadeOpacity(g, appearAtG) {
    return clamp((g - appearAtG) / ANIM_FADE_DUR, 0, 1);
  }

  function appendFadeNumberText(svg, x, y, text, prevText, fadeT, className, enabled) {
    if (!enabled) {
      svg.appendChild(svgText(x, y, text, className));
      return;
    }
    const t = fadeT;
    const crossfade = prevText != null && prevText !== text;
    if (crossfade && t < 1) {
      const old = svgText(x, y, prevText, className);
      old.setAttribute("opacity", String(1 - t));
      svg.appendChild(old);
    }
    let opacity = 1;
    if (crossfade) opacity = t;
    else if (prevText === null) opacity = t;
    if (opacity <= 0.01) return;
    const cur = svgText(x, y, text, className);
    if (opacity < 1) cur.setAttribute("opacity", String(opacity));
    svg.appendChild(cur);
  }

  function appendFadeSingleText(svg, x, y, text, opacity, className, enabled) {
    if (!enabled || opacity >= 0.999) {
      svg.appendChild(svgText(x, y, text, className));
      return;
    }
    if (opacity <= 0.01) return;
    const cur = svgText(x, y, text, className);
    cur.setAttribute("opacity", String(opacity));
    svg.appendChild(cur);
  }

  function axisNumberVisible(n, model, opts) {
    if (!opts.showNumereAxaNumere) return false;

    const anim = opts.animBigBrace;
    const inAnim = anim && typeof anim === "object";
    if (inAnim && opts.animNumereAxaCuMerele) {
      if (n >= 1) return n <= anim.objectCount;
      return true;
    }

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

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function makeXAt(axisStart, padX, unit) {
    return (n) => padX + (n - axisStart) * unit;
  }

  function braceSpanIndices(startIdx, endIdx, xAt, unit) {
    const half = unit / 2;
    return {
      x1: xAt(startIdx) - half,
      x2: xAt(endIdx) + half,
    };
  }

  /** Lățime minimă naturală (4·R), centrată pe grupul final de obiecte. */
  function minBigBraceSpan(xAt, unit, total) {
    const full = braceSpanIndices(1, Math.max(total, 1), xAt, unit);
    const cx = (full.x1 + full.x2) / 2;
    const R = braceRadius(BRACE_FIXED_R * BRACE_R0);
    return { x1: cx - 2 * R, x2: cx + 2 * R };
  }

  function bigBraceSpanForCount(n, xAt, unit, total) {
    if (n <= 0) return minBigBraceSpan(xAt, unit, total);
    return braceSpanIndices(1, n, xAt, unit);
  }

  function buildSegmentRanges(model) {
    let cursor = 1;
    return model.segments.map((seg) => {
      const start = cursor;
      const end = cursor + seg.value - 1;
      cursor = end + 1;
      return { seg, start, end };
    });
  }

  function minSmallBraceSpan(xAt, unit, startIdx, endIdx) {
    const full = braceSpanIndices(startIdx, endIdx, xAt, unit);
    const cx = (full.x1 + full.x2) / 2;
    const R = braceRadius(BRACE_FIXED_R * BRACE_R0);
    return { x1: cx - 2 * R, x2: cx + 2 * R };
  }

  function smallBraceSpanForCount(nInSeg, startIdx, xAt, unit) {
    const endIdx = startIdx + nInSeg - 1;
    return braceSpanIndices(startIdx, endIdx, xAt, unit);
  }

  /** Acolade mici animat: câte obiecte din segment sunt deja afișate. */
  function computeSmallBraceAnimSpans(model, xAt, unit, globalStep) {
    const T = model.total;
    const g = Math.max(0, globalStep);
    const ranges = buildSegmentRanges(model);

    if (T <= 0) return [];

    if (g >= T) {
      return ranges.map((range) => {
        const full = braceSpanIndices(range.start, range.end, xAt, unit);
        return {
          seg: range.seg,
          x1: full.x1,
          x2: full.x2,
          visible: true,
        };
      });
    }

    const seg = Math.floor(g);
    const frac = g - seg;
    const objectCount = seg + 1;
    const activeApple = seg + 1;

    return ranges.map((range) => {
      const { start: S, end: E } = range;

      if (objectCount < S) {
        return { seg: range.seg, x1: 0, x2: 0, visible: false };
      }

      if (objectCount > E) {
        const full = braceSpanIndices(S, E, xAt, unit);
        return { seg: range.seg, x1: full.x1, x2: full.x2, visible: true };
      }

      const nInSeg = objectCount - S + 1;
      if (activeApple >= S && activeApple <= E) {
        const from =
          nInSeg === 1
            ? minSmallBraceSpan(xAt, unit, S, E)
            : smallBraceSpanForCount(nInSeg - 1, S, xAt, unit);
        const to = smallBraceSpanForCount(nInSeg, S, xAt, unit);
        return {
          seg: range.seg,
          x1: lerp(from.x1, to.x1, frac),
          x2: lerp(from.x2, to.x2, frac),
          visible: true,
        };
      }

      const full = smallBraceSpanForCount(nInSeg, S, xAt, unit);
      return { seg: range.seg, x1: full.x1, x2: full.x2, visible: true };
    });
  }

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

  /** Raza maximă obiect (px); se micșorează când unitatea axei e îngustă, ca să nu se suprapună. */
  const OBJECT_RADIUS_MAX = 12;

  function objectRadiusForUnit(unit) {
    return clamp(unit * 0.38, 5, OBJECT_RADIUS_MAX);
  }

  function objectVisualBand(objR) {
    return objR * 2 + 8;
  }

  /** Poziții Y compacte: bandele ascunse nu lasă gol. */
  function computeVerticalLayout(opts, unit = 48) {
    const objR = objectRadiusForUnit(unit);
    const objBand = objectVisualBand(objR);
    const axisClearance = 6;
    const padTop = 10;
    const padBottom = 10;
    const gap = 6;
    let y = padTop;
    const layout = { padTop, padBottom };

    if (
      opts.afiseazaAcoladeNumereMici ||
      (opts.animBigBrace && opts.animAcoladeNumereMici)
    ) {
      layout.smallLabelY = y + 8;
      y += 16;
      layout.smallBraceY = y + 2 * BRACE_R0;
      y += 2 * BRACE_R0 + gap;
    }

    if (opts.afiseazaObiecte) {
      layout.objY = y + objR + 2;
      y += objBand + gap;
    } else if (opts.showAxaNumere || opts.afiseazaAcoladaNumarMare) {
      layout.objY = y + objR + 2;
      y += 6;
    }

    if (opts.showAxaNumere) {
      if (opts.afiseazaObiecte && layout.objY != null) {
        const objBottom = layout.objY + objR;
        layout.axisY = Math.max(y + 7, objBottom + axisClearance + 7);
        y = layout.axisY - 7;
      } else {
        layout.axisY = y + 7;
      }
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
    const objR = objectRadiusForUnit(unit);
    const layout = computeVerticalLayout(opts, unit);
    const {
      smallLabelY,
      smallBraceY,
      objY,
      axisY,
      axisNumberOffset,
      bigBraceY,
      bigLabelY,
    } = layout;

    const xAt = makeXAt(axisStart, padX, unit);

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

    const ranges = buildSegmentRanges(model);

    const anim = opts.animBigBrace;
    const inAnim = anim && typeof anim === "object";

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
          const fadeOn = inAnim && opts.animFadeNumere && typeof anim.animStep === "number";
          let opacity = 1;
          if (fadeOn && n >= 1 && opts.animNumereAxaCuMerele) {
            opacity = appearFadeOpacity(anim.animStep, n - 1);
          }
          appendFadeSingleText(
            svg,
            x,
            axisY + axisNumberOffset,
            String(n),
            opacity,
            "aam-text",
            fadeOn
          );
        }
      }
    }

    const objectCount = inAnim ? anim.objectCount : model.total;

    if (objY != null && objectCount > 0 && (inAnim || opts.afiseazaObiecte)) {
      const objG = svgEl("g");
      const fadeObjects =
        inAnim && opts.animFadeObiecte && typeof anim.animStep === "number";
      for (let i = 1; i <= objectCount; i += 1) {
        let opacity = 1;
        if (fadeObjects) {
          opacity = appearFadeOpacity(anim.animStep, i - 1);
          if (opacity <= 0.01) continue;
        }
        const itemG = svgEl("g");
        if (fadeObjects && opacity < 0.999) {
          itemG.setAttribute("opacity", String(opacity));
        }
        drawObject(itemG, opts.obiectAfisat, xAt(i), objY, objR, i);
        objG.appendChild(itemG);
      }
      svg.appendChild(objG);
    }

    const showSmallAnim = inAnim && opts.animAcoladeNumereMici;
    const showSmallStatic = !inAnim && opts.afiseazaAcoladeNumereMici;

    if ((showSmallStatic || showSmallAnim) && smallBraceY != null) {
      if (showSmallAnim && typeof anim.animStep === "number") {
        const smallSpans = computeSmallBraceAnimSpans(model, xAt, unit, anim.animStep);
        for (const sb of smallSpans) {
          if (!sb.visible) continue;
          appendExtensibleBrace(svg, sb.x1, sb.x2, smallBraceY, BRACE_ORIENT.JOS);
          const lx = (sb.x1 + sb.x2) / 2;
          const range = ranges.find((r) => r.seg === sb.seg);
          if (!range) continue;
          const { curr, prev, t } = segmentAnimLabelState(range, anim.animStep, model, opts);
          if (opts.animFadeNumere) {
            appendFadeNumberText(svg, lx, smallLabelY, curr, prev, t, "aam-text-small", true);
          } else {
            svg.appendChild(svgText(lx, smallLabelY, curr, "aam-text-small"));
          }
        }
      } else if (showSmallStatic) {
        for (const range of ranges) {
          const { x1, x2 } = braceSpanIndices(range.start, range.end, xAt, unit);
          appendExtensibleBrace(svg, x1, x2, smallBraceY, BRACE_ORIENT.JOS);
          svg.appendChild(
            svgText((x1 + x2) / 2, smallLabelY, segmentLabel(range.seg, model, opts), "aam-text-small")
          );
        }
      }
    }

    const showBig =
      inAnim || (opts.afiseazaAcoladaNumarMare && model.total > 0 && bigBraceY != null);

    if (showBig && bigBraceY != null) {
      let x1;
      let x2;
      let label;
      if (inAnim) {
        x1 = anim.braceX1;
        x2 = anim.braceX2;
        label = anim.labelText;
      } else {
        const span = braceSpanIndices(1, model.total, xAt, unit);
        x1 = span.x1;
        x2 = span.x2;
        label = totalLabel(model, opts);
      }
      appendExtensibleBrace(svg, x1, x2, bigBraceY, BRACE_ORIENT.SUS);
      const lx = (x1 + x2) / 2;
      if (inAnim && opts.animFadeNumere && typeof anim.animStep === "number") {
        const { curr, prev, t } = braceLabelFadePair(anim.animStep, model, opts);
        appendFadeNumberText(svg, lx, bigLabelY, curr, prev, t, "aam-text-big", true);
      } else {
        svg.appendChild(svgText(lx, bigLabelY, label, "aam-text-big"));
      }
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

      this._ro = new ResizeObserver(() => {
        if (this._animating && this._animState) {
          this._refreshAnimGeometry();
          this._drawAnimFrame(this._animState.animRows);
        } else {
          this.render();
        }
      });
      this._ro.observe(this.seriesList);
    }

    _stopBigBraceAnim() {
      if (this._animRaf != null) {
        cancelAnimationFrame(this._animRaf);
        this._animRaf = null;
      }
      this._animating = false;
      this._animState = null;
    }

    _buildAnimRows() {
      const rows = [];
      for (const ref of this.rowRefs) {
        try {
          const fact = normalizeEquation(ref.fact);
          const model = parseEquation(fact);
          const unitWidth = this._unitWidthFor(ref.vizWrap, model);
          const xAt = makeXAt(this.options.axisStart, 36, unitWidth);
          const min = minBigBraceSpan(xAt, unitWidth, model.total);
          rows.push({
            ref,
            fact,
            model,
            unitWidth,
            xAt,
            total: model.total,
            objectCount: 0,
            animStep: 0,
            x1: min.x1,
            x2: min.x2,
          });
        } catch (err) {
          rows.push({ ref, error: err });
        }
      }
      return rows;
    }

    _refreshAnimGeometry() {
      if (!this._animState) return;
      for (const row of this._animState.animRows) {
        if (row.error) continue;
        row.unitWidth = this._unitWidthFor(row.ref.vizWrap, row.model);
        row.xAt = makeXAt(this.options.axisStart, 36, row.unitWidth);
        const span = bigBraceSpanForCount(row.objectCount, row.xAt, row.unitWidth, row.total);
        row.x1 = span.x1;
        row.x2 = span.x2;
      }
    }

    _drawAnimFrame(animRows) {
      for (const row of animRows) {
        if (row.error) continue;
        const label = bracketLabel(row.objectCount, row.model, totalSlotKey(row.model), this.options);
        try {
          const drawn = fname(row.fact, row.ref.vizHost, {
            ...this.options,
            unitWidth: row.unitWidth,
            animBigBrace: {
              objectCount: row.objectCount,
              animStep: row.animStep ?? 0,
              braceX1: row.x1,
              braceX2: row.x2,
              labelText: label,
            },
          });
          row.ref.vizWrap.style.minHeight = `${drawn.height}px`;
        } catch (err) {
          row.ref.vizHost.replaceChildren();
          const msg = document.createElement("p");
          msg.className = "aam-error";
          msg.textContent = err.message || String(err);
          row.ref.vizHost.appendChild(msg);
        }
      }
    }

    _applyAnimProgress(row, globalStep) {
      const T = row.total;
      if (T <= 0) return;

      const g = Math.max(0, globalStep);
      if (g >= T) {
        row.objectCount = T;
        row.animStep = T;
        const full = bigBraceSpanForCount(T, row.xAt, row.unitWidth, T);
        row.x1 = full.x1;
        row.x2 = full.x2;
        return;
      }

      const seg = Math.floor(g);
      const frac = g - seg;
      row.objectCount = seg + 1;
      row.animStep = g;

      const from =
        seg === 0
          ? minBigBraceSpan(row.xAt, row.unitWidth, T)
          : bigBraceSpanForCount(seg, row.xAt, row.unitWidth, T);
      const to = bigBraceSpanForCount(seg + 1, row.xAt, row.unitWidth, T);
      const e = frac;
      row.x1 = lerp(from.x1, to.x1, e);
      row.x2 = lerp(from.x2, to.x2, e);
    }

    _runContinuousBigBraceAnim(animRows, maxTotal, msPerStep) {
      const totalMs = maxTotal * msPerStep;
      return new Promise((resolve) => {
        const t0 = performance.now();
        const tick = (now) => {
          const globalStep = (now - t0) / msPerStep;
          for (const row of animRows) {
            if (!row.error) this._applyAnimProgress(row, globalStep);
          }
          this._drawAnimFrame(animRows);
          if (now - t0 < totalMs) {
            this._animRaf = requestAnimationFrame(tick);
          } else {
            for (const row of animRows) {
              if (!row.error) this._applyAnimProgress(row, row.total);
            }
            this._drawAnimFrame(animRows);
            this._animRaf = null;
            resolve();
          }
        };
        this._animRaf = requestAnimationFrame(tick);
      });
    }

    async _startBigBraceAnim() {
      this._stopBigBraceAnim();
      this._animating = true;

      const animRows = this._buildAnimRows();
      this._animState = { animRows };

      for (const row of animRows) {
        if (!row.error) this._applyAnimProgress(row, 0);
      }
      this._drawAnimFrame(animRows);

      const ms = Number(this.animSpeedSlider.value) || this.options.animBraceMsPerStep;
      const maxTotal = Math.max(0, ...animRows.filter((r) => !r.error).map((r) => r.total));

      if (maxTotal > 0) {
        await this._runContinuousBigBraceAnim(animRows, maxTotal, ms);
      }

      this._stopBigBraceAnim();
      this.render();
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

      const animRow = document.createElement("div");
      animRow.className = "aam-row";
      this.btnAnimBig = document.createElement("button");
      this.btnAnimBig.type = "button";
      this.btnAnimBig.textContent = "Start animatie acolade";
      this.btnAnimBig.addEventListener("click", () => this._startBigBraceAnim());
      animRow.appendChild(this.btnAnimBig);
      this.sidebar.appendChild(animRow);

      this.sidebar.appendChild(
        this._switchRow(
          "animNumereAxaCuMerele",
          "Pune numere pe axă pe măsură ce se adaugă mere"
        )
      );

      this.sidebar.appendChild(
        this._switchRow(
          "animAcoladeNumereMici",
          "Afișează și acoladele pt numerele mici"
        )
      );

      this.sidebar.appendChild(
        this._switchRow(
          "animFadeNumere",
          "Schimbare numere cu fading"
        )
      );

      this.sidebar.appendChild(
        this._switchRow(
          "animFadeObiecte",
          "Afișare mere/obiecte cu fading"
        )
      );

      const speedRow = document.createElement("div");
      speedRow.className = "aam-row";
      const speedLabel = document.createElement("label");
      speedLabel.textContent = "Viteză creștere acoladă (ms/pas)";
      this.animSpeedSlider = document.createElement("input");
      this.animSpeedSlider.type = "range";
      this.animSpeedSlider.min = "80";
      this.animSpeedSlider.max = "1200";
      this.animSpeedSlider.step = "20";
      this.animSpeedSlider.value = String(this.options.animBraceMsPerStep);
      this.animSpeedOut = document.createElement("span");
      this.animSpeedOut.className = "aam-slider-out";
      this.animSpeedOut.textContent = this.animSpeedSlider.value;
      this.animSpeedSlider.addEventListener("input", () => {
        this.options.animBraceMsPerStep = Number(this.animSpeedSlider.value);
        this.animSpeedOut.textContent = this.animSpeedSlider.value;
      });
      speedRow.append(speedLabel, this.animSpeedSlider, this.animSpeedOut);
      this.sidebar.appendChild(speedRow);

      const info = document.createElement("p");
      info.className = "aam-info";
      info.textContent = `Serie aleatoare de ${this.facts.length} ecuații: numere mici 1–10, total variabil. Jumătate cu ?. Reîncarcă pagina pentru altă serie.`;
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
      return clamp(Math.floor((box - 72) / span), 20, 48);
    }

    render() {
      if (this._animating) return;
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
      this._stopBigBraceAnim();
      this._ro?.disconnect();
      this.container.replaceChildren();
    }
  }

  function unitWidthForContainer(container, model, opts) {
    const box = container.clientWidth || opts.viewWidth;
    const span = Math.max(
      6,
      model.total + opts.axisEndPadding - opts.axisStart
    );
    return clamp(Math.floor((box - 72) / span), 20, 48);
  }

  function applyFnameAnimProgress(row, globalStep) {
    const T = row.total;
    if (T <= 0) return;

    const g = Math.max(0, globalStep);
    if (g >= T) {
      row.objectCount = T;
      row.animStep = T;
      const full = bigBraceSpanForCount(T, row.xAt, row.unitWidth, T);
      row.x1 = full.x1;
      row.x2 = full.x2;
      return;
    }

    const seg = Math.floor(g);
    const frac = g - seg;
    row.objectCount = seg + 1;
    row.animStep = g;

    const from =
      seg === 0
        ? minBigBraceSpan(row.xAt, row.unitWidth, T)
        : bigBraceSpanForCount(seg, row.xAt, row.unitWidth, T);
    const to = bigBraceSpanForCount(seg + 1, row.xAt, row.unitWidth, T);
    row.x1 = lerp(from.x1, to.x1, frac);
    row.x2 = lerp(from.x2, to.x2, frac);
  }

  /**
   * Animație acoladă mare pentru o singură ecuație într-un container quiz.
   * @returns {{ promise: Promise<{done?: boolean, error?: Error}>, cancel: () => void }}
   */
  function runFnameAnimation(equation, container, options) {
    const opts = { ...DEFAULTS, ...(options || {}) };
    let rafId = null;
    let cancelled = false;

    const promise = new Promise((resolve) => {
      const fact = normalizeEquation(equation);
      let model;
      let unitWidth;
      let xAt;
      try {
        model = parseEquation(fact);
        unitWidth = unitWidthForContainer(container, model, opts);
        xAt = makeXAt(opts.axisStart, 36, unitWidth);
      } catch (err) {
        resolve({ error: err });
        return;
      }

      const total = model.total;
      const row = {
        fact,
        model,
        unitWidth,
        xAt,
        total,
        objectCount: 0,
        animStep: 0,
        x1: 0,
        x2: 0,
      };

      const draw = () => {
        const label = bracketLabel(
          row.objectCount,
          row.model,
          totalSlotKey(row.model),
          opts
        );
        const drawn = fname(fact, container, {
          ...opts,
          unitWidth,
          animBigBrace: {
            objectCount: row.objectCount,
            animStep: row.animStep ?? 0,
            braceX1: row.x1,
            braceX2: row.x2,
            labelText: label,
          },
        });
        if (drawn?.height) container.style.minHeight = `${drawn.height}px`;
      };

      applyFnameAnimProgress(row, 0);
      draw();

      if (total <= 0) {
        resolve({ done: true });
        return;
      }

      const msPerStep = Number(opts.animBraceMsPerStep) || 400;
      const totalMs = total * msPerStep;
      const t0 = performance.now();

      const tick = (now) => {
        if (cancelled) {
          resolve({ done: false });
          return;
        }
        const globalStep = (now - t0) / msPerStep;
        applyFnameAnimProgress(row, globalStep);
        draw();
        if (now - t0 < totalMs) {
          rafId = requestAnimationFrame(tick);
        } else {
          applyFnameAnimProgress(row, total);
          draw();
          rafId = null;
          resolve({ done: true });
        }
      };
      rafId = requestAnimationFrame(tick);
    });

    return {
      promise,
      cancel() {
        cancelled = true;
        if (rafId != null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      },
    };
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
  global.generatePlusMinusUnknownFacts = generatePlusMinusUnknownFacts;
  global.buildDefaultFactSeries = buildDefaultFactSeries;
  global.parseAamEquation = parseEquation;
  global.fname = fname;
  global.runFnameAnimation = runFnameAnimation;
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
