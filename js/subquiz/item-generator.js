(function (global) {
  "use strict";

  function normalizeItem(item) {
    if (!item || typeof item !== "object") return null;
    const options = Array.isArray(item.options) ? item.options.map(String) : [];
    const correctAnswer =
      item.correctAnswer ?? item.correct ?? options[item.correctIndex ?? -1];
    let correctIndex = Number.isInteger(item.correctIndex)
      ? item.correctIndex
      : options.findIndex((value) => String(value) === String(correctAnswer));

    if (correctIndex < 0 && correctAnswer != null) {
      options.unshift(String(correctAnswer));
      correctIndex = 0;
    }

    return {
      ...item,
      prompt: item.prompt ?? "-",
      promptHtml: item.promptHtml,
      options,
      correctAnswer,
      correctIndex: correctIndex < 0 ? 0 : correctIndex,
      metadata: item.metadata ?? {},
    };
  }

  function fromNext(next) {
    return {
      next(ctx = {}) {
        return normalizeItem(next(ctx));
      },
    };
  }

  function fromList(items, opts = {}) {
    let index = 0;
    const loop = opts.loop !== false;
    return fromNext(() => {
      if (!items.length) return null;
      if (index >= items.length) {
        if (!loop) return null;
        index = 0;
      }
      const item = items[index];
      index += 1;
      return item;
    });
  }

  function create(generator) {
    if (typeof generator === "function") return fromNext(generator);
    if (Array.isArray(generator)) return fromList(generator);
    if (generator && typeof generator.next === "function") {
      return {
        ...generator,
        next(ctx = {}) {
          return normalizeItem(generator.next(ctx));
        },
      };
    }
    throw new Error("ItemGenerator requires a function, list, or object with next().");
  }

  global.ItemGenerator = {
    create,
    fromNext,
    fromList,
    normalizeItem,
  };
})(window);
