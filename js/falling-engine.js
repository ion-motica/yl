(function (global) {
  "use strict";

  const ARENA_H = 420;
  const BOX_MIN = 112;
  const FALL_SPEED = 54;
  const RISE_SPEED = 240;
  const BOUNCE_UP = 48;
  const FLASH_MS = 420;
  const RUN_DONE_MS = 450;
  const LEVEL_ADV_MS = 1400;

  function FallingEngine(config) {
    const dom = config.dom;
    const getQuiz = config.getQuiz;
    let fallY = 0;
    let boxH = BOX_MIN;
    let animating = false;
    let locked = false;
    let bouncing = false;
    let paused = false;
    let rafId = null;
    let roundStartedAt = null;
    /** Indici greșiți pe același număr (centrul) — rămân gri până la răspuns corect. */
    const wrongPicksThisStep = new Set();

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

    function syncBoxHeight() {
      boxH = Math.max(BOX_MIN, Math.ceil(dom.falling.getBoundingClientRect().height));
    }

    function setFallPosition(y) {
      fallY = y;
      dom.falling.style.top = `${y}px`;
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

    function renderRound(state) {
      state = normalizeRoundState(state);
      const fm = dom.fallingMainEl;
      if (state.questionFormat === "division-eq") {
        dom.topNumberEl.innerHTML = `<span class="q-a">${state.dividend}</span><span class="q-colon">:</span><span class="q-b">${state.divisor}</span><span class="q-eq">=</span><span class="q-q">?</span>`;
        fm?.classList.add("has-division-eq");
      } else {
        if (state.promptHtml !== undefined) {
          dom.topNumberEl.innerHTML = state.promptHtml ?? "—";
        } else {
          dom.topNumberEl.textContent = state.prompt ?? "—";
        }
        fm?.classList.remove("has-division-eq");
      }

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

      syncBoxHeight();
      if (state.hintMessage) dom.messageEl.textContent = state.hintMessage;
      config.onRender?.(state);
    }

    function cancelRisingAnimation() {
      animating = false;
      dom.rising.classList.add("hidden");
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

      const delay = result.levelAdvanced ? LEVEL_ADV_MS : result.runDelayMs ?? RUN_DONE_MS;
      setTimeout(() => {
        if (getQuiz().isCompleted()) return;
        startRound(result.nextRound ?? getQuiz().beginRound(getQuiz().pickNextRound()));
      }, delay);
    }

    function hasRenderableState(result = {}) {
      return (
        result.prompt !== undefined ||
        result.promptHtml !== undefined ||
        result.questionFormat !== undefined ||
        result.options !== undefined ||
        result.divisionHistory !== undefined ||
        result.hintMessage !== undefined ||
        result.dividend !== undefined ||
        result.divisor !== undefined
      );
    }

    function applyAnswerResult(result, pickedIndex) {
      const shouldRender = hasRenderableState(result);
      result = normalizeResult(result);
      const wrongPick = pickedIndex != null && result.outcome === "wrong-answer";

      if (!wrongPick && result.flash) flash(result.flash);
      if (result.message !== undefined) dom.messageEl.textContent = result.message;
      if (result.banner) config.showBanner(result.banner);
      dom.messageEl.classList.toggle("win", result.flash === "win");

      if (result.resetFall) setFallPosition(0);

      if (result.bounce) {
        clearWrongMarks();
        bouncing = true;
        dom.falling.classList.add("bounce");
        setFallPosition(Math.max(0, fallY - BOUNCE_UP));
        setTimeout(() => {
          bouncing = false;
          dom.falling.classList.remove("bounce");
        }, 380);
      }

      if (shouldRender && !wrongPick) renderRound(result);

      if (result.promptHoldMs && result.continueStep) {
        setInputEnabled(false);
        setTimeout(() => {
          renderRound(normalizeRoundState(result.continueStep));
          if (!getQuiz().isCompleted()) setInputEnabled(true);
          config.onProgressUpdate?.();
        }, result.promptHoldMs);
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

    function resolveChoice(index) {
      dom.rising.classList.add("hidden");
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

      let riseY = ARENA_H - boxH;
      let localFallY = fallY;
      let lastStepTs = 0;

      const step = (ts) => {
        if (paused) {
          requestAnimationFrame(step);
          return;
        }
        if (!lastStepTs) lastStepTs = ts;
        const dt = Math.min((ts - lastStepTs) / 1000, 0.05);
        lastStepTs = ts;
        localFallY += FALL_SPEED * dt;
        riseY -= RISE_SPEED * dt;
        dom.falling.style.top = `${localFallY}px`;
        dom.rising.style.top = `${riseY}px`;

        if (riseY <= localFallY + boxH) {
          fallY = localFallY;
          dom.optionBtns[index].classList.remove("selected");
          dom.fallingPrimes[index]?.classList.remove("highlight");
          resolveChoice(index);
          return;
        }
        if (localFallY >= ARENA_H - boxH) {
          handleBottomMiss();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    function onPick(index) {
      if (locked || animating || paused || getQuiz().isCompleted()) return;
      animateRising(index);
    }

    function startRound(state) {
      state = normalizeRoundState(state);
      if (rafId == null) startFallLoop();
      cancelRisingAnimation();
      clearWrongMarks();
      setFallPosition(0);
      dom.falling.classList.remove("bounce");
      dom.rising.classList.add("hidden");
      renderRound(state);
      setInputEnabled(true);
      dom.messageEl.classList.remove("win");
      dom.playPauseBtn.disabled = false;
      roundStartedAt = nowMs();
    }

    function startFallLoop() {
      if (rafId) cancelAnimationFrame(rafId);
      let lastTs = 0;
      const tick = (ts) => {
        if (!lastTs) lastTs = ts;
        const dt = Math.min((ts - lastTs) / 1000, 0.05);
        lastTs = ts;
        if (!getQuiz().isCompleted() && !paused && !animating && !locked && !bouncing) {
          syncBoxHeight();
          fallY += FALL_SPEED * dt;
          if (fallY >= ARENA_H - boxH) {
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
      if (e.code === "Space") {
        e.preventDefault();
        dom.playPauseBtn.click();
        return;
      }
      if (["1", "2", "3"].includes(e.key)) onPick(Number(e.key) - 1);
    });

    return { startRound, startFallLoop, cancelRisingAnimation };
  }

  global.FallingEngine = FallingEngine;
})(window);
