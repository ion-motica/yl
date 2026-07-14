<!-- Conversie de referin?? din DOCX; documentul .docx r?m?ne sursa vizual? autoritar?. -->

# Specificație MABP pentru interpretarea și vizualizarea datelor YouLearn

Tablele +, −, ×, ÷ | versiune de proiectare 0.1 | 14 iulie 2026

> Statut: Document de specificație și plan de testare. Pragurile numerice marcate „provizoriu” trebuie calibrate pe date reale înainte de a fi prezentate drept reguli stabile.

## Rezumat executiv

MABP este un motor declarativ, configurat prin fișiere text și valori din array-uri, care selectează, filtrează, agregă, compară și vizualizează logurile YouLearn fără a cere cod separat pentru fiecare raport. Același flux comun primește o configurație explicită, o validează, o normalizează și produce un model de rezultat pentru grile, grafice și mesaje.

Sistemul trebuie să răspundă separat la două întrebări: „Care este starea actuală?” și „Ce progres a fost observat în perioada aleasă?”. Ambele rezultate sunt disponibile per fact, per subtablă și per tablă completă. Datele brute nu sunt modificate; filtrele afectează numai analiza curentă.

- Starea actuală combină precizia la prima apăsare cu viteza răspunsurilor corecte la prima apăsare.

- Direcția separă: progres, stabil la nivel bun, stabil încă nefluent, regres probabil și date insuficiente.

- Grila de stare și grila de direcție sunt hărți separate; fiecare poate fi descompusă în folii disjuncte și reasamblată.

- Progresul agregat se calculează în interiorul acelorași facts comparabile, apoi se agregă; nu se compară direct amestecuri diferite de dificultate.

- MABP permite preseturi standard reproductibile și configurații exploratorii cu avertismente.

## Cuprins

1. Scop, limite și principii

2. Contractul datelor

3. Arhitectura fluxului

4. Axele configurabile MABP

5. Filtrarea și calitatea datelor

6. Statisticile și metricile

7. Starea actuală

8. Progresul și direcția

9. Agregarea per fact/subtablă/tablă

10. Vizualizările

11. Preseturile și reproductibilitatea

12. Validitatea statistică și limitele

13. API-ul și configurațiile

14. Etapizarea implementării

15. Testele automate și manuale

16. Fixture-urile dummy

17. Criterii finale de acceptare

18. Ce mai lipsea înainte de implementare

19. Referințe metodologice

## 1. Scop, limite și principii

### 1.1 Scop

Tool-ul analizează date longitudinale din exercițiile de fluență pentru tablele +, −, × și ÷. El trebuie să arate clar, inclusiv în zecimi de secundă, schimbări mici care se acumulează și pe care copilul nu le percepe subiectiv.

### 1.2 Ce poate afirma

- „Performanța măsurată în YouLearn este acum mai rapidă / mai precisă / mai stabilă decât în fereastra de comparație.”

- „Schimbarea apare pe facts comparabile și nu este explicată doar de o compoziție mai ușoară a exercițiilor.”

- „Rezultatul este preliminar / tendință / stabil, în funcție de volumul și distribuția datelor.”

### 1.3 Ce nu poate afirma singur

- Nu poate demonstra că YouLearn este singura cauză a progresului; există școală, teme, maturizare și practică externă.

- Nu poate identifica sigur cauza fiecărui timp extrem: ezitare matematică, distragere, problemă tehnică sau plecare de lângă dispozitiv.

- Nu poate declara mastery dintr-o singură apăsare foarte rapidă; apăsarea poate fi norocoasă sau anticipativă.

### 1.4 Principii de design

- Configurație declarativă: comportamentul se schimbă prin obiecte/array-uri, nu prin ramificații noi în cod.

- Flux procedural clar: validează → normalizează → selectează → filtrează → agregă → compară → clasifică → construiește vizualizarea.

- Date brute imuabile: niciun filtru nu șterge sau rescrie jurnalul.

- Quizul raportează; modulul de analiză procesează. Modulul nu parsează textul întrebării ca să ghicească context structural.

- Aceeași funcție primește argumente diferite; nu există câte o funcție separată pentru fiecare tabelă, fact sau grafic.

- Preseturile standard sunt reproductibile și versionate; explorarea este permisă, dar marcată explicit.

## 2. Contractul datelor

### 2.1 Schema brută existentă

```
{
  data_ora_ro: "2026-07-12 01:11:06",
  quiz_name: "...",
  subquiz_name: "..." | null,
  intrebare: "22=?*11",
  raspuns: "2",
  raspuns_corect: true,
  a_cata_apasare_pe_buton: 1,
  durata_raspuns_secunde: 1.3,
  fact: "11*2=22",
  quiz_id: "...",
  subquiz_id: "..." | null,
  fact_id: "mul:11*2=?",
  eq_form: "22=?*11",
  extra: {}
}
```

### 2.2 Gruparea apăsărilor pe întrebări

Câmpul a_cata_apasare_pe_buton este suficient pentru delimitare, cu condiția păstrării ordinii de salvare. Valoarea 1 începe o întrebare, iar 2, 3 etc. continuă aceeași întrebare până la următorul 1. Timestampul nu este folosit pentru această delimitare; două evenimente pot avea aceeași secundă fără ambiguitate.

> Condiție: Citirea din IndexedDB trebuie să păstreze ordinea autoritativă a cheii auto-incrementate sau a cursorului. Nu sorta numai după data_ora_ro.

### 2.3 Câmpuri necesare pentru cerințele complete

