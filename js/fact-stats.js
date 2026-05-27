(function (global) {
  "use strict";

  const WORKED_DAYS_FOR_MASTERY = 3;

  const KNOWLEDGE_LEVEL = {
    NOU: "nou",
    PRAF: "praf",
    SLAB: "slab",
    CORECT_DAR_LENT: "corect_dar_lent",
    PERFORMANT: "performant",
  };

  function roundNumber(value) {
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  function dailyStatsOf(fact) {
    return Array.isArray(fact?.dailyStats) ? fact.dailyStats : [];
  }

  function totalsOf(fact) {
    return fact?.totals ?? { attempts: 0, correct: 0, wrong: 0, lastSeenAt: null };
  }

  function getFastResponseMs(fact, config = {}) {
    if (Number.isFinite(fact?.fastResponseMs)) return fact.fastResponseMs;
    if (typeof config.getFastResponseMs === "function") {
      const resolved = config.getFastResponseMs(fact);
      return Number.isFinite(resolved) ? resolved : null;
    }
    return null;
  }

  function getLastWorkedDays(fact, count = WORKED_DAYS_FOR_MASTERY) {
    return dailyStatsOf(fact)
      .filter((entry) => entry.attempts > 0)
      .sort((left, right) => String(right.day).localeCompare(String(left.day)))
      .slice(0, count);
  }

  function hasSdpInHistory(fact) {
    return dailyStatsOf(fact).some((entry) => entry.attempts > 0 && entry.sdp === true);
  }

  function dayHasSdp(entry) {
    return entry?.sdp === true;
  }

  function daySdpIsFast(entry, fastMs) {
    return (
      dayHasSdp(entry) &&
      Number.isFinite(entry.sdpResponseMs) &&
      Number.isFinite(fastMs) &&
      entry.sdpResponseMs < fastMs
    );
  }

  function getKnowledgeLevel(fact, config = {}) {
    const totals = totalsOf(fact);
    if (!totals.attempts) return KNOWLEDGE_LEVEL.NOU;

    const fastMs = getFastResponseMs(fact, config);
    const lastWorked = getLastWorkedDays(fact, WORKED_DAYS_FOR_MASTERY);
    const allThreeWorked = lastWorked.length >= WORKED_DAYS_FOR_MASTERY;
    const allThreeSdp = allThreeWorked && lastWorked.every(dayHasSdp);

    if (allThreeSdp) {
      if (fastMs != null && lastWorked.every((entry) => daySdpIsFast(entry, fastMs))) {
        return KNOWLEDGE_LEVEL.PERFORMANT;
      }
      return KNOWLEDGE_LEVEL.CORECT_DAR_LENT;
    }

    if (lastWorked.length > 0 && !lastWorked.some(dayHasSdp)) {
      return KNOWLEDGE_LEVEL.PRAF;
    }

    if (hasSdpInHistory(fact)) return KNOWLEDGE_LEVEL.SLAB;
    return KNOWLEDGE_LEVEL.PRAF;
  }

  function getPracticeBucket(fact, config = {}) {
    const knowledgeLevel = getKnowledgeLevel(fact, config);
    if (knowledgeLevel === KNOWLEDGE_LEVEL.NOU) return "unseen";
    if (knowledgeLevel === KNOWLEDGE_LEVEL.PRAF || knowledgeLevel === KNOWLEDGE_LEVEL.SLAB) {
      return "weak";
    }
    if (knowledgeLevel === KNOWLEDGE_LEVEL.CORECT_DAR_LENT) return "fragile";
    return "strong";
  }

  function getRecentSdpWindow(fact, config = {}) {
    const fastMs = getFastResponseMs(fact, config);
    const lastWorked = getLastWorkedDays(fact, WORKED_DAYS_FOR_MASTERY);

    return {
      workedDays: lastWorked.length,
      sdpDays: lastWorked.filter(dayHasSdp).length,
      fastSdpDays: lastWorked.filter((entry) => daySdpIsFast(entry, fastMs)).length,
      fastResponseMs: fastMs,
      days: lastWorked.map((entry) => ({
        day: entry.day,
        sdp: entry.sdp === true,
        sdpResponseMs: entry.sdpResponseMs ?? null,
        sdpFast: daySdpIsFast(entry, fastMs),
      })),
    };
  }

  function getFactSummary(fact, config = {}) {
    const totals = totalsOf(fact);
    const knowledgeLevel = getKnowledgeLevel(fact, config);
    const sdpWindow = getRecentSdpWindow(fact, config);

    return {
      factId: fact?.factId ?? null,
      familyKey: fact?.familyKey ?? null,
      operation: fact?.operation ?? null,
      promptForm: fact?.promptForm ?? null,
      values: fact?.values ?? null,
      totals,
      knowledgeLevel,
      practiceBucket: getPracticeBucket(fact, config),
      fastResponseMs: sdpWindow.fastResponseMs,
      sdpWindow,
      hasSdpInHistory: hasSdpInHistory(fact),
    };
  }

  function getFamilyMastery(factsInFamily, config = {}) {
    const facts = Array.isArray(factsInFamily) ? factsInFamily : [];
    if (!facts.length) {
      return {
        factsCount: 0,
        knowledgeLevel: "necunoscut",
        summaries: [],
      };
    }

    const summaries = facts.map((fact) => getFactSummary(fact, config));
    const rank = {
      [KNOWLEDGE_LEVEL.PERFORMANT]: 4,
      [KNOWLEDGE_LEVEL.CORECT_DAR_LENT]: 3,
      [KNOWLEDGE_LEVEL.SLAB]: 2,
      [KNOWLEDGE_LEVEL.PRAF]: 1,
      [KNOWLEDGE_LEVEL.NOU]: 0,
    };

    let strongest = KNOWLEDGE_LEVEL.NOU;
    let weakest = KNOWLEDGE_LEVEL.PERFORMANT;
    summaries.forEach((summary) => {
      if (rank[summary.knowledgeLevel] > rank[strongest]) strongest = summary.knowledgeLevel;
      if (rank[summary.knowledgeLevel] < rank[weakest]) weakest = summary.knowledgeLevel;
    });

    return {
      factsCount: summaries.length,
      knowledgeLevel:
        weakest === strongest
          ? weakest
          : weakest === KNOWLEDGE_LEVEL.PERFORMANT
            ? KNOWLEDGE_LEVEL.PERFORMANT
            : strongest === KNOWLEDGE_LEVEL.NOU
              ? KNOWLEDGE_LEVEL.NOU
              : "mixt",
      summaries,
    };
  }

  global.FactStats = {
    WORKED_DAYS_FOR_MASTERY,
    KNOWLEDGE_LEVEL,
    dailyStatsOf,
    totalsOf,
    getFastResponseMs,
    getLastWorkedDays,
    hasSdpInHistory,
    getKnowledgeLevel,
    getPracticeBucket,
    getRecentSdpWindow,
    getFactSummary,
    getFamilyMastery,
  };
})(window);
