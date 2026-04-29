"""
Удаляет `const { searchParams } = new URL(request.url);` из cron-роутов
ТОЛЬКО если searchParams нигде больше не используется в файле.
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRON_DIR = os.path.join(ROOT, "src", "app", "api", "cron")

PAT = re.compile(
    r'^[ \t]*const\s+\{\s*searchParams\s*\}\s*=\s*new URL\(request\.url\);\s*\n',
    re.MULTILINE,
)


def patch_file(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if not PAT.search(content):
        return False
    # Удаляем декларацию и проверяем, что searchParams больше нигде не упомянут.
    candidate = PAT.sub("", content)
    if "searchParams" in candidate:
        # searchParams используется ниже — не трогаем
        return False
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(candidate)
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
