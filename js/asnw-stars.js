(function (global) {
  "use strict";

  const STAR_COUNT = 3;
  const SUB_GOAL_BANNER = "Bravo! Nivelul urmator!";

  let litCount = 0;
  let rowEl = null;

  function isActive() {
    return global.AsnwProfile?.isEffective?.("starsProgress") === true;
  }

  function ensureRow(fallingEl) {
    const inner = fallingEl?.querySelector(".falling-inner");
    const main = inner?.querySelector("#falling-main");
    if (!inner || !main) return null;

    if (rowEl?.parentElement !== inner) {
      rowEl = document.createElement("div");
      rowEl.id = "asnw-stars-row";
      rowEl.className = "asnw-stars-row";
      rowEl.setAttribute("aria-label", "Progres stelute");
      for (let i = 0; i < STAR_COUNT; i++) {
        const star = document.createElement("span");
        star.className = "asnw-star";
        star.dataset.index = String(i);
        rowEl.appendChild(star);
      }
      inner.insertBefore(rowEl, main);
    }
    return rowEl;
  }

  function render() {
    if (!rowEl) return;
    rowEl.querySelectorAll(".asnw-star").forEach((el, i) => {
      el.classList.toggle("lit", i < litCount);
    });
  }

  function syncVisibility(fallingEl) {
    if (!isActive()) {
      if (rowEl) {
        rowEl.hidden = true;
        rowEl.setAttribute("aria-hidden", "true");
      }
      return;
    }
    ensureRow(fallingEl);
    if (rowEl) {
      rowEl.hidden = false;
      rowEl.setAttribute("aria-hidden", "false");
    }
    render();
  }

  /**
   * @param {{ correct: boolean }} outcome
   * @returns {boolean} true dacă s-a atins sub-goal (3 corecte consecutive)
   */
  function onAnswer(outcome) {
    if (!isActive()) return false;

    if (outcome.correct) {
      if (litCount < STAR_COUNT) litCount++;
      render();
      if (litCount >= STAR_COUNT) {
        litCount = 0;
        render();
        return true;
      }
      return false;
    }

    if (litCount > 0) {
      litCount--;
      render();
    }
    return false;
  }

  function reset() {
    litCount = 0;
    render();
  }

  function getLitCount() {
    return litCount;
  }

  global.AsnwStars = {
    SUB_GOAL_BANNER,
    STAR_COUNT,
    isActive,
    ensureRow,
    syncVisibility,
    onAnswer,
    reset,
    getLitCount,
  };
})(window);
