import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readdir, stat } from "node:fs/promises";
import { startProdServer } from "vinext/server/prod-server";

test("non-document client chunks stay below the initial-load budget", async () => {
  const assetsDirectory = fileURLToPath(new URL("../dist/client/assets", import.meta.url));
  const assets = await readdir(assetsDirectory);
  const javascriptAssets = await Promise.all(assets.filter((name) => name.endsWith(".js")).map(async (name) => ({
    name,
    size: (await stat(new URL(`../dist/client/assets/${name}`, import.meta.url))).size,
  })));
  const oversizedInitialAssets = javascriptAssets.filter(({ name, size }) => size > 500 * 1024 && !name.startsWith("document-import-"));
  assert.deepEqual(oversizedInitialAssets, []);
  assert.ok(javascriptAssets.some(({ name, size }) => name.startsWith("document-import-") && size > 500 * 1024), "the known lazy PDF parser should remain isolated");
  assert.ok(javascriptAssets.some(({ name }) => name.startsWith("material-import-dialog-")), "the material dialog should remain a separate chunk");
});
test("production server exposes every asset referenced by Learn and Studio", async (context) => {
  const { server, port } = await startProdServer({
    host: "127.0.0.1",
    port: 0,
    outDir: fileURLToPath(new URL("../dist", import.meta.url)),
    noCompression: true,
  });
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  for (const route of ["/learn", "/studio"]) {
    const pageUrl = `http://127.0.0.1:${port}${route}`;
    const pageResponse = await fetch(pageUrl);
    assert.equal(pageResponse.status, 200);
    assert.equal(pageResponse.headers.get("cache-control"), "no-store, max-age=0");
    assert.equal(pageResponse.headers.get("cdn-cache-control"), "no-store");
    const html = await pageResponse.text();
    const assetPaths = [...html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)]
      .map((match) => match[1])
      .filter((path, index, paths) => paths.indexOf(path) === index);

    assert.ok(assetPaths.some((path) => path.endsWith(".css")), `${route} should reference a stylesheet`);
    assert.ok(assetPaths.some((path) => path.endsWith(".js")), `${route} should reference client JavaScript`);

    for (const assetPath of assetPaths) {
      const response = await fetch(new URL(assetPath, pageUrl));
      assert.equal(response.status, 200, `${route}: ${assetPath} should be served by vinext start`);
    }
  }

  const manifest = await fetch(`http://127.0.0.1:${port}/manifest.webmanifest`);
  assert.equal(manifest.status, 200);
  assert.equal((await manifest.json()).start_url, "/learn");

  const serviceWorker = await fetch(`http://127.0.0.1:${port}/sw.js`);
  assert.equal(serviceWorker.status, 200);
  assert.match(await serviceWorker.text(), /learnlanguage-shell-v2/);
});
