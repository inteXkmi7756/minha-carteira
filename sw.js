/* Service worker — Minha Carteira
   SEM cache do app: sempre busca da rede -> versao SEMPRE atual (Chrome, Brave,
   celular, todos). Na ativacao apaga qualquer cache antigo. Precisa de internet
   para abrir (ja precisa para cotacoes/nuvem). */
self.addEventListener("install", function(e){ self.skipWaiting(); });
self.addEventListener("activate", function(e){
  e.waitUntil((async function(){
    var ks = await caches.keys();
    await Promise.all(ks.map(function(k){ return caches.delete(k); }));
    await self.clients.claim();
  })());
});
/* sem handler de fetch: o navegador busca tudo direto da rede (sempre atual) */
