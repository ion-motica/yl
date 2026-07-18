import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { readFileSync } from "node:fs";

const rootDir = "C:/Users/I/Projects/Youlearn.com";

function incarcaMotor() {
  const code = readFileSync(
    `${rootDir}/Vizualizare 3 - Claude/motor-analiza.js`,
    "utf8"
  );
  new Function("globalThis", code)(globalThis);
  return globalThis.MotorAnalizaVizualizare3;
}

afterEach(() => {
  delete globalThis.MotorAnalizaVizualizare3;
});

// Praguri v1 exacte din config-praguri.js (§13), duplicate aici ca literal
// ca testul să nu depindă de citirea altui fișier (fișierele de test sunt
// standalone — vezi tests/vizualizare3-scor-fluenta.test.js).
const PRAGURI = {
  interpretare_v1: {
    filtru: {
      viteza_doar_corect_din_prima: true,
      timp_minim_secunde: 0.5,
      timp_maxim_secunde: 15,
      exclude_timpi_extremi_din_precizie: false,
      plancher_impulsivitate_secunde: 0.35,
    },
    corectitudine: { prag_ghicit: 0.45, prag_plin: 0.9 },
    viteza: { secunde_plin: 2.0, secunde_zero: 7.0 },
    incredere: { n_minim_calcul: 15, n_incredere_mare: 50, zile_distincte_incredere_mare: 2 },
    calup: { marimi: [25, 50, 100, 200], implicita: 100 },
  },
};

// Construiește N „întrebări" deja grupate (forma produsă de
// grupeazaApasarilePeIntrebari), corecte-din-prima, cu durata dată,
// împrăștiate pe `zile` zile distincte (round-robin).
function intrebariFact(fact, n, durataSecunde, zile) {
  const rezultat = [];
  for (let i = 0; i < n; i++) {
    const zi = zile[i % zile.length];
    rezultat.push({
      data_ora_ro: `${zi} 10:00:${String(i % 60).padStart(2, "0")}`,
      fact,
      corect_din_prima: true,
      timp_primul_raspuns_secunde: durataSecunde,
    });
  }
  return rezultat;
}

// Fixture partajată de testele 3 și 7: 10 valide vechi + 5 impulsive (sub
// plancher) + 1 fără rezultat + 10 valide noi — niciuna din ultimele 6 nu
// trebuie să numere la mărimea calupului.
function fixtureCuImpulsiveSiFaraRezultat() {
  const ziua = "2026-07-01";
  const valideVechi = intrebariFact("12*3=36", 10, 1.5, [ziua]);
  const impulsive = intrebariFact("12*3=36", 5, 0.1, [ziua]);
  const faraRezultat = [
    {
      data_ora_ro: `${ziua} 10:30:00`,
      fact: "12*3=36",
      corect_din_prima: null,
      timp_primul_raspuns_secunde: 3.0,
    },
  ];
  const valideNoi = intrebariFact("12*3=36", 10, 1.5, ["2026-07-02"]);
  return [...valideVechi, ...impulsive, ...faraRezultat, ...valideNoi];
}

// ---- segmenteazaFereastraInCalupuri ------------------------------------

it("ancoreaza in prezent: calupul incomplet e cel mai vechi, nu cel mai nou", () => {
  const motor = incarcaMotor();
  const vechi = intrebariFact("12*3=36", 30, 1.5, ["2026-07-01"]);
  const nou = intrebariFact("12*3=36", 100, 1.5, ["2026-07-02"]);
  const intrebari = [...vechi, ...nou];

  const calupuri = motor.segmenteazaFereastraInCalupuri({
    intrebari,
    celuleFereastra: ["mul:12x3"],
    marimeCalup: 100,
    filtru: PRAGURI.interpretare_v1.filtru,
  });

  assert.equal(calupuri.length, 2);
  assert.equal(calupuri[0].n_valide, 30);
  assert.equal(calupuri[0].complet, false);
  assert.equal(calupuri[0].index_din_prezent, 1);
  assert.equal(calupuri[0].data_prima_zi, "2026-07-01");
  assert.equal(calupuri[1].n_valide, 100);
  assert.equal(calupuri[1].complet, true);
  assert.equal(calupuri[1].index_din_prezent, 0);
  assert.equal(calupuri[1].data_prima_zi, "2026-07-02");
});

it("calup exact divizibil: toate calupurile sunt complete", () => {
  const motor = incarcaMotor();
  const intrebari = intrebariFact("12*3=36", 200, 1.5, ["2026-07-01", "2026-07-02"]);

  const calupuri = motor.segmenteazaFereastraInCalupuri({
    intrebari,
    celuleFereastra: ["mul:12x3"],
    marimeCalup: 100,
    filtru: PRAGURI.interpretare_v1.filtru,
  });

  assert.equal(calupuri.length, 2);
  assert.equal(calupuri[0].n_valide, 100);
  assert.equal(calupuri[0].complet, true);
  assert.equal(calupuri[1].n_valide, 100);
  assert.equal(calupuri[1].complet, true);
});

