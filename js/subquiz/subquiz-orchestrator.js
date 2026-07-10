(function (global) {
  "use strict";

  function create(config = {}) {
    const context = config.context ?? {};
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

    function routeComplete(command = {}) {
      return {
        ...(command.view ?? {}),
        subquizEvent: {
          subquizId: currentId,
          action: "route-complete",
          routeComplete: true,
          reason: command.reason,
          command,
        },
      };
    }

    function handle(command = {}) {
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

    function onAnswer(index, meta = {}) {
      const boot = ensureStarted();
      if (boot) return boot;
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
