// Axele declarative ale control panelului „Vizualizare 3 - Claude".
// CP-ul se GENEREAZĂ din acest array. A adăuga o opțiune = a o adăuga aici,
// fără cod nou de interfață. O opțiune indisponibilă rămâne vizibilă cu
// `dezactivata: true` + `motiv`, exact cum cere contractul MABP.
//
// În prototip, o singură opțiune activă (`activa: true`) per axă.

(function (global) {
  "use strict";

  const VOR_URMA = "vor urma";

  const DEFINITII_AXE = [
    {
      etapa: 0,
      titlu: "0 · Domeniu",
      axe: [
        {
          id: "domeniu",
          eticheta: "Domeniu matematic",
          tip_selectie: "unica",
          optiuni: [
            { id: "tabla_1_10", eticheta: "Tabla 1-10 × 1-10 (agregat per fact)", activa: true },
            { id: "subtabla", eticheta: "O subtablă (ex. 7×…)", dezactivata: true, motiv: VOR_URMA },
            { id: "tabla_11_20", eticheta: "Tabla 11-20 × 1-20", dezactivata: true, motiv: VOR_URMA },
            { id: "custom", eticheta: "Interval custom a-b × c-d", dezactivata: true, motiv: VOR_URMA },
          ],
        },
        {
          id: "structura",
          eticheta: "Structură eq_form / EFF",
          tip_selectie: "unica",
          optiuni: [
            { id: "toate_formele", eticheta: "Toate formele unui fact, împreună", activa: true },
            { id: "un_eqform", eticheta: "Un singur eq_form", dezactivata: true, motiv: VOR_URMA },
            { id: "acelasi_rol", eticheta: "Același rol al necunoscutei", dezactivata: true, motiv: VOR_URMA },
            { id: "tot_eff", eticheta: "Tot EFF-ul", dezactivata: true, motiv: VOR_URMA },
            { id: "granular", eticheta: "Selecție granulară (matrice)", dezactivata: true, motiv: VOR_URMA },
          ],
        },
      ],
    },
    {
      etapa: 1,
      titlu: "1 · Filtrare",
      axe: [
        {
          id: "filtrare",
          eticheta: "Curățarea datelor",
          tip_selectie: "unica",
          optiuni: [
            { id: "standard_v1", eticheta: "Filtru standard v1 (prima apăsare; exclude <0,5s și >15s din viteză)", activa: true },
            { id: "fara", eticheta: "Fără filtrare", dezactivata: true, motiv: VOR_URMA },
            { id: "iqr", eticheta: "IQR", dezactivata: true, motiv: VOR_URMA },
            { id: "mad", eticheta: "MAD", dezactivata: true, motiv: VOR_URMA },
            { id: "custom", eticheta: "Praguri custom", dezactivata: true, motiv: VOR_URMA },
          ],
        },
      ],
    },
    {
      etapa: 2,
      titlu: "2 · Segmentare (calupuri)",
      axe: [
        {
          id: "segmentare",
          eticheta: "Fereastra de comparație",
          tip_selectie: "unica",
          optiuni: [
            { id: "tot_istoricul", eticheta: "Tot istoricul (un calup)", activa: true },
            { id: "azi", eticheta: "Azi", dezactivata: true, motiv: VOR_URMA },
            { id: "7_zile", eticheta: "7 zile", dezactivata: true, motiv: VOR_URMA },
            { id: "30_zile", eticheta: "30 zile", dezactivata: true, motiv: VOR_URMA },
            { id: "ultimele_n", eticheta: "Ultimele N răspunsuri", dezactivata: true, motiv: VOR_URMA },
            { id: "n_sesiuni", eticheta: "Ultimele N sesiuni", dezactivata: true, motiv: "fără session_id în jurnal" },
          ],
        },
      ],
    },
    {
      etapa: 3,
      titlu: "3 · Statistici",
      axe: [
        {
          id: "statistici",
          eticheta: "Agregare",
          tip_selectie: "unica",
          optiuni: [
            { id: "precizie_mediana_n", eticheta: "Precizie prima + mediană timp corect + n", activa: true },
            { id: "percentile", eticheta: "Percentile (P25/P50/P75/P90)", dezactivata: true, motiv: VOR_URMA },
            { id: "medie_taiata", eticheta: "Medie tăiată", dezactivata: true, motiv: VOR_URMA },
            { id: "procente_intervale", eticheta: "Procente pe intervale de timp", dezactivata: true, motiv: VOR_URMA },
          ],
        },
      ],
    },
    {
      etapa: 4,
      titlu: "4 · Interpretare",
      axe: [
        {
          id: "interpretare",
          eticheta: "Rezultat",
          tip_selectie: "unica",
          optiuni: [
            { id: "stare_curenta", eticheta: "Stare curentă (clasificare)", activa: true },
            { id: "progres", eticheta: "Progres / direcție (compară calupuri)", dezactivata: true, motiv: VOR_URMA },
          ],
        },
      ],
    },
    {
      etapa: 5,
      titlu: "5 · Vizualizare",
      axe: [
        {
          id: "vizualizare",
          eticheta: "Reprezentare",
          tip_selectie: "unica",
          optiuni: [
            { id: "grila_10x10", eticheta: "Grila 10×10 stare", activa: true },
            { id: "folii", eticheta: "Folii separabile/suprapozabile", dezactivata: true, motiv: VOR_URMA },
            { id: "grafic_linie", eticheta: "Grafic linie (progres)", dezactivata: true, motiv: VOR_URMA },
            { id: "matrice", eticheta: "Matrice fact × eq_form", dezactivata: true, motiv: VOR_URMA },
            { id: "lista", eticheta: "Listă facts problematice", dezactivata: true, motiv: VOR_URMA },
          ],
        },
      ],
    },
  ];

  global.DefinitiiAxeVizualizare3 = Object.freeze(DEFINITII_AXE);
})(typeof globalThis !== "undefined" ? globalThis : this);
