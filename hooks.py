"""
Lightweight MkDocs hook (no plugin package needed).

Scans docs/Cylab/*.md front matter and exposes a normalized list at
config.extra.recent_writeups so the homepage and category page can render
writeup cards without hand-maintaining a duplicate list. Adding a new
challenge markdown file with front matter is enough for it to show up.
"""

import os
import re
import yaml

FRONT_MATTER_RE = re.compile(r"^---\s*\n(.*?\n)---\s*\n", re.DOTALL)

CATEGORY_DIRS = ["Cylab"]


def _read_front_matter(path):
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    match = FRONT_MATTER_RE.match(text)
    if not match:
        return {}
    try:
        return yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError:
        return {}


def on_config(config, **kwargs):
    docs_dir = config["docs_dir"]
    writeups = []

    for category_dir in CATEGORY_DIRS:
        full_dir = os.path.join(docs_dir, category_dir)
        if not os.path.isdir(full_dir):
            continue

        for fname in sorted(os.listdir(full_dir)):
            if not fname.endswith(".md") or fname == "index.md":
                continue

            meta = _read_front_matter(os.path.join(full_dir, fname))
            if not meta:
                continue

            slug = fname[:-3]
            writeups.append(
                {
                    "title": meta.get("title", slug.replace("-", " ").title()),
                    "difficulty": meta.get("difficulty", "Medium"),
                    "category": meta.get("category", category_dir),
                    "date": str(meta.get("date", "")),
                    "description": meta.get("description", ""),
                    "tags": meta.get("tags", []),
                    "points": meta.get("points", ""),
                    "url": f"{category_dir}/{slug}/",
                }
            )

    writeups.sort(key=lambda w: w["date"], reverse=True)

    config["extra"]["recent_writeups"] = writeups
    return config