| Câmp | Statut | De ce este necesar | Implementare minimă |
| --- | --- | --- | --- |
| session_id | NECESAR | Analize pe N sesiuni, prima apariție în sesiune, început vs sfârșit și bootstrap pe sesiuni. | Top-level în schema v2 sau temporar extra.session_id. |
| quiz_version | NECESAR | Evită amestecarea datelor produse de versiuni cu logică ori timing diferit. | Top-level sau extra.quiz_version. |
| question_index_in_session | UTIL | Testează poziția în sesiune și păstrează o ordine locală explicită. | Poate fi derivat la rulare și transmis în extra. |
| button_options + selected_button_index | OPȚIONAL | Ajută la depistarea apăsării repetate pe aceeași poziție și analiza distractorilor. | În extra; nu este necesar pentru prima versiune. |
| event_type / timeout | OPȚIONAL IMPORTANT | Timeouturile lipsă pot face performanța observată să pară mai bună decât experiența completă. | button_press / timeout; poate veni într-o versiune ulterioară. |

### 2.4 Catalogul matematic declarativ

Analiza pe subtable, EFF și rolul necunoscutei nu trebuie obținută prin parsarea textelor. Un catalog de domeniu, configurat ca date, mapează fact_id și eq_form la structura matematică.

```
factCatalog["mul:3*?=21"] = {
  operatie: "mul",
  fact_canonic_id: "mul:3*7=21",
  subtable_ids: ["mul:3:*", "mul:*:7"],
  table_id: "mul:1-10x1-10",
  eff_id: "eff:3:7:21",
  eff_member_id: "mul:3*7=21",
  unknown_member_role: "b",
  eq_form_id: "3*?=21"
};
```

Denumire recomandată pentru selecția descrisă anterior: „același rol al necunoscutei”. Rolul este membrul structural a, b sau c care este necunoscut. Este mai precis decât „necunoscută cu valoare comună”, care poate sugera că numărul este identic.

## 3. Arhitectura fluxului

```
date brute IndexedDB
→ valideazaInregistrari()
→ normalizeazaInregistrari()
→ grupeazaApasariPeIntrebari()
→ aplicaSelectiaDeDomeniu()
→ evalueazaCalitateaDatelor()
→ aplicaFiltrulCurent()
→ calculeazaMetrici()
→ comparaFerestre()
→ clasificaStareaSiDirectia()
→ construiesteModelVizualizare()
→ afiseaza()
```

Fiecare etapă produce date inspectabile. Această separare este esențială pentru testare: dacă o grilă este greșită, se poate vedea dacă eroarea vine din grupare, filtrare, metrică, comparație sau doar din randare.

## 4. Axele configurabile MABP

| Axă | Valori inițiale | Observație |
| --- | --- | --- |
| Domeniu matematic | fact; subtablă; tablă; interval custom a–b op c–d | Pentru +/−/×/÷ regulile de apartenență vin din catalog. |
| Structură selectată | eq_form unic; toate eq_forms ale factului; același rol al necunoscutei; tot EFF; selecție granulară matrice | Matrice: linii = membri EFF; coloane = eq_forms. |
| Fereastră | 1/7/10/30 zile; N sesiuni; N răspunsuri; de la început; interval custom | Timpul calendaristic și volumul sunt moduri distincte. |
| Filtru | fără filtrare; praguri fixe; IQR; MAD; preset custom | Mediana nu este filtru, ci statistică de agregare. |
| Metrică | precizie; mediană RT; rapid+corect; bucketuri; retries; delta timp; delta precizie | Mai multe metrici pot fi afișate împreună. |
| Agregare | per răspuns; per fact; per sesiune; mediană; percentilă; medie tăiată | Ponderarea trebuie declarată. |
| Comparație | fără; fereastra precedentă; baseline; început; best previous; custom | Facts comparabile obligatoriu pentru progres agregat. |
| Unitatea punctului | întrebare; zi; sesiune; calup N; fact | Determină ce reprezintă un punct în grafic. |
| Rezultat | stare actuală; direcție/progres | Nu se amestecă într-o singură taxonomie. |
| Vizualizare | grilă; linie; bare; distribuție; tabel; scatter viteză–precizie | Prima versiune poate avea doar grilă, linie și tabel. |
| Număr/aranjare | 1 grafic; 10 grafice subtablă; small multiples; grilă completă | 100 de grafice sunt exploratorii, nu default. |
| Suficiență | netestat; insuficient; semnal; tendință; stabil | Este metadată obligatorie a rezultatului. |

## 5. Filtrarea și calitatea datelor

### 5.1 Separarea conceptuală

- Filtrarea decide ce observații sunt admise într-o metrică.

- Agregarea decide cum sunt rezumate observațiile admise.

- Clasificarea decide ce etichetă primește rezultatul.

- Vizualizarea decide cum este prezentat rezultatul.

### 5.2 Grupe temporale inițiale

| Interval | Interpretare inițială | Acțiune implicită |
| --- | --- | --- |
| [0, 0,5) s | Apăsare suspect de rapidă / anticipativă | Marcată; exclusă din metrica de timp în presetul standard. |
| [0,5, 2) s | Rapid / fluent | Inclusă. |
| [2, 4) s | Acces lent, încă funcțional | Inclusă. |
| [4, 5) s | Lent | Inclusă și vizibilă separat. |
| [5, 15) s | Foarte lent / calcul deliberat / posibilă distragere | Inclusă în distribuție; mediana îi reduce influența. |
| [15, +∞) s | Pauză probabilă | Marcată; exclusă din metrica de timp în presetul standard. |

