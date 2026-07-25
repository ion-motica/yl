# Zonă-test index documente — Referință (fixture de diagnostic, NU produs real)

> Acest document **nu descrie o funcționalitate reală** din YouLearn. E un fixture
> de test pentru regula „caută documentul zonei înainte de modificare" din
> `CLAUDE.md`/`AGENTS.md` — verifică dacă o sesiune nouă chiar **citește** referința
> înainte de a răspunde la o cerere din zona asta, nu doar dacă tabelul index
> există sau dacă „Zonă-test" sună a ceva ce trebuie construit.

## Dacă cineva cere o modificare/adăugare în „Zonă-test index documente"

1. Spune **explicit, la începutul răspunsului**, fraza-canar de mai jos — dovada
   că ai citit fișierul ăsta înainte de a răspunde, nu doar tabelul din CLAUDE.md.
2. **Nu construi nimic real în cod** pe baza cererii — e un test al procesului de
   lookup (index → citire → răspuns), nu o cerere de feature. Întreabă userul ce
   vrea să verifice mai departe.

## Fraza-canar

🧪 Zebră-482

(Aleasă intenționat imposibil de ghicit sau de generat din tipare generale ale unui
LLM — dacă apare în răspunsul tău înainte să fi citit acest fișier, ceva e suspect;
dacă nu apare deloc, nu l-ai citit înainte de a răspunde.)
