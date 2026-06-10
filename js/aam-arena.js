(function (global) {
  "use strict";

  const FADE_MS = 200;

  const PANEL_SWITCHES = [
    ["pornesteAnimatiaAutomat", "Pornește animația automat"],
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
    ["animNumereAxaCuMerele", "Numere pe axă odată cu obiectele"],
    ["animAcoladeNumereMici", "Afișează acoladele pt numerele mici (anim)"],
    ["animFadeNumere", "Schimbare numere cu fading"],
    ["animFadeObiecte", "Afișare obiecte cu fading"],
  ];

  function normalizePrompt(raw) {
    return String(raw || "")
      .replace(/\s/g, "")
      .replace(/×/g, "*")
      .replace(/÷|:/g, "/")
      .replace(/−/g, "-");
  }

  function canParseAam(eq) {
    if (!global.parseAamEquation || !global.fname) return false;
    try {
      global.parseAamEquation(normalizePrompt(eq));
      return true;
    } catch {
      return false;
    }
  }

  function createAamArena(dom) {
    const options = {
      pornesteAnimatiaAutomat: true,
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
    };

    let lastIllustrationKey = null;
    let activeAnim = null;
    let fadeTimer = null;
    let pendingRender = null;

    const ilustrareEl = dom.illustrareEl;
    const listaOperatiiEl = dom.listaOperatiiEl;
    const panelEl = dom.aamControlPanelEl;

    function setEmpty(el, empty) {
      el.classList.toggle("is-empty", empty);
      el.setAttribute("aria-hidden", empty ? "true" : "false");
    }

    function stopAnim() {
      activeAnim?.cancel?.();
      activeAnim = null;
    }

    function clearFadeTimer() {
      if (fadeTimer != null) {
        clearTimeout(fadeTimer);
        fadeTimer = null;
      }
    }

    function clearIllustration() {
      stopAnim();
      clearFadeTimer();
      pendingRender = null;
      ilustrareEl.classList.remove("is-fading");
      ilustrareEl.replaceChildren();
      ilustrareEl.style.minHeight = "";
      setEmpty(ilustrareEl, true);
      lastIllustrationKey = null;
    }

    function unitWidthFor(model) {
      const box = ilustrareEl.clientWidth || options.viewWidth;
      const span = Math.max(
        6,
        model.total + options.axisEndPadding - options.axisStart
      );
      return Math.max(20, Math.min(48, Math.floor((box - 72) / span)));
    }

    function drawStatic(equation) {
      const eq = normalizePrompt(equation);
      const model = global.parseAamEquation(eq);
      const unitWidth = unitWidthFor(model);
      const drawn = global.fname(eq, ilustrareEl, { ...options, unitWidth });
      if (drawn?.height) ilustrareEl.style.minHeight = `${drawn.height}px`;
      setEmpty(ilustrareEl, false);
    }

    function drawWithAnimation(equation) {
      stopAnim();
      const eq = normalizePrompt(equation);
      activeAnim = global.runFnameAnimation(eq, ilustrareEl, options);
      activeAnim.promise.then((result) => {
        if (activeAnim && result?.done !== false) {
          setEmpty(ilustrareEl, false);
        }
        activeAnim = null;
      });
      setEmpty(ilustrareEl, false);
    }

    function applyIllustration(equation) {
      if (options.pornesteAnimatiaAutomat && global.runFnameAnimation) {
        drawWithAnimation(equation);
      } else {
        drawStatic(equation);
      }
    }

    function showIllustration(equation, key) {
      pendingRender = { equation, key };
      clearFadeTimer();
      ilustrareEl.classList.add("is-fading");

      fadeTimer = setTimeout(() => {
        fadeTimer = null;
        const job = pendingRender;
        pendingRender = null;
        if (!job) return;

        stopAnim();
        ilustrareEl.replaceChildren();
        applyIllustration(job.equation);
        lastIllustrationKey = job.key;
        ilustrareEl.classList.remove("is-fading");
      }, FADE_MS);
    }

    function buildControlPanel() {
      panelEl.replaceChildren();
      panelEl.className = "control-panel-aam";

      const title = document.createElement("h2");
      title.className = "control-panel-aam-title";
      title.textContent = "Control panel — axe acolade mere";
      panelEl.appendChild(title);

      for (const [key, label] of PANEL_SWITCHES) {
        const row = document.createElement("label");
        row.className = "control-panel-aam-row";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = !!options[key];
        input.addEventListener("change", () => {
          options[key] = input.checked;
          if (lastIllustrationKey != null) {
            const eq = ilustrareEl.dataset.equation;
            if (eq) applyIllustration(eq);
          }
        });
        const span = document.createElement("span");
        span.textContent = label;
        row.append(input, span);
        panelEl.appendChild(row);
      }

      const objRow = document.createElement("div");
      objRow.className = "control-panel-aam-field";
      const objLabel = document.createElement("label");
      objLabel.textContent = "Obiect afișat";
      const objSelect = document.createElement("select");
      for (const t of ["mere", "lamai", "flori", "discuri"]) {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        objSelect.appendChild(opt);
      }
      objSelect.value = options.obiectAfisat;
      objSelect.addEventListener("change", () => {
        options.obiectAfisat = objSelect.value;
        if (lastIllustrationKey != null) {
          const eq = ilustrareEl.dataset.equation;
          if (eq) applyIllustration(eq);
        }
      });
      objRow.append(objLabel, objSelect);
      panelEl.appendChild(objRow);

      const speedRow = document.createElement("div");
      speedRow.className = "control-panel-aam-field";
      const speedLabel = document.createElement("label");
      speedLabel.textContent = "Viteză creștere acoladă (ms/pas)";
      const speedSlider = document.createElement("input");
      speedSlider.type = "range";
      speedSlider.min = "80";
      speedSlider.max = "1200";
      speedSlider.step = "20";
      speedSlider.value = String(options.animBraceMsPerStep);
      const speedOut = document.createElement("span");
      speedOut.className = "control-panel-aam-slider-out";
      speedOut.textContent = speedSlider.value;
      speedSlider.addEventListener("input", () => {
        options.animBraceMsPerStep = Number(speedSlider.value);
        speedOut.textContent = speedSlider.value;
      });
      speedRow.append(speedLabel, speedSlider, speedOut);
      panelEl.appendChild(speedRow);
    }

    function setPanelVisible(on) {
      panelEl.classList.toggle("hidden", !on);
      panelEl.hidden = !on;
    }

    function syncFromQuiz(quiz, state) {
      if (!global.fname || !quiz?.getAamIllustration) {
        setPanelVisible(false);
        clearIllustration();
        return;
      }

      const spec = quiz.getAamIllustration(state);
      if (!spec?.enabled) {
        setPanelVisible(false);
        clearIllustration();
        ilustrareEl.removeAttribute("data-equation");
        return;
      }

      setPanelVisible(true);

      const equation = normalizePrompt(spec.equation ?? state?.prompt);
      if (!canParseAam(equation)) {
        clearIllustration();
        ilustrareEl.removeAttribute("data-equation");
        return;
      }

      const key = spec.illustrationKey ?? equation;
      ilustrareEl.dataset.equation = equation;

      if (key === lastIllustrationKey) return;

      showIllustration(equation, key);
    }

    function reset() {
      clearIllustration();
      ilustrareEl.removeAttribute("data-equation");
      setPanelVisible(false);
    }

    function invalidateKey() {
      lastIllustrationKey = null;
    }

    setEmpty(ilustrareEl, true);
    setEmpty(listaOperatiiEl, true);
    buildControlPanel();
    setPanelVisible(false);

    return { syncFromQuiz, reset, invalidateKey };
  }

  global.AamArena = { create: createAamArena, normalizePrompt, canParseAam };
})(window);
