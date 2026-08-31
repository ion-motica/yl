(function (global) {
  "use strict";

  // Spectru rosu -> violet, scalat 0-10 (cerere user, 29.08.2026: culoarea
  // numerelor din bv-uri trebuie sa arate si coloristic "curgerea" valorii).
  const HUE_ROSU = 0;
  const HUE_VIOLET = 270;
  const SCALA_MAX = 10;
  const SATURATIE = 72;
  const LUMINOZITATE = 58;

  function culoareNumar(numar) {
    const valoare = Math.min(SCALA_MAX, Math.max(0, Number(numar) || 0));
    const t = valoare / SCALA_MAX;
    const hue = Math.round(HUE_ROSU + t * (HUE_VIOLET - HUE_ROSU));
    return `hsl(${hue}, ${SATURATIE}%, ${LUMINOZITATE}%)`;
  }

  // bv (bond variant) = o descompunere a+b a numarului de nivel (ex. nivel 6:
  // 1+5,2+4,3+3,4+2,5+1). Randul din tabel e dat de a, crescator — nu de
  // ordinea in care apar bv-urile in joc (care e amestecata).
  function bvPentruNivel(nivel) {
    const bvuri = [];
    for (let a = 1; a < nivel; a++) {
      const b = nivel - a;
      if (b < 1) continue;
      bvuri.push({ a, b, label: `${a}+${b}` });
    }
    return bvuri;
  }

  // Quizul raporteaza doar ce bv-uri au fost rezolvate (label "a+b", nivelul
  // curent); modulul construieste randurile complete ale tabelului — ordine
  // fixa, spatiu rezervat pt. cele nerezolvate inca, culoare per numar pt.
  // cele deja rezolvate.
  function construieste({ nivel, rezolvate }) {
    const rezolvateSet = rezolvate instanceof Set ? rezolvate : new Set(rezolvate ?? []);
    const randuri = bvPentruNivel(nivel).map(({ a, b, label }) => {
      const rezolvat = rezolvateSet.has(label);
      return {
        label,
        rezolvat,
        a: rezolvat ? a : null,
        b: rezolvat ? b : null,
        culoareA: rezolvat ? culoareNumar(a) : null,
        culoareB: rezolvat ? culoareNumar(b) : null,
      };
    });
    return { visible: true, nivel, randuri };
  }

  // Locul rezervat ilustratiei cu mere, dupa al doilea numar din "{nivel}=a+b"
  // (cerere user, 31.08.2026: "plaseaza un caracter spatiu dupa al doilea numar
  // si plaseaza merele peste el"). E un spatiu gol, cu latime data de variabila
  // CSS `--ilustrare-latime` — pusa pe containerul randurilor de
  // js/bond-illustration.js, singurul care stie cat ocupa ilustratia. Aici doar
  // se rezerva locul; nimic din inventar nu calculeaza dimensiuni de mere.
  const LOC_ILUSTRATIE_HTML = `<span class="inventar-bonduri-loc-ilustratie"></span>`;

  // Continutul unui rand (fara div-ul wrapper) — folosit atat de randaHtml
  // (randare completa) cat si de elementeDivIntrebare (patch in loc, vezi mai
  // jos), ca sa nu existe doua locuri care decid cum arata un rand. Randul
  // nerezolvat arata "{nivel}=" urmat de nimic — nu gol (cerere user,
  // 30.08.2026: rectificare fata de varianta initiala complet goala).
  function continutRand(rand, nivel) {
    if (!rand.rezolvat) return `<span class="inventar-bonduri-semn">${nivel}=</span>`;
    return (
      `<span class="inventar-bonduri-semn">${nivel}=</span>` +
      `<span class="inventar-bonduri-numar" style="background-color:${rand.culoareA}">${rand.a}</span>` +
      `<span class="inventar-bonduri-semn">+</span>` +
      `<span class="inventar-bonduri-numar" style="background-color:${rand.culoareB}">${rand.b}</span>` +
      LOC_ILUSTRATIE_HTML
    );
  }

  // Genereaza HTML-ul randurilor (doar randurile, fara wrapper/titlu) — quizul
  // il insereaza direct in propriul promptHtml, in caseta intrebarii. Cerere
  // user (29.08.2026): lista colorata inlocuieste vechiul istoric text
  // (singapore-history), in acelasi loc din caseta, nu langa el intr-un panou
  // separat.
  //
  // Fiecare rand poarta `data-element-div-intrebare="bv-{label}"` — id stabil
  // (labelul "a+b" e unic si nu se schimba cat timp randul exista in tabel),
  // pt. modul de scriere in loc din falling-engine.js (elementeDivIntrebare).
  function randaHtml(inventar) {
    if (!inventar?.visible) return "";
    const randuriHtml = inventar.randuri
      .map((rand) => {
        const clasaGol = rand.rezolvat ? "" : " e-gol";
        return (
          `<div class="inventar-bonduri-rand${clasaGol}" data-element-div-intrebare="bv-${rand.label}">` +
          continutRand(rand, inventar.nivel) +
          `</div>`
        );
      })
      .join("");
    // Clasa "intrebare-ilustrare" (cerere user, 31.08.2026): marcheaza partea
    // de "ilustrare" a promptului, separat de intrebarea curenta propriu-zisa
    // ("linia-curenta", marcata cu "intrebare-propriu-zisa" — vezi quizul).
    // Foloseste-o oriunde ai nevoie sa distingi cele doua bucati (ex. ce
    // ramane vizibil la finalul jocului, ce se citeste ca "intrebare" pt.
    // jurnal/lista de timpi).
    return `<div class="inventar-bonduri-randuri intrebare-ilustrare">${randuriHtml}</div>`;
  }

  // Contractul "Mod scriere intrebare noua" din falling-engine.js: la runda
  // urmatoare, motorul cauta in DOM-ul deja randat elementele cu
  // `data-element-div-intrebare` egal cu fiecare `id` de-aici si le
  // inlocuieste doar continutul (`innerHTML`) — restul promptului (linia
  // curenta, structura din jur) ramane neatins. Daca vreun id lipseste din
  // DOM, motorul cade singur pe randarea completa (randaHtml) — nu e nevoie
  // de fallback aici.
  function elementeDivIntrebare(inventar) {
    if (!inventar?.visible) return [];
    return inventar.randuri.map((rand) => ({
      id: `bv-${rand.label}`,
      html: continutRand(rand, inventar.nivel),
    }));
  }

  global.InventarBonduri = {
    culoareNumar,
    bvPentruNivel,
    construieste,
    randaHtml,
    elementeDivIntrebare,
  };
})(window);
