# Cl. 1 - Rigle — Specificație etapa 1

Motor nou pentru clasa 1. Copilul „măsoară" o sumă de obiecte cu rigle (coloane) de
lățimi diferite. **Etapa 1 = doar schița de mișcare**, fără validare, fără feedback,
fără sărbătoare. Validarea și restul vin în etape ulterioare.

## 1. Scop și non-scop (etapa 1)

**Facem:**
- Un lift îngust care coboară lent și continuu; când atinge podeaua, reapare brusc sus.
- 3 coloane galbene (rigle) de lățimi 2, 3, 4 celule, stânga→dreapta.
- 3 butoane 2/3/4 (ale m2, **complet separate de motorul 1**): look copiat din `.option`,
  dar clasă proprie + CSS hardcodat, container propriu.
- Apăsarea unui buton (sau tastele 1/2/3) mută liftul pe coloana respectivă (glisare
  orizontală lină); coborârea verticală continuă independent.
- Fundal grilă de caiet de matematică; celula = lățimea unui măr.
- Întrebarea fixă „2+1=?" în lift + 3 mere (2 pe roșu, 1 pe albastru), 🍏 emoji cu
  halou neutru în jur (legibil pe orice fundal).
- Apare în meniul din `index.html` și randează în arena, ca celelalte quizuri.

**NU facem acum (etape viitoare):**
- Validare (nicio verificare corect/greșit).
- Feedback: pătrățele portocalii, „Prea mult"/„Prea puțin", mâna care se clatină, clipit.
- Efect de succes, „2+1=3", coborâre glorioasă, trecere la întrebarea următoare.
- Alte întrebări/facts, alte seturi de coloane, coloana 1, alte obiecte.
- Nivele, progres, timeout, sunet.

## 2. Mecanica (etapa 1)

- Liftul e un **bloc rigid** de 3 celule lățime (merele nu se reașază, nu se marchează).
- Coboară vertical, lent, continuu (viteză foarte mică — copii de cl. 1).
- La încărcare stă pe coloana din **mijloc (3)**.
- Apăsare buton `k` (k ∈ {2,3,4}) → liftul glisează orizontal ca stânga lui să se alinieze
  la stânga coloanei `k` (primul măr pe primul slot). Coborârea nu se întrerupe.
