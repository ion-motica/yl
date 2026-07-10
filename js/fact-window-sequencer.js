(function (global) {
  "use strict";

  function defaultRandom() {
    return Math.random();
  }

  function uniqueSorted(values) {
    return [...new Set((values || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  }

  function range(min, max) {
    const start = Number(min);
    const end = Number(max);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  function shuffleWithRandom(values, random = defaultRandom) {
    const items = [...values];
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.max(0, Math.min(i, Math.floor(random() * (i + 1))));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }

  function avoidImmediateRepeat(items, lastValue) {
    if (items.length <= 1 || items[0] !== lastValue) return items;
    const swapIndex = items.findIndex((value) => value !== lastValue);
    if (swapIndex > 0) {
      [items[0], items[swapIndex]] = [items[swapIndex], items[0]];
    }
    return items;
  }

  function createCycle(options = {}) {
    const random = typeof options.random === "function" ? options.random : defaultRandom;
    const values = uniqueSorted(options.values);
    let bag = [];
    let lastValue = null;

    function refill() {
      bag = avoidImmediateRepeat(shuffleWithRandom(values, random), lastValue);
    }

    return {
      next() {
        if (!values.length) return null;
        if (!bag.length) refill();
        const picked = bag.shift();
        lastValue = picked;
        return picked;
      },
      values: () => [...values],
    };
  }

  function createSlidingWindow(options = {}) {
    const random = typeof options.random === "function" ? options.random : defaultRandom;
    const windowSize = Math.max(1, Number(options.windowSize) || 5);
    const values = uniqueSorted(options.values || range(options.min, options.max));
    const maxStartIndex = Math.max(0, values.length - windowSize);
    let startIndex = 0;
    let bag = [];
    let lastValue = null;

    function currentWindow() {
      return values.slice(startIndex, startIndex + windowSize);
    }

    function refill() {
      const windowValues = currentWindow();
      if (windowValues.length <= 1) {
        bag = [...windowValues];
        return;
      }

      const lowest = windowValues[0];
      const rest = shuffleWithRandom(windowValues.slice(1), random);
      const maxLowestIndex = Math.min(2, rest.length);
      const lowestIndex = Math.floor(random() * (maxLowestIndex + 1));
      bag = [...rest];
      bag.splice(lowestIndex, 0, lowest);
      bag = avoidImmediateRepeat(bag, lastValue);
    }

    function advanceIfLowestWasWorked(picked) {
      const lowest = values[startIndex];
      if (picked !== lowest || startIndex >= maxStartIndex) return;
      startIndex += 1;
      bag = [];
    }

    return {
      next() {
        if (!values.length) return null;
        if (!bag.length) refill();
        const picked = bag.shift();
        lastValue = picked;
        advanceIfLowestWasWorked(picked);
        return picked;
      },
      currentWindow,
      values: () => [...values],
    };
  }

  global.FactWindowSequencer = {
    createCycle,
    createSlidingWindow,
  };
})(window);
