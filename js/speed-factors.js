(function (global) {
  "use strict";

  // ── SpeedFactors ─────────────────────────────────────────────────────────────
  // Modul centralizat pentru factori de viteză bazați pe dificultatea structurală
  // a unui fapt matematic. Toți factorii sunt ≤ 1.0 (viteză mai mică = mai ușor).

  function in1_10(n)  { return n >= 1  && n <= 10; }
  function in11_20(n) { return n >= 11 && n <= 20; }

  // Factorul de viteză pentru EFF și conexe, bazat pe cei doi "operanzi mici".
  // Perechile per operație (din valorile faptului):
  //   a+b=c  →  (a, b)
  //   a-b=c  →  (b, c)  [scăzătorul și diferența]
  //   a*b=c  →  (a, b)
  //   a:b=c  →  (b, c)  [împărțitorul și câtul]
  //
  // Reguli:
  //   0 ∈ pereche           → 1.00 (standard)
  //   ambele ∈ [11,20]      → 0.80 (20% mai lent)
  //   unul ∈ [11,20], alt ∈ [1,10] → 0.95 (5% mai lent)
  //   altfel                → 1.00
  function factDifficultyFactor(n1, n2) {
    const a = Number(n1), b = Number(n2);
    if (a === 0 || b === 0) return 1.0;
    if (in11_20(a) && in11_20(b)) return 0.70;
    if ((in11_20(a) && in1_10(b)) || (in1_10(a) && in11_20(b))) return 0.90;
    return 1.0;
  }

  // Factorul de viteză pentru quiz-uri succesive, bazat pe pasul (stepul) adăugat.
  //   step > 10  → 0.80 (20% mai lent)
  //   altfel     → 1.00
  function succesiveFactor(step) {
    return Number(step) > 10 ? 0.70 : 1.0;
  }

  global.SpeedFactors = { factDifficultyFactor, succesiveFactor };
})(window);
