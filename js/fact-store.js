(function (global) {
  "use strict";

  const STORAGE_KEY = "prime-divisor-game:facts:v1";
  const MAX_DAILY_STATS = 14;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createMemoryStorage() {
    let data = {};
    return {
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
      },
      setItem(key, value) {
        data[key] = String(value);
      },
      removeItem(key) {
        delete data[key];
      },
      clear() {
        data = {};
      },
    };
  }

  function getStorage() {
    try {
      if (global.localStorage) return global.localStorage;
    } catch (error) {
      // Fallback in environments without localStorage access.
    }
    if (!getStorage.memory) getStorage.memory = createMemoryStorage();
    return getStorage.memory;
  }

  function readState() {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (!raw) return { version: 1, facts: {} };

    try {
      const parsed = JSON.parse(raw);
      return {
        version: parsed.version ?? 1,
        facts: parsed.facts && typeof parsed.facts === "object" ? parsed.facts : {},
      };
    } catch (error) {
      return { version: 1, facts: {} };
    }
  }

  function writeState(state) {
    // getStorage() e deja aparata contra lipsei de localStorage (vezi mai
    // sus), dar setItem() poate arunca si separat, cand storage-ul EXISTA
    // dar e plin (QuotaExceededError) — caz real, nu ipotetic: a blocat
    // jocul in productie (02.09.2026), pt. ca aceasta aruncare, netratata,
    // urca prin tot lantul sincron pana in handlerul de click si il
    // intrerupe la mijloc (vezi recordAttempt mai jos, apelat din
    // `dupa_turn_apasare` INAINTE de `dupaRaspunsCorect`, care e cel ce
    // chiar avanseaza jocul — daca scrierea arunca, acela nu mai ruleaza).
    // Aici inghitim eroarea: progresul acelei incercari nu se salveaza de
    // data asta, dar jocul continua normal.
    try {
      getStorage().setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("FactStore: nu s-a putut salva progresul (localStorage plin?).", error);
    }
  }

  function normalizeAttempt(attempt = {}) {
    const at = attempt.at ?? new Date().toISOString();
    const responseMs = Number(attempt.responseMs);

    return {
      at,
      correct: Boolean(attempt.correct),
      responseMs: Number.isFinite(responseMs) ? Math.max(0, Math.round(responseMs)) : null,
      answer: attempt.answer ?? null,
      timedOut: Boolean(attempt.timedOut),
      quizId: attempt.quizId ?? null,
    };
  }

  function createEmptyRecord(factSeed) {
    const fact = global.FactCatalog.createFact(factSeed);
    return {
      factId: fact.factId,
      familyKey: fact.familyKey,
      operation: fact.operation,
      promptForm: fact.promptForm,
      values: clone(fact.values),
      dailyStats: [],
      totals: {
        attempts: 0,
        correct: 0,
        wrong: 0,
        lastSeenAt: null,
      },
      performantaLaConexeFact: "nou",
      deCateOriAavutPerformantLaConexe: 0,
      conexeM1GradedDay: null,
    };
  }

  function normalizeRecord(record, factSeed) {
    const base = createEmptyRecord(
      factSeed ?? {
        factId: record.factId,
        familyKey: record.familyKey,
        operation: record.operation,
        promptForm: record.promptForm,
        values: record.values,
      }
    );

    const normalized = {
      ...base,
      ...record,
      values: clone(record.values ?? base.values),
      dailyStats: Array.isArray(record.dailyStats)
        ? record.dailyStats
            .map((entry) => ({
              day: entry.day,
              attempts: entry.attempts ?? 0,
              correct: entry.correct ?? 0,
              wrong: entry.wrong ?? 0,
              avgResponseMs: entry.avgResponseMs ?? null,
              lastAttemptAt: entry.lastAttemptAt ?? null,
              sdp: entry.sdp ?? null,
              sdpResponseMs: entry.sdpResponseMs ?? null,
            }))
            .slice(0, MAX_DAILY_STATS)
        : [],
      totals: {
        ...base.totals,
        ...(record.totals ?? {}),
      },
      performantaLaConexeFact:
        typeof record.performantaLaConexeFact === "string"
          ? record.performantaLaConexeFact
          : base.performantaLaConexeFact,
      deCateOriAavutPerformantLaConexe: Number.isFinite(
        record.deCateOriAavutPerformantLaConexe
      )
        ? Math.max(0, Math.round(record.deCateOriAavutPerformantLaConexe))
        : base.deCateOriAavutPerformantLaConexe,
      conexeM1GradedDay:
        typeof record.conexeM1GradedDay === "string" ? record.conexeM1GradedDay : null,
    };

    return normalized;
  }

  function getRecordFromState(state, factId, factSeed) {
    const existing = state.facts[factId];
    if (existing) return normalizeRecord(existing, factSeed);
    if (factSeed) return createEmptyRecord(factSeed);
    return null;
  }

  function upsertDailyStats(record, attempt) {
    const day = String(attempt.at).slice(0, 10);
    const stats = Array.isArray(record.dailyStats) ? [...record.dailyStats] : [];
    let entry = stats.find((item) => item.day === day);

    const isFirstAttemptOfDay = !entry;

    if (!entry) {
      entry = {
        day,
        attempts: 0,
        correct: 0,
        wrong: 0,
        avgResponseMs: null,
        lastAttemptAt: attempt.at,
        sdp: null,
        sdpResponseMs: null,
      };
      stats.push(entry);
    }

    const previousAttempts = entry.attempts;
    entry.attempts += 1;
    if (attempt.correct) entry.correct += 1;
    else entry.wrong += 1;
    entry.lastAttemptAt = attempt.at;

    if (isFirstAttemptOfDay) {
      entry.sdp = attempt.correct;
      entry.sdpResponseMs =
        attempt.correct && Number.isFinite(attempt.responseMs)
          ? Math.max(0, Math.round(attempt.responseMs))
          : null;
    }

    if (Number.isFinite(attempt.responseMs)) {
      entry.avgResponseMs =
        previousAttempts === 0 || !Number.isFinite(entry.avgResponseMs)
          ? attempt.responseMs
          : Math.round(
              (entry.avgResponseMs * previousAttempts + attempt.responseMs) / entry.attempts
            );
    }

    stats.sort((left, right) => String(right.day).localeCompare(String(left.day)));
    record.dailyStats = stats.slice(0, MAX_DAILY_STATS);
  }

  function applyAttempt(record, attempt) {
    record.totals.attempts += 1;
    if (attempt.correct) record.totals.correct += 1;
    else record.totals.wrong += 1;
    record.totals.lastSeenAt = attempt.at;
    upsertDailyStats(record, attempt);
  }

  function getFact(factId, factSeed) {
    const state = readState();
    const record = getRecordFromState(state, factId, factSeed);
    return record ? clone(record) : null;
  }

  function saveFact(fact) {
    const state = readState();
    const normalized = normalizeRecord(fact, fact);
    state.facts[normalized.factId] = normalized;
    writeState(state);
    return clone(normalized);
  }

  function recordAttempt(factId, attempt, factSeed) {
    const state = readState();
    const normalizedAttempt = normalizeAttempt(attempt);
    const existingRecord =
      typeof factId === "string" ? getRecordFromState(state, factId) : null;
    const normalizedFact =
      existingRecord
        ? global.FactCatalog.createFact(existingRecord)
        : global.FactCatalog.createFact(
            typeof factId === "object" ? factId : factSeed
          );
    const record = existingRecord
      ? normalizeRecord(existingRecord, normalizedFact)
      : getRecordFromState(state, normalizedFact.factId, normalizedFact) ??
        createEmptyRecord(normalizedFact);

    applyAttempt(record, normalizedAttempt);
    state.facts[record.factId] = record;
    writeState(state);
    return clone(record);
  }

  function listFactsByOperation(operation) {
    const state = readState();
    return Object.values(state.facts)
      .map((record) => normalizeRecord(record))
      .filter((record) => record.operation === operation)
      .map((record) => clone(record));
  }

  function getFactsByOperation(operation) {
    return listFactsByOperation(operation);
  }

  function getFactsByFamily(familyKey) {
    const state = readState();
    return Object.values(state.facts)
      .map((record) => normalizeRecord(record))
      .filter((record) => record.familyKey === familyKey)
      .map((record) => clone(record));
  }

  function getFactSummary(factId, factSeed, config) {
    const fact =
      typeof factId === "object" ? getFact(factId.factId, factId) : getFact(factId, factSeed);
    if (!fact) return null;
    return global.FactStats ? global.FactStats.getFactSummary(fact, config) : fact;
  }

  function resetAll() {
    getStorage().removeItem(STORAGE_KEY);
  }

  global.FactStore = {
    STORAGE_KEY,
    getFact,
    saveFact,
    recordAttempt,
    listFactsByOperation,
    getFactsByOperation,
    getFactsByFamily,
    getFactSummary,
    resetAll,
  };
})(window);
