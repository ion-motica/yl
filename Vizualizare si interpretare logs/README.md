# Vizualizare și interpretare logs — contract MABP

Acest folder conține specificația, fixture-urile și catalogul declarativ pentru motorul MABP. Regula de integrare este: quizul raportează date explicite, motorul le validează, normalizează și procesează. Motorul nu caută singur context în quiz, DOM, IndexedDB sau texte matematice.

## Contractul real al jurnalului

Sursa curentă este `js/jurnal-intrebari.js`. `JurnalIntrebari.inregistreazaIntrebare(...)` normalizează exact 18 câmpuri:

| Câmp | Contract actual |
| --- | --- |
| `data_ora_ro` | text obligatoriu |
| `quiz_name` | text obligatoriu |
| `subquiz_name` | text sau `null` |
| `intrebare` | text obligatoriu |
| `raspuns` | text obligatoriu |
| `a_raspuns_corect` | boolean sau `null` |
| `a_cata_apasare_pe_buton` | întreg pozitiv |
| `durata_raspuns_secunde` | număr finit, minimum 0, rotunjit la o zecimală |
| `fact` | text obligatoriu |
| `quiz_id` | text obligatoriu |
| `subquiz_id` | text sau `null` |
| `fact_id` | text obligatoriu |
| `eq_form` | text obligatoriu |
| `pozitie_buton_apasat_pt_raspuns` | `1`, `2`, `3` sau `null` |
| `valori_variante_de_raspuns` | listă de texte/`null` sau `null` |
| `valoare_raspuns_corect` | text sau `null` |
| `hints_aratate_pt_raspuns` | obiect sau `null` |
| `extra` | obiect obligatoriu; poate fi gol |

Cheia auto-incrementată din IndexedDB nu face parte din acest contract. Ordinea ei este însă autoritativă pentru gruparea apăsărilor: `1` începe o întrebare, iar `2`, `3` etc. continuă aceeași întrebare până la următorul `1`. Timestampul nu înlocuiește ordinea de salvare.

## Diferențe în fixture-ul dummy

`youlearn_loguri_dummy_v1.json` este un fixture de analiză, nu un export identic al contractului curent:

- `raspuns_corect` este aliasul fixture-ului pentru `a_raspuns_corect`; normalizarea păstrează o singură valoare canonică.
- Fixture-ul nu are top-level `pozitie_buton_apasat_pt_raspuns`, `valori_variante_de_raspuns`, `valoare_raspuns_corect` și `hints_aratate_pt_raspuns`.
- `extra.button_options` conține date echivalente variantelor, iar `extra.selected_button_index` este indexat de la `0`; poziția jurnalului este indexată de la `1`. Conversia trebuie să fie explicită. Dacă adaptorul nu o cere, câmpurile canonice rămân `null`.
- `extra` mai conține date de test pentru analiză: `session_id`, `quiz_version`, `scenario`, `question_index_in_session`, iar pentru EFF: `eff_id`, `eff_member_id`, `unknown_member_role`, `eq_form_id`.

Contractului curent îi lipsesc câmpuri necesare cerințelor MABP complete: `session_id`, `quiz_version`, `question_index_in_session` și un eveniment explicit `event_type`/`timeout`. `button_options` și `selected_button_index` există în jurnal sub alte denumiri, dar nu ca aceleași câmpuri din `extra`. Până la o versiune nouă a contractului, motorul citește numai valorile furnizate; o valoare indisponibilă rămâne `null`, cu avertisment dacă analiza o cere. Nu se deduc sesiuni, roluri EFF sau apartenențe la subtable din text.

## Catalogul declarativ

`youlearn_catalog_MABP_dummy_v1.json` mapează explicit toate cele 13 valori `fact_id` din fixture. Secțiunile `facts`, `subtables` și `effs` sunt date, nu reguli de parsare. De exemplu, membrii subtablei `mul:7:*` și membrii rolurilor `a`, `b`, `c` din `eff:3:7:21` sunt enumerați explicit.

