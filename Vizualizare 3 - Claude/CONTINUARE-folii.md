# Continuare — ajustări folii (chat nou)

Document de predare pentru a relua ajustarea vizuală a foliilor într-un chat nou, cu context mic.
Citește întâi `AGENTS.md` (reguli de design) și `documente de referinta/razgandire-ieftina.md`.

## Ce sunt foliile

Grila 10×10 a stărilor e compusă din **4 folii transparente suprapuse**, câte una per treaptă
de progres. Suprapuse arată exact ca tabla întreagă (un fact are exact o stare). Desfăcute,
gliseaza animat ca să vezi tiparul pozițional al fiecărei stări separat.

| Folie | Stări | Progres |
| --- | --- | --- |
| f1 | netestat + abia început | 1/4 |
| f2 | nu îl știe | 2/4 |
| f3 | în lucru | 3/4 |
| f4 | fluent | 4/4 |

## Fișiere

Toate în `Vizualizare 3 - Claude/`. **Nimic din motor nu știe de folii** — sunt strict prezentare.

- `definitii-axe.js` — TOATE reglajele declarative: axa `folii` (bife + butoane), `FOLII`
  (compoziția), `ARANJAMENTE` (formele grilei), `COMPOZITIE` (ponderi celule).
- `vizualizare3-bootstrap.js` — logica: `aseazaFoliile`, `calculeazaFontulTitlurilor`,
  ciclarea automată, gruparea intermediară.
- `vizualizare3.css` — stilul; sus, un bloc de variabile `--viz3-*` reglabile.
- `vizualizare3.html` — include scripturile cu `?v=N` (vezi „Cache busting" mai jos).

## Cum rulezi și vezi

1. Server local: din rădăcina proiectului, `python -m http.server 8770 --bind 127.0.0.1`
   (verifică întâi cu `curl -s -o /dev/null -w "%{http_code}" http://localhost:8770/index.html`;
   dacă dă `200`, rulează deja).
2. Deschide `http://localhost:8770/Vizualizare 3 - Claude/vizualizare3.html`.
3. Pornește pe fixture demonstrativ (jurnalul real e T× 11-20, nu apare în grila 1-10).

## Controalele foliilor (în CP, etapa 5)

Toate bifate implicit. Reglajele fine sunt în `definitii-axe.js`, nu în cod:
- **Activează foliile**, **Glisează la poziție aleatoare**, **Reașezare pe linie/coloană random**,
  **Grupează intermediar 2-3 suprapuneri**, **Titluri pe 2 rânduri**, **Titluri încadrate**,
  **Casete colorate**.
- Butoane aranjament: `4` (suprapus) / `↔` / `↕` / `⊞`.
- Slidere: **Dimensiune folie** (10px…lățimea tablei), **Viteză reașezare** (0…5000ms),
  **Schimbă automat după N secunde** (de la așezare).

## Starea curentă a ajustărilor

Bara de titluri e acum un **șir de casete**, ca legenda progresului: `X...`, `XX..`, `XXX.`,
`XXXX`. Titlul stă în caseta lui. Ultimele reglaje cerute (aplicate, NECOMISE încă):
- scris aliniat stânga, mai mare; word-wrap la nevoie;
- „Netestat" / „+ Abia început" — ruptură forțată cu spații ne-despărțitoare (` `);
- fundal galben-portocaliu **translucid** (`rgba(240,160,45,.28)`), aceeași culoare la toate;
- casete conturate, colțuri rotunjite, 7px între ele.

Reglaje în `vizualizare3.css`: `--viz3-titlu-font-max`, `--viz3-titlu-prag`,
`--viz3-titlu-randuri-max`, `--viz3-caseta-plina/contur/gap/rotunjire`.

## Întrebare deschisă

`f1` are numele lung „Netestat + Abia început", care forțează fontul mic (~30px) și 2 rânduri.
Cu un nume scurt („Neatins"? „Fără date"?) ar sta pe **un rând la font mare**. Verificat că regula
se auto-reglează. De decis cu userul.

## Capcane tehnice învățate (NU le repeta)

1. **Tab nefocalizat îngheață tranzițiile CSS.** `getComputedStyle` întoarce valoarea de START, nu
   ținta. Când măsori font/poziție animate, întâi taie tranziția: `<style>… { transition: none
   !important }`. A înșelat măsurătoarea de ~4 ori. Un caz era chiar în codul de producție
   (bucla de font citea mărimea veche) — reparat cu `transition:none` pe durata măsurării.
2. **`requestAnimationFrame` NU rulează în tab nefocalizat.** Folosește `setTimeout(…, 0)`.
3. **`?v=N` cache busting.** Fiecare `<script>`/`<link>` din HTML are `?v=N`. Serverul e
   `python http.server`, fără antete de cache, deci browserul servește fișiere vechi. **Urcă N la
   fiecare schimbare** de CSS/JS, altfel userul vede CSS vechi cu JS nou (o bifă nouă apare dar „nu
   face nimic"). E convenția proiectului.
4. **CSS Grid: `1fr` = `minmax(auto, 1fr)`.** `auto` nu lasă coloana să scadă sub conținut, deci un
   titlu lung își lățea singur caseta și apoi „încăpea". Folosește `minmax(0, 1fr)`.
5. **Comenzi fără prompt de permisiune:** fără `cd` (dir-ul de lucru e deja rădăcina); fără
   `$(...)` în mesaje de commit; fără `| tail`/`| head` (pipe-ul cere permisiune separată).
   Vezi memoria `feedback-youlearn-commit-fara-prompturi`.
6. **Verifică vizual, nu doar cu cifre.** De câteva ori măsurătoarea zicea „ok" iar screenshot-ul
   arăta o coliziune (titluri peste antet, casete inegale). Fă și screenshot.
