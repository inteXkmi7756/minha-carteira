/* Service worker — Minha Carteira
   Estratégia: stale-while-revalidate para o app e o Chart.js (abre instantâneo,
   atualiza em segundo plano). Chamadas de cotações/nuvem vão direto à rede. */
const CACHE = "carteira-v19";
const SHELL = ["./", "./carteira.html", "./cotacoes.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const ehShell = url.origin === location.origin || url.hostname === "cdn.jsdelivr.net";
  if (!ehShell) return; // APIs de cotação/nuvem: sempre rede
  e.respondWith(
    caches.open(CACHE).then(async c => {
      const hit = await c.match(e.request);
      const rede = fetch(e.request).then(r => {
        if (r && r.ok) c.put(e.request, r.clone());
        return r;
      }).catch(() => hit);
      return hit || rede;
    })
  );
});
