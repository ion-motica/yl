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

  /** Distractori primi care nu divid n; preferă p <= floor(n/2) când n > 1. */
  function pickWrongPrimes(n, correctPrime, count, shuffleFn) {
    const shuffle = shuffleFn || ((a) => a);
    const half = n > 1 ? Math.floor(n / 2) : Infinity;
    const all = PRIMES.filter((p) => p !== correctPrime && n % p !== 0);
    const prefer = n > 1 ? all.filter((p) => p <= half) : all;
    const source = prefer.length >= count ? prefer : all;
    const picked = [];
    for (const p of shuffle(source)) {
      if (picked.length >= count) break;
      if (!picked.includes(p)) picked.push(p);
    }
    let guard = 0;
    while (picked.length < count && guard++ < 200) {
      const pool = source.length ? source : all;
      const p = pool[Math.floor(Math.random() * pool.length)];
      if (p !== correctPrime && n % p !== 0 && !picked.includes(p)) picked.push(p);
    }
    return picked.slice(0, count);
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

  global.QuizMath = {
    PRIMES,
    isPrime,
    primeFactors,
    pickWrongPrimes,
    randomComposite,
  };
})(window);
