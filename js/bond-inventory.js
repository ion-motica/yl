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

  // Genereaza HTML-ul randurilor (doar randurile, fara wrapper/titlu) — quizul
  // il insereaza direct in propriul promptHtml, in caseta intrebarii. Cerere
  // user (29.08.2026): lista colorata inlocuieste vechiul istoric text
  // (singapore-history), in acelasi loc din caseta, nu langa el intr-un panou
  // separat.
  function randaHtml(inventar) {
    if (!inventar?.visible) return "";
    const randuriHtml = inventar.randuri
      .map((rand) => {
        if (!rand.rezolvat) return `<div class="inventar-bonduri-rand e-gol"></div>`;
        return (
          `<div class="inventar-bonduri-rand">` +
          `<span class="inventar-bonduri-semn">${inventar.nivel}=</span>` +
          `<span class="inventar-bonduri-numar" style="background-color:${rand.culoareA}">${rand.a}</span>` +
          `<span class="inventar-bonduri-semn">+</span>` +
          `<span class="inventar-bonduri-numar" style="background-color:${rand.culoareB}">${rand.b}</span>` +
          `</div>`
        );
      })
      .join("");
    return `<div class="inventar-bonduri-randuri">${randuriHtml}</div>`;
  }

  global.InventarBonduri = {
    culoareNumar,
    bvPentruNivel,
    construieste,
    randaHtml,
  };
})(window);
