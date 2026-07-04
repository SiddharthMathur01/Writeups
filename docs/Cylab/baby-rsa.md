---
title: Baby RSA
template: writeup.html
difficulty: Easy
category: Cylab
tags: [Cryptography, RSA, Number Theory]
points: 150
solve_time: 45 min
author: Siddharth Mathur
date: 2026-03-14
description: Recovering plaintext from a custom RSA-like scheme whose key-generation function leaks parity information.
---

## Challenge Overview

The challenge provides a small Python service implementing a custom
RSA-like encryption scheme. Instead of the usual public exponent, the
service derives its key material through a **parity-based key function** —
a modification that looks harmless but quietly leaks one bit of
information per query.

!!! info "Provided files"
    The challenge ships three files:

<div class="ctf-filetree">baby_rsa/
├── server.py
├── output.txt
└── README.md
</div>

## Recon

Connecting to the service and requesting the source confirms a standard
modulus generation routine, but the encryption oracle returns the parity
of the plaintext alongside the ciphertext:

```python
def encrypt(m, e, n):
    c = pow(m, e, n)
    parity = m & 1
    return c, parity
```

That single extra bit is the entire vulnerability. It turns the scheme
into a textbook **LSB oracle** — a well-known weakness against RSA when an
attacker can query encryption or decryption of chosen values and observe
only the least significant bit of the result.

!!! warning "Why this matters"
    Because RSA is a multiplicative homomorphism, doubling the plaintext
    modulo `n` and observing whether the result wraps around `n` leaks one
    bit of the original message on every query. Enough queries and the
    entire message can be reconstructed through binary search.

## Exploitation Strategy

1. Request encryption of the unknown flag, `c = m^e mod n`.
2. Multiply the ciphertext by `2^e mod n`, which is equivalent to
   encrypting `2m mod n`.
3. Query the oracle for the new ciphertext's parity bit.
4. Use the parity bit to narrow a binary search interval `[0, n)` toward
   the true value of `m`.
5. Repeat for `log2(n)` iterations.

```python title="solve.py"
from pwn import remote

io = remote("chal.cylab", 31337)
n, e, c = get_params(io)

lo, hi = 0, n
for _ in range(n.bit_length()):
    c = (c * pow(2, e, n)) % n
    bit = query_parity(io, c)
    mid = (lo + hi) // 2
    if bit == 0:
        hi = mid
    else:
        lo = mid

flag = long_to_bytes(hi)
print(flag)
```

??? note "Why binary search converges here"
    Each doubling step maps `m` to `2m mod n`. If `2m < n`, the parity
    of the *new* plaintext directly reflects which half of the interval
    `m` was in. If `2m >= n`, the wraparound flips the relationship in a
    predictable way, which is why the interval update branches on the
    observed bit rather than on `m` itself.

<details class="ctf-spoiler">
  <summary>Hint 1 — stuck on the oracle model</summary>
  <div class="ctf-spoiler__body">
    Think about what multiplying a ciphertext by <code>2^e mod n</code>
    does to the underlying plaintext, without ever decrypting anything
    yourself.
  </div>
</details>

<details class="ctf-spoiler">
  <summary>Hint 2 — stuck on convergence</summary>
  <div class="ctf-spoiler__body">
    The number of queries you need is bounded by the bit-length of the
    modulus — this is exactly a binary search over <code>[0, n)</code>.
  </div>
</details>

## Running the Solve Script

```console
$ python3 solve.py
[+] Opening connection to chal.cylab on port 31337: Done
[+] Recovered modulus: 2048-bit
[+] Querying LSB oracle ................................ done
[+] Reconstructed plaintext
CyLab{parity_bits_are_never_free}
```

## Results

| Step | Queries used | Notes |
|---|---|---|
| Modulus recovery | 1 | Provided directly by the service |
| Binary search | 2048 | One query per bit of the modulus |
| Total runtime | ~40s | Network-bound, not compute-bound |

> An oracle that answers a single bit is still an oracle. RSA's
> multiplicative structure means a single leaked bit, queried enough
> times, is equivalent to full decryption.

## Flag

```
CyLab{parity_bits_are_never_free}
```

## Takeaways

- Never expose partial information about a plaintext, even something
  that looks as innocuous as parity.
- LSB/parity oracles are a classical, well-documented RSA attack —
  recognizing the pattern quickly is more valuable than deriving it from
  scratch under time pressure.
- Malleability is a property of the *scheme*, not the *implementation* —
  padding schemes like OAEP exist specifically to prevent this class of
  attack.
