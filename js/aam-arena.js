(function (global) {
  "use strict";

  const FADE_MS = 200;

  const AXIS_EXTENSION_SWITCHES = [
    ["axaNumereIncludeMinus2Minus1", "Include și −2, −1"],
    ["axaNumereIncludeTotalPlus1Plus2", "Include total+1, total+2"],
  ];

  const PANEL_SWITCHES = [
    ["pornesteAnimatiaAutomat", "Pornește animația automat"],
    ["asteaptaAnimatieInainteDeLift", "Înainte de lift, așteaptă animația acoladelor"],
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
      pornesteAnimatiaAutomat: false,
      asteaptaAnimatieInainteDeLift: true,
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
      axaNumereIncludeMinus2Minus1: false,
      axaNumereIncludeTotalPlus1Plus2: false,
      axisHideTailAfterLast: 5,
      viewWidth: 720,
    };

    let activeAnim = null;
    let fadeTimer = null;
    let pendingRender = null;

    const ilustrareArenaEl = dom.illustrareArenaEl;
    const ilustrareLiftEl = dom.illustrareLiftEl;
    const arenaBodyEl =
      dom.illustrareArenaBodyEl ||
      ilustrareArenaEl?.querySelector(".arena-ilustrare-body");
    const liftBodyEl =
      dom.illustrareLiftBodyEl ||
      ilustrareLiftEl?.querySelector(".lift-ilustrare-body");
    const panelEl = dom.aamControlPanelEl;

    function isLayoutSwapped() {
      return dom.getSwapQuestionIllustration?.() ?? false;
    }

    function getIllustrationTarget() {
      if (isLayoutSwapped()) {
        return { hostEl: ilustrareLiftEl, bodyEl: liftBodyEl };
      }
      return { hostEl: ilustrareArenaEl, bodyEl: arenaBodyEl };
    }

    function getStoredEquation() {
      return (
        ilustrareArenaEl?.dataset.equation ||
        ilustrareLiftEl?.dataset.equation ||
        ""
      );
    }

    function clearEquationMeta() {
      ilustrareArenaEl?.removeAttribute("data-equation");
      ilustrareLiftEl?.removeAttribute("data-equation");
    }

    function clearBodyEl(body) {
      if (!body) return;
      body.classList.remove("is-fading");
      body.replaceChildren();
      body.style.minHeight = "";
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

    function clearIllustrationBody() {
      stopAnim();
      clearFadeTimer();
      pendingRender = null;
      clearBodyEl(arenaBodyEl);
      clearBodyEl(liftBodyEl);
    }

    function clearInactiveIllustrationBody() {
      const { bodyEl } = getIllustrationTarget();
      if (bodyEl === arenaBodyEl) clearBodyEl(liftBodyEl);
      else clearBodyEl(arenaBodyEl);
    }

    function redrawCurrentEquation() {
      const eq = getStoredEquation();
      if (eq) applyIllustration(eq).catch(() => {});
    }

    function unitWidthFor(model) {
      const { hostEl } = getIllustrationTarget();
      const box = hostEl?.clientWidth || options.viewWidth;
      const span = Math.max(
        1,
        global.axisSpanForUnitWidth?.(model, options) ?? model.total + 1
      );
      return Math.max(20, Math.min(48, Math.floor((box - 72) / span)));
    }

    function drawStatic(equation) {
      const eq = normalizePrompt(equation);
      const model = global.parseAamEquation(eq);
      const unitWidth = unitWidthFor(model);
      const { bodyEl } = getIllustrationTarget();
      global.fname(eq, bodyEl, {
        ...options,
        unitWidth,
        skipContainerMinHeight: true,
      });
    }

    function drawWithAnimation(equation) {
      stopAnim();
      const eq = normalizePrompt(equation);
      const { bodyEl } = getIllustrationTarget();
      activeAnim = global.runFnameAnimation(eq, bodyEl, {
        ...options,
        skipContainerMinHeight: true,
      });
      return activeAnim.promise.then((result) => {
        activeAnim = null;
        if (result?.error) throw result.error;
        return result;
      });
    }

    function applyIllustration(equation) {
      if (options.pornesteAnimatiaAutomat && global.runFnameAnimation) {
        return drawWithAnimation(equation);
      }
      drawStatic(equation);
      return Promise.resolve();
    }

    function showIllustration(equation) {
      const { bodyEl } = getIllustrationTarget();
      if (!bodyEl) return Promise.resolve();

      return new Promise((resolve, reject) => {
        pendingRender = { equation, resolve, reject };
        clearFadeTimer();
        bodyEl.classList.add("is-fading");

        fadeTimer = setTimeout(() => {
          fadeTimer = null;
          const job = pendingRender;
          pendingRender = null;
          if (!job) {
            resolve();
            return;
          }

          stopAnim();
          bodyEl.replaceChildren();

          const shouldWait =
            options.asteaptaAnimatieInainteDeLift &&
            options.pornesteAnimatiaAutomat &&
            global.runFnameAnimation;

          const done = () => {
            bodyEl.classList.remove("is-fading");
            job.resolve();
          };

          if (shouldWait) {
            applyIllustration(job.equation).then(done).catch((err) => {
              bodyEl.classList.remove("is-fading");
              job.reject(err);
            });
          } else {
            applyIllustration(job.equation).catch(() => {});
            done();
          }
        }, FADE_MS);
      });
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
          redrawCurrentEquation();
        });
        const span = document.createElement("span");
        span.textContent = label;
        row.append(input, span);
        panelEl.appendChild(row);

        if (key === "showAxaNumere") {
          const axisNote = document.createElement("p");
          axisNote.className = "control-panel-aam-axis-note";
          axisNote.textContent = "Axă numerelor: 0–total+1 (bază fixă)";
          panelEl.appendChild(axisNote);

          for (const [extKey, extLabel] of AXIS_EXTENSION_SWITCHES) {
            const extRow = document.createElement("label");
            extRow.className = "control-panel-aam-row control-panel-aam-row--indent";
            const extInput = document.createElement("input");
            extInput.type = "checkbox";
            extInput.checked = !!options[extKey];
            extInput.addEventListener("change", () => {
              options[extKey] = extInput.checked;
              redrawCurrentEquation();
            });
            const extSpan = document.createElement("span");
            extSpan.textContent = extLabel;
            extRow.append(extInput, extSpan);
            panelEl.appendChild(extRow);
          }
        }
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
        redrawCurrentEquation();
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

    function prepareRound(quiz, state) {
      if (!global.fname || !quiz?.getAamIllustration) {
        setPanelVisible(false);
        clearIllustrationBody();
        clearEquationMeta();
        return Promise.resolve();
      }

      const spec = quiz.getAamIllustration(state);
      if (!spec?.enabled) {
        setPanelVisible(false);
        clearIllustrationBody();
        clearEquationMeta();
        return Promise.resolve();
      }

      setPanelVisible(true);

      const equation = normalizePrompt(spec.equation ?? state?.prompt);
      if (!canParseAam(equation)) {
        clearIllustrationBody();
        clearEquationMeta();
        return Promise.resolve();
      }

      clearInactiveIllustrationBody();
      clearEquationMeta();
      const { hostEl } = getIllustrationTarget();
      hostEl.dataset.equation = equation;

      return showIllustration(equation);
    }

    function relayout() {
      const equation = getStoredEquation();
      clearIllustrationBody();
      clearEquationMeta();
      if (!equation || !canParseAam(equation)) return Promise.resolve();
      const { hostEl } = getIllustrationTarget();
      hostEl.dataset.equation = equation;
      return showIllustration(equation);
    }

    function reset() {
      clearIllustrationBody();
      clearEquationMeta();
      setPanelVisible(false);
    }

    buildControlPanel();
    setPanelVisible(false);

    return { prepareRound, relayout, reset };
  }

  global.AamArena = { create: createAamArena, normalizePrompt, canParseAam };
})(window);
