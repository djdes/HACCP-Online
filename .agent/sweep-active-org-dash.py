"""Same as sweep-active-org.py but for dashboard pages."""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DASH_DIR = os.path.join(ROOT, "src", "app", "(dashboard)")

PATTERN = "session.user.organizationId"
REPLACE = "getActiveOrgId(session)"
IMPORT_LINE = 'import { getActiveOrgId } from "@/lib/auth-helpers";'


def patch_file(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if PATTERN not in content:
        return False
    if "getActiveOrgId" in content:
        new_content = content.replace(PATTERN, REPLACE)
    else:
        lines = content.split("\n")
        insert_idx = None
        for i, line in enumerate(lines):
            if 'from "@/lib/auth-helpers"' in line and line.lstrip().startswith("import"):
                # Already imports auth-helpers — patch the import.
                # Capture "import { X, Y } from ..." and add getActiveOrgId.
                import re
                m = re.match(r'^(\s*import\s*\{)\s*([^}]+?)\s*\}(\s*from\s*"@/lib/auth-helpers".*)$', line)
                if m:
                    parts = [p.strip() for p in m.group(2).split(",") if p.strip()]
                    if "getActiveOrgId" not in parts:
                        parts.append("getActiveOrgId")
                    lines[i] = f"{m.group(1)} {', '.join(parts)} }}{m.group(3)}"
                    insert_idx = -1  # signal: done
                    break
        if insert_idx != -1:
            for i, line in enumerate(lines):
                if 'from "@/lib/auth"' in line and line.lstrip().startswith("import"):
                    insert_idx = i + 1
                    break
            if insert_idx is None:
                for i, line in enumerate(lines):
                    if line.lstrip().startswith("import "):
                        insert_idx = i + 1
                        break
            if insert_idx is None or insert_idx == -1:
                pass
            else:
                lines.insert(insert_idx, IMPORT_LINE)
        new_content = "\n".join(lines)
        new_content = new_content.replace(PATTERN, REPLACE)
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(new_content)
    return True


count = 0
for dirpath, _, files in os.walk(DASH_DIR):
    for fname in files:
        if not (fname.endswith(".ts") or fname.endswith(".tsx")):
            continue
        path = os.path.join(dirpath, fname)
        if patch_file(path):
            count += 1
            print(f"  PATCHED {os.path.relpath(path, ROOT)}")

print(f"Done. Patched {count} files.")