> Rezervă: Pragurile sunt convenții pedagogice și de produs, nu adevăruri universale. Ele trebuie calibrate pe vârstă, operație, eq_form, dispozitiv și date reale.

### 5.3 Metode robuste disponibile

| Metodă | Rol corect | Avantaj | Limită |
| --- | --- | --- | --- |
| Mediană | Agregare | Rezistă la câteva valori extreme și exprimă timpul tipic. | Poate ascunde frecvența blocajelor; se completează cu bucketuri. |
| Percentile P25/P50/P75/P90 | Descriere distribuție | Arată consistența și coada lentă. | Instabile la n mic. |
| IQR, Q3 + 1,5×IQR | Marcare outlieri moderați | Simplu și robust. | Poate marca drept suspectă o ezitare matematică reală. |
| IQR, Q3 + 3×IQR | Marcare outlieri extremi | Mai conservator pentru excluderea pauzelor. | Poate rata întreruperi mai scurte. |
| MAD / scor MAD modificat | Marcare robustă a distanței față de mediană | Foarte rezistent la extreme. | MAD poate fi 0 când mulți timpi sunt identici; mai greu de explicat. |
| Medie tăiată | Agregare alternativă | Folosește mai multe date decât mediana, reduce extremele. | La n mic poate elimina semnal real. |
| Winsorizare | Limitarea influenței extremelor | Păstrează numărul observațiilor. | Amestecă valori foarte diferite la aceeași limită. |
| Separare după cauză | Calitatea datelor | Cea mai interpretabilă când cauza este cunoscută. | Cauza nu poate fi dedusă sigur doar din timp. |

### 5.4 Eligibilitatea diferă pe metrică

| Metrică | Date incluse implicit | Date excluse implicit |
| --- | --- | --- |
| Precizie la prima apăsare | Toate întrebările valide, inclusiv lente și greșite. | Evenimente tehnic invalide; opțional anticipativele dacă presetul decide explicit. |
| Timp tipic | Numai răspunsuri corecte la apăsarea 1. | Apăsări 2/3, greșeli, <0,5 s și ≥15 s în presetul standard. |
| Distribuție temporală | Toate primele apăsări valide sau numai corectele, conform configurației. | Numai evenimente tehnic invalide; categoria 15+ rămâne vizibilă. |
| Corect și rapid | Toate întrebările; succes dacă prima apăsare este corectă și sub prag. | Evenimente tehnic invalide. |

Acest design evită o eroare comună: eliminarea răspunsurilor lente din precizie. Un răspuns lent este tot o încercare și poate fi corect sau greșit; doar metrica de viteză poate decide că nu reprezintă timpul de procesare valid.

## 6. Statisticile și metricile

### 6.1 Metrici de bază

```
precizie_prima_apasare = intrebari_corecte_la_apasarea_1 / total_intrebari_valide

timp_tipic = mediana(timpurilor corecte la apasarea 1, dupa filtrul de timp)

rapid_si_corect = intrebari corecte la apasarea 1 si timp <= prag / total intrebari valide

bucket_i = numar observatii in intervalul i / total observatii eligibile
```

### 6.2 Incertitudine

- Precizie: interval Wilson pentru proporție, nu interval normal simplu, mai ales la n mic sau procente aproape de 0/100%.

- Mediană și diferența medianelor: interval bootstrap. Pentru subtablă/tablă, resamplingul se face preferabil pe sesiuni sau zile, nu pe răspunsuri independente.

- Graficele de monitorizare pot folosi mediană mobilă sau EWMA pentru a vedea schimbări graduale, dar linia netezită nu este un test independent în fiecare zi.

### 6.3 Niveluri operaționale de suficiență

| Observații comparabile | Etichetă | Interpretare |
| --- | --- | --- |
| 0 | netestat | Nu există date. |
| 1–4 | date insuficiente | Se afișează observațiile, fără verdict de direcție. |
| 5–9 | semnal preliminar | Poate ghida practica, nu susține o concluzie fermă. |
| 10–19 | tendință | Util pentru feedback prudent și actualizare rolling. |
| 20–49 | estimare utilă | Destul de stabilă pentru decizii pedagogice prudente. |
| 50+ | estimare robustă operațional | Confirmare mai bună; nu este un prag magic de semnificație statistică. |

> Important: Aceste niveluri sunt praguri operaționale pentru produs, nu standarde universale. Validitatea depinde și de numărul de sesiuni distincte, distribuția în timp și consistența eq_form.

## 7. Starea actuală

### 7.1 Întrebarea

Starea actuală răspunde: „Cât de fluent este acum copilul la unitatea selectată?”. Se calculează dintr-o fereastră recentă configurabilă, nu obligatoriu din întreaga istorie.

### 7.2 Taxonomia

| Stare | Definiție conceptuală | Regulă provizorie de pornire |
| --- | --- | --- |
| fluent | Rapid și precis în mod repetat. | Precizie ≥95%, mediană <1,5 s și date suficiente; pragurile sunt configurabile. |
| în consolidare | În mare parte corect, dar viteza sau stabilitatea nu a trecut încă pragul. | Precizie aproximativ 90–95% ori mediană 1,5–4 s, fără semnal sever de grabă. |
| în lucru | Răspunsul este încă nesigur, lent sau dependent de căutare/calcul. | Precizie <90%, mediană ≥4 s sau combinație nefavorabilă viteză–precizie. |
| netestat | Nu există date eligibile. | n=0. |

