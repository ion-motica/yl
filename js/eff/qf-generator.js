(function (global) {
  "use strict";

  // ── Constante taxonomie ────────────────────────────────────────────────────────

  const F1_TYPES = [
    "f1_initial",
    "f1_comutat",
    "f1_complementar",
    "f1_complementar_comutat",
  ];

  const F2_TYPES = ["doua_nr_in_STANGA", "doua_nr_in_DREAPTA"];

  // Faza 1: forme cu o singură necunoscută
  const PHASE1_F3 = [
    { key: "trei_pozitii_pt_cate_un_numar", positions: [0, 2, 4] },
    { key: "doua_pozitii_pt_cate_un_semn_operator_matematic", positions: [1, 3] },
  ];

  const ALL_PROFILE_KEYS = [
    ...F1_TYPES,
    ...F2_TYPES,
    ...PHASE1_F3.map((f) => f.key),
  ];

  function defaultProfile() {
    const p = {};
    ALL_PROFILE_KEYS.forEach((k) => (p[k] = true));
    return p;
  }

  // ── Conversie FactCatalog → raw ────────────────────────────────────────────────
  // raw = { a, op, b, r }  (op ∈ {'+','-','*',':'})

  const OP_MAP = { add: "+", sub: "-", mul: "*", div: ":" };

  function factToRaw(fact) {
    return {
      a: fact.values.a,
      op: OP_MAP[fact.operation],
      b: fact.values.b,
      r: fact.values.result,
    };
  }

  // ── Transformare F1 ────────────────────────────────────────────────────────────
  // Returnează { x, op, y, r } sau null dacă transformarea nu e aplicabilă.

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

  // ── Orientare F2 → 5 tokeni ────────────────────────────────────────────────────
  // STÂNGA: [nr1, op_arith, nr2, "=", result]
  // DREAPTA: [result, "=", nr1, op_arith, nr2]

  function applyF2(f1Fact, f2) {
    const { x, op, y, r } = f1Fact;
    if (f2 === "doua_nr_in_STANGA") {
      return [String(x), op, String(y), "=", String(r)];
    }
    return [String(r), "=", String(x), op, String(y)];
  }

  // ── Validare ───────────────────────────────────────────────────────────────────

  const ARITH_OPS = new Set(["+", "-", "*", ":"]);

  function isValidF1Fact(f1Fact) {
    if (!f1Fact) return false;
    if (f1Fact.op === ":" && (f1Fact.y === 0 || f1Fact.y === "0")) return false;
    return true;
  }

  // ── Tipuri QF active ───────────────────────────────────────────────────────────
  // Returnează lista tuturor tipurilor QF active pentru un profil dat.
  // Un „tip QF" este independent de fact; se aplică acelui fact la render.

  function getActiveQFTypes(profile) {
    const types = [];
    for (const f1 of F1_TYPES) {
      if (!profile[f1]) continue;
      for (const f2 of F2_TYPES) {
        if (!profile[f2]) continue;
        for (const { key, positions } of PHASE1_F3) {
          if (!profile[key]) continue;
          for (const pos of positions) {
            types.push({
              id: `${f1}:${f2}:${key}:${pos}`,
              f1,
              f2,
              f3Key: key,
              pos,
            });
          }
        }
      }
    }
    return types;
  }

  // ── Render QF pentru un fact concret ──────────────────────────────────────────
  // Returnează { prompt, correctAnswer, answerType } sau null dacă invalid.

  function renderQF(qfType, fact) {
    const raw = factToRaw(fact);
    const f1Fact = applyF1(raw, qfType.f1);
    if (!isValidF1Fact(f1Fact)) return null;

    const tokens = applyF2(f1Fact, qfType.f2);
    const correctAnswer = tokens[qfType.pos];

    const t = [...tokens];
    t[qfType.pos] = "?";
    const prompt = t.join("");

    let answerType;
    if (ARITH_OPS.has(correctAnswer)) answerType = "arith_op";
    else if (correctAnswer === "=") answerType = "relation_op";
    else answerType = "number";

    return { prompt, correctAnswer, answerType };
  }

  // ── Distractori ────────────────────────────────────────────────────────────────

  function pickNearWrongNumbers(correctAnswer, count, shuffle) {
    const correctNum = Number(correctAnswer);
    const optMax = Math.max(12, correctNum + 2);
    const OPTION_MIN = 0;
    const used = new Set([correctAnswer]);
    const candidates = [];
    for (let delta = 1; delta <= optMax + 2; delta++) {
      for (const v of [correctNum - delta, correctNum + delta]) {
        if (v < OPTION_MIN || v > optMax) continue;
        const s = String(v);
        if (used.has(s)) continue;
        candidates.push(s);
        used.add(s);
      }
    }
    return shuffle(candidates).slice(0, count);
  }

  // ── Construiește opțiunile pentru o întrebare ─────────────────────────────────
  // Returnează { options: [string,string,string], correctIndex, prompt, answerType }
  // sau null dacă QF e invalid pentru acest fact.

  function buildOptions(qfType, fact, shuffle) {
    const rendered = renderQF(qfType, fact);
    if (!rendered) return null;

    const { correctAnswer, answerType, prompt } = rendered;
    let wrong;

    if (answerType === "arith_op") {
      wrong = shuffle(["+", "-", "*", ":"].filter((op) => op !== correctAnswer)).slice(0, 2);
    } else if (answerType === "relation_op") {
      wrong = ["<", ">"];
    } else {
      wrong = pickNearWrongNumbers(correctAnswer, 2, shuffle);
    }

    while (wrong.length < 2) {
      const n = Number(correctAnswer);
      const c1 = String(Math.max(0, n - (wrong.length + 1)));
      const c2 = String(n + (wrong.length + 1));
      const candidate = !wrong.includes(c1) && c1 !== correctAnswer ? c1 : c2;
      wrong.push(candidate);
    }

    const options = shuffle([correctAnswer, wrong[0], wrong[1]]);
    return {
      options,
      correctIndex: options.indexOf(correctAnswer),
      prompt,
      answerType,
    };
  }

  // ── Număr combinații (pentru modal) ───────────────────────────────────────────

  const F3_VARIANT_COUNT = {
    trei_pozitii_pt_cate_un_numar: 3,
    doua_pozitii_pt_cate_un_semn_operator_matematic: 2,
    o_pozitie_pt_cate_2_semne: 1,
    trei_pozitii_pt_cate_2_numere: 3,
    sase_pozitii_pt_cate_un_semn_si_un_numar: 6,
  };

  const ALL_F3_GROUPS = [
    "trei_pozitii_pt_cate_un_numar",
    "doua_pozitii_pt_cate_un_semn_operator_matematic",
    "o_pozitie_pt_cate_2_semne",
    "trei_pozitii_pt_cate_2_numere",
    "sase_pozitii_pt_cate_un_semn_si_un_numar",
  ];

  function countCombinations(profile) {
    const f1 = F1_TYPES.filter((k) => profile[k]).length;
    const f2 = F2_TYPES.filter((k) => profile[k]).length;
    const f3 = ALL_F3_GROUPS.reduce(
      (s, k) => s + (profile[k] ? F3_VARIANT_COUNT[k] : 0),
      0
    );
    return f1 * f2 * f3;
  }

  global.QFGenerator = {
    F1_TYPES,
    F2_TYPES,
    PHASE1_F3,
    ALL_F3_GROUPS,
    ALL_PROFILE_KEYS,
    F3_VARIANT_COUNT,
    defaultProfile,
    factToRaw,
    applyF1,
    applyF2,
    isValidF1Fact,
    getActiveQFTypes,
    renderQF,
    buildOptions,
    countCombinations,
  };
})(window);
