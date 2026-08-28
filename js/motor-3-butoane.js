// MOTOR 3 BUTOANE (M3B) — preluarea raspunsurilor, comuna TUTUROR quizurilor
// si subquizurilor, prezente si viitoare.
//
// Vezi `documente de referinta/PLAN-motor-comun-raspuns.md`.
//
// ============================ REGULA UNICA ==================================
//
//   Apesi pe butonul corect  -> treci la intrebarea urmatoare.
//   Apesi pe un buton gresit -> ramai pe ACEEASI intrebare, se marcheaza
//                               butonul gresit, se asteapta inca o apasare.
//
// Fara limita de incercari: se poate apasa de 3000 de ori pe butoanele gresite,
// intrebarea NU se schimba. Nu exista nicio cale prin care o intrebare avanseaza
// fara raspuns corect.
//
// ============================ TUR vs. APASARE ===============================
//
// Un TUR = o intrebare, cu toate apasarile ei. La un tur se poate apasa de multe
// ori pe butoanele cu variantele de raspuns, pana se apasa in sfarsit pe cel
// corect. Fiecare apasare e consemnata separat in jurnal (ML), DAR corectitudinea
// turului e data DOAR de prima apasare:
//
//   - prima apasare corecta            -> turul e corect;
//   - prima apasare gresita            -> turul e GRESIT, oricate apasari ar mai
//                                         urma pana la butonul corect.
//
// Apasarile de dupa prima gresita nu sunt raspunsuri noi care se re-evalueaza —
// sunt sanse de corectare (principiu pedagogic: feedback imediat). Ele schimba ce
// apasa copilul mai departe, nu verdictul turului.
//
// M3B numara apasarile din turul curent si expune `numar_turn_apasare`, `este_primul_turn_apasare`
// si `corect_din_primul_turn_apasare` in contextul actiunilor, ca fiecare quiz sa NU-si recalculeze
// singur „corect din prima" (de-acolo ar diverge implementarile).
//
// ============================ CELE 4 MOMENTE ================================
//
// Un quiz poate cere actiuni (pauze, animatii, dezvaluirea raspunsului in locul
// lui „?") in patru momente. Fiecare actiune primeste contextul si intoarce
// campuri de vedere (DATE, nu efecte) — asa raman testabile fara DOM:
//
//   1. inainteDeAfisareaIntrebarii
//   2. dupaAfisareaIntrebarii
//   3. inainte_de_turn_apasare  — la FIECARE apasare, corecta sau nu
//   4. dupa_turn_apasare       — la FIECARE apasare, corecta sau nu
//
// ============================ ARTICULAREA ===================================
//
//   mr  (motor randare, `js/falling-engine.js`) — deseneaza si prinde apasarile.
//       Cheama `quiz.onAnswer(index)`; M3B produce raspunsul, inclusiv eticheta
//       `outcome`. Un quiz nu mai scrie `outcome` de mana — de-acolo veneau
//       bug-urile de ecran desincronizat de starea reala.
//
//   mq  (motor quizuri, `js/quiz-registry.js`) — inregistreaza quizurile.
//
//   msq (motor subquizuri, `js/subquiz/subquiz-orchestrator.js`) — intrarea si
//       iesirea dintre bucati (push/pop/exit/jump). M3B NU rutează: cand o
//       intrebare e rezolvata, doar paseaza mai departe comanda ceruta de quiz.
//
//   ML  (motor logare, `js/jurnal-intrebari.js`) — consemneaza fiecare apasare.
//       M3B nu logheaza nimic el insusi. Face logarea corecta prin constructie:
//       tinand intrebarea neschimbata pe raspuns gresit, `roundSignature` din mr
//       ramane acelasi, deci `al_catelea_turn_apasare_pe_buton` numara 1, 2, 3... in
//       acelasi tur. Pe baza acelui camp, `motor-analiza.js` grupeaza apasarile
//       pe intrebari (`grupeazaApasarilePeIntrebari`) si calculeaza
//       `corect_din_prima` strict din prima apasare a grupului.