Clasificarea trebuie să folosească viteza și precizia împreună. Un fact cu mediană 1,3 s și 70% corect nu este fluent; un fact cu 98% corect și 2,4 s poate fi în consolidare, nu „neștiut”.

### 7.3 Fereastra stării actuale

- Per fact: ultimele 10–20 apariții sau ultimele N sesiuni în care factul a apărut.

- Per subtablă/tablă: ultimele 30–100 de răspunsuri, dar cu agregare echilibrată per fact.

- La lipsa aparițiilor recente, starea rămâne ultima estimare cunoscută și este însoțită de vechimea ei.

## 8. Progresul și direcția

### 8.1 Întrebarea

Direcția răspunde: „Cum s-a schimbat performanța față de fereastra de comparație?”. Perioada poate fi: munca de azi, 7 zile, N sesiuni, N răspunsuri, interval personalizat sau de la începutul antrenamentului.

### 8.2 Taxonomia agreată

| Direcție | Sens |
| --- | --- |
| progres | Timpul s-a îmbunătățit fără pierdere relevantă de precizie și/sau precizia a crescut fără încetinire relevantă. |
| stabil la nivel bun | Schimbarea este mică, iar starea actuală este fluentă. Plafonul bun nu este numit stagnare. |
| stabil încă nefluent | Schimbarea este mică, iar starea actuală nu este fluentă. |
| regres probabil | Viteza și/sau precizia s-au deteriorat suficient de mult și există date comparabile; termenul „probabil” recunoaște fluctuația. |
| date insuficiente | Nu există destule date comparabile în ambele ferestre. |

### 8.3 Reguli provizorii pentru clasificare

| Situație | Clasificare |
| --- | --- |
| timp ↓ cu cel puțin pragul minim relevant; precizia stabilă sau ↑ | progres |
| precizie ↑ material; timpul stabil sau ↓ | progres |
| timp ↓, dar precizia ↓ material | nu progres; mesaj de grabă / compromis viteză–precizie |
| timp aproximativ stabil; precizie stabilă; stare fluentă | stabil la nivel bun |
| timp aproximativ stabil; precizie stabilă; stare nefluentă | stabil încă nefluent |
| timp ↑ material și/sau precizie ↓ material, cu date suficiente | regres probabil |
| n insuficient ori facts necomparabile | date insuficiente |

> Prag minim relevant: Valori precum 0,1–0,2 s și 3–5 puncte procentuale pot fi folosite inițial doar ca parametri configurabili. Clasificarea finală trebuie să țină cont și de intervalele de incertitudine și de consistența pe sesiuni.

### 8.4 „Progresul de azi”

Nu se compară pur și simplu azi cu ieri, deoarece compoziția poate diferi. Se compară starea estimată înainte de prima sesiune a zilei cu starea estimată după datele zilei, numai pe facts comparabile. Mesajul corect este „schimbare observată după munca de azi”, nu „efect cauzat sigur de sesiunea de azi”.

### 8.5 Mesaje către copil

| Semnal | Mesaj de bază |
| --- | --- |
| progres sănătos | „Poate nu se simte încă, dar la exercițiile comparabile răspunzi de obicei cu aproximativ 0,2 secunde mai repede, iar precizia s-a păstrat.” |
| viteză ↑, precizie ↓ | „Ai început să răspunzi mai repede, dar precizia a scăzut puțin. Nu te grăbi: este mai important să răspunzi corect. Viteza va veni pe măsură ce răspunsurile devin sigure.” |
| stabil bun | „Ți-ai păstrat fluența la un nivel bun.” |
| regres probabil | „În perioada aceasta unele răspunsuri au fost mai lente sau mai nesigure. Nu este un verdict; merită o scurtă reactivare.” |

## 9. Agregarea per fact, subtablă și tablă

### 9.1 Per fact

- Se compară ferestre de apariții ale aceluiași fact și, când este cerut, ale aceluiași eq_form.

- Starea poate fi actualizată rolling la fiecare apariție; verdictul de direcție depinde de suficiența datelor.

- Apăsarea corectă accidentală este neutralizată prin repetare, nu prin presupunerea că orice timp scurt este fals.

### 9.2 Per subtablă/tablă

Mediana brută a tuturor răspunsurilor este doar „performanța observată” și poate fi distorsionată de schimbarea compoziției. Pentru progres comparabil se calculează mai întâi delta per fact, apoi se agregă delta-urile.

```
pentru fiecare fact prezent in ambele ferestre:
  delta_timp_fact = mediana_veche - mediana_noua
  delta_precizie_fact = precizie_noua - precizie_veche

progres_tabela = mediana(delta_timp_fact)
precizie_tabela = mediana(delta_precizie_fact)
ponderare implicita = greutate egala per fact
```

### 9.3 Moduri de ponderare

| Mod | Când este util | Risc |
| --- | --- | --- |
| greutate egală per răspuns | Descrie experiența efectivă din quiz. | Facts repetate adaptiv domină rezultatul. |
| greutate egală per fact | Descrie schimbarea tipică a competențelor. | Un fact cu n mic poate primi prea multă greutate; cere prag minim. |
| greutate egală per sesiune | Reduce dominația sesiunilor lungi. | Sesiunile pot conține facts diferite. |

Presetul standard de progres per subtablă/tablă va folosi greutate egală per fact, numai pentru facts care au suficiente date în ambele ferestre.

## 10. Vizualizările

### 10.1 Grila stării actuale

