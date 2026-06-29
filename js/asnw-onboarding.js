(function (global) {
  "use strict";

  // Strat de onboarding ASNW: ghidaje pur vizuale (pointer-events:none) peste
  // butoanele de răspuns. Pas 1: o mânuță care se plimbă în buclă peste cele 3
  // butoane ca să arate userului nou unde să apese. Modulul e proiectat să fie
  // extins (tap simulat, tunel, flux numere) fără a-i schimba scheletul.

  // Material "touch_app" — mânuță care atinge o suprafață.
  const HAND_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6C13 6.67 12.33 6 11.5 6S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.92-1.4z"/>' +
    "</svg>";

  const HOVER_MS = 600; // staționare deasupra unui buton
  const GLIDE_MS = 800; // glisare între butoane

  let dom = null;
  let layerEl = null;
  let handEl = null;
  let rafId = null;

  // stare animație
  let clock = 0;
  let lastTs = 0;
  let mode = "hover"; // "hover" | "glide"
  let segStart = 0;
  let idx = 0;
  let prevIdx = 0;
  let tappedThisHover = false;

  function profile() {
    return global.AsnwProfile;
  }
  function isOn(key) {
    return profile()?.isEffective?.(key) === true;
  }
  function isPaused() {
    return dom?.gameEl?.classList.contains("is-paused") === true;
  }
  function handActive() {
    return isOn("handOverButtons");
  }
  function anyActive() {
    return handActive() || isOn("simulateTap");
  }

  function buttonCount() {
    return dom?.optionBtns?.length || 0;
  }

  function ensureLayer() {
    const host = dom?.divArena;
    if (!host) return null;
    if (!layerEl || layerEl.parentElement !== host) {
      layerEl = document.createElement("div");
      layerEl.className = "asnw-onboarding-layer";
      layerEl.setAttribute("aria-hidden", "true");
      host.appendChild(layerEl);
    }
    return layerEl;
  }

  function ensureHand() {
    const layer = ensureLayer();
    if (!layer) return null;
    if (!handEl || handEl.parentElement !== layer) {
      handEl = document.createElement("div");
      handEl.className = "asnw-hand";
      handEl.innerHTML = HAND_SVG;
      layer.appendChild(handEl);
    }
    return handEl;
  }

  // Centrul NUMĂRULUI din buton (`.prime`), relativ la strat. Butoanele sunt
  // înalte și au numărul sus, deci ne ancorăm pe cifră, nu pe centrul butonului.
  // Vârful degetului mânuții se așază exact pe acest punct.
  function buttonPos(i) {
    const btn = dom?.optionBtns?.[i];
    const layer = layerEl;
    if (!btn || !layer) return null;
    const target = btn.querySelector(".prime") || btn;
    const r = target.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - lr.left,
      y: r.top + r.height / 2 - lr.top,
    };
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // Cercuri concentrice care se sting, pornind din centrul numărului. Simulează
  // efectul vizual al unui tap. Se declanșează o dată per oprire deasupra unui
  // buton (sincronizat cu staționarea mânuții).
  // Poziția semnului „?” din întrebare (relativ la strat), indiferent de modul
  // lift (mobil, în mișcare, sau host fix bară/mingie). Întoarce null dacă „?”
  // nu există (ex. răspuns deja dezvăluit) sau nu e vizibil.
  function questionMarkPos() {
    const qEl = dom?.topNumberEl?.querySelector(".q-mark, .q-q");
    const layer = layerEl;
    if (!qEl || !layer) return null;

    // `?` e randat cu spații în jur (`<span class="q-mark"> ? </span>`), deci
    // rect-ul span-ului e descentrat. Măsurăm exact glyph-ul `?` cu un Range.
    let rect = null;
    const txt = qEl.firstChild;
    if (txt && txt.nodeType === 3) {
      const s = txt.data.indexOf("?");
      if (s >= 0) {
        try {
          const range = document.createRange();
          range.setStart(txt, s);
          range.setEnd(txt, s + 1);
          const rr = range.getBoundingClientRect();
          if (rr.width || rr.height) rect = rr;
        } catch (e) {
          /* fallback mai jos */
        }
      }
    }
    if (!rect) rect = qEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;

    const lr = layer.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - lr.left,
      y: rect.top + rect.height / 2 - lr.top,
    };
  }

  function spawnRipple(pos) {
    const layer = ensureLayer();
    if (!layer || !pos) return;
    const ripple = document.createElement("div");
    ripple.className = "asnw-ripple";
    ripple.style.left = `${pos.x}px`;
    ripple.style.top = `${pos.y}px`;
    for (let i = 0; i < 3; i++) {
      const ring = document.createElement("span");
      ring.className = "asnw-ripple-ring";
      ring.style.animationDelay = `${i * 160}ms`;
      ripple.appendChild(ring);
    }
    layer.appendChild(ripple);
    setTimeout(() => ripple.remove(), 1200);
  }

  function placeHand(x, y) {
    if (!handEl) return;
    handEl.style.left = `${x}px`;
    handEl.style.top = `${y}px`;
  }

  function showHand(on) {
    if (!handEl) return;
    handEl.classList.toggle("is-visible", on);
  }

  function stopLoop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTs = 0;
  }

  function startLoop() {
    if (rafId == null) {
      lastTs = 0;
      rafId = requestAnimationFrame(loop);
    }
  }

  function loop(ts) {
    if (!anyActive()) {
      showHand(false);
      stopLoop();
      return;
    }

    const count = buttonCount();
    if (count <= 0) {
      rafId = requestAnimationFrame(loop);
      return;
    }
    if (idx >= count) idx = 0;
    if (prevIdx >= count) prevIdx = 0;

    if (!lastTs) lastTs = ts;
    let dt = ts - lastTs;
    lastTs = ts;
    if (isPaused()) dt = 0;
    clock += dt;

    // Mașina de stare (ciclare peste butoane + declanșare tap) rulează mereu cât
    // timp modulul e activ — independent de vizibilitatea mânuții. Astfel bifa
    // „simuleaza tap” funcționează și cu mânuța debifată (cercurile apar pe rând
    // pe câte un număr).
    const cur = buttonPos(idx);
    let x = cur ? cur.x : 0;
    let y = cur ? cur.y : 0;

    if (cur) {
      if (mode === "hover") {
        x = cur.x;
        y = cur.y;
        if (!tappedThisHover) {
          tappedThisHover = true;
          if (isOn("simulateTap")) {
            spawnRipple(cur);
            if (isOn("tapRippleOnQuestion")) {
              const qp = questionMarkPos();
              if (qp) spawnRipple(qp);
            }
          }
        }
        if (clock - segStart >= HOVER_MS) {
          prevIdx = idx;
          idx = (idx + 1) % count;
          mode = "glide";
          segStart = clock;
          tappedThisHover = false;
        }
      } else {
        const from = buttonPos(prevIdx);
        const to = buttonPos(idx);
        if (from && to) {
          const p = Math.min(1, (clock - segStart) / GLIDE_MS);
          x = from.x + (to.x - from.x) * easeInOut(p);
          y = from.y + (to.y - from.y) * easeInOut(p);
          if (p >= 1) {
            mode = "hover";
            segStart = clock;
            x = to.x;
            y = to.y;
          }
        }
      }
    }

    if (handActive()) {
      ensureHand();
      showHand(true);
      placeHand(x, y);
    } else {
      showHand(false);
    }

    rafId = requestAnimationFrame(loop);
  }

  function init(domRef) {
    dom = domRef;
    sync();
  }

  // Pornit/oprit în funcție de bifele ASNW. Idempotent.
  function sync() {
    if (!dom) return;
    if (anyActive()) {
      ensureLayer();
      if (handActive()) ensureHand();
      startLoop();
    } else {
      showHand(false);
      stopLoop();
    }
  }

  global.AsnwOnboarding = {
    init,
    sync,
  };
})(window);
