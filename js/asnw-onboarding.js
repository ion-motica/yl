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
  const FLUX_DURATION = 1500; // timp ca un număr să urce de la buton la „?”
  const FLUX_DEFAULT_COUNT = 6;

  // --- Decădere graduală a ghidajelor (fade pe zile + răspunsuri) ---------
  // Un singur contor `p` (0..9) descrie cât de estompat e onboarding-ul.
  // Ordine fixă: flux (1..3) → cerculețe (4..6) → mânuță (7..9). La p=9 totul
  // dispărut. Fiecare element are 4 stări (plin → fade1 → fade2 → ascuns)
  // atinse în 3 trepte. Vezi mapările `localStage`/`fadeFactor`.
  //
  // Comportament: fiecare ZI de utilizare pornește de la maxim (p=0) și se
  // estompează cu o treaptă la fiecare 3 răspunsuri corecte CONSECUTIVE. Fără
  // nicio revenire: un răspuns greșit doar rupe seria de corecte (p neschimbat).
  // Activ în primele 3 zile distincte; după aceea dispare — dacă bifa
  // „onboardingPersist” nu e pornită, caz în care ciclul zilnic continuă.
  const FADE_MAX = 9;
  const ACTIVE_DAYS = 3; // zilele 1..3 = activ (apoi off, dacă nu persistă)
  const CORRECT_TO_FADE = 3; // 3 răspunsuri corecte consecutive → o treaptă de fade
  const STAGE_OPACITY = [1, 0.6, 0.3, 0]; // factor opacitate per treaptă locală
  const ELEMENT_OFFSET = { flux: 0, ripple: 3, hand: 6 };
  const STORE_KEY = "asnwOnb";

  /** @type {{p:number,streak:number,firstDate:?string,distinctDays:number,lastDay:?string}|null} */
  let prog = null;
  let nowFn = () => new Date();

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
  let dir = 1; // sens de parcurgere ping-pong: 1 (→) / -1 (←)
  let tappedThisHover = false;
  /** @type {{ el: HTMLElement, phase: number }[]} */
  let fluxParticles = [];
  /** Ripple-uri de pe „?” care trebuie să urmeze semnul cât timp liftul se mișcă. */
  let qRipples = [];

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

  // ---- Controller de decădere graduală -----------------------------------
  function masterOn() {
    return profile()?.isMasterOn?.() === true;
  }

  function defaultProg() {
    return {
      p: 0,
      streak: 0,
      firstDate: null,
      distinctDays: 0,
      lastDay: null,
      dayOffset: 0, // doar pentru testare: simulează zile trecute (buton CP)
    };
  }

  function persistOn() {
    return isOn("onboardingPersist");
  }

  function loadProg() {
    const raw = global.LayoutConfig?.get(STORE_KEY, null);
    prog =
      raw && typeof raw === "object"
        ? { ...defaultProg(), ...raw }
        : defaultProg();
  }

  function saveProg() {
    global.LayoutConfig?.set(STORE_KEY, prog);
  }

  function ensureProg() {
    if (!prog) loadProg();
    return prog;
  }

  function dateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function today() {
    const base = nowFn();
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const off = ensureProg().dayOffset || 0;
    if (off) d.setDate(d.getDate() + off);
    return dateStr(d);
  }

  // Înregistrează ziua curentă ca „zi de utilizare” distinctă. La fiecare zi
  // nouă, onboarding-ul repornește de la maxim (p=0, toate pline).
  function registerUsageDay() {
    ensureProg();
    const d = today();
    if (prog.lastDay === d) return false;
    if (!prog.firstDate) prog.firstDate = d;
    prog.distinctDays = (prog.distinctDays || 0) + 1;
    prog.lastDay = d;
    prog.p = 0; // zi nouă → full din nou
    prog.streak = 0;
    saveProg();
    return true;
  }

  // "off" (master debifat sau expirat după 3 zile fără persistență) sau
  // "active" (zilele 1..3, ori oricând dacă „onboardingPersist” e pornit).
  function currentMode() {
    if (!masterOn()) return "off";
    ensureProg();
    if (persistOn()) return "active";
    return prog.distinctDays <= ACTIVE_DAYS ? "active" : "off";
  }

  // Treapta locală (0..3) a unui element, după mod și progres global.
  function localStage(key) {
    if (currentMode() === "off") return 3;
    const s = ensureProg().p - ELEMENT_OFFSET[key];
    return Math.max(0, Math.min(3, s));
  }

  function fadeFactor(key) {
    return STAGE_OPACITY[localStage(key)];
  }

  function fluxStageCount() {
    const base = flowCount();
    switch (localStage("flux")) {
      case 0:
        return base;
      case 1:
        return Math.max(1, Math.round(base * 0.66));
      case 2:
        return Math.max(1, Math.round(base * 0.33));
      default:
        return 0;
    }
  }

  // Câmpul vizibil acum (flag pornit ȘI treapta < 3).
  function fluxVisible() {
    return isOn("numbersFlowToQ") && localStage("flux") < 3;
  }
  function rippleVisible() {
    return isOn("simulateTap") && localStage("ripple") < 3;
  }
  function handVisible() {
    return handActive() && localStage("hand") < 3;
  }

  function anyActive() {
    return fluxVisible() || rippleVisible() || handVisible();
  }

  // Apelat din motor la fiecare răspuns. Estompează o treaptă la fiecare 3
  // răspunsuri corecte CONSECUTIVE; fără nicio revenire. Un răspuns greșit real
  // doar rupe seria de corecte (p neschimbat). Timeout-urile (cutia ajunge jos
  // fără apăsare) trimit `answered:false` și sunt ignorate complet.
  function notifyAnswer(outcome) {
    if (!masterOn()) return;
    if (outcome && outcome.answered === false) return;
    registerUsageDay();
    if (currentMode() !== "active") {
      sync();
      return;
    }
    if (outcome?.correct === true) {
      prog.streak = (prog.streak || 0) + 1;
      if (prog.streak >= CORRECT_TO_FADE) {
        prog.streak = 0;
        if (prog.p < FADE_MAX) prog.p += 1; // o treaptă de fade
      }
    } else {
      prog.streak = 0; // greșeală reală rupe seria; fără revenire
    }
    saveProg();
    sync();
  }

  // Apelat din motor la începutul fiecărei întrebări (pentru reminderul zilnic).
  function notifyNewQuestion() {
    if (!masterOn()) return;
    registerUsageDay();
    sync();
  }

  function resetProgress() {
    prog = defaultProg();
    saveProg();
    sync();
    updateDebugStatus();
  }

  // --- Ajutoare de testare în CP ------------------------------------------
  let debugStatusEl = null;

  function updateDebugStatus() {
    if (!debugStatusEl) return;
    ensureProg();
    debugStatusEl.textContent = `zi ${prog.distinctDays} · fade ${prog.p}/${FADE_MAX} · ${currentMode()}`;
  }

  function setDebugStatusEl(el) {
    debugStatusEl = el || null;
    updateDebugStatus();
  }

  // Simulează trecerea la ziua următoare (resetează onboarding-ul la full ca
  // într-o zi nouă reală). Util pentru a verifica ciclul pe zile fără a umbla
  // la ceasul sistemului.
  function debugAdvanceDay() {
    ensureProg();
    prog.dayOffset = (prog.dayOffset || 0) + 1;
    saveProg();
    registerUsageDay();
    sync();
    updateDebugStatus();
  }

  // Câte numere curg simultan pe traseu (slider „cate numere de la buton la ?”).
  function flowCount() {
    const v = global.LayoutConfig?.get("asnwNumbersFlowCount", FLUX_DEFAULT_COUNT);
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return FLUX_DEFAULT_COUNT;
    return Math.max(1, Math.min(36, n));
  }

  function clearFlux() {
    if (fluxParticles.length === 0) return;
    fluxParticles.forEach((p) => p.el.remove());
    fluxParticles = [];
  }

  function ensureFluxParticles(n) {
    const layer = ensureLayer();
    if (!layer) return;
    while (fluxParticles.length < n) {
      const el = document.createElement("div");
      el.className = "asnw-flux-num";
      layer.appendChild(el);
      fluxParticles.push({ el, phase: fluxParticles.length / n });
    }
    while (fluxParticles.length > n) {
      fluxParticles.pop().el.remove();
    }
  }

  // Mai multe numere transparente urcă simultan de la numărul butonului curent
  // spre „?”, decalate. Când unul ajunge la „?”, reîncepe de la buton.
  function updateFlux(origin, qPos, numText, dt, count, opacityFactor = 1) {
    if (!origin || !qPos || numText == null || count <= 0) {
      clearFlux();
      return;
    }
    ensureFluxParticles(count);
    const dp = dt / FLUX_DURATION;
    for (const p of fluxParticles) {
      p.phase += dp;
      if (p.phase >= 1) p.phase -= 1;
      const t = p.phase;
      const x = origin.x + (qPos.x - origin.x) * t;
      const y = origin.y + (qPos.y - origin.y) * t;
      p.el.style.left = `${x}px`;
      p.el.style.top = `${y}px`;
      // transparent, cu fade la capete (modulat de treapta de decădere)
      p.el.style.opacity = String(Math.sin(t * Math.PI) * 0.45 * opacityFactor);
      if (p.el.textContent !== numText) p.el.textContent = numText;
    }
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

  // Indexul butonului mare (`.option`) aflat sub punctul (x,y) al mânuții, în
  // coordonate relative la strat; -1 dacă e în spațiul dintre butoane.
  function bigButtonUnder(x, y) {
    const layer = layerEl;
    if (!layer || !dom?.optionBtns) return -1;
    const lr = layer.getBoundingClientRect();
    const absX = lr.left + x;
    const absY = lr.top + y;
    for (let i = 0; i < dom.optionBtns.length; i++) {
      const r = dom.optionBtns[i].getBoundingClientRect();
      if (absX >= r.left && absX <= r.right && absY >= r.top && absY <= r.bottom) {
        return i;
      }
    }
    return -1;
  }

  // Cercuri concentrice care se sting, pornind din centrul numărului. Simulează
  // efectul vizual al unui tap. Se declanșează o dată per oprire deasupra unui
  // buton (sincronizat cu staționarea mânuții).
  // Poziția placeholderului de răspuns din întrebare (relativ la strat),
  // indiferent de modul lift (mobil, în mișcare, sau host fix bară/mingie).
  // Întoarce null dacă nu există (ex. răspuns deja dezvăluit) sau nu e vizibil.
  //
  // Clasa vine din contractul comun (js/placeholder-raspuns.js). `.q-q` e
  // formatul `division-eq`, încă nemigrat — se scoate la pasul următor.
  function questionMarkPos() {
    const clasa = global.PlaceholderRaspuns?.CLASA ?? "placeholder-pt-raspuns";
    const qEl = dom?.topNumberEl?.querySelector(`.${clasa}, .q-q`);
    const layer = layerEl;
    if (!qEl || !layer) return null;

    // `?` e randat cu spații în jur (`<span class="..."> ? </span>`), deci
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

  function spawnRipple(pos, opacityFactor = 1) {
    const layer = ensureLayer();
    if (!layer || !pos) return;
    const ripple = document.createElement("div");
    ripple.className = "asnw-ripple";
    ripple.style.left = `${pos.x}px`;
    ripple.style.top = `${pos.y}px`;
    if (opacityFactor < 1) ripple.style.opacity = String(opacityFactor);
    for (let i = 0; i < 3; i++) {
      const ring = document.createElement("span");
      ring.className = "asnw-ripple-ring";
      ring.style.animationDelay = `${i * 160}ms`;
      ripple.appendChild(ring);
    }
    layer.appendChild(ripple);
    setTimeout(() => ripple.remove(), 1200);
    return ripple;
  }

  function placeHand(x, y) {
    if (!handEl) return;
    handEl.style.left = `${x}px`;
    handEl.style.top = `${y}px`;
  }

  function showHand(on) {
    if (!handEl) return;
    handEl.classList.toggle("is-visible", on);
    // La ascundere curățăm opacitatea inline setată în loop, altfel ar
    // suprascrie `opacity:0` din CSS și mânuța ar rămâne fixă, slab vizibilă
    // (mai ales la capătul celor 9 etape, când ar trebui să dispară complet).
    if (!on) handEl.style.opacity = "";
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
      clearFlux();
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
          if (rippleVisible()) {
            const rf = fadeFactor("ripple");
            spawnRipple(cur, rf);
            if (isOn("tapRippleOnQuestion")) {
              const qp = questionMarkPos();
              if (qp) {
                const qr = spawnRipple(qp, rf);
                if (qr) {
                  qRipples.push(qr);
                  setTimeout(() => {
                    const i = qRipples.indexOf(qr);
                    if (i >= 0) qRipples.splice(i, 1);
                  }, 1200);
                }
              }
            }
          }
        }
          if (clock - segStart >= HOVER_MS) {
            prevIdx = idx;
            // ping-pong: 0→1→2→1→0→1→2… (nu sare de la ultimul la primul)
            if (count > 1) {
              if (idx + dir > count - 1 || idx + dir < 0) dir = -dir;
              idx += dir;
            }
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

    if (handVisible()) {
      ensureHand();
      showHand(true);
      placeHand(x, y);
      handEl.style.opacity = String(0.97 * fadeFactor("hand"));
    } else {
      showHand(false);
    }

    // Fluxul curge cât timp mânuța e peste un buton mare; pornește imediat ce
    // intră pe noul buton mare (nu doar pe centrul numărului) și încetează în
    // spațiul dintre butoane, până ajunge pe următorul.
    const overBtn = bigButtonUnder(x, y);
    if (fluxVisible() && overBtn >= 0) {
      const numText =
        dom.optionBtns[overBtn]?.querySelector(".prime")?.textContent ?? null;
      updateFlux(
        { x, y },
        questionMarkPos(),
        numText,
        dt,
        fluxStageCount(),
        fadeFactor("flux")
      );
    } else {
      clearFlux();
    }

    // Ripple-urile de pe „?” urmează semnul cât liftul se mișcă (altfel rămân în
    // urmă, fiindcă „?” își schimbă poziția pe parcursul animației ripple-ului).
    if (qRipples.length) {
      const qp = questionMarkPos();
      if (qp) {
        for (const qr of qRipples) {
          qr.style.left = `${qp.x}px`;
          qr.style.top = `${qp.y}px`;
        }
      }
    }

    rafId = requestAnimationFrame(loop);
  }

  function init(domRef) {
    dom = domRef;
    loadProg();
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
      clearFlux();
      stopLoop();
    }
    updateDebugStatus();
  }

  global.AsnwOnboarding = {
    init,
    sync,
    notifyAnswer,
    notifyNewQuestion,
    resetProgress,
    debugAdvanceDay,
    setDebugStatusEl,
    getMode: currentMode,
    getFade: () => ensureProg().p,
    getProgress: () => ({ ...ensureProg() }),
    localStage,
    // Hook-uri pentru teste (data injectabilă + reîncărcare stare).
    _setNowForTest: (fn) => {
      nowFn = typeof fn === "function" ? fn : () => new Date();
    },
    _reload: loadProg,
  };
})(window);
