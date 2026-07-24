/**
 * Quiz „Cl. 1 - Rigle" — înregistrare + config etapa 1.
 *
 * Quiz cu motor propriu (`customEngine`): nu trece prin FallingEngine. app.js îl
 * detectează după `customEngine` și, în loc de `engine.startRound(...)`, apelează
 * `mountArena(...)` / `unmountArena()`. `isCompleted() → true` ține FallingEngine
 * în standby fără să-l modificăm (bucla lui de cădere e inertă când quizul e
 * „completat"). Vezi `js/rigle/SPEC-etapa1.md`.
 */
(function (global) {
  "use strict";

  const CONFIG_ETAPA1 = {
    intrebare: "2+1=?",
    grupe: [
      { n: 2, fundal: "rosu" },
      { n: 1, fundal: "albastru" },
    ],
    obiect: "🍏",
    latimiColoane: [2, 3, 4],
    coloanaInitiala: 3,
    vitezaCoborare: 34,
  };

  global.QuizRegistry.register({
    id: "rigle-cl1",
    title: "Cl. 1 - Rigle",
    description: "Măsoară suma de obiecte cu rigle (coloane). Etapa 1: doar mișcarea.",
    order: 99, // ultimul în meniu; nu devine quiz implicit
    create() {
      let mounted = null;
      return {
        customEngine: true,
        // Ține motorul 1 (FallingEngine) în standby cât timp Rigle e activ.
        isCompleted: () => true,

        mountArena(hosts) {
          if (mounted) mounted.destroy();
          mounted = global.RigleEngine.mount(hosts, CONFIG_ETAPA1);
        },
        unmountArena() {
          if (mounted) mounted.destroy();
          mounted = null;
        },

        // Stub-uri minime pentru orice apel neguardat din HUD.
        getLevel: () => 1,
        getMinLevel: () => 1,
        getMaxLevel: () => 1,
        getLevelLabel: () => "",
        getLevelButtonTitle: () => "",
        switchLevel: () => "",
        pickNextRound: () => null,
        beginRound: () => ({}),
        onAnswer() {},
        onTimeout() {},
      };
    },
  });
})(window);
