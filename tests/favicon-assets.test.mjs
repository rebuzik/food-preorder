import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

for (const filename of ["brand-favicon-32-v2.png", "brand-favicon-192-v2.png"]) {
  test(`${filename} has transparent padding`, async () => {
    const assetPath = fileURLToPath(new URL(`../public/${filename}`, import.meta.url));
    const { data, info } = await sharp(assetPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const alphaAt = (x, y) => data[(y * info.width + x) * info.channels + 3];

    assert.equal(alphaAt(0, 0), 0);
    assert.equal(alphaAt(info.width - 1, 0), 0);
    assert.equal(alphaAt(0, info.height - 1), 0);
    assert.equal(alphaAt(info.width - 1, info.height - 1), 0);
  });
}
