import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const scope = "https://example.test/nearshore-english-practice-studio-v7k3m9q2/";

function setupWorker() {
  const handlers = new Map();
  const stored = new Map();
  const requests = [];
  let disconnected = false;
  let claimed = false;
  let skipped = false;
  let oldCacheRemoved = false;

  const normalize = (request) => typeof request === "string" ? request : request.url;
  const fetcher = async (request) => {
    const requestUrl = new URL(normalize(request));
    requestUrl.hash = "";
    const url = requestUrl.href;
    requests.push(url);
    if (disconnected) throw new Error("offline");
    if (url === scope) {
      return new Response(`<script src="/nearshore-english-practice-studio-v7k3m9q2/assets/app-123.js"></script><link rel="stylesheet" href="/nearshore-english-practice-studio-v7k3m9q2/assets/app-123.css">`, { status: 200 });
    }
    if (url.endsWith("app-123.css")) return new Response('@font-face{src:url("./font-123.woff2")}', { status: 200 });
    return new Response(`asset ${url}`, { status: 200 });
  };

  const cache = {
    async put(request, response) { stored.set(normalize(request), response.clone()); },
    async match(request) { return stored.get(normalize(request))?.clone(); },
    async addAll(values) {
      for (const url of values) {
        const response = await fetcher(url);
        if (!response.ok) throw new Error("cache add failed");
        stored.set(url, response.clone());
      }
    },
  };

  const caches = {
    async open() { return cache; },
    async keys() { return ["nearshore-english-previous", "unrelated", "nearshore-english-fieldwork-v1"]; },
    async delete(name) { if (name === "nearshore-english-previous") oldCacheRemoved = true; return true; },
  };

  const self = {
    registration: { scope },
    clients: { async claim() { claimed = true; } },
    async skipWaiting() { skipped = true; },
    addEventListener(name, listener) { handlers.set(name, listener); },
  };

  vm.runInNewContext(readFileSync(new URL("../public/service-worker.js", import.meta.url), "utf8"), {
    self, caches, fetch: fetcher, URL, Response, Promise, console,
  });

  async function dispatchLifecycle(name) {
    let work;
    handlers.get(name)({ waitUntil(promise) { work = promise; } });
    await work;
  }

  async function dispatchFetch(request) {
    let response;
    handlers.get("fetch")({ request, respondWith(promise) { response = promise; } });
    return response;
  }

  return {
    cache, stored, requests, dispatchLifecycle, dispatchFetch,
    disconnect() { disconnected = true; },
    reconnect() { disconnected = false; },
    get claimed() { return claimed; },
    get skipped() { return skipped; },
    get oldCacheRemoved() { return oldCacheRemoved; },
  };
}

test("prepares the full learning studio for offline use under the GitHub Pages subpath", async () => {
  const worker = setupWorker();
  await worker.dispatchLifecycle("install");
  assert.ok(worker.skipped);
  assert.ok(worker.stored.has(scope));
  assert.ok(worker.stored.has(`${scope}assets/app-123.js`));
  assert.ok(worker.stored.has(`${scope}assets/app-123.css`));
  assert.ok(worker.stored.has(`${scope}assets/font-123.woff2`));
  assert.ok(worker.stored.has(`${scope}assets/hero-recruiter-english.webp`));
  for (let module = 1; module <= 10; module += 1) {
    assert.ok(worker.stored.has(`${scope}assets/modules/module-${String(module).padStart(2, "0")}.webp`));
  }
  assert.ok(worker.requests.every((url) => url.startsWith(scope)), "Offline caching must never escape the deployed subpath.");
});

test("removes obsolete app caches without touching unrelated websites", async () => {
  const worker = setupWorker();
  await worker.dispatchLifecycle("activate");
  assert.ok(worker.oldCacheRemoved);
  assert.ok(worker.claimed);
});

test("uses the network for new page versions and falls back to the app shell offline", async () => {
  const worker = setupWorker();
  await worker.dispatchLifecycle("install");
  const request = { url: `${scope}#/studio/simulator`, method: "GET", mode: "navigate" };
  const online = await worker.dispatchFetch(request);
  assert.equal(online.status, 200);

  worker.disconnect();
  const offline = await worker.dispatchFetch(request);
  assert.equal(offline.status, 200);
  assert.ok((await offline.text()).includes("app-123.js"));
});

test("does not intercept external requests or non-GET requests", async () => {
  const worker = setupWorker();
  assert.equal(await worker.dispatchFetch({ url: "https://chatgpt.com/", method: "GET", mode: "navigate" }), undefined);
  assert.equal(await worker.dispatchFetch({ url: scope, method: "POST", mode: "cors" }), undefined);
});
