(function () {
  "use strict";

  const dom = {
    gameEl: document.getElementById("game"),
    divArena: document.getElementById("divArena"),
    butoaneSusEl: document.querySelector(".butoane-sus"),
    stratInfoEl: document.getElementById("div-strat-info"),
    optionsEl: document.getElementById("options"),
    quizTitleEl: document.getElementById("quiz-title"),
    levelInfoEl: document.getElementById("level-info"),
    messageEl: document.getElementById("message"),
    playPauseBtn: document.getElementById("play-pause"),
    progressVisualEl: document.querySelector(".progress-visual"),
    streakTrackEl: document.getElementById("streak-track"),
    comboTrackEl: document.getElementById("combo-track"),
    levelBannerEl: document.getElementById("level-banner"),
    levelPickerEl: document.getElementById("level-picker"),
    quizPickerListEl: document.getElementById("quiz-picker-list"),
    arena: document.getElementById("arena"),
    illustrareArenaEl: document.getElementById("div-ilustrare-din-arena"),
    illustrareArenaBodyEl: document.querySelector(".arena-ilustrare-body"),
    illustrareLiftEl: document.getElementById("div-ilustrare-in-lift"),
    illustrareLiftBodyEl: document.querySelector(".lift-ilustrare-body"),
    arenaQuestionSlotEl: document.getElementById("arena-question-slot"),
    listaOperatiiEl: document.getElementById("div-lista-operatii"),
    liftControlPanelEl: null,
    aamControlPanelEl: null,
    onAamCpEnabledChange: null,
    flashEl: document.getElementById("flash"),
    falling: document.getElementById("falling"),
    fallingInner: document.querySelector(".falling-inner"),
    liftFixedHost: document.getElementById("lift-fixed-host"),
    fallingMainEl: document.getElementById("falling-main"),
    topNumberEl: document.getElementById("top-number"),
    successionListEl: document.getElementById("succession-list"),
    divisionHistoryEl: document.getElementById("division-history"),
    fallingPrimes: [...document.querySelectorAll(".falling-prime")],
    rising: document.getElementById("rising"),
    risingNumberEl: document.getElementById("rising-number"),
    optionBtns: [...document.querySelectorAll(".option")],
    info11_20El: document.getElementById("divInfo11_20"),
  };

  let quiz = null;
  let engine = null;
  let aamArena = null;
  let cpShell = null;
  let lastGreenCells = null;
  let lastRenderedLevel = null;

  dom.getSwapQuestionIllustration = () =>
    engine?.getSwapQuestionIllustration?.() ?? false;
  window.getLayoutSwapped = () =>
    engine?.getSwapQuestionIllustration?.() ?? false;

  function showBanner(text) {
    if (!text) return;
    dom.levelBannerEl.textContent = text;
    dom.levelBannerEl.classList.remove("hidden");
    requestAnimationFrame(() => dom.levelBannerEl.classList.add("show"));
    setTimeout(() => {
      dom.levelBannerEl.classList.remove("show");
      setTimeout(() => dom.levelBannerEl.classList.add("hidden"), 280);
    }, 1600);
  }

  function initGreenTrack(green) {
    dom.streakTrackEl.replaceChildren();
    for (let i = 0; i < green.cells; i++) {
      const cell = document.createElement("div");
      const meta = ProgressDisplay.cellMeta(green, i);
      cell.className = "streak-cell";
      cell.setAttribute("aria-label", meta.aria);
      if (meta.title) cell.title = meta.title;
      dom.streakTrackEl.appendChild(cell);
    }
    lastGreenCells = green.cells;
    if (green.title) dom.streakTrackEl.title = green.title;
    else dom.streakTrackEl.removeAttribute("title");
  }

  // Recompensa „La schimbare nivel” se declanșează când nivelul efectiv crește.
  // Resetăm `lastRenderedLevel` la schimbările manuale (picker/quiz) ca să nu
  // pornească recompensa fără să fie un progres real.
  function maybePlayLevelReward(level, progressHidden) {
    if (level == null) return;
    if (
      lastRenderedLevel != null &&
      level > lastRenderedLevel &&
      !progressHidden
    ) {
      const reward = window.LevelChangeReward;
      if (reward?.isAnyEnabled?.()) reward.play({ fallingEl: dom.falling });
    }
    lastRenderedLevel = level;
  }

  function hideInfo11_20() {
    if (!dom.info11_20El) return;
    dom.info11_20El.hidden = true;
    dom.info11_20El.classList.remove("is-intensiv");
  }

  function renderInfo11_20() {
    const el = dom.info11_20El;
    if (!el) return;
    if (typeof quiz?.getInfo11_20 !== "function") {
      hideInfo11_20();
      return;
    }
    const info = quiz.getInfo11_20();
    if (!info?.visible) {
      hideInfo11_20();
      return;
    }
    el.hidden = false;
    el.classList.toggle("is-intensiv", info.mode === "intensiv");
    el.querySelector(".info11-mode").textContent = `Mod: ${info.mode}`;
    el.querySelector(".info11-wrong").textContent = `Facts greșite: ${info.wrongFactsText}`;
    const intensivEl = el.querySelector(".info11-intensiv");
    if (intensivEl) intensivEl.textContent = `Facts lucrate intensiv: ${info.intensivText ?? "—"}`;
    const countEl = el.querySelector(".info11-count");
    if (countEl && info.answeredText != null) countEl.textContent = `Întrebări: ${info.answeredText}`;
    const sessionsEl = el.querySelector(".info11-sessions");
    if (sessionsEl && info.intensivSessionsText != null) {
      sessionsEl.textContent = `Sesiuni intensiv: ${info.intensivSessionsText}`;
    }

    const timesEl = el.querySelector(".info11-times");
    if (timesEl) {
      timesEl.replaceChildren();
      const head = document.createElement("p");
      head.className = "info11-times-head";
      head.textContent = "Timp ultim corect:";
      timesEl.appendChild(head);
      (info.facts || []).forEach((f) => {
        const row = document.createElement("p");
        row.className = "info11-time-row";
        row.append(`${f.label} : `);
        const val = document.createElement("span");
        val.className = "info11-time-val";
        if (f.fast) val.classList.add("fast");
        val.textContent = f.timeText;
        row.appendChild(val);
        timesEl.appendChild(row);
      });
    }
  }

  function renderProgress() {
    if (!quiz) return;
    const display = ProgressDisplay.resolve(quiz);
    dom.levelInfoEl.textContent = quiz.getLevelLabel();
    const currentLevel =
      typeof quiz.getLevel === "function" ? quiz.getLevel() : null;
    const previousRenderedLevel = lastRenderedLevel;

    const streakCells = dom.streakTrackEl.querySelectorAll(".streak-cell");
    if (streakCells.length !== display.green.cells || lastGreenCells !== display.green.cells) {
      initGreenTrack(display.green);
    }

    dom.streakTrackEl.querySelectorAll(".streak-cell").forEach((cell, i) => {
      cell.classList.toggle("filled", i < display.green.filled);
    });

    const progressHidden = display.green.hidden === true;
    dom.progressVisualEl?.classList.toggle("hidden", progressHidden);

    const redHidden = display.red.mode === "none";
    dom.progressVisualEl?.classList.toggle("red-hidden", redHidden && !progressHidden);

    // Cerculețe roșii SUB stele, pe aceleași coloane. Arătăm un cerc doar pentru
    // greșelile încă NEREZOLVATE (resolved < needed); când recuperezi un combo,
    // cercul lui dispare. Sunt ancorate la DREAPTA: prima greșeală → sub steaua
    // cea mai din dreapta; următoarea sub vecina din stânga ei. Construim un slot
    // per stea ca să rămână aliniate pe coloane; doar cele mai din dreapta `k`
    // primesc cerc.
    dom.comboTrackEl.replaceChildren();
    if (!progressHidden && !redHidden) {
      const cells = display.green.cells || 0;
      const pending = (display.red.items || []).filter(
        (it) => (it.resolved ?? 0) < (it.needed ?? 1)
      );
      const k = Math.min(cells, pending.length);
      if (k > 0) {
        for (let i = 0; i < cells; i++) {
          const slot = document.createElement("div");
          slot.className = "combo-cell";
          const fromRight = cells - 1 - i;
          if (fromRight < k) {
            const item = pending[fromRight];
            slot.classList.add("has-mistake");
            if (item.title) {
              slot.title = item.title;
              slot.setAttribute("aria-label", item.title);
            }
          }
          dom.comboTrackEl.appendChild(slot);
        }
      }
    }

    maybePlayLevelReward(currentLevel, progressHidden);
    if (
      previousRenderedLevel != null &&
      currentLevel != null &&
      currentLevel !== previousRenderedLevel
    ) {
      renderPreEquationNavigationPanel();
    }

    dom.levelPickerEl.querySelectorAll(".level-btn").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.level) === quiz.getLevel());
    });

    renderInfo11_20();
    renderSubquizStartControl();
  }


  function createLevelButton(lv) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "level-btn";
    btn.dataset.level = String(lv);
    btn.textContent = String(lv);
    const { min, max } = GameUtils.levelRange(lv);
    btn.title = quiz.getLevelButtonTitle?.(lv) ?? `Nivel ${lv}: ${min}–${max}`;
    btn.addEventListener("click", () => {
      const levelMessage = quiz.switchLevel(lv);
      if (levelMessage) dom.messageEl.textContent = levelMessage;
      dom.playPauseBtn.disabled = false;
      engine.cancelRisingAnimation();
      lastGreenCells = null;
      lastRenderedLevel = typeof quiz.getLevel === "function" ? quiz.getLevel() : null;
      engine.startRound(quiz.beginRound(quiz.pickNextRound()));
      renderProgress();
      renderPreEquationNavigationPanel();
    });
    return btn;
  }

  function isMobileLayout() {
    return (
      dom.gameEl.classList.contains("layout-mobile") ||
      window.matchMedia("(max-width: 768px)").matches ||
      window.matchMedia("(hover: none) and (pointer: coarse)").matches
    );
  }

  function syncLayoutMode() {
    const mobile =
      window.matchMedia("(max-width: 768px)").matches ||
      window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    dom.gameEl.classList.toggle("layout-mobile", mobile);
    syncMobileChromeMetrics();
  }

  let layoutStage = null;

  // Măsoară înălțimea zonei de info de sus și a barelor de răspuns ca să nu se
  // suprapună sertarul / butonul ✕ peste chrome sau butoanele 1/2/3.
  function syncMobileChromeMetrics() {
    const root = document.documentElement;
    if (dom.butoaneSusEl) {
      const bottom = Math.ceil(dom.butoaneSusEl.getBoundingClientRect().bottom);
      const h = Math.ceil(dom.butoaneSusEl.getBoundingClientRect().height);
      root.style.setProperty("--hud-h", `${bottom}px`);
      root.style.setProperty("--butoane-sus-h", `${h}px`);
    }
    if (dom.optionsEl) {
      const h = Math.ceil(dom.optionsEl.getBoundingClientRect().height);
      root.style.setProperty("--options-h", `${h}px`);
    }
    // NU rescalăm scena aici: cutia 1:2 e blocată o singură dată (la pornire /
    // rotire). Doar variabilele pentru overlay-uri (drawer/CP) se actualizează.
  }

  function scheduleMobileChromeMetrics() {
    requestAnimationFrame(syncMobileChromeMetrics);
  }

  function buildLevelPicker() {
    dom.levelPickerEl.replaceChildren();
    const maxLevel = quiz.getMaxLevel();
    dom.levelPickerEl.style.display = "flex";
    dom.levelPickerEl.style.flexWrap = "wrap";
    dom.levelPickerEl.style.justifyContent = "center";
    dom.levelPickerEl.style.gridAutoFlow = "";
    dom.levelPickerEl.style.gridTemplateRows = "";
    dom.levelPickerEl.style.gridTemplateColumns = "";

    for (let lv = 1; lv <= maxLevel; lv++) {
      dom.levelPickerEl.appendChild(createLevelButton(lv));
    }
  }

  function buildQuizPicker() {
    dom.quizPickerListEl.replaceChildren();
    QuizRegistry.list().forEach((meta) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-picker-item";
      btn.textContent = meta.title;
      btn.title = meta.description || "";
      btn.classList.toggle("active", meta.id === QuizRegistry.getActiveId());
      btn.addEventListener("click", () => switchQuiz(meta.id));
      dom.quizPickerListEl.appendChild(btn);
    });
  }

  // ── Sertar mobil (Pasul 2a) ────────────────────────────────────────────
  // Pe ecrane mici, quiz-urile/nivelurile stau într-un drawer deschis de ≡.
  // Pe desktop butonul ≡ e ascuns prin CSS, deci codul rămâne inert acolo.
  const menuToggleEl = document.getElementById("menu-toggle");
  const drawerBackdropEl = document.getElementById("drawer-backdrop");
  const drawerCloseEl = document.getElementById("drawer-close");
  const divMeniuEl = document.getElementById("divMeniu");

  function setDrawer(open) {
    dom.gameEl.classList.toggle("drawer-open", open);
    if (menuToggleEl) menuToggleEl.setAttribute("aria-expanded", open ? "true" : "false");
    if (drawerBackdropEl) drawerBackdropEl.hidden = !open;
    if (drawerCloseEl) drawerCloseEl.hidden = !open;
    if (open) scheduleMobileChromeMetrics();
  }

  menuToggleEl?.addEventListener("click", () => {
    syncLayoutMode();
    if (isMobileLayout()) {
      buildLevelPicker();
      renderProgress();
    }
    const willOpenDrawer = !dom.gameEl.classList.contains("drawer-open");
    const cpOpen = isMobileLayout() && cpShell?.isOpen();
    if (cpOpen) cpShell.setOpen(false);
    if (cpOpen && willOpenDrawer) {
      requestAnimationFrame(() => setDrawer(true));
      return;
    }
    setDrawer(!dom.gameEl.classList.contains("drawer-open"));
  });
  drawerBackdropEl?.addEventListener("click", () => setDrawer(false));
  drawerCloseEl?.addEventListener("click", () => setDrawer(false));

  // Buton [CP]: overlay pe mobil; pe desktop panoul e andocat în dreapta scenei.
  const cpToggleEl = document.getElementById("cp-toggle");
  cpToggleEl?.addEventListener("click", () => {
    if (!cpShell) return;
    const drawerOpen = isMobileLayout() && dom.gameEl.classList.contains("drawer-open");
    const willOpen = !cpShell.isOpen();
    if (drawerOpen) setDrawer(false);
    if (drawerOpen && willOpen) {
      requestAnimationFrame(() => cpShell.setOpen(true));
      return;
    }
    cpShell.setOpen(!cpShell.isOpen());
  });

  // După ce alegi un quiz sau un nivel, închidem sertarul ca să se vadă arena.
  divMeniuEl?.addEventListener("click", (e) => {
    if (e.target.closest(".quiz-picker-item, .level-btn")) setDrawer(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (dom.gameEl.classList.contains("drawer-open")) {
      setDrawer(false);
      return;
    }
    if (cpShell?.isOpen() && isMobileLayout()) {
      cpShell.setOpen(false);
    }
  });

  window.addEventListener("resize", scheduleMobileChromeMetrics);
  window.visualViewport?.addEventListener("resize", scheduleMobileChromeMetrics);

  if (window.ResizeObserver) {
    const chromeRo = new ResizeObserver(scheduleMobileChromeMetrics);
    if (dom.butoaneSusEl) chromeRo.observe(dom.butoaneSusEl);
    if (dom.stratInfoEl) chromeRo.observe(dom.stratInfoEl);
    if (dom.optionsEl) chromeRo.observe(dom.optionsEl);
  }

  function applyAsnwSuccessionList() {
    engine?.syncAsnwSuccessionList?.();
  }

  function applyAsnwArenaIllustration() {
    aamArena?.syncAsnwFromProfile?.();
  }

  function applyQuizTitleDisplay() {
    const id = QuizRegistry.getActiveId();
    if (!id) return;
    const meta = QuizRegistry.get(id);
    if (!meta) return;
    dom.quizTitleEl.textContent =
      window.AsnwProfile?.resolveQuizTitle?.(id, meta.title) ?? meta.title;
  }

  function switchQuiz(id) {
    if (id === QuizRegistry.getActiveId() && quiz && !quiz.isCompleted()) return;
    QuizRegistry.setActive(id);
    const meta = QuizRegistry.get(id);
    applyQuizTitleDisplay();
    quiz = QuizRegistry.createActive();
    applyRequestedQuizConfig();
    cpShell?.refreshEnabledStates?.();
    renderEquationTonomatPanel();
    renderPreEquationNavigationPanel();
    aamArena?.reset();
    buildQuizPicker();
    buildLevelPicker();
    lastGreenCells = null;
    lastRenderedLevel = typeof quiz.getLevel === "function" ? quiz.getLevel() : null;
    dom.playPauseBtn.disabled = false;
    engine?.startRound(quiz.beginRound(quiz.pickNextRound()));
    renderProgress();
  }

  function restartActiveRound() {
    if (!quiz) return;
    dom.playPauseBtn.disabled = false;
    engine?.cancelRisingAnimation?.();
    lastGreenCells = null;
    lastRenderedLevel = typeof quiz.getLevel === "function" ? quiz.getLevel() : null;
    buildLevelPicker();
    engine?.startRound(quiz.beginRound(quiz.pickNextRound()));
    renderProgress();
  }

  function renderEquationTonomatPanel() {
    const mount = cpShell?.getMountEl("equationTonomat");
    if (!mount) return;
    mount.replaceChildren();
    if (typeof quiz?.appendTonomatControlPanel !== "function") return;
    quiz.appendTonomatControlPanel(mount, {
      onChange: restartActiveRound,
    });
  }

  function renderPreEquationNavigationPanel() {
    const mount = cpShell?.getMountEl("preEquationNav");
    if (!mount) return;
    mount.replaceChildren();
    if (typeof quiz?.appendPreEquationNavigationControlPanel !== "function") return;
    quiz.appendPreEquationNavigationControlPanel(mount, {
      onChange: () => {
        restartActiveRound();
        renderPreEquationNavigationPanel();
      },
    });
  }

  function applyRequestedQuizConfig() {
    const requestedQuizId = window.StartupQuiz?.getRequestedQuizId?.();
    if (requestedQuizId && requestedQuizId !== QuizRegistry.getActiveId()) return false;
    const cfg = window.StartupQuiz?.getRequestedQuizConfig?.();
    if (!cfg || typeof quiz?.applySharedConfig !== "function") return false;
    return quiz.applySharedConfig(cfg) === true;
  }

  function resolveStartupQuizId() {
    return window.StartupQuiz?.resolveStartupQuizId?.() ?? null;
  }

  const startupQuizId = resolveStartupQuizId();
  if (startupQuizId) QuizRegistry.setActive(startupQuizId);
  quiz = QuizRegistry.createActive();
  applyRequestedQuizConfig();

  let aamCpEnabled = false;
  CpRegistry.register({
    id: "subquiz",
    title: "CP — Subquiz",
    isEnabled: () => typeof quiz?.getSubquizStartOptions === "function",
  });
  CpRegistry.register({
    id: "equationTonomat",
    title: "CP - Ecuatii",
    isEnabled: () => typeof quiz?.appendTonomatControlPanel === "function",
  });
  CpRegistry.register({
    id: "preEquationNav",
    title: "CP - Pre-ecuatii",
    isEnabled: () =>
      typeof quiz?.appendPreEquationNavigationControlPanel === "function",
  });
  CpRegistry.register({
    id: "liftType",
    title: "CP — Tip lift",
    isEnabled: () => true,
  });
  CpRegistry.register({
    id: "lift",
    title: "CP — Lift",
    isEnabled: () => true,
  });
  CpRegistry.register({
    id: "aam",
    title: "CP — Acolada Axa Mere",
    isEnabled: () => aamCpEnabled,
  });
  CpRegistry.register({
    id: "debug",
    title: "CP — Depanare layout",
    isEnabled: () => true,
  });

  const divCpEl = document.getElementById("divCp");
  cpShell = CpShell.create({
    gameEl: dom.gameEl,
    shellEl: divCpEl,
    isMobile: isMobileLayout,
    onOpenChange: scheduleMobileChromeMetrics,
  });
  dom.liftControlPanelEl = cpShell.getMountEl("lift");
  dom.aamControlPanelEl = cpShell.getMountEl("aam");
  dom.onAamCpEnabledChange = (on) => {
    aamCpEnabled = on;
    cpShell.setPanelEnabled("aam", on);
  };
  renderEquationTonomatPanel();
  renderPreEquationNavigationPanel();

  // Stratul „tip lift” = doar prezentare: (a) clasa de mod pe #game și (b) unde
  // trăiește conținutul (`.falling-inner`). NU recreăm noduri — doar
  // re-parentăm același `.falling-inner` între liftul mobil și panoul fix, deci
  // toate referințele motorului rămân valide. Toată mișcarea rămâne în motor și
  // e agnostică la tip. Idempotentă: se poate apela oricând, în orice ordine.
  function applyLiftLayout() {
    const mode = window.LiftType?.getEffectiveLiftMode?.() ?? "content";
    dom.gameEl.classList.remove(
      "lift-mode-content",
      "lift-mode-bar",
      "lift-mode-ball"
    );
    dom.gameEl.classList.add(`lift-mode-${mode}`);

    const inner = dom.fallingInner;
    const host = dom.liftFixedHost;
    if (inner && host && dom.falling) {
      if (mode === "content") {
        if (inner.parentElement !== dom.falling) dom.falling.appendChild(inner);
        host.hidden = true;
        host.setAttribute("aria-hidden", "true");
      } else {
        if (inner.parentElement !== host) host.appendChild(inner);
        host.hidden = false;
        host.setAttribute("aria-hidden", "false");
      }
    }

    engine?.relayoutLift?.();
  }

  let subquizStartControlEl = null;

  (function buildSubquizPanel() {
    const mount = cpShell.getMountEl("subquiz");
    if (!mount) return;
    mount.replaceChildren();
    subquizStartControlEl = document.createElement("div");
    subquizStartControlEl.className = "control-panel-lift-field subquiz-start-control";
    subquizStartControlEl.hidden = true;
    mount.appendChild(subquizStartControlEl);
    renderSubquizStartControl();
  })();

  let liftTypeControl = null;
  (function buildLiftTypePanel() {
    const mount = cpShell.getMountEl("liftType");
    if (!mount) return;
    mount.replaceChildren();
    liftTypeControl = window.LiftType?.appendLiftTypeControl(mount, {
      onChange: () => applyLiftLayout(),
    });
  })();

  applyLiftLayout();

  // CP — Depanare layout: profil ASNW + border debug.
  const DEBUG_BORDERS_KEY = "debugInfoBorders";
  let debugInfoBorders =
    window.LayoutConfig?.get(DEBUG_BORDERS_KEY, false) === true;
  let debugBordersInput = null;

  function applyDebugInfoBorders() {
    const asnwOn = window.AsnwProfile?.isMasterOn() === true;
    const show = debugInfoBorders && !asnwOn;
    dom.gameEl.classList.toggle("debug-info-borders", show);
    if (debugBordersInput) {
      debugBordersInput.disabled = asnwOn;
      debugBordersInput.checked = asnwOn ? false : debugInfoBorders;
    }
  }

  function renderSubquizStartControl() {
    if (!subquizStartControlEl) return;
    const getOptions = quiz?.getSubquizStartOptions;
    const setOption = quiz?.setSubquizStartOption;
    if (typeof getOptions !== "function" || typeof setOption !== "function") {
      subquizStartControlEl.hidden = true;
      subquizStartControlEl.replaceChildren();
      return;
    }

    const options = getOptions.call(quiz) || [];
    if (!options.length) {
      subquizStartControlEl.hidden = true;
      subquizStartControlEl.replaceChildren();
      return;
    }

    subquizStartControlEl.hidden = false;
    subquizStartControlEl.replaceChildren();

    const label = document.createElement("span");
    label.textContent = "Testeaza doar subquizul:";
    subquizStartControlEl.appendChild(label);

    const active = quiz.getSubquizStartOption?.();
    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "control-panel-asnw-reset";
      btn.textContent = opt.label;
      btn.disabled = opt.disabled === true;
      btn.classList.toggle("active", opt.id === active);
      btn.addEventListener("click", () => {
        if (opt.disabled) return;
        const changed = quiz.setSubquizStartOption(opt.id);
        if (!changed) return;
        dom.playPauseBtn.disabled = false;
        engine?.cancelRisingAnimation?.();
        lastGreenCells = null;
        lastRenderedLevel = typeof quiz.getLevel === "function" ? quiz.getLevel() : null;
        engine?.startRound(quiz.beginRound(quiz.pickNextRound()));
        renderProgress();
      });
      subquizStartControlEl.appendChild(btn);
    });
  }

  applyDebugInfoBorders();
  (function buildDebugPanel() {
    const mount = cpShell.getMountEl("debug");
    if (!mount) return;
    mount.replaceChildren();

    window.AsnwProfile?.buildAsnwSection(mount, {
      gameEl: dom.gameEl,
      onChange: () => {
        applyDebugInfoBorders();
        applyQuizTitleDisplay();
        applyAsnwArenaIllustration();
        applyAsnwSuccessionList();
        renderProgress();
        liftTypeControl?.syncUi?.();
        applyLiftLayout();
        window.AsnwOnboarding?.sync?.();
      },
    });

    window.StartupQuiz?.appendStartupQuizControl(mount, {
      onChange: (id) => {
        if (engine) switchQuiz(id);
      },
    });

    window.LevelChangeReward?.appendLevelChangeControl(mount);

    window.AsnwProfile?.appendCanonicalFlagRow(mount, "handOverButtons");
    window.AsnwProfile?.appendCanonicalFlagRow(mount, "simulateTap");
    window.AsnwProfile?.appendCanonicalFlagRow(mount, "tapRippleOnQuestion");
    window.AsnwProfile?.appendCanonicalFlagRow(mount, "numbersFlowToQ");

    (function buildNumbersFlowSlider() {
      const row = document.createElement("div");
      row.className = "control-panel-lift-field";
      const label = document.createElement("label");
      label.textContent = "cate numere de la buton la ?";
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "1";
      slider.max = "36";
      slider.step = "1";
      slider.value = String(
        window.LayoutConfig?.get("asnwNumbersFlowCount", 6) ?? 6
      );
      const out = document.createElement("span");
      out.className = "control-panel-lift-slider-out";
      out.textContent = slider.value;
      slider.addEventListener("input", () => {
        out.textContent = slider.value;
        window.LayoutConfig?.set("asnwNumbersFlowCount", Number(slider.value));
        window.AsnwOnboarding?.sync?.();
      });
      row.append(label, slider, out);
      mount.appendChild(row);
    })();

    (function buildOnboardingDebugRow() {
      const row = document.createElement("div");
      row.className = "control-panel-lift-field control-panel-asnw-onb-debug";

      const status = document.createElement("span");
      status.className = "control-panel-asnw-onb-status";
      window.AsnwOnboarding?.setDebugStatusEl?.(status);

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "control-panel-asnw-reset";
      resetBtn.textContent = "reset onboarding (zi 1, full)";
      resetBtn.addEventListener("click", () => {
        window.AsnwOnboarding?.resetProgress?.();
      });

      const nextDayBtn = document.createElement("button");
      nextDayBtn.type = "button";
      nextDayBtn.className = "control-panel-asnw-reset";
      nextDayBtn.textContent = "ziua urmatoare (test)";
      nextDayBtn.addEventListener("click", () => {
        window.AsnwOnboarding?.debugAdvanceDay?.();
      });

      row.append(status, resetBtn, nextDayBtn);
      mount.appendChild(row);
    })();

    window.AsnwProfile?.appendCanonicalFlagRow(mount, "onboardingPersist");

    window.AsnwProfile?.appendCanonicalFlagRow(mount, "hideDivLabels");
    window.AsnwProfile?.appendCanonicalFlagRow(mount, "hideLevelInfo");
    window.AsnwProfile?.appendCanonicalFlagRow(mount, "hideHintMessage");
    window.AsnwProfile?.appendCanonicalFlagRow(mount, "hideProgressVisual");
    window.AsnwProfile?.appendCanonicalFlagRow(mount, "simplifiedQuizTitle");
    window.AsnwProfile?.appendCanonicalFlagRow(mount, "emptyArenaIllustration");
    window.AsnwProfile?.appendCanonicalFlagRow(mount, "emptySuccessionList");
    window.AsnwProfile?.appendCanonicalFlagRow(mount, "liftNoRiseTeleport");
    window.AsnwProfile?.appendCanonicalFlagRow(mount, "liftFixedQuestionBar");

    const row = document.createElement("label");
    row.className = "control-panel-lift-row";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = debugInfoBorders;
    debugBordersInput = input;
    input.addEventListener("change", () => {
      debugInfoBorders = input.checked;
      window.LayoutConfig?.set(DEBUG_BORDERS_KEY, debugInfoBorders);
      applyDebugInfoBorders();
    });
    const span = document.createElement("span");
    span.textContent = "Border verde subțire pe fiecare componentă din div-info";
    row.append(input, span);
    mount.appendChild(row);
    applyDebugInfoBorders();
  })();

  aamArena = AamArena.create(dom);

  // Scena (arena) + controlul de raport. La orice redimensionare/raport nou,
  // repoziționăm liftul (din fracție). NU redesenăm ilustrația aici: SVG-ul se
  // scalează singur prin CSS (width:100%), iar un relayout în timpul unei runde
  // ar anula promisiunea care ține liftul sus la quiz-urile cu animație AAM
  // (ex. „T+ EFF”), lăsând liftul blocat. Redesenarea precisă la resize o
  // tratăm separat, hold-safe, într-un pas ulterior.
  const stage = window.LayoutStage.create(dom, {
    onChange: () => {
      engine?.applyResize?.();
    },
  });
  layoutStage = stage;

  engine = new FallingEngine({
    dom,
    getQuiz: () => quiz,
    showBanner,
    onProgressUpdate: renderProgress,
    onRender: (state) => aamArena.prepareRound(quiz, state),
    onLiftPanelBuilt: (panelEl) => stage.mountRatioControl(panelEl),
    onLayoutSwapChange: () => {
      const next = quiz?.advanceIfSwapIncompatible?.();
      if (next) {
        aamArena.relayout();
        engine.startRound(next);
        return true;
      }
      aamArena.relayout();
      return false;
    },
  });

  window.AsnwOnboarding?.init(dom);

  // ── Tabel desktop cu 3 coloane (Pasul 3c) ──────────────────────────────
  // Mobilul rămâne baza (nava-mamă, neatins). Tot ce se vede pe telefon e în
  // divArena; divMeniu și divCp sunt overlay-uri pe mobil. Pe desktop construim
  // un <table> simplu cu un rând și 3 celule de 360px și MUTĂM aceleași 3
  // div-uri în celule: divArena (col 1), divMeniu (col 2), divCp (col 3).
  // La revenirea pe mobil le punem înapoi ca frați în .game.
  const divArenaEl = document.getElementById("divArena");
  const desktopGridMq = window.matchMedia("(min-width: 769px)");
  let desktopGridTable = null;

  function buildDesktopGridTable() {
    const table = document.createElement("table");
    table.id = "desktop-grid";
    const tbody = document.createElement("tbody");
    const row = document.createElement("tr");
    const c1 = document.createElement("td");
    const c2 = document.createElement("td");
    const c3 = document.createElement("td");
    c1.className = "dg-cell dg-arena";
    c2.className = "dg-cell dg-menu";
    c3.className = "dg-cell dg-cp";
    row.append(c1, c2, c3);
    tbody.append(row);
    table.append(tbody);
    table.cells3 = { c1, c2, c3 };
    return table;
  }

  function applyDesktopGrid() {
    const desktop = desktopGridMq.matches;
    if (desktop) {
      if (!desktopGridTable) desktopGridTable = buildDesktopGridTable();
      if (!desktopGridTable.isConnected) {
        dom.gameEl.insertBefore(desktopGridTable, dom.gameEl.firstChild);
      }
      const { c1, c2, c3 } = desktopGridTable.cells3;
      c1.append(divArenaEl);
      c2.append(divMeniuEl);
      c3.append(divCpEl);
      dom.gameEl.classList.add("dg-on");
      cpShell?.setOpen(true);
    } else {
      dom.gameEl.classList.remove("dg-on");
      // Înapoi ca frați în .game: divArena primul, apoi overlay-urile.
      dom.gameEl.insertBefore(divArenaEl, dom.gameEl.firstChild);
      dom.gameEl.append(divMeniuEl, divCpEl);
      if (desktopGridTable?.isConnected) desktopGridTable.remove();
      cpShell?.applyLayoutMode();
    }
    if (quiz) buildLevelPicker();
    scheduleMobileChromeMetrics();
    // Părintele shell-ului s-a schimbat (celulă desktop ↔ #game mobil) →
    // remăsurăm cutia 1:2 după ce se așază layout-ul.
    requestAnimationFrame(() => layoutStage?.remeasure?.());
  }

  applyQuizTitleDisplay();
  syncLayoutMode();
  buildQuizPicker();
  buildLevelPicker();
  applyLiftLayout();
  engine.startRound(quiz.beginRound(quiz.pickNextRound()));
  renderProgress();
  engine.startFallLoop();
  applyDesktopGrid();

  window.matchMedia("(max-width: 768px)").addEventListener("change", () => {
    syncLayoutMode();
    cpShell?.applyLayoutMode();
    if (quiz) {
      buildLevelPicker();
      renderProgress();
    }
  });

  desktopGridMq.addEventListener("change", applyDesktopGrid);
})();
