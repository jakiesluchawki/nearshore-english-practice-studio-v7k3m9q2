const CACHE_NAME = "nearshore-english-fieldwork-v2-voice-review";
const scopeUrl = new URL(self.registration.scope);

function scopeAsset(path = "") {
  return new URL(path, scopeUrl).href;
}

function appBundleAssets(html) {
  const paths = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)].map((match) => match[1]);
  return paths.map((path) => new URL(path, scopeUrl).href).filter((value) => new URL(value).origin === scopeUrl.origin);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch(scopeAsset(), { cache: "reload" });
    if (!response.ok) throw new Error("The learning app could not be prepared for offline use.");
    const copy = response.clone();
    await cache.put(scopeAsset(), response);
    const files = [
      ...appBundleAssets(await copy.text()),
      scopeAsset("manifest.webmanifest"),
      scopeAsset("icons/app-icon-192.png"),
      scopeAsset("icons/app-icon-512.png"),
      scopeAsset("assets/hero-recruiter-english.webp"),
      scopeAsset("assets/lesson-library.webp"),
      scopeAsset("assets/brain-empty-rescue.webp"),
      ...Array.from({ length: 10 }, (_, index) => scopeAsset(`assets/modules/module-${String(index + 1).padStart(2, "0")}.webp`)),
    ];
    await cache.addAll([...new Set(files)]);
    for (const stylesheet of files.filter((file) => file.endsWith(".css"))) {
      const response = await cache.match(stylesheet);
      if (!response) continue;
      const fonts = [...(await response.text()).matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g)]
        .map((match) => new URL(match[1], stylesheet).href)
        .filter((url) => new URL(url).origin === scopeUrl.origin);
      if (fonts.length) await cache.addAll([...new Set(fonts)]);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith("nearshore-english-") && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const fresh = await fetch(request);
        if (fresh.ok) {
          await cache.put(scopeAsset(), fresh.clone());
          return fresh;
        }
        return (await cache.match(scopeAsset())) || fresh;
      } catch {
        return (await cache.match(scopeAsset())) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const stored = await cache.match(request);
    if (stored) return stored;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return Response.error();
    }
  })());
});
