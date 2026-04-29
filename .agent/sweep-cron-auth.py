"""
Заменяет timing-attack-уязвимый CRON_SECRET check во всех
/api/cron/*/route.ts на checkCronSecret() helper.

Используем ОЧЕНЬ specific regex — матчим только полный паттерн
с known shape ответа. Если код отличается — оставляем как есть.
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRON_DIR = os.path.join(ROOT, "src", "app", "api", "cron")

# Каждый паттерн матчит ТОЛЬКО полный if-block c return NextResponse.
# Не используем `[^}]*` — это ломалось на вложенных `}`.
PATTERNS = [
    # Variant A: searchParams.get("secret") !== process.env.CRON_SECRET
    re.compile(
        r'if\s*\(\s*searchParams\.get\("secret"\)\s*!==\s*process\.env\.CRON_SECRET\s*\)\s*\{\s*return\s+NextResponse\.json\(\s*\{\s*error:\s*"Unauthorized"\s*\}\s*,\s*\{\s*status:\s*401\s*\}\s*\)\s*;\s*\}',
        re.DOTALL,
    ),
    # Variant B: url.searchParams
    re.compile(
        r'if\s*\(\s*url\.searchParams\.get\("secret"\)\s*!==\s*process\.env\.CRON_SECRET\s*\)\s*\{\s*return\s+NextResponse\.json\(\s*\{\s*error:\s*"Unauthorized"\s*\}\s*,\s*\{\s*status:\s*401\s*\}\s*\)\s*;\s*\}',
        re.DOTALL,
    ),
    # Variant C: secret !== process.env.CRON_SECRET (local var)
    re.compile(
        r'if\s*\(\s*secret\s*!==\s*process\.env\.CRON_SECRET\s*\)\s*\{\s*return\s+NextResponse\.json\(\s*\{\s*error:\s*"Unauthorized"\s*\}\s*,\s*\{\s*status:\s*401\s*\}\s*\)\s*;\s*\}',
        re.DOTALL,
    ),
    # Variant D: !CRON_SECRET || searchParams.get("secret") !== CRON_SECRET
    re.compile(
        r'if\s*\(\s*!\s*CRON_SECRET\s*\|\|\s*searchParams\.get\("secret"\)\s*!==\s*CRON_SECRET\s*\)\s*\{\s*return\s+NextResponse\.json\(\s*\{\s*error:\s*"Unauthorized"\s*\}\s*,\s*\{\s*status:\s*401\s*\}\s*\)\s*;\s*\}',
        re.DOTALL,
    ),
]

REPLACEMENT = (
    "{\n    const cronAuth = checkCronSecret(request);\n"
    "    if (cronAuth) return cronAuth;\n"
    "  }"
)


def patch_file(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if "checkCronSecret" in content:
        return False
    new_content = content
    matched = False
    for pat in PATTERNS:
        if pat.search(new_content):
            new_content = pat.sub(REPLACEMENT, new_content)
            matched = True
    if not matched:
        return False
    if "@/lib/cron-auth" not in new_content:
        m = re.search(r'^import .*from\s+"@/lib/.+";', new_content, re.MULTILINE)
        if m:
            new_content = (
                new_content[: m.end()]
                + '\nimport { checkCronSecret } from "@/lib/cron-auth";'
                + new_content[m.end() :]
            )
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(new_content)
    return True


count = 0
skipped = []
for fn in sorted(os.listdir(CRON_DIR)):
    full = os.path.join(CRON_DIR, fn, "route.ts")
    if not os.path.isfile(full):
        continue
    if patch_file(full):
        count += 1
        print(f"  PATCHED {os.path.relpath(full, ROOT)}")
    elif "CRON_SECRET" in open(full, encoding="utf-8").read() and "checkCronSecret" not in open(full, encoding="utf-8").read():
        skipped.append(os.path.relpath(full, ROOT))
print(f"Done. Patched {count} files.")
if skipped:
    print(f"\nSkipped (pattern не подошёл, проверь вручную):")
    for s in skipped:
        print(f"  {s}")
