(function (global) {
  "use strict";

  const NUME_BAZA_DATE = "youlearn_jurnal_intrebari";
  const NUME_COLECTIE = "intrebari";
  const A_MIN = 11;
  const A_MAX = 20;
  const B_MIN = 1;
  const B_MAX = 20;

  function toateCelulele() {
    const celule = [];
    for (let a = A_MIN; a <= A_MAX; a += 1) {
      for (let b = B_MIN; b <= B_MAX; b += 1) {
        celule.push({ cell_id: `mul:${a}x${b}` });
      }
    }
    return celule;
  }

  function scorMapDinIntrebari(intrebari, motor, praguri) {
    const v1 = praguri.interpretare_v1;
    const celule = toateCelulele();
    const domeniu = motor.selecteazaDomeniu(intrebari, { celule });
    const scoruri = new Map();
    celule.forEach(({ cell_id }) => {
      const aleCelulei = domeniu.peCelula.get(cell_id) ?? [];
      // `segmenteazaInCalupuri` nu e in API-ul public; pt. "tot_istoricul" calupul
      // e literalmente { curent: ... } (vezi motor-analiza.js).
      const statistici = motor.calculeazaStatistici(
        motor.aplicaFiltre({ curent: aleCelulei, referinta: null }, v1.filtru)
      );
      const { scor } = motor.calculeazaScorFact(statistici, v1);
      scoruri.set(cell_id, scor);
    });
    return scoruri;
  }

  function creazaSursaDinScoruri(scoruri) {
    return {
      scorPtFact(a, b) {
        return scoruri.get(`mul:${a}x${b}`) ?? 0;
      },
    };
  }

  function sursaGoala() {
    return { scorPtFact: () => 0 };
  }

  // Sincron — primeste inregistrari deja incarcate (injectate in teste, sau
  // citite in prealabil in browser). Nu atinge IndexedDB.
  function construiesteDinInregistrari(inregistrari, optiuni = {}) {
    const motor = optiuni.motor ?? global.MotorAnalizaVizualizare3;
    const praguri = optiuni.praguri ?? global.ConfigPraguriVizualizare3;
    if (!motor || !praguri) return sursaGoala();
    const intrebari = motor.grupeazaApasarilePeIntrebari(motor.normalizeaza(inregistrari ?? []));
    const scoruri = scorMapDinIntrebari(intrebari, motor, praguri);
    return creazaSursaDinScoruri(scoruri);
  }

  // Cititor standalone de IndexedDB. NU se refoloseste cel din
  // vizualizare3-bootstrap.js: acela e definit doar in interiorul gardei de
  // pagina `if (!layout) return;`, deci nu exista in afara paginii Vizualizare 3.
  function citesteToateInregistrarile() {
    return new Promise((resolve) => {
      if (!global.indexedDB) {
        resolve([]);
        return;
      }
      let bazaNoua = false;
      const cerere = global.indexedDB.open(NUME_BAZA_DATE);
      cerere.onupgradeneeded = () => {
        bazaNoua = true;
        cerere.transaction?.abort();
      };
      cerere.onerror = () => resolve([]);
      cerere.onsuccess = () => {
        if (bazaNoua) {
          resolve([]);
          return;
        }
        const baza = cerere.result;
        if (!baza.objectStoreNames.contains(NUME_COLECTIE)) {
          resolve([]);
          return;
        }
        const inregistrari = [];
        const tranzactie = baza.transaction(NUME_COLECTIE, "readonly");
        tranzactie.objectStore(NUME_COLECTIE).openCursor(null, "next").onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (!cursor) {
            resolve(inregistrari);
            return;
          }
          inregistrari.push(cursor.value);
          cursor.continue();
        };
        tranzactie.onerror = () => resolve(inregistrari);
      };
    });
  }

  // Async — citeste IndexedDB o data, la pornirea quizului. Pana se rezolva,
  // consumatorul foloseste sursaGoala() (medie = 0 peste tot, decizia ramane
  // pe acoperire). Nu arunca niciodata: la orice eroare, sursa goala.
  async function pregateste(optiuni = {}) {
    try {
      const inregistrari = await citesteToateInregistrarile();
      return construiesteDinInregistrari(inregistrari, optiuni);
    } catch (err) {
      return sursaGoala();
    }
  }

  global.SnapshotFluenta = {
    construiesteDinInregistrari,
    pregateste,
    sursaGoala,
  };
})(typeof window !== "undefined" ? window : globalThis);