Pentru fiecare tablă (de exemplu 1–10 × 1–10) există o grilă. Fiecare fact aparține exact unei folii disjuncte: fluent, în consolidare, în lucru sau netestat. Foliile pot fi afișate separat ori reasamblate pentru a reconstrui întreaga grilă.

### 10.2 Grila direcției

Separat de starea actuală există grila direcției pentru perioada selectată. Fiecare fact aparține exact uneia dintre foliile: progres, stabil la nivel bun, stabil încă nefluent, regres probabil, date insuficiente.

> Regulă vizuală: Grila de stare și grila de direcție nu se suprapun una peste alta în vizualizarea implicită. În interiorul fiecărei grile, foliile sunt disjuncte, deci reasamblarea nu produce celule cu culori concurente.

### 10.3 Detaliul unei celule

```
7×8
stare: in consolidare
precizie prima apasare: 94%
timp median filtrat: 1,7 s
rapid si corect <2 s: 72%
n=32 raspunsuri, 11 sesiuni
filtru: fluenta_standard_v1
ultima actualizare: 14 iulie 2026
```

### 10.4 Grafice

- Grafic de stare: evoluția medianei și a preciziei pe zile/sesiuni/calupuri.

- Grafic de progres: secunde câștigate față de baseline sau față de fereastra precedentă.

- Distribuție pe bucketuri: <0,5; 0,5–2; 2–4; 4–5; 5–15; 15+.

- Small multiples: 10 grafice pentru o subtablă sau selecția configurată.

- Scatter viteză–precizie: exploratoriu, pentru a vedea compromisuri și grupuri.

Nu se însumează delta-urile ferestrelor suprapuse, deoarece aceeași îmbunătățire ar fi numărată repetat. Mesajul „ai câștigat 0,4 s” folosește diferența dintre baseline și starea curentă, nu suma diferențelor zilnice.

## 11. Preseturile și reproductibilitatea

### 11.1 Tipuri de preset

| Tip | Caracteristici |
| --- | --- |
| standard | Definiții stabile, filtre versionate, validare strictă; folosit pentru mesaje către copil/părinte și comparații în timp. |
| exploratoriu | Permite combinații neobișnuite; afișează avertismente și nu produce automat verdicte ferme. |
| filtrare | Definește exclusiv includerea/excluderea din analiza curentă și motivele; nu modifică datele brute. |
| vizualizare | Definește grila/graficul, punctele și aranjarea, fără să schimbe metrica de bază. |

### 11.2 Metadate obligatorii ale rezultatului

- preset_id și preset_version;

- filter_preset_id și filter_version;

- intervalul și momentul calculului;

- numărul total, inclus și exclus de observații;

- motivele excluderii;

- numărul de facts, sesiuni și zile distincte;

- modul de ponderare;

- avertismentele validatorului.

## 12. Validitatea statistică și limitele

### 12.1 Ce este realist la volumul estimat

Pentru aproximativ 2.500 de întrebări, 30–50 pe zi activă și 50–80 de zile active distribuite pe circa 270 de zile calendaristice, există volum suficient pentru feedback frecvent la nivelul întregii table și al subtablelor. Per fact, feedbackul zilnic este o stare rolling, nu o estimare independentă a zilei; concluziile devin mai robuste pe măsură ce se acumulează apariții și sesiuni distincte.

| Nivel | Zilnic | 7 zile | 30 zile / termen lung |
| --- | --- | --- | --- |
| fact | stare rolling; deseori n mic | semnal/tendință dacă factul reapare | estimare utilă și eventual robustă |
| subtablă | estimare rolling rezonabilă | tendință stabilă | robustă |
| tablă completă | 30–50 răspunsuri permit feedback frecvent | robustă dacă se controlează compoziția | foarte stabilă descriptiv |

### 12.2 Dependența observațiilor

Răspunsurile din aceeași sesiune nu sunt independente: există încălzire, oboseală, repetare imediată și context comun. Din acest motiv, bootstrapul pentru agregate trebuie să reeșantioneze sesiuni sau zile întregi când există suficiente unități, nu fiecare răspuns ca și cum ar fi independent.

### 12.3 Prima apariție versus toate aparițiile

- Toate aparițiile măsoară performanța de antrenament și adaptarea în sesiune.

- Prima apariție a factului în zi/sesiune este un indicator mai bun pentru retenție și acces fără încălzire.

- Ambele sunt utile, dar nu trebuie amestecate sub aceeași etichetă.

### 12.4 Apăsarea norocoasă și slip-ul

O apăsare corectă poate fi ghicită, iar o eroare poate fi un slip chiar dacă factul este cunoscut. Tool-ul nu încearcă în prima versiune un model complet de knowledge tracing; folosește repetarea, consistența și precizia pe ferestre pentru a reduce influența unei încercări izolate.

## 13. API-ul și configurațiile

### 13.1 Contractul principal

```
const rezultat = ruleazaAnaliza({
  schemaVersion: 1,
  domeniu: {...},
  structura: {...},
  fereastra: {...},
  filtruPreset: "fluenta_standard_v1",
  metrici: [...],
  agregare: {...},
  comparatie: {...},
  rezultat: "stare_curenta" | "directie",
  vizualizare: {...}
});
```

### 13.2 Fluxul intern

