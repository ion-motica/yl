(function (global) {
  "use strict";

  // Prima varianta: sir fix [start..stop] cu pas fix, afisat integral ca
  // promptHtml (un <span> per numar). Numarul-intrebare arata un dreptunghi
  // galben cu "?" in locul cifrelor, latimea span-ului ramane egala cu
  // lungimea textului original (font monospace, width in "ch"). La raspuns
  // corect, pozitia curenta avanseaza cu `pas` in directia aleasa; la
  // capatul intervalului reia de la celalalt capat (nu exista inca
  // progresie de niveluri — vine intr-o iteratie ulterioara).

  const QUIZ_ID = "numarare-cu-pas";

  const START_DEFAULT = 0;
  const STOP_DEFAULT = 20;
  const PAS_DEFAULT = 1;
  const DIRECTIE_DEFAULT = "inainte"; // "inainte" | "inapoi"
  const ASCUNSE_STANGA_DEFAULT = 0;
  const ASCUNSE_DREAPTA_DEFAULT = 0;
  const RUN_DELAY_MS = 500;
  const HINT_MESSAGE = "Alege numarul.";

  // Cazul in care un quiz are nevoie de alta STRUCTURA in jurul placeholderului,
  // nu de alt semn: aici celula are fundal galben, iar motorul adauga la revelare
  // clasa `.q-correct` (text galben) — galben pe galben ar fi invizibil. Stilul
  // inline are prioritate fata de clasa si pastreaza contrastul.
  //
  // Se porneste de la handlerul generic si se suprascrie DOAR `marcaj`: semnul,
  // cautarea si inlocuirea raman comune, deci nu pot diverge de restul quizurilor.
  // Vezi js/placeholder-raspuns.js.
  const placeholderGeneric = global.PlaceholderRaspuns.creeaza("?");
  const placeholder = {
    ...placeholderGeneric,
    marcaj: () =>
      `<span class="${placeholderGeneric.clasa}" style="color:var(--bg);">` +
      `${placeholderGeneric.semn}</span>`,
  };

  function createNumarareCuPasQuiz(config = {}) {
    const { shuffle } = global.GameUtils;

    const start = START_DEFAULT;
    const stop = STOP_DEFAULT;
    const pas = PAS_DEFAULT;
    const directie = DIRECTIE_DEFAULT;
    const ascunseStanga = ASCUNSE_STANGA_DEFAULT;
    const ascunseDreapta = ASCUNSE_DREAPTA_DEFAULT;

    let pozitieCurenta = start;
    let options = [];
    let correctIndex = 0;
    let gameCompleted = false;
    let orchestrator = null;

    function listaValori() {
      const valori = [];
      for (let v = start; v <= stop; v += pas) valori.push(v);
      return valori;
    }

    function avanseaza() {
      const valori = listaValori();
      const indexCurent = valori.indexOf(pozitieCurenta);
      let indexNou = directie === "inainte" ? indexCurent + 1 : indexCurent - 1;
      if (indexNou < 0 || indexNou >= valori.length) {
        indexNou = directie === "inainte" ? 0 : valori.length - 1;
      }
      pozitieCurenta = valori[indexNou];
    }

    function construiesteOptiuni() {
      const corect = pozitieCurenta;
      const candidati = [];
      for (let v = start; v <= stop; v++) {
        if (v !== corect) candidati.push(v);
      }
      const gresite = shuffle(candidati).slice(0, 2);
      const triple = shuffle([corect, gresite[0], gresite[1]]);
      options = triple.map(String);
      correctIndex = options.indexOf(String(corect));
    }

    function promptText() {
      return listaValori()
        .map((v) => (v === pozitieCurenta ? "?" : String(v)))
        .join(" ");
    }

    // Trebuie sincronizate manual cu CSS-ul din .numarare-slot (padding).
    const ELEMENTE_PE_RAND = 10;
    const CELL_PADDING_EM = 0.12;
    const FONT_SIZE_REFERINTA_PX = 100;

    // Replica exact formula questionMaxWidth() din falling-engine.js (nu e
    // expusa global) — ca .numarare-sir sa primeasca o latime FIXA (px, nu %)
    // care foloseste toata caseta de intrebare, dar ramane sub pragul unde
    // motorul ar porni sa micsoreze fontul. Latime fixa in px, nu procentuala:
    // motorul masoara cu width:max-content pe elementul parinte, context in
    // care un % pe copil devine nedefinit/circular.
    function latimeDisponibila() {
      const lift = global.document.getElementById("falling");
      if (!lift) return 200;
      const rect = lift.getBoundingClientRect();
      const inner = lift.querySelector(".falling-inner");
      const padX = inner
        ? Math.max(12, (rect.width - inner.clientWidth) / 2 + 8)
        : 16;
      const maxWidth = Math.max(0, Math.floor(rect.width - padX * 2));
      return maxWidth > 0 ? Math.max(120, maxWidth - 8) : 200;
    }

    // Calculeaza cel mai mare font-size (px) la care 10 numere de atatea cifre
    // cate are cel mai mare numar din interval (cazul cel mai lat posibil pe un
    // rand plin) incap exact pe latimea disponibila. Masoara EMPIRIC (element
    // offscreen, aceeasi structura ca randul real), nu presupune teoretic cati
    // px are un "ch" in Segoe UI — mai sigur, indiferent de font/browser.
    function calculeazaFontSizePx(latimeDisp) {
      const cifreMax = Math.max(
        String(Math.abs(start)).length,
        String(Math.abs(stop)).length
      );
      const cifreText = String(stop).padStart(cifreMax, "0");

      const test = global.document.createElement("table");
      test.style.position = "absolute";
      test.style.visibility = "hidden";
      test.style.left = "-9999px";
      test.style.borderCollapse = "collapse";
      test.style.fontFamily = '"Segoe UI", system-ui, sans-serif';
      test.style.fontWeight = "700";
      test.style.fontSize = `${FONT_SIZE_REFERINTA_PX}px`;
      const tr = global.document.createElement("tr");
      for (let i = 0; i < ELEMENTE_PE_RAND; i++) {
        const td = global.document.createElement("td");
        td.style.padding = `0 ${CELL_PADDING_EM}em`;
        td.textContent = cifreText;
        tr.appendChild(td);
      }
      test.appendChild(tr);
      global.document.body.appendChild(test);
      const latimeLaReferinta = test.scrollWidth;
      global.document.body.removeChild(test);

      if (latimeLaReferinta <= 0) return FONT_SIZE_REFERINTA_PX;
      return Math.floor((latimeDisp / latimeLaReferinta) * FONT_SIZE_REFERINTA_PX * 10) / 10;
    }

    // Tabel HTML randat direct (nu div-uri flex construite treptat) — 10
    // coloane fixe, umplute secvential cu tot intervalul (nu se mai opreste la
    // multiplii de 10: pt intervalul 5-16, primul rand e 5..14, al doilea 15-16).
    // Fara clase CSS — tot stilul e inline in HTML (style="..."), ca elementul
    // sa nu depinda deloc de style.css extern (niciun risc de flash nestilizat
    // daca CSS-ul extern intarzie sa se aplice).
    const STIL_CELULA = `padding:0 ${CELL_PADDING_EM}em;text-align:right;`;
    const STIL_CELULA_RASPUNS = `padding:0 ${CELL_PADDING_EM}em;text-align:center;background:var(--win);color:var(--bg);border-radius:0.2em;`;
    const STIL_CELULA_GOL = `padding:0 ${CELL_PADDING_EM}em;visibility:hidden;`;

    function construiestePromptHtml() {
      const valori = listaValori();
      const indexCurent = valori.indexOf(pozitieCurenta);
      const celule = valori.map((valoare, i) => {
        if (valoare === pozitieCurenta) {
          return (
            `<td id="span${valoare}" style="${STIL_CELULA_RASPUNS}">` +
            placeholder.marcaj() +
            `</td>`
          );
        }
        const distanta = i - indexCurent;
        const ascuns =
          (distanta < 0 && distanta >= -ascunseStanga) ||
          (distanta > 0 && distanta <= ascunseDreapta);
        return ascuns
          ? `<td id="span${valoare}" style="${STIL_CELULA_GOL}"></td>`
          : `<td id="span${valoare}" style="${STIL_CELULA}">${valoare}</td>`;
      });

      const randuri = [];
      for (let i = 0; i < celule.length; i += ELEMENTE_PE_RAND) {
        randuri.push(`<tr>${celule.slice(i, i + ELEMENTE_PE_RAND).join("")}</tr>`);
      }

      const latime = latimeDisponibila();
      const fontSize = calculeazaFontSizePx(latime);
      const stilSir = `width:${latime}px;font-size:${fontSize}px;margin:0 auto;text-align:center;font-family:'Segoe UI', system-ui, sans-serif;font-weight:700;color:var(--text);`;
      const stilTitlu = `font-size:0.75em;margin-bottom:0.15em;`;
      const stilTabel = `border-collapse:collapse;margin:0 auto;`;
      return (
        `<div style="${stilSir}">` +
        `<div style="${stilTitlu}">Alege numarul:</div>` +
        `<table style="${stilTabel}">${randuri.join("")}</table>` +
        `</div>`
      );
    }

    function sincronizeazaOrchestratorul() {
      orchestrator.getCurrentRuntime().setCurrentItem({
        prompt: promptText(),
        promptHtml: construiestePromptHtml(),
        options: [...options],
        correctIndex,
      });
    }

    function pregatesteRunda() {
      construiesteOptiuni();
      sincronizeazaOrchestratorul();
    }

    function rundaView(extra = {}) {
      return {
        prompt: promptText(),
        promptHtml: construiestePromptHtml(),
        options: [...options],
        correctIndex,
        hintMessage: extra.hintMessage ?? HINT_MESSAGE,
        ...extra,
      };
    }

    // Motor 3 butoane (M3B) — corect avanseaza, gresit ramane pe aceeasi
    // intrebare. Fiecare numar ghicit e propriul lui "run" (ca la
    // addition-table.js), de-asta outcome-ul e mereu "serie-terminata".
    function baseDefinition() {
      return global.SubquizDefinition.define({
        id: "base",
        title: "baza",
        hintMessage: HINT_MESSAGE,
        esteCorect: (_item, index) => Number(options[index]) === Number(pozitieCurenta),
        generator: () => ({}),
        mesaje: {
          gresit: (ctx) => `${ctx.alesul} nu e numarul corect. Incearca din nou!`,
        },
        actiuni: {
          dupa_turn_apasare: () => ({}),
          dupaRaspunsCorect: () => {
            avanseaza();
            pregatesteRunda();
            return {
              action: "continue",
              view: {
                outcome: "serie-terminata",
                correct: true,
                serie_terminata: true,
                pauza_intre_serii_ms: RUN_DELAY_MS,
                message: "Corect!",
                ...rundaView(),
              },
            };
          },
        },
      });
    }

    orchestrator = global.SubquizOrchestrator.create({
      definitions: [baseDefinition()],
      activeSubquizIds: ["base"],
      context: { quizId: QUIZ_ID },
    });
    orchestrator.startFirst();

    return {
      getLevel: () => 1,
      getMaxLevel: () => 1,
      getLevelLabel: () => "Numarare cu pas",
      getLevelButtonTitle: () => "Numarare cu pas",

      getProgressDisplay: () => global.ProgressDisplay.hidden(),

      isCompleted: () => gameCompleted,
      setCompleted: (value) => {
        gameCompleted = value;
      },

      resetLevelState() {
        pozitieCurenta = start;
        options = [];
        correctIndex = 0;
      },

      switchLevel() {
        gameCompleted = false;
        this.resetLevelState();
        return null;
      },

      placeholderRaspuns: placeholder,
      laSchimbareDeNivel: global.SchimbareDeNivel.standard(),
      beginRound() {
        pregatesteRunda();
        return rundaView();
      },

      onTimeout() {
        return {
          outcome: "timeout",
          flash: "wrong",
          message: "Prea tarziu! Alege numarul corect inainte sa ajunga jos.",
          resetFall: true,
          ...rundaView(),
        };
      },

      onAnswer(index, meta = {}) {
        return orchestrator.onAnswer(index, meta);
      },

      pickNextRound: () => null,
    };
  }

  global.QuizRegistry.register({
    id: QUIZ_ID,
    title: "Numaram din 2 in 2 - inainte si inapoi",
    description: "Sir de numere cu un loc gol; alege numarul corect.",
    gestionareGreseli: { activ: false },
    create: createNumarareCuPasQuiz,
    // Incadrat la "Clasa 0" in js/manage_quiz_order_in_hamburger_menu.js (27.08.2026).
    // La orice quiz nou, intreaba userul explicit la ce clasa/capitol il incadrezi in
    // meniu — nu presupune implicit "Clasa 0" doar pt ca asa a iesit default.
  });
})(window);
