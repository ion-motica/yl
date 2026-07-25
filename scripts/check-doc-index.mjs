import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Verifică indexul de documente pe zonă din CLAUDE.md / AGENTS.md (vezi
// „Index de documente pe zonă" în AGENTS.md pentru regula pe care o aplică asta):
//   1. cele două copii ale tabelului sunt identice (nu au divergent);
//   2. fiecare cale menționată în tabel chiar există pe disc;
//   3. fișierele de tip „referință de zonă" (*REFERENCE*.md, *SABLON*.md,
//      referinta*.md din „documente de referinta/", plus câteva nume fixe care nu
//      urmează tiparul) apar undeva în index — altfel un document nou de referință
//      poate rămâne nedescoperit de o sesiune nouă.

const rootDir = process.cwd();
const MARKER_START = "<!-- INDEX-DOCUMENTE:START -->";
const MARKER_END = "<!-- INDEX-DOCUMENTE:END -->";

// Nume fixe care nu urmează tiparul REFERENCE/SABLON/referinta* — greu de prins
// automat, deci enumerate explicit. Dacă apare un tipar nou frecvent, adaugă-l ca
// glob mai jos, nu ca înșirare fără sfârșit aici.
const FISIERE_FIXE_DE_VERIFICAT = [
  "Documentatie Profil ASNW - arena simpla pt new user.md",
  "Vizualizare 3 - Claude/SPECIFICATIE.md",
  "Vizualizare si interpretare logs/README.md",
];

function extrageBlocIndex(filePath) {
  if (!existsSync(filePath)) return null;
  const text = readFileSync(filePath, "utf8");
  const start = text.indexOf(MARKER_START);
  const end = text.indexOf(MARKER_END);
  if (start === -1 || end === -1 || end < start) return null;
  return text.slice(start, end + MARKER_END.length);
}

function extrageCaiDinBloc(bloc) {
  const cai = [];
  for (const m of bloc.matchAll(/`([^`]+)`/g)) {
    const candidat = m[1];
    // exclude bucăți de cod care nu arată a cale de fișier, ex. `numaraTICs()`
    if (candidat.includes("/") || /\.(md|js)$/.test(candidat)) {
      cai.push(candidat);
    }
  }
  return cai;
}

function gasesteFisiereDeReferinta() {
  const gasite = [];
  const refDir = path.join(rootDir, "documente de referinta");
  if (existsSync(refDir)) {
    for (const nume of readdirSync(refDir)) {
      if (!nume.endsWith(".md")) continue;
      const majuscul = nume.toUpperCase();
      const esteReferinta =
        majuscul.includes("REFERENCE") ||
        majuscul.includes("SABLON") ||
        nume.toLowerCase().startsWith("referinta");
      if (esteReferinta) gasite.push(`documente de referinta/${nume}`);
    }
  }
  return [...gasite, ...FISIERE_FIXE_DE_VERIFICAT];
}

const erori = [];
const claudePath = path.join(rootDir, "CLAUDE.md");
const agentsPath = path.join(rootDir, "AGENTS.md");

if (!existsSync(claudePath)) erori.push("CLAUDE.md lipsește din rădăcina proiectului.");
if (!existsSync(agentsPath)) erori.push("AGENTS.md lipsește din rădăcina proiectului.");

if (existsSync(claudePath) && existsSync(agentsPath)) {
  const blocClaude = extrageBlocIndex(claudePath);
  const blocAgents = extrageBlocIndex(agentsPath);

  if (!blocClaude) {
    erori.push(`CLAUDE.md nu are blocul ${MARKER_START} ... ${MARKER_END}.`);
  }
  if (!blocAgents) {
    erori.push(`AGENTS.md nu are blocul ${MARKER_START} ... ${MARKER_END}.`);
  }

  if (blocClaude && blocAgents) {
    if (blocClaude.trim() !== blocAgents.trim()) {
      erori.push(
        "Indexul din CLAUDE.md diferă de cel din AGENTS.md — resincronizează-le manual (trebuie identice)."
      );
    }

    for (const cale of extrageCaiDinBloc(blocClaude)) {
      if (!existsSync(path.join(rootDir, cale))) {
        erori.push(`Index: calea \`${cale}\` (din CLAUDE.md) nu există pe disc.`);
      }
    }

    for (const ref of gasesteFisiereDeReferinta()) {
      if (!blocClaude.includes(ref)) {
        erori.push(
          `Document de referință neindexat: \`${ref}\` nu apare în index (CLAUDE.md / AGENTS.md).`
        );
      }
    }
  }
}

if (erori.length) {
  console.error("Index de documente — probleme găsite:");
  erori.forEach((e) => console.error(`- ${e}`));
  process.exitCode = 1;
} else {
  console.log(
    "Index de documente OK: CLAUDE.md ≡ AGENTS.md, toate căile există, toate referințele sunt indexate."
  );
}
