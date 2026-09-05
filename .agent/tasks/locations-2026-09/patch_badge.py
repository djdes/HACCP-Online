# -*- coding: utf-8 -*-
import glob, io, re
IMPORT = 'import { SharedDocumentBadge } from "@/components/journals/shared-document-badge";\n'
pattern = re.compile(r"(?<![\$\w])\{(document|doc|props\.document)\.title(\s*\|\|\s*[A-Za-z_][A-Za-z0-9_]*)?\}")
done, skipped = [], []
for f in sorted(glob.glob("src/components/journals/*documents-client.tsx")):
    s = io.open(f, encoding="utf-8").read()
    if "SharedDocumentBadge" in s:
        done.append(f); continue
    m = pattern.search(s)
    if not m:
        skipped.append(f); continue
    var = m.group(1)
    badge = m.group(0) + "\n" + " " * 14 + "<SharedDocumentBadge shared={" + var + ".shared} />"
    s = s[:m.start()] + badge + s[m.end():]
    # type: add shared flag next to the title field of the list document type
    s = re.sub(r"(\n(\s+)title: string;\n)", lambda mm: mm.group(1) + mm.group(2) + "/** Точки: документ без точки рядом с документами точек. */\n" + mm.group(2) + "shared?: boolean;\n", s, count=1)
    # import after the last import line
    idx = 0
    for im in re.finditer(r"^import [^\n]*\n", s, re.M):
        idx = im.end()
    s = s[:idx] + IMPORT + s[idx:]
    io.open(f, "w", encoding="utf-8", newline="\n").write(s)
    done.append(f)
print("patched:", len(done))
for f in skipped: print("SKIP", f)
