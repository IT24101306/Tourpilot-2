import sharp from "sharp";
import { readdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "apps/web/public/images/ceylon-trails");
const MAX_WIDTH = 1920;
const MIN_BYTES_TO_COMPRESS = 500_000;

const files = (await readdir(dir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));

for (const file of files) {
  const filePath = path.join(dir, file);
  const { size } = await stat(filePath);
  if (size < MIN_BYTES_TO_COMPRESS) {
    console.log(`skip ${file} (${Math.round(size / 1024)} KB)`);
    continue;
  }

  const tmp = `${filePath}.tmp`;
  await sharp(filePath)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, quality: 80 })
    .toFile(tmp);

  const { size: newSize } = await stat(tmp);
  await rename(tmp, filePath);
  console.log(`${file}: ${Math.round(size / 1024 / 1024)} MB -> ${Math.round(newSize / 1024)} KB`);
}
