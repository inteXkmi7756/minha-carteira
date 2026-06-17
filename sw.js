/* Service worker — Minha Carteira
   Auto-versao: network-first nos arquivos do app (sempre pega a versao mais
   nova com internet; cai pro cache se offline/lento). Nao precisa subir versao. */
const CACHE = "carteira";
const SHELL = ["./","./index.html","./carteira.html","./ver.html","./cotacoes.js","./manifest.webmanifest","./manifest-ver.webmanifest","./icon-192.png","./icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(()=>{}))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const mesma = url.origin === location.origin;
  const cdn = url.hostname === "cdn.jsdelivr.net";
  if (!mesma && !cdn) return;
  if (cdn) { e.respondWith(caches.open(CACHE).then(async c => { const hit = await c.match(e.request); return hit || fetch(e.request).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; }); })); return; }
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request);
    const rede = fetch(e.request).then(r => { if (r && r.ok) c.put(e.request, r.clone()); return r; });
    if (!hit) return rede.catch(() => hit);
    return Promise.race([ rede.catch(() => hit), new Promise(res => setTimeout(() => res(hit), 3500)) ]).then(resp => resp || rede);
  }));
});
