"""
Sweeps src/app/api/ replacing session.user.organizationId with
getActiveOrgId(session). Adds the import where missing.

Safe because: for non-ROOT users, getActiveOrgId returns
session.user.organizationId. For ROOT impersonation, it correctly
returns the impersonated org. Either way no regression for normal users.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_DIR = os.path.join(ROOT, "src", "app", "api")

PATTERN = "session.user.organizationId"
REPLACE = "getActiveOrgId(session)"

IMPORT_LINE = 'import { getActiveOrgId } from "@/lib/auth-helpers";\n'

# Files to skip: places where session.user.organizationId is intentional.
SKIP = set()


def patch_file(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if PATTERN not in content:
        return False
    if "getActiveOrgId" in content:
        # Already imports it — just replace usages.
        new_content = content.replace(PATTERN, REPLACE)
    else:
        # Need to add import. Find a good spot — after the auth import.
        lines = content.split("\n")
        insert_idx = None
        # Prefer placing right after `import ... from "@/lib/auth"` line.
        for i, line in enumerate(lines):
            if 'from "@/lib/auth"' in line and line.lstrip().startswith("import"):
                insert_idx = i + 1
                break
        if insert_idx is None:
            # Fallback — after first import line.
            for i, line in enumerate(lines):
                if line.lstrip().startswith("import "):
                    insert_idx = i + 1
                    break
        if insert_idx is None:
            print(f"  SKIP: {path} — no place to insert import")
            return False
        lines.insert(insert_idx, IMPORT_LINE.rstrip("\n"))
        new_content = "\n".join(lines)
        new_content = new_content.replace(PATTERN, REPLACE)
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(new_content)
    return True


count = 0
for dirpath, _, files in os.walk(API_DIR):
    for fname in files:
        if not fname.endswith(".ts") and not fname.endswith(".tsx"):
            continue
        path = os.path.join(dirpath, fname)
        if path in SKIP:
            continue
        if patch_file(path):
            count += 1
            print(f"  PATCHED {os.path.relpath(path, ROOT)}")

print(f"Done. Patched {count} files.")
