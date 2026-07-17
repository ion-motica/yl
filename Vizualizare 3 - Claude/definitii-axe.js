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
          // Toate domeniile sunt acelasi lucru cu alte argumente: un interval
          // a-b × c-d. De-aia fiecare optiune isi declara doar intervalul, iar
          // catalogul se construieste din el (vezi catalog-tabla-inmultirii.js).
          // A adauga un domeniu = a adauga o linie aici, fara cod nou.
          optiuni: [
            {
              id: "tabla_1_10",
              eticheta: "Tabla 1-10 × 1-10 (agregat per fact)",
              activa: true,
              interval: { aMin: 1, aMax: 10, bMin: 1, bMax: 10 },
            },
            {
              id: "subtabla",
              eticheta: "O subtablă (ex. 7×…)",
              interval: { aMin: 7, aMax: 7, bMin: 1, bMax: 10 },
            },
            {
              id: "tabla_11_20",
              eticheta: "Tabla 11-20 × 1-20",
              interval: { aMin: 11, aMax: 20, bMin: 1, bMax: 20 },
            },
            // Singurul care nu e un preset: 4 campuri numerice in CP, cu
            // acelasi mecanism ca preseturile (un interval -> un catalog).
            {
              id: "custom",
              eticheta: "Interval custom a-b × c-d",
              interval: { aMin: 1, aMax: 10, bMin: 1, bMax: 10 },
              interval_editabil: true,
              limite: { min: 1, max: 100 },
            },
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
            { id: "grafic_linie", eticheta: "Grafic linie (progres)", dezactivata: true, motiv: VOR_URMA },
            { id: "matrice", eticheta: "Matrice fact × eq_form", dezactivata: true, motiv: VOR_URMA },
            { id: "lista", eticheta: "Listă facts problematice", dezactivata: true, motiv: VOR_URMA },
          ],
        },
        {
          id: "compozitie",
          eticheta: "Compoziție pătrățele",
          // Ce componente are o celula. Se aplica in TOATE aranjamentele, ca
          // celulele sa nu-si schimbe continutul cand foliile trec prin
          // suprapus. Nu schimba configuratia motorului; e prezentare.
          tip_control: "compozitie",
          optiuni: [
            { id: "fact", eticheta: "9 × 1 (fact)", activa: true },
            { id: "eticheta", eticheta: "În lucru (etichetă)", activa: true },
            { id: "patratele", eticheta: "Pătrățele", activa: true },
            { id: "numere", eticheta: "Numere (n · % · s)", activa: false },
            {
              id: "umple",
              eticheta: "Mărește să ocupe tot spațiul lateral",
              activa: true,
              modificator: true,
            },
          ],
        },
        {
          id: "folii",
          eticheta: "Folii transparente",
          // Control special: comutator on/off + butoane de aranjament.
          // Nu schimbă configurația motorului; e strict prezentare.
          tip_control: "folii",
          activ_implicit: true,
          // Cand e activ, la fiecare trecere foliile primesc sloturi
          // amestecate: o folie nu ajunge mereu in acelasi loc din grila.
          glisare_aleatoare_implicit: true,
          // Cand un titlu n-ar incapea pe un rand, se rupe in doua in loc sa
          // se micsoreze. Ruperea se face la cuvinte, iar randurile se
          // echilibreaza. Titlurile cresc in sus de la aceeasi linie de baza.
          titluri_2_randuri_implicit: true,
          // Casetele se vad ca un sir, inclusiv cele goale.
          titluri_incadrate_implicit: true,
          // Pline pana la titlul foliei inclusiv: se vede ce etape a parcurs
          // folia si cate mai are de parcurs.
          casete_colorate_implicit: true,
          // Alinierea textului in caseta: verticala si orizontala,
          // independente una de alta. Implicit jos + stanga, ca sa nu schimbe
          // aspectul deja stabilit (bara ancorata de jos, scris la stanga).
          aliniere_titluri_verticala_implicit: "jos",
          aliniere_titluri_orizontala_implicit: "stanga",
          optiuni_aliniere_verticala: [
            { id: "sus", eticheta: "Sus", titlu: "Aliniere sus", valoare: "flex-start" },
            { id: "mijloc", eticheta: "Mij", titlu: "Aliniere pe mijloc", valoare: "center" },
            { id: "jos", eticheta: "Jos", titlu: "Aliniere jos", valoare: "flex-end" },
          ],
          optiuni_aliniere_orizontala: [
            { id: "stanga", eticheta: "Stg", titlu: "Aliniere stânga", valoare: "left" },
            { id: "centru", eticheta: "Ctr", titlu: "Aliniere centru", valoare: "center" },
            { id: "dreapta", eticheta: "Dr", titlu: "Aliniere dreapta", valoare: "right" },
          ],
          // Cand e activ, aranjamentul intreg se aseaza in alt loc pe panza:
          // randul pe alta linie, coloana pe alta coloana, patratul in alt colt.
          reasezare_aleatoare_implicit: true,
          // La ciclarea automata: cat de des ramane in exact aceeasi forma si
          // acelasi loc, doar reamestecand ordinea foliilor. 0 = se muta mereu,
          // 1 = ramane mereu. Nu se aplica la suprapus: acolo foliile stau
          // toate in aceeasi celula, deci reamestecarea lor nu se vede.
          proportie_ramane_pe_loc: 0.5,
          // Pas intermediar: cateva folii se stang intr-un grup, apoi pleaca
          // spre destinatie. Fiecare nivel se trage la sorti separat.
          grupare_implicita: true,
          // Cat de des are loc actul intermediar. Restul trecerilor raman
          // directe, ca sa nu devina monoton.
          proportie_cu_grup: 0.5,
          // Tiparele de grupare: o pereche, doua perechi, sau trei folii.
          tipare_grup: [[2], [2, 2], [3]],
          // Cat de des un grup ramane suprapus si in destinatie, in loc sa se
          // imprastie fiecare la slotul ei.
          proportie_grup_ramane: 0.5,
          optiuni: [
            { id: "suprapus", eticheta: "4", titlu: "Toate 4 suprapuse", activa: true },
            { id: "orizontal", eticheta: "↔", titlu: "Desfăcute pe orizontală" },
            { id: "vertical", eticheta: "↕", titlu: "Desfăcute pe verticală" },
            { id: "patrat", eticheta: "⊞", titlu: "Desfăcute în pătrat 2×2" },
          ],
          // Reglaje continue. `max: null` la dimensiune = lățimea reală a tablei,
          // măsurată la randare (nu o duplicăm aici).
          reglaje: [
            {
              id: "dimensiune",
              eticheta: "Dimensiune folie",
              tip: "slider",
              min: 10,
              max: null,
              pas: 1,
              implicit: 256,
              unitate: "px",
            },
            {
              id: "viteza",
              eticheta: "Viteză reașezare",
              tip: "slider",
              min: 0,
              max: 5000,
              pas: 50,
              implicit: 4000,
              unitate: "ms",
            },
            {
              id: "auto",
              eticheta: "Schimbă automat poziția foliilor după",
              tip: "numar",
              min: 0,
              max: 60,
              pas: 1,
              implicit: 3,
              unitate: "secunde",
              nota: "de la așezare; 0 = oprit",
            },
          ],
        },
      ],
    },
  ];

  // Forma grilei fiecărui aranjament. Din ea se calculează, cu o singură
  // formulă, slotul fiecărei folii: coloana = slot % coloane, rândul =
  // slot / coloane. Suprapus are o singură celulă, deci toate cad în ea.
  const ARANJAMENTE = {
    suprapus: { coloane: 1, randuri: 1 },
    orizontal: { coloane: 4, randuri: 1 },
    vertical: { coloane: 1, randuri: 4 },
    patrat: { coloane: 2, randuri: 2 },
  };

  // Compoziția foliilor: fiecare folie arată DOAR stările ei, în pozițiile lor.
  // Suprapuse, cele 4 folii reconstituie exact tabla întreagă, fiindcă un fact
  // are exact o stare. A muta o stare pe altă folie = a o muta aici.
  const FOLII = [
    {
      id: "f1",
      // ` ` = spatiu ne-despartitor: leaga "+ Abia inceput" intr-o bucata
      // care nu se poate rupe, deci singura ruptura posibila e dupa "Netestat".
      eticheta: "Netestat + Abia început",
      stari: ["netestat", "abia_inceput"],
    },
    { id: "f2", eticheta: "Nu îl știe", stari: ["nu_il_stie"] },
    { id: "f3", eticheta: "În lucru", stari: ["in_lucru"] },
    { id: "f4", eticheta: "Fluent", stari: ["fluent"] },
  ];

  // Reglajele măririi componentelor pe tabla desfăcută. Se ajustează de aici.
  const COMPOZITIE = {
    spatiu_lateral: 3, // px între scris și marginea celulei
    gap_vertical: 4, // px între componente
    // Înălțimile naturale (la scara 1) din care se calculează cât pot crește.
    inaltimi: { eticheta: 16, stare: 13, patratele: 12, detaliu: 11 },
    // Cum se împarte înălțimea celulei între componentele bifate: ponderi, nu
    // felii egale. Faptul primește mai mult, fiindcă are nevoie de mai mult.
    // Aici jonglezi cu spațiul: schimbi cifrele, se schimbă mărimile.
    felii: { eticheta: 3, stare: 1.5, patratele: 1, detaliu: 1 },
    // Cu toate cele 4 bifate spațiul e strâns: pătrățelele se mai micșorează,
    // iar scrisul și pătrățelele coboară spre rândul cu numere.
    toate_bifate: { factor_patratele: 0.7, deplasare_verticala: 3 },
  };

  global.DefinitiiAxeVizualizare3 = Object.freeze(DEFINITII_AXE);
  global.DefinitiiFoliiVizualizare3 = Object.freeze(FOLII);
  global.DefinitiiAranjamenteVizualizare3 = Object.freeze(ARANJAMENTE);
  global.DefinitiiCompozitieVizualizare3 = Object.freeze(COMPOZITIE);
})(typeof globalThis !== "undefined" ? globalThis : this);