(function (global) {
  "use strict";

  // Semnatura pusa pe orice rezultat produs aici. mr o verifica si refuza
  // rezultatele care nu vin din M3B — asa devine imposibil ca un quiz sa-si
  // scrie propria logica de preluare a raspunsurilor.
  const SEMNATURA = "motor-3-butoane-v1";

  function campuriDinActiune(actiune, context) {
    if (actiune == null) return {};
    if (typeof actiune !== "function") {
      throw new Error("Motor3Butoane: actiunile trebuie sa fie functii.");
    }
    return actiune(context) || {};
  }

  function textDinMesaj(mesaj, context) {
    if (mesaj == null) return undefined;
    return typeof mesaj === "function" ? mesaj(context) : mesaj;
  }

  function creeaza(config = {}) {
    if (typeof config.esteCorect !== "function") {
      throw new Error("Motor3Butoane: lipseste `esteCorect(item, index)`.");
    }
    if (typeof config.intrebareUrmatoare !== "function") {
      throw new Error("Motor3Butoane: lipseste `intrebareUrmatoare(context)`.");
    }

    const actiuni = config.actiuni ?? {};
    const mesaje = config.mesaje ?? {};

    // Starea unui singur tur: cate apasari au fost pe intrebarea curenta.
    // Se reseteaza cand se afiseaza o intrebare noua.
    let numarTurnApasareCurent = 0;

    function campuriLaAfisare(context) {
      numarTurnApasareCurent = 0;
      return {
        ...campuriDinActiune(actiuni.inainteDeAfisareaIntrebarii, context),
        ...campuriDinActiune(actiuni.dupaAfisareaIntrebarii, context),
      };
    }

    // Se cheama cand o intrebare e pusa pe ecran (inclusiv prima dintr-un
    // subquiz). Deschide un tur nou.
    function laAfisareaIntrebarii(context = {}) {
      return campuriLaAfisare(context);
    }

    // Punctul unic prin care trece ORICE apasare de buton, din orice quiz.
    //
    // `construiesteVedere(extra)` e cusatura catre mr: intr-un subquiz e
    // `(extra) => runtime.view(extra)`. O primim ca parametru (nu o cautam
    // singuri) ca M3B sa ramana pur si testabil fara DOM.
    function laApasareButon(contextApel = {}) {
      const { item, index, stare, meta = {}, construiesteVedere } = contextApel;

      if (typeof construiesteVedere !== "function") {
        throw new Error("Motor3Butoane: lipseste `construiesteVedere(extra)`.");
      }

      numarTurnApasareCurent += 1;
      const corect = config.esteCorect(item, index) === true;
      const este_primul_turn_apasare = numarTurnApasareCurent === 1;

      const context = {
        item,
        index,
        stare,
        meta,
        corect,
        alesul: item?.options?.[index],
        numar_turn_apasare: numarTurnApasareCurent,
        este_primul_turn_apasare,
        // Verdictul turului: dat DOAR de prima apasare. Are sens abia cand
        // turul se incheie (adica la apasarea corecta), dar il expunem mereu,
        // ca quizul sa nu-l recalculeze singur.
        corect_din_primul_turn_apasare: corect && este_primul_turn_apasare,
      };

      const inainte = campuriDinActiune(actiuni.inainte_de_turn_apasare, context);
      const dupa = campuriDinActiune(actiuni.dupa_turn_apasare, context);

      if (!corect) {
        // Singurul comportament posibil pe gresit: ramai pe aceeasi intrebare.
        // Nu se cheama `intrebareUrmatoare`, nu se atinge nimic din starea
        // intrebarii curente, turul NU se inchide. `outcome: "wrong-answer"`
        // ii spune lui mr exact asta: nu randa, marcheaza butonul apasat,
        // asteapta alta apasare.
        return {
          action: "stay",
          motor3Butoane: SEMNATURA,
          view: construiesteVedere({
            outcome: "wrong-answer",
            correct: false,
            flash: "wrong",
            message: textDinMesaj(mesaje.gresit, context),
            ...inainte,
            ...dupa,
            motor3Butoane: SEMNATURA,
          }),
        };
      }

      // De aici: s-a apasat butonul corect, deci turul se incheie. Abia acum
      // are voie quizul sa-si numere progresul si sa ceara o schimbare de ruta
      // (push/pop/exit prin msq). Niciodata la o apasare gresita.
      const comandaDeRutare = campuriDinActiune(actiuni.dupaRaspunsCorect, context);
      const campuriCorect = {
        outcome: "step-correct",
        correct: true,
        bounce: true,
        message: textDinMesaj(mesaje.corect, context),
        ...inainte,
        ...dupa,
        motor3Butoane: SEMNATURA,
      };

      if (comandaDeRutare && comandaDeRutare.action) {
        // Rutarea propriu-zisa ramane treaba lui msq — noi doar pasam comanda.
        // Turul urmator se deschide de acolo, prin `laAfisareaIntrebarii`.
        return {
          ...comandaDeRutare,
          motor3Butoane: SEMNATURA,
          view: { ...campuriCorect, ...(comandaDeRutare.view ?? {}) },
        };
      }

      // Fara schimbare de ruta: cerem intrebarea urmatoare. `campuriLaAfisare`
      // deschide turul nou (reseteaza numaratoarea de apasari).
      const itemUrmator = config.intrebareUrmatoare(context);
      const campuriAfisare = campuriLaAfisare({
        item: itemUrmator ?? null,
        stare,
        itemAnterior: item,
      });

      return {
        action: "continue",
        motor3Butoane: SEMNATURA,
        view: construiesteVedere({ ...campuriCorect, ...campuriAfisare }),
      };
    }

    return {
      laAfisareaIntrebarii,
      laApasareButon,
      // Doar pentru diagnostic/teste: cate apasari s-au facut in turul curent.
      numarTurnApasare: () => numarTurnApasareCurent,
    };
  }

  global.Motor3Butoane = {
    creeaza,
    SEMNATURA,
    // mr foloseste asta (Faza C din plan) ca sa refuze orice rezultat care nu
    // vine din M3B.
    esteRezultatValid(rezultat) {
      return Boolean(rezultat) && rezultat.motor3Butoane === SEMNATURA;
    },
  };
})(window);
