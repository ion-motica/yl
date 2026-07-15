# Resurse comune YouLearn

## Deschiderea locală în Codex browser

- Citește mai întâi `Codex docs/Deschidere Codex browser - referinta pt Codex.md`; nu relua încercările vechi deja documentate.
- Folosește direct `http://localhost:8770/index.html` și evită portul `8766`, care a rămas uneori ocupat de un server vechi.
- Verifică mai întâi URL-ul cu `Invoke-WebRequest`. Dacă răspunde cu `StatusCode 200`, nu porni încă un server.
- Dacă portul `8770` nu răspunde, obține executabilul Python din `load_workspace_dependencies`, apoi rulează persistent, din rădăcina proiectului: `python.exe -m http.server 8770 --bind 127.0.0.1`.
- Nu folosi `Start-Process` pentru serverul pornit de Codex: procesul copil se poate închide când comanda părinte se termină.
- După pornire, verifică obligatoriu `StatusCode 200`, apoi deschide în browser URL-ul cu `localhost`, nu cu `127.0.0.1`.

## Programare simplă și modulară în YouLearn

Design simplu, modular, necomplicat, ca o gramatică generativă. Modularitate prin API/metodă cu argumente explicite.

Când adăugăm funcționalități noi în YouLearn, folosim preferabil un contract/API comun cu inversion of control. Codul existent trebuie să apeleze feature-ul nou și să-i furnizeze explicit parametrii necesari. Feature-ul nou nu trebuie să ghicească sau să extragă context din interiorul quizurilor. Contextul aparține quizului; feature-ul primește datele printr-un contract/API explicit, le validează/normalizează și procesează. Aplicăm asta pentru loguri/analytics, event contract / event reporting.

**Regulă practică: quizul raportează, feature-ul procesează.**

1. Caută mai întâi soluția cea mai simplă care rezolvă cerința actuală. Nu construi infrastructură pentru nevoi viitoare neconfirmate.

2. Preferă funcții simple, obiecte cu date și parametri expliciți. Evită clase, moștenire, fabrici, registre și straturi suplimentare dacă nu există o nevoie concretă.

3. Folosește un API comun:
   - codul existent apelează feature-ul nou;
   - quizul furnizează explicit datele necesare;
   - feature-ul validează, normalizează și procesează datele;
   - feature-ul nu caută singur context în quiz, DOM sau variabile globale.

4. Preferă aceeași funcție cu argumente diferite, nu funcții separate pentru fiecare quiz.

   Exemplu:

   ```js
   inregistreazaIncercare({
     identificatorQuiz,
     intrebare,
     raspunsDat,
     raspunsCorect,
     corect,
     timp,
   });
   ```

5. Dacă un quiz are alt format, folosește lângă el o funcție mică de transformare către contractul comun. Nu crea un „sistem de adaptoare” dacă o funcție simplă este suficientă.

6. Ce nu este disponibil rămâne `null`. Nu inventa valori și nu construi alte sisteme numai pentru a completa toate câmpurile.

7. Nu generaliza după un singur caz. Extrage cod comun numai după ce apar cel puțin două cazuri reale care chiar au aceeași structură.

8. Fiecare modul are o responsabilitate clară:
   - quizul știe întrebarea și starea lui;
   - feature-ul nou procesează datele primite;
   - stocarea știe să salveze;
   - interfața știe să afișeze.

9. Preferă fluxuri care se citesc de sus în jos:

   ```js
   valideaza();
   normalizeaza();
   proceseaza();
   salveaza();
   ```

   Evită ramificații adânci, callbackuri îngropate și logică răspândită inutil în multe fișiere.

9a. Preferă macar la nivel macro o abordare procedurală:
   - fluxul principal trebuie să fie clar, liniar și ușor de urmărit;
   - complexitatea necesară poate fi ascunsă în interiorul unor funcții bine numite;
   - la nivelul apelurilor trebuie să se vadă clar ordinea pașilor, nu detaliile convolute;
   - nu expune în fluxul principal mecanisme interne complicate;
   - nu sparge artificial codul în prea multe funcții mici dacă asta face fluxul mai fragmentat și mai greu de urmărit.

10. Fă modificarea minimă necesară:
   - nu refactoriza lucruri fără legătură;
   - nu redenumi sau muta cod doar pentru „curățenie”;
   - nu modifica alte quizuri;
   - nu schimba comportamentul existent fără cerere explicită.

11. Testele verifică rezultatul și contractul public, nu structura internă:
   - datele corecte sunt trimise;
   - feature-ul le procesează corect;
   - funcționalitatea existentă nu se strică.

   Nu repeta pentru fiecare integrare testele mari ale infrastructurii centrale; adaugă doar testul minim specific integrării.

12. Folosește denumiri clare, explicite și fără prescurtări greu de urmărit. Preferă denumiri în română în codul nou, dacă proiectul permite.

13. Înainte de implementare, prezintă concis:
   - soluția minimă propusă;
   - fișierele modificate;
   - ce date sunt disponibile;
   - ce rămâne `null`;
   - eventualele riscuri reale.

   Separă clar: NECESAR pentru cerința actuală vs. OPȚIONAL pentru mai târziu.

14. Nu adăuga arhitectură, funcții sau cerințe suplimentare în tăcere. Dacă vezi o posibilă îmbunătățire, propune-o separat și așteaptă aprobarea.

15. Designul dorit seamănă cu o gramatică generativă:
   - puține reguli și funcții comune;
   - multe rezultate produse prin argumente și configurații;
   - fără duplicare și fără mecanisme complicate;
   - dar nu impune asta dacă ar complica lucrurile și se poate mai clar și mai simplu.

Dacă experimentăm un feature structural: propune un quiz evaluat ca fiind potrivit pentru testare; după aprobare, clonează-l și fă modificările pe acea clonă.

## `numaraTICs()`

- Sursa comună: `js/numara-tics.js`.
- Testele contractului: `tests/numara-tics.test.js`.
- API public disponibil în proiect: `numaraTICs(intrare): number`.
- Intrarea este fie un string cu o singură operație, fie obiectul explicit `{ operandStanga, operatie, operandDreapta }`.
- Quizul furnizează explicit operația; funcția nu extrage context din quiz, DOM sau variabile globale.
- Funcția simulează algoritmul scris școlar și numără TICs (Transport, Împrumut, Carry). Nu o înlocui cu o estimare de calcul mental și nu reordona operanzii.
