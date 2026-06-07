/**
 * Referință acolade extensibile — desen SVG (nu caractere Unicode).
 *
 * ReferintaAcolade.path(...)        → string d
 * ReferintaAcolade.append(svg, ...) → { R, L, orient, d }
 * ReferintaAcolade.spanForObjects(...) → { x1, x2 } pe axă cu obiecte
 */
(function (global) {
  "use strict";

  /** Raza sfertului de cerc (px). */
  const R0 = 6;
  /** Lățime fixă = 4R (cap + vârf 2R + cap). */
  const FIXED_R = 4;

  const ORIENT = {
    JOS: "jos",
    SUS: "sus",
    STANGA: "stanga",
    DREAPTA: "dreapta",
  };

  const DEFAULTS = {
    stroke: "#0f172a",
    strokeWidth: 1.35,
    className: "ref-acolada",
  };

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function svgEl(name, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, String(v));
      }
    }
    return el;
  }

  /** R efectiv: dacă span < 4·R0, R = span/4 (cap + vârf + cap încap). */
  function radius(span, r0) {
    const base = r0 != null ? r0 : R0;
    const w = Math.max(span, 0);
    return w >= FIXED_R * base ? base : w / FIXED_R;
  }

  /** Lungimea unei laturi drepte (stânga sau dreapta) — variabilă la animație. */
  function straightHalf(span, R) {
    return Math.max(0, span - FIXED_R * R) / 2;
  }

  /**
   * Deschisă în jos: muchia de referință y0 e lipa cea mai apropiată de conținut (dedesubt).
   * Vârf ascuțit la (xc, y0−2R). Arcurile centrale curbe spre interior (sweep 0), nu spre exterior.
   */
  function pathOpenJos(x1, x2, y0, R) {
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

  /** Deschisă în sus: y0 = lipa de sus; vârf la (xc, y0+2R). */
  function pathOpenSus(x1, x2, y0, R) {
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

  /**
   * @param {number} spanStart — x1 (jos/sus) sau y1 (stânga/dreapta)
   * @param {number} spanEnd
   * @param {number} anchor — y0 pentru jos/sus, x0 pentru stânga/dreapta
   * @param {string} orient — ORIENT.*
   * @param {{ r0?: number }} [opts]
   */
  function path(spanStart, spanEnd, anchor, orient, opts) {
    const o = opts || {};
    const horiz = orient === ORIENT.JOS || orient === ORIENT.SUS;

    if (horiz) {
      const x1 = spanStart;
      const x2 = spanEnd;
      const R = radius(x2 - x1, o.r0);
      return orient === ORIENT.JOS
        ? pathOpenJos(x1, x2, anchor, R)
        : pathOpenSus(x1, x2, anchor, R);
    }

    const span = spanEnd - spanStart;
    const R = radius(span, o.r0);
    return pathOpenJos(0, span, 0, R);
  }

  /**
   * Desenează acolada în SVG.
   * @returns {{ R, L, orient, d, pathEl? }}
   */
  function append(svg, spanStart, spanEnd, anchor, orient, opts) {
    const o = { ...DEFAULTS, ...(opts || {}) };
    const horiz = orient === ORIENT.JOS || orient === ORIENT.SUS;
    let R;
    let L;
    let d;
    let pathEl;

    if (horiz) {
      const x1 = spanStart;
      const x2 = spanEnd;
      R = radius(x2 - x1, o.r0);
      L = straightHalf(x2 - x1, R);
      d =
        orient === ORIENT.JOS
          ? pathOpenJos(x1, x2, anchor, R)
          : pathOpenSus(x1, x2, anchor, R);
      pathEl = svgEl("path", {
        d,
        class: o.className,
        fill: "none",
        stroke: o.stroke,
        "stroke-width": o.strokeWidth,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      });
      svg.appendChild(pathEl);
    } else {
      const y1 = spanStart;
      const y2 = spanEnd;
      const span = y2 - y1;
      R = radius(span, o.r0);
      L = straightHalf(span, R);
      d = pathOpenJos(0, span, 0, R);
      const cx = anchor;
      const cy = y1 + span / 2;
      const deg = orient === ORIENT.STANGA ? -90 : 90;
      const g = svgEl("g", {
        transform: `translate(${cx} ${cy}) rotate(${deg}) translate(${-span / 2} 0)`,
      });
      pathEl = svgEl("path", {
        d,
        class: o.className,
        fill: "none",
        stroke: o.stroke,
        "stroke-width": o.strokeWidth,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      });
      g.appendChild(pathEl);
      svg.appendChild(g);
    }

    return { R, L, orient, d, pathEl };
  }

  /**
   * Extinde span-ul de la centrele obiectelor la marginile vizuale:
   * ± jumătatea distanței dintre două numere întregi consecutive pe axă.
   */
  function spanForObjects(startIdx, endIdx, xAt, unit) {
    const half = unit / 2;
    return {
      x1: xAt(startIdx) - half,
      x2: xAt(endIdx) + half,
    };
  }

  /** Demo: desenează acolada într-un viewBox cu span orizontal centrat. */
  function demoInViewBox(svg, width, height, orient, opts) {
    const o = opts || {};
    const pad = o.pad != null ? o.pad : 24;
    const span = o.span != null ? o.span : width - pad * 2;
    const horiz = orient === ORIENT.JOS || orient === ORIENT.SUS;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    if (horiz) {
      const x1 = (width - span) / 2;
      const x2 = x1 + span;
      const anchor =
        orient === ORIENT.JOS ? height - pad - R0 * 2 : pad + R0 * 2;
      return append(svg, x1, x2, anchor, orient, o);
    }

    const y1 = (height - span) / 2;
    const y2 = y1 + span;
    const anchor = width / 2;
    return append(svg, y1, y2, anchor, orient, o);
  }

  const ReferintaAcolade = {
    R0,
    FIXED_R,
    ORIENT,
    radius,
    straightHalf,
    pathOpenJos,
    pathOpenSus,
    path,
    append,
    spanForObjects,
    demoInViewBox,
  };

  global.ReferintaAcolade = ReferintaAcolade;
})(typeof window !== "undefined" ? window : globalThis);
