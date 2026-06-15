(function () {
  "use strict";

  const dom = {
    gameEl: document.getElementById("game"),
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
    aamControlPanelEl: document.getElementById("control-panel-aam"),
    liftControlPanelEl: document.getElementById("control-panel-lift"),
    flashEl: document.getElementById("flash"),
    falling: document.getElementById("falling"),
    fallingMainEl: document.getElementById("falling-main"),
    topNumberEl: document.getElementById("top-number"),
    successionListEl: document.getElementById("succession-list"),
    divisionHistoryEl: document.getElementById("division-history"),
    fallingPrimes: [...document.querySelectorAll(".falling-prime")],
    rising: document.getElementById("rising"),
    risingNumberEl: document.getElementById("rising-number"),
    optionBtns: [...document.querySelectorAll(".option")],
  };

  let quiz = null;
  let engine = null;
  let aamArena = null;
  let lastGreenCells = null;

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
      cell.className = "progress-cell streak-cell";
      cell.setAttribute("aria-label", meta.aria);
      if (meta.title) cell.title = meta.title;
      dom.streakTrackEl.appendChild(cell);
    }
    lastGreenCells = green.cells;
    if (green.title) dom.streakTrackEl.title = green.title;
    else dom.streakTrackEl.removeAttribute("title");
  }

  function comboProgressClass(resolved, needed) {
    if (resolved >= needed) return "filled";
    if (resolved <= 0 || needed <= 1) return "";
    if (needed <= 2) return "partial-1";

    const ratio = resolved / needed;
    return ratio >= 0.67 ? "partial-2" : "partial-1";
  }

  function renderProgress() {
    if (!quiz) return;
    const display = ProgressDisplay.resolve(quiz);
    dom.levelInfoEl.textContent = quiz.getLevelLabel();

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

    dom.comboTrackEl.replaceChildren();
    if (!redHidden) {
      display.red.items.forEach((item) => {
        const cell = document.createElement("div");
        cell.className = "progress-cell combo-cell";
        const stateClass = comboProgressClass(item.resolved, item.needed);
        if (stateClass) cell.classList.add(stateClass);
        cell.title = item.title;
        cell.setAttribute("aria-label", item.title);
        dom.comboTrackEl.appendChild(cell);
      });
    }

    dom.levelPickerEl.querySelectorAll(".level-btn").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.level) === quiz.getLevel());
    });
  }

  const LEVELS_PER_COLUMN = 10;

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
      renderProgress();
      engine.startRound(quiz.beginRound(quiz.pickNextRound()));
    });
    return btn;
  }

  function buildLevelPicker() {
    dom.levelPickerEl.replaceChildren();
    const maxLevel = quiz.getMaxLevel();
    const mobileDrawer = window.matchMedia("(max-width: 768px)").matches;

    if (mobileDrawer) {
      // Sertar mobil: ordine 1..N; layout-ul (flex wrap, 2 rânduri) e în CSS.
      dom.levelPickerEl.style.gridAutoFlow = "";
      dom.levelPickerEl.style.gridTemplateRows = "";
      dom.levelPickerEl.style.gridTemplateColumns = "";

      for (let lv = 1; lv <= maxLevel; lv++) {
        dom.levelPickerEl.appendChild(createLevelButton(lv));
      }
      return;
    }

    const columns = Math.ceil(maxLevel / LEVELS_PER_COLUMN);
    const rows = Math.min(LEVELS_PER_COLUMN, maxLevel);
    dom.levelPickerEl.style.gridAutoFlow = "";
    dom.levelPickerEl.style.gridTemplateRows = `repeat(${rows}, auto)`;
    dom.levelPickerEl.style.gridTemplateColumns = `repeat(${columns}, auto)`;

    // Coloane paralele: 1-10 lângă 11-20 etc. În fiecare coloană, nivelurile
    // sunt afișate descrescător (cel mai mare sus), păstrând stilul existent.
    for (let column = 0; column < columns; column++) {
      const top = Math.min(maxLevel, (column + 1) * LEVELS_PER_COLUMN);
      const bottom = column * LEVELS_PER_COLUMN + 1;
      for (let lv = top; lv >= bottom; lv--) {
        dom.levelPickerEl.appendChild(createLevelButton(lv));
      }
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
  const sidebarEl = document.querySelector(".sidebar-pickers");

  function setDrawer(open) {
    dom.gameEl.classList.toggle("drawer-open", open);
    if (menuToggleEl) menuToggleEl.setAttribute("aria-expanded", open ? "true" : "false");
    if (drawerBackdropEl) drawerBackdropEl.hidden = !open;
  }

  menuToggleEl?.addEventListener("click", () => {
    setDrawer(!dom.gameEl.classList.contains("drawer-open"));
  });
  drawerBackdropEl?.addEventListener("click", () => setDrawer(false));

  // Buton [CP]: arată/ascunde panourile de control pe mobil (pe desktop e
  // ascuns prin CSS, panourile rămân mereu vizibile acolo).
  const cpToggleEl = document.getElementById("cp-toggle");
  cpToggleEl?.addEventListener("click", () => {
    const open = !dom.gameEl.classList.contains("cp-open");
    dom.gameEl.classList.toggle("cp-open", open);
    cpToggleEl.classList.toggle("active", open);
    cpToggleEl.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // După ce alegi un quiz sau un nivel, închidem sertarul ca să se vadă arena.
  sidebarEl?.addEventListener("click", (e) => {
    if (e.target.closest(".quiz-picker-item, .level-btn")) setDrawer(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dom.gameEl.classList.contains("drawer-open")) {
      setDrawer(false);
    }
  });

  function switchQuiz(id) {
    if (id === QuizRegistry.getActiveId() && quiz && !quiz.isCompleted()) return;
    QuizRegistry.setActive(id);
    const meta = QuizRegistry.get(id);
    dom.quizTitleEl.textContent = meta.title;
    quiz = QuizRegistry.createActive();
    aamArena.reset();
    buildQuizPicker();
    buildLevelPicker();
    lastGreenCells = null;
    renderProgress();
    dom.playPauseBtn.disabled = false;
    engine.startRound(quiz.beginRound(quiz.pickNextRound()));
  }

  QuizRegistry.setActive("addition-eff") ||
    QuizRegistry.setActive(QuizRegistry.getDefaultId()) ||
    QuizRegistry.setActive("addition-table") ||
    QuizRegistry.setActive("prime-divisions");
  quiz = QuizRegistry.createActive();
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

  dom.quizTitleEl.textContent = QuizRegistry.get(QuizRegistry.getActiveId()).title;
  buildQuizPicker();
  buildLevelPicker();
  renderProgress();
  engine.startRound(quiz.beginRound(quiz.pickNextRound()));
  engine.startFallLoop();

  window.matchMedia("(max-width: 768px)").addEventListener("change", () => {
    if (quiz) {
      buildLevelPicker();
      renderProgress();
    }
  });
})();
