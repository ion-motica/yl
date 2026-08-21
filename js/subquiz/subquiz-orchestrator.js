(function (global) {
  "use strict";

  function create(config = {}) {
    const context = config.context ?? {};
    // Ce urmeaza cand ruta s-a terminat (vezi routeComplete). Optional: un quiz
    // fara nimic dupa ruta nu-l da deloc.
    const laRutaCompleta = config.onRouteComplete;
    const definitions = new Map();
    (config.definitions ?? []).forEach((def) => {
      const normalized = global.SubquizDefinition.define(def);
      definitions.set(normalized.id, normalized);
    });

    let activeIds = (config.activeSubquizIds ?? [...definitions.keys()]).filter((id) => {
      const def = definitions.get(id);
      return def && def.enabled !== false;
    });
    let currentId = null;
    let currentRuntime = null;
    const runtimeStack = [];

    function currentIndex() {
      return activeIds.indexOf(currentId);
    }

    // Semnatura M3B (js/motor-3-butoane.js) sta pe COMANDA, nu neaparat si pe
    // vederea ei: la "pop" vederea vine din `onResume`-ul subquizului la care se
    // revine, care nu trece prin M3B (iar js/subquiz/subquiz-definition.js
    // sterge deliberat vederea semnata a comenzii, ca sa n-o ingroape pe cea din
    // onResume — vezi comentariul de acolo). Rezultatul de top reprezinta
    // RASPUNSUL, deci poarta provenienta raspunsului. Se aplica intr-un SINGUR
    // loc, la intrarea in `handle`, ca sa acopere si ramurile de rutare, si
    // recursia. Nu se inventeaza niciodata o semnatura — se copiaza doar cea
    // pusa de M3B pe comanda.
    function cuSemnaturaComenzii(rezultat, command) {
      if (rezultat.motor3Butoane || !command?.motor3Butoane) return rezultat;
      return { ...rezultat, motor3Butoane: command.motor3Butoane };
    }

    function decorate(view, event = {}) {
      return {
        ...(view ?? {}),
        subquizEvent: {
          subquizId: currentId,
          routeComplete: false,
          ...event,
        },
      };
    }

    function start(id = activeIds[0], payload = {}) {
      const def = definitions.get(id);
      if (!def) throw new Error(`Unknown subquiz: ${id}`);
      currentId = id;
      currentRuntime = global.SubquizDefinition.createRuntime(def, context, payload);
      return decorate(currentRuntime.begin(payload), {
        action: "start",
        subquizChanged: true,
      });
    }

    function startFirst(payload = {}) {
      if (!activeIds.length) {
        return {
          subquizEvent: {
            subquizId: null,
            action: "route-complete",
            routeComplete: true,
          },
        };
      }
      return start(activeIds[0], payload);
    }

    function setActiveSubquizIds(ids) {
      activeIds = (ids ?? []).filter((id) => definitions.has(id));
      if (!activeIds.includes(currentId)) {
        currentId = null;
        currentRuntime = null;
      }
    }

    // Sfarsitul rutei e tot un eveniment de rutare, deci se rezolva TOT aici,
    // ca push/pop/exit: quizul spune doar CE urmeaza (`onRouteComplete` din
    // config), orchestratorul pune marcajele pe rezultat.
    //
    // Inainte, cele 3 quizuri cu rute reale (v2-modular, v3, v4) prindeau
    // singure semnalul `routeComplete` si INLOCUIAU rezultatul orchestratorului
    // cu unul construit de mana (avansul de nivel). Acel rezultat ajungea la mr
    // fara `subquizEvent` — exact ce refuza gardul din js/falling-engine.js
    // (§12) — deci arunca eroare la FIECARE schimbare de nivel. Vezi
    // documente de referinta/RAPORT-motor-comun-raspuns.md.
    function routeComplete(command = {}) {
      const eveniment = {
        subquizId: currentId,
        action: "route-complete",
        routeComplete: true,
        reason: command.reason,
        command,
      };
      const view = laRutaCompleta?.(eveniment) ?? command.view;
      return { ...(view ?? {}), subquizEvent: eveniment };
    }

    // Singura intrare prin care se proceseaza o comanda. Orice iese de aici
    // poarta semnatura comenzii care a pornit-o — inclusiv prin recursie
    // (vezi "pop" mai jos: `onResume` poate cere la randul lui o rutare, iar
    // comanda LUI nu vine din M3B, deci e nesemnata). Fara invelisul asta,
    // semnatura se pierdea exact la finalul unui nivel atins prin revenirea
    // din sq3, si gardul din js/falling-engine.js arunca.
    function handle(command = {}) {
      return cuSemnaturaComenzii(handleIntern(command), command);
    }

    function handleIntern(command = {}) {
      if (command.action === "jump") {
        const targetId = command.targetId;
        const view = start(targetId, command.payload ?? {});
        return decorate(
          {
            ...(command.view ?? {}),
            ...view,
          },
          {
            action: "jump",
            targetId,
            subquizChanged: true,
            command,
          }
        );
      }

      if (command.action === "push") {
        const targetId = command.targetId;
        if (currentRuntime && currentId) {
          runtimeStack.push({ id: currentId, runtime: currentRuntime });
        }
        const view = start(targetId, command.payload ?? {});
        return decorate(
          {
            ...(command.view ?? {}),
            ...view,
          },
          {
            action: "push",
            targetId,
            subquizChanged: true,
            command,
          }
        );
      }

      if (command.action === "pop") {
        const previous = runtimeStack.pop();
        if (!previous) return routeComplete(command);
        currentId = previous.id;
        currentRuntime = previous.runtime;
        const resumed = currentRuntime.resume(command.payload ?? {});
        if (
          !command.view &&
          resumed?.action &&
          !["continue", "stay"].includes(resumed.action)
        ) {
          return handle(resumed);
        }
        const view = command.view ?? resumed.view;
        return decorate(view, {
          action: "pop",
          subquizChanged: true,
          reason: command.reason,
          command,
          resumeCommand: resumed,
        });
      }

      if (command.action === "exit") {
        const nextId = activeIds[currentIndex() + 1];
        if (!nextId) return routeComplete(command);
        const view = start(nextId, command.payload ?? {});
        return decorate(
          {
            ...(command.view ?? {}),
            ...view,
          },
          {
            action: "exit-next",
            targetId: nextId,
            subquizChanged: true,
            reason: command.reason,
            command,
          }
        );
      }

      return decorate(command.view, {
        action: command.action ?? "continue",
        command,
      });
    }

    function ensureStarted() {
      if (!currentRuntime) return startFirst();
      return null;
    }

    // Un raspuns nu poate fi notat fara un subquiz pornit: n-ar trece prin M3B,
    // deci rezultatul ar ajunge la mr nesemnat si ar fi refuzat de gardul din
    // js/falling-engine.js — o eroare confuza, departe de cauza reala. Spunem
    // direct ce e stricat, aici (razgandire-ieftina.md, punctul 9). `onTimeout`
    // ramane cu pornirea de recuperare: o expirare inainte de start e benigna.
    function onAnswer(index, meta = {}) {
      if (!currentRuntime) {
        throw new Error(
          "SubquizOrchestrator: raspuns primit fara niciun subquiz pornit. " +
            "Quizul trebuie sa cheme startFirst()/start() inainte de onAnswer()."
        );
      }
      return handle(currentRuntime.onAnswer(index, meta));
    }

    function onTimeout(meta = {}) {
      const boot = ensureStarted();
      if (boot) return boot;
      return handle(currentRuntime.onTimeout(meta));
    }

    return {
      start,
      startFirst,
      onAnswer,
      onTimeout,
      command: handle,
      setActiveSubquizIds,
      getCurrentId: () => currentId,
      getCurrentRuntime: () => currentRuntime,
      getActiveSubquizIds: () => [...activeIds],
      getStackDepth: () => runtimeStack.length,
      getDefinition: (id) => definitions.get(id),
      listDefinitions: () => [...definitions.values()],
    };
  }

  global.SubquizOrchestrator = { create };
})(window);
