(function (global) {
  "use strict";

  function isPrime(n) {
    if (n < 2) return false;
    if (n === 2) return true;
    if (n % 2 === 0) return false;
    for (let i = 3; i * i <= n; i += 2) {
      if (n % i === 0) return false;
    }
    return true;
  }

  const PRIMES = [];
  for (let n = 2; n < 100; n++) {
    if (isPrime(n)) PRIMES.push(n);
  }

  const ONE_DIGIT_PRIMES = [2, 3, 5, 7];
  const SMALL_N_MAX = 10;

  function pickWrongForSmallN(n, correctPrime, count, shuffleFn, exclude) {
    const shuffle = shuffleFn || ((a) => [...a]);
    const banned = new Set([correctPrime, ...exclude]);
    const pool = ONE_DIGIT_PRIMES.filter((p) => !banned.has(p) && n % p !== 0);
    const preferLarger = [...pool].sort((a, b) => b - a);
    const picked = [];
    for (const p of shuffle(preferLarger)) {
      if (picked.length >= count) break;
      if (!picked.includes(p)) picked.push(p);
    }
    return picked.slice(0, count);
  }

  function primeFactors(n) {
    let x = n;
    const factors = [];
    for (const p of PRIMES) {
      while (x % p === 0) {
        factors.push(p);
        x = Math.floor(x / p);
      }
      if (x === 1) break;
    }
    return factors;
  }

  /**
   * Variante greșite unice: primi care nu divid n (< n, preferat <= n/2);
   * dacă nu ajung, numere neprime < n care nu divid n.
   */
  function pickWrongOptions(n, correctPrime, count, shuffleFn, exclude = []) {
    if (n <= SMALL_N_MAX) {
      return pickWrongForSmallN(n, correctPrime, count, shuffleFn, exclude);
    }

    const shuffle = shuffleFn || ((a) => a);
    const half = n > 1 ? Math.floor(n / 2) : 0;
    const banned = new Set([correctPrime, ...exclude]);
    const picked = [];

    function tryAdd(v) {
      if (picked.length >= count) return;
      if (v == null || banned.has(v) || picked.includes(v)) return;
      if (n % v === 0) return;
      if (v >= n) return;
      picked.push(v);
      banned.add(v);
    }

    const primeTiers = [
      () => PRIMES.filter((p) => !banned.has(p) && n % p !== 0 && p < n && p <= half),
      () => PRIMES.filter((p) => !banned.has(p) && n % p !== 0 && p < n),
    ];

    for (const buildPool of primeTiers) {
      if (picked.length >= count) break;
      for (const p of shuffle(buildPool())) tryAdd(p);
    }

    if (picked.length < count) {
      const composites = [];
      for (let c = 2; c < n; c++) {
        if (!isPrime(c)) composites.push(c);
      }
      for (const c of shuffle(composites)) tryAdd(c);
    }

    if (picked.length < count) {
      for (let c = n - 1; c >= 2; c--) {
        tryAdd(c);
        if (picked.length >= count) break;
      }
    }

    if (picked.length < count) {
      const fallback = [];
      for (let c = 2; c < 100; c++) {
        if (!banned.has(c) && !picked.includes(c) && n % c !== 0) fallback.push(c);
      }
      for (const c of shuffle(fallback)) {
        if (picked.length >= count) break;
        picked.push(c);
        banned.add(c);
      }
    }

    return picked.slice(0, count);
  }

  /** Garantează exact `count` variante greșite numerice, fără duplicate. */
  function ensureWrongOptions(n, correctPrime, count, shuffleFn, exclude = []) {
    const shuffle = shuffleFn || ((a) => [...a]);
    let wrong = pickWrongOptions(n, correctPrime, count, shuffle, exclude);
    const used = new Set([correctPrime, ...exclude, ...wrong]);

    if (n <= SMALL_N_MAX) {
      for (const p of [7, 5, 3, 2]) {
        if (wrong.length >= count) break;
        if (!used.has(p) && n % p !== 0) {
          wrong.push(p);
          used.add(p);
        }
      }
      return wrong.slice(0, count);
    }

    for (let c = 2; c < 100 && wrong.length < count; c++) {
      if (!used.has(c) && n % c !== 0) {
        wrong.push(c);
        used.add(c);
      }
    }

    return wrong.slice(0, count);
  }

  function pickWrongPrimes(n, correctPrime, count, shuffleFn, exclude) {
    return ensureWrongOptions(n, correctPrime, count, shuffleFn, exclude);
  }

  function randomComposite(min, max, exclude, isPrimeFn) {
    const isP = isPrimeFn || isPrime;
    for (let t = 0; t < 300; t++) {
      const n = Math.floor(Math.random() * (max - min + 1)) + min;
      if (n > 1 && !isP(n) && n !== exclude) return n;
    }
    for (let n = min; n <= max; n++) {
      if (n > 1 && !isP(n) && n !== exclude) return n;
    }
    return Math.max(4, min);
  }

  /** Compus în [min,max], cel puțin `floor`, diferit de `exclude`. */
  function randomCompositeAtLeast(floor, min, max, exclude, isPrimeFn) {
    const low = Math.max(min, floor);
    const isP = isPrimeFn || isPrime;
    for (let t = 0; t < 400; t++) {
      const n = Math.floor(Math.random() * (max - low + 1)) + low;
      if (n > 1 && !isP(n) && n !== exclude) return n;
    }
    for (let n = low; n <= max; n++) {
      if (n > 1 && !isP(n) && n !== exclude) return n;
    }
    return randomComposite(min, max, exclude, isP);
  }

  global.QuizMath = {
    PRIMES,
    isPrime,
    primeFactors,
    pickWrongOptions,
    ensureWrongOptions,
    pickWrongPrimes,
    randomComposite,
    randomCompositeAtLeast,
  };
})(window);
