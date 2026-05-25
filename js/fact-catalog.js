(function (global) {
  "use strict";

  const OPERATORS = {
    add: "+",
    sub: "-",
    mul: "*",
    div: "/",
  };

  const PROMPT_FORMS = {
    result: "result",
    missingLeft: "missing-left",
    missingRight: "missing-right",
  };

  const COMMUTATIVE = new Set(["add", "mul"]);

  function assertSupportedOperation(operation) {
    if (!OPERATORS[operation]) {
      throw new Error(`Unsupported fact operation: ${operation}`);
    }
  }

  function assertSupportedPromptForm(promptForm) {
    if (!Object.values(PROMPT_FORMS).includes(promptForm)) {
      throw new Error(`Unsupported fact prompt form: ${promptForm}`);
    }
  }

  function computeResult(operation, a, b) {
    switch (operation) {
      case "add":
        return a + b;
      case "sub":
        return a - b;
      case "mul":
        return a * b;
      case "div":
        return b === 0 ? NaN : a / b;
      default:
        throw new Error(`Unsupported fact operation: ${operation}`);
    }
  }

  function normalizeValues(operation, inputValues = {}) {
    const values = {
      a: Number(inputValues.a),
      b: Number(inputValues.b),
      result: Number(inputValues.result),
    };

    if (!Number.isFinite(values.a) || !Number.isFinite(values.b)) {
      throw new Error("Fact values must include finite a and b numbers.");
    }

    if (!Number.isFinite(values.result)) {
      values.result = computeResult(operation, values.a, values.b);
    }

    return values;
  }

  function buildPrompt(operation, promptForm, values) {
    const op = OPERATORS[operation];
    switch (promptForm) {
      case PROMPT_FORMS.result:
        return `${values.a}${op}${values.b}=?`;
      case PROMPT_FORMS.missingLeft:
        return `?${op}${values.b}=${values.result}`;
      case PROMPT_FORMS.missingRight:
        return `${values.a}${op}?=${values.result}`;
      default:
        throw new Error(`Unsupported fact prompt form: ${promptForm}`);
    }
  }

  function buildFactId(operation, promptForm, values) {
    return `${operation}:${buildPrompt(operation, promptForm, values)}`;
  }

  function buildFamilyKey(operation, values) {
    if (COMMUTATIVE.has(operation)) {
      const ordered = [values.a, values.b].sort((left, right) => left - right);
      return `${operation}:${ordered[0]},${ordered[1]},${values.result}`;
    }

    return `${operation}:${values.a},${values.b},${values.result}`;
  }

  function getCorrectAnswer(promptForm, values) {
    switch (promptForm) {
      case PROMPT_FORMS.result:
        return values.result;
      case PROMPT_FORMS.missingLeft:
        return values.a;
      case PROMPT_FORMS.missingRight:
        return values.b;
      default:
        throw new Error(`Unsupported fact prompt form: ${promptForm}`);
    }
  }

  function createFact(definition = {}) {
    const operation = definition.operation;
    const promptForm = definition.promptForm ?? PROMPT_FORMS.result;
    assertSupportedOperation(operation);
    assertSupportedPromptForm(promptForm);

    const values = normalizeValues(operation, definition.values);
    const prompt = definition.prompt ?? buildPrompt(operation, promptForm, values);
    const factId = definition.factId ?? buildFactId(operation, promptForm, values);
    const familyKey = definition.familyKey ?? buildFamilyKey(operation, values);
    const correctAnswer =
      definition.correctAnswer ?? getCorrectAnswer(promptForm, values);

    return {
      factId,
      familyKey,
      operation,
      promptForm,
      values,
      prompt,
      correctAnswer,
    };
  }

  function listTableFacts({
    operation,
    promptForm = PROMPT_FORMS.result,
    minA = 1,
    maxA = 10,
    minB = 1,
    maxB = 10,
    fixedA,
    fixedB,
  } = {}) {
    const facts = [];
    const startA = fixedA ?? minA;
    const endA = fixedA ?? maxA;
    const startB = fixedB ?? minB;
    const endB = fixedB ?? maxB;

    for (let a = startA; a <= endA; a++) {
      for (let b = startB; b <= endB; b++) {
        facts.push(
          createFact({
            operation,
            promptForm,
            values: { a, b },
          })
        );
      }
    }

    return facts;
  }

  global.FactCatalog = {
    OPERATORS,
    PROMPT_FORMS,
    computeResult,
    buildPrompt,
    buildFactId,
    buildFamilyKey,
    getCorrectAnswer,
    createFact,
    listTableFacts,
  };
})(window);