Catalogul are `catalog_scope: "fixture_only"`. Interfața blochează explicit analizele structurale pe un import sau jurnal IndexedDB real cât timp este încărcat acest catalog dummy; altfel ar putea omite în tăcere facts necunoscute catalogului. Analizele reale pe subtable/EFF trebuie să primească un catalog complet, compatibil cu acea sursă.

## API-ul public

```js
const motor = creeazaMotorMABP();

const rezultat = motor.ruleazaAnaliza({
  loguri,
  catalog,
  configuratie,
});
```

Când schema jurnalului se schimbă, aliasurile se declară la construirea motorului, fără modificarea axelor sau a vizualizărilor:

```js
const motor = creeazaMotorMABP({
  mapareCampuri: {
    raspuns_corect: ["rezultat.corect"],
    session_id: ["context.sesiune"],
  },
});
```

Căile personalizate au prioritate, dar aliasurile implicite sunt păstrate, astfel încât logurile vechi și noi pot coexista în timpul migrării. Un nume canonic nou declarat în `mapareCampuri` devine disponibil pe înregistrarea normalizată pentru axe și metrici custom. Câmpurile necunoscute rămân și în `raw`; câmpurile canonice indisponibile rămân `null`. Astfel, o versiune nouă de schemă cere în primul rând o mapare explicită, nu schimbări în logica analizelor.

`loguri`, `catalog` și `configuratie` sunt argumente obligatoriu explicite. Citirea fișierelor sau a IndexedDB aparține codului apelant. Configurația este declarativă și versionată; ea alege primitive implementate, fără callbackuri ori JavaScript arbitrar în JSON.

Fluxul procedural al motorului:

```text
validează intrările
normalizează înregistrările și aliasurile aprobate
grupează apăsările pe întrebări
selectează domeniul, structura și fereastra din catalog
evaluează calitatea și aplică filtrele per metrică
calculează metricile și comparația
interpretează rezultatul
construiește modelul de vizualizare
```

## Extensii

Motorul are patru familii de primitive JS: axe, metrici, interpretări și vizualizări. Pentru o extensie nouă:

1. Se adaugă o singură funcție cu un identificator stabil în familia potrivită.
2. Funcția primește numai datele și parametrii expliciți ai contractului familiei și returnează date; nu citește DOM, quizuri ori globale.
3. Se validează separat și se testează public rezultatul ei.
4. Identificatorul devine selectabil în preset/configurație, cu argumente declarative.

Aceeași primitivă este reutilizată prin configurații diferite. Nu se creează funcții separate pentru fiecare fact, subtablă, EFF, clasificare sau grafic. Vizualizarea consumă modelul rezultat și nu recalculează metrici; interpretarea consumă metricile și nu citește logurile brute.

Regulile declarative de filtrare sunt validate înainte de calcul. Un tip, operator sau interval necunoscut produce o eroare explicită; nu este ignorat și nu generează un raport aparent valid, dar nefiltrat.

## Interfața demonstrativă

Pagina `mabp.html` pornește în modul **Pe scurt**. Acesta afișează concluzia descriptivă, cele trei valori principale și, când analiza produce mai multe grupuri, o grilă de selecție. Modul **Detalii tehnice** păstrează vizualizările declarate în preset și metadatele raportului.

Presetul implicit `stare_generala_demo_v1` acoperă explicit șase facts prezente în fixture. El demonstrează interacțiunea și nu reprezintă încă tabla completă 1–10 × 1–10. Celulele fără observații nu sunt inventate: o grilă completă va necesita un catalog complet și materializarea explicită a grupurilor fără date.

Pentru a citi direct jurnalul browserului în care este deschisă pagina, se poate folosi pornirea explicită `mabp.html?sursa=indexeddb&analiza=stare_generala_observata_v1`. Presetul `stare_generala_observata_v1` analizează toate valorile `fact_id` existente în sursa curentă și nu cere catalog structural. IndexedDB rămâne izolat per browser și origine; aceeași adresă deschisă în Firefox citește jurnalul Firefox, iar în alt browser citește jurnalul acelui browser.
