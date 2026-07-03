(function (global) {
  "use strict";

  const QUIZ_ID = "sub-sau-langa-radical";
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 3;
  const CONSECUTIVE_NEEDED = 5;
  const HINT = "Alege raspunsul corect.";

  const K_VALUES = [2, 3, 4];
  const N_VALUES = [2, 3];
  const ORDER_FACTORS_LIKE_LEFT_SIDE = true;
  const FALLBACK_TRAPS = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 16, 18, 24, 27, 32];

  const DIRECTION = {
    IN: "in",
    OUT: "out",
  };

  const FORMS_BY_LEVEL = {
    1: ["L1-IN-1", "L1-IN-2", "L1-IN-3", "L1-OUT-1", "L1-OUT-2", "L1-OUT-3"],
    2: ["L2-IN-1", "L2-IN-2", "L2-OUT-1", "L2-OUT-2", "L2-OUT-3"],
    3: ["L3-IN-1", "L3-OUT-1", "L3-OUT-2", "L3-OUT-3"],
  };

  function qMarkHtml() {
    return '<span class="q-mark">?</span>';
  }

  function renderSqrt(contentHtml) {
    return (
      '<span class="sqrt" aria-label="radical">' +
      '<span class="sqrt-sign">√</span>' +
      `<span class="sqrt-radicand">${contentHtml}</span>` +
      "</span>"
    );
  }

  function renderPower(baseHtml, expHtml) {
    return `${baseHtml}<sup>${expHtml}</sup>`;
  }

  function radicalProduct(kPartHtml, nPartHtml) {
    if (ORDER_FACTORS_LIKE_LEFT_SIDE) return `${kPartHtml} · ${nPartHtml}`;
    return `${nPartHtml} · ${kPartHtml}`;
  }

  function radicalProductText(kPart, nPart) {
    if (ORDER_FACTORS_LIKE_LEFT_SIDE) return `${kPart} * ${nPart}`;
    return `${nPart} * ${kPart}`;
  }

  function leftSide(k, n) {
    return `${k} · ${renderSqrt(String(n))}`;
  }

  function valuesFor(k, n) {
    const K = k * k;
    const P = n * K;
    return { K, P };
  }

  function pickRandom(items) {
    const { randomInt } = global.GameUtils;
    return items[randomInt(0, items.length - 1)];
  }

  function pickNForK(k) {
    return pickRandom(N_VALUES.filter((value) => value !== k));
  }

  function buildPromptHtml(form, k, n) {
    const { K, P } = valuesFor(k, n);
    const left = leftSide(k, n);

    if (form === "L1-IN-1") return `${left} = ${renderSqrt(radicalProduct(renderPower(k, 2), qMarkHtml()))}`;
    if (form === "L1-IN-2") return `${left} = ${renderSqrt(radicalProduct(renderPower(qMarkHtml(), 2), n))}`;
    if (form === "L1-IN-3") return `${left} = ${renderSqrt(radicalProduct(`${k}<sup>${qMarkHtml()}</sup>`, n))}`;
    if (form === "L1-OUT-1") return `${renderSqrt(radicalProduct(renderPower(k, 2), qMarkHtml()))} = ${left}`;
    if (form === "L1-OUT-2") return `${renderSqrt(radicalProduct(renderPower(qMarkHtml(), 2), n))} = ${left}`;
    if (form === "L1-OUT-3") return `${renderSqrt(radicalProduct(`${k}<sup>${qMarkHtml()}</sup>`, n))} = ${left}`;

    if (form === "L2-IN-1") return `${left} = ${renderSqrt(radicalProduct(qMarkHtml(), n))}`;
    if (form === "L2-IN-2") return `${left} = ${renderSqrt(radicalProduct(K, qMarkHtml()))}`;
    if (form === "L2-OUT-1") return `${renderSqrt(radicalProduct(K, n))} = ${qMarkHtml()} · ${renderSqrt(String(n))}`;
    if (form === "L2-OUT-2") return `${renderSqrt(radicalProduct(K, qMarkHtml()))} = ${left}`;
    if (form === "L2-OUT-3") return `${renderSqrt(radicalProduct(qMarkHtml(), n))} = ${left}`;

    if (form === "L3-IN-1") return `${left} = ${renderSqrt(qMarkHtml())}`;
    if (form === "L3-OUT-1") return `${renderSqrt(String(P))} = ${qMarkHtml()} · ${renderSqrt(String(n))}`;
    if (form === "L3-OUT-2") return `${renderSqrt(String(P))} = ${k} · ${renderSqrt(qMarkHtml())}`;
    if (form === "L3-OUT-3") return `${renderSqrt(qMarkHtml())} = ${left}`;

    return "-";
  }

  function buildPromptText(form, k, n) {
    const { K, P } = valuesFor(k, n);
    const left = `${k} * sqrt(${n})`;

    if (form === "L1-IN-1") return `${left} = sqrt(${radicalProductText(`${k}^2`, "?")})`;
    if (form === "L1-IN-2") return `${left} = sqrt(${radicalProductText("?^2", n)})`;
    if (form === "L1-IN-3") return `${left} = sqrt(${radicalProductText(`${k}^?`, n)})`;
    if (form === "L1-OUT-1") return `sqrt(${radicalProductText(`${k}^2`, "?")}) = ${left}`;
    if (form === "L1-OUT-2") return `sqrt(${radicalProductText("?^2", n)}) = ${left}`;
    if (form === "L1-OUT-3") return `sqrt(${radicalProductText(`${k}^?`, n)}) = ${left}`;

    if (form === "L2-IN-1") return `${left} = sqrt(${radicalProductText("?", n)})`;
    if (form === "L2-IN-2") return `${left} = sqrt(${radicalProductText(K, "?")})`;
    if (form === "L2-OUT-1") return `sqrt(${radicalProductText(K, n)}) = ? * sqrt(${n})`;
    if (form === "L2-OUT-2") return `sqrt(${radicalProductText(K, "?")}) = ${left}`;
    if (form === "L2-OUT-3") return `sqrt(${radicalProductText("?", n)}) = ${left}`;

    if (form === "L3-IN-1") return `${left} = sqrt(?)`;
    if (form === "L3-OUT-1") return `sqrt(${P}) = ? * sqrt(${n})`;
    if (form === "L3-OUT-2") return `sqrt(${P}) = ${k} * sqrt(?)`;
    if (form === "L3-OUT-3") return `sqrt(?) = ${left}`;

    return "-";
  }

  function answerInfo(form, k, n) {
    const { K, P } = valuesFor(k, n);

    if (form === "L1-IN-1" || form === "L1-OUT-1" || form === "L2-IN-2" || form === "L2-OUT-2") {
      return { value: n, kind: "n" };
    }
    if (form === "L1-IN-2" || form === "L1-OUT-2" || form === "L2-OUT-1" || form === "L3-OUT-1") {
      return { value: k, kind: "k" };
    }
    if (form === "L1-IN-3" || form === "L1-OUT-3") {
      return { value: 2, kind: "exp" };
    }
    if (form === "L2-IN-1" || form === "L2-OUT-3") {
      return { value: K, kind: "K" };
    }
    if (form === "L3-IN-1" || form === "L3-OUT-3") {
      return { value: P, kind: "P" };
    }
    if (form === "L3-OUT-2") {
      return { value: n, kind: "n" };
    }

    return { value: n, kind: "n" };
  }

  function uniquePositiveNumbers(correct, candidates) {
    const used = new Set([correct]);
    const traps = [];

    function add(value) {
      if (!Number.isInteger(value) || value <= 0 || used.has(value)) return;
      used.add(value);
      traps.push(value);
    }

    for (const value of candidates) {
      if (traps.length >= 2) break;
      add(value);
    }

    for (const value of FALLBACK_TRAPS) {
      if (traps.length >= 2) break;
      add(value);
    }

    return traps.slice(0, 2);
  }

  function trapsForAnswer(kind, correct, k, n) {
    const { K, P } = valuesFor(k, n);

    if (kind === "n") {
      return uniquePositiveNumbers(correct, [...N_VALUES, 5, 6]);
    }
    if (kind === "k") {
      return uniquePositiveNumbers(correct, K_VALUES);
    }
    if (kind === "exp") {
      return [1, 3];
    }
    if (kind === "K") {
      return uniquePositiveNumbers(correct, [k, n * k, 4, 9, 16]);
    }
    if (kind === "P") {
      return uniquePositiveNumbers(correct, [n * k, K, P + n, P - k]);
    }

    return uniquePositiveNumbers(correct, FALLBACK_TRAPS);
  }

  function signatureFor(level, form, k, n) {
    return `${level}|${form}|${k}|${n}`;
  }

  function directionForForm(form) {
    return form.includes("-IN-") ? DIRECTION.IN : DIRECTION.OUT;
  }

  function buildQuestion(level, lastQuestionSignature) {
    const { shuffle } = global.GameUtils;
    let question = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const k = pickRandom(K_VALUES);
      const n = pickNForK(k);
      const form = pickRandom(FORMS_BY_LEVEL[level]);
      const signature = signatureFor(level, form, k, n);
      const { value, kind } = answerInfo(form, k, n);
      const traps = trapsForAnswer(kind, value, k, n);
      const options = shuffle([String(value), String(traps[0]), String(traps[1])]);
      const promptHtml = buildPromptHtml(form, k, n);
      question = {
        level,
        direction: directionForForm(form),
        form,
        k,
        n,
        answerKind: kind,
        correct: value,
        signature,
        prompt: promptHtml,
        promptHtml,
        options,
        correctIndex: options.indexOf(String(value)),
      };
      if (signature !== lastQuestionSignature) break;
    }

    return question;
  }

  function createQuiz(config = {}) {
    const ProgressDisplay = global.ProgressDisplay;

    let currentLevel = MIN_LEVEL;
    let consecutiveCorrect = 0;
    let lastQuestionSignature = null;
    let current = null;
    let gameCompleted = false;

    function getLevelLabel(targetLevel = currentLevel) {
      return `Nivel ${targetLevel}`;
    }

    function getLevelButtonTitle(targetLevel) {
      return `Nivel ${targetLevel}`;
    }

    function roundView(extra = {}) {
      return {
        prompt: current?.prompt ?? "-",
        promptHtml: current?.promptHtml,
        options: current ? [...current.options] : ["-", "-", "-"],
        correctIndex: current?.correctIndex ?? 0,
        hintMessage: HINT,
        ...extra,
      };
    }

    function pickNewQuestion() {
      current = buildQuestion(currentLevel, lastQuestionSignature);
      lastQuestionSignature = current.signature;
      return current;
    }

    function resetLevelState() {
      consecutiveCorrect = 0;
      current = null;
    }

    function completeGame() {
      gameCompleted = true;
      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        gameComplete: true,
        flash: "win",
        banner: "Felicitari! Ai terminat quizul!",
        message: "Felicitari! Ai terminat quizul!",
        ...roundView(),
      };
    }

    function advanceLevel() {
      if (currentLevel >= MAX_LEVEL) {
        return completeGame();
      }

      currentLevel += 1;
      consecutiveCorrect = 0;
      pickNewQuestion();

      return {
        outcome: "run-complete",
        correct: true,
        runComplete: true,
        levelAdvanced: true,
        flash: "win",
        banner: getLevelLabel(),
        message: "5 corecte consecutive! Next level!",
        nextRound: roundView(),
      };
    }

    function afterAnswer(isCorrect) {
      if (!isCorrect) {
        consecutiveCorrect = 0;
        pickNewQuestion();
        return {
          outcome: "step-correct",
          correct: false,
          flash: "wrong",
          resetFall: true,
          message: "Nu e corect.",
          ...roundView(),
        };
      }

      consecutiveCorrect += 1;

      if (consecutiveCorrect >= CONSECUTIVE_NEEDED) {
        return advanceLevel();
      }

      pickNewQuestion();
      return {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: "Corect!",
        ...roundView(),
      };
    }

    return {
      getQuizId: () => config.quizId ?? QUIZ_ID,
      getLevel: () => currentLevel,
      getMinLevel: () => MIN_LEVEL,
      getMaxLevel: () => MAX_LEVEL,
      getLevelLabel: () => getLevelLabel(currentLevel),
      getLevelButtonTitle,

      getProgressDisplay() {
        const percent = Math.round((consecutiveCorrect / CONSECUTIVE_NEEDED) * 100);
        return {
          green: ProgressDisplay.greenPercent(Math.min(100, percent)),
          red: ProgressDisplay.redNone(),
        };
      },

      isCompleted: () => gameCompleted,
      setCompleted: (value) => {
        gameCompleted = Boolean(value);
      },

      resetLevelState,

      switchLevel(nextLevel) {
        currentLevel = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, nextLevel));
        gameCompleted = false;
        resetLevelState();
        return null;
      },

      pickNextRound() {
        return pickNewQuestion();
      },

      beginRound(next) {
        current = next ?? pickNewQuestion();
        return roundView();
      },

      onTimeout() {
        return {
          outcome: "round",
          resetFall: true,
          ...roundView(),
        };
      },

      onAnswer(index) {
        const chosen = Number(current.options[index]);
        const isCorrect = chosen === current.correct;
        return afterAnswer(isCorrect);
      },
    };
  }

  global.SubSauLangaRadicalQuiz = { create: createQuiz, buildQuestion };

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: "Sub sau lângă radical v1",
    description: "k si n random mici, forme pe 3 niveluri, 5 raspunsuri corecte consecutive pentru avans.",
    order: -4,
    gestionareGreseli: { activ: false },
    create(meta) {
      return global.SubSauLangaRadicalQuiz.create({ quizId: meta.id });
    },
  });
})(window);
