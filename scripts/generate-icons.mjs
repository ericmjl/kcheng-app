import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const sizes = [192, 512];
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#c5e5d4" rx="64"/>
  <text x="256" y="280" font-family="system-ui,sans-serif" font-size="200" font-weight="bold" fill="#4a4541" text-anchor="middle">中</text>
</svg>
`;

for (const size of sizes) {
  const buf = await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toBuffer();
  writeFileSync(join(publicDir, `icon-${size}x${size}.png`), buf);
  console.log(`Wrote icon-${size}x${size}.png`);
}
