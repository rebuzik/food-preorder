import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

const openGraphImageMeta =
  /<meta(?=[^>]*\bproperty=["']og:image["'])(?=[^>]*\bcontent=["']https:\/\/food-preorder\.ru\/social-preview\.png["'])[^>]*>/i;

async function renderPage(url, cacheKey) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${cacheKey}-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(url, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("renders development preview metadata", async () => {
  const response = await renderPage("http://localhost/terms", "development");

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("renders a rich social sharing preview", async () => {
  const response = await renderPage("https://food-preorder.ru/terms", "social");

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, openGraphImageMeta);
  assert.match(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']Выберите ассортимент ReFreshTech на следующую неделю["']/i);
  assert.match(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']Отметьте продукты и готовые блюда/i);
  assert.match(html, /<meta[^>]+property=["']og:image:width["'][^>]+content=["']1200["']/i);
  assert.match(html, /<meta[^>]+property=["']og:image:height["'][^>]+content=["']630["']/i);
  assert.match(
    html,
    /<meta[^>]+name=["']twitter:card["'][^>]+content=["']summary_large_image["']/i,
  );
});
