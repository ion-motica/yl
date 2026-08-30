(function (global) {
  "use strict";

  // Înălțimea de referință a scenei. Toate vitezele de mai jos sunt calibrate
  // pentru această înălțime; la rulare, viteza reală e scalată cu
  // (înălțimea scenei / REF_H), astfel încât TIMPUL de cădere să rămână
  // perceptiv același pe scene de înălțimi diferite (paritate side-by-side).
  const REF_H = 420;
  const ARENA_H = REF_H; // fallback când scena încă nu are dimensiuni măsurabile
  const BOX_MIN = 112;
  const FALL_SPEED = 54;
  const RISE_TRAVEL_S = 0.5;
  const DEFAULT_REVEAL_HOLD_MS = 160;
  // "Mod scriere intrebare noua" (decis de user, 30.08.2026): la fiecare randare
  // motorul expune explicit, ca string lung si citibil (nu enum scurt), care din
  // cele doua strategii a folosit ca sa puna intrebarea pe ecran. Vezi
  // `aplicaElementeDivIntrebare` mai jos.
  const MOD_SCRIERE_STERGERE_COMPLETA =
    "stergere completa intrebare veche si rescriere intrebare noua de la 0";
  const MOD_SCRIERE_MODIFICARE_ELEMENTE =
    "modificare elemente din intrebarea veche, fara stergere intrebare veche";
  // Placeholderul de raspuns (locul care primeste una din cele 3 valori de pe
  // butoane) NU mai e cunoscut aici. Fiecare quiz il declara explicit, prin
  // `placeholderRaspuns` — vezi `js/placeholder-raspuns.js` si
  // `documente de referinta/CONTINUARE-contract-semn-intrebare.md`.
  //
  // Inainte, motorul hardcoda "?" in trei locuri, cu logici care se contraziceau
  // (unul il cauta, altul il inlocuia pe primul, al treilea le marca pe toate).
  const BOUNCE_UP = 48;
  // După bounce, liftul trebuie să ajungă clar deasupra jumătății traseului
  // (y = fracție × travelSpan; sub 0.5 = în jumătatea de sus).
  const BOUNCE_MIN_FRAC = 0.4;
  const FLASH_MS = 420;
  // Cerut explicit de user (20.08.2026, "De adresat dupa finalizarea planului
  // curent" din documente de referinta/RAPORT-motor-comun-raspuns.md): pauza
  // implicita la finalul unui "serie-terminata" fara avans de nivel eliminata —
  // rupea ritmul la lanturi cu pasi rapizi (ex. prime-divisors.js). Avansul de
  // nivel (LEVEL_ADV_MS) ramane neatins, are alt scop (celebrarea "Next level!").
  const PAUZA_INTRE_SERII_IMPLICITA_MS = 0;
  const LEVEL_ADV_MS = 1400;
  const LIFT_BG_OPACITY_DEFAULT = 0.8;

  function FallingEngine(config) {
    const dom = config.dom;
    const getQuiz = config.getQuiz;

    // Contractul placeholderului: OBLIGATORIU si EXPLICIT, fara fallback tacit.
    // Un quiz care nu-l declara opreste randarea cu o eroare care spune exact ce
    // lipseste — asa un quiz nou nu poate sa "uite", iar divergenta (trei clase
    // diferite pentru acelasi lucru) nu mai poate intra din neatentie.
    // Vezi `js/placeholder-raspuns.js`.
    function placeholderRaspuns() {
      const p = getQuiz()?.placeholderRaspuns;
      if (!p) {
        throw new Error(
          "FallingEngine: quizul nu declara `placeholderRaspuns`. Fiecare quiz " +
            "trebuie sa-l declare explicit, chiar si cand e handlerul generic: " +
            '`placeholderRaspuns: global.PlaceholderRaspuns.creeaza("?")`. ' +
            "Vezi js/placeholder-raspuns.js si documente de referinta/" +
            "CONTINUARE-contract-semn-intrebare.md."
        );
      }
      return p;
    }

    // Contractul schimbarii de nivel: OBLIGATORIU si EXPLICIT, ca la
    // `placeholderRaspuns`. Se cere doar in momentul in care chiar se schimba
    // nivelul (sau se termina jocul), ca sa nu oblige quizurile fara niveluri.
    // Vezi `js/schimbare-de-nivel.js`.
    function schimbareDeNivel() {
      const s = getQuiz()?.laSchimbareDeNivel;
      if (!s) {
        throw new Error(
          "FallingEngine: quizul avanseaza nivelul dar nu declara " +
            "`laSchimbareDeNivel`. Fiecare quiz cu niveluri trebuie sa-l " +
            "declare explicit, chiar si cand e handlerul standard: " +
            "`laSchimbareDeNivel: global.SchimbareDeNivel.standard()`. " +
            "Vezi js/schimbare-de-nivel.js si documente de referinta/" +
            "RAPORT-motor-comun-raspuns.md."
        );
      }
      return s;
    }

    let fallY = 0;
    let boxH = BOX_MIN;
    // Înălțimea reală a scenei (arena), citită din DOM. Pe desktop = 420px
    // (înălțime CSS fixă), deci comportamentul rămâne identic cu cel anterior.
    let arenaH = ARENA_H;
    let animating = false;
    let locked = false;
    let bouncing = false;
    let paused = false;
    let rafId = null;
    let roundStartedAt = null;
    let roundDisplayedAt = null;
    let journalQuestionKey = null;
    let journalButtonPressCount = 0;
    let fallHeld = false;
    let liftBgOpacity = config.liftBgOpacity ?? LIFT_BG_OPACITY_DEFAULT;
    // Lățimea liftului ca procent din arenă (null = lățimea implicită din CSS).
    let liftWidthPct = null;
    {
      const stored = global.LayoutConfig && global.LayoutConfig.get("liftWidthPct", null);
      if (typeof stored === "number" && stored >= 20 && stored <= 100) liftWidthPct = stored;
    }
    let swapQuestionIllustration = false;
    let riseFromButton = global.LayoutConfig
      ? global.LayoutConfig.get("riseFromButton", false)
      : false;
    let revealAnswerOnContact =
      global.LayoutConfig && global.LayoutConfig.get("revealAnswerOnContact", true) !== false;
    let lastRoundState = null;
    /** Indici greșiți pe același număr (centrul) — rămân gri până la răspuns corect. */
    const wrongPicksThisStep = new Set();

    // Reduce font size pas cu pas până când textul încape în lift (chenarul albastru).
    function questionMaxWidth() {
      if (
        swapQuestionIllustration &&
        dom.arenaQuestionSlotEl &&
        !dom.arenaQuestionSlotEl.hidden
      ) {
        return Math.max(0, dom.arenaQuestionSlotEl.clientWidth - 16);
      }

      const lift = dom.falling;
      if (!lift) return 0;

      const rect = lift.getBoundingClientRect();
      const inner = lift.querySelector(".falling-inner");
      const padX = inner
        ? Math.max(12, (rect.width - inner.clientWidth) / 2 + 8)
        : 16;

      return Math.max(0, Math.floor(rect.width - padX * 2));
    }

    function measureQuestionWidth(el) {
      el.style.display = "inline-block";
      el.style.width = "max-content";
      el.style.maxWidth = "none";
      el.style.margin = "0";
      el.style.overflow = "visible";
      el.style.verticalAlign = "top";
      return el.scrollWidth;
    }

    function fitNumberText(el) {
      if (!el) return;

      function runFit() {
        const maxWidth = questionMaxWidth();
        if (maxWidth <= 0) return;

        el.style.fontSize = "";
        el.style.transform = "";
        el.style.transformOrigin = "center top";
        el.style.textAlign = "center";
        el.style.boxSizing = "border-box";

        let fs = parseFloat(getComputedStyle(el).fontSize);
        const minFs = 10;
        let textWidth = measureQuestionWidth(el);

        while (textWidth > maxWidth && fs > minFs) {
          fs -= 1;
          el.style.fontSize = fs + "px";
          textWidth = measureQuestionWidth(el);
        }

        if (textWidth > maxWidth && textWidth > 0) {
          const scale = maxWidth / textWidth;
          el.style.transform = `scale(${scale})`;
        }

        el.style.display = "inline-block";
        el.style.width = "auto";
        el.style.maxWidth = maxWidth + "px";
        el.style.marginLeft = "auto";
        el.style.marginRight = "auto";
        el.style.overflow = "visible";
      }

      runFit();
      requestAnimationFrame(() => {
        runFit();
        requestAnimationFrame(runFit);
      });
    }

    function nowMs() {
      if (global.performance && typeof global.performance.now === "function") {
        return global.performance.now();
      }
      return Date.now();
    }

    function startResponseTimer() {
      roundStartedAt = nowMs();
      roundDisplayedAt = new Date().toISOString();
    }

    function attemptMeta(extra = {}) {
      return {
        at: new Date().toISOString(),
        questionDisplayedAt: roundDisplayedAt,
        responseMs: roundStartedAt == null ? null : Math.max(0, Math.round(nowMs() - roundStartedAt)),
        ...extra,
      };
    }

    function refreshArenaMetrics() {
      const h = Math.round(dom.arena?.getBoundingClientRect().height || 0);
      // Plasă de siguranță: scena trebuie să fie mai înaltă decât cutia care cade.
      arenaH = h > BOX_MIN ? h : ARENA_H;
    }

    // Distanța pe care o parcurge liftul, în px, de la sus până jos.
    function travelSpan() {
      return Math.max(1, arenaH - boxH);
    }

    // Factor de scalare a vitezei: la înălțimi mai mari, viteza în px/s crește
    // proporțional, astfel încât timpul de cădere rămâne ~constant. Pe scena de
    // referință (420px) factorul este 1 → viteză identică cu cea anterioară.
    function speedScale() {
      return arenaH / REF_H;
    }

    function syncBoxHeight() {
      const measured = Math.ceil(dom.falling.getBoundingClientRect().height);
      // În modurile bară/mingie moverul e mic și gol → folosim înălțimea reală
      // (fără podeaua BOX_MIN, care e pentru liftul-conținut din v1) ca să cadă
      // pe tot traseul, fără gol jos.
      const contentMode =
        (global.LiftType?.getEffectiveLiftMode?.() ?? "content") === "content";
      boxH = contentMode
        ? Math.max(BOX_MIN, measured)
        : Math.max(8, measured);
      refreshArenaMetrics();
    }

    function setFallPosition(y) {
      fallY = y;
      dom.falling.style.top = `${y}px`;
    }

    // Reașază liftul după o redimensionare a scenei (rotire, bară URL,
    // schimbare de raport), păstrând poziția RELATIVĂ (fracția 0→1) ca să nu
    // „țopăie”. Pe desktop, unde înălțimea arenei e fixă, e inert.
    function applyResize() {
      const prevSpan = travelSpan();
      const frac = Math.min(1, Math.max(0, fallY / prevSpan));
      syncBoxHeight();
      fallY = frac * travelSpan();
      dom.falling.style.top = `${fallY}px`;
      if (dom.topNumberEl && lastRoundState) {
        fitNumberText(dom.topNumberEl);
      }
      config.onResize?.();
    }

    function applyLiftBgOpacity() {
      dom.falling.style.setProperty("--lift-bg-opacity", String(liftBgOpacity));
    }

    function applyLiftWidth() {
      if (liftWidthPct != null) {
        dom.falling.style.setProperty("--lift-width", liftWidthPct + "%");
      } else {
        dom.falling.style.removeProperty("--lift-width");
      }
    }

    function getQuestionSlotEl() {
      return swapQuestionIllustration ? dom.arenaQuestionSlotEl : dom.fallingMainEl;
    }

    function applyLayoutSwap() {
      dom.gameEl?.classList.toggle(
        "layout-q-ilustrare-swapped",
        swapQuestionIllustration
      );

      const questionHome = getQuestionSlotEl();
      if (questionHome && dom.topNumberEl?.parentElement !== questionHome) {
        questionHome.appendChild(dom.topNumberEl);
      }

      if (dom.fallingMainEl) {
        dom.fallingMainEl.hidden = swapQuestionIllustration;
        dom.fallingMainEl.setAttribute(
          "aria-hidden",
          swapQuestionIllustration ? "true" : "false"
        );
      }

      if (dom.arenaQuestionSlotEl) {
        dom.arenaQuestionSlotEl.hidden = !swapQuestionIllustration;
        dom.arenaQuestionSlotEl.setAttribute(
          "aria-hidden",
          swapQuestionIllustration ? "false" : "true"
        );
      }

      if (dom.illustrareLiftEl) {
        dom.illustrareLiftEl.hidden = !swapQuestionIllustration;
        dom.illustrareLiftEl.setAttribute(
          "aria-hidden",
          swapQuestionIllustration ? "false" : "true"
        );
      }

      syncBoxHeight();
      if (config.onLayoutSwapChange?.()) return;
      if (lastRoundState) renderRound(lastRoundState);
    }

    function buildLiftControlPanel() {
      const panelEl = dom.liftControlPanelEl;
      applyLiftBgOpacity();
      applyLiftWidth();
      if (!panelEl) return;

      panelEl.replaceChildren();
      panelEl.className = "cp-section-body control-panel-mount";

      const opacityRow = document.createElement("div");
      opacityRow.className = "control-panel-lift-field";
      const opacityLabel = document.createElement("label");
      opacityLabel.textContent = "Transparență fundal lift";
      const opacitySlider = document.createElement("input");
      opacitySlider.type = "range";
      opacitySlider.min = "0";
      opacitySlider.max = "100";
      opacitySlider.step = "1";
      opacitySlider.value = String(Math.round(liftBgOpacity * 100));
      const opacityOut = document.createElement("span");
      opacityOut.className = "control-panel-lift-slider-out";
      opacityOut.textContent = `${opacitySlider.value}%`;
      opacitySlider.addEventListener("input", () => {
        liftBgOpacity = Number(opacitySlider.value) / 100;
        opacityOut.textContent = `${opacitySlider.value}%`;
        applyLiftBgOpacity();
      });
      opacityRow.append(opacityLabel, opacitySlider, opacityOut);
      panelEl.appendChild(opacityRow);

      const widthRow = document.createElement("div");
      widthRow.className = "control-panel-lift-field";
      const widthLabel = document.createElement("label");
      widthLabel.textContent = "Lățime lift";
      const widthSlider = document.createElement("input");
      widthSlider.type = "range";
      widthSlider.min = "40";
      widthSlider.max = "98";
      widthSlider.step = "1";
      // Valoarea inițială: cea salvată; altfel lățimea curentă ca % din arenă.
      let initWidthPct = liftWidthPct;
      if (initWidthPct == null) {
        const aw = dom.arena?.getBoundingClientRect().width || 0;
        const lw = dom.falling?.getBoundingClientRect().width || 0;
        initWidthPct = aw > 0 && lw > 0 ? Math.round((lw / aw) * 100) : 80;
        initWidthPct = Math.max(40, Math.min(98, initWidthPct));
      }
      widthSlider.value = String(initWidthPct);
      const widthOut = document.createElement("span");
      widthOut.className = "control-panel-lift-slider-out";
      widthOut.textContent = `${widthSlider.value}%`;
      widthSlider.addEventListener("input", () => {
        liftWidthPct = Number(widthSlider.value);
        widthOut.textContent = `${liftWidthPct}%`;
        applyLiftWidth();
        if (global.LayoutConfig) global.LayoutConfig.set("liftWidthPct", liftWidthPct);
        // Lățimea schimbă și înălțimea cutiei (rândurile se rearanjează) →
        // recalculăm parcursul, ca liftul să nu „țopăie”.
        applyResize();
      });
      widthRow.append(widthLabel, widthSlider, widthOut);
      panelEl.appendChild(widthRow);

      const riseFromBtnRow = document.createElement("label");
      riseFromBtnRow.className = "control-panel-lift-row";
      const riseFromBtnInput = document.createElement("input");
      riseFromBtnInput.type = "checkbox";
      riseFromBtnInput.checked = riseFromButton;
      riseFromBtnInput.addEventListener("change", () => {
        riseFromButton = riseFromBtnInput.checked;
        if (global.LayoutConfig) global.LayoutConfig.set("riseFromButton", riseFromButton);
      });
      const riseFromBtnSpan = document.createElement("span");
      riseFromBtnSpan.textContent = "Răspunsul urcă din dreptul butonului apăsat";
      riseFromBtnRow.append(riseFromBtnInput, riseFromBtnSpan);
      panelEl.appendChild(riseFromBtnRow);

      const revealAnswerRow = document.createElement("label");
      revealAnswerRow.className = "control-panel-lift-row";
      const revealAnswerInput = document.createElement("input");
      revealAnswerInput.type = "checkbox";
      revealAnswerInput.checked = revealAnswerOnContact;
      revealAnswerInput.addEventListener("change", () => {
        revealAnswerOnContact = revealAnswerInput.checked;
        if (global.LayoutConfig) {
          global.LayoutConfig.set("revealAnswerOnContact", revealAnswerOnContact);
        }
      });
      const revealAnswerSpan = document.createElement("span");
      revealAnswerSpan.textContent = "La contact, ? devine răspunsul ales";
      revealAnswerRow.append(revealAnswerInput, revealAnswerSpan);
      panelEl.appendChild(revealAnswerRow);

      const swapRow = document.createElement("label");
      swapRow.className = "control-panel-lift-row";
      const swapInput = document.createElement("input");
      swapInput.type = "checkbox";
      swapInput.checked = swapQuestionIllustration;
      swapInput.addEventListener("change", () => {
        swapQuestionIllustration = swapInput.checked;
        applyLayoutSwap();
      });
      const swapSpan = document.createElement("span");
      swapSpan.textContent =
        "Switch întrebare în div ilustrație și ilustrație în spațiul întrebării";
      swapRow.append(swapInput, swapSpan);
      panelEl.appendChild(swapRow);

      // Punct de extindere: alte module (ex. controlul de raport al scenei)
      // pot adăuga aici propriile controale, fără ca motorul să le cunoască.
      config.onLiftPanelBuilt?.(panelEl);

      applyLayoutSwap();
    }

    function setInputEnabled(on) {
      locked = !on;
      dom.optionBtns.forEach((b) => {
        b.disabled = !on || paused;
      });
    }

    function flash(type) {
      dom.flashEl.className = `flash active ${type}`;
      if (type === "wrong") dom.gameEl.classList.add("shake");
      setTimeout(() => {
        dom.flashEl.className = "flash";
        dom.gameEl.classList.remove("shake");
      }, FLASH_MS);
    }

    function syncWrongMarks() {
      dom.optionBtns.forEach((btn, i) => {
        btn.classList.toggle("picked-wrong", wrongPicksThisStep.has(i));
      });
      dom.fallingPrimes.forEach((pill, i) => {
        pill.classList.toggle("picked-wrong", wrongPicksThisStep.has(i));
      });
    }

    function clearWrongMarks() {
      wrongPicksThisStep.clear();
      dom.optionBtns.forEach((b) => b.classList.remove("picked-wrong", "selected"));
      dom.fallingPrimes.forEach((el) => el.classList.remove("picked-wrong", "highlight"));
    }

    function markWrongOption(index) {
      wrongPicksThisStep.add(index);
      dom.optionBtns.forEach((btn) => btn.classList.remove("selected"));
      dom.fallingPrimes.forEach((pill) => pill.classList.remove("highlight"));
      syncWrongMarks();
    }

    function normalizeRoundState(state = {}) {
      return {
        prompt: state.prompt ?? "—",
        promptHtml: state.promptHtml,
        options: Array.isArray(state.options) ? state.options : [],
        elementeDivIntrebare: Array.isArray(state.elementeDivIntrebare)
          ? state.elementeDivIntrebare
          : [],
        correctIndex: state.correctIndex ?? null,
        divisionHistory: Array.isArray(state.divisionHistory) ? state.divisionHistory : [],
        hintMessage: state.hintMessage ?? "",
        questionFormat: state.questionFormat ?? null,
        dividend: state.dividend,
        divisor: state.divisor,
        message: state.message ?? "",
        ...state,
      };
    }

    // ---------------------------------------------------------------------
    // Contractul pasului urmator (decis de user, 28.08.2026, dupa regresia de
    // la quizurile Singapore — vezi documente de referinta/
    // RAPORT-motor-comun-raspuns.md).
    //
    // INAINTE: doi campi FRATI, amandoi optionali, pe acelasi rezultat:
    //     { promptHoldMs: 400, continueStep: { ...runda urmatoare... } }
    // iar motorul ii cupla cu `&&`. Deci un camp DESPRE DURATA decidea daca un
    // camp DESPRE FLUX se aplica deloc: scoaterea pauzei anula tacut avansul la
    // runda urmatoare. Relatia dintre ei nu era impusa de nimic — era tinuta
    // minte doar de cine scria linia.
    //
    // ACUM: un singur camp ATOMIC.
    //     { pasUrmator: { dupa: 400, continua: { ...runda urmatoare... } } }
    // Prezenta lui INSEAMNA "aplica pasul" — nu mai exista un al doilea camp de
    // activare de sincronizat mental cu primul. `continua` e obligatoriu (fara
    // el campul n-ar avea ce sa poarte), `dupa` e optional si tine DOAR de
    // durata pauzei.
    function respingeContractulVechi(result) {
      if (result.continueStep === undefined && result.promptHoldMs === undefined) return;
      throw new Error(
        "falling-engine: `continueStep`/`promptHoldMs` nu mai exista — au fost " +
          "inlocuite de campul unic `pasUrmator: { dupa, continua }` " +
          "(28.08.2026). Cuplarea lor prin `&&` pierdea tacut avansul de runda " +
          "cand pauza lipsea; forma noua nu mai permite despartirea lor."
      );
    }

    function valideazaPasulUrmator(pas) {
      if (pas === undefined) return;
      if (!pas || typeof pas !== "object" || Array.isArray(pas)) {
        throw new Error(
          `falling-engine: \`pasUrmator\` trebuie sa fie un obiect { dupa?, continua }, primit: ${typeof pas}`
        );
      }
      if (pas.continua === undefined) {
        throw new Error(
          "falling-engine: `pasUrmator` fara `continua` nu are sens — campul " +
            "exista tocmai ca sa poarte runda urmatoare. Pentru o pauza simpla, " +
            "fara avans de runda, foloseste `pauza_intre_serii_ms`."
        );
      }
      if (pas.dupa !== undefined && typeof pas.dupa !== "number") {
        throw new Error(
          `falling-engine: \`pasUrmator.dupa\` e o durata in ms (numar), primit: ${typeof pas.dupa}`
        );
      }
    }

    // Cat sta raspunsul revelat pe ecran inainte sa se aplice pasul urmator.
    // Scrisa o singura data: era duplicata identic in doua locuri, iar doua
    // copii ale aceleiasi reguli pot diverge tacut.
    function durataPauzeiDeRevelare(result) {
      return result.pasUrmator?.dupa ?? result.pauza_intre_serii_ms ?? DEFAULT_REVEAL_HOLD_MS;
    }

    function normalizeResult(result = {}) {
      // Punct unic de trecere: `normalizeResult` e apelata pe rezultatul unui
      // raspuns SI pe vederea purtata de `pasUrmator.continua`, deci verificarea
      // de aici prinde si un contract vechi imbricat.
      respingeContractulVechi(result);
      valideazaPasulUrmator(result.pasUrmator);
      const normalized = normalizeRoundState(result);
      if (!normalized.outcome) {
        if (normalized.serie_terminata) normalized.outcome = "serie-terminata";
        else if (normalized.correct === false) normalized.outcome = "wrong-answer";
        else if (normalized.resetFall && normalized.flash === "wrong") normalized.outcome = "timeout";
        else if (normalized.bounce) normalized.outcome = "step-correct";
        else normalized.outcome = "round";
      }

      normalized.correct =
        normalized.correct ?? !["wrong-answer", "timeout"].includes(normalized.outcome);
      normalized.serie_terminata =
        Boolean(normalized.serie_terminata) || normalized.outcome === "serie-terminata";
      normalized.gameComplete = Boolean(normalized.gameComplete);
      normalized.levelAdvanced = Boolean(normalized.levelAdvanced);
      normalized.resetFall = Boolean(normalized.resetFall);
      normalized.bounce = Boolean(normalized.bounce);

      return normalized;
    }

    function stateHasQuestionMark(state) {
      if (!state) return false;
      if (state.questionFormat === "singapore-bond") {
        return state.bondKnownAddend != null && state.bondRevealedAddend == null;
      }
      // NU exista aici o ramura pentru `division-eq`. A existat una (verifica
      // `state.revealedQuotient`), dar era COD MORT: niciun quiz nu seteaza
      // vreodata `questionFormat: "division-eq"` (verificat, 27.08.2026 —
      // `grep -rn '"division-eq"' js/ tests/` nu gaseste niciun producator).
      // "Împărțiri la numere prime", singurul quiz cu structura A:B=?, isi
      // scrie singur promptul (`prompt: "8:2=?"`) si se revelează SINGUR —
      // merge deja pe calea generica de mai jos, cu placeholderul contractului.
      //
      // NU exista aici nici o ramura pentru `fg-stack` (stack-ul din "T*/ 11-20 - v4",
      // Subquiz 3). A existat una, care intorcea `false` ca sa opreasca revelarea,
      // dar era COD MORT: quizul trece prin `SubquizDefinition`, iar `view()`
      // (js/subquiz/subquiz-definition.js) nu paseaza mai departe `questionFormat`,
      // deci conditia nu s-a potrivit niciodata.
      //
      // Consecinta reala, raportata de user (27.08.2026): starea ajungea pe calea
      // generica de mai jos, `prompt` fiind textul pe UN SINGUR RAND ("11*9=?"),
      // iar cum stack-ul nu avea niciun slot marcat in DOM, `revealAnswerInPlace`
      // esua si se cadea pe `buildRevealedState` — care reconstruia promptul din
      // acel text si PRABUSEA stack-ul la o linie, vizibil ca un flash.
      //
      // Reparat marcand randul curent din stack (vezi renderStackHtml in
      // js/quizzes/multiplication-1120-v4-intensiv-multipli-234.js): motorul
      // gaseste slotul si schimba doar continutul lui, deci stack-ul ramane intreg
      // si raspunsul apare doar la randul activ.
      const placeholder = placeholderRaspuns();
      const html = String(state.promptHtml ?? "");
      // Clasa conteaza si cand promptul-text nu are deloc semnul (quiz care isi
      // construieste singur promptHtml si tine textul simplu doar pentru loguri).
      if (html.includes(placeholder.clasa)) return true;
      if (placeholder.are(state.prompt)) return true;
      return false;
    }

    function resultAlreadyRevealed(result, beforeState) {
      if (result.answerRevealed) return true;
      if (String(result.promptHtml ?? "").includes("q-correct")) return true;
      if (!stateHasQuestionMark(result)) return true;
      if (beforeState && !isSameQuestion(result, beforeState)) return false;
      return false;
    }

    function isSameQuestion(a, b) {
      if (!a || !b) return false;
      if (a.questionFormat !== b.questionFormat) return false;
      if (a.questionFormat === "singapore-bond") {
        return (
          a.targetSum === b.targetSum &&
          a.bondKnownAddend === b.bondKnownAddend &&
          a.bondMissingSide === b.bondMissingSide
        );
      }
      return String(a.prompt) === String(b.prompt);
    }

    // Revelare "in loc": cauta slotul dedicat in DOM-ul DEJA randat si ii
    // schimba doar continutul (+ clasa de highlight), fara sa atinga restul
    // structurii. Alternativa veche (`buildRevealedState` + `renderRound`)
    // reconstruieste promptul din `state.prompt` — textul SIMPLU de fallback —
    // deci pierde orice promptHtml custom (tabel, randuri, stiluri inline) pe
    // durata revelarii: un flash vizibil, raportat de user (28.08.2026) la
    // quizul "Numaram din 2 in 2".
    //
    // Acopera TOATE quizurile printr-un singur selector: clasa placeholderului,
    // declarata de quiz. Inainte erau doua clase cautate deodata
    // (`.question-to-reveal, .q-mark`), pentru ca fiecare quiz isi alesese numele
    // singur — exact divergenta pe care contractul o elimina.
    //
    // Formatul special `singapore-bond` e lasat INTENTIONAT pe calea veche:
    // revelarea lui scrie un camp de stare propriu (`bondRevealedAddend`),
    // citit si de alt cod, nu doar textul de pe ecran.
    //
    // Intoarce true daca a revelat in loc; false => apelantul cade pe calea
    // veche, neschimbata.
    function revealAnswerInPlace(state, answer) {
      if (state?.questionFormat) return false;
      const placeholder = placeholderRaspuns();
      const slot = dom.topNumberEl?.querySelector(`.${placeholder.clasa}`);
      if (!slot) return false;
      slot.textContent = String(answer ?? "").trim();
      // Dupa revelare nu mai e un placeholder: scoatem clasa, ca restul codului
      // care o cauta (ex. manuta din js/asnw-onboarding.js) sa nu pointeze spre
      // un slot care arata deja raspunsul.
      slot.classList.remove(placeholder.clasa);
      slot.classList.add("q-correct");
      fitNumberText(dom.topNumberEl);
      return true;
    }

    // Mod 2 de scriere a intrebarii noi ("modificare elemente din intrebarea
    // veche, fara stergere intrebare veche"): gaseste in DOM-ul DEJA randat
    // elementele marcate de quiz (`data-element-div-intrebare="id"`) si le
    // schimba doar continutul, fara sa atinga restul structurii din jurul lor.
    //
    // Acelasi principiu ca `revealAnswerInPlace` mai sus: cauta prin
    // querySelector in ce e deja pe ecran, NU parseaza string-ul `promptHtml`
    // nou. Quizul da direct, ca date separate, continutul fiecarui element care
    // s-ar putea sa se fi schimbat — motorul nu ghiceste/extrage nimic dintr-un
    // HTML intreg (acelasi motiv ca la contractul placeholderului: un
    // parsing/replace orb pe HTML deja scris poate rupe structura).
    //
    // Intoarce true daca TOATE elementele cerute au fost gasite si actualizate;
    // false daca macar unul lipseste din DOM-ul curent — apelantul cade atunci
    // pe mod 1 (rescriere completa), neschimbata, ca sa nu ramana un amestec de
    // continut vechi si nou (nicio actualizare partiala aplicata).
    function aplicaElementeDivIntrebare(topNumberEl, elemente) {
      if (!Array.isArray(elemente) || elemente.length === 0) return false;
      const tinte = [];
      for (const elem of elemente) {
        const tinta = topNumberEl?.querySelector(
          `[data-element-div-intrebare="${elem.id}"]`
        );
        if (!tinta) return false;
        tinte.push({ tinta, html: elem.html });
      }
      tinte.forEach(({ tinta, html }) => {
        if (tinta.innerHTML !== html) tinta.innerHTML = html;
      });
      return true;
    }

    function buildRevealedState(state, answer) {
      const ans = String(answer ?? "").trim();
      const mark = `<span class="q-correct">${ans}</span>`;
      const revealed = { ...state, answerRevealed: true };

      if (state.questionFormat === "singapore-bond") {
        revealed.bondRevealedAddend = ans;
        return revealed;
      }
      // Aceeasi logica pentru text si pentru HTML, prin acelasi handler ca la
      // afisare. Inainte, aici se inlocuia DOAR primul semn (cu un caz special
      // pentru "=?"), in timp ce afisarea le marca pe TOATE — doua raspunsuri
      // diferite la aceeasi intrebare. Cu un singur placeholder per intrebare,
      // asa cum cere contractul, rezultatul e identic; diferenta aparea doar la
      // prompturi malformate, cu doua semne.
      const placeholder = placeholderRaspuns();
      const raw = String(state.prompt ?? "");
      if (placeholder.are(raw)) {
        revealed.prompt = placeholder.inlocuieste(raw, ans);
        revealed.promptHtml = placeholder.inlocuieste(raw, mark);
      }
      return revealed;
    }

    function singaporeBondLine(state) {
      const ans = state.bondRevealedAddend;
      const mark = ans != null ? `<span class="q-correct">${ans}</span>` : null;
      if (state.bondKnownAddend == null) return `${state.targetSum}=`;
      if (state.bondMissingSide === "right") {
        return `${state.targetSum}=${state.bondKnownAddend}+${mark ?? "?"}`;
      }
      return `${state.targetSum}=${(mark ?? "?")}+${state.bondKnownAddend}`;
    }

    // Semnătura unei întrebări: dacă se schimbă, înseamnă că a apărut o întrebare
    // NOUĂ (nu o re-randare a aceleiași — ex. timeout pe aceeași întrebare).
    function roundSignature(s) {
      if (!s) return null;
      const questionInstanceId = s.metadata?.questionInstanceId;
      if (questionInstanceId != null) return `question:${questionInstanceId}`;
      const opts = Array.isArray(s.options) ? s.options.map(String).join("|") : "";
      const prompt =
        s.promptHtml ??
        s.prompt ??
        (s.dividend != null ? `${s.dividend}:${s.divisor}` : "");
      return `${s.questionFormat || ""}#${prompt}#${opts}`;
    }

    function journalAttemptData(state, pickedIndex, meta, correct) {
      if (pickedIndex == null) return null;
      const questionKey = roundSignature(state);
      if (questionKey !== journalQuestionKey) {
        journalQuestionKey = questionKey;
        journalButtonPressCount = 0;
      }
      journalButtonPressCount += 1;

      const options = Array.isArray(state?.options) ? state.options : null;
      const correctIndex = Number.isInteger(state?.correctIndex) ? state.correctIndex : null;
      const responseMs = Number(meta?.responseMs);
      return {
        moment_afisare_iso: meta?.questionDisplayedAt ?? null,
        raspuns:
          options?.[pickedIndex] == null ? null : String(options[pickedIndex]),
        a_raspuns_corect: correct === true,
        al_catelea_turn_apasare_pe_buton: journalButtonPressCount,
        durata_raspuns_secunde:
          Number.isFinite(responseMs) ? Math.round(responseMs / 100) / 10 : null,
        pozitie_buton_apasat_pt_raspuns: pickedIndex + 1,
        valori_variante_de_raspuns:
          options == null ? null : options.map((value) => (value == null ? null : String(value))),
        valoare_raspuns_corect:
          correctIndex == null || options?.[correctIndex] == null
            ? null
            : String(options[correctIndex]),
      };
    }

    function renderRound(state) {
      state = normalizeRoundState(state);
      // Cronometrul măsoară: apariția întrebării → apăsarea răspunsului corect.
      // Resetăm doar când întrebarea e nouă; pe calea startRound, releaseRoundHold
      // suprascrie oricum (ca să nu numărăm „hold"-ul liftului).
      if (roundSignature(state) !== roundSignature(lastRoundState)) {
        startResponseTimer();
      }
      lastRoundState = state;
      dom.fallingMainEl?.classList.remove("has-singapore-bond");
      dom.arenaQuestionSlotEl?.classList.remove("has-singapore-bond");
      const fm = getQuestionSlotEl() || dom.fallingMainEl;
      if (state.questionFormat === "singapore-bond") {
        const historyHtml = (state.bondHistory || [])
          .map((line) => `<div class="singapore-history-line">${line}</div>`)
          .join("");
        dom.topNumberEl.innerHTML = `<div class="singapore-prompt">${
          historyHtml ? `<div class="singapore-history">${historyHtml}</div>` : ""
        }<div class="singapore-current">${singaporeBondLine(state)}</div></div>`;
        fm?.classList.add("has-singapore-bond");
        state.modScriereIntrebareNoua = MOD_SCRIERE_STERGERE_COMPLETA;
      } else {
        if (state.promptHtml !== undefined) {
          const modificatInLoc = aplicaElementeDivIntrebare(
            dom.topNumberEl,
            state.elementeDivIntrebare
          );
          if (modificatInLoc) {
            state.modScriereIntrebareNoua = MOD_SCRIERE_MODIFICARE_ELEMENTE;
          } else {
            dom.topNumberEl.innerHTML = state.promptHtml ?? "—";
            state.modScriereIntrebareNoua = MOD_SCRIERE_STERGERE_COMPLETA;
          }
        } else {
          const placeholder = placeholderRaspuns();
          const raw = String(state.prompt ?? "—");
          if (placeholder.are(raw)) {
            dom.topNumberEl.innerHTML = placeholder.marcheaza(raw);
          } else {
            dom.topNumberEl.textContent = raw;
          }
          state.modScriereIntrebareNoua = MOD_SCRIERE_STERGERE_COMPLETA;
        }
        fm?.classList.remove("has-singapore-bond");
      }
      fitNumberText(dom.topNumberEl);

      dom.optionBtns.forEach((btn, i) => {
        const val = state.options?.[i];
        btn.querySelector(".prime").textContent =
          val != null && String(val) !== "undefined" ? String(val) : "—";
        btn.classList.remove("selected", "picked-wrong");
      });
      dom.fallingPrimes.forEach((el, i) => {
        const val = state.options?.[i];
        el.textContent =
          val != null && String(val) !== "undefined" ? String(val) : "—";
        el.classList.remove("highlight", "picked-wrong");
      });

      dom.divisionHistoryEl.replaceChildren();
      (state.divisionHistory || []).forEach((text, i, arr) => {
        const line = document.createElement("div");
        line.className = "division-line";
        if (i === arr.length - 1) line.classList.add("division-line--last");
        line.textContent = text;
        dom.divisionHistoryEl.appendChild(line);
      });

      if (dom.successionListEl) {
        dom.successionListEl.replaceChildren();
        const skipSuccession =
          global.AsnwProfile?.isEffective?.("emptySuccessionList") === true;
        if (!skipSuccession) {
          (state.successionHistory || []).forEach(({ prompt, answer }) => {
            const item = document.createElement("div");
            item.className = "sl-item";
            const parts = String(prompt ?? "").split("?");
            if (parts.length === 2) {
              item.append(document.createTextNode(parts[0]));
              const span = document.createElement("span");
              span.className = "sl-answer";
              span.textContent = String(answer ?? "");
              item.appendChild(span);
              item.append(document.createTextNode(parts[1]));
            } else {
              item.textContent = `${prompt} ${answer}`;
            }
            dom.successionListEl.appendChild(item);
          });
        }
      }

      syncBoxHeight();
      if (state.hintMessage) dom.messageEl.textContent = state.hintMessage;
      return config.onRender?.(state);
    }

    function resetRisingLayout() {
      dom.rising.style.removeProperty("left");
      dom.rising.style.removeProperty("top");
      dom.rising.style.removeProperty("transform");
    }

    function hideRising() {
      dom.rising.classList.add("hidden");
      resetRisingLayout();
    }

    // Y = marginea de jos a ecranului telefonului (#divArena).
    // X = centrul numărului de pe buton (dacă riseFromButton) sau centrul arenei.
    function placeRisingAtStart(index) {
      const layerEl = dom.rising.parentElement;
      const shellEl = dom.divArena;
      if (!layerEl || !shellEl) return travelSpan();

      const layerRect = layerEl.getBoundingClientRect();
      const shellRect = shellEl.getBoundingClientRect();
      const riseH = dom.rising.getBoundingClientRect().height;

      if (riseFromButton) {
        const primeEl = dom.optionBtns[index]?.querySelector(".prime");
        if (primeEl) {
          const primeRect = primeEl.getBoundingClientRect();
          dom.rising.style.left = `${primeRect.left + primeRect.width / 2 - layerRect.left}px`;
          dom.rising.style.transform = "translateX(-50%)";
        }
      } else {
        dom.rising.style.removeProperty("left");
        dom.rising.style.removeProperty("transform");
      }

      return shellRect.bottom - layerRect.top - riseH;
    }

    function cancelRisingAnimation() {
      animating = false;
      hideRising();
      clearWrongMarks();
    }

    function terminaSerie(result) {
      if (result.gameComplete) {
        if (hasRenderableState(result)) renderRound(result);
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        dom.playPauseBtn.disabled = true;
        setInputEnabled(false);
        return;
      }

      // La avans de nivel, pauza vine din contractul quizului
      // (`laSchimbareDeNivel`), nu din constanta veche LEVEL_ADV_MS=1400.
      // Standardul cere 0: mesajul de felicitare NU intrerupe fluxul, deci
      // intrebarea din nivelul nou apare imediat si se poate raspunde la ea
      // cat timp mesajul e inca pe ecran (decis de user, 28.08.2026).
      const delay = result.levelAdvanced
        ? result.pauza_intre_serii_ms ?? schimbareDeNivel().pauzaInainteDeRundaUrmatoareMs
        : result.pauza_intre_serii_ms ?? PAUZA_INTRE_SERII_IMPLICITA_MS;
      setTimeout(() => {
        if (getQuiz().isCompleted()) return;
        if (result.holdFallDuringDelay) fallHeld = false;
        startRound(result.nextRound ?? getQuiz().beginRound(getQuiz().pickNextRound()));
      }, delay);
    }

    function hasRenderableState(result = {}) {
      return (
        result.prompt !== undefined ||
        result.promptHtml !== undefined ||
        result.questionFormat !== undefined ||
        result.bondHistory !== undefined ||
        result.targetSum !== undefined ||
        result.options !== undefined ||
        result.divisionHistory !== undefined ||
        result.hintMessage !== undefined ||
        result.dividend !== undefined ||
        result.divisor !== undefined
      );
    }

    function isAsnwLiftSimple() {
      return global.AsnwProfile?.isEffective?.("liftNoRiseTeleport") === true;
    }

    // În modurile „bară”/„mingie” întrebarea e fixă jos, iar moverul e gol; nu
    // are sens ca răspunsul să urce spre el → rezolvăm direct, ca la ASNW simplu.
    function isContentLiftMode() {
      return (global.LiftType?.getEffectiveLiftMode?.() ?? "content") === "content";
    }

    function isDirectAnswerMode() {
      return isAsnwLiftSimple() || !isContentLiftMode();
    }

    // Bannerul de nivel: textul si durata vin din contractul quizului
    // (`laSchimbareDeNivel`), nu din textul scris de mana in fiecare quiz.
    // Standardul (js/schimbare-de-nivel.js): un text unic pentru toata
    // aplicatia la nivel nou, altul la ultimul nivel — acela ramanand PERMANENT
    // pe ecran, pana la schimbarea quizului sau a nivelului din meniu.
    //
    // Bannerele care NU tin de o schimbare de nivel (ex. eticheta de nivel de
    // la "Bagare sub radical") raman cum sunt, cu textul dat de quiz.
    function afiseazaBanner(result) {
      if (result.gameComplete) {
        const contract = schimbareDeNivel();
        config.showBanner(contract.textUltimulNivel, { permanent: true });
        return;
      }
      if (result.levelAdvanced) {
        const contract = schimbareDeNivel();
        config.showBanner(contract.textNivelNou, { durataMs: contract.durataMesajMs });
        return;
      }
      if (result.banner) config.showBanner(result.banner);
    }

    function applyImmediateAnswerFeedback(result, wrongPick) {
      if (!wrongPick && result.flash) flash(result.flash);
      if (result.message !== undefined) dom.messageEl.textContent = result.message;
      // Cand pasul urmator are pauza, bannerul nu se arata acum — se arata la
      // capatul pauzei, odata cu runda purtata de `continua`.
      if (result.banner && !result.pasUrmator?.dupa) afiseazaBanner(result);
      dom.messageEl.classList.toggle("win", result.flash === "win");

      if (result.resetFall) setFallPosition(0);

      if (result.bounce) {
        clearWrongMarks();
        if (isAsnwLiftSimple()) {
          bouncing = false;
          dom.falling.classList.remove("bounce");
          setFallPosition(0);
        } else {
          bouncing = true;
          dom.falling.classList.add("bounce");
          syncBoxHeight();
          const bounceToTop = getQuiz().shouldBounceToTop?.() ?? false;
          let targetY;
          if (bounceToTop) {
            targetY = 0;
          } else {
            const normalBounceY = fallY - BOUNCE_UP * speedScale();
            const clearlyAboveHalfY = travelSpan() * BOUNCE_MIN_FRAC;
            targetY = Math.min(normalBounceY, clearlyAboveHalfY);
          }
          setFallPosition(Math.max(0, targetY));
          setTimeout(() => {
            bouncing = false;
            dom.falling.classList.remove("bounce");
          }, 380);
        }
      }
    }

    function aplicaPasulUrmator(pas) {
      const next = normalizeResult(pas.continua);
      if (next.resetFall) setFallPosition(0);

      if (next.serie_terminata) {
        if (next.banner) afiseazaBanner(next);
        config.onProgressUpdate?.();
        terminaSerie(next);
        return;
      }

      renderRound(next);
      if (!getQuiz().isCompleted()) setInputEnabled(true);
      config.onProgressUpdate?.();
    }

    function applyAnswerResultTail(result, pickedIndex, wrongPick, shouldRender, afterEngineReveal) {
      if (shouldRender && !wrongPick) renderRound(result);

      // Un `pasUrmator` prezent se aplica INTOTDEAUNA. Durata (`dupa`) sta in
      // interiorul lui si spune doar CAT dureaza pauza, nu DACA pasul se
      // aplica — vezi comentariul lung de la `respingeContractulVechi`.
      const pas = result.pasUrmator;
      if (pas) {
        setInputEnabled(false);
        // Dupa o revelare facuta de motor, pauza a fost deja consumata acolo;
        // a doua ar dubla-o.
        if (afterEngineReveal) {
          aplicaPasulUrmator(pas);
          return;
        }
        setTimeout(() => aplicaPasulUrmator(pas), durataPauzeiDeRevelare(result));
        return;
      }

      if (result.serie_terminata) {
        config.onProgressUpdate?.();
        terminaSerie(result);
        return;
      }

      if (wrongPick) {
        markWrongOption(pickedIndex);
        if (!result.gameComplete) setInputEnabled(true);
        config.onProgressUpdate?.();
        return;
      }

      if (!result.gameComplete) setInputEnabled(true);
      config.onProgressUpdate?.();
    }

    function applyAnswerResult(result, pickedIndex, meta = {}) {
      const shouldRender = hasRenderableState(result);
      const beforeState = lastRoundState;
      result = normalizeResult(result);
      const wrongPick = pickedIndex != null && result.outcome === "wrong-answer";
      const timedOut = meta.timedOut === true || result.outcome === "timeout";
      const starCorrect = !wrongPick && !timedOut && result.correct !== false;
      const chosenAnswer =
        pickedIndex != null
          ? dom.optionBtns[pickedIndex]?.querySelector(".prime")?.textContent
          : null;

      global.AsnwOnboarding?.notifyAnswer?.({
        correct: starCorrect,
        answered: pickedIndex != null && !timedOut,
      });

      if (!timedOut) {
        config.onAttemptLogged?.({
          beforeState,
          result,
          pickedIndex,
          meta,
          correct: starCorrect,
          timedOut: false,
          dateMecaniceJurnal: journalAttemptData(
            beforeState,
            pickedIndex,
            meta,
            starCorrect
          ),
        });
      }

      applyImmediateAnswerFeedback(result, wrongPick);

      const needsEngineReveal =
        revealAnswerOnContact &&
        !wrongPick &&
        pickedIndex != null &&
        beforeState &&
        stateHasQuestionMark(beforeState) &&
        !resultAlreadyRevealed(result, beforeState);

      if (needsEngineReveal) {
        // Intai calea "in loc" (pastreaza promptHtml-ul custom randat); daca
        // quizul nu are slotul dedicat, calea veche, neschimbata.
        if (revealAnswerInPlace(beforeState, chosenAnswer)) {
          lastRoundState = { ...beforeState, answerRevealed: true };
        } else {
          const revealState = buildRevealedState(beforeState, chosenAnswer);
          renderRound({
            ...revealState,
            options: beforeState.options,
            correctIndex: beforeState.correctIndex,
          });
        }
        setInputEnabled(false);
        setTimeout(() => {
          applyAnswerResultTail(result, pickedIndex, wrongPick, shouldRender, true);
        }, durataPauzeiDeRevelare(result));
        return;
      }

      applyAnswerResultTail(result, pickedIndex, wrongPick, shouldRender, false);
    }

    // Faza C din documente de referinta/PLAN-motor-comun-raspuns.md: orice quiz
    // trebuie sa raspunda EXCLUSIV prin Motor3Butoane (js/motor-3-butoane.js).
    // Fara semnatura lui pe rezultat, motorul refuza sa continue — eroare
    // explicita, imediata, nu avertisment si nu fallback tacut (razgandire-
    // ieftina.md, punctul 9). Asta face imposibil ca un quiz sa-si scrie
    // propria logica de corect/gresit, exact bug-ul care a pornit refactorizarea.
    function valideazaRaspunsMotor3Butoane(rezultat, index) {
      if (global.Motor3Butoane?.esteRezultatValid?.(rezultat)) return;
      throw new Error(
        `Motor 3 butoane: raspunsul la apasarea butonului ${index} nu poarta ` +
          `semnatura motorului comun (asteptat: motor3Butoane === "` +
          `${global.Motor3Butoane?.SEMNATURA ?? "?"}"` +
          `"). Orice quiz trebuie sa raspunda exclusiv prin Motor3Butoane — ` +
          `vezi documente de referinta/PLAN-motor-comun-raspuns.md.`
      );
    }

    // Faza E, sectiunea 12 din documente de referinta/PLAN-motor-comun-raspuns.md:
    // al doilea gard, la acelasi nivel cu Motor3Butoane — orice quiz trebuie
    // construit intern prin SubquizOrchestrator (js/subquiz/subquiz-orchestrator.js),
    // chiar daca are o singura bucata "baza". Fara semnatura lui (campul
    // "subquizEvent", pus de decorate() pe orice rezultat trecut prin
    // orchestrator), motorul refuza sa continue — eroare explicita, imediata,
    // nu avertisment si nu fallback tacut (razgandire-ieftina.md, punctul 9).
    // Asta face imposibil ca un quiz sa-si scrie propria rutare, separata de
    // orchestrator, exact riscul descris in plan (§12).
    function valideazaConstructiaPrinSubquizOrchestrator(rezultat, index) {
      if (rezultat?.subquizEvent) return;
      throw new Error(
        `SubquizOrchestrator: raspunsul la apasarea butonului ${index} nu poarta ` +
          `semnatura orchestratorului comun (campul "subquizEvent", pus de ` +
          `decorate() in js/subquiz/subquiz-orchestrator.js). Orice quiz trebuie ` +
          `construit intern prin SubquizOrchestrator, minim o bucata "baza" — ` +
          `vezi documente de referinta/PLAN-motor-comun-raspuns.md, sectiunea 12.`
      );
    }

    function resolveChoice(index) {
      hideRising();
      animating = false;
      const meta = attemptMeta();
      const rezultat = getQuiz().onAnswer(index, meta);
      valideazaRaspunsMotor3Butoane(rezultat, index);
      valideazaConstructiaPrinSubquizOrchestrator(rezultat, index);
      applyAnswerResult(rezultat, index, meta);
    }

    function handleBottomMiss() {
      if (locked || getQuiz().isCompleted()) return;
      // Liniile „picked-wrong" trebuie să rămână peste timeout dacă întrebarea
      // este aceeași după reset (la fel ca retry-ul de la celelalte quiz-uri).
      // Capturăm indicii ÎNAINTE ca `cancelRisingAnimation` să golească setul,
      // apoi îi reaplicăm doar dacă opțiunile afișate au rămas identice.
      const wrongBefore = [...wrongPicksThisStep];
      const optionsBefore = lastRoundState ? [...(lastRoundState.options || [])] : null;
      cancelRisingAnimation();
      const meta = attemptMeta({ timedOut: true });
      applyAnswerResult(getQuiz().onTimeout(meta), null, meta);
      const optionsAfter = lastRoundState ? lastRoundState.options || [] : [];
      const sameQuestion =
        optionsBefore != null &&
        optionsBefore.length === optionsAfter.length &&
        optionsBefore.every((value, i) => String(value) === String(optionsAfter[i]));
      if (sameQuestion && wrongBefore.length) {
        wrongBefore.forEach((i) => wrongPicksThisStep.add(i));
        syncWrongMarks();
      }
      setInputEnabled(true);
    }

    function animateRising(index) {
      animating = true;
      setInputEnabled(false);
      dom.optionBtns[index].classList.add("selected");
      dom.fallingPrimes[index]?.classList.add("highlight");
      dom.risingNumberEl.textContent =
        dom.optionBtns[index].querySelector(".prime").textContent;
      dom.rising.classList.remove("hidden");
      syncBoxHeight();

      let riseY = placeRisingAtStart(index);
      dom.rising.style.top = `${riseY}px`;
      let localFallY = fallY;
      const riseDistance = Math.max(0, riseY - (localFallY + boxH));
      const riseSpeed = riseDistance / RISE_TRAVEL_S;
      let lastStepTs = 0;

      const step = (ts) => {
        if (paused) {
          requestAnimationFrame(step);
          return;
        }
        if (!lastStepTs) lastStepTs = ts;
        const dt = Math.min((ts - lastStepTs) / 1000, 0.05);
        lastStepTs = ts;
        const speedFactor = getQuiz().getFallSpeedFactor?.() ?? 1.0;
        const scale = speedScale();
        localFallY += FALL_SPEED * speedFactor * scale * dt;
        riseY -= riseSpeed * dt;
        dom.falling.style.top = `${localFallY}px`;
        dom.rising.style.top = `${riseY}px`;

        if (riseY <= localFallY + boxH) {
          fallY = localFallY;
          dom.optionBtns[index].classList.remove("selected");
          dom.fallingPrimes[index]?.classList.remove("highlight");
          resolveChoice(index);
          return;
        }
        if (localFallY >= travelSpan()) {
          // Cutia a atins fundul în timpul ridicării (se întâmplă la viteze
          // mari, unde căderea întrece ridicarea). Oprim animația și eliberăm
          // blocajul de input ÎNAINTE de a procesa ratarea — altfel
          // handleBottomMiss iese devreme pe `locked` și `animating` rămâne
          // blocat pentru totdeauna, înghețând liftul jos.
          fallY = localFallY;
          cancelRisingAnimation();
          setInputEnabled(true);
          handleBottomMiss();
          setFallPosition(0);
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    function onPick(index) {
      if (locked || animating || paused || getQuiz().isCompleted()) return;
      if (isDirectAnswerMode()) {
        dom.optionBtns[index].classList.add("selected");
        dom.fallingPrimes[index]?.classList.add("highlight");
        resolveChoice(index);
        dom.optionBtns[index].classList.remove("selected");
        dom.fallingPrimes[index]?.classList.remove("highlight");
        return;
      }
      animateRising(index);
    }

    function releaseRoundHold() {
      fallHeld = false;
      if (!getQuiz().isCompleted()) setInputEnabled(true);
      startResponseTimer();
    }

    function startRound(state) {
      state = normalizeRoundState(state);
      global.AsnwOnboarding?.notifyNewQuestion?.();
      if (rafId == null) startFallLoop();
      cancelRisingAnimation();
      clearWrongMarks();
      setFallPosition(0);
      dom.falling.classList.remove("bounce");
      fallHeld = true;
      setInputEnabled(false);
      const ready = renderRound(state);
      dom.messageEl.classList.remove("win");
      dom.playPauseBtn.disabled = false;

      if (ready && typeof ready.then === "function") {
        ready.then(releaseRoundHold).catch(releaseRoundHold);
      } else {
        releaseRoundHold();
      }
    }

    function startFallLoop() {
      if (rafId) cancelAnimationFrame(rafId);
      let lastTs = 0;
      const tick = (ts) => {
        if (!lastTs) lastTs = ts;
        const dt = Math.min((ts - lastTs) / 1000, 0.05);
        lastTs = ts;
        if (
          !fallHeld &&
          !getQuiz().isCompleted() &&
          !paused &&
          !animating &&
          !locked &&
          !bouncing
        ) {
          syncBoxHeight();
          const speedFactor = getQuiz().getFallSpeedFactor?.() ?? 1.0;
          fallY += FALL_SPEED * speedFactor * speedScale() * dt;
          if (fallY >= travelSpan()) {
            handleBottomMiss();
            fallY = 0;
          }
          dom.falling.style.top = `${fallY}px`;
        }
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }

    dom.optionBtns.forEach((btn) => {
      btn.addEventListener("click", () => onPick(Number(btn.dataset.index)));
    });

    dom.playPauseBtn.addEventListener("click", () => {
      if (getQuiz().isCompleted()) return;
      paused = !paused;
      dom.playPauseBtn.textContent = paused ? "▶" : "⏸";
      dom.gameEl.classList.toggle("is-paused", paused);
      if (!locked) dom.optionBtns.forEach((b) => (b.disabled = paused));
    });

    document.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.code === "Space" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        dom.playPauseBtn.click();
        return;
      }
      if (["1", "2", "3"].includes(e.key)) onPick(Number(e.key) - 1);
    });

    buildLiftControlPanel();

    function syncAsnwSuccessionList() {
      if (lastRoundState) renderRound(lastRoundState);
      else dom.successionListEl?.replaceChildren();
    }

    return {
      startRound,
      startFallLoop,
      cancelRisingAnimation,
      applyResize,
      // Recalculează geometria moverului (înălțime/traseu) după ce stratul
      // „tip lift” a re-parentat conținutul, păstrând poziția relativă a
      // căderii și re-randând runda curentă. Nu repornește runda → seriile și
      // bounce-ul rămân intacte.
      relayoutLift: () => {
        applyResize();
        if (lastRoundState) renderRound(lastRoundState);
      },
      refreshArenaMetrics,
      syncAsnwSuccessionList,
      getLiftBgOpacity: () => liftBgOpacity,
      setLiftBgOpacity: (value) => {
        liftBgOpacity = Math.max(0, Math.min(1, Number(value)));
        applyLiftBgOpacity();
      },
      getSwapQuestionIllustration: () => swapQuestionIllustration,
      setSwapQuestionIllustration: (value) => {
        swapQuestionIllustration = Boolean(value);
        applyLayoutSwap();
      },
    };
  }

  global.FallingEngine = FallingEngine;
  global.FallingEngine.LIFT_BG_OPACITY_DEFAULT = LIFT_BG_OPACITY_DEFAULT;
})(window);
