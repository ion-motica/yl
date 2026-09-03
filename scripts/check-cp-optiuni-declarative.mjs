import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Verifică regula din CLAUDE.md/AGENTS.md ("Optiuni CP declarative"): după
// migrarea panourilor CP la js/motor-optiuni-control-panel.js, nu se mai
// adaugă opțiuni CP prin cod imperativ — document.createElement("select")
// sau atribuire .type = checkbox/radio/number/range/color — ci doar ca date
// declarative, prin motor (vezi documente de referinta/standard-optiuni-cp.md).
//
// Domeniu verificat: js/quizzes/*.js + js/app.js (unde trăiesc panourile CP
// ale quizurilor și secțiunile CP din shell-ul aplicației). js/motor-optiuni-
// control-panel.js e exclus (e chiar motorul — construiește input-uri prin
// design). js/falling-engine.js și js/aam-arena.js au panouri CP proprii,
// azi nemigrate — nu sunt încă în domeniul acestui check (vezi
// documente de referinta/standard-optiuni-cp.md, secțiunea „Ce rămâne de
// făcut" — extindere posibilă, discutată explicit cu userul, nu presupusă).

const rootDir = process.cwd();

const EXCEPTIE_START = "CP-DECLARATIV-EXCEPTIE:START";
const EXCEPTIE_END = "CP-DECLARATIV-EXCEPTIE:END";

// Excepții punctuale, în afara mecanismului de marcaje CP-DECLARATIV-EXCEPTIE
// de mai sus — folosite STRICT cât nu se poate marca sursa direct (de ex. o
// decizie user în așteptare, unde nu modificăm fișierul până la răspuns).
// Fiecare intrare cere un motiv explicit + dată; când decizia se lămurește,
// intrarea se șterge de aici (și fie codul se șterge, fie primește marcaje
// CP-DECLARATIV-EXCEPTIE ca oricare altă excepție documentată).
//
// Goală azi (03.09.2026) — singurul caz folosit aici
// (appendSq2ControlPanelUnused, multiplication-1120-v4-intensiv-multipli-234.js)
// a fost șters complet, decizie user, 03.09.2026 ("nu mai are rost păstrat").
const EXCEPTII_PUNCTUALE = [];

const PATTERNS = [
  {
    nume: "document.createElement select",
    regex: /document\.createElement\(\s*["']select["']\s*\)/,
  },
  {
    nume: "atribuire .type checkbox/radio/number/range/color",
    regex: /\.type\s*=\s*["'](checkbox|radio|number|range|color)["']/,
  },
];

function goleșteÎntreMarcaje(linii, fisierRelativ) {
  let inExceptie = false;
  for (let i = 0; i < linii.length; i++) {
    const linie = linii[i];
    if (linie.includes(EXCEPTIE_START)) {
      if (inExceptie) {
        throw new Error(
          `${fisierRelativ}:${i + 1} — ${EXCEPTIE_START} imbricat, fără ${EXCEPTIE_END} anterior închis.`
        );
      }
      inExceptie = true;
      continue;
    }
    if (linie.includes(EXCEPTIE_END)) {
      if (!inExceptie) {
        throw new Error(
          `${fisierRelativ}:${i + 1} — ${EXCEPTIE_END} fără ${EXCEPTIE_START} deschis înainte.`
        );
      }
      inExceptie = false;
      continue;
    }
    if (inExceptie) linii[i] = "";
  }
  if (inExceptie) {
    throw new Error(`${fisierRelativ} — ${EXCEPTIE_START} deschis dar niciodată închis.`);
  }
}

function goleșteFuncțiiExceptate(linii, fisierRelativ) {
  const excepții = EXCEPTII_PUNCTUALE.filter((e) => e.fisier === fisierRelativ);
  for (const excepție of excepții) {
    const startIdx = linii.findIndex((linie) =>
      new RegExp(`function\\s+${excepție.functie}\\s*\\(`).test(linie)
    );
    if (startIdx === -1) {
      throw new Error(
        `${fisierRelativ} — excepția punctuală pt. "${excepție.functie}" nu mai găsește ` +
          "funcția (a fost redenumită/ștearsă?). Actualizează EXCEPTII_PUNCTUALE din " +
          "scripts/check-cp-optiuni-declarative.mjs."
      );
    }
    let adâncime = 0;
    let atinsAcoladă = false;
    for (let i = startIdx; i < linii.length; i++) {
      for (const ch of linii[i]) {
        if (ch === "{") {
          adâncime++;
          atinsAcoladă = true;
        } else if (ch === "}") {
          adâncime--;
        }
      }
      linii[i] = "";
      if (atinsAcoladă && adâncime <= 0) break;
    }
  }
}

function verificăFișier(fullPath, fisierRelativ, erori) {
  const text = readFileSync(fullPath, "utf8");
  const linii = text.split(/\r?\n/);

  goleșteÎntreMarcaje(linii, fisierRelativ);
  goleșteFuncțiiExceptate(linii, fisierRelativ);

  linii.forEach((linie, index) => {
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(linie)) {
        erori.push(
          `${fisierRelativ}:${index + 1} — cod imperativ CP (${pattern.nume}): ${linie.trim().slice(0, 160)}`
        );
      }
    }
  });
}

const erori = [];

try {
  const quizDir = path.join(rootDir, "js", "quizzes");
  if (existsSync(quizDir)) {
    for (const nume of readdirSync(quizDir)) {
      if (!nume.endsWith(".js")) continue;
      verificăFișier(path.join(quizDir, nume), `js/quizzes/${nume}`, erori);
    }
  }

  const appJsPath = path.join(rootDir, "js", "app.js");
  if (existsSync(appJsPath)) {
    verificăFișier(appJsPath, "js/app.js", erori);
  }
} catch (err) {
  console.error("Check CP opțiuni declarative — eroare de configurare:");
  console.error(`- ${err.message}`);
  process.exitCode = 1;
}

if (!process.exitCode) {
  if (erori.length) {
    console.error(
      "Cod imperativ CP găsit în afara motorului (js/motor-optiuni-control-panel.js) " +
        "și a excepțiilor documentate — vezi documente de referinta/standard-optiuni-cp.md:"
    );
    erori.forEach((e) => console.error(`- ${e}`));
    process.exitCode = 1;
  } else {
    console.log(
      "Check CP opțiuni declarative OK: nicio opțiune CP construită imperativ " +
        "în js/quizzes/*.js sau js/app.js, în afara excepțiilor documentate."
    );
  }
}
