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
    arenaActionsEl: null,
  };

  let quiz = null;
  let engine = null;
  let aamArena = null;
  let cpShell = null;
  let lastGreenCells = null;
  let lastRenderedLevel = null;
  const RESPONSE_TIMES_ENABLED_KEY = "showResponseTimes";
  const FAST_RESPONSE_MS = 1500;
  const RESPONSE_TIMES_PER_FACT_MAX = 3;
  let showResponseTimes =
    window.LayoutConfig?.get(RESPONSE_TIMES_ENABLED_KEY, true) !== false;
  let responseTimesInput = null;
  const responseTimesByFact = new Map();

  dom.getSwapQuestionIllustration = () =>
    engine?.getSwapQuestionIllustration?.() ?? false;
  window.getLayoutSwapped = () =>
    engine?.getSwapQuestionIllustration?.() ?? false;

  // Durata implicită, pentru bannerele care nu vin din contractul de nivel
  // (ex. eticheta de nivel de la „Bagare sub radical”).
  const BANNER_DURATA_IMPLICITA_MS = 1600;
  const BANNER_FADE_MS = 280;
  // Ascunderea programată a bannerului curent. O păstrăm ca s-o putem anula
  // când vine un banner nou sau când bannerul devine permanent.
  let bannerTimers = [];

  function opresteTimereleBannerului() {
    bannerTimers.forEach((t) => clearTimeout(t));
    bannerTimers = [];
  }

  // `optiuni.permanent` — bannerul rămâne pe ecran până la schimbarea quizului
  // sau a nivelului din meniu (cerut de user pentru mesajul de ultim nivel).
  // `optiuni.durataMs` — cât stă înainte să dispară singur.
  function showBanner(text, optiuni = {}) {
    if (!text) return;
    opresteTimereleBannerului();
    dom.levelBannerEl.textContent = text;
    dom.levelBannerEl.classList.remove("hidden");
    requestAnimationFrame(() => dom.levelBannerEl.classList.add("show"));
    if (optiuni.permanent) return;
    const durataMs = optiuni.durataMs ?? BANNER_DURATA_IMPLICITA_MS;
    bannerTimers.push(
      setTimeout(() => {
        dom.levelBannerEl.classList.remove("show");
        bannerTimers.push(
          setTimeout(() => dom.levelBannerEl.classList.add("hidden"), BANNER_FADE_MS)
        );
      }, durataMs)
    );
  }

  // Singurul mod prin care dispare un banner permanent: schimbarea quizului sau
  // schimbarea manuală a nivelului din meniu.
  function ascundeBannerul() {
    opresteTimereleBannerului();
    dom.levelBannerEl.classList.remove("show");
    dom.levelBannerEl.classList.add("hidden");
    dom.levelBannerEl.textContent = "";
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
    dom.info11_20El.classList.remove("is-sq2-eff-vbs");
  }

  function resetResponseTimesSession() {
    responseTimesByFact.clear();
  }

  function normalizeTextLabel(text) {
    return String(text ?? "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Cauta un marcaj dedicat "doar intrebarea, fara ilustratii/liste colorate"
  // (clasa .intrebare-propriu-zisa) inauntrul unui promptHtml — cerere user
  // (31.08.2026): lista de timpi din fundal folosea tot promptul (inclusiv
  // tabelul colorat de bv-uri la quizurile Singapore), nu doar intrebarea
  // curenta. Quizurile care nu marcheaza nimic cad pe calea veche (tot
  // promptHtml) — schimbare aditiva, fara sa afecteze alte quizuri.
  function extrageIntrebareaProprie(promptHtml) {
    const proba = document.createElement("div");
    proba.innerHTML = String(promptHtml ?? "");
    const marcat = proba.querySelector(".intrebare-propriu-zisa");
    return marcat ? marcat.textContent : null;
  }

  function responseTimeLabel(state) {
    const meta = state?.metadata || {};
    if (meta.factA != null && meta.factB != null) return `${meta.factA}*${meta.factB}`;
    if (meta.factId) return String(meta.factId);
    if (state?.factId) return String(state.factId);
    if (state?.promptHtml) {
      const intrebareProprie = extrageIntrebareaProprie(state.promptHtml);
      if (intrebareProprie) return normalizeTextLabel(intrebareProprie);
    }
    // Fara marcaj .intrebare-propriu-zisa: preferam promptul text curat (daca
    // exista) inainte sa cadem pe tot promptHtml-ul brut (poate contine
    // <style> injectat de quizuri cu tabel HTML complet, ex. tabla-inmultirii-
    // tabel — vezi bug raportat de user, 01.09.2026: eticheta plina de CSS).
    if (state?.prompt) return normalizeTextLabel(state.prompt);
    if (state?.promptHtml) return normalizeTextLabel(state.promptHtml);
    if (state?.dividend != null && state?.divisor != null) {
      return `${state.dividend}:${state.divisor}`;
    }
    return "Intrebare";
  }

  function recordResponseTimeAttempt({ beforeState, meta, correct, timedOut }) {
    if (!beforeState) return;
    const label = responseTimeLabel(beforeState);
    if (!label) return;
    const existing =
      responseTimesByFact.get(label) || { label, attempts: [], order: 0, timeoutStreak: 0 };

    if (timedOut === true) {
      existing.timeoutStreak = (existing.timeoutStreak || 0) + 1;
      if (existing.timeoutStreak === 6) {
        existing.attempts.push({ timeoutMarker: true });
        existing.order = Date.now();
      }
      responseTimesByFact.set(label, existing);
      return;
    }

    const responseMs = Number(meta?.responseMs);
    if (!Number.isFinite(responseMs)) return;
    existing.timeoutStreak = 0;
    existing.attempts.unshift({
      responseMs: Math.max(0, Math.round(responseMs)),
      correct: correct === true,
    });
    let seenTimes = 0;
    existing.attempts = existing.attempts.filter((attempt) => {
      if (attempt.timeoutMarker) return true;
      seenTimes += 1;
      return seenTimes <= RESPONSE_TIMES_PER_FACT_MAX;
    });
    existing.order = Date.now();
    responseTimesByFact.set(label, existing);
  }

  function dataOraBucuresti(momentIso) {
    const data = new Date(momentIso);
    if (Number.isNaN(data.getTime())) return null;
    const parti = new Intl.DateTimeFormat("ro-RO", {
      timeZone: "Europe/Bucharest",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(data);
    const valoare = (tip) => parti.find((parte) => parte.type === tip)?.value;
    return `${valoare("year")}-${valoare("month")}-${valoare("day")} ${valoare("hour")}:${valoare("minute")}:${valoare("second")}`;
  }

  function inregistreazaIntrebareDinMotor(entry) {
    const dateMecanice = entry?.dateMecaniceJurnal;
    const contextQuiz = quiz?.getContextJurnal?.(entry?.beforeState);
    const jurnal = window.JurnalIntrebari;
    if (!dateMecanice || !contextQuiz) return;
    if (typeof jurnal?.inregistreazaIntrebare !== "function") return;

    jurnal.inregistreazaIntrebare({
      data_ora_ro: dataOraBucuresti(dateMecanice.moment_afisare_iso),
      quiz_name: contextQuiz.quiz_name ?? null,
      subquiz_name: contextQuiz.subquiz_name ?? null,
      intrebare: contextQuiz.intrebare ?? null,
      raspuns: dateMecanice.raspuns,
      a_raspuns_corect: dateMecanice.a_raspuns_corect,
      al_catelea_turn_apasare_pe_buton: dateMecanice.al_catelea_turn_apasare_pe_buton,
      durata_raspuns_secunde: dateMecanice.durata_raspuns_secunde,
      fact: contextQuiz.fact ?? null,
      quiz_id: contextQuiz.quiz_id ?? null,
      subquiz_id: contextQuiz.subquiz_id ?? null,
      fact_id: contextQuiz.fact_id ?? null,
      eq_form: contextQuiz.eq_form ?? null,
      pozitie_buton_apasat_pt_raspuns:
        dateMecanice.pozitie_buton_apasat_pt_raspuns,
      valori_variante_de_raspuns: dateMecanice.valori_variante_de_raspuns,
      valoare_raspuns_corect: dateMecanice.valoare_raspuns_corect,
      hints_aratate_pt_raspuns: contextQuiz.hints_aratate_pt_raspuns ?? null,
      extra: contextQuiz.extra ?? {},
    });
  }

  function getResponseTimeRows() {
    return [...responseTimesByFact.values()]
      .filter((row) => row.attempts.length > 0)
      .sort((a, b) => b.order - a.order);
  }

  function renderInfo11_20() {
    const el = dom.info11_20El;
    if (!el) return;

    const info =
      typeof quiz?.getInfo11_20 === "function" ? quiz.getInfo11_20() : null;
    const hasSpecialInfo = info?.visible === true;
    const timeRows = showResponseTimes ? getResponseTimeRows() : [];
    const hasResponseTimes = timeRows.length > 0;

    if (!hasSpecialInfo && !hasResponseTimes) {
      hideInfo11_20();
      return;
    }

    el.hidden = false;
    el.classList.toggle("is-intensiv", hasSpecialInfo && info.mode === "intensiv");
    el.classList.toggle(
      "is-sq2-eff-vbs",
      hasSpecialInfo &&
        (info.mode === "Subquiz 2: Intensiv cu eff VBS" || info.theme === "sq2-eff-vbs")
    );

    const modeEl = el.querySelector(".info11-mode");
    const wrongEl = el.querySelector(".info11-wrong");
    const intensivEl = el.querySelector(".info11-intensiv");
    const countEl = el.querySelector(".info11-count");
    const sessionsEl = el.querySelector(".info11-sessions");

    [modeEl, wrongEl, intensivEl, countEl, sessionsEl].forEach((node) => {
      if (node) node.hidden = !hasSpecialInfo;
    });

    if (hasSpecialInfo) {
      if (modeEl) modeEl.textContent = `Mod: ${info.mode}`;
      if (wrongEl) wrongEl.textContent = `Facts gresite: ${info.wrongFactsText}`;
      if (intensivEl) {
        intensivEl.textContent = `Facts lucrate intensiv: ${info.intensivText ?? "-"}`;
      }
      if (countEl && info.answeredText != null) {
        countEl.textContent = `Intrebari: ${info.answeredText}`;
      }
      if (sessionsEl && info.intensivSessionsText != null) {
        sessionsEl.textContent = `Sesiuni intensiv: ${info.intensivSessionsText}`;
      }
    }

    const timesEl = el.querySelector(".info11-times");
    if (timesEl) {
      timesEl.replaceChildren();
      timesEl.hidden = !hasResponseTimes;
      if (hasResponseTimes) {
        const head = document.createElement("p");
        head.className = "info11-times-head";
        head.textContent = "Timpi raspuns:";
        timesEl.appendChild(head);
        timeRows.forEach((f) => {
          const row = document.createElement("p");
          row.className = "info11-time-row";
          row.append(`${f.label} : `);
          f.attempts.forEach((attempt) => {
            const val = document.createElement("span");
            val.className = "info11-time-val";
            if (attempt.timeoutMarker) {
              val.classList.add("timeout");
              val.textContent = "timeout";
              row.appendChild(val);
              return;
            }
            if (attempt.correct && attempt.responseMs <= FAST_RESPONSE_MS) {
              val.classList.add("fast");
            }
            if (!attempt.correct) val.classList.add("wrong");
            val.textContent = `${(attempt.responseMs / 1000).toFixed(1)}s`;
            row.appendChild(val);
          });
          timesEl.appendChild(row);
        });
      }
    }
  }

  // Extras din renderProgress() ca să poată rula și pt. quiz-uri customEngine cu
  // niveluri reale (ex. rigle-tabla-1-10.js) — renderProgress() iese devreme pt.
  // orice customEngine (m1-specific: streak/combo/response-times), dar starea
  // „activ" a butoanelor de nivel nu depinde de nimic din asta.
  function syncLevelPickerActive() {
    if (typeof quiz?.getLevel !== "function") return;
    dom.levelPickerEl.querySelectorAll(".level-btn").forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.level) === quiz.getLevel());
    });
  }

  function renderProgress() {
    if (!quiz) return;
    if (quiz.customEngine) {
      dom.levelInfoEl.textContent = "";
      dom.progressVisualEl?.classList.add("hidden");
      renderArenaActions();
      return;
    }
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
      resetResponseTimesSession();
      renderPreEquationNavigationPanel();
    }

    syncLevelPickerActive();

    renderInfo11_20();
    renderSubquizStartControl();
    renderArenaActions();
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
      // Bannerul permanent de „ai parcurs ultimul nivel” dispare la schimbarea
      // manuală a nivelului (decis 28.08.2026) — vezi js/schimbare-de-nivel.js.
      ascundeBannerul();
      const levelMessage = quiz.switchLevel(lv);
      if (levelMessage) dom.messageEl.textContent = levelMessage;
      dom.playPauseBtn.disabled = false;
      engine.cancelRisingAnimation();
      resetResponseTimesSession();
      lastGreenCells = null;
      lastRenderedLevel = typeof quiz.getLevel === "function" ? quiz.getLevel() : null;
      // customEngine nu trece prin engine.startRound (Rigle: switchLevel() de mai sus
      // deja a aplicat totul, prin propriul mounted.reporneste()) — vezi cele 5
      // branch-uri customEngine deja existente, RIGLE-REFERENCE §2; ăsta e al 6-lea.
      if (!quiz.customEngine) {
        engine.startRound(quiz.beginRound(quiz.pickNextRound()));
      }
      renderProgress();
      syncLevelPickerActive();
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
    const maxLevel = typeof quiz?.getMaxLevel === "function" ? quiz.getMaxLevel() : 1;
    // customEngine sare peste picker DOAR dacă n-are niveluri reale (maxLevel<=1,
    // cazul rigle-cl1.js) — un customEngine cu maxLevel>1 (rigle-tabla-1-10.js) îl
    // primește ca orice alt quiz, vezi createLevelButton pt. garda pe partea de click.
    if (quiz?.customEngine && maxLevel <= 1) return;
    dom.levelPickerEl.style.display = "flex";
    dom.levelPickerEl.style.flexWrap = "wrap";
    dom.levelPickerEl.style.justifyContent = "center";
    dom.levelPickerEl.style.gridAutoFlow = "";
    dom.levelPickerEl.style.gridTemplateRows = "";
    dom.levelPickerEl.style.gridTemplateColumns = "";

    for (let lv = 1; lv <= maxLevel; lv++) {
      dom.levelPickerEl.appendChild(createLevelButton(lv));
    }
    syncLevelPickerActive();
  }

  function parseQuizMenuText(text) {
    const groups = [{ title: null, items: [] }];
    (text || "").split("\n").forEach((raw) => {
      const line = raw.trim();
      if (!line) return;
      if (line.startsWith("##")) {
        groups.push({ title: line.slice(2).trim(), items: [] });
      } else {
        groups[groups.length - 1].items.push(line);
      }
    });
    return groups;
  }

  function createQuizButton(meta, extraClass) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = extraClass ? `quiz-picker-item ${extraClass}` : "quiz-picker-item";
    btn.textContent = meta.title;
    btn.title = meta.description || "";
    btn.classList.toggle("active", meta.id === QuizRegistry.getActiveId());
    btn.addEventListener("click", () => switchQuiz(meta.id));
    return btn;
  }

  function createQuizPickerGroupTitle(text) {
    const el = document.createElement("div");
    el.className = "quiz-picker-group-title";
    el.textContent = text;
    return el;
  }

  function createUnmatchedMenuLine(text) {
    const el = document.createElement("div");
    el.className = "quiz-picker-item quiz-picker-item-unmatched";
    el.textContent = text;
    return el;
  }

  async function copyTextToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {
      // continuă cu fallback-ul de mai jos
    }
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (_) {
      copied = false;
    }
    document.body.removeChild(temp);
    return copied;
  }

  function buildMissingQuizzesSection(missingMetas) {
    const fragment = document.createDocumentFragment();

    const header = document.createElement("div");
    header.className = "quiz-picker-missing-header";
    header.appendChild(createQuizPickerGroupTitle("De introdus:"));

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "quiz-picker-copy-list";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", async () => {
      const text = missingMetas.map((meta) => meta.title).join("\n");
      const copied = await copyTextToClipboard(text);
      copyBtn.textContent = copied ? "copiat!" : "eroare";
      setTimeout(() => {
        copyBtn.textContent = "Copy";
      }, 1500);
    });
    header.appendChild(copyBtn);
    fragment.appendChild(header);

    missingMetas.forEach((meta) => fragment.appendChild(createQuizButton(meta, "quiz-picker-item-missing")));
    return fragment;
  }

  function buildQuizPicker() {
    dom.quizPickerListEl.replaceChildren();

    const byTitle = new Map(QuizRegistry.list().map((meta) => [meta.title, meta]));
    const matchedTitles = new Set();

    parseQuizMenuText(window.QUIZ_MENU_TEXT).forEach((group) => {
      if (group.title) dom.quizPickerListEl.appendChild(createQuizPickerGroupTitle(group.title));
      group.items.forEach((line) => {
        const meta = byTitle.get(line);
        if (meta) {
          matchedTitles.add(line);
          dom.quizPickerListEl.appendChild(createQuizButton(meta));
        } else {
          dom.quizPickerListEl.appendChild(createUnmatchedMenuLine(line));
        }
      });
    });

    const missing = QuizRegistry.list().filter((meta) => !matchedTitles.has(meta.title));
    if (missing.length > 0) {
      dom.quizPickerListEl.insertBefore(buildMissingQuizzesSection(missing), dom.quizPickerListEl.firstChild);
    }
  }

  // Aceeasi ordine ca in "Alege quiz" (QUIZ_MENU_TEXT), dar plata: fara titluri
  // de grupa, fiecare quiz o singura data (un titlu poate fi listat sub mai
  // multe clase in meniu — pastram doar prima aparitie). Quizurile neintroduse
  // inca in QUIZ_MENU_TEXT se adauga la final, in ordinea din Registry.
  function getQuizMenuOrder() {
    const byTitle = new Map(QuizRegistry.list().map((meta) => [meta.title, meta]));
    const seen = new Set();
    const ordered = [];
    parseQuizMenuText(window.QUIZ_MENU_TEXT).forEach((group) => {
      group.items.forEach((line) => {
        const meta = byTitle.get(line);
        if (meta && !seen.has(meta.id)) {
          seen.add(meta.id);
          ordered.push({ id: meta.id, title: meta.title });
        }
      });
    });
    QuizRegistry.list().forEach((meta) => {
      if (!seen.has(meta.id)) {
        seen.add(meta.id);
        ordered.push({ id: meta.id, title: meta.title });
      }
    });
    return ordered;
  }

  // ── Sertar mobil (Pasul 2a) ────────────────────────────────────────────
  // Pe ecrane mici, quiz-urile/nivelurile stau într-un drawer deschis de butonul „Alege quiz”.
  // Pe desktop acest buton e ascuns prin CSS, deci codul rămâne inert acolo.
  const menuToggleEl = document.getElementById("menu-toggle");
  const drawerBackdropEl = document.getElementById("drawer-backdrop");
  const drawerCloseEl = document.getElementById("drawer-close");
  const divMeniuEl = document.getElementById("divMeniu");

  const MENU_TEXT_SCALE_KEY = "youlearn.menuTextScale";
  const MENU_TEXT_SCALE_MIN = 0.2;
  const MENU_TEXT_SCALE_MAX = 2;
  const MENU_TEXT_SCALE_STEP = 0.1;

  function setMenuTextScale(value) {
    const clamped = Math.min(MENU_TEXT_SCALE_MAX, Math.max(MENU_TEXT_SCALE_MIN, value));
    const rounded = Math.round(clamped * 100) / 100;
    divMeniuEl.style.setProperty("--menu-text-scale", rounded);
    localStorage.setItem(MENU_TEXT_SCALE_KEY, String(rounded));
    return rounded;
  }

  function initMenuTextScale() {
    const raw = localStorage.getItem(MENU_TEXT_SCALE_KEY);
    const stored = raw === null ? NaN : Number(raw);
    let scale = setMenuTextScale(Number.isFinite(stored) ? stored : 1);

    document.getElementById("menu-text-size-dec")?.addEventListener("click", () => {
      scale = setMenuTextScale(scale - MENU_TEXT_SCALE_STEP);
    });
    document.getElementById("menu-text-size-inc")?.addEventListener("click", () => {
      scale = setMenuTextScale(scale + MENU_TEXT_SCALE_STEP);
    });
  }

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
  function openCpToActiveQuizSection() {
    cpShell.setOpen(true);
    cpShell.scrollToActiveQuizSection();
  }
  cpToggleEl?.addEventListener("click", () => {
    if (!cpShell) return;
    const drawerOpen = isMobileLayout() && dom.gameEl.classList.contains("drawer-open");
    const willOpen = !cpShell.isOpen();
    if (drawerOpen) setDrawer(false);
    if (drawerOpen && willOpen) {
      requestAnimationFrame(openCpToActiveQuizSection);
      return;
    }
    if (willOpen) openCpToActiveQuizSection();
    else cpShell.setOpen(false);
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
    // Bannerul permanent de „ai parcurs ultimul nivel” dispare la schimbarea
    // quizului (decis 28.08.2026) — vezi js/schimbare-de-nivel.js.
    ascundeBannerul();
    if (quiz?.customEngine) quiz.unmountArena?.();
    QuizRegistry.setActive(id);
    const meta = QuizRegistry.get(id);
    applyQuizTitleDisplay();
    quiz = QuizRegistry.createActive();
    quiz.setOnFluentaReady?.(() => restartActiveRound());
    resetResponseTimesSession();
    applyRequestedQuizConfig();
    cpShell?.refreshEnabledStates?.();
    renderEquationTonomatPanel();
    renderPreEquationNavigationPanel();
    renderSq2EffVbsPanel();
    renderSq3FactorGroupsPanel();
    renderSq5FluentPartyPanel();
    renderRiglePanel();
    renderRigleTabla110Panel();
    renderIlustrareMereVitezaPanel();
    renderTablaInmultiriiTabelPanel();
    renderArenaActions();
    aamArena?.reset();
    buildQuizPicker();
    buildLevelPicker();
    lastGreenCells = null;
    lastRenderedLevel = typeof quiz.getLevel === "function" ? quiz.getLevel() : null;
    dom.playPauseBtn.disabled = false;
    if (quiz?.customEngine) {
      quiz.mountArena?.({ arenaEl: dom.arena, optionsEl: dom.optionsEl, gameEl: dom.gameEl });
    } else {
      engine?.startRound(quiz.beginRound(quiz.pickNextRound()));
    }
    renderProgress();
    // Pe desktop CP e andocat vizibil, deci schimbarea quizului deruleaza direct
    // la sectiunea lui; pe mobil CP e overlay inchis, ramane pe fluxul existent
    // (deschidere din [CP] -> openCpToActiveQuizSection, aceeasi regula).
    if (!isMobileLayout()) cpShell?.scrollToActiveQuizSection();
  }

  function restartActiveRound() {
    if (!quiz) return;
    dom.playPauseBtn.disabled = false;
    engine?.cancelRisingAnimation?.();
    resetResponseTimesSession();
    lastGreenCells = null;
    lastRenderedLevel = typeof quiz.getLevel === "function" ? quiz.getLevel() : null;
    buildLevelPicker();
    engine?.startRound(quiz.beginRound(quiz.pickNextRound()));
    renderProgress();
  }

  function renderArenaActions() {
    if (!dom.arenaActionsEl) return;
    const getActions = quiz?.getArenaActions;
    const runAction = quiz?.runArenaAction;
    if (typeof getActions !== "function" || typeof runAction !== "function") {
      dom.arenaActionsEl.hidden = true;
      dom.arenaActionsEl.replaceChildren();
      return;
    }

    const actions = getActions.call(quiz) || [];
    if (!actions.length) {
      dom.arenaActionsEl.hidden = true;
      dom.arenaActionsEl.replaceChildren();
      return;
    }

    dom.arenaActionsEl.hidden = false;
    dom.arenaActionsEl.replaceChildren();
    actions.forEach((action) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "arena-quiz-action";
      btn.textContent = action.label;
      btn.disabled = action.disabled === true;
      btn.addEventListener("click", () => {
        const currentAction = (quiz.getArenaActions?.() || []).find((item) => item.id === action.id);
        if (currentAction?.disabled === true) return;
        const next = quiz.runArenaAction(action.id);
        if (!next) return;
        dom.playPauseBtn.disabled = false;
        engine?.cancelRisingAnimation?.();
        engine?.startRound(quiz.beginRound(next));
        renderProgress();
      });
      dom.arenaActionsEl.appendChild(btn);
    });
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

  function renderRiglePanel() {
    const mount = cpShell?.getMountEl("rigle");
    if (!mount) return;
    mount.replaceChildren();
    if (typeof quiz?.appendRigleControlPanel !== "function") return;
    quiz.appendRigleControlPanel(mount);
  }

  function renderRigleTabla110Panel() {
    const mount = cpShell?.getMountEl("rigleTabla110");
    if (!mount) return;
    mount.replaceChildren();
    if (typeof quiz?.appendRigleTabla110ControlPanel !== "function") return;
    quiz.appendRigleTabla110ControlPanel(mount);
  }

  function renderIlustrareMereVitezaPanel() {
    const mount = cpShell?.getMountEl("ilustrareMereViteza");
    if (!mount) return;
    mount.replaceChildren();
    if (typeof quiz?.appendIlustrareMereControlPanel !== "function") return;
    quiz.appendIlustrareMereControlPanel(mount);
  }

  function renderTablaInmultiriiTabelPanel() {
    const mount = cpShell?.getMountEl("tablaInmultiriiTabel");
    if (!mount) return;
    mount.replaceChildren();
    if (typeof quiz?.appendTablaInmultiriiTabelControlPanel !== "function") return;
    // { onChange: restartActiveRound } — bifa "Comută pe tabla adunării"
    // restarteaza automat nivelul curent (cerere user, 02.09.2026), acelasi
    // tipar ca la Tonomat/PreEquationNavigation mai sus.
    quiz.appendTablaInmultiriiTabelControlPanel(mount, { onChange: restartActiveRound });
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

  function renderSq2EffVbsPanel() {
    const mount = cpShell?.getMountEl("sq2EffVbs");
    if (!mount) return;
    mount.replaceChildren();
    if (typeof quiz?.appendSq2ControlPanel !== "function") return;
    quiz.appendSq2ControlPanel(mount, {
      onChange: () => {
        renderSq2EffVbsPanel();
        renderProgress();
      },
    });
  }

  function renderSq3FactorGroupsPanel() {
    const mount = cpShell?.getMountEl("sq3FactorGroups");
    if (!mount) return;
    mount.replaceChildren();
    if (typeof quiz?.appendSq3ControlPanel !== "function") return;
    quiz.appendSq3ControlPanel(mount, {
      onChange: () => {
        renderSq3FactorGroupsPanel();
        renderProgress();
      },
    });
  }

  function renderSq5FluentPartyPanel() {
    const mount = cpShell?.getMountEl("sq5FluentParty");
    if (!mount) return;
    mount.replaceChildren();
    if (typeof quiz?.appendSq5ControlPanel !== "function") return;
    quiz.appendSq5ControlPanel(mount, {
      onChange: () => {
        renderSq5FluentPartyPanel();
        renderProgress();
      },
      // Mod A/B si intrarea decid CE subquiz porneste — spre deosebire de
      // celelalte campuri sq5, care doar regleaza un subquiz deja pornit,
      // au nevoie de o repornire reala ca sa se vada efectul imediat.
      onRouteChange: () => {
        restartActiveRound();
        renderSq5FluentPartyPanel();
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
  quiz.setOnFluentaReady?.(() => restartActiveRound());
  applyRequestedQuizConfig();

  // Titlul "Subquiz" e comun mai multor quizuri (getSubquizStartOptions apare in
  // 4 fisiere din js/quizzes/) — nu exista UN titlu exact de quiz de fixat static,
  // deci se recalculeaza din quizul activ de fiecare data cand e citit (vezi
  // resolveTitle() din cp-shell.js, apelat si la fiecare switchQuiz -> refreshEnabledStates).
  function subquizPanelTitle() {
    const activeMeta = QuizRegistry.get(QuizRegistry.getActiveId());
    return `CP - ${activeMeta?.title || "Subquiz"} — Subquiz`;
  }

  let aamCpEnabled = false;
  CpRegistry.register({
    id: "general",
    title: "CP - General",
    isEnabled: () => true,
  });
  CpRegistry.register({
    id: "subquiz",
    title: subquizPanelTitle,
    isEnabled: () => typeof quiz?.getSubquizStartOptions === "function",
    quizSpecific: true,
  });
  CpRegistry.register({
    id: "equationTonomat",
    title: "CP - Ecuatii cu 3 4 5 6 numere",
    isEnabled: () => typeof quiz?.appendTonomatControlPanel === "function",
    quizSpecific: true,
  });
  CpRegistry.register({
    id: "rigle",
    title: "CP - Adunari cu coloane verticale",
    isEnabled: () => typeof quiz?.appendRigleControlPanel === "function",
    quizSpecific: true,
  });
  CpRegistry.register({
    id: "rigleTabla110",
    title: "CP - Adunari cu coloane - Tabla adunarii 1-10",
    isEnabled: () => typeof quiz?.appendRigleTabla110ControlPanel === "function",
    quizSpecific: true,
  });
  CpRegistry.register({
    id: "ilustrareMereViteza",
    title: "CP - Tabla adunarii Singapore 6=?+3",
    isEnabled: () => typeof quiz?.appendIlustrareMereControlPanel === "function",
    quizSpecific: true,
  });
  CpRegistry.register({
    id: "tablaInmultiriiTabel",
    title: "CP - Tabla inmultirii - Tabel",
    isEnabled: () => typeof quiz?.appendTablaInmultiriiTabelControlPanel === "function",
    quizSpecific: true,
  });
  CpRegistry.register({
    id: "preEquationNav",
    title: "CP - Navigare pre-ecuatii EFF",
    isEnabled: () =>
      typeof quiz?.appendPreEquationNavigationControlPanel === "function",
    quizSpecific: true,
  });
  CpRegistry.register({
    id: "sq2EffVbs",
    title: "CP - T*/ 11-20 - v3 - train w eff si eq forms - jurnal",
    isEnabled: () => typeof quiz?.appendSq2ControlPanel === "function",
    quizSpecific: true,
  });
  CpRegistry.register({
    id: "sq3FactorGroups",
    title: "CP - T*/ 11-20 - v4 - bag toate in joc, intensiv multipli 2 3 4 — SQ3",
    isEnabled: () => typeof quiz?.appendSq3ControlPanel === "function",
    quizSpecific: true,
  });
  CpRegistry.register({
    id: "sq5FluentParty",
    title:
      "CP - T*/ 11-20 - v4 - bag toate in joc, intensiv multipli 2 3 4 — SQ5 Fluent party",
    isEnabled: () => typeof quiz?.appendSq5ControlPanel === "function",
    quizSpecific: true,
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
  renderSq2EffVbsPanel();
  renderSq3FactorGroupsPanel();
  renderSq5FluentPartyPanel();
  renderRiglePanel();
  renderRigleTabla110Panel();
  renderIlustrareMereVitezaPanel();
  renderTablaInmultiriiTabelPanel();

  function syncResponseTimesInput() {
    if (responseTimesInput) responseTimesInput.checked = showResponseTimes;
  }

  // "Vizualizare 3 - Claude" (cerere user, 02.09.2026) — inainte era un <a>
  // static in index.html, pinuit deasupra tuturor sectiunilor CP (vezi
  // comentariul vechi din style.css, .cp-viz3-link). Acum e <button>, primul
  // element din sectiunea "General" (cerere expresa user). Deschide pagina
  // intr-un tab NUMIT (nu "_blank" simplu), ca reclick-urile sa refoloseasca
  // acelasi tab in loc sa deschida unul nou de fiecare data — acelasi tipar
  // ca deschidePaginaInTabNou() din Vizualizare logs/vizualizare-logs.js.
  const PAGINA_VIZUALIZARE_3 = "Vizualizare 3 - Claude/vizualizare3.html";
  const NUME_TAB_VIZUALIZARE_3 = "youlearn-vizualizare-3";
  function deschideVizualizare3Claude() {
    const url = window.location
      ? new URL(PAGINA_VIZUALIZARE_3, window.location.href).href
      : PAGINA_VIZUALIZARE_3;
    return window.open?.(url, NUME_TAB_VIZUALIZARE_3) ?? null;
  }
  window.deschideVizualizare3Claude = deschideVizualizare3Claude;

  (function buildGeneralPanel() {
    const mount = cpShell.getMountEl("general");
    if (!mount) return;
    mount.replaceChildren();

    const butonVizualizare3 = document.createElement("button");
    butonVizualizare3.type = "button";
    butonVizualizare3.className = "cp-viz3-link";
    butonVizualizare3.textContent = "↗ Vizualizare 3";
    butonVizualizare3.addEventListener("click", () => deschideVizualizare3Claude());
    mount.appendChild(butonVizualizare3);

    const row = document.createElement("label");
    row.className = "control-panel-lift-row";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = showResponseTimes;
    responseTimesInput = input;
    input.addEventListener("change", () => {
      showResponseTimes = input.checked;
      window.LayoutConfig?.set(RESPONSE_TIMES_ENABLED_KEY, showResponseTimes);
      renderProgress();
    });
    const span = document.createElement("span");
    span.textContent = "Afiseaza Timpi raspuns";
    row.append(input, span);
    mount.appendChild(row);
    syncResponseTimesInput();

    window.StartupQuiz?.appendStartupQuizControl(mount, {
      options: getQuizMenuOrder(),
      onChange: (id) => {
        if (engine) switchQuiz(id);
      },
    });
  })();

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

  (function buildArenaActionsHost() {
    dom.arenaActionsEl = document.createElement("div");
    dom.arenaActionsEl.className = "arena-quiz-actions";
    dom.arenaActionsEl.hidden = true;
    dom.stratInfoEl?.appendChild(dom.arenaActionsEl);
    renderArenaActions();
  })();

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

    // Mini-panou de diagnostic localStorage (cerere user, 02.09.2026 — bug
    // "quota exceeded" in fact-store.js, blocase jocul; trebuia comparat
    // ce e stocat pe mai multe aparate, inclusiv telefon, unde nu exista
    // consola usor accesibila). Afiseaza exact ce ar arata si un
    // `Object.keys(localStorage).map(...)` din consola — dar vizibil direct
    // pe ecran, pe orice aparat. Read-only: nu sterge nimic singur.
    (function buildStorageUsageSection() {
      const wrap = document.createElement("div");
      wrap.className = "control-panel-lift-field";

      const titlu = document.createElement("span");
      titlu.textContent = "Stocare (localStorage) pe acest aparat:";
      wrap.appendChild(titlu);

      const refreshBtn = document.createElement("button");
      refreshBtn.type = "button";
      refreshBtn.className = "control-panel-asnw-reset";
      refreshBtn.textContent = "Reîmprospătează";
      wrap.appendChild(refreshBtn);

      const pre = document.createElement("pre");
      pre.className = "control-panel-storage-usage";
      wrap.appendChild(pre);

      function formateazaMarime(caractere) {
        if (caractere >= 1024 * 1024) return `${(caractere / (1024 * 1024)).toFixed(2)} MB`;
        if (caractere >= 1024) return `${(caractere / 1024).toFixed(1)} KB`;
        return `${caractere} c.`;
      }

      function reimprospateaza() {
        let intrari;
        try {
          intrari = Object.keys(localStorage)
            .map((cheie) => [cheie, (localStorage.getItem(cheie) || "").length])
            .sort((a, b) => b[1] - a[1]);
        } catch (eroare) {
          pre.textContent = "localStorage indisponibil pe acest aparat/mod de navigare.";
          return;
        }
        if (intrari.length === 0) {
          pre.textContent = "(gol)";
          return;
        }
        const total = intrari.reduce((suma, [, marime]) => suma + marime, 0);
        const linii = intrari.map(
          ([cheie, marime]) => `${formateazaMarime(marime).padStart(9)}  ${cheie}`
        );
        pre.textContent = `Total: ${formateazaMarime(total)} (${intrari.length} chei)\n\n${linii.join("\n")}`;
      }

      refreshBtn.addEventListener("click", reimprospateaza);
      reimprospateaza();
      mount.appendChild(wrap);
    })();
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
    onAttemptLogged: (entry) => {
      recordResponseTimeAttempt(entry);
      inregistreazaIntrebareDinMotor(entry);
      if (entry?.result?.levelAdvanced === true) {
        resetResponseTimesSession();
      }
      renderProgress();
    },
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
  initMenuTextScale();
  buildQuizPicker();
  buildLevelPicker();
  applyLiftLayout();
  if (quiz?.customEngine) {
    quiz.mountArena?.({ arenaEl: dom.arena, optionsEl: dom.optionsEl, gameEl: dom.gameEl });
  } else {
    engine.startRound(quiz.beginRound(quiz.pickNextRound()));
  }
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

  // La pornirea aplicatiei (nu doar la schimbarea ulterioara a quizului): CP,
  // pe desktop, sare direct la sectiunea quizului de pornire, daca are una.
  // Trebuie sa fie ultimul pas — inainte de asta, panourile CP inca isi umplu
  // continutul (inaltimi incomplete) si divCp inca isi schimba parintele prin
  // applyDesktopGrid(), asa ca orice masuratoare de scroll facuta mai devreme
  // ar calcula pozitii gresite.
  if (!isMobileLayout()) cpShell?.scrollToActiveQuizSection();
})();
