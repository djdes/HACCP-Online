"""
Cleanup leftover unused `const secret = searchParams.get("secret");`
из cron-routes после sweep'а cron-auth (commit 0cd805c).
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRON_DIR = os.path.join(ROOT, "src", "app", "api", "cron")

# Удаляем строку: const secret = searchParams.get("secret");
PAT_SECRET_VAR = re.compile(
    r'^(\s*)const\s+secret\s*=\s*searchParams\.get\("secret"\);\s*$\n',
    re.MULTILINE,
)

# Удаляем `const { searchParams } = new URL(request.url);` если за
# ним больше нет использований searchParams.
PAT_SEARCHPARAMS = re.compile(
    r'^(\s*)const\s+\{\s*searchParams\s*\}\s*=\s*new URL\(request\.url\);\s*$\n',
    re.MULTILINE,
)


def patch_file(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    new = PAT_SECRET_VAR.sub("", content)
    # Если searchParams больше не используется — удаляем и его декларацию
    if PAT_SECRET_VAR.search(content) and "searchParams" not in PAT_SECRET_VAR.sub("", content).replace(
        "const { searchParams }", ""
    ):
        # Считаем сколько раз searchParams встречается ПОСЛЕ удаления
        # secret-var. Если только в декларации — удаляем декларацию.
        without_secret = PAT_SECRET_VAR.sub("", content)
        # Убираем декларацию из счёта
        rest = PAT_SEARCHPARAMS.sub("", without_secret)
        if "searchParams" not in rest:
            new = PAT_SEARCHPARAMS.sub("", without_secret)
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
