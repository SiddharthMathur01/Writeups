---
title: My Git
template: writeup.html
difficulty: Easy
category: picoCTF
tags: [General Skill, GIT]
points: 150
solve_time: ~1min
author: Siddharth Mathur
date: 2026-03-14
description: Use Git commands to get the Flag
---

## Challenge Overview

The challenge provides a git repositry with a README file which consiste of further instructuons

!!! info "Provided files"
    The challenge one file:

<div class="ctf-filetree">challenge/
└── README.md
</div>

## Recon

```yaml title="README.md"
# MyGit

### If you want the flag, make sure to push the flag!

Only flag.txt pushed by ```root:root@picoctf``` will be updated with the flag.

GOOD LUCK!
```

We need to change the username to root and email to root@picoctf and push a file named flag.txt to get the flag


