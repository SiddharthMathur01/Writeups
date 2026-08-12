---
title: Bytemancy 1
template: writeup.html
difficulty: Easy
category: picoCTF
tags: [General Skill]
points: 150
solve_time: ~1min
author: Siddharth Mathur
date: 2026-03-14
description: Conjure the right bytes to get the Flag
---

## Challenge Overview
The challenge provides a small python program and nd asks us to connect to a remote service

!!! info "Provided files"
    The challenge provides the source code file(app.py)

```python title="app.py"
while(True):
  try:
    print('⊹──────[ BYTEMANCY-1 ]──────⊹')
    print("☍⟐☉⟊☽☈⟁⧋⟡☍⟐☉⟊☽☈⟁⧋⟡☍⟐☉⟊☽☈⟁⧋⟡☍⟐")
    print()
    print('Send me ASCII DECIMAL 101 1751 times, side-by-side, no space.')
    print()
    print("☍⟐☉⟊☽☈⟁⧋⟡☍⟐☉⟊☽☈⟁⧋⟡☍⟐☉⟊☽☈⟁⧋⟡☍⟐")
    print('⊹─────────────⟡─────────────⊹')
    user_input = input('==> ')
    if user_input == "\x65"*1751:
      print(open("./flag.txt", "r").read())
      break
    else:
      print("That wasn't it. I got: " + str(user_input))
      print()
      print()
      print()
  except Exception as e:
    print(e)
    break
```

## Recon
The challange askes to send char with ascii value 101 1751 times without any space

## Exploitation Strategy
1. Use a simple python scrpit to genrate the ascii char 101 1751 and submit it

## Running the Solve Script

```console title="terminal"

$ python -c 'print(chr(101)*1751)' | nc foggy-cliff.picoctf.net 61346
⊹──────[ BYTEMANCY-1 ]──────⊹
☍⟐☉⟊☽☈⟁⧋⟡☍⟐☉⟊☽☈⟁⧋⟡☍⟐☉⟊☽☈⟁⧋⟡☍⟐

Send me ASCII DECIMAL 101 1751 times, side-by-side, no space.

☍⟐☉⟊☽☈⟁⧋⟡☍⟐☉⟊☽☈⟁⧋⟡☍⟐☉⟊☽☈⟁⧋⟡☍⟐
⊹─────────────⟡─────────────⊹
==> picoCTF{***_****_***_********}
```