```
function ruleazaAnaliza(configuratie) {
  const configuratieValida = valideazaConfiguratia(configuratie);
  const config = normalizeazaConfiguratia(configuratieValida);
  const apasari = citesteInregistrari(config);
  const intrebari = grupeazaApasarilePeIntrebari(apasari);
  const selectate = selecteazaDomeniul(intrebari, config);
  const evaluate = evalueazaCalitateaDatelor(selectate, config);
  const filtrate = aplicaFiltrul(evaluate, config);
  const metrici = calculeazaMetricile(filtrate, config);
  const comparatie = comparaFerestre(metrici, config);
  const clasificare = clasificaRezultatul(comparatie, config);
  return construiesteModelVizualizare(clasificare, config);
}
```

### 13.3 Regula anti-complexitate

Fișierele de configurare nu conțin JavaScript arbitrar, callbackuri sau mini-limbaje. Ele aleg numai primitive deja implementate. Dacă apare o nevoie cu adevărat nouă, se adaugă o singură primitivă în motor și apoi devine disponibilă tuturor presetelor.

## 14. Etapizarea implementării

Fiecare etapă se oprește la un rezultat verificabil. Nu se începe etapa următoare până când testele automate și verificarea manuală ale etapei curente trec.

### Etapa 0 — Înghețarea contractului și a fixture-urilor

NECESAR în etapă:

- Documentează schema brută și regulile de ordine.

- Adaugă session_id și quiz_version în logurile de test.

- Încarcă fixture-ul dummy și rezultatele așteptate.

- Stabilește catalogul minim pentru facts, subtable și EFF.

Teste automate de trecere:

- Parserul încarcă JSON fără eroare.

- Numărul de înregistrări este exact.

- Schema invalidă produce mesaje clare, nu rezultate parțiale.

Verificare manuală de către utilizator:

- Deschide fixture-ul și verifică vizual 3 secvențe 1→2/3.

- Confirmă că două evenimente cu același timestamp rămân în ordinea array-ului.

### Etapa 1 — Gruparea apăsărilor și modelul de întrebare

NECESAR în etapă:

- Implementează grupeazaApasarilePeIntrebari.

- Derivă corect_din_prima, numar_apasari, corectat_in_final și timpii relevanți.

- Nu implementează încă statistici sau grafice.

Teste automate de trecere:

- Secvența 1,2,3 devine o singură întrebare cu 3 apăsări.

- Un nou 1 închide întrebarea precedentă.

- Un 2 fără 1 anterior produce eroare de calitate, nu este atașat arbitrar.

Verificare manuală de către utilizator:

- Afișează un tabel brut cu primele 20 de întrebări agregate.

- Compară manual cu JSON-ul dummy.

### Etapa 2 — Metricile descriptive fără filtrare

NECESAR în etapă:

- Calculează n, precizie prima apăsare, mediană RT corect și bucketurile temporale.

- Implementează per fact și un raport simplu de tabel.

- Nu clasifică încă fluent/progres.

Teste automate de trecere:

- Medianele sunt corecte pe liste cunoscute.

- Greșelile intră în precizie, nu în mediana timpilor corecți.

- Bucketurile însumează 100% (în limita rotunjirii).

Verificare manuală de către utilizator:

- Alege un fact dummy și calculează manual mediana pe hârtie/calculator.

- Verifică numărul răspunsurilor din fiecare bucket.

### Etapa 3 — Calitatea datelor și filtrarea

NECESAR în etapă:

- Implementează <0,5 s și ≥15 s ca marcaje.

- Aplică filtre separat pe timp și precizie.

- Adaugă raport total/inclus/exclus/motiv.

- Apoi adaugă IQR 1,5/3; MAD rămâne opțional până la validare.

Teste automate de trecere:

- Fixture-ul 7×8 detectează exact un timp anticipativ și o pauză probabilă.

- Schimbarea filtrului nu modifică JSON-ul brut.

- Fără filtrare și filtrul standard produc rezultate diferite, reproductibile.

Verificare manuală de către utilizator:

- Comută presetul fără filtrare / standard și verifică diferențele.

- Confirmă că 18 s rămâne vizibil în categoria 15+, chiar dacă este exclus din mediană.

### Etapa 4 — Starea actuală și grila de stare

NECESAR în etapă:

- Implementează clasificarea provizorie fluent/consolidare/în lucru/netestat.

- Adaugă nivelul de suficiență separat.

- Construiește grila pentru o singură tablă.

Teste automate de trecere:

- Fiecare fact aparține exact unei stări.

- Foliile disjuncte reunite acoperă toate celulele.

- Un fact rapid cu precizie mică nu devine fluent.

Verificare manuală de către utilizator:

- Filtrează pe fiecare folie și verifică numărul celulelor.

- Deschide detaliul unei celule și verifică n, precizie, mediană și filtru.

### Etapa 5 — Comparația și direcția per fact

NECESAR în etapă:

- Implementează două ferestre egale și delta timp/precizie.

- Clasifică scenariile dummy: progres, grabă, stabil bun, stabil nefluent, regres probabil, insuficient.

Teste automate de trecere:

- Toate cele șase scenarii primesc eticheta așteptată.

- Viteză ↑ + precizie ↓ nu este progres.

- Regresul nu este emis fără minimul de date configurat.

Verificare manuală de către utilizator:

- Inspectează valorile înainte/după pentru fiecare scenariu.

- Schimbă manual un răspuns și verifică dacă eticheta se schimbă explicabil.

### Etapa 6 — Progres agregat per subtablă/tablă

NECESAR în etapă:

- Calculează delta per fact comparabil și mediana delta-urilor.

- Adaugă ponderarea per fact și per răspuns ca opțiuni explicite.

