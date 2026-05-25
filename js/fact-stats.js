(function (global) {
  "use strict";

  const DEFAULTS = {
    recentAttemptsLimit: 5,
    rapidMs: 2200,
    mediumMs: 4200,
  };

  function roundNumber(value) {
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  function recentAttemptsOf(fact) {
    return Array.isArray(fact?.recentAttempts) ? fact.recentAttempts : [];
  }

  function dailyStatsOf(fact) {
    return Array.isArray(fact?.dailyStats) ? fact.dailyStats : [];
  }

  function totalsOf(fact) {
    return fact?.totals ?? { attempts: 0, correct: 0, wrong: 0, lastSeenAt: null };
  }

  function recentCorrectCount(fact) {
    return recentAttemptsOf(fact).filter((attempt) => attempt.correct).length;
  }

  function recentAverageResponseMs(fact) {
    const attempts = recentAttemptsOf(fact).filter((attempt) =>
      Number.isFinite(attempt.responseMs)
    );
    if (!attempts.length) return null;

    const total = attempts.reduce((sum, attempt) => sum + attempt.responseMs, 0);
    return roundNumber(total / attempts.length);
  }

  function dailyAverageResponseMs(fact) {
    const stats = dailyStatsOf(fact).filter((entry) => Number.isFinite(entry.avgResponseMs));
    if (!stats.length) return null;

    let weightedTotal = 0;
    let weightedCount = 0;
    stats.forEach((entry) => {
      weightedTotal += entry.avgResponseMs * entry.attempts;
      weightedCount += entry.attempts;
    });
    return weightedCount ? roundNumber(weightedTotal / weightedCount) : null;
  }

  function getAccuracyStatus(fact) {
    const attempts = recentAttemptsOf(fact);
    if (!attempts.length) return "nou";

    const correctCount = recentCorrectCount(fact);
    if (correctCount >= 4) return "solid";
    if (correctCount >= 2) return "fragil";
    return "slab";
  }

  function getSpeedStatus(fact, config = {}) {
    const rapidMs = config.rapidMs ?? DEFAULTS.rapidMs;
    const mediumMs = config.mediumMs ?? DEFAULTS.mediumMs;
    const avgMs = recentAverageResponseMs(fact);

    if (avgMs == null) return "necunoscut";
    if (avgMs <= rapidMs) return "rapid";
    if (avgMs <= mediumMs) return "mediu";
    return "lent";
  }

  function getFactMastery(fact, config = {}) {
    const attempts = recentAttemptsOf(fact);
    const accuracyStatus = getAccuracyStatus(fact);
    const speedStatus = getSpeedStatus(fact, config);

    if (!attempts.length) return "nou";
    if (accuracyStatus === "solid" && speedStatus !== "lent") return "solid";
    if (accuracyStatus === "slab" || speedStatus === "lent") return "fragil";
    return "in-curs";
  }

  function getPracticeBucket(fact, config = {}) {
    const mastery = getFactMastery(fact, config);
    if (mastery === "nou") return "unseen";
    if (mastery === "fragil") return "weak";
    return "strong";
  }

  function getFactSummary(fact, config = {}) {
    const recentAttempts = recentAttemptsOf(fact);
    const recentCorrect = recentCorrectCount(fact);
    const recentAvgMs = recentAverageResponseMs(fact);
    const perDayAvgMs = dailyAverageResponseMs(fact);
    const totals = totalsOf(fact);

    return {
      factId: fact?.factId ?? null,
      familyKey: fact?.familyKey ?? null,
      operation: fact?.operation ?? null,
      promptForm: fact?.promptForm ?? null,
      values: fact?.values ?? null,
      recentAttemptsCount: recentAttempts.length,
      recentCorrect,
      recentWrong: recentAttempts.length - recentCorrect,
      recentAvgMs,
      perDayAvgMs,
      totals,
      accuracyStatus: getAccuracyStatus(fact),
      speedStatus: getSpeedStatus(fact, config),
      masteryStatus: getFactMastery(fact, config),
      practiceBucket: getPracticeBucket(fact, config),
    };
  }

  function getFamilyMastery(factsInFamily, config = {}) {
    const facts = Array.isArray(factsInFamily) ? factsInFamily : [];
    if (!facts.length) {
      return {
        factsCount: 0,
        masteryStatus: "necunoscut",
        accuracyStatus: "necunoscut",
        speedStatus: "necunoscut",
        avgRecentMs: null,
      };
    }

    const summaries = facts.map((fact) => getFactSummary(fact, config));
    const withRecentSpeed = summaries.filter((summary) => summary.recentAvgMs != null);
    const avgRecentMs = withRecentSpeed.length
      ? roundNumber(
          withRecentSpeed.reduce((sum, summary) => sum + summary.recentAvgMs, 0) /
            withRecentSpeed.length
        )
      : null;
    const masteryRank = {
      solid: 3,
      "in-curs": 2,
      fragil: 1,
      nou: 0,
    };

    let strongest = "nou";
    let weakest = "solid";
    summaries.forEach((summary) => {
      if (masteryRank[summary.masteryStatus] > masteryRank[strongest]) {
        strongest = summary.masteryStatus;
      }
      if (masteryRank[summary.masteryStatus] < masteryRank[weakest]) {
        weakest = summary.masteryStatus;
      }
    });

    return {
      factsCount: summaries.length,
      masteryStatus: weakest === "solid" ? "solid" : strongest === "nou" ? "nou" : "mixt",
      accuracyStatus: summaries.every((summary) => summary.accuracyStatus === "solid")
        ? "solid"
        : summaries.some((summary) => summary.accuracyStatus === "slab")
          ? "slab"
          : "fragil",
      speedStatus: summaries.every((summary) => summary.speedStatus === "rapid")
        ? "rapid"
        : summaries.some((summary) => summary.speedStatus === "lent")
          ? "lent"
          : "mediu",
      avgRecentMs,
      summaries,
    };
  }

  global.FactStats = {
    DEFAULTS,
    recentAttemptsOf,
    dailyStatsOf,
    recentCorrectCount,
    recentAverageResponseMs,
    dailyAverageResponseMs,
    getAccuracyStatus,
    getSpeedStatus,
    getFactMastery,
    getPracticeBucket,
    getFactSummary,
    getFamilyMastery,
  };
})(window);
