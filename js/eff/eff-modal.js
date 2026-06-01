(function (global) {
  "use strict";

  // ── Constante EFF (duplicate din qf-generator pentru uz standalone) ────────────

  const F1_TYPES = [
    "f1_initial",
    "f1_comutat",
    "f1_complementar",
    "f1_complementar_comutat",
  ];
  const F2_TYPES = ["doua_nr_in_STANGA", "doua_nr_in_DREAPTA"];
  const F2_LABEL = { doua_nr_in_STANGA: "STÂNGA", doua_nr_in_DREAPTA: "DREAPTA" };
  const F3_GROUPS = [
    "trei_pozitii_pt_cate_un_numar",
    "doua_pozitii_pt_cate_un_semn_operator_matematic",
    "o_pozitie_pt_cate_2_semne",
    "trei_pozitii_pt_cate_2_numere",
    "sase_pozitii_pt_cate_un_semn_si_un_numar",
  ];
  const F3_VARIANT_COUNT = {
    trei_pozitii_pt_cate_un_numar: 3,
    doua_pozitii_pt_cate_un_semn_operator_matematic: 2,
    o_pozitie_pt_cate_2_semne: 1,
    trei_pozitii_pt_cate_2_numere: 3,
    sase_pozitii_pt_cate_un_semn_si_un_numar: 6,
  };

  // ── Stare modal ──────────────────────────────────────────────────────────────────

  let currentQuizId  = null;
  let onSaveCallback = null;
  let sw = {};
  let f0 = { a: 3, op: "+", b: 2, r: 5 };
  let modalCreated   = false;

  // ── Funcții EFF (identice cu eff-explorer.html) ────────────────────────────────

  function applyF1({ a, op, b, r }, f1) {
    switch (f1) {
      case "f1_initial":             return { x: a, op,   y: b, r };
      case "f1_comutat":
        if (op === "+" || op === "*") return { x: b, op,   y: a, r };
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

  function applyF2({ x, op, y, r }, f2) {
    return f2 === "doua_nr_in_STANGA"
      ? [String(x), op, String(y), "=", String(r)]
      : [String(r), "=", String(x), op, String(y)];
  }

  function applyF3(tokens, f3) {
    const mk = (idxs) => {
      const t = [...tokens];
      idxs.forEach((i) => (t[i] = "?"));
      return t.join("");
    };
    switch (f3) {
      case "trei_pozitii_pt_cate_un_numar":
        return [[0], [2], [4]].map(mk);
      case "doua_pozitii_pt_cate_un_semn_operator_matematic":
        return [[1], [3]].map(mk);
      case "o_pozitie_pt_cate_2_semne":
        return [mk([1, 3])];
      case "trei_pozitii_pt_cate_2_numere":
        return [[0, 2], [0, 4], [2, 4]].map(mk);
      case "sase_pozitii_pt_cate_un_semn_si_un_numar":
        return [[1, 0], [1, 2], [1, 4], [3, 0], [3, 2], [3, 4]].map(mk);
      default: return [];
    }
  }

  function rnd(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

  function randomFact() {
    const ops = ["+", "-", "*", ":"];
    const op  = ops[rnd(0, 3)];
    let a, b, r;
    if      (op === "+") { a = rnd(0, 20); b = rnd(0, 20); r = a + b; }
    else if (op === "-") { a = rnd(0, 20); b = rnd(0, a);  r = a - b; }
    else if (op === "*") { a = rnd(0, 20); b = rnd(0, 20); r = a * b; }
    else                 { b = rnd(1, 10); r = rnd(0, 10); a = b * r; }
    return { a, op, b, r };
  }

  function countCombinations() {
    const f1c = F1_TYPES.filter((k) => sw[k]).length;
    const f2c = F2_TYPES.filter((k) => sw[k]).length;
    const f3c = F3_GROUPS.reduce((s, k) => s + (sw[k] ? F3_VARIANT_COUNT[k] : 0), 0);
    return f1c * f2c * f3c;
  }

  function wbr(s) { return s.replace(/_/g, "_<wbr>"); }

  // ── Creare modal DOM ──────────────────────────────────────────────────────────

  function createModal() {
    if (modalCreated) return;
    modalCreated = true;

    const overlay = document.createElement("div");
    overlay.id = "eff-modal-overlay";
    overlay.className = "eff-modal-overlay hidden";
    overlay.innerHTML = `
      <div class="eff-modal">
        <div class="eff-modal-header">
          <span class="eff-modal-title">⚙ Tipuri EFF pentru acest quiz</span>
          <button class="eff-modal-close" id="eff-modal-close" aria-label="Închide">✕</button>
        </div>
        <div class="eff-modal-body">
          <div class="eff-modal-f0-bar">
            <div class="eff-modal-f0-box" id="eff-modal-f0-box">3+2=5</div>
            <button class="eff-modal-btn-gen" id="eff-modal-btn-gen">🔀 Fact aleator</button>
            <span class="eff-modal-combo-text">
              Combinații: <strong id="eff-modal-combo-count">—</strong>
            </span>
          </div>
          <div class="eff-modal-table-wrap" id="eff-modal-tbl-wrap">
            <div id="eff-modal-tbl"></div>
          </div>
        </div>
        <div class="eff-modal-footer">
          <button class="eff-modal-save-btn" id="eff-modal-save">
            Salvează profilul EFF pentru acest quiz
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector("#eff-modal-close").addEventListener("click", close);
    overlay.querySelector("#eff-modal-btn-gen").addEventListener("click", () => {
      f0 = randomFact();
      renderF0();
      renderTable();
    });
    overlay.querySelector("#eff-modal-save").addEventListener("click", save);

    global.EFFModalToggle = (key) => { sw[key] = !sw[key]; renderTable(); };
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  function renderF0() {
    const el = document.getElementById("eff-modal-f0-box");
    if (el) el.textContent = `${f0.a}${f0.op}${f0.b}=${f0.r}`;
  }

  function swBtn(key, label) {
    return `<button class="eff-sw ${sw[key] ? "eff-sw-on" : "eff-sw-off"}" onclick="EFFModalToggle('${key}')">${label}</button>`;
  }

  function renderTable() {
    let h = "<table class='eff-tbl'>";

    // Header
    h += "<thead><tr>";
    h += "<th style='min-width:84px'>F1</th>";
    h += "<th style='min-width:74px'>F2</th>";
    h += "<th style='min-width:140px'>Forma</th>";
    F3_GROUPS.forEach((g) => {
      h += `<th style='min-width:118px'><code class='eff-tbl-code'>${wbr(g)}</code><br>${swBtn(g, sw[g] ? "ON" : "OFF")}</th>`;
    });
    h += "</tr></thead>";

    // Rows
    h += "<tbody>";
    F1_TYPES.forEach((f1, fi) => {
      const f1on = sw[f1];
      F2_TYPES.forEach((f2, f2i) => {
        const f2on  = sw[f2];
        const rowOn = f1on && f2on;

        h += `<tr data-fi="${fi}">`;

        if (f2i === 0) {
          h += `<td rowspan="2" class="eff-tbl-sw-cell">
            <div class="eff-tbl-f1-label">${wbr(f1)}</div>
            ${swBtn(f1, f1on ? "ON" : "OFF")}
          </td>`;
        }

        h += `<td class="eff-tbl-sw-cell">${swBtn(f2, F2_LABEL[f2])}</td>`;

        const f1r    = applyF1(f0, f1);
        const tokens = f1r ? applyF2(f1r, f2) : null;
        const baseEq = tokens ? tokens.join("") : "—";
        h += `<td class="eff-tbl-title${rowOn ? "" : " eff-dimmed"}">
          ${f1}, ${F2_LABEL[f2]}<code class='eff-tbl-base'>${baseEq}</code>
        </td>`;

        F3_GROUPS.forEach((f3) => {
          const cellOn  = rowOn && sw[f3];
          const content = tokens ? applyF3(tokens, f3).join("  ") : "";
          h += `<td class="eff-tbl-content${cellOn ? "" : " eff-dimmed"}">${content}</td>`;
        });

        h += "</tr>";
      });
    });
    h += "</tbody></table>";

    document.getElementById("eff-modal-tbl").innerHTML = h;
    document.getElementById("eff-modal-combo-count").textContent = countCombinations();
  }

  // ── Open / Close / Save ───────────────────────────────────────────────────────

  function open(quizId, onSave) {
    createModal();
    currentQuizId  = quizId;
    onSaveCallback = onSave ?? null;
    sw = { ...global.EFFProfileStore.getProfile(quizId) };
    renderF0();
    renderTable();
    document.getElementById("eff-modal-overlay").classList.remove("hidden");
  }

  function close() {
    const el = document.getElementById("eff-modal-overlay");
    if (el) el.classList.add("hidden");
  }

  function save() {
    global.EFFProfileStore.saveProfile(currentQuizId, { ...sw });
    if (typeof onSaveCallback === "function") onSaveCallback({ ...sw });
    close();
  }

  global.EFFModal = { open, close };
})(window);
