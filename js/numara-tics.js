(function (global) {
  "use strict";

  function normalizeazaOperatorTICs(operator) {
    if (typeof operator !== "string") {
      throw new TypeError("Operatorul trebuie să fie un string.");
    }

    const operatorNormalizat = operator.trim();

    if (operatorNormalizat === "+") return "+";
    if (operatorNormalizat === "-" || operatorNormalizat === "−") return "-";
    if (["*", "x", "X", "×", "·"].includes(operatorNormalizat)) return "*";
    if (["/", ":", "÷"].includes(operatorNormalizat)) return "/";

    throw new TypeError(`Operator necunoscut: ${operator}`);
  }

  function normalizeazaIntrareTICs(intrare) {
    if (typeof intrare === "string") {
      const potrivire = intrare
        .trim()
        .match(/^(\d+)\s*([+\-*/xX×·:÷−])\s*(\d+)$/u);

      if (!potrivire) {
        throw new TypeError("Stringul nu conține o singură operație aritmetică validă.");
      }

      return {
        operandStanga: Number(potrivire[1]),
        operatie: normalizeazaOperatorTICs(potrivire[2]),
        operandDreapta: Number(potrivire[3]),
      };
    }

    if (intrare === null || typeof intrare !== "object" || Array.isArray(intrare)) {
      throw new TypeError("Intrarea trebuie să fie un string sau un obiect valid.");
    }

    const campuri = Object.keys(intrare);
    const areContractulExact =
      campuri.length === 3 &&
      campuri.includes("operandStanga") &&
      campuri.includes("operatie") &&
      campuri.includes("operandDreapta");

    if (!areContractulExact) {
      throw new TypeError(
        "Obiectul trebuie să conțină exact operandStanga, operatie și operandDreapta."
      );
    }

    return {
      operandStanga: intrare.operandStanga,
      operatie: normalizeazaOperatorTICs(intrare.operatie),
      operandDreapta: intrare.operandDreapta,
    };
  }

  function valideazaOperandTICs(operand, numeOperand) {
    if (typeof operand !== "number" || !Number.isFinite(operand) || !Number.isInteger(operand)) {
      throw new TypeError(`${numeOperand} trebuie să fie un număr întreg finit.`);
    }

    if (operand < 0) {
      throw new RangeError(`${numeOperand} nu poate fi negativ.`);
    }

    if (operand > 1000) {
      throw new RangeError(`${numeOperand} nu poate fi mai mare decât 1000.`);
    }
  }

  function valideazaOperatieTICs({ operandStanga, operatie, operandDreapta }) {
    valideazaOperandTICs(operandStanga, "operandStanga");
    valideazaOperandTICs(operandDreapta, "operandDreapta");

    if (operatie === "+" && operandStanga + operandDreapta > 1000) {
      throw new RangeError("Rezultatul adunării nu poate fi mai mare decât 1000.");
    }

    if (operatie === "-" && operandStanga < operandDreapta) {
      throw new RangeError("Rezultatul scăderii nu poate fi negativ.");
    }

    if (operatie === "*" && operandStanga * operandDreapta > 1000) {
      throw new RangeError("Rezultatul înmulțirii nu poate fi mai mare decât 1000.");
    }

    if (operatie === "/" && operandDreapta === 0) {
      throw new RangeError("Împărțirea la zero nu este permisă.");
    }
  }

  function numaraTICsAdunare(operandStanga, operandDreapta) {
    let termenStanga = operandStanga;
    let termenDreapta = operandDreapta;
    let transport = 0;
    let numarTICs = 0;

    do {
      const cifraStanga = termenStanga % 10;
      const cifraDreapta = termenDreapta % 10;
      const sumaColoana = cifraStanga + cifraDreapta + transport;

      transport = Math.floor(sumaColoana / 10);
      if (transport > 0) numarTICs += 1;

      termenStanga = Math.floor(termenStanga / 10);
      termenDreapta = Math.floor(termenDreapta / 10);
    } while (termenStanga > 0 || termenDreapta > 0);

    return numarTICs;
  }

  function numaraTICsScadere(descazut, scazator) {
    const cifreDescazut = String(descazut).split("").reverse().map(Number);
    const cifreScazator = String(scazator).split("").reverse().map(Number);
    let numarTICs = 0;

    for (let pozitie = 0; pozitie < cifreDescazut.length; pozitie += 1) {
      const cifraScazator = cifreScazator[pozitie] ?? 0;

      if (cifreDescazut[pozitie] < cifraScazator) {
        let pozitieImprumut = pozitie + 1;

        while (cifreDescazut[pozitieImprumut] === 0) {
          cifreDescazut[pozitieImprumut] = 9;
          numarTICs += 1;
          pozitieImprumut += 1;
        }

        cifreDescazut[pozitieImprumut] -= 1;
        cifreDescazut[pozitie] += 10;
        numarTICs += 1;
      }

      cifreDescazut[pozitie] -= cifraScazator;
    }

    return numarTICs;
  }

  function inmultesteCuOCifraSiNumaraTICs(deinmultit, cifraInmultitor) {
    const cifreDeinmultit = String(deinmultit).split("").reverse().map(Number);
    let transport = 0;
    let numarTICs = 0;

    for (const cifraDeinmultit of cifreDeinmultit) {
      const valoareColoana = cifraDeinmultit * cifraInmultitor + transport;
      transport = Math.floor(valoareColoana / 10);

      if (transport > 0) numarTICs += 1;
    }

    return {
      produs: deinmultit * cifraInmultitor,
      numarTICs,
    };
  }

  function numaraTICsAdunareProdusePartiale(produsePartiale) {
    const coloaneRamase = [...produsePartiale];
    let transport = 0;
    let numarTICs = 0;

    while (coloaneRamase.some((produs) => produs > 0)) {
      let sumaColoana = transport;

      for (let index = 0; index < coloaneRamase.length; index += 1) {
        sumaColoana += coloaneRamase[index] % 10;
        coloaneRamase[index] = Math.floor(coloaneRamase[index] / 10);
      }

      transport = Math.floor(sumaColoana / 10);
      if (transport > 0) numarTICs += 1;
    }

    return numarTICs;
  }

  function numaraTICsInmultire(operandStanga, operandDreapta) {
    const cifreMultiplicator = String(operandDreapta).split("").reverse().map(Number);
    const produsePartiale = [];
    let numarTICs = 0;

    for (let pozitie = 0; pozitie < cifreMultiplicator.length; pozitie += 1) {
      const rezultatPartial = inmultesteCuOCifraSiNumaraTICs(
        operandStanga,
        cifreMultiplicator[pozitie]
      );

      produsePartiale.push(rezultatPartial.produs * 10 ** pozitie);
      numarTICs += rezultatPartial.numarTICs;
    }

    if (produsePartiale.length > 1) {
      numarTICs += numaraTICsAdunareProdusePartiale(produsePartiale);
    }

    return numarTICs;
  }

  function numaraTICsImpartire(deimpartit, impartitor) {
    const cifreDeimpartit = String(deimpartit).split("").map(Number);
    let deimpartitPartial = 0;
    let aInceputCatul = false;
    let numarTICs = 0;

    for (const cifraCurenta of cifreDeimpartit) {
      deimpartitPartial = deimpartitPartial * 10 + cifraCurenta;

      if (!aInceputCatul && deimpartitPartial < impartitor) continue;

      aInceputCatul = true;

      const cifraCat = Math.floor(deimpartitPartial / impartitor);
      const rezultatProdus = inmultesteCuOCifraSiNumaraTICs(impartitor, cifraCat);

      numarTICs += rezultatProdus.numarTICs;
      numarTICs += numaraTICsScadere(deimpartitPartial, rezultatProdus.produs);
      deimpartitPartial -= rezultatProdus.produs;
    }

    return numarTICs;
  }

  /**
   * Numără TICs produse de algoritmul scris școlar pentru o singură
   * operație aritmetică între numere naturale.
   *
   * TIC înseamnă Transport, Împrumut, Carry.
   *
   * Un TIC este un transfer sau o regrupare de valoare între două ordine
   * consecutive în timpul calculului scris. Funcția numără evenimentele
   * de transport, nu valoarea transportată. De exemplu, un transport cu
   * valoarea 2 între două coloane reprezintă un singur TIC.
   *
   * Pentru adunare sunt numărate transporturile dintre coloane.
   *
   * Pentru scădere sunt numărate toate transferurile dintre ordine
   * consecutive. Un transfer în cascadă prin zerouri produce câte un TIC
   * pentru fiecare frontieră traversată. De exemplu, 1000 - 1 produce
   * trei TICs.
   *
   * Pentru înmulțire sunt numărate:
   * 1. transporturile din fiecare înmulțire parțială cu o cifră;
   * 2. transporturile din adunarea finală a produselor parțiale.
   *
   * Pentru împărțire sunt numărate, la fiecare cifră a câtului:
   * 1. transporturile din înmulțirea împărțitorului cu cifra câtului;
   * 2. transferurile din scăderea produsului parțial din deîmpărțitul
   *    parțial.
   *
   * Alegerea cifrei câtului, estimarea, corectarea estimării, coborârea
   * unei cifre și scrierea unui zero în cât nu sunt TICs.
   *
   * Algoritmul păstrează ordinea operanzilor. La înmulțire,
   * operandStanga este numărul scris sus, iar operandDreapta este
   * multiplicatorul ale cărui cifre generează produsele parțiale.
   * Din acest motiv, numaraTICs("3*67") poate avea alt rezultat decât
   * numaraTICs("67*3").
   *
   * Intrarea poate fi:
   * - un obiect { operandStanga, operatie, operandDreapta };
   * - un string simplu, de exemplu "17*12" sau "200 : 39".
   *
   * Sunt acceptate numai numere naturale și operații al căror triunghi
   * numeric nu conține valori mai mari decât 1000.
   *
   * @param {string|{
   *   operandStanga: number,
   *   operatie: string,
   *   operandDreapta: number
   * }} intrare
   *
   * @returns {number} Numărul total exact de TICs.
   *
   * @throws {TypeError} Pentru format, operator sau tipuri invalide.
   * @throws {RangeError} Pentru valori în afara domeniului, rezultat
   *                      negativ, împărțire la zero sau rezultat peste 1000.
   */
  function numaraTICs(intrare) {
    const operatieNormalizata = normalizeazaIntrareTICs(intrare);

    valideazaOperatieTICs(operatieNormalizata);

    if (operatieNormalizata.operatie === "+") {
      return numaraTICsAdunare(
        operatieNormalizata.operandStanga,
        operatieNormalizata.operandDreapta
      );
    }

    if (operatieNormalizata.operatie === "-") {
      return numaraTICsScadere(
        operatieNormalizata.operandStanga,
        operatieNormalizata.operandDreapta
      );
    }

    if (operatieNormalizata.operatie === "*") {
      return numaraTICsInmultire(
        operatieNormalizata.operandStanga,
        operatieNormalizata.operandDreapta
      );
    }

    return numaraTICsImpartire(
      operatieNormalizata.operandStanga,
      operatieNormalizata.operandDreapta
    );
  }

  global.numaraTICs = numaraTICs;
})(window);
