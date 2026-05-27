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
    flashEl: document.getElementById("flash"),
    falling: document.getElementById("falling"),
    fallingMainEl: document.getElementById("falling-main"),
    topNumberEl: document.getElementById("top-number"),
    divisionHistoryEl: document.getElementById("division-history"),
    fallingPrimes: [...document.querySelectorAll(".falling-prime")],
    rising: document.getElementById("rising"),
    risingNumberEl: document.getElementById("rising-number"),
    optionBtns: [...document.querySelectorAll(".option")],
  };

  let quiz = null;
  let engine = null;
  let lastGreenCells = null;

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

    const redHidden = display.red.mode === "none";
    dom.progressVisualEl?.classList.toggle("red-hidden", redHidden);

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

  function buildLevelPicker() {
    dom.levelPickerEl.replaceChildren();
    for (let lv = quiz.getMaxLevel(); lv >= 1; lv--) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "level-btn";
      btn.dataset.level = String(lv);
      btn.textContent = String(lv);
      const { min, max } = GameUtils.levelRange(lv);
      btn.title = quiz.getLevelButtonTitle?.(lv) ?? `Nivel ${lv}: ${min}–${max}`;
      btn.addEventListener("click", () => {
        quiz.switchLevel(lv);
        dom.playPauseBtn.disabled = false;
        engine.cancelRisingAnimation();
        lastGreenCells = null;
        renderProgress();
        engine.startRound(quiz.beginRound(quiz.pickNextRound()));
      });
      dom.levelPickerEl.appendChild(btn);
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

  function switchQuiz(id) {
    if (id === QuizRegistry.getActiveId() && quiz && !quiz.isCompleted()) return;
    QuizRegistry.setActive(id);
    const meta = QuizRegistry.get(id);
    dom.quizTitleEl.textContent = meta.title;
    quiz = QuizRegistry.createActive();
    buildQuizPicker();
    buildLevelPicker();
    lastGreenCells = null;
    renderProgress();
    dom.playPauseBtn.disabled = false;
    engine.startRound(quiz.beginRound(quiz.pickNextRound()));
  }

  QuizRegistry.setActive("addition-table") ||
    QuizRegistry.setActive("prime-divisions") ||
    QuizRegistry.setActive(QuizRegistry.getDefaultId());
  quiz = QuizRegistry.createActive();

  engine = new FallingEngine({
    dom,
    getQuiz: () => quiz,
    showBanner,
    onProgressUpdate: renderProgress,
  });

  dom.quizTitleEl.textContent = QuizRegistry.get(QuizRegistry.getActiveId()).title;
  buildQuizPicker();
  buildLevelPicker();
  renderProgress();
  engine.startRound(quiz.beginRound(quiz.pickNextRound()));
  engine.startFallLoop();
})();
