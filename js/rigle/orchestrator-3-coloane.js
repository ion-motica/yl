/**
 * Orchestrator de subquizuri pentru motorul cu 3 coloane (m2, `js/rigle/engine.js`).
 *
 * NU e o variantă a lui `js/subquiz/subquiz-orchestrator.js` și cele două **nu se
 * unifică** — decizie explicită (23.08.2026). Motivul nu e rutarea (push/pop de
 * acolo e exact forma potrivită), ci **contractul de date**:
 *
 *   - Orchestratorul comun produce `view = {prompt, options[3], correctIndex}` —
 *     etichete text pentru butoanele lui `falling-engine.js` (m1) — și construiește
 *     un `Motor3Butoane` per subquiz care decide singur „avansează/rămâi".
 *   - Motorul cu 3 coloane nu consumă view-uri: **trage** un fact
 *     `{intrebare, grupe, latimiColoane}` prin `cfg.urmatorulFact()` și randează
 *     singur, iar avansul îl decide coborârea fizică, nu M3B. `latimiColoane` nu
 *     sunt etichete, sunt lățimi care dictează geometria.
 *
 * Adaptarea ar fi însemnat să arunc exact partea pentru care există orchestratorul
 * comun și să păstrez doar numărătoarea. Vezi `documente de referinta/RIGLE-REFERENCE.md`.
 *
 *   Orchestrator3Coloane.creeaza({ context, definitii, ruta, laRutaCompleta })
 *     → { urmatorulFact, laApasare, reseteaza, setRuta, getRuta, idCurent,
 *         numeCurent, tureTotalePeRuta }
 *
 * `definitii`: [{ id, nume, ture, creeaza(context) → { urmatorulFact(), laApasare?(info) } }]
 * `ruta`: listă de id-uri, în ordinea rulării. **Ruta e date, nu cod** — subquizurile
 *   sunt cârje temporare la care se renunță pe drumul spre fluență, deci scoaterea
 *   unuia = ștergi id-ul din rută (sau `setRuta`), nu operezi pe `if`-uri. Lungimea
 *   unui ciclu se derivă din rută (`tureTotalePeRuta`), nu invers.
 * `laRutaCompleta`: () => boolean — chemat când s-a terminat ULTIMUL subquiz din
 *   rută. Quizul face ce înseamnă asta la el (avans de nivel) și întoarce `false`
 *   ca să oprească definitiv (nicio rută nouă), altceva ca să repornească ruta.
 * `context`: obiect partajat, dat fiecărui subquiz la creare. Identitatea lui
 *   rămâne stabilă tot timpul — quizul îl mută pe loc (ex. `xLucrate.clear()`),
 *   nu îl înlocuiește, altfel subquizurile create mai devreme ar ține o referință
 *   moartă.
 */
(function (global) {
  "use strict";

  function creeaza(config) {
    const cfg = config || {};
    const context = cfg.context ?? {};
    const laRutaCompleta = cfg.laRutaCompleta;

    const definitii = new Map();
    (cfg.definitii ?? []).forEach((def) => {
      if (!def || !def.id) throw new Error("Orchestrator3Coloane: definiție fără id.");
      if (typeof def.creeaza !== "function") {
        throw new Error(`Orchestrator3Coloane: subquizul "${def.id}" nu are creeaza().`);
      }
      // „ture" e singurul criteriu de terminare azi, fiindcă ambele subquizuri reale
      // au lungime fixă. Un subquiz cu lungime variabilă („până la 3 corecte la rând")
      // va cere un `esteTerminat()` — se adaugă atunci, nu acum (razgandire-ieftina.md:
      // nu construi pentru un caz ipotetic).
      if (!Number.isInteger(def.ture) || def.ture < 1) {
        throw new Error(`Orchestrator3Coloane: subquizul "${def.id}" are "ture" invalid (${def.ture}).`);
      }
      definitii.set(def.id, def);
    });

    function filtreazaRuta(ids) {
      return (ids ?? []).filter((id) => definitii.has(id));
    }

    let ruta = filtreazaRuta(cfg.ruta ?? [...definitii.keys()]);
    let index = -1;
    let runtime = null;
    let tureConsumate = 0;

    function definitiaCurenta() {
      return index >= 0 && index < ruta.length ? definitii.get(ruta[index]) : null;
    }

    function porneste(nou) {
      index = nou;
      tureConsumate = 0;
      runtime = definitiaCurenta().creeaza(context);
    }

    // Singura cale prin care se produce un fact. Întoarce `null` DOAR când
    // `laRutaCompleta` a spus stop — motorul tratează null ca „nu schimba factul"
    // (engine.js: `if (fact) schimbaFact(fact)`), deci ultimul fact rămâne pe ecran.
    function urmatorulFact() {
      if (!ruta.length) return null;

      if (!runtime) {
        porneste(0);
      } else if (tureConsumate >= definitiaCurenta().ture) {
        if (index + 1 < ruta.length) {
          porneste(index + 1);
        } else {
          if (laRutaCompleta?.() === false) return null;
          porneste(0);
        }
      }

      tureConsumate += 1;
      return runtime.urmatorulFact();
    }

    // Apăsare pe o coloană — doar bookkeeping-ul subquizului activ (recozi, greșeli).
    // Logarea în jurnal rămâne la quiz: e la fel pentru orice subquiz.
    function laApasare(info) {
      runtime?.laApasare?.(info);
    }

    // Repornește ruta de la primul subquiz. Folosit când userul schimbă nivelul
    // manual: starea rutei (ce subquiz, a câta tură) nu are sens peste un nivel nou.
    function reseteaza() {
      index = -1;
      runtime = null;
      tureConsumate = 0;
    }

    function setRuta(ids) {
      ruta = filtreazaRuta(ids);
      reseteaza();
    }

    return {
      urmatorulFact,
      laApasare,
      reseteaza,
      setRuta,
      getRuta: () => [...ruta],
      idCurent: () => definitiaCurenta()?.id ?? null,
      numeCurent: () => definitiaCurenta()?.nume ?? "",
      tureTotalePeRuta: () => ruta.reduce((sum, id) => sum + definitii.get(id).ture, 0),
    };
  }

  global.Orchestrator3Coloane = { creeaza };
})(window);