- Construiește grila direcției.

Teste automate de trecere:

- O schimbare artificială a compoziției nu schimbă progresul comparabil.

- Facts fără date în ambele ferestre sunt excluse și raportate.

- Foliile direcției sunt disjuncte și complete.

Verificare manuală de către utilizator:

- Creează două calupuri cu facts ușoare/dificile amestecate diferit.

- Verifică faptul că performanța brută se schimbă, dar progresul matched-fact rămâne corect.

### Etapa 7 — MABP și constructorul de preseturi

NECESAR în etapă:

- Mută toate alegerile în obiecte de configurație.

- Adaugă validare, normalizare, preset_version și avertismente.

- Interfața cu bife construiește configurația, nu rulează logică proprie.

Teste automate de trecere:

- Două preseturi identice produc rezultate identice.

- O valoare invalidă este respinsă cu mesaj specific.

- Presetul vechi rămâne reproductibil după adăugarea unuia nou.

Verificare manuală de către utilizator:

- Editează numai un array/preset și confirmă schimbarea raportului.

- Revino la presetul standard și confirmă rezultatul inițial.

### Etapa 8 — EFF și selecția granulară

NECESAR în etapă:

- Adaugă catalogul EFF, rolul necunoscutei și matricea membri × eq_forms.

- Implementează cele cinci moduri de selecție agreate.

- Nu parsează intrebare sau eq_form pentru a ghici rolul.

Teste automate de trecere:

- Selecția „rol a” include numai formele catalogate cu unknown_member_role=a.

- Bifa pe linie/coloană selectează exact celulele așteptate.

- Toate formele EFF nu dublează înregistrări.

Verificare manuală de către utilizator:

- Selectează manual trei celule și verifică lista de loguri incluse.

- Compară un raport pe rolul a cu unul pe rolul b.

### Etapa 9 — Incertitudine, netezire și validare statistică

NECESAR în etapă:

- Adaugă Wilson pentru precizie și bootstrap pentru mediană/delta.

- Bootstrap pe sesiuni când există suficiente sesiuni.

- Adaugă mediană mobilă sau EWMA numai pentru vizualizare.

Teste automate de trecere:

- Intervalele se lărgesc la n mic și se îngustează la n mare.

- Rezultatul este determinist când seed-ul de test este fix.

- Linia netezită nu schimbă valorile brute sau clasificarea fără configurație explicită.

Verificare manuală de către utilizator:

- Compară n=5 cu n=50 și observă diferența de incertitudine.

- Verifică un caz în care delta punctuală este 0,2 s, dar intervalul include 0: mesajul trebuie să fie prudent.

### Etapa 10 — Hardening, performanță și utilizare reală

NECESAR în etapă:

- Testează mii/zeci de mii de loguri.

- Adaugă export de configurație și rezultat.

- Verifică accesibilitatea culorilor și folosirea etichetelor/textului.

- Rulează pilot pe date reale fără mesaje automate către copil.

Teste automate de trecere:

- Timpul de calcul este acceptabil.

- Nicio categorie nu depinde exclusiv de culoare.

- Raportul reproduce exact filtrele și versiunile.

- Datele reale nu produc excepții tăcute.

Verificare manuală de către utilizator:

- Compară manual 10 facts cu calcule independente.

- Ține un jurnal al cazurilor surprinzătoare și decide dacă sunt bug, limită sau descoperire reală.

## 15. Testele automate și manuale

### 15.1 Piramida minimă de teste

| Nivel | Ce verifică | Exemple |
| --- | --- | --- |
| unit | Funcții pure și formule. | mediană, bucket, IQR, Wilson, grupare 1/2/3, selecție fact. |
| integration | Fluxuri între module. | loguri → întrebări → filtru → metrici → clasificare. |
| golden/fixture | Rezultat complet stabil. | Preset standard pe JSON dummy produce JSON așteptat. |
| property-based simplu | Invariante. | Bucketurile însumează n; fiecare fact are exact o stare; filtrarea nu mărește n. |
| visual/manual | Sensul și lizibilitatea. | Foliile grilei, detaliul celulei, avertismente, culori accesibile. |

### 15.2 Invariante obligatorii

- Datele brute înainte și după analiză sunt byte-identice sau semantic identice.

- Numărul întrebărilor este numărul înregistrărilor cu apăsarea 1, cu excepția secvențelor invalide raportate.

- Fiecare întrebare are exact o primă apăsare.

- Fiecare fact are exact o stare; fiecare fact are exact o direcție pentru perioada selectată.

- included + excluded = eligible_before_filter pentru fiecare metrică.

- Fiecare observație exclusă are cel puțin un motiv explicit.

- Progresul agregat nu include facts absente din una dintre ferestre.

- Schimbarea configurației nu modifică rezultatele altor preseturi.

### 15.3 Procedura manuală standard

1. Selectează un preset standard și notează preset_id/version.

2. Verifică numărul total, inclus și exclus și motivele excluderii.

3. Alege o celulă și compară primele/ultimele valori direct cu logul brut.

4. Calculează manual mediana pentru un set mic sortat.

5. Verifică precizia: corecte la apăsarea 1 / total întrebări, fără a număra apăsările 2/3 drept întrebări.

6. Comută filtrul și verifică dacă numai metricile eligibile se schimbă.

7. Comută perioada și confirmă fereastra exactă de date.

8. Pentru subtablă, verifică două facts individual și agregarea delta-urilor.

9. Exportă configurația și rerulează; rezultatul trebuie să fie identic.

