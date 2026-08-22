import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const scope = "https://example.test/nearshore-english-practice-studio-v7k3m9q2/";
const workerSource = readFileSync(new URL("../public/service-worker.js", import.meta.url), "utf8");
const currentCacheName = workerSource.match(/const CACHE_NAME = "([^"]+)"/)?.[1];
const previousCacheName = "nearshore-english-fieldwork-v1";

function setupWorker() {
  const handlers = new Map();
  const stores = new Map([
    [previousCacheName, new Map([[scope, new Response('<script src="assets/app-previous.js"></script>')]])],
    ["unrelated", new Map()],
  ]);
  const requests = [];
  let disconnected = false;
  let claimed = false;
  let skipped = false;
  let oldCacheRemoved = false;
  let failedAsset = "";
  let failedNavigation = false;

  const normalize = (request) => typeof request === "string" ? request : request.url;
  const fetcher = async (request) => {
    const requestUrl = new URL(normalize(request));
    requestUrl.hash = "";
    const url = requestUrl.href;
    requests.push(url);
    if (disconnected) throw new Error("offline");
    if (failedNavigation && url === scope) return new Response("temporarily unavailable", { status: 503 });
    if (failedAsset && url.includes(failedAsset)) return new Response("unavailable", { status: 503 });
    if (url === scope) {
      return new Response(`<script src="/nearshore-english-practice-studio-v7k3m9q2/assets/app-123.js"></script><link rel="stylesheet" href="/nearshore-english-practice-studio-v7k3m9q2/assets/app-123.css">`, { status: 200 });
    }
    if (url.endsWith("app-123.css")) return new Response('@font-face{src:url("./font-123.woff2")}', { status: 200 });
    return new Response(`asset ${url}`, { status: 200 });
  };

  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const stored = stores.get(name);
      return {
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
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) {
      if (name === previousCacheName) oldCacheRemoved = true;
      return stores.delete(name);
    },
  };

  const self = {
    registration: { scope },
    clients: { async claim() { claimed = true; } },
    async skipWaiting() { skipped = true; },
    addEventListener(name, listener) { handlers.set(name, listener); },
  };

  vm.runInNewContext(workerSource, {
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
    stores, requests, dispatchLifecycle, dispatchFetch,
    disconnect() { disconnected = true; },
    reconnect() { disconnected = false; },
    failAsset(path) { failedAsset = path; },
    failNavigation() { failedNavigation = true; },
    get stored() { return stores.get(currentCacheName); },
    get previousStored() { return stores.get(previousCacheName); },
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
  await worker.dispatchLifecycle("install");
  await worker.dispatchLifecycle("activate");
  assert.ok(worker.oldCacheRemoved);
  assert.ok(worker.stores.has("unrelated"));
  assert.ok(worker.stores.has(currentCacheName));
  assert.ok(worker.claimed);
});

test("keeps the working offline version intact when a new deployment cannot finish installing", async () => {
  const worker = setupWorker();
  assert.notEqual(currentCacheName, previousCacheName, "Each changed worker must prepare a separate versioned cache.");
  const previousShell = await worker.previousStored.get(scope).clone().text();

  worker.failAsset("app-123.js");
  await assert.rejects(worker.dispatchLifecycle("install"), /cache add failed/);

  assert.equal(await worker.previousStored.get(scope).clone().text(), previousShell);
  assert.ok(worker.previousStored.has(scope));
  assert.equal(worker.oldCacheRemoved, false);
  assert.equal(worker.claimed, false);
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

test("opens the cached lessons when the hosting provider temporarily returns an error", async () => {
  const worker = setupWorker();
  await worker.dispatchLifecycle("install");
  worker.failNavigation();

  const response = await worker.dispatchFetch({ url: `${scope}#/lesson/31`, method: "GET", mode: "navigate" });
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes("app-123.js"));
});

test("does not intercept external requests or non-GET requests", async () => {
  const worker = setupWorker();
  assert.equal(await worker.dispatchFetch({ url: "https://chatgpt.com/", method: "GET", mode: "navigate" }), undefined);
  assert.equal(await worker.dispatchFetch({ url: scope, method: "POST", mode: "cors" }), undefined);
});
