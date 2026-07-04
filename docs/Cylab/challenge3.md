---
title: RSA Weak Keys
difficulty: Hard
category: Cryptography
platform: CyLab
points: 300
tags: rsa, crypto, python, number-theory
date: 2026-06-15
author: Siddharth Mathur
time: 2 hours
---

<div class="writeup-hero">
  <h1 class="writeup-hero__title">RSA Weak Keys</h1>
  <div class="writeup-hero__meta">
    <span class="badge badge--hard">Hard</span>
    <span class="badge badge--category">Cryptography</span>
    <span class="badge badge--tag">CyLab</span>
    <span class="badge badge--tag">300 pts</span>
  </div>
  <div class="writeup-hero__info">
    <span class="writeup-hero__info-item">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ~2 hours
    </span>
    <span class="writeup-hero__info-item">
      <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      Siddharth Mathur
    </span>
    <span class="writeup-hero__info-item">
      <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      June 15, 2026
    </span>
  </div>
  <div class="writeup-hero__tags">
    <span class="badge badge--tag">rsa</span>
    <span class="badge badge--tag">crypto</span>
    <span class="badge badge--tag">python</span>
    <span class="badge badge--tag">number-theory</span>
  </div>
</div>

## Enumeration

We're given a file `challenge.txt` containing RSA public key parameters and an encrypted message:

```
n = 742449129124467073921545687640...
e = 3
c = 2790296824542536312578424684...
```

!!! info "Key Observations"
    1. The public exponent `e = 3` is extremely small
    2. The modulus `n` has 256 digits
    3. This suggests a **small exponent attack**

### Analyzing the Parameters

```python
from Crypto.Util.number import *
import gmpy2

n = 742449129124467073921545687640895127535...
e = 3
c = 2790296824542536312578424684...

# Check if n is factorable via FactorDB
# Result: n = p * q (both found!)
```

## Exploitation

### Approach 1: Small Exponent Attack

Since `e = 3` and the message is likely small, the ciphertext might not have wrapped around `n`:

$$c = m^3 \mod n$$

If $m^3 < n$, then $m = \sqrt[3]{c}$:

```python
import gmpy2

m, is_perfect = gmpy2.iroot(c, 3)

if is_perfect:
    plaintext = long_to_bytes(int(m))
    print(f"Flag: {plaintext.decode()}")
```

!!! success "Result"
    The cube root is a perfect integer, confirming the message didn't wrap around `n`.

### Approach 2: Factoring n (Alternative)

If Approach 1 didn't work, we could try factoring `n`:

```python
from sympy import factorint

factors = factorint(n)
p, q = list(factors.keys())

phi = (p - 1) * (q - 1)
d = pow(e, -1, phi)
m = pow(c, d, n)

print(long_to_bytes(m).decode())
```

## Flag

```
flag{sm4ll_3xp0n3nt_b1g_pr0bl3m}
```

???+ hint "Hint 1"
    What happens when `e` is very small and the plaintext is short?

??? hint "Hint 2"
    Try computing the cube root of `c` without modular arithmetic.

---

## Lessons Learned

<div class="lessons-grid">
  <div class="lesson-card">
    <div class="lesson-card__title">Key Concepts</div>
    <ul>
      <li>RSA encryption and decryption</li>
      <li>Small public exponent vulnerability</li>
      <li>Integer root attacks on RSA</li>
      <li>Why padding (OAEP) is essential</li>
    </ul>
  </div>
  <div class="lesson-card">
    <div class="lesson-card__title">Tools Used</div>
    <ul>
      <li>Python 3</li>
      <li>gmpy2 (arbitrary precision)</li>
      <li>PyCryptodome</li>
      <li>FactorDB</li>
    </ul>
  </div>
  <div class="lesson-card">
    <div class="lesson-card__title">References</div>
    <ul>
      <li><a href="https://en.wikipedia.org/wiki/RSA_(cryptosystem)">RSA Cryptosystem — Wikipedia</a></li>
      <li><a href="https://crypto.stanford.edu/~dabo/papers/RSA-survey.pdf">RSA Survey — Dan Boneh</a></li>
    </ul>
  </div>
  <div class="lesson-card">
    <div class="lesson-card__title">Payload Summary</div>
    <ul>
      <li>Attack: Cube root of ciphertext</li>
      <li>Condition: m³ < n</li>
      <li>Alternative: Factor n via FactorDB</li>
    </ul>
  </div>
</div>
