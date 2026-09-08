(function (global) {
  "use strict";

  // "Testeaza doar subquizul X" (cerere user, 09.09.2026): cand un id e
  // fortat, orice intrare in ruta — inclusiv revenirea prin pop din X insusi —
  // trebuie sa reintre direct in X, fara ca "base" sa arate vreo intrebare
  // proprie sau sa decida altceva (nici avans de nivel, cat timp X ramane
  // fortat). Refoloseste STRICT mecanismul deja stabilit (base -> push SQ ->
  // pop -> base): "base" ramane mereu punctul de intoarcere, activat prin
  // orchestrator.activate() (fara begin() — vezi comentariul din
  // subquiz-orchestrator.js, evita o intrebare generata si aruncata), apoi
  // comanda de push il trimite direct spre X.
  //
  // `payloadFor(id)` e responsabilitatea fiecarui quiz — ce facts/parametri
  // primeste X cand e fortat difera de la un subquiz la altul (un grup de
  // factori pt. unul, un payload gol pt. altul care isi calculeaza singur
  // domeniul) — acest modul nu stie si nu trebuie sa stie. Modulul stie doar
  // CUM se intra/reintra fortat, nu CE anume primeste subquizul.
  function creeaza({ orchestrator, getForcedId, payloadFor, baseId = "base" }) {
    function comandaFortata() {
      const forcedId = getForcedId();
      if (!forcedId) return null;
      return {
        action: "push",
        targetId: forcedId,
        payload: payloadFor(forcedId) ?? {},
        view: {
          outcome: "step-correct",
          correct: true,
          bounce: true,
        },
      };
    }

    // De folosit in loc de orchestrator.startFirst() la inceputul unei rute.
    function startFirst() {
      const comanda = comandaFortata();
      if (!comanda) return orchestrator.startFirst();
      orchestrator.activate(baseId, {});
      return orchestrator.command(comanda);
    }

    // De apelat la INCEPUTUL onResume() al lui "base", inaintea oricarei
    // decizii normale (acoperire completa, avans de nivel etc.). Cand
    // intoarce non-null, acea comanda trebuie returnata direct din onResume,
    // fara sa mai ruleze nimic altceva din decizia normala.
    function laRevenireaInBase() {
      return comandaFortata();
    }

    return { startFirst, laRevenireaInBase };
  }

  global.SubquizForcedSelection = { creeaza };
})(window);
