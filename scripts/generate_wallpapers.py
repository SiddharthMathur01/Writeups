#!/usr/bin/env python3
"""Copy every supported ML4W image into the site and generate a local catalog."""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
WALLPAPER_ROOT = ROOT / "docs/assets/wallpapers/ml4w"
SOURCE = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / ".wallpaper-source-ml4w"
FULL = WALLPAPER_ROOT / "full"
THUMBS = WALLPAPER_ROOT / "thumbs"
SUPPORTED = {".jpg", ".jpeg", ".png", ".webp"}
IMAGE_LIKE = SUPPORTED | {".gif", ".bmp", ".tif", ".tiff", ".avif", ".heic", ".svg"}
EXCLUDED_PARTS = {".git", ".github", ".vscode", "__pycache__"}


def safe_id(relative: Path) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", relative.with_suffix("").as_posix().lower()).strip("-")
    return "ml4w-" + value


def display_name(relative: Path) -> str:
    return re.sub(r"[_-]+", " ", relative.stem).strip().title()


def main() -> int:
    if not SOURCE.is_dir():
        print(f"ERROR: source directory not found: {SOURCE}", file=sys.stderr)
        return 2
    repository_files = sorted(
        path for path in SOURCE.rglob("*")
        if path.is_file()
        and not any(part.lower() in EXCLUDED_PARTS for part in path.relative_to(SOURCE).parts)
        and not path.name.startswith(".")
    )
    candidates = [path for path in repository_files if path.suffix.lower() in SUPPORTED]
    unsupported = [path.relative_to(SOURCE).as_posix() for path in repository_files if path.suffix.lower() in IMAGE_LIKE - SUPPORTED]
    FULL.mkdir(parents=True, exist_ok=True)
    THUMBS.mkdir(parents=True, exist_ok=True)
    entries, failures = [], []
    for source in candidates:
        relative = source.relative_to(SOURCE)
        # Keep subdirectories in the asset output to avoid basename collisions.
        dest = FULL / relative
        thumb_rel = relative.with_suffix(".webp")
        thumb = THUMBS / thumb_rel
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            thumb.parent.mkdir(parents=True, exist_ok=True)
            if source.resolve() != dest.resolve():
                shutil.copy2(source, dest)
            with Image.open(dest) as image:
                image = ImageOps.exif_transpose(image).convert("RGB")
                image.thumbnail((480, 270), Image.Resampling.LANCZOS)
                image.save(thumb, "WEBP", quality=78, method=6)
            entries.append({
                "id": safe_id(relative),
                "name": display_name(relative),
                "category": relative.parent.name.replace("_", " ").title() if relative.parent != Path(".") else "ML4W",
                "full": "full/" + relative.as_posix(),
                "thumbnail": "thumbs/" + thumb_rel.as_posix(),
                "source": "https://github.com/mylinuxforwork/wallpaper/blob/main/" + relative.as_posix(),
            })
        except Exception as error:  # Report corrupt or unsupported image files without hiding the rest.
            failures.append({"file": relative.as_posix(), "error": str(error)})

    catalog = WALLPAPER_ROOT / "catalog.json"
    catalog.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    try:
        commit = subprocess.run(["git", "-C", str(SOURCE), "rev-parse", "HEAD"], check=True, capture_output=True, text=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        commit = None
    report = {
        "source": "https://github.com/mylinuxforwork/wallpaper",
        "source_commit": commit,
        "discovered": len(candidates),
        "downloaded": len(entries),
        "copied_or_available": len(entries),
        "thumbnails_generated": len(entries),
        "unsupported_image_files": unsupported,
        "failed": failures,
    }
    (WALLPAPER_ROOT / "generation-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
