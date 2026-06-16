(function (global) {
  "use strict";

  function create(opts) {
    const options = opts || {};
    const gameEl = options.gameEl;
    const shellEl = options.shellEl;
    const isMobile = typeof options.isMobile === "function" ? options.isMobile : () => false;
    const Config = global.LayoutConfig;
    const Registry = global.CpRegistry;

    const tocEl = shellEl.querySelector(".cp-toc");
    const sectionsEl = shellEl.querySelector(".cp-sections");
    const backdropEl = shellEl.querySelector(".cp-shell-backdrop");
    const closeBtn = shellEl.querySelector(".cp-shell-close");
    const mounts = new Map();
    let open = false;

    function readOpenDefault() {
      return isMobile()
        ? !!Config?.get("cpOpenMobile", false)
        : Config?.get("cpOpenDesktop", true) !== false;
    }

    function persistOpen() {
      if (!Config) return;
      if (isMobile()) Config.set("cpOpenMobile", open);
      else Config.set("cpOpenDesktop", open);
    }

    function setOpen(next) {
      open = !!next;
      gameEl.classList.toggle("cp-open", open);
      shellEl.hidden = !open;
      if (backdropEl) backdropEl.hidden = !open || !isMobile();
      if (closeBtn) closeBtn.hidden = !open || !isMobile();
      const toggle = document.getElementById("cp-toggle");
      toggle?.classList.toggle("active", open);
      toggle?.setAttribute("aria-expanded", open ? "true" : "false");
      persistOpen();
      options.onOpenChange?.(open);
    }

    function isOpen() {
      return open;
    }

    function getMountEl(id) {
      return mounts.get(id) || null;
    }

    function setPanelEnabled(id, enabled) {
      const row = tocEl.querySelector(`.cp-toc-row[data-cp-id="${id}"]`);
      const tocItem = row?.querySelector(".cp-toc-item");
      const section = sectionsEl.querySelector(`[data-cp-id="${id}"]`);
      row?.classList.toggle("is-disabled", !enabled);
      section?.classList.toggle("is-disabled", !enabled);
      if (tocItem) tocItem.disabled = !enabled;
    }

    function scrollToPanel(id) {
      const section = sectionsEl.querySelector(`[data-cp-id="${id}"]`);
      if (!section || section.classList.contains("is-disabled")) return;
      // Doar lista de secțiuni — nu scrollIntoView (ar mișca și pagina / cuprinsul).
      const top =
        section.getBoundingClientRect().top -
        sectionsEl.getBoundingClientRect().top +
        sectionsEl.scrollTop;
      sectionsEl.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }

    function syncMoveButtons() {
      const order = Registry.getOrder();
      tocEl.querySelectorAll(".cp-toc-row").forEach((row) => {
        const id = row.dataset.cpId;
        const i = order.indexOf(id);
        const up = row.querySelector(".cp-toc-up");
        const down = row.querySelector(".cp-toc-down");
        if (up) up.disabled = i <= 0;
        if (down) down.disabled = i < 0 || i >= order.length - 1;
      });
    }

    function reorderDom(order) {
      order.forEach((id) => {
        const row = tocEl.querySelector(`.cp-toc-row[data-cp-id="${id}"]`);
        const section = sectionsEl.querySelector(`[data-cp-id="${id}"]`);
        if (row) tocEl.appendChild(row);
        if (section) sectionsEl.appendChild(section);
      });
      syncMoveButtons();
    }

    function movePanel(id, delta) {
      const next = Registry.move(id, delta);
      if (next) reorderDom(next);
    }

    function createTocRow(def) {
      const enabled = def.isEnabled();
      const row = document.createElement("div");
      row.className = "cp-toc-row";
      row.dataset.cpId = def.id;
      row.classList.toggle("is-disabled", !enabled);

      const moves = document.createElement("div");
      moves.className = "cp-toc-moves";

      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "cp-toc-move cp-toc-up";
      upBtn.setAttribute("aria-label", "Mută sus");
      upBtn.textContent = "↑";
      upBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        movePanel(def.id, -1);
      });

      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "cp-toc-move cp-toc-down";
      downBtn.setAttribute("aria-label", "Mută jos");
      downBtn.textContent = "↓";
      downBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        movePanel(def.id, 1);
      });

      moves.append(upBtn, downBtn);

      const tocBtn = document.createElement("button");
      tocBtn.type = "button";
      tocBtn.className = "cp-toc-item";
      tocBtn.textContent = def.title;
      tocBtn.disabled = !enabled;
      tocBtn.addEventListener("click", () => scrollToPanel(def.id));

      row.append(moves, tocBtn);
      return row;
    }

    function build() {
      const saved = new Map();
      mounts.forEach((el, id) => {
        if (el?.childNodes.length) saved.set(id, el);
      });

      tocEl.replaceChildren();
      sectionsEl.replaceChildren();
      mounts.clear();

      Registry.list().forEach((def) => {
        const enabled = def.isEnabled();

        tocEl.appendChild(createTocRow(def));

        const section = document.createElement("section");
        section.className = "cp-section";
        section.dataset.cpId = def.id;
        section.id = `cp-section-${def.id}`;
        section.classList.toggle("is-disabled", !enabled);

        const heading = document.createElement("h2");
        heading.className = "cp-section-heading";
        heading.textContent = def.title;
        section.appendChild(heading);

        const body = document.createElement("div");
        body.className = "cp-section-body control-panel-mount";
        body.id = `cp-mount-${def.id}`;
        const prev = saved.get(def.id);
        if (prev) body.append(...prev.childNodes);
        section.appendChild(body);

        sectionsEl.appendChild(section);
        mounts.set(def.id, body);
      });

      syncMoveButtons();
    }

    closeBtn?.addEventListener("click", () => setOpen(false));
    backdropEl?.addEventListener("click", () => setOpen(false));

    function applyLayoutMode() {
      setOpen(readOpenDefault());
    }

    build();
    setOpen(readOpenDefault());

    return {
      build,
      setOpen,
      isOpen,
      getMountEl,
      setPanelEnabled,
      applyLayoutMode,
      refreshEnabledStates: () => {
        Registry.list().forEach((def) => setPanelEnabled(def.id, def.isEnabled()));
      },
    };
  }

  global.CpShell = { create };
})(window);
