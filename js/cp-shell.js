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
    const scrollEl = shellEl.querySelector(".cp-scroll");
    const sectionsEl = shellEl.querySelector(".cp-sections");
    const backdropEl = shellEl.querySelector(".cp-shell-backdrop");
    const closeBtn = shellEl.querySelector(".cp-shell-close");
    const topBtn = shellEl.querySelector(".cp-shell-top");
    const mounts = new Map();
    let open = false;
    let drag = null;

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
      if (topBtn) topBtn.hidden = !open || !isMobile();
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

    function scrollToPanel(id, instant) {
      const section = sectionsEl.querySelector(`[data-cp-id="${id}"]`);
      if (!section || section.classList.contains("is-disabled")) return;
      // .cp-scroll e singurul container cu scroll — nu scrollIntoView (ar mișca și pagina).
      const top =
        section.getBoundingClientRect().top -
        scrollEl.getBoundingClientRect().top +
        scrollEl.scrollTop;
      scrollEl.scrollTo({ top: Math.max(0, top), behavior: instant ? "auto" : "smooth" });
    }

    function scrollToTop() {
      scrollEl.scrollTo({ top: 0, behavior: "smooth" });
    }

    // Regula unificata PC/telefon: la deschiderea CP din butonul dedicat (telefon)
    // sau la schimbarea quizului (PC), sare la sectiunea proprie a quizului activ
    // (daca are una), altfel cade pe "CP - General".
    function scrollToActiveQuizSection() {
      const list = Registry.list();
      const primary = list.find((def) => def.quizSpecific && def.isEnabled());
      const target = primary || list.find((def) => def.id === "general" && def.isEnabled());
      if (target) scrollToPanel(target.id, true);
    }

    function reorderDom(order) {
      order.forEach((id) => {
        const row = tocEl.querySelector(`.cp-toc-row[data-cp-id="${id}"]`);
        const section = sectionsEl.querySelector(`[data-cp-id="${id}"]`);
        if (row) tocEl.appendChild(row);
        if (section) sectionsEl.appendChild(section);
      });
    }

    function targetIndexFor(others, clientY) {
      for (let i = 0; i < others.length; i++) {
        const rect = others[i].getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return i;
      }
      return others.length;
    }

    function onDragMove(e) {
      if (!drag) return;
      drag.row.style.transform = `translateY(${e.clientY - drag.startY}px)`;
      drag.targetIndex = targetIndexFor(drag.others, e.clientY);
    }

    function endDrag() {
      if (!drag) return;
      const { row, pointerId, id, targetIndex } = drag;
      row.releasePointerCapture(pointerId);
      row.removeEventListener("pointermove", onDragMove);
      row.removeEventListener("pointerup", endDrag);
      row.removeEventListener("pointercancel", endDrag);
      row.classList.remove("cp-toc-row-dragging");
      row.style.transform = "";
      if (typeof targetIndex === "number") {
        const order = Registry.getOrder().filter((x) => x !== id);
        order.splice(targetIndex, 0, id);
        reorderDom(Registry.setOrder(order));
      }
      drag = null;
    }

    function startDrag(e, id) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const row = tocEl.querySelector(`.cp-toc-row[data-cp-id="${id}"]`);
      if (!row) return;
      e.preventDefault();
      drag = {
        id,
        row,
        pointerId: e.pointerId,
        startY: e.clientY,
        others: Array.from(tocEl.querySelectorAll(".cp-toc-row")).filter((r) => r !== row),
      };
      row.classList.add("cp-toc-row-dragging");
      row.setPointerCapture(e.pointerId);
      row.addEventListener("pointermove", onDragMove);
      row.addEventListener("pointerup", endDrag);
      row.addEventListener("pointercancel", endDrag);
    }

    function createTocRow(def) {
      const enabled = def.isEnabled();
      const row = document.createElement("div");
      row.className = "cp-toc-row";
      row.dataset.cpId = def.id;
      row.classList.toggle("is-disabled", !enabled);

      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "cp-toc-drag";
      handle.setAttribute("aria-label", `Reordonează „${def.title}” (trage)`);
      handle.textContent = "⠿";
      handle.addEventListener("pointerdown", (e) => startDrag(e, def.id));

      const tocBtn = document.createElement("button");
      tocBtn.type = "button";
      tocBtn.className = "cp-toc-item";
      tocBtn.textContent = def.title;
      tocBtn.disabled = !enabled;
      tocBtn.addEventListener("click", () => scrollToPanel(def.id));

      row.append(handle, tocBtn);
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
    }

    closeBtn?.addEventListener("click", () => setOpen(false));
    topBtn?.addEventListener("click", () => scrollToTop());
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
      scrollToActiveQuizSection,
      refreshEnabledStates: () => {
        Registry.list().forEach((def) => setPanelEnabled(def.id, def.isEnabled()));
      },
    };
  }

  global.CpShell = { create };
})(window);
