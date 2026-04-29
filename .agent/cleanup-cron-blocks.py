"""
Cleanup ugly `{ const cronAuth ... if (cronAuth) return cronAuth; }`
блоков в cron-routes — лифтим check на верхний уровень handler'а.
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRON_DIR = os.path.join(ROOT, "src", "app", "api", "cron")

# Матчим аккуратный блок:
#   <ws>{
#   <ws>  const cronAuth = checkCronSecret(request);
#   <ws>  if (cronAuth) return cronAuth;
#   <ws>}
PAT = re.compile(
    r'^([ \t]*)\{\s*\n'
    r'[ \t]*const\s+cronAuth\s*=\s*checkCronSecret\(request\);\s*\n'
    r'[ \t]*if\s*\(cronAuth\)\s*return\s+cronAuth;\s*\n'
    r'[ \t]*\}\s*\n',
    re.MULTILINE,
)


def patch_file(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    def replace(m):
        indent = m.group(1)
        return (
            f"{indent}const cronAuth = checkCronSecret(request);\n"
            f"{indent}if (cronAuth) return cronAuth;\n"
        )

    new = PAT.sub(replace, content)
    if new == content:
        return False
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(new)
    return True


count = 0
for fn in sorted(os.listdir(CRON_DIR)):
    full = os.path.join(CRON_DIR, fn, "route.ts")
    if not os.path.isfile(full):
        continue
    if patch_file(full):
        count += 1
        print(f"  PATCHED {os.path.relpath(full, ROOT)}")
print(f"Done. Patched {count} files.")