## 16. Fixture-urile dummy incluse

Pachetul conține trei fișiere auxiliare:

- youlearn_loguri_dummy_v1.json — loguri în schema jurnalului, ordonate ca în IndexedDB;

- youlearn_rezultate_asteptate_dummy_v1.json — clasificări și verificări așteptate;

- youlearn_preseturi_MABP_exemple_v1.json — preseturi de filtrare și analiză.

### 16.1 Scenarii acoperite

| Fact/scenariu | Ce testează | Rezultat așteptat |
| --- | --- | --- |
| 7×8 | viteză mai bună, precizie păstrată; un 0,3 s și un 18 s | progres; 1 anticipativ suspect; 1 pauză probabilă |
| 6×7 | viteză mai bună, precizie mai slabă | compromis viteză–precizie, nu progres |
| 5×5 | rapid și precis în ambele ferestre | stabil la nivel bun |
| 9×9 | lent și precizie modestă, fără schimbare | stabil încă nefluent |
| 4×8 | încetinire și erori mai multe | regres probabil |
| 2×3 | doar câteva observații | date insuficiente |
| 8×9 cu apăsări 1/2/3 | gruparea pe întrebare | 1 întrebare, 3 apăsări, corectată în final |
| EFF 3–7–21 | rolul necunoscutei și selecția eq_forms | selecții distincte a/b/c |

## 17. Criterii finale de acceptare

- Un utilizator poate reproduce orice raport doar din loguri + catalog + configurația versionată.

- Tool-ul poate arăta separat starea și direcția per fact, subtablă și tablă.

- Viteza nu este declarată progres dacă precizia scade material.

- Facts deja fluente sunt „stabile la nivel bun”, nu „stagnante”.

- Datele insuficiente nu sunt colorate ca progres/regres.

- Schimbarea compoziției exercițiilor nu produce progres fals în agregarea matched-fact.

- Filtrele sunt transparente, reversible și nu modifică jurnalul brut.

- Configurațiile noi se creează prin fișiere/array-uri; cod nou este necesar numai pentru primitive analitice cu adevărat noi.

- Toate etapele au teste automate și o procedură manuală executabilă de un nespecialist.

- Mesajul către copil este motivant, dar nu depășește certitudinea datelor.

## 18. Ce mai lipsea înainte de implementare

| Element | De ce contează | Rezolvare în această specificație |
| --- | --- | --- |
| session_id | Fără el, ferestrele pe sesiuni și retenția sunt euristice. | Câmp necesar sau extra temporar. |
| catalog matematic explicit | EFF/subtable/rolul necunoscutei nu trebuie ghicite din text. | Config mapat prin fact_id/eq_form. |
| definiții operaționale | Culorile pot părea precise fără reguli verificabile. | Taxonomii și praguri provizorii configurabile. |
| suficiență + incertitudine | Diferențele mici pe n mic produc grile instabile. | Niveluri de date, Wilson și bootstrap etapizat. |
| separarea eligibilității per metrică | Aceeași excludere nu este corectă pentru precizie și timp. | Filtre separate pentru timp, precizie și distribuție. |
| fixture-uri și rezultate așteptate | Fără ele, nu poți ști dacă fiecare etapă este corectă. | Fișiere JSON dummy incluse. |
| versionarea presetelor | Același nume poate schimba sensul în timp. | preset_version/filter_version obligatorii. |
| pilot înainte de mesaje automate | Pragurile pot fi prost calibrate pe copii/dispozitive. | Etapa 10 include pilot și audit manual. |

## 19. Referințe metodologice

| Sursă | Adresă | Rol în specificație |
| --- | --- | --- |
| NIST/SEMATECH e-Handbook — outlieri și boxplot/IQR | https://www.itl.nist.gov/div898/handbook/eda/section3/boxplot.htm | Definește mediană, quartile și gardurile 1,5×IQR și 3×IQR. |
| NIST — măsuri robuste de scară | https://www.itl.nist.gov/div898/handbook/eda/section3/eda356.htm | IQR și MAD ca estimatori robuști ai dispersiei. |
| NIST — intervale Wilson pentru proporții | https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm | Recomandă metode mai bune decât aproximația normală simplă. |
| NIST — bootstrap pentru mediană | https://www.itl.nist.gov/div898/handbook/eda/section3/bootplot.htm | Exemplifică intervalele bootstrap pentru mediană. |
| NIST — EWMA | https://www.itl.nist.gov/div898/handbook/mpc/section2/mpc2211.htm | Netezire sensibilă la schimbări mici și derivă graduală. |
| Vankov 2023 — hazards of response-time outliers | https://pmc.ncbi.nlm.nih.gov/articles/PMC10484222/ | Arată riscul concluziilor dependente de metoda de tratare a outlierilor. |
| Berger & Kiefer 2021 — comparison of RT outlier exclusions | https://pmc.ncbi.nlm.nih.gov/articles/PMC8238084/ | Compară metode de excludere și subliniază nevoia de reguli transparente. |
| Corbett & Anderson 1995 — Knowledge Tracing | https://act-r.psy.cmu.edu/wordpress/wp-content/uploads/2012/12/893CorbettAnderson1995.pdf | Modelează explicit guess și slip; aici este doar context, nu cerință pentru v1. |

> Nivel de certitudine: Structura arhitecturală și separarea metricilor: ridicat (~95%). Pragurile concrete de fluență, outlier și schimbare minimă: provizorii (~70–85%) până la calibrarea pe date reale YouLearn.
