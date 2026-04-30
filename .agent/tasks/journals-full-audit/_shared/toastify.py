import re, os, sys, subprocess

def transform(path: str) -> bool:
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    if "window.alert(" not in src:
        return False

    # Replace window.alert(...) -> toast.error(...)
    new_src = re.sub(r"\bwindow\.alert\(", "toast.error(", src)

    # Add toast import if missing
    if 'from "sonner"' not in new_src:
        # Insert after the first `import` block — simplest: after the first `"use client";` line or first import line
        lines = new_src.splitlines(keepends=True)
        insert_at = None
        for i, line in enumerate(lines):
            if line.startswith("import "):
                insert_at = i
                break
        if insert_at is None:
            # Fallback: after "use client"; directive
            for i, line in enumerate(lines):
                if line.strip().startswith('"use client"') or line.strip().startswith("'use client'"):
                    insert_at = i + 1
                    break
        if insert_at is None:
            insert_at = 0
        # Find end of contiguous import block from insert_at
        j = insert_at
        while j < len(lines) and (lines[j].startswith("import ") or lines[j].startswith("  ") or lines[j].startswith("}") or lines[j].startswith("} from") or lines[j].strip() == ""):
            j += 1
        lines.insert(j, 'import { toast } from "sonner";\n')
        new_src = "".join(lines)

    if new_src == src:
        return False

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_src)
    return True

if __name__ == "__main__":
    changed = 0
    for p in sys.argv[1:]:
        if transform(p):
            print("updated", p)
            changed += 1
    print(f"total changed {changed}")
