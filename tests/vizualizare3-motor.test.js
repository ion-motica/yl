import assert from "node:assert/strict";
import { afterEach, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

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

// Fiecare apăsare = o înregistrare. Aici: o singură întrebare cu 2 apăsări
// (întâi greșit, apoi corect), exact cazul din SPECIFICATIE.md secțiunea 9.
const APASARI_O_INTREBARE_CORECTATA = [
  {
    data_ora_ro: "2026-07-12 01:11:06",
    quiz_id: "q1",
    subquiz_id: "base",
    fact_id: "mul:11*2=?",
    fact: "11*2=22",
    eq_form: "22=?*11",
    intrebare: "22=?*11",
    raspuns: "3",
    raspuns_corect: false,
    a_cata_apasare_pe_buton: 1,
    durata_raspuns_secunde: 1.3,
  },
  {
    data_ora_ro: "2026-07-12 01:11:08",
    quiz_id: "q1",
    subquiz_id: "base",
    fact_id: "mul:11*2=?",
    fact: "11*2=22",
    eq_form: "22=?*11",
    intrebare: "22=?*11",
    raspuns: "2",
    raspuns_corect: true,
    a_cata_apasare_pe_buton: 2,
    durata_raspuns_secunde: 2.7,
  },
];

it("normalizeaza campurile si lasa null ce lipseste", () => {
  const motor = incarcaMotor();
  const [inregistrare] = motor.normalizeaza([{ fact_id: "mul:5*5=?" }]);
  assert.equal(inregistrare.fact_id, "mul:5*5=?");
  assert.equal(inregistrare.raspuns_corect, null);
  assert.equal(inregistrare.a_cata_apasare_pe_buton, null);
  assert.equal(inregistrare.durata_raspuns_secunde, null);
});

it("respinge valorile invalide fara sa inventeze", () => {
  const motor = incarcaMotor();
  const [inregistrare] = motor.normalizeaza([
    { a_cata_apasare_pe_buton: 0, durata_raspuns_secunde: -3, raspuns_corect: "da" },
  ]);
  assert.equal(inregistrare.a_cata_apasare_pe_buton, null);
  assert.equal(inregistrare.durata_raspuns_secunde, null);
  assert.equal(inregistrare.raspuns_corect, null);
});

it("grupeaza doua apasari intr-o singura intrebare corectata", () => {
  const motor = incarcaMotor();
  const normalizate = motor.normalizeaza(APASARI_O_INTREBARE_CORECTATA);
  const intrebari = motor.grupeazaApasarilePeIntrebari(normalizate);

  assert.equal(intrebari.length, 1);
  const intrebare = intrebari[0];
  assert.equal(intrebare.corect_din_prima, false);
  assert.equal(intrebare.numar_apasari, 2);
  assert.equal(intrebare.corectat_in_final, true);
  assert.equal(intrebare.primul_raspuns, "3");
  assert.equal(intrebare.timp_primul_raspuns_secunde, 1.3);
  assert.equal(intrebare.timp_pana_la_corect_secunde, 2.7);
  assert.deepEqual(intrebare.raspunsuri_gresite, ["3"]);
});

it("un nou 1 incepe o intrebare noua", () => {
  const motor = incarcaMotor();
  const apasari = [
    { raspuns: "2", raspuns_corect: true, a_cata_apasare_pe_buton: 1, durata_raspuns_secunde: 0.9 },
    { raspuns: "5", raspuns_corect: false, a_cata_apasare_pe_buton: 1, durata_raspuns_secunde: 1.1 },
    { raspuns: "6", raspuns_corect: true, a_cata_apasare_pe_buton: 2, durata_raspuns_secunde: 2.0 },
  ];
  const intrebari = motor.grupeazaApasarilePeIntrebari(motor.normalizeaza(apasari));

  assert.equal(intrebari.length, 2);
  assert.equal(intrebari[0].corect_din_prima, true);
  assert.equal(intrebari[0].numar_apasari, 1);
  assert.equal(intrebari[1].corect_din_prima, false);
  assert.equal(intrebari[1].numar_apasari, 2);
});

it("ignora apasarile de dinaintea primului 1 (istoric incomplet)", () => {
  const motor = incarcaMotor();
  const apasari = [
    { raspuns: "9", raspuns_corect: false, a_cata_apasare_pe_buton: 2, durata_raspuns_secunde: 3.0 },
    { raspuns: "2", raspuns_corect: true, a_cata_apasare_pe_buton: 1, durata_raspuns_secunde: 1.0 },
  ];
  const intrebari = motor.grupeazaApasarilePeIntrebari(motor.normalizeaza(apasari));

  assert.equal(intrebari.length, 1);
  assert.equal(intrebari[0].primul_raspuns, "2");
});

it("intrebarea ramasa gresita nu are corectare", () => {
  const motor = incarcaMotor();
  const apasari = [
    { raspuns: "3", raspuns_corect: false, a_cata_apasare_pe_buton: 1, durata_raspuns_secunde: 1.5 },
    { raspuns: "4", raspuns_corect: false, a_cata_apasare_pe_buton: 2, durata_raspuns_secunde: 2.2 },
  ];
  const intrebari = motor.grupeazaApasarilePeIntrebari(motor.normalizeaza(apasari));

  assert.equal(intrebari.length, 1);
  assert.equal(intrebari[0].corectat_in_final, false);
  assert.equal(intrebari[0].timp_pana_la_corect_secunde, null);
  assert.deepEqual(intrebari[0].raspunsuri_gresite, ["3", "4"]);
});
