const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC = path.resolve(__dirname, "../../users");
const OUT = path.resolve(__dirname, "../../users/_small");
const MAX = 1800;

fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => /\.jpe?g$/i.test(f));

(async () => {
  let i = 0;
  for (const f of files) {
    i++;
    const abs = path.join(SRC, f);
    const img = sharp(abs);
    const meta = await img.metadata();
    const out = path.join(OUT, `users-${String(i).padStart(2, "0")}.jpg`);
    const info = await img
      .resize({
        width: meta.width >= meta.height ? MAX : undefined,
        height: meta.height > meta.width ? MAX : undefined,
        withoutEnlargement: true,
        fit: "inside",
      })
      .jpeg({ quality: 82, mozjpeg: false })
      .toFile(out);
    console.log(
      `${out.replace(/^.*\\_small\\/, "")}  ${meta.width}x${meta.height} -> ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)} KB`
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
