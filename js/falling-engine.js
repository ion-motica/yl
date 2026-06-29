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
  const BOUNCE_UP = 48;
  // După bounce, liftul trebuie să ajungă clar deasupra jumătății traseului
  // (y = fracție × travelSpan; sub 0.5 = în jumătatea de sus).
  const BOUNCE_MIN_FRAC = 0.4;
  const FLASH_MS = 420;
  const RUN_DONE_MS = 450;
  const LEVEL_ADV_MS = 1400;
  const LIFT_BG_OPACITY_DEFAULT = 0.8;

  function FallingEngine(config) {
    const dom = config.dom;
    const getQuiz = config.getQuiz;
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

    // Reduce font size pas cu pas până când textul încape pe un singur rând.
    function fitNumberText(el) {
      el.style.fontSize = "";           // resetează la valoarea CSS (2.5rem)
      const container = el.parentElement;
      if (!container) return;
      let fs = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > container.clientWidth && fs > 14) {
        fs -= 2;
        el.style.fontSize = fs + "px";
      }
    }

    function nowMs() {
      if (global.performance && typeof global.performance.now === "function") {
        return global.performance.now();
      }
      return Date.now();
    }

    function attemptMeta(extra = {}) {
      return {
        at: new Date().toISOString(),
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

    function normalizeResult(result = {}) {
      const normalized = normalizeRoundState(result);
      if (!normalized.outcome) {
        if (normalized.runComplete) normalized.outcome = "run-complete";
        else if (normalized.correct === false) normalized.outcome = "wrong-answer";
        else if (normalized.resetFall && normalized.flash === "wrong") normalized.outcome = "timeout";
        else if (normalized.bounce) normalized.outcome = "step-correct";
        else normalized.outcome = "round";
      }

      normalized.correct =
        normalized.correct ?? !["wrong-answer", "timeout"].includes(normalized.outcome);
      normalized.runComplete =
        Boolean(normalized.runComplete) || normalized.outcome === "run-complete";
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
      if (state.questionFormat === "division-eq") {
        return state.revealedQuotient == null && !String(state.promptHtml ?? "").includes("q-correct");
      }
      const raw = String(state.prompt ?? "");
      if (raw.includes("?")) return true;
      const html = String(state.promptHtml ?? "");
      return html.includes("q-mark") || html.includes("q-q");
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
      if (a.questionFormat === "division-eq") {
        return a.dividend === b.dividend && a.divisor === b.divisor;
      }
      return String(a.prompt) === String(b.prompt);
    }

    function buildRevealedState(state, answer) {
      const ans = String(answer ?? "").trim();
      const mark = `<span class="q-correct">${ans}</span>`;
      const revealed = { ...state, answerRevealed: true };

      if (state.questionFormat === "singapore-bond") {
        revealed.bondRevealedAddend = ans;
        return revealed;
      }
      if (state.questionFormat === "division-eq") {
        revealed.revealedQuotient = ans;
        revealed.promptHtml = `<span class="q-a">${state.dividend}</span><span class="q-colon">:</span><span class="q-b">${state.divisor}</span><span class="q-eq">=</span>${mark}`;
        return revealed;
      }

      const raw = String(state.prompt ?? "");
      if (raw.includes("=?")) {
        revealed.prompt = raw.replace("=?", `=${ans}`);
        revealed.promptHtml = raw.replace("=?", `=${mark}`);
      } else if (raw.includes("?")) {
        revealed.prompt = raw.replace("?", ans);
        revealed.promptHtml = raw.replace("?", mark);
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

    function renderRound(state) {
      state = normalizeRoundState(state);
      global.AsnwStars?.syncVisibility?.(dom.falling);
      lastRoundState = state;
      dom.fallingMainEl?.classList.remove("has-division-eq", "has-singapore-bond");
      dom.arenaQuestionSlotEl?.classList.remove("has-division-eq", "has-singapore-bond");
      const fm = getQuestionSlotEl() || dom.fallingMainEl;
      if (state.questionFormat === "singapore-bond") {
        const historyHtml = (state.bondHistory || [])
          .map((line) => `<div class="singapore-history-line">${line}</div>`)
          .join("");
        dom.topNumberEl.innerHTML = `<div class="singapore-prompt">${
          historyHtml ? `<div class="singapore-history">${historyHtml}</div>` : ""
        }<div class="singapore-current">${singaporeBondLine(state)}</div></div>`;
        fm?.classList.add("has-singapore-bond");
      } else if (state.questionFormat === "division-eq") {
        if (state.promptHtml) {
          dom.topNumberEl.innerHTML = state.promptHtml;
        } else {
          dom.topNumberEl.innerHTML = `<span class="q-a">${state.dividend}</span><span class="q-colon">:</span><span class="q-b">${state.divisor}</span><span class="q-eq">=</span><span class="q-q">?</span>`;
        }
        fm?.classList.add("has-division-eq");
      } else {
        if (state.promptHtml !== undefined) {
          dom.topNumberEl.innerHTML = state.promptHtml ?? "—";
        } else {
          const raw = String(state.prompt ?? "—");
          if (raw.includes("?")) {
            dom.topNumberEl.innerHTML = raw.replace(
              /\?/g,
              '<span class="q-mark"> ? </span>'
            );
          } else {
            dom.topNumberEl.textContent = raw;
          }
        }
        fm?.classList.remove("has-division-eq", "has-singapore-bond");
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

    function finishRun(result) {
      if (result.gameComplete) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        dom.playPauseBtn.disabled = true;
        setInputEnabled(false);
        return;
      }

      const delay =
        result.runDelayMs ??
        (result.levelAdvanced ? LEVEL_ADV_MS : RUN_DONE_MS);
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

    function applyImmediateAnswerFeedback(result, wrongPick) {
      if (!wrongPick && result.flash) flash(result.flash);
      if (result.message !== undefined) dom.messageEl.textContent = result.message;
      if (result.banner && !result.promptHoldMs) config.showBanner(result.banner);
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

    function applyContinueStep(result) {
      const next = normalizeResult(result.continueStep);
      if (next.resetFall) setFallPosition(0);

      if (next.runComplete) {
        if (next.banner) config.showBanner(next.banner);
        config.onProgressUpdate?.();
        finishRun(next);
        return;
      }

      renderRound(next);
      if (!getQuiz().isCompleted()) setInputEnabled(true);
      config.onProgressUpdate?.();
    }

    function applyAnswerResultTail(result, pickedIndex, wrongPick, shouldRender, afterEngineReveal) {
      if (shouldRender && !wrongPick) renderRound(result);

      if (result.promptHoldMs != null && result.continueStep !== undefined) {
        if (afterEngineReveal) {
          setInputEnabled(false);
          applyContinueStep(result);
          return;
        }
        setInputEnabled(false);
        setTimeout(() => applyContinueStep(result), result.promptHoldMs);
        return;
      }

      if (result.runComplete) {
        config.onProgressUpdate?.();
        finishRun(result);
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

    function applyAnswerResult(result, pickedIndex) {
      const shouldRender = hasRenderableState(result);
      const beforeState = lastRoundState;
      result = normalizeResult(result);
      const wrongPick = pickedIndex != null && result.outcome === "wrong-answer";
      const timedOut = result.outcome === "timeout";
      const starCorrect = !wrongPick && !timedOut && result.correct !== false;
      const chosenAnswer =
        pickedIndex != null
          ? dom.optionBtns[pickedIndex]?.querySelector(".prime")?.textContent
          : null;

      global.AsnwOnboarding?.notifyAnswer?.({
        correct: starCorrect,
        answered: pickedIndex != null && !timedOut,
      });

      if (global.AsnwStars?.isActive?.()) {
        const subGoal = global.AsnwStars.onAnswer({ correct: starCorrect });
        if (subGoal && typeof config.onSubGoal === "function") {
          result = config.onSubGoal(result) ?? result;
          if (result.holdFallDuringDelay) {
            fallHeld = true;
            setInputEnabled(false);
          }
        }
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
        const revealState = buildRevealedState(beforeState, chosenAnswer);
        renderRound({
          ...revealState,
          options: beforeState.options,
          correctIndex: beforeState.correctIndex,
        });
        const holdMs =
          result.promptHoldMs ?? result.runDelayMs ?? DEFAULT_REVEAL_HOLD_MS;
        setInputEnabled(false);
        setTimeout(() => {
          applyAnswerResultTail(result, pickedIndex, wrongPick, shouldRender, true);
        }, holdMs);
        return;
      }

      applyAnswerResultTail(result, pickedIndex, wrongPick, shouldRender, false);
    }

    function resolveChoice(index) {
      hideRising();
      animating = false;
      applyAnswerResult(getQuiz().onAnswer(index, attemptMeta()), index);
    }

    function handleBottomMiss() {
      if (locked || getQuiz().isCompleted()) return;
      cancelRisingAnimation();
      applyAnswerResult(getQuiz().onTimeout(attemptMeta({ timedOut: true })));
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
      roundStartedAt = nowMs();
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