- Când liftul ajunge la podea, `y` sare instant sus; `x` **rămâne pe ultima coloană aleasă**.
- Pe coloana 2 (lățime 2) al treilea măr iese vizual în dreapta ghidajului — nemarcat.
  Pe coloana 4 (lățime 4) rămâne un slot gol în dreapta — nemarcat. (Baza pentru
  „prea mult/puțin" de mai târziu, dar acum pur vizual.)

## 3. Layout vizual

Scena Rigle umple `#arena` (cutia 1:2 blocată de `LayoutStage`). Fundal deschis (caiet).

- **Straturi** (jos→sus): paper → coloane (z1) → lift (z2) → **grila de linii (z3)**. Grila
  se vede peste TOT, inclusiv peste coloane și peste lift. Butoanele stau în overlay-ul de
  deasupra `#arena`, deci grila e sub ele.
- **Grilă**: doar linii; pas = `--cell` (lățimea unei celule/măr), aliniată la coloane.
- **Coloane + traseu lift**: pe TOATĂ înălțimea `#arena` (marginea de sus → marginea de jos),
  deci curg pe sub bara de sus și pe sub butoane. Lățimi 2/3/4 celule, distanțate egal;
  `--cell` și golurile se calculează din lățimea arenei (2+3+4 celule + goluri).
- **Lift**: cutie îngustă (3 celule) cu:
  - rândul de sus: textul „2+1=?";
  - rândul de jos: 3 celule-măr — 2 pe fundal roșu, 1 pe fundal albastru; în fiecare, 🍏
    centrat cu **halou neutru** (glow/cerc deschis în spatele emoji-ului) ca să nu depindă
    de culoarea fundalului.
- **Mișcare**: `y` prin `requestAnimationFrame` (descreștere lentă + wrap); `x` prin
  tranziție CSS ~350ms `ease` la apăsarea butonului (sau tastele 1/2/3).
- **Butoane**: fiecare are lățimea coloanei lui și stă exact peste ea (jos). Butoanele de
  sus (≡/CP/⏸) primesc fundal semitransparent cât e m2 activ (scoped), ca scrisul să se
  vadă peste galben.

Parametrii exacți (viteză, `--cell`, culori) se reglează vizual în browser.

## 4. Contract / config motor

`js/rigle/engine.js` expune `window.RigleEngine`:

```js
RigleEngine.mount({ arenaEl, optionsEl, gameEl }, config) → { destroy() }
```

- `mount` injectează stilurile o dată (`<style id="rigle-styles">`), **suprimă shell-ul m1**
  (copiii `#arena` + `#options` întreg + `#lift-fixed-host`), randează scena Rigle în `#arena`
  și propria bară de butoane (`.rigle-buttons`) în stratul de butoane, pornește coborârea și
  ascultătorul de taste 1/2/3.
- `destroy` oprește bucla + tastele, scoate nodurile m2 și **restaurează** exact shell-ul m1.

`config` (etapa 1, dat de quiz):
```js
{
  intrebare: "2+1=?",
  grupe: [ { n: 2, fundal: "rosu" }, { n: 1, fundal: "albastru" } ], // total 3 mere
  obiect: "🍏",
  latimiColoane: [2, 3, 4],
  coloanaInitiala: 3,
  vitezaCoborare: <px/s, mică>,
}
```
Config-driven pentru variațiile viitoare (altă întrebare, alte lățimi, alt obiect).

## 5. Integrare (quiz + app.js)

`js/quizzes/rigle-cl1.js` înregistrează quiz-ul:

```js
QuizRegistry.register({
  id: "rigle-cl1",
  title: "Cl. 1 - Rigle",
  order: 99,               // ultimul în meniu; NU devine default
  create: (meta) => ({
    customEngine: true,      // semnal pentru app.js
    isCompleted: () => true, // ține FallingEngine în STANDBY (vezi mai jos)
    mountArena(hosts) { this._m = RigleEngine.mount(hosts, CONFIG_ETAPA1); },
    unmountArena() { this._m?.destroy(); this._m = null; },
    // stub-uri minime pentru orice apel neguardat:
    getLevel:()=>1, getMinLevel:()=>1, getMaxLevel:()=>1,
    getLevelLabel:()=>"", getLevelButtonTitle:()=>"",
    switchLevel:()=>"", pickNextRound:()=>null, beginRound:()=>({}),
    onAnswer(){}, onTimeout(){},
  }),
});
```

**FallingEngine standby fără să-l modificăm:** bucla de cădere (`falling-engine.js`
~1038) rulează doar dacă `!getQuiz().isCompleted()`; `onPick` (~992) și play/pause (~1065)
la fel. Deci `isCompleted() → true` face motorul 1 complet inert cât timp Rigle e activ,
folosind contractul existent. Nu atingem `falling-engine.js`.

**Modificări `app.js`** (mici, toate guard-ate pe `customEngine` → quizurile existente
neatinse):
1. `switchQuiz`: la început, dacă quiz-ul curent e customEngine → `unmountArena()`.
2. `switchQuiz`: în loc de `engine.startRound(...)` → dacă customEngine → `mountArena(...)`.
3. Startup (~1131): același branch mount vs startRound.
4. `buildLevelPicker`: dacă customEngine → golește level picker și return.
5. `renderProgress`: dacă customEngine → ascunde progresul, golește level-info, return.

`engine.startFallLoop()` rămâne apelat la pornire (inofensiv când `isCompleted`).

## 6. Fișiere

| Fișier | Ce |
|---|---|
| `js/rigle/engine.js` (nou) | Motorul Rigle: stil injectat, scenă, coborâre, glisare, mount/destroy. |
| `js/quizzes/rigle-cl1.js` (nou) | Înregistrare quiz + config etapa 1 + contract customEngine. |
| `js/app.js` (modificat) | 5 branch-uri mici guard-ate pe `customEngine`. |
| `index.html` (modificat) | 2 `<script>` noi (`?v=1`) înainte de `app.js`; bump `app.js?v=74→75`. |

Stilul se injectează din JS (ca `facts din coloane animate`), deci `style.css` **nu** se
atinge (fără bump `style.css`).

## 7. Riscuri și presupuneri (verificate)

- ✅ *Riscul principal*: cum coexistă un motor propriu cu app.js centrat pe FallingEngine.
  Rezolvat: `#arena` e un container simplu în care randez; `isCompleted()→true` pune motorul
  1 pe standby fără modificări; app.js primește 5 guard-uri mici.
- ✅ Butoanele: refolosesc slotul `#options` (grid 3 col) + clasele `.option` → identice.
- ⚠ Estetic: scena Rigle e deschisă (caiet) peste app-ul închis — verific în browser, ajustez.
- ⚠ Reglaje fine (viteză, `--cell`, halou) — se fac vizual, nu din prima.

## 8. Criterii de succes (falsificabile)

1. „Cl. 1 - Rigle" apare în meniu; selectat, arena arată grilă + 3 coloane galbene 2/3/4 +
   lift cu „2+1=?" și 3 mere 🍏 (2 roșu / 1 albastru, cu halou).
2. Liftul coboară lent, continuu; la podea reapare sus, pe aceeași coloană.
3. Apăs 2/3/4 → liftul glisează lin pe coloana respectivă și continuă să coboare.
4. Butoanele arată identic cu cele din motorul 1.
5. Comut la alt quiz și înapoi → motorul 1 funcționează normal (Rigle nu l-a stricat);
   Rigle se remontează curat.
6. Fără erori în consolă; `node --check` pe fișierele noi trece.
