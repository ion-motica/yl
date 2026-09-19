import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

// Cache-busting pt. un site static fara build (GitHub Pages): fiecare
// <script src>/<link href> LOCAL din index.html primeste "?v=<hash>", unde
// hash-ul vine din CONTINUTUL fisierului, nu e ales de mana. Un numar ales
// manual trebuie *retinut* sa fie incrementat la fiecare schimbare — a fost
// ratat de 3 ori la rand (fix-urile Singapore missing, 18-19.09.2026), desi
// codul din spate era deja corect: browserul continua sa serveasca fisierul
// vechi din cache, pt. ca URL-ul (inclusiv query string-ul) ramasese identic.
// Un hash nu se poate "uita" sa fie actualizat — se recalculeaza mecanic.
//
// Fara argument: verifica (exit 1 daca vreun hash din index.html nu
// corespunde continutului curent al fisierului — folosit in CI, vezi
// .github/workflows/checks.yml).
// Cu --fix: rescrie index.html cu hash-urile corecte (`npm run
// fix:cache-busting`, de rulat local dupa orice modificare de fisier
// referit in index.html, inainte de commit).

const rootDir = process.cwd();
const indexPath = path.join(rootDir, "index.html");
const fix = process.argv.includes("--fix");

const HASH_LENGTH = 10;

// Prinde tag-ul <script ...src="..."...> sau <link ...href="..."...>
// intreg, ca sa poata fi inlocuit ca bloc (nu doar valoarea atributului).
const TAG_REGEX = /<(?:script|link)[^>]*\s(?:src|href)="([^"]+)"[^>]*>/g;

function esteCaleLocala(cale) {
  return !/^([a-z]+:)?\/\//i.test(cale);
}

function hashFisier(caleRelativa) {
  const bytes = readFileSync(path.join(rootDir, caleRelativa));
  return createHash("sha256").update(bytes).digest("hex").slice(0, HASH_LENGTH);
}

const continutOriginal = readFileSync(indexPath, "utf8");
const erori = [];
let continutNou = continutOriginal;
let schimbari = 0;

for (const [tagIntreg, caleCuQuery] of continutOriginal.matchAll(TAG_REGEX)) {
  if (!esteCaleLocala(caleCuQuery)) continue;

  const [caleFisier] = caleCuQuery.split("?");
  const hash = hashFisier(caleFisier);
  const caleNouaCuQuery = `${caleFisier}?v=${hash}`;

  if (caleCuQuery === caleNouaCuQuery) continue;

  if (fix) {
    continutNou = continutNou.replace(tagIntreg, tagIntreg.replace(caleCuQuery, caleNouaCuQuery));
    schimbari++;
  } else {
    const vechi = caleCuQuery.includes("?v=") ? caleCuQuery.split("?v=")[1] : "(lipsă)";
    erori.push(`${caleFisier}: are "?v=${vechi}", ar trebui "?v=${hash}"`);
  }
}

if (fix) {
  if (schimbari > 0) {
    writeFileSync(indexPath, continutNou);
    const substantiv = schimbari === 1 ? "referință actualizată" : "referințe actualizate";
    console.log(`Cache-busting: ${schimbari} ${substantiv} în index.html.`);
  } else {
    console.log("Cache-busting: index.html era deja la zi, nimic de schimbat.");
  }
} else if (erori.length) {
  console.error("Cache-busting — hash-uri neactualizate în index.html:");
  erori.forEach((e) => console.error(`- ${e}`));
  console.error("Rulează `npm run fix:cache-busting` ca să le corectezi, apoi comite index.html.");
  process.exitCode = 1;
} else {
  console.log("Cache-busting OK: toate referințele locale din index.html au hash-ul la zi.");
}
