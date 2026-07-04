# Siddharth's CTF Writeups

A premium, minimalist CTF writeup site built on **MkDocs + Material for
MkDocs** — monochrome, editorial, and deliberately not documentation-shaped
on the homepage.

## Quick start

```bash
pip install -r requirements.txt
mkdocs serve
```

Then open `http://127.0.0.1:8000`.

To build a static, deployable copy:

```bash
mkdocs build
```

Output lands in `site/`. Deploy it anywhere that serves static files
(GitHub Pages, Netlify, Vercel, S3, etc.). For GitHub Pages specifically:

```bash
mkdocs gh-deploy
```

## Project structure

```
docs/                       All content (Markdown + assets)
├── index.md                Homepage content (front matter only — the
│                            actual layout comes from overrides/home.html)
├── about.md                Standalone About page
├── Cylab/
│   ├── index.md             Category landing page (uses overrides/category.html)
│   ├── baby-rsa.md           Sample writeup (Cryptography, Easy)
│   ├── shadow-vault.md       Sample writeup (Web, Medium)
│   └── whisper-net.md        Sample writeup (Forensics, Hard)
└── assets/
    ├── css/extra.css        The entire design system (colors, type, layout, animation)
    ├── js/extra.js           Scroll reveals, animated stat counters, button ripple
    ├── js/mermaid-init.js    Theme-aware Mermaid diagram rendering
    ├── images/               Favicon, logo, placeholder avatar (all SVG)
    └── doodles/               (reserved for any additional decorative SVGs)

overrides/                  Custom Jinja templates layered on top of Material
├── home.html                Landing-page layout (hero, stats, about, categories, recent writeups)
├── category.html            Category listing layout (intro + auto-generated card grid)
├── writeup.html              Individual writeup layout (badge/meta hero + markdown content)
└── partials/
    ├── hero.html, stats.html, about.html, featured.html, recent-writeups.html
    ├── doodles.html           The scattered abstract line-art SVGs
    ├── writeup-card.html      Reusable card used on both the homepage and category pages
    └── footer.html             Sitewide minimal footer (overrides Material's default)

hooks.py                    Build-time hook: scans docs/Cylab/*.md front matter
                             and exposes it as config.extra.recent_writeups, so
                             writeup cards are generated automatically — no
                             manual list to maintain.
mkdocs.yml                  Site config, nav, theme palette, plugins, extensions.
```

## Adding a new writeup

1. Create a new Markdown file inside `docs/Cylab/`, e.g. `docs/Cylab/new-challenge.md`.
2. Add front matter:

   ```yaml
   ---
   title: New Challenge
   template: writeup.html
   difficulty: Medium        # Easy | Medium | Hard
   category: Cylab
   tags: [Web, SQLi]
   points: 250
   solve_time: 1 hr
   author: Siddharth Mathur
   date: 2026-06-01
   description: One or two sentences shown on the card.
   ---
   ```

3. Write the writeup body below the front matter (no top-level `#` heading —
   the hero already renders the title).
4. Add the page to the `nav:` block in `mkdocs.yml` under **Cylab CTF** so it
   appears in the sidebar.
5. Rebuild — the new writeup automatically appears in **Recent Writeups** on
   the homepage and in the **CyLab CTF** category grid, no other file edits
   needed.

## Adding a new category (e.g. HackTheBox, PicoCTF)

1. Create `docs/HackTheBox/index.md` with the same front matter pattern as
   `docs/Cylab/index.md` (`template: category.html`).
2. Add writeup files inside `docs/HackTheBox/` following the same front
   matter pattern as above, but with `category: HackTheBox`.
3. In `hooks.py`, add `"HackTheBox"` to the `CATEGORY_DIRS` list.
4. Add a card for it in `overrides/partials/featured.html`.
5. Add the section to `nav:` in `mkdocs.yml`.

Everything else — cards, badges, animations, dark mode — follows
automatically because it's all driven by the same design tokens in
`docs/assets/css/extra.css`.

## Updating the stats section

Edit `extra.stats` in `mkdocs.yml`:

```yaml
extra:
  stats:
    challenges_solved: 17
    writeups: 17
    categories: 1
    platforms: "CyLab"
```

## Design tokens

All colors, spacing, and type live at the top of `docs/assets/css/extra.css`
as CSS custom properties, scoped to `[data-md-color-scheme="ctf-light"]`
and `[data-md-color-scheme="ctf-dark"]`. Change a value once there and it
propagates through cards, badges, buttons, and the footer.

- **Heading font:** Cormorant Garamond (serif)
- **Body font:** Public Sans
- **Code font:** JetBrains Mono
- **Light surface:** `#FFFFFF` on `#FAFAFA`, borders `#EAEAEA`
- **Dark surface:** `#141416` on `#0B0B0C`, borders `#262629`

## Notes

- The **Recent Writeups** and **CyLab CTF** grids are generated at build
  time by `hooks.py` — no plugin package required, just MkDocs' native
  `hooks:` config option (MkDocs ≥ 1.4).
- `avatar` and `about` images are placeholder SVGs — swap
  `docs/assets/images/profile-placeholder.svg` for a real photo (any
  format) and update the `src` in `overrides/partials/about.html`.
- Mermaid diagrams (used once, in the Whisper Net writeup) render via a
  CDN-loaded script — swap for a locally vendored copy if you need to work
  fully offline.
- For real "Last updated" dates in the footer, add the
  `mkdocs-git-revision-date-localized-plugin` and wire it into
  `overrides/partials/footer.html`.
