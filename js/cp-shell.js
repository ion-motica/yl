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
      const tocItem = tocEl.querySelector(`[data-cp-id="${id}"]`);
      const section = sectionsEl.querySelector(`[data-cp-id="${id}"]`);
      tocItem?.classList.toggle("is-disabled", !enabled);
      section?.classList.toggle("is-disabled", !enabled);
      if (tocItem) tocItem.disabled = !enabled;
    }

    function scrollToPanel(id) {
      const section = sectionsEl.querySelector(`[data-cp-id="${id}"]`);
      if (!section || section.classList.contains("is-disabled")) return;
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function build() {
      tocEl.replaceChildren();
      sectionsEl.replaceChildren();
      mounts.clear();

      Registry.list().forEach((def) => {
        const enabled = def.isEnabled();

        const tocBtn = document.createElement("button");
        tocBtn.type = "button";
        tocBtn.className = "cp-toc-item";
        tocBtn.dataset.cpId = def.id;
        tocBtn.textContent = def.title;
        tocBtn.disabled = !enabled;
        tocBtn.classList.toggle("is-disabled", !enabled);
        tocBtn.addEventListener("click", () => scrollToPanel(def.id));
        tocEl.appendChild(tocBtn);

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
        section.appendChild(body);

        sectionsEl.appendChild(section);
        mounts.set(def.id, body);
      });
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
