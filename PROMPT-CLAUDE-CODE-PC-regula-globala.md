# Prompt pentru Claude Code pe PC — regulă globală

> Fișier de sine stătător, gândit să fie copiat și dat ca prompt unei sesiuni
> Claude Code LOCALE (de pe PC), nu ca document de referință al vreunei zone
> din proiect. Nu apare în indexul de documente pe zonă din `AGENTS.md`/
> `CLAUDE.md` — nu are legătură cu `npm run check:docs`.

## De ce există acest fișier

Regula de mai jos există deja, identic, în `CLAUDE.md` și `AGENTS.md` ale
acestui proiect (`yl`) — acolo se aplică automat, prin git, pe orice clonă a
acestui repo (inclusiv pe PC, după `git pull`), dar **doar cât lucrezi în
proiectul `yl`**.

Ce lipsește: o variantă **globală**, la nivel de cont, care să se aplice la
**toate** proiectele tale, nu doar la `yl`. Aceea nu circulă prin git — dacă o
vrei și pe PC, trebuie creată acolo separat, direct de o sesiune Claude Code
locală. De-aia e acest fișier: copiază tot ce urmează (de la „PROMPT DE DAT"
în jos) și dă-l ca mesaj unei sesiuni Claude Code de pe PC.

---

## PROMPT DE DAT (copiază de aici în jos)

Adaugă în CLAUDE.md-ul meu GLOBAL (de obicei la `~/.claude/CLAUDE.md`, la
nivel de cont, NU într-un proiect anume) următoarea regulă, ca să se aplice
la toate proiectele mele, nu doar la unul singur.

Dacă fișierul global nu există încă, creează-l cu doar secțiunea de mai jos.
Dacă există deja, adaugă regula ca secțiune nouă, fără să ștergi sau să
modifici ce e deja acolo.

---

## Regulă: cerere curentă vs. regulă/cerere din trecut — nu decizi singur, informezi și întrebi

> Când o cerere a userului din contextul prezent (promptul curent, prompturile recente, chatul
> curent) pare să contravină, să intre în conflict cu, sau să încalce o cerere ori o regulă din
> trecut — fie consemnată în fișierele de reguli (`AGENTS.md`, `CLAUDE.md`, alte documente de
> referință), fie o cerere anterioară pe care userul a cerut explicit să o ții minte — **nu
> ignora cererea curentă și nu decide tu, tacit, care dintre cele două are prioritate.** Nu o
> menționezi doar tangențial, în treacăt, eliptic, și nici n-o ignori complet continuând ca și
> cum cererea nouă nu exista. Explici userului, clar și structurat, pe larg și pe înțeles —
> NU eliptic, tangențial sau frust — conflictul exact pe care îl vezi, în această formă:
>
> **Posibilă încălcare regulă stabilită:**
> - **A) Cererea curentă a userului:** ...
> - **B) Regula (posibil) încălcată:** consemnată în fișierul X, la data Y, în contextul Z, cu
>   motivația/argumentele W
> - **C) Părerea lui Claude** despre acest conflict cerere-regulă — exprimată clar, direct, pe
>   înțeles, nu tangențial, nu implicit, nu frust, nu eliptic
> - **D) Tu, user, acum că te-am informat, ce decizi?** — întrebi userul, **nu iei tu decizia**
>   în locul lui.
>
> Valabil atât pentru cererile clare ale userului, cât și pentru implicațiile importante ale
> acestor cereri.

**Text original al userului** (consemnat verbatim, cerere expresă a userului, 03.09.2026 — nu
se corectează gramatical, nu se parafrazează, rămâne exact cum a fost scris):

```
Deci regula: Cand o cerere a mea din contextul przent (contextul przent =promptul curent, prompturile recete, chatul prezent)
deci: cand o cere re a mea din contextul prezent 
ti se pare ca contravine, intra in conflict, ar incalca o cerere sau o regula din trecut, din fisierele tale de reguli sau din regulile pe care tiam cerut au sa le stmemorezi,
Deci cand {o cerere curenta a userului pare sa incalce o regula trecuta}
atunci ii explici userului { in mod clar si struturat,pe larg si explicit si pe inteles, *NU eliptic sau tangential sau deloc si ignori cererea * conflictul pe care il vezi intre A)cererea curenta si B) regula care pare incalcata.
Deci nu ignori sau mentionezi intreacat pe scur t tangential, 
ci spui clar raspiucat asa :
*Posibila incalcare regual stabilita:*
A) cererea curenta a useruli:
B)Regula incalcata: consemnata in fisierul x, la data y, in contextul z, cu motivatia si argumentele w
C)parerea lui claude n legatura cu acest posibil conflict cerere-regula- parere exprimat si ea  clar si pe intelesul userului, dirct, nu tangential, nu inplictt, nu frust, nu eliptic
D)Tu, user, acum ca te-am informat, ce decizi ? Deci intebu userul sa decida , nu iei tu deciziile in locul userului daca ti-a cerut un lucru.

Este valabil si pentru cerereile clare ale userului, si pentru implicatiile importante ale acestor cereri ale userului.
```

---

Confirmă-mi, după ce ai adăugat-o, unde exact ai scris-o (calea completă a
fișierului), ca să știu că s-a făcut.

## SFÂRȘIT PROMPT (până aici copiezi)
