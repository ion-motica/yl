(function (global) {
  "use strict";

  const CONEXE_LEVEL = {
    PERFORMANT: "performant",
    CORECT_DAR_LENT: "corect_dar_lent",
    SLAB: "slab",
    PRAF: "praf",
    NOU: "nou",
  };

  const CONEXE_RANK = {
    [CONEXE_LEVEL.PERFORMANT]: 5,
    [CONEXE_LEVEL.CORECT_DAR_LENT]: 4,
    [CONEXE_LEVEL.SLAB]: 3,
    [CONEXE_LEVEL.PRAF]: 2,
    [CONEXE_LEVEL.NOU]: 1,
  };

  const EXPANDED_POOL_TIERS = [
    CONEXE_LEVEL.CORECT_DAR_LENT,
    CONEXE_LEVEL.SLAB,
    CONEXE_LEVEL.PRAF,
    CONEXE_LEVEL.NOU,
  ];

  const CONEXE_PICK_ORDER = [CONEXE_LEVEL.PERFORMANT, ...EXPANDED_POOL_TIERS];

  const DEFAULTS = {
    MIN_LEVEL: 2,
    MAX_LEVEL: 20,
    MIN_POOL_SIZE: 3,
    MAX_QUESTIONS_PER_SERIES: 3,
    CONEXE_FAST_MS: 2000,
    PERFORMANT_CONEXE_LIMIT: 3,
    LEVEL_TOO_LOW_MESSAGE: "Prea ușor. trecem la nivelul 2",
    HINT_MESSAGE: "Alege numărul corect pentru ?.",
    TIMEOUT_MESSAGE: "Prea târziu! Alege numărul corect pentru ?.",
    GAME_COMPLETE_BANNER: "Felicitări! Ai terminat nivelul 20!",
    LEVEL_ADVANCED_BANNER: "Felicitări! Next level!",
  };

  global.ConexeTableQuizConstants = {
    CONEXE_LEVEL,
    CONEXE_RANK,
    EXPANDED_POOL_TIERS,
    CONEXE_PICK_ORDER,
    DEFAULTS,
  };
})(window);
