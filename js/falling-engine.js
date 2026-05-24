(function (global) {
  "use strict";

  const ARENA_H = 420;
  const BOX_MIN = 112;
  const FALL_SPEED = 72;
  const RISE_SPEED = 140;
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

    function renderRound(state) {
      const fm = dom.fallingMainEl;
      if (state.questionFormat === "division-eq") {
        dom.topNumberEl.innerHTML = `<span class="q-a">${state.dividend}</span><span class="q-colon">:</span><span class="q-b">${state.divisor}</span><span class="q-eq">=</span><span class="q-q">?</span>`;
        fm?.classList.add("has-division-eq");
      } else {
        dom.topNumberEl.textContent = state.prompt ?? "—";
        fm?.classList.remove("has-division-eq");
      }

      dom.optionBtns.forEach((btn, i) => {
        btn.querySelector(".prime").textContent = state.options?.[i] ?? "—";
        btn.classList.remove("selected");
      });
      dom.fallingPrimes.forEach((el, i) => {
        el.textContent = state.options?.[i] ?? "—";
        el.classList.remove("highlight");
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
      dom.optionBtns.forEach((b) => b.classList.remove("selected"));
      dom.fallingPrimes.forEach((el) => el.classList.remove("highlight"));
    }

    function finishRun(result) {
      if (result.gameComplete) {
        renderRound(result);
        config.onProgressUpdate?.();
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        dom.playPauseBtn.disabled = true;
        setInputEnabled(false);
        return;
      }

      const delay = result.levelAdvanced ? LEVEL_ADV_MS : RUN_DONE_MS;
      setTimeout(() => {
        if (getQuiz().isCompleted()) return;
        startRound(result.nextRound ?? getQuiz().beginRound(getQuiz().pickNextRound()));
      }, delay);
    }

    function applyAnswerResult(result) {
      if (result.flash) flash(result.flash);
      if (result.message !== undefined) dom.messageEl.textContent = result.message;
      if (result.banner) config.showBanner(result.banner);
      dom.messageEl.classList.toggle("win", result.flash === "win");

      if (result.resetFall) setFallPosition(0);

      if (result.bounce) {
        bouncing = true;
        dom.falling.classList.add("bounce");
        setFallPosition(Math.max(0, fallY - BOUNCE_UP));
        setTimeout(() => {
          bouncing = false;
          dom.falling.classList.remove("bounce");
        }, 380);
      }

      if (result.runComplete) {
        renderRound(result);
        config.onProgressUpdate?.();
        finishRun(result);
        return;
      }

      if (result.prompt || result.questionFormat || result.options) renderRound(result);
      if (!result.gameComplete) setInputEnabled(true);
      config.onProgressUpdate?.();
    }

    function resolveChoice(index) {
      dom.rising.classList.add("hidden");
      animating = false;
      applyAnswerResult(getQuiz().onAnswer(index));
    }

    function handleBottomMiss() {
      if (locked || getQuiz().isCompleted()) return;
      cancelRisingAnimation();
      applyAnswerResult(getQuiz().onTimeout());
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
      cancelRisingAnimation();
      setFallPosition(0);
      dom.falling.classList.remove("bounce");
      dom.rising.classList.add("hidden");
      renderRound(state);
      setInputEnabled(true);
      dom.messageEl.classList.remove("win");
      dom.playPauseBtn.disabled = false;
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
