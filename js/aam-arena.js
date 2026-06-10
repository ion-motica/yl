(function (global) {
  "use strict";

  const FADE_MS = 200;

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
      pornesteAnimatiaAutomat: true,
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
    const ilustrareBodyEl =
      dom.illustrareBodyEl ||
      ilustrareEl?.querySelector(".arena-ilustrare-body");
    const panelEl = dom.aamControlPanelEl;

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
      if (!ilustrareBodyEl) return;
      ilustrareBodyEl.classList.remove("is-fading");
      ilustrareBodyEl.replaceChildren();
      ilustrareBodyEl.style.minHeight = "";
      lastIllustrationKey = null;
    }

    function unitWidthFor(model) {
      const box = ilustrareEl?.clientWidth || options.viewWidth;
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
      const drawn = global.fname(eq, ilustrareBodyEl, { ...options, unitWidth });
      if (drawn?.height) ilustrareBodyEl.style.minHeight = `${drawn.height}px`;
    }

    function drawWithAnimation(equation) {
      stopAnim();
      const eq = normalizePrompt(equation);
      activeAnim = global.runFnameAnimation(eq, ilustrareBodyEl, options);
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

    function showIllustration(equation, key) {
      return new Promise((resolve, reject) => {
        pendingRender = { equation, key, resolve, reject };
        clearFadeTimer();
        ilustrareBodyEl.classList.add("is-fading");

        fadeTimer = setTimeout(() => {
          fadeTimer = null;
          const job = pendingRender;
          pendingRender = null;
          if (!job) {
            resolve();
            return;
          }

          stopAnim();
          ilustrareBodyEl.replaceChildren();

          const shouldWait =
            options.asteaptaAnimatieInainteDeLift &&
            options.pornesteAnimatiaAutomat &&
            global.runFnameAnimation;

          const done = () => {
            lastIllustrationKey = job.key;
            ilustrareBodyEl.classList.remove("is-fading");
            job.resolve();
          };

          if (shouldWait) {
            applyIllustration(job.equation).then(done).catch((err) => {
              ilustrareBodyEl.classList.remove("is-fading");
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
          if (lastIllustrationKey != null) {
            const eq = ilustrareEl?.dataset.equation;
            if (eq) applyIllustration(eq).catch(() => {});
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
          const eq = ilustrareEl?.dataset.equation;
          if (eq) applyIllustration(eq).catch(() => {});
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

    function prepareRound(quiz, state) {
      if (!global.fname || !quiz?.getAamIllustration) {
        setPanelVisible(false);
        clearIllustrationBody();
        ilustrareEl?.removeAttribute("data-equation");
        return Promise.resolve();
      }

      const spec = quiz.getAamIllustration(state);
      if (!spec?.enabled) {
        setPanelVisible(false);
        clearIllustrationBody();
        ilustrareEl?.removeAttribute("data-equation");
        return Promise.resolve();
      }

      setPanelVisible(true);

      const equation = normalizePrompt(spec.equation ?? state?.prompt);
      if (!canParseAam(equation)) {
        clearIllustrationBody();
        ilustrareEl?.removeAttribute("data-equation");
        return Promise.resolve();
      }

      const key = spec.illustrationKey ?? equation;
      ilustrareEl.dataset.equation = equation;

      if (key === lastIllustrationKey) return Promise.resolve();

      return showIllustration(equation, key);
    }

    function reset() {
      clearIllustrationBody();
      ilustrareEl?.removeAttribute("data-equation");
      setPanelVisible(false);
    }

    function invalidateKey() {
      lastIllustrationKey = null;
    }

    buildControlPanel();
    setPanelVisible(false);

    return { prepareRound, reset, invalidateKey };
  }

  global.AamArena = { create: createAamArena, normalizePrompt, canParseAam };
})(window);
