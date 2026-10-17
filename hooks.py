"""
Lightweight MkDocs hook (no plugin package needed).

Scans docs/ subdirectories for writeup .md files and exposes:
  - config.extra.recent_writeups   — list of writeup dicts for cards
  - config.extra.stats.writeups    — total writeup count (dynamic)
  - config.extra.stats.categories  — unique tag/category count (dynamic)
  - config.extra.stats.platforms   — number of platform directories (dynamic)

challenges_solved is kept static in mkdocs.yml.
"""

import os
import re
import yaml

FRONT_MATTER_RE = re.compile(r"^---\s*\n(.*?\n)---\s*\n", re.DOTALL)

# Directories inside docs/ that are considered "platforms".
# Each subdirectory with at least one writeup .md counts as a platform.
# Add new platform folders here as they're created (e.g. "HackTheBox", "TryHackMe").
PLATFORM_DIRS = ["picoCTF"]


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


def _discover_platforms(docs_dir):
    """Auto-discover platform directories under docs/.

    A directory is considered a platform if it contains at least one .md
    file (excluding index.md) with valid front matter.
    """
    platforms = []
    skip = {"assets", "stylesheets", "javascripts", "images", "css", "js"}

    for entry in sorted(os.listdir(docs_dir)):
        if entry.startswith(".") or entry.startswith("_") or entry in skip:
            continue
        full = os.path.join(docs_dir, entry)
        if not os.path.isdir(full):
            continue
        # Check if any .md writeup exists
        for fname in os.listdir(full):
            if fname.endswith(".md") and fname != "index.md":
                platforms.append(entry)
                break

    return platforms


def on_config(config, **kwargs):
    docs_dir = config["docs_dir"]

    # Discover platforms automatically
    platforms = _discover_platforms(docs_dir)

    writeups = []
    all_tags = set()

    for platform_dir in platforms:
        full_dir = os.path.join(docs_dir, platform_dir)

        for fname in sorted(os.listdir(full_dir)):
            if not fname.endswith(".md") or fname == "index.md":
                continue

            meta = _read_front_matter(os.path.join(full_dir, fname))
            if not meta:
                continue

            slug = fname[:-3]

            # Collect tags for category counting
            tags = meta.get("tags", [])
            if isinstance(tags, list):
                for tag in tags:
                    all_tags.add(str(tag).strip())

            writeups.append(
                {
                    "title": meta.get("title", slug.replace("-", " ").title()),
                    "difficulty": meta.get("difficulty", "Medium"),
                    "category": meta.get("category", platform_dir),
                    "date": str(meta.get("date", "")),
                    "description": meta.get("description", ""),
                    "tags": tags,
                    "points": meta.get("points", ""),
                    "url": f"{platform_dir}/{slug}/",
                }
            )

    writeups.sort(key=lambda w: w["date"], reverse=True)

    # Expose writeups list for cards
    config["extra"]["recent_writeups"] = writeups

    # Update dynamic stats (challenges_solved stays as-is from mkdocs.yml)
    stats = config["extra"].get("stats", {})
    stats["writeups"] = len(writeups)
    stats["categories"] = len(all_tags) if all_tags else 0
    stats["platforms"] = len(platforms)
    config["extra"]["stats"] = stats

    return config
