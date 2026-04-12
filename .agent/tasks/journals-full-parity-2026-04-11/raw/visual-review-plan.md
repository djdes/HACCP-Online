# Visual Review Plan

## Available sources
- Local screenshot/reference folders: `journals/` (35 folders)
- Live crawl folders: `tmp-source-journals/full-crawl/` (35 journal crawl dirs + 2 non-journal dirs)
- Mapping sources: `inventory.md`, `raw/implementation-matrix.json`, `raw/visual-matrix.json`

## Practical review schema
Use one row per active journal with these fields:
- `code`
- `localFolder`
- `liveCrawlDir`
- `listScreenshotPresent`
- `archiveScreenshotPresent`
- `visualChecked`
- `visualStatus` (`match`, `improved`, `blocked-by-proof`)
- `notes`
- `proofRefs`

## Current blocker
The repository contains source materials and mappings, but the reviewed row-by-row visual verdicts have not yet been written into a completed matrix. This is a proof gap, not a mapping gap.
