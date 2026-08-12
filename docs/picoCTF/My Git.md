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
    The challenge provides one file:

<div class="ctf-filetree">challenge/
└── README.md
</div>

## Recon

```text title="README.md"
# MyGit

### If you want the flag, make sure to push the flag!

Only flag.txt pushed by ```root:root@picoctf``` will be updated with the flag.

GOOD LUCK!
```

We need to change the username to root and email to root@picoctf and push a file named flag.txt to get the flag

## Exploitation Strategy

1. Change the Username to root
2. Change the email to root@picoctf
3. create a empty .txt file with name flag.txt
4. commit and puch it to the main branch

## Running the Commands
```console title="terminal"
$ cd challenge/

$ git config user.name "root"

$ git config user.email "root@picoctf"

$ touch flag.txt

$ git add flag.txt

$ git commit -m "Add flag.txt"
[master 01a3141] Add flag.txt
 1 file changed, 0 insertions(+), 0 deletions(-)
 create mode 100644 flag.txt

$ git push origin master
** WARNING: connection is not using a post-quantum key exchange algorithm.
** This session may be vulnerable to "store now, decrypt later" attacks.
** The server may need to be upgraded. See https://openssh.com/pq.html
git@foggy-cliff.picoctf.net's password:
Enumerating objects: 4, done.
Counting objects: 100% (4/4), done.
Delta compression using up to 22 threads
Compressing objects: 100% (2/2), done.
Writing objects: 100% (3/3), 266 bytes | 13.00 KiB/s, done.
Total 3 (delta 0), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Author matched and flag.txt found in commit...
remote: Congratulations! You have successfully impersonated the root user
remote: Here's your flag: picoCTF{***********_***_****_********}
To ssh://foggy-cliff.picoctf.net:61479/git/challenge.git
   4142dd3..01a3141  master -> master
```

## Takeaways

- Learned about Git commands