it("raspunsurile impulsive si cele fara rezultat nu numara la marimea calupului", () => {
  const motor = incarcaMotor();
  const calupuri = motor.segmenteazaFereastraInCalupuri({
    intrebari: fixtureCuImpulsiveSiFaraRezultat(),
    celuleFereastra: ["mul:12x3"],
    marimeCalup: 10,
    filtru: PRAGURI.interpretare_v1.filtru,
  });

  assert.equal(calupuri.length, 2);
  assert.equal(calupuri[0].n_valide, 10);
  assert.equal(calupuri[1].n_valide, 10);
});

it("intrebarile din alte facts (in afara ferestrei) nu intra in calup", () => {
  const motor = incarcaMotor();
  const tinta = intrebariFact("12*3=36", 7, 1.5, ["2026-07-01"]);
  const altul = intrebariFact("5*5=25", 20, 1.5, ["2026-07-01"]);
  const intrebari = [];
  for (let i = 0; i < altul.length; i++) {
    intrebari.push(altul[i]);
    if (i < tinta.length) intrebari.push(tinta[i]);
  }

  const calupuri = motor.segmenteazaFereastraInCalupuri({
    intrebari,
    celuleFereastra: ["mul:12x3"],
    marimeCalup: 5,
    filtru: PRAGURI.interpretare_v1.filtru,
  });

  assert.equal(calupuri.length, 2);
  assert.equal(calupuri[0].n_valide, 2);
  assert.equal(calupuri[1].n_valide, 5);
});

it("fara intrebari valide sau fara intrebari deloc -> array gol, nu un calup gol", () => {
  const motor = incarcaMotor();
  const filtru = PRAGURI.interpretare_v1.filtru;

  assert.deepEqual(
    motor.segmenteazaFereastraInCalupuri({
      intrebari: [],
      celuleFereastra: ["mul:12x3"],
      marimeCalup: 10,
      filtru,
    }),
    []
  );

  const doarImpulsive = intrebariFact("12*3=36", 5, 0.1, ["2026-07-01"]);
  assert.deepEqual(
    motor.segmenteazaFereastraInCalupuri({
      intrebari: doarImpulsive,
      celuleFereastra: ["mul:12x3"],
      marimeCalup: 10,
      filtru,
    }),
    []
  );
});

it("marimeCalup invalid arunca eroare", () => {
  const motor = incarcaMotor();
  const filtru = PRAGURI.interpretare_v1.filtru;
  const apel = (marimeCalup) => () =>
    motor.segmenteazaFereastraInCalupuri({
      intrebari: [],
      celuleFereastra: ["mul:12x3"],
      marimeCalup,
      filtru,
    });

  assert.throws(apel(0));
  assert.throws(apel(-1));
  assert.throws(apel("abc"));
});

// ---- calculeazaSerieScorFluenta -----------------------------------------

it("seria de scoruri arata progresul intre calupuri consecutive", () => {
  const motor = incarcaMotor();
  // vechi: precizie 100% (>=prag_plin) -> coef 1; mediana 6.0s -> (7-6)/(7-2)=0.2
  const vechi = intrebariFact("16*7=112", 50, 6.0, ["2026-07-01", "2026-07-02"]);
  // nou: precizie 100%, mediana 1.5s (<=secunde_plin) -> coef 1
  const nou = intrebariFact("16*7=112", 50, 1.5, ["2026-07-10", "2026-07-11"]);
  const intrebari = [...vechi, ...nou];

  const serie = motor.calculeazaSerieScorFluenta({
    intrebari,
    celuleFereastra: ["mul:16x7"],
    marimeCalup: 50,
    praguri: PRAGURI,
  });

  assert.equal(serie.length, 2);
  assert.equal(serie[0].eticheta, "incredere_mare");
  assert.equal(serie[1].eticheta, "incredere_mare");
  assert.ok(Math.abs(serie[0].scor - 0.2) < 0.001, `asteptat ~0.2, primit ${serie[0].scor}`);
  assert.ok(Math.abs(serie[1].scor - 1.0) < 0.001, `asteptat ~1.0, primit ${serie[1].scor}`);
  assert.ok(serie[1].scor > serie[0].scor);
});

it("n_total din scor == n_valide din calup, pentru fiecare element din serie", () => {
  const motor = incarcaMotor();
  const serie = motor.calculeazaSerieScorFluenta({
    intrebari: fixtureCuImpulsiveSiFaraRezultat(),
    celuleFereastra: ["mul:12x3"],
    marimeCalup: 10,
    praguri: PRAGURI,
  });

  assert.equal(serie.length, 2);
  serie.forEach((element) => {
    assert.equal(element.n_total, element.n_valide);
  });
});
