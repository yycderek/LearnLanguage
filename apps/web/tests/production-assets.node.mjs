import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { startProdServer } from "vinext/server/prod-server";

test("production server exposes every asset referenced by the learning page", async (context) => {
  const { server, port } = await startProdServer({
    host: "127.0.0.1",
    port: 0,
    outDir: fileURLToPath(new URL("../dist", import.meta.url)),
    noCompression: true,
  });
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const pageUrl = `http://127.0.0.1:${port}/learn`;
  const pageResponse = await fetch(pageUrl);
  assert.equal(pageResponse.status, 200);
  const html = await pageResponse.text();
  const assetPaths = [...html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)]
    .map((match) => match[1])
    .filter((path, index, paths) => paths.indexOf(path) === index);

  assert.ok(assetPaths.some((path) => path.endsWith(".css")), "the page should reference a stylesheet");
  assert.ok(assetPaths.some((path) => path.endsWith(".js")), "the page should reference client JavaScript");

  for (const assetPath of assetPaths) {
    const response = await fetch(new URL(assetPath, pageUrl));
    assert.equal(response.status, 200, `${assetPath} should be served by vinext start`);
  }
});